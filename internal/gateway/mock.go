package gateway

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

// serveMock 提供内置 mock 控制面，用于本地调试无真实后端时验证 UI。
// 端点形如 "mock://local"，代理时把 /api/control/xxx 路由到 serveMock("/xxx")。
//
// 故意把后端未实现的接口返回 501，以便前端验证"后端未实现"分支。
func (g *Gateway) serveMock(w http.ResponseWriter, r *http.Request, path string) {
	switch r.Method {
	case http.MethodGet:
		switch path {
		case "/healthz":
			mockOK(w, map[string]any{"status": "ok"})
		case "/readyz":
			mockOK(w, map[string]any{"ready": false, "reason": "not implemented (mock)"})
		case "/version":
			mockOK(w, map[string]any{
				"version":    "dev-mock",
				"git_commit": "mock1234",
				"build_time": "2025-01-01T00:00:00Z",
			})
		case "/qubuifs":
			mockOK(w, map[string]any{
				"filesystems": mockFilesystems,
				"count":       len(mockFilesystems),
			})
		case "/nodes":
			mockOK(w, map[string]any{
				"nodes": mockNodes,
				"count": len(mockNodes),
			})
		case "/meta/services":
			svcs := mockMetaServiceList()
			mockOK(w, map[string]any{"services": svcs, "count": len(svcs)})
		case "/images/catalog":
			mockOK(w, mockImageCatalog)
		case "/datanodes":
			// 列表：过滤 role 含 DATA 位的 mock 节点
			var dns []map[string]any
			for _, n := range mockNodes {
				role, _ := n["role"].(int)
				if role&2 != 0 {
					dns = append(dns, n)
				}
			}
			if dns == nil {
				dns = []map[string]any{}
			}
			mockOK(w, map[string]any{"datanodes": dns, "count": len(dns)})
		case "/cluster/datanodes":
			// 候选：提供一个可供部署的 k8s 节点
			mockOK(w, []map[string]any{
				{
					"name":          "k8s-node-1",
					"qubuifs_node":  false,
					"architecture":  "amd64",
				},
				{
					"name":          "k8s-node-2",
					"qubuifs_node":  false,
					"architecture":  "arm64",
				},
			})
		case "/namespaces":
			ns := mockNamespaceList()
			mockOK(w, map[string]any{"namespaces": ns, "count": len(ns)})
		default:
			if name, ok := strings.CutPrefix(path, "/namespaces/"); ok {
				if _, exists := mockNamespaceDesc[name]; !exists {
					found := false
					for _, fs := range mockFilesystems {
						if getString(fs, "namespace") == name {
							found = true
							break
						}
					}
					if !found {
						mockNotFound(w, "namespace not found: "+name)
						return
					}
				}
				mockOK(w, map[string]any{
					"name":             name,
					"description":      mockNamespaceDesc[name],
					"filesystem_count": mockNamespaceCount(name),
				})
				return
			}
			if fsUUID, ok := pathPrefixMatch(path, "/qubuifs/"); ok {
				if _, ok := mockFsByUUID[fsUUID]; ok {
					mockOK(w, mockFsByUUID[fsUUID])
				} else {
					mockNotFound(w, "qubuifs not found: "+fsUUID)
				}
				return
			}
			if rest, ok := strings.CutPrefix(path, "/meta/services/"); ok {
				segs := strings.Split(rest, "/")
				svcID := segs[0]
				if _, ok := mockMetaServiceByID[svcID]; !ok {
					mockNotFound(w, "meta service not found: "+svcID)
					return
				}
				// /meta/services/{service_id}
				if len(segs) == 1 {
					mockOK(w, mockMetaServiceByID[svcID])
					return
				}
				// /meta/services/{service_id}/instances
				if len(segs) == 2 && segs[1] == "instances" {
					insts := mockMetaInstanceList(svcID)
					mockOK(w, map[string]any{"instances": insts, "count": len(insts)})
					return
				}
				// /meta/services/{service_id}/instances/{instance_id}
				if len(segs) == 3 && segs[1] == "instances" {
					if inst, ok := mockMetaInstanceByID[svcID+"/"+segs[2]]; ok {
						mockOK(w, inst)
					} else {
						mockNotFound(w, "meta instance not found: "+segs[2])
					}
					return
				}
				mockNotImplemented(w, "GET "+path)
				return
			}
			if nodeID, ok := pathPrefixMatch(path, "/nodes/"); ok {
				if parts := strings.Split(strings.TrimPrefix(path, "/nodes/"), "/"); len(parts) >= 2 {
					nodeID = parts[0]
					sub := parts[1]
					if sub == "status" {
						if st, ok := mockNodeStatus[nodeID]; ok {
							mockOK(w, st)
						} else {
							mockNotFound(w, "node status not found: "+nodeID)
						}
						return
					}
					if sub == "devices" {
						if devs, ok := mockNodeDevices[nodeID]; ok {
							mockOK(w, map[string]any{"node_id": nodeID, "devices": devs})
						} else {
							mockOK(w, map[string]any{"node_id": nodeID, "devices": []any{}})
						}
						return
					}
				}
				if n, ok := mockNodeByID[nodeID]; ok {
					mockOK(w, n)
				} else {
					mockNotFound(w, "node not found: "+nodeID)
				}
				return
			}
			if _, ok := pathPrefixMatch(path, "/datanodes/"); ok {
				parts := strings.Split(strings.TrimPrefix(path, "/datanodes/"), "/")
				id := parts[0]
				// 子资源：status / free-devices / managed-devices
				if len(parts) >= 2 {
					switch parts[1] {
					case "status":
						if st, ok := mockNodeStatus[id]; ok {
							mockOK(w, st)
						} else {
							mockOK(w, map[string]any{
								"worker_node_id": id,
								"health_status":  4,
								"message":        "mock: not_found",
							})
						}
						return
					case "free-devices":
						mockOK(w, map[string]any{"node_id": id, "devices": []any{}})
						return
					case "managed-devices":
						if devs, ok := mockNodeDevices[id]; ok {
							mockOK(w, map[string]any{"node_id": id, "devices": devs})
						} else {
							mockOK(w, map[string]any{"node_id": id, "devices": []any{}})
						}
						return
					}
				}
				if n, ok := mockNodeByID[id]; ok {
					mockOK(w, n)
				} else {
					mockNotFound(w, "datanode not found: "+id)
				}
				return
			}
			mockNotImplemented(w, "GET "+path)
		}
	case http.MethodPost:
		switch path {
		case "/qubuifs":
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			uuid := fmt.Sprintf("fs-mock-%d", time.Now().UnixNano()%100000)
			mockOK(w, map[string]any{"fs_uuid": uuid})
		case "/metadata/export":
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			dest, _ := body["dest"].(string)
			if dest == "" {
				mockFail(w, "dest is required")
				return
			}
			mockOK(w, map[string]any{"dest": dest})
		case "/nodes":
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			nodeID, _ := body["node_id"].(string)
			if nodeID == "" {
				nodeID = "node-new"
			}
			mockOK(w, map[string]any{"node_id": nodeID, "endpoint": "mock://local"})
		case "/meta/services":
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			svcID := fmt.Sprintf("ms-mock-%d", time.Now().UnixNano()%100000)
			nsArr, _ := body["namespace"].([]any)
			var ns []string
			for _, n := range nsArr {
				if s, ok := n.(string); ok {
					ns = append(ns, s)
				}
			}
			if len(ns) == 0 {
				ns = []string{"default"}
			}
			svc := map[string]any{
				"service_id":   svcID,
				"namespace":    ns,
				"fs_uuid_list": toStringSlice(body["fs_uuid_list"]),
				"des":          getString(body, "des"),
				"version":      getString(body, "version"),
			}
			mockMetaServiceByID[svcID] = svc
			mockOK(w, map[string]any{"service_id": svcID})
		case "/namespaces":
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			name := getString(body, "name")
			if name == "" {
				mockFail(w, "name is required")
				return
			}
			if _, exists := mockNamespaceDesc[name]; exists {
				mockFail(w, "namespace already exists: "+name)
				return
			}
			desc := getString(body, "description")
			mockNamespaceDesc[name] = desc
			mockOK(w, map[string]any{
				"name":             name,
				"description":      desc,
				"filesystem_count": 0,
			})
		case "/cluster/datanodes":
			// 部署：仅校验必填，返回 202 兼容（mockOK 返回 200）
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			if getString(body, "node") == "" || getString(body, "image_version") == "" {
				mockFail(w, "node and image_version are required")
				return
			}
			mockOK(w, map[string]any{
				"code":    0,
				"message": "accepted",
			})
		default:
			// /qubuifs/{fs_uuid}/{data-nodes|disks}
			if rest, ok := strings.CutPrefix(path, "/qubuifs/"); ok {
				segs := strings.Split(rest, "/")
				if len(segs) == 2 {
					fsUUID := segs[0]
					sub := segs[1]
					if sub == "data-nodes" {
						fs, ok := mockFsByUUID[fsUUID]
						if !ok {
							mockNotFound(w, "qubuifs not found: "+fsUUID)
							return
						}
						var body map[string]any
						_ = json.NewDecoder(r.Body).Decode(&body)
						nodeID := getString(body, "node_id")
						if nodeID == "" {
							mockFail(w, "node_id is required")
							return
						}
						field := "data_node_id"
						existing := toStringSlice(fs[field])
						dup := false
						for _, n := range existing {
							if n == nodeID {
								dup = true
								break
							}
						}
						if !dup {
							existing = append(existing, nodeID)
							fs[field] = existing
						}
						mockOK(w, fs)
						return
					}
					if sub == "disks" {
						fs, ok := mockFsByUUID[fsUUID]
						if !ok {
							mockNotFound(w, "qubuifs not found: "+fsUUID)
							return
						}
						var body map[string]any
						_ = json.NewDecoder(r.Body).Decode(&body)
						deviceUUID := getString(body, "device_uuid")
						if deviceUUID == "" {
							mockFail(w, "device_uuid is required")
							return
						}
						qfsPrefix := 0
						if v, ok := body["qfs_prefix"].(float64); ok {
							qfsPrefix = int(v)
						}
						disks, _ := fs["disk_labels"].([]map[string]any)
						newDisk := map[string]any{
							"fs_uuid":     fsUUID,
							"device_uuid": deviceUUID,
							"qfs_prefix":  qfsPrefix,
							"idx":         len(disks),
						}
						disks = append(disks, newDisk)
						fs["disk_labels"] = disks
						mockOK(w, fs)
						return
					}
				}
			}
			if strings.HasPrefix(path, "/qubuifs/") && strings.HasSuffix(path, "/topology/register") {
				mockOK(w, map[string]any{
					"namespace": "default",
					"fs_uuid":   "fs-mock",
					"node_id":   "node-mock",
				})
				return
			}
			if strings.HasPrefix(path, "/nodes/") && strings.HasSuffix(path, "/devices") {
				parts := strings.Split(strings.TrimPrefix(path, "/nodes/"), "/")
				mockOK(w, map[string]any{
					"device_uuid": "dev-mock-1",
					"qfs_prefix":  0,
					"node_id":     parts[0],
				})
				return
			}
			// /meta/services/{service_id}/instances
			if rest, ok := strings.CutPrefix(path, "/meta/services/"); ok {
				segs := strings.Split(rest, "/")
				if len(segs) == 2 && segs[1] == "instances" {
					svcID := segs[0]
					var body map[string]any
					_ = json.NewDecoder(r.Body).Decode(&body)
					instID := fmt.Sprintf("mi-mock-%d", time.Now().UnixNano()%100000)
					inst := map[string]any{
						"instance_id": instID,
						"service_id":  svcID,
						"image":       getString(body, "image"),
						"des":         getString(body, "des"),
						"version":     getString(body, "version"),
					}
					if svc, ok := mockMetaServiceByID[svcID]; ok {
						inst["namespace"] = svc["namespace"]
					}
					mockMetaInstanceByID[svcID+"/"+instID] = inst
					mockOK(w, map[string]any{"service_id": svcID, "instance_id": instID})
					return
				}
			}
			mockNotImplemented(w, "POST "+path)
		}
	case http.MethodPut:
		if name, ok := strings.CutPrefix(path, "/namespaces/"); ok {
			if _, exists := mockNamespaceDesc[name]; !exists {
				mockNotFound(w, "namespace not found: "+name)
				return
			}
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			if desc, ok := body["description"].(string); ok {
				mockNamespaceDesc[name] = desc
			}
			mockOK(w, map[string]any{
				"name":             name,
				"description":      mockNamespaceDesc[name],
				"filesystem_count": mockNamespaceCount(name),
			})
			return
		}
		if rest, ok := strings.CutPrefix(path, "/meta/services/"); ok {
			segs := strings.Split(rest, "/")
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			// /meta/services/{service_id}
			if len(segs) == 1 {
				svcID := segs[0]
				svc, ok := mockMetaServiceByID[svcID]
				if !ok {
					mockNotFound(w, "meta service not found: "+svcID)
					return
				}
				if v, ok := body["fs_uuid_list"]; ok {
					svc["fs_uuid_list"] = toStringSlice(v)
				}
				if v, ok := body["des"].(string); ok {
					svc["des"] = v
				}
				if v, ok := body["version"].(string); ok {
					svc["version"] = v
				}
				mockOK(w, svc)
				return
			}
			// /meta/services/{service_id}/instances/{instance_id}
			if len(segs) == 3 && segs[1] == "instances" {
				key := segs[0] + "/" + segs[2]
				inst, ok := mockMetaInstanceByID[key]
				if !ok {
					mockNotFound(w, "meta instance not found: "+segs[2])
					return
				}
				if v, ok := body["image"].(string); ok {
					inst["image"] = v
				}
				if v, ok := body["des"].(string); ok {
					inst["des"] = v
				}
				if v, ok := body["version"].(string); ok {
					inst["version"] = v
				}
				mockOK(w, inst)
				return
			}
		}
		mockNotImplemented(w, "PUT "+path)
	case http.MethodDelete:
		switch {
		case strings.HasPrefix(path, "/qubuifs/") && strings.HasSuffix(path, "/data-nodes"):
			rest, _ := strings.CutPrefix(path, "/qubuifs/")
			segs := strings.Split(rest, "/")
			fsUUID := segs[0]
			fs, ok := mockFsByUUID[fsUUID]
			if !ok {
				mockNotFound(w, "qubuifs not found: "+fsUUID)
				return
			}
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			nodeID := getString(body, "node_id")
			if nodeID == "" {
				mockFail(w, "node_id is required")
				return
			}
			field := "data_node_id"
			existing := toStringSlice(fs[field])
			out := []string{}
			for _, n := range existing {
				if n != nodeID {
					out = append(out, n)
				}
			}
			fs[field] = out
			mockOK(w, fs)
		case strings.HasPrefix(path, "/qubuifs/") && strings.HasSuffix(path, "/disks"):
			rest, _ := strings.CutPrefix(path, "/qubuifs/")
			segs := strings.Split(rest, "/")
			fsUUID := segs[0]
			fs, ok := mockFsByUUID[fsUUID]
			if !ok {
				mockNotFound(w, "qubuifs not found: "+fsUUID)
				return
			}
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			deviceUUID := getString(body, "device_uuid")
			bodyQfs := 0
			if v, ok := body["qfs_prefix"].(float64); ok {
				bodyQfs = int(v)
			}
			disks, _ := fs["disk_labels"].([]map[string]any)
			out := []map[string]any{}
			for _, d := range disks {
				devID, _ := d["device_uuid"].(string)
				existingQfs := 0
				switch v := d["qfs_prefix"].(type) {
				case int:
					existingQfs = v
				case float64:
					existingQfs = int(v)
				}
				if devID == deviceUUID && existingQfs == bodyQfs {
					continue
				}
				out = append(out, d)
			}
			fs["disk_labels"] = out
			mockOK(w, fs)
		case strings.HasPrefix(path, "/namespaces/"):
			name := strings.TrimPrefix(path, "/namespaces/")
			if _, exists := mockNamespaceDesc[name]; !exists {
				found := false
				for _, fs := range mockFilesystems {
					if getString(fs, "namespace") == name {
						found = true
						break
					}
				}
				if !found {
					mockNotFound(w, "namespace not found: "+name)
					return
				}
			}
			if mockNamespaceCount(name) > 0 {
				mockFail(w, "namespace has filesystems: "+name)
				return
			}
			delete(mockNamespaceDesc, name)
			mockOK(w, map[string]any{"name": name})
		case strings.HasPrefix(path, "/qubuifs/") && !strings.Contains(path, "topology"):
			mockOKEmpty(w)
		case strings.HasPrefix(path, "/nodes/") && !strings.Contains(path, "devices"):
			mockOKEmpty(w)
		case strings.HasPrefix(path, "/nodes/") && strings.Contains(path, "/devices/"):
			mockOK(w, map[string]any{"code": 0, "message": "deleted"})
		case strings.HasPrefix(path, "/qubuifs/") && strings.HasSuffix(path, "/topology/register"):
			mockOK(w, map[string]any{
				"namespace": "default",
				"fs_uuid":   "fs-mock",
				"node_id":   "node-mock",
			})
		default:
			if rest, ok := strings.CutPrefix(path, "/meta/services/"); ok {
				segs := strings.Split(rest, "/")
				// /meta/services/{service_id}
				if len(segs) == 1 {
					svcID := segs[0]
					if _, ok := mockMetaServiceByID[svcID]; !ok {
						mockNotFound(w, "meta service not found: "+svcID)
						return
					}
					// 级联删除实例
					for k := range mockMetaInstanceByID {
						if strings.HasPrefix(k, svcID+"/") {
							delete(mockMetaInstanceByID, k)
						}
					}
					delete(mockMetaServiceByID, svcID)
					mockOK(w, map[string]any{"service_id": svcID})
					return
				}
				// /meta/services/{service_id}/instances/{instance_id}
				if len(segs) == 3 && segs[1] == "instances" {
					key := segs[0] + "/" + segs[2]
					if _, ok := mockMetaInstanceByID[key]; !ok {
						mockNotFound(w, "meta instance not found: "+segs[2])
						return
					}
					delete(mockMetaInstanceByID, key)
					mockOK(w, map[string]any{"service_id": segs[0], "instance_id": segs[2]})
					return
				}
			}
			mockNotImplemented(w, "DELETE "+path)
		}
	default:
		mockNotImplemented(w, r.Method+" "+path)
	}
}

