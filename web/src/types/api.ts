/**
 * TypeScript 类型定义，与 openapi.yaml 对齐。
 * 控制面统一响应结构：{ code, message, data }，code=0 表示成功。
 */

/** 控制面统一响应包装 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T | null;
}

/** 健康检查数据 */
export interface HealthzData {
  status: 'ok';
}

/** 就绪检查数据 */
export interface ReadyzData {
  ready: boolean;
  reason?: string;
}

/** 版本信息 */
export interface VersionData {
  version: string;
  git_commit?: string;
  build_time?: string;
}

/** 错误数据 */
export interface ErrorData {
  field?: string;
  reason?: string;
}

/** DiskLabel */
export interface DiskLabel {
  fs_uuid?: string;
  device_uuid?: string;
  qfs_prefix?: number;
  idx?: number;
}

/** MountInfo */
export interface MountInfo {
  path: string;
  node_id: string;
}

/** QubuiFS 文件系统 */
export interface QubuiFS {
  fs_uuid: string;
  fs_id?: number;
  disk_labels?: DiskLabel[];
  namespace: string;
  mount_info?: MountInfo[];
  meta_node_id?: string[];
  meta_service_id?: string;
  data_node_id?: string[];
}

/** QubuiFS 列表响应数据 */
export interface QubuiFSListData {
  /** 真实后端返回 {namespace: {fs_uuid: QubuiFS}}，mock 返回 QubuiFS[]；listQubuiFS 会统一扁平化为数组 */
  filesystems: QubuiFS[] | Record<string, Record<string, QubuiFS>>;
  count: number;
}

/** QubuiFS 创建请求 */
export interface QubuiFSCreateRequest {
  namespace: string;
  meta_service_id: string;
  disk_labels?: DiskLabel[];
  data_node_id?: string[];
}

/** QubuiFS 创建响应数据 */
export interface QubuiFSCreateData {
  fs_uuid: string;
}

/** QubuiFS 节点增删请求（meta/data node） */
export interface QubuiFSNodeRequest {
  node_id: string;
}

/** QubuiFS 磁盘增删请求 */
export interface QubuiFSDiskRequest {
  device_uuid: string;
  qfs_prefix: number;
}

/** 拓扑节点注册/注销请求 */
export interface TopologyNodeRequest {
  namespace: string;
  fs_uuid: string;
  node_id: string;
}

/** 拓扑节点注册/注销响应数据 */
export interface TopologyNodeData {
  namespace: string;
  fs_uuid: string;
  node_id: string;
}

/** SuperBlock */
export interface SuperBlock {
  disk_label?: DiskLabel;
  version?: number;
  magic_num?: number;
  checksum?: number;
  size?: number;
  io_size?: number;
  access?: number;
  block_size?: number;
  dir_len?: number;
  epoch_head?: number;
  generation?: number;
}

/** DeviceInfo 数据设备 */
export interface DeviceInfo {
  device_uuid?: string;
  qfs_prefix?: number;
  class?: 0 | 1 | 2 | 3;
  super_block?: SuperBlock;
  cap?: number;
  phy_path: string;
  devType: number;
}

/** NodeType 枚举（pb.NodeType） */
export enum NodeType {
  UNKNOWN = 0,
  ROOT = 1,
  REGION = 2,
  RACK = 3,
  HOST = 4,
  META = 5,
  DATA = 6,
  GATEWAY = 7,
  CLIENT = 8,
}

/** InOutState 枚举（pb.InOutState） */
export enum InOutState {
  IN = 0,
  OUT = 1,
  DRAIN = 2,
}

/** DeviceClass 枚举 */
export enum DeviceClass {
  UNKNOWN = 0,
  HDD = 1,
  SSD = 2,
  NVME = 3,
}

/** HealthStatus 枚举 */
export enum HealthStatus {
  UNKNOWN = 0,
  OK = 1,
  WARN = 2,
  ERROR = 3,
  DOWN = 4,
}

/** NodeRole 枚举（位掩码） */
export enum NodeRole {
  NONE = 0,
  META = 1,
  DATA = 2,
  GATEWAY = 4,
}

