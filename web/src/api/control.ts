import { controlRequest } from './client';
import type {
  HealthzData,
  ReadyzData,
  VersionData,
  QubuiFS,
  QubuiFSListData,
  QubuiFSCreateRequest,
  QubuiFSCreateData,
  TopologyNodeRequest,
  TopologyNodeData,
  NodeListData,
  CrushNode,
  AddNodeRequest,
  RegisterNodeData,
  NodeStatus,
  NodeDeviceListData,
  AddDataDeviceRequest,
  AddDataDeviceData,
  DeleteDataDeviceData,
  ExportMetadataRequest,
  ExportMetadataData,
  MetaServiceListData,
  MetaServiceData,
  MetaServiceCreateRequest,
  MetaServiceCreateData,
  MetaServiceUpdateRequest,
  MetaServiceDeleteData,
  MetaInstanceListData,
  MetaInstanceData,
  MetaInstanceCreateRequest,
  MetaInstanceCreateData,
  MetaInstanceUpdateRequest,
  MetaInstanceDeleteData,
  ImageCatalogData,
  NamespaceData,
  NamespaceListData,
  NamespaceCreateRequest,
  NamespaceUpdateRequest,
  NamespaceDeleteData,
  QubuiFSNodeRequest,
  QubuiFSDiskRequest,
  DataNodeListData,
  RegisterDataNodeRequest,
  RegisterDataNodeData,
  DataNodeStatus,
  DataNodeDeviceListData,
  DataNodeAddDeviceRequest,
  DataNodeAddDeviceData,
  ClusterDataNodeCandidate,
  DataNodeDeploymentRequest,
} from '@/types/api';

/* ===== 系统状态 ===== */

export const getHealthz = () => controlRequest<HealthzData>('/healthz');
export const getReadyz = () => controlRequest<ReadyzData>('/readyz');
export const getVersion = () => controlRequest<VersionData>('/version');

/* ===== QubuiFS 文件系统 ===== */

export const listQubuiFS = async () => {
  // 真实后端返回 filesystems 为 {namespace: {fs_uuid: QubuiFS}} 嵌套对象，
  // mock 返回数组；这里统一扁平化为数组。
  const data = await controlRequest<QubuiFSListData>('/qubuifs');
  const raw = data?.filesystems;
  if (Array.isArray(raw)) return data;
  if (raw && typeof raw === 'object') {
    const flat: QubuiFS[] = [];
    for (const nsKey of Object.keys(raw)) {
      const nsVal = (raw as Record<string, unknown>)[nsKey];
      if (nsVal && typeof nsVal === 'object') {
        for (const fsUuid of Object.keys(nsVal as Record<string, unknown>)) {
          const fs = (nsVal as Record<string, QubuiFS>)[fsUuid];
          if (fs && fs.fs_uuid) flat.push(fs);
        }
      }
    }
    return { ...data, filesystems: flat, count: flat.length };
  }
  return { ...data, filesystems: [] };
};

export const getQubuiFS = (fsUuid: string) =>
  controlRequest<QubuiFS>(`/qubuifs/${encodeURIComponent(fsUuid)}`);