// pathPrefixMatch 若 path 形如 prefix + id，返回 (id, true)。
func pathPrefixMatch(path, prefix string) (string, bool) {
	if !strings.HasPrefix(path, prefix) {
		return "", false
	}
	return strings.TrimPrefix(path, prefix), true
}

func mockOK(w http.ResponseWriter, data any) {
	writeJSON(w, http.StatusOK, map[string]any{
		"code":    0,
		"message": "ok",
		"data":    data,
	})
}

func mockOKEmpty(w http.ResponseWriter) {
	writeJSON(w, http.StatusOK, map[string]any{
		"code":    0,
		"message": "ok",
		"data":    nil,
	})
}

func mockFail(w http.ResponseWriter, message string) {
	writeJSON(w, http.StatusOK, map[string]any{
		"code":    1,
		"message": message,
		"data":    nil,
	})
}

func mockNotFound(w http.ResponseWriter, message string) {
	writeJSON(w, http.StatusNotFound, map[string]any{
		"code":    404,
		"message": message,
		"data":    nil,
	})
}

func mockNotImplemented(w http.ResponseWriter, op string) {
	writeJSON(w, http.StatusNotImplemented, map[string]any{
		"code":    501,
		"message": "not implemented (mock): " + op,
		"data":    nil,
	})
}

