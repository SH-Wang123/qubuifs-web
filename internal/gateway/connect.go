package gateway

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// controlResponse 是控制面统一响应体。
type controlResponse struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

// ConnectRequest 是前端握手请求体。
type ConnectRequest struct {
	Endpoint    string `json:"endpoint"`
	DisplayName string `json:"display_name,omitempty"`
}

// probeOnce 请求控制面单个端点，返回原始响应与解析后的 controlResponse。
// 失败时返回 error，resp 可能为 nil。
func (g *Gateway) probeOnce(ctx context.Context, endpoint, path string) (*http.Response, *controlResponse, error) {
	target := strings.TrimRight(endpoint, "/") + path
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return nil, nil, fmt.Errorf("invalid endpoint: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	resp, err := g.client.Do(req)
	if err != nil {
		return nil, nil, fmt.Errorf("control plane unreachable: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	cr := &controlResponse{}
	if jerr := json.Unmarshal(body, cr); jerr != nil {
		return resp, nil, fmt.Errorf("non-json response from %s: %w", path, jerr)
	}
	return resp, cr, nil
}

// handleConnect 处理 POST /api/session/connect。
// 流程：校验端点 → healthz → version → readyz → 写会话。
func (g *Gateway) handleConnect(w http.ResponseWriter, r *http.Request) {
	var req ConnectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeAPIError(w, http.StatusBadRequest, -1, "invalid request body", err.Error())
		return
	}
	endpoint := strings.TrimSpace(req.Endpoint)

	// mock 端点：仅当 MockControl 启用时允许，跳过真实 HTTP 探测，直接构造 mock 会话
	if isMockEndpoint(endpoint) {
		if !g.cfg.MockControl {
			writeAPIError(w, http.StatusBadRequest, -1, "invalid endpoint",
				"mock:// endpoint requires QUBUIFS_WEB_MOCK_CONTROL=1")
			return
		}
		now := time.Now()
		st := &SessionState{
			Connected:   true,
			Endpoint:    endpoint,
			DisplayName: req.DisplayName,
			ConnectedAt: &now,
			Health:      &Health{Status: "ok"},
			Ready:       &Ready{Ready: false, Reason: "not implemented (mock)"},
			Version: &Version{
				Version:   "dev-mock",
				GitCommit: "mock1234",
				BuildTime: "2025-01-01T00:00:00Z",
			},
		}
		if err := g.sessions.Set(w, r, st); err != nil {
			writeAPIError(w, http.StatusInternalServerError, -1, "failed to save session", err.Error())
			return
		}
		g.logf("connect: connected to mock endpoint %s (display=%q)", endpoint, req.DisplayName)
		writeJSON(w, http.StatusOK, st)
		return
	}

	if !isValidEndpoint(endpoint) {
		writeAPIError(w, http.StatusBadRequest, -1, "invalid endpoint", "must be http:// or https:// URL with host")
		return
	}
	if !g.isAllowed(endpoint) {
		writeAPIError(w, http.StatusForbidden, -1, "endpoint not allowed", "endpoint not in allowlist")
		return
	}

	// 保留旧会话的显示名称，若用户提交新值则覆盖
	if req.DisplayName == "" {
		if old := g.sessions.Get(r); old != nil {
			req.DisplayName = old.DisplayName
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), g.cfg.ConnectTimeout)
	defer cancel()

	// 1. healthz 必须通过
	hresp, hcr, err := g.probeOnce(ctx, endpoint, "/healthz")
	if err != nil {
		g.logf("connect: healthz probe failed: %v", err)
		st := &SessionState{
			Connected: false,
			Endpoint:  endpoint,
			Message:   "control plane health check failed",
			Detail:    err.Error(),
		}
		_ = g.sessions.Set(w, r, st) // 保存失败状态以便前端展示
		writeJSON(w, http.StatusOK, st)
		return
	}
	if hresp.StatusCode != http.StatusOK || hcr == nil || hcr.Code != 0 {
		msg := "healthz returned non-success"
		if hcr != nil {
			msg = hcr.Message
		}
		st := &SessionState{
			Connected: false,
			Endpoint:  endpoint,
			Message:   "control plane health check failed",
			Detail:    fmt.Sprintf("HTTP %d: %s", hresp.StatusCode, msg),
		}
		_ = g.sessions.Set(w, r, st)
		writeJSON(w, http.StatusOK, st)
		return
	}
	health := &Health{}
	_ = json.Unmarshal(hcr.Data, health)
	if health.Status != "ok" {
		st := &SessionState{
			Connected: false,
			Endpoint:  endpoint,
			Message:   "healthz status not ok",
			Detail:    fmt.Sprintf("status=%q", health.Status),
		}
		_ = g.sessions.Set(w, r, st)
		writeJSON(w, http.StatusOK, st)
		return
	}

	// 2. version 失败不阻断
	state := &SessionState{
		Connected:   true,
		Endpoint:    endpoint,
		DisplayName: req.DisplayName,
		Health:      health,
	}
	if _, vcr, verr := g.probeOnce(ctx, endpoint, "/version"); verr == nil && vcr != nil && vcr.Code == 0 {
		v := &Version{}
		_ = json.Unmarshal(vcr.Data, v)
		state.Version = v
	} else if verr != nil {
		g.logf("connect: version probe failed (non-blocking): %v", verr)
	}

	// 3. readyz 失败不阻断，ready=false 也不阻断
	if _, rcr, rerr := g.probeOnce(ctx, endpoint, "/readyz"); rerr == nil && rcr != nil && rcr.Code == 0 {
		rd := &Ready{}
		_ = json.Unmarshal(rcr.Data, rd)
		state.Ready = rd
	} else if rerr != nil {
		g.logf("connect: readyz probe failed (non-blocking): %v", rerr)
	}

	now := time.Now()
	state.ConnectedAt = &now
	if err := g.sessions.Set(w, r, state); err != nil {
		writeAPIError(w, http.StatusInternalServerError, -1, "failed to save session", err.Error())
		return
	}
	g.logf("connect: connected to %s (display=%q)", endpoint, req.DisplayName)
	writeJSON(w, http.StatusOK, state)
}

// handleSessionGet 处理 GET /api/session。
func (g *Gateway) handleSessionGet(w http.ResponseWriter, r *http.Request) {
	st := g.sessions.Get(r)
	if st == nil {
		writeJSON(w, http.StatusOK, &SessionState{Connected: false})
		return
	}
	writeJSON(w, http.StatusOK, st)
}

// handleSessionDelete 处理 DELETE /api/session。
func (g *Gateway) handleSessionDelete(w http.ResponseWriter, r *http.Request) {
	if st := g.sessions.Get(r); st != nil {
		g.logf("disconnect: endpoint=%s", st.Endpoint)
	}
	g.sessions.Clear(w, r)
	writeJSON(w, http.StatusOK, map[string]any{"connected": false})
}

// handleProbe 处理 POST /api/session/probe。
// 重新对当前端点执行 healthz+version+readyz，更新会话状态。
func (g *Gateway) handleProbe(w http.ResponseWriter, r *http.Request) {
	st := g.sessions.Get(r)
	if st == nil || !st.Connected {
		writeAPIError(w, http.StatusConflict, -1, "not_connected", "no active control plane session")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), g.cfg.ConnectTimeout)
	defer cancel()

	updated := *st // 拷贝
	if _, hcr, err := g.probeOnce(ctx, st.Endpoint, "/healthz"); err == nil && hcr != nil && hcr.Code == 0 {
		h := &Health{}
		_ = json.Unmarshal(hcr.Data, h)
		updated.Health = h
	}
	if _, vcr, err := g.probeOnce(ctx, st.Endpoint, "/version"); err == nil && vcr != nil && vcr.Code == 0 {
		v := &Version{}
		_ = json.Unmarshal(vcr.Data, v)
		updated.Version = v
	}
	if _, rcr, err := g.probeOnce(ctx, st.Endpoint, "/readyz"); err == nil && rcr != nil && rcr.Code == 0 {
		rd := &Ready{}
		_ = json.Unmarshal(rcr.Data, rd)
		updated.Ready = rd
	}
	if err := g.sessions.Set(w, r, &updated); err != nil {
		writeAPIError(w, http.StatusInternalServerError, -1, "failed to save session", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, &updated)
}

// isValidEndpoint 校验端点格式：必须是 http/https 且有 host。
func isValidEndpoint(s string) bool {
	if s == "" {
		return false
	}
	u, err := url.Parse(s)
	if err != nil {
		return false
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return false
	}
	if u.Host == "" {
		return false
	}
	return true
}

// isAllowed 检查端点是否在 allowlist 内（空列表表示不限制）。
func (g *Gateway) isAllowed(endpoint string) bool {
	if len(g.cfg.AllowedEndpoints) == 0 {
		return true
	}
	u, err := url.Parse(endpoint)
	if err != nil {
		return false
	}
	target := u.Host
	for _, a := range g.cfg.AllowedEndpoints {
		if a == endpoint || a == target {
			return true
		}
		au, err := url.Parse(a)
		if err == nil && au.Host == target {
			return true
		}
	}
	return false
}