/** CrushNode 节点 */
export interface CrushNode {
  node_id: string;
  type: NodeType;
  parent_node_id: string;
  children?: string[];
  weight?: number;
  state: InOutState;
  reweight?: number;
  device?: DeviceInfo[];
  tags?: Record<string, string>;
  addr: string;
  qdp_port?: number;
  data_rpc_port?: number;
  meta_rpc_port?: number;
  des?: string;
  role: number;
  fs_uuid_list?: string[];
  version?: string;
  namespace?: string;
}

/** 节点列表数据 */
export interface NodeListData {
  nodes: CrushNode[];
  count: number;
}

/** AddNode 请求（与 CrushNode 同构；node_id 必填） */
export type AddNodeRequest = CrushNode;

/** AddNode 响应数据（RegisterNodeData） */
export interface RegisterNodeData {
  node_id: string;
  endpoint: string;
}

/** AddDataDevice 请求 */
export interface AddDataDeviceRequest {
  node_id: string;
  device: DeviceInfo;
  des?: string;
  force_init?: boolean;
}

/** AddDataDevice 响应数据 */
export interface AddDataDeviceData {
  device_uuid: string;
  qfs_prefix: number;
  node_id?: string;
}

/** DeleteDataDevice 可选请求体 */
export interface DeleteDataDeviceRequest {
  qfs_prefix?: number;
  phy_path?: string;
  node_id: string;
  device_uuid: string;
}

/** DeleteDataDevice 响应数据 */
export interface DeleteDataDeviceData {
  code: number;
  message: string;
}

/** 节点设备列表响应数据 */
export interface NodeDeviceListData {
  node_id: string;
  devices: DeviceInfo[];
}

/** 节点状态（pb.NodeStatusResp） */
export interface NodeStatus {
  worker_node_id: string;
  /** pb.NodeRole 位掩码值（0/1/2/4） */
  worker_node_type?: number;
  session_id?: number;
  ack_seq?: number;
  ts_unix?: number;
  health_status: HealthStatus;
  current_config_version?: number;
  message?: string;
}

/** 元数据导出请求 */
export interface ExportMetadataRequest {
  dest: string;
}

/** 元数据导出响应数据 */
export interface ExportMetadataData {
  dest: string;
}

/* ========== DataNode ========== */

/** DataNode 列表响应数据（元素为 CrushNode） */
export interface DataNodeListData {
  datanodes: CrushNode[];
  count: number;
}

/** DataNode 注册请求（控制面生成 node_id；role 需含 DATA 位） */
export interface RegisterDataNodeRequest {
  addr: string;
  role: number;
  parent_node_id?: string;
  qdp_port?: number;
  data_rpc_port?: number;
  meta_rpc_port?: number;
  tags?: Record<string, string>;
  des?: string;
  namespace?: string;
}

/** DataNode 注册响应数据 */
export interface RegisterDataNodeData {
  node_id: string;
  endpoint: string;
}

/** DataNode 状态（pb.NodeStatusResp） */
export interface DataNodeStatus {
  worker_node_id: string;
  worker_node_type?: number;
  session_id?: number;
  ack_seq?: number;
  ts_unix?: number;
  health_status: HealthStatus;
  current_config_version?: number;
  message?: string;
}

/** DataNode 设备列表响应数据（free/managed 通用） */
export interface DataNodeDeviceListData {
  node_id: string;
  devices: DeviceInfo[];
}

/** DataNode 添加设备请求（请求体不携带 node_id，由路径参数决定） */
export interface DataNodeAddDeviceRequest {
  phy_path: string;
  dev_type: 0 | 1;
  force_init?: boolean;
}

/** DataNode 添加设备响应数据 */
export interface DataNodeAddDeviceData {
  device_uuid: string;
  qfs_prefix: number;
  node_id?: string;
}

/** 集群内可用于 DataNode 部署的 k8s 节点（GET /cluster/datanodes 候选） */
export interface ClusterDataNodeCandidate {
  name: string;
  qubuifs_node: boolean;
  architecture: string;
}