// mock 数据。结构与 openapi.yaml 对齐。
var (
	mockFilesystems = []map[string]any{
		{
			"fs_uuid":   "fs-uuid-001",
			"fs_id":     1,
			"namespace": "default",
			"disk_labels": []map[string]any{
				{"fs_uuid": "fs-uuid-001", "device_uuid": "dev-uuid-001", "qfs_prefix": 1, "idx": 0},
				{"fs_uuid": "fs-uuid-001", "device_uuid": "dev-uuid-002", "qfs_prefix": 2, "idx": 1},
			},
			"mount_info": []map[string]any{
				{"path": "/mnt/qfs", "node_id": "node-3"},
			},
			"meta_node_id":    []string{"node-1", "node-2"},
			"meta_service_id": "ms-mock-001",
			"data_node_id":    []string{"node-3", "node-4"},
		},
		{
			"fs_uuid":   "fs-uuid-002",
			"fs_id":     2,
			"namespace": "production",
			"disk_labels": []map[string]any{
				{"fs_uuid": "fs-uuid-002", "device_uuid": "dev-uuid-003", "qfs_prefix": 1, "idx": 0},
			},
			"mount_info":      []map[string]any{},
			"meta_node_id":    []string{"node-1"},
			"meta_service_id": "ms-mock-002",
			"data_node_id":    []string{"node-5", "node-6"},
		},
	}

	mockNodes = []map[string]any{
		{
			"node_id":        "node-1",
			"type":           1,
			"parent_node_id": "root",
			"children":       []string{},
			"weight":         1024,
			"state":          0,
			"reweight":       1.0,
			"addr":           "10.0.0.1:9665",
			"qdp_port":       9665,
			"data_rpc_port":  9666,
			"meta_rpc_port":  9667,
			"role":           1,
			"version":        "dev-mock",
			"namespace":      "default",
			"des":            "主元数据节点",
			"fs_uuid_list":   []string{"fs-uuid-001", "fs-uuid-002"},
		},
		{
			"node_id":        "node-3",
			"type":           2,
			"parent_node_id": "root",
			"children":       []string{},
			"weight":         2048,
			"state":          0,
			"reweight":       1.0,
			"addr":           "10.0.0.3:9665",
			"role":           2,
			"version":        "dev-mock",
			"namespace":      "default",
			"fs_uuid_list":   []string{"fs-uuid-001"},
		},
		{
			"node_id":        "node-5",
			"type":           2,
			"parent_node_id": "root",
			"children":       []string{},
			"weight":         4096,
			"state":          0,
			"reweight":       1.0,
			"addr":           "10.0.0.5:9665",
			"role":           2,
			"version":        "dev-mock",
			"namespace":      "production",
			"fs_uuid_list":   []string{"fs-uuid-002"},
		},
		{
			"node_id":        "node-9",
			"type":           2,
			"parent_node_id": "root",
			"children":       []string{},
			"weight":         0,
			"state":          1,
			"reweight":       0.0,
			"addr":           "10.0.0.9:9665",
			"role":           2,
			"version":        "dev-mock",
			"namespace":      "production",
			"fs_uuid_list":   []string{},
		},
	}

	mockNodeStatus = map[string]map[string]any{
		"node-1": {
			"worker_node_id":          "node-1",
			"worker_node_type":        1,
			"session_id":              1001,
			"ack_seq":                  200,
			"ts_unix":                  time.Now().Unix(),
			"health_status":           1,
			"current_config_version":   5,
			"message":                  "ok",
		},
		"node-3": {
			"worker_node_id":          "node-3",
			"worker_node_type":        2,
			"session_id":              1002,
			"ack_seq":                  198,
			"ts_unix":                  time.Now().Unix(),
			"health_status":           1,
			"current_config_version":   5,
			"message":                  "ok",
		},
		"node-9": {
			"worker_node_id":          "node-9",
			"worker_node_type":        2,
			"session_id":              0,
			"ack_seq":                  0,
			"ts_unix":                  0,
			"health_status":           3,
			"current_config_version":   0,
			"message":                  "node offline",
		},
	}

	mockNodeDevices = map[string][]map[string]any{
		"node-3": {
			{
				"device_uuid": "dev-uuid-001",
				"qfs_prefix":  1,
				"class":        1,
				"cap":          2_000_000_000_000,
				"phy_path":     "/dev/sdb1",
				"devType":       1,
			},
			{
				"device_uuid": "dev-uuid-002",
				"qfs_prefix":  2,
				"class":        0,
				"cap":          1_000_000_000_000,
				"phy_path":     "/dev/sdc1",
				"devType":       0,
			},
		},
		"node-5": {
			{
				"device_uuid": "dev-uuid-003",
				"qfs_prefix":  3,
				"class":        1,
				"cap":          4_000_000_000_000,
				"phy_path":     "/dev/sdd1",
				"devType":       1,
			},
		},
	}

	// mockNamespaceDesc 存储 namespace name → description。
	// mockFilesystems 中已有的 namespace（default/production）默认填充描述。
	mockNamespaceDesc = map[string]string{
		"default":    "默认命名空间",
		"production": "生产环境命名空间",
	}
)