export const createQubuiFS = (body: QubuiFSCreateRequest) =>
  controlRequest<QubuiFSCreateData>('/qubuifs', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const deleteQubuiFS = (fsUuid: string) =>
  controlRequest<void>(`/qubuifs/${encodeURIComponent(fsUuid)}`, {
    method: 'DELETE',
  });

export const registerTopologyNode = (fsUuid: string, body: TopologyNodeRequest) =>
  controlRequest<TopologyNodeData>(
    `/qubuifs/${encodeURIComponent(fsUuid)}/topology/register`,
    { method: 'POST', body: JSON.stringify(body) },
  );

export const unregisterTopologyNode = (fsUuid: string, body: TopologyNodeRequest) =>
  controlRequest<TopologyNodeData>(
    `/qubuifs/${encodeURIComponent(fsUuid)}/topology/register`,
    { method: 'DELETE', body: JSON.stringify(body) },
  );

/* ===== 节点 ===== */

export const listNodes = () => controlRequest<NodeListData>('/nodes');

export const getNode = (nodeId: string) =>
  controlRequest<CrushNode>(`/nodes/${encodeURIComponent(nodeId)}`);

export const addNode = (body: AddNodeRequest) =>
  controlRequest<RegisterNodeData>('/nodes', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const deleteNode = (nodeId: string) =>
  controlRequest<void>(`/nodes/${encodeURIComponent(nodeId)}`, {
    method: 'DELETE',
  });

export const getNodeStatus = (nodeId: string) =>
  controlRequest<NodeStatus>(`/nodes/${encodeURIComponent(nodeId)}/status`);

/* ===== 节点数据设备 ===== */

export const listNodeDevices = (nodeId: string) =>
  controlRequest<NodeDeviceListData>(`/nodes/${encodeURIComponent(nodeId)}/devices`);

export const addDataDevice = (nodeId: string, body: AddDataDeviceRequest) =>
  controlRequest<AddDataDeviceData>(`/nodes/${encodeURIComponent(nodeId)}/devices`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const deleteDataDevice = (nodeId: string, deviceUuid: string) =>
  controlRequest<DeleteDataDeviceData>(
    `/nodes/${encodeURIComponent(nodeId)}/devices/${encodeURIComponent(deviceUuid)}`,
    { method: 'DELETE' },
  );

/* ===== 元数据导出 ===== */

export const exportMetadata = (body: ExportMetadataRequest) =>
  controlRequest<ExportMetadataData>('/metadata/export', {
    method: 'POST',
    body: JSON.stringify(body),
  });

/* ===== DataNode ===== */

export const listDataNodes = () => controlRequest<DataNodeListData>('/datanodes');

export const getDataNode = (datanodeId: string) =>
  controlRequest<CrushNode>(`/datanodes/${encodeURIComponent(datanodeId)}`);

export const registerDataNode = (body: RegisterDataNodeRequest) =>
  controlRequest<RegisterDataNodeData>('/datanodes', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const unregisterDataNode = (datanodeId: string) =>
  controlRequest<void>(`/datanodes/${encodeURIComponent(datanodeId)}`, {
    method: 'DELETE',
  });

export const getDataNodeStatus = (datanodeId: string) =>
  controlRequest<DataNodeStatus>(`/datanodes/${encodeURIComponent(datanodeId)}/status`);

export const listFreeDataNodeDevices = (datanodeId: string) =>
  controlRequest<DataNodeDeviceListData>(
    `/datanodes/${encodeURIComponent(datanodeId)}/free-devices`,
  );

export const listManagedDataNodeDevices = (datanodeId: string) =>
  controlRequest<DataNodeDeviceListData>(
    `/datanodes/${encodeURIComponent(datanodeId)}/managed-devices`,
  );

export const addDataNodeDevice = (datanodeId: string, body: DataNodeAddDeviceRequest) =>
  controlRequest<DataNodeAddDeviceData>(
    `/datanodes/${encodeURIComponent(datanodeId)}/devices`,
    { method: 'POST', body: JSON.stringify(body) },
  );

export const deleteDataNodeDevice = (datanodeId: string, deviceUuid: string) =>
  controlRequest<DeleteDataDeviceData>(
    `/datanodes/${encodeURIComponent(datanodeId)}/devices/${encodeURIComponent(deviceUuid)}`,
    { method: 'DELETE' },
  );

/* ===== 集群 DataNode 部署 ===== */

export const listClusterDataNodes = () =>
  controlRequest<ClusterDataNodeCandidate[]>('/cluster/datanodes');

export const deployDataNode = (body: DataNodeDeploymentRequest) =>
  controlRequest<void>('/cluster/datanodes', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const deleteClusterDataNode = (body: { node: string }) =>
  controlRequest<void>('/cluster/datanodes', {
    method: 'DELETE',
    body: JSON.stringify(body),
  });

/* ===== 元数据服务 (MetaService) ===== */

export const listMetaServices = () =>
  controlRequest<MetaServiceListData>('/meta/services');

export const getMetaService = (serviceId: string) =>
  controlRequest<MetaServiceData>(`/meta/services/${encodeURIComponent(serviceId)}`);

export const createMetaService = (body: MetaServiceCreateRequest) =>
  controlRequest<MetaServiceCreateData>('/meta/services', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const updateMetaService = (serviceId: string, body: MetaServiceUpdateRequest) =>
  controlRequest<MetaServiceData>(`/meta/services/${encodeURIComponent(serviceId)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

export const deleteMetaService = (serviceId: string) =>
  controlRequest<MetaServiceDeleteData>(`/meta/services/${encodeURIComponent(serviceId)}`, {
    method: 'DELETE',
  });

/* ===== 元数据实例 (MetaInstance) ===== */

export const listMetaInstances = (serviceId: string) =>
  controlRequest<MetaInstanceListData>(
    `/meta/services/${encodeURIComponent(serviceId)}/instances`,
  );

export const getMetaInstance = (serviceId: string, instanceId: string) =>
  controlRequest<MetaInstanceData>(
    `/meta/services/${encodeURIComponent(serviceId)}/instances/${encodeURIComponent(instanceId)}`,
  );

export const createMetaInstance = (serviceId: string, body: MetaInstanceCreateRequest) =>
  controlRequest<MetaInstanceCreateData>(
    `/meta/services/${encodeURIComponent(serviceId)}/instances`,
    { method: 'POST', body: JSON.stringify(body) },
  );

export const updateMetaInstance = (
  serviceId: string,
  instanceId: string,
  body: MetaInstanceUpdateRequest,
) =>
  controlRequest<MetaInstanceData>(
    `/meta/services/${encodeURIComponent(serviceId)}/instances/${encodeURIComponent(instanceId)}`,
    { method: 'PUT', body: JSON.stringify(body) },
  );

export const deleteMetaInstance = (serviceId: string, instanceId: string) =>
  controlRequest<MetaInstanceDeleteData>(
    `/meta/services/${encodeURIComponent(serviceId)}/instances/${encodeURIComponent(instanceId)}`,
    { method: 'DELETE' },
  );

/* ===== 镜像目录 (ImageCatalog) ===== */

export const listImageCatalog = () =>
  controlRequest<ImageCatalogData>('/images/catalog');

/* ===== 命名空间 (Namespace) ===== */

export const listNamespaces = () =>
  controlRequest<NamespaceListData>('/namespaces');

export const getNamespace = (name: string) =>
  controlRequest<NamespaceData>(`/namespaces/${encodeURIComponent(name)}`);

export const createNamespace = (body: NamespaceCreateRequest) =>
  controlRequest<NamespaceData>('/namespaces', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const updateNamespace = (name: string, body: NamespaceUpdateRequest) =>
  controlRequest<NamespaceData>(`/namespaces/${encodeURIComponent(name)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

export const deleteNamespace = (name: string) =>
  controlRequest<NamespaceDeleteData>(`/namespaces/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });

/* ===== QubuiFS 子资源（meta/data node、磁盘） ===== */

export const addQubuiFSDataNode = (fsUuid: string, body: QubuiFSNodeRequest) =>
  controlRequest<QubuiFS>(`/qubuifs/${encodeURIComponent(fsUuid)}/data-nodes`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const deleteQubuiFSDataNode = (fsUuid: string, body: QubuiFSNodeRequest) =>
  controlRequest<QubuiFS>(`/qubuifs/${encodeURIComponent(fsUuid)}/data-nodes`, {
    method: 'DELETE',
    body: JSON.stringify(body),
  });

export const addQubuiFSDisk = (fsUuid: string, body: QubuiFSDiskRequest) =>
  controlRequest<QubuiFS>(`/qubuifs/${encodeURIComponent(fsUuid)}/disks`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const deleteQubuiFSDisk = (fsUuid: string, body: QubuiFSDiskRequest) =>
  controlRequest<QubuiFS>(`/qubuifs/${encodeURIComponent(fsUuid)}/disks`, {
    method: 'DELETE',
    body: JSON.stringify(body),
  });