/** 部署 DataNode 请求（POST /cluster/datanodes） */
export interface DataNodeDeploymentRequest {
  node: string;
  image_version: string;
}

/* ========== 元数据服务 (MetaService) ========== */

/** 元数据服务创建请求 */
export interface MetaServiceCreateRequest {
  /** 命名空间数组，长度恰好为 1 */
  namespace: string[];
  fs_uuid_list?: string[];
  des?: string;
  version?: string;
}

/** 元数据服务创建响应 */
export interface MetaServiceCreateData {
  service_id: string;
}

/** 元数据服务更新请求（namespace 不可变） */
export interface MetaServiceUpdateRequest {
  fs_uuid_list?: string[];
  des?: string;
  version?: string;
}

/** 元数据服务数据 */
export interface MetaServiceData {
  service_id: string;
  fs_uuid_list?: string[];
  namespace: string[];
  des?: string;
  version?: string;
}

/** 元数据服务列表响应 */
export interface MetaServiceListData {
  services: MetaServiceData[];
  count: number;
}

/** 元数据服务删除响应 */
export interface MetaServiceDeleteData {
  service_id: string;
}

/* ========== 元数据实例 (MetaInstance) ========== */

/** 元数据实例创建请求 */
export interface MetaInstanceCreateRequest {
  image: string;
  des?: string;
  version?: string;
}

/** 元数据实例创建响应 */
export interface MetaInstanceCreateData {
  service_id: string;
  instance_id: string;
}

/** 元数据实例更新请求 */
export interface MetaInstanceUpdateRequest {
  image: string;
  des?: string;
  version?: string;
}

/** 元数据实例数据 */
export interface MetaInstanceData {
  instance_id: string;
  service_id: string;
  addr?: string;
  meta_rpc_port?: number;
  namespace?: string[];
  image?: string;
  des?: string;
  version?: string;
}

/** 元数据实例列表响应 */
export interface MetaInstanceListData {
  instances: MetaInstanceData[];
  count: number;
}

/** 元数据实例删除响应 */
export interface MetaInstanceDeleteData {
  service_id: string;
  instance_id: string;
}

/* ========== 镜像目录 (ImageCatalog) ========== */

/** 单个镜像版本信息 */
export interface ImageVersion {
  /** 发布的镜像 tag */
  version: string;
  /** 完整镜像引用（含 tag） */
  image: string;
  /** 不可变的 OCI digest */
  digest: string;
  /** 推送到镜像仓库的时间 */
  pushed_at?: string;
}

/** 镜像目录返回数据，按组件分组 */
export interface ImageCatalogData {
  meta: ImageVersion[];
  data: ImageVersion[];
  control_plane: ImageVersion[];
  client: ImageVersion[];
}

/* ========== 命名空间 (Namespace) ========== */

/** 命名空间创建请求 */
export interface NamespaceCreateRequest {
  name: string;
  description?: string;
}

/** 命名空间更新请求（只能改 description） */
export interface NamespaceUpdateRequest {
  description: string;
}

/** 命名空间数据 */
export interface NamespaceData {
  name: string;
  description: string;
  filesystem_count: number;
}

/** 命名空间列表响应 */
export interface NamespaceListData {
  namespaces: NamespaceData[];
  count: number;
}

/** 命名空间删除响应 */
export interface NamespaceDeleteData {
  name: string;
}

/** 会话状态（网关侧维护） */
export interface SessionState {
  connected: boolean;
  endpoint: string;
  displayName?: string;
  connectedAt?: string;
  health?: HealthzData;
  ready?: ReadyzData;
  version?: VersionData;
  message?: string;
  detail?: string;
}

/** 会话连接状态机 */
export enum ConnState {
  INIT = 'INIT',
  HANDSHAKING = 'HANDSHAKING',
  CONNECTED = 'CONNECTED',
  FAILED = 'FAILED',
  DISCONNECTED = 'DISCONNECTED',
}

/** 调试日志条目 */
export interface DebugLogEntry {
  id: string;
  ts: string;
  method: string;
  url: string;
  status: number;
  elapsed: number;
  reqBody: string | null;
  respBody: string | null;
  error?: string;
}