// 索引：fsUUID/nodeID → 数据，便于 mock 查询。
var (
	mockFsByUUID = map[string]map[string]any{}
	mockNodeByID = map[string]map[string]any{}
)

func init() {
	for i := range mockFilesystems {
		uuid := mockFilesystems[i]["fs_uuid"].(string)
		mockFsByUUID[uuid] = mockFilesystems[i]
	}
	for i := range mockNodes {
		id := mockNodes[i]["node_id"].(string)
		mockNodeByID[id] = mockNodes[i]
	}
}

// mockNamespaceCount 统计某个 namespace 下的文件系统数量。
func mockNamespaceCount(ns string) int {
	count := 0
	for _, fs := range mockFilesystems {
		if getString(fs, "namespace") == ns {
			count++
		}
	}
	return count
}

// mockNamespaceList 返回所有已知 namespace 列表（含已创建但无 fs 的）。
// 顺序：先按字母序输出 mockNamespaceDesc 中的 namespace，
// 再补上 mockFilesystems 中出现但 mockNamespaceDesc 中没有的 namespace。
func mockNamespaceList() []map[string]any {
	seen := map[string]bool{}
	names := make([]string, 0, len(mockNamespaceDesc))
	for name := range mockNamespaceDesc {
		names = append(names, name)
	}
	sort.Strings(names)
	out := []map[string]any{}
	for _, name := range names {
		out = append(out, map[string]any{
			"name":             name,
			"description":      mockNamespaceDesc[name],
			"filesystem_count": mockNamespaceCount(name),
		})
		seen[name] = true
	}
	for _, fs := range mockFilesystems {
		ns := getString(fs, "namespace")
		if ns != "" && !seen[ns] {
			out = append(out, map[string]any{
				"name":             ns,
				"description":      "",
				"filesystem_count": mockNamespaceCount(ns),
			})
			seen[ns] = true
		}
	}
	return out
}

// === Meta Service / Instance mock 数据 ===

// mockMetaServiceByID: service_id → 服务数据。
var mockMetaServiceByID = map[string]map[string]any{
	"ms-default": {
		"service_id":   "ms-default",
		"namespace":    []string{"default"},
		"fs_uuid_list": []string{"fs-uuid-001", "fs-uuid-002"},
		"version":      "v1.0.0",
		"des":          "默认元数据服务",
	},
	"ms-prod": {
		"service_id":   "ms-prod",
		"namespace":    []string{"production"},
		"fs_uuid_list": []string{"fs-uuid-002"},
		"version":      "v1.2.0",
		"des":          "生产环境元数据服务",
	},
}

// mockMetaInstanceByID: "service_id/instance_id" → 实例数据。
var mockMetaInstanceByID = map[string]map[string]any{
	"ms-default/mi-1": {
		"instance_id":  "mi-1",
		"service_id":   "ms-default",
		"addr":         "10.0.0.11",
		"meta_rpc_port": 9667,
		"namespace":    []string{"default"},
		"image":        "qubuifs/meta:v1.0.0",
		"version":      "v1.0.0",
		"des":          "主实例",
	},
	"ms-default/mi-2": {
		"instance_id":  "mi-2",
		"service_id":   "ms-default",
		"addr":         "10.0.0.12",
		"meta_rpc_port": 9667,
		"namespace":    []string{"default"},
		"image":        "qubuifs/meta:v1.0.0",
		"version":      "v1.0.0",
		"des":          "从实例",
	},
	"ms-prod/mi-3": {
		"instance_id":  "mi-3",
		"service_id":   "ms-prod",
		"addr":         "10.0.0.21",
		"meta_rpc_port": 9667,
		"namespace":    []string{"production"},
		"image":        "qubuifs/meta:v1.2.0",
		"version":      "v1.2.0",
		"des":          "生产主实例",
	},
}

// mockMetaServiceList 返回所有元数据服务（按 service_id 排序保证稳定）。
func mockMetaServiceList() []map[string]any {
	out := make([]map[string]any, 0, len(mockMetaServiceByID))
	for _, svc := range mockMetaServiceByID {
		out = append(out, svc)
	}
	return out
}

// mockMetaInstanceList 返回某个 service 下所有实例。
func mockMetaInstanceList(svcID string) []map[string]any {
	out := []map[string]any{}
	prefix := svcID + "/"
	for key, inst := range mockMetaInstanceByID {
		if strings.HasPrefix(key, prefix) {
			out = append(out, inst)
		}
	}
	return out
}

// toStringSlice 把 any（可能是 []any 或 []string）安全转换为 []string。
func toStringSlice(v any) []string {
	if v == nil {
		return []string{}
	}
	switch s := v.(type) {
	case []string:
		return s
	case []any:
		out := make([]string, 0, len(s))
		for _, item := range s {
			if str, ok := item.(string); ok {
				out = append(out, str)
			}
		}
		return out
	default:
		return []string{}
	}
}

// getString 安全地从 map 中取字符串字段，缺失或类型不符返回空串。
func getString(m map[string]any, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

// 防止 strconv 未使用（保留给未来扩展用）。
var _ = strconv.Itoa

// mockImageCatalog 镜像目录数据，结构与 openapi/schemas/image.yaml 对齐。
var mockImageCatalog = map[string]any{
	"meta": []map[string]any{
		{
			"version":   "v1.2.0",
			"image":     "harbor.local/qubuifs/meta:v1.2.0",
			"digest":    "sha256:1111111111111111111111111111111111111111111111111111111111111111",
			"pushed_at": "2026-07-18T10:00:00Z",
		},
		{
			"version":   "v1.1.0",
			"image":     "harbor.local/qubuifs/meta:v1.1.0",
			"digest":    "sha256:2222222222222222222222222222222222222222222222222222222222222222",
			"pushed_at": "2026-07-10T10:00:00Z",
		},
		{
			"version":   "v1.0.0",
			"image":     "harbor.local/qubuifs/meta:v1.0.0",
			"digest":    "sha256:3333333333333333333333333333333333333333333333333333333333333333",
			"pushed_at": "2026-06-30T10:00:00Z",
		},
	},
	"data": []map[string]any{
		{
			"version":   "v1.2.0",
			"image":     "harbor.local/qubuifs/data:v1.2.0",
			"digest":    "sha256:4444444444444444444444444444444444444444444444444444444444444444",
			"pushed_at": "2026-07-18T10:00:00Z",
		},
	},
	"control_plane": []map[string]any{
		{
			"version":   "v0.9.0",
			"image":     "harbor.local/qubuifs/control-plane:v0.9.0",
			"digest":    "sha256:5555555555555555555555555555555555555555555555555555555555555555",
			"pushed_at": "2026-07-15T10:00:00Z",
		},
	},
	"client": []map[string]any{},
}
