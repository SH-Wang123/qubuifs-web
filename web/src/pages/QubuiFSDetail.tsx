import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Trash2, Loader2, Plus, UserMinus } from 'lucide-react';
import {
  getQubuiFS,
  registerTopologyNode,
  unregisterTopologyNode,
  addQubuiFSMetaNode,
  deleteQubuiFSMetaNode,
  addQubuiFSDataNode,
  deleteQubuiFSDataNode,
  addQubuiFSDisk,
  deleteQubuiFSDisk,
  listNodes,
} from '@/api/control';
import {
  type QubuiFS as QubuiFSType,
  type TopologyNodeRequest,
  type CrushNode,
  type DiskLabel,
  NodeRole,
} from '@/types/api';
import { ApiError } from '@/api/client';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

type TabId = 'basic' | 'meta' | 'data' | 'disks';

export function QubuiFSDetailPage() {
  const { fsUuid = '' } = useParams();
  const decodedFsUuid = decodeURIComponent(fsUuid);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [fs, setFs] = useState<QubuiFSType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('basic');

  // 节点列表（用于添加 meta/data node 时下拉选择）
  const [nodes, setNodes] = useState<CrushNode[]>([]);
  const [nodesLoading, setNodesLoading] = useState(false);
  const [nodesLoaded, setNodesLoaded] = useState(false);

  // 添加 / 删除 Meta Node
  const [addMetaOpen, setAddMetaOpen] = useState(false);
  const [addMetaNodeId, setAddMetaNodeId] = useState('');
  const [delMetaNodeId, setDelMetaNodeId] = useState<string | null>(null);

  // 添加 / 删除 Data Node
  const [addDataOpen, setAddDataOpen] = useState(false);
  const [addDataNodeId, setAddDataNodeId] = useState('');
  const [delDataNodeId, setDelDataNodeId] = useState<string | null>(null);

  // 添加 / 删除 磁盘
  const [addDiskOpen, setAddDiskOpen] = useState(false);
  const [diskDeviceUuid, setDiskDeviceUuid] = useState('');
  const [diskQfsPrefix, setDiskQfsPrefix] = useState<number>(0);
  const [delDisk, setDelDisk] = useState<DiskLabel | null>(null);

  // 拓扑节点操作（保留）
  const [opNodeId, setOpNodeId] = useState('');
  const [opKind, setOpKind] = useState<'register' | 'unregister' | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getQubuiFS(decodedFsUuid);
      setFs(data);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [decodedFsUuid]);

  useEffect(() => {
    load();
  }, [load]);

  const loadNodes = useCallback(async () => {
    setNodesLoading(true);
    try {
      const data = await listNodes();
      setNodes(Array.isArray(data?.nodes) ? data.nodes : []);
      setNodesLoaded(true);
    } catch (err) {
      setModalError(extractError(err));
    } finally {
      setNodesLoading(false);
    }
  }, []);

  // 打开任一添加节点 Modal 时按需拉取节点列表
  useEffect(() => {
    if ((addMetaOpen || addDataOpen) && !nodesLoaded && !nodesLoading) {
      loadNodes();
    }
  }, [addMetaOpen, addDataOpen, nodesLoaded, nodesLoading, loadNodes]);

  // role 匹配者优先；再按 node_id 字母序
  const sortedMetaNodes = useMemo(
    () => sortNodesByRole(nodes, NodeRole.META),
    [nodes],
  );
  const sortedDataNodes = useMemo(
    () => sortNodesByRole(nodes, NodeRole.DATA),
    [nodes],
  );

  // ===== Meta Node 操作 =====
  const onAddMeta = async () => {
    if (!addMetaNodeId || submitting || !fs) return;
    setSubmitting(true);
    setModalError(null);
    try {
      await addQubuiFSMetaNode(fs.fs_uuid, { node_id: addMetaNodeId });
      setAddMetaOpen(false);
      setAddMetaNodeId('');
      await load();
    } catch (err) {
      setModalError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onDelMeta = async () => {
    if (!delMetaNodeId || submitting || !fs) return;
    setSubmitting(true);
    setModalError(null);
    try {
      await deleteQubuiFSMetaNode(fs.fs_uuid, { node_id: delMetaNodeId });
      setDelMetaNodeId(null);
      await load();
    } catch (err) {
      setModalError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  // ===== Data Node 操作 =====
  const onAddData = async () => {
    if (!addDataNodeId || submitting || !fs) return;
    setSubmitting(true);
    setModalError(null);
    try {
      await addQubuiFSDataNode(fs.fs_uuid, { node_id: addDataNodeId });
      setAddDataOpen(false);
      setAddDataNodeId('');
      await load();
    } catch (err) {
      setModalError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onDelData = async () => {
    if (!delDataNodeId || submitting || !fs) return;
    setSubmitting(true);
    setModalError(null);
    try {
      await deleteQubuiFSDataNode(fs.fs_uuid, { node_id: delDataNodeId });
      setDelDataNodeId(null);
      await load();
    } catch (err) {
      setModalError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  // ===== 磁盘操作 =====
  const onAddDisk = async () => {
    if (!diskDeviceUuid.trim() || submitting || !fs) return;
    setSubmitting(true);
    setModalError(null);
    try {
      await addQubuiFSDisk(fs.fs_uuid, {
        device_uuid: diskDeviceUuid.trim(),
        qfs_prefix: diskQfsPrefix,
      });
      setAddDiskOpen(false);
      setDiskDeviceUuid('');
      setDiskQfsPrefix(0);
      await load();
    } catch (err) {
      setModalError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onDelDisk = async () => {
    if (!delDisk || submitting || !fs) return;
    setSubmitting(true);
    setModalError(null);
    try {
      await deleteQubuiFSDisk(fs.fs_uuid, {
        device_uuid: delDisk.device_uuid ?? '',
        qfs_prefix: delDisk.qfs_prefix ?? 0,
      });
      setDelDisk(null);
      await load();
    } catch (err) {
      setModalError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  // ===== 拓扑节点操作（保留） =====
  const onTopologyOp = async () => {
    if (!opNodeId || submitting || !opKind || !fs) return;
    setSubmitting(true);
    setModalError(null);
    try {
      const body: TopologyNodeRequest = {
        namespace: fs.namespace,
        fs_uuid: fs.fs_uuid,
        node_id: opNodeId.trim(),
      };
      if (opKind === 'register') {
        await registerTopologyNode(fs.fs_uuid, body);
      } else {
        await unregisterTopologyNode(fs.fs_uuid, body);
      }
      setOpKind(null);
      setOpNodeId('');
      await load();
    } catch (err) {
      setModalError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'basic', label: '基本信息' },
    { id: 'meta', label: 'Meta Nodes', count: fs?.meta_node_id?.length ?? 0 },
    { id: 'data', label: 'Data Nodes', count: fs?.data_node_id?.length ?? 0 },
    { id: 'disks', label: '磁盘', count: fs?.disk_labels?.length ?? 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/qubuifs')}
            className="btn-ghost p-1.5"
            aria-label="返回"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground font-mono break-all">
              {decodedFsUuid}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">文件系统详情</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="btn-outline">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {error && <ErrorBanner message="操作失败" detail={error} />}

      {loading ? (
        <LoadingOverlay />
      ) : fs ? (
        <>
          {/* Tabs */}
          <div className="card !p-0 overflow-hidden">
            <div
              className="flex border-b overflow-x-auto"
              style={{ borderColor: 'var(--border)' }}
            >
              {tabs.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
                      active
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    style={{
                      borderColor: active ? 'var(--primary)' : 'transparent',
                    }}
                  >
                    {tab.label}
                    {tab.count !== undefined && (
                      <span className="ml-1.5 text-xs font-normal opacity-70">
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-5">
              {activeTab === 'basic' && <BasicInfoTab fs={fs} />}

              {activeTab === 'meta' && (
                <NodesTab
                  ids={fs.meta_node_id ?? []}
                  onAdd={() => {
                    setModalError(null);
                    setAddMetaNodeId('');
                    setAddMetaOpen(true);
                  }}
                  onDelete={(id) => {
                    setModalError(null);
                    setDelMetaNodeId(id);
                  }}
                  emptyTitle="暂无 Meta Node"
                  emptyDesc="点击下方按钮添加 Meta Node"
                  addLabel="添加 Meta Node"
                />
              )}

              {activeTab === 'data' && (
                <NodesTab
                  ids={fs.data_node_id ?? []}
                  onAdd={() => {
                    setModalError(null);
                    setAddDataNodeId('');
                    setAddDataOpen(true);
                  }}
                  onDelete={(id) => {
                    setModalError(null);
                    setDelDataNodeId(id);
                  }}
                  emptyTitle="暂无 Data Node"
                  emptyDesc="点击下方按钮添加 Data Node"
                  addLabel="添加 Data Node"
                />
              )}

              {activeTab === 'disks' && (
                <DisksTab
                  disks={fs.disk_labels ?? []}
                  onAdd={() => {
                    setModalError(null);
                    setDiskDeviceUuid('');
                    setDiskQfsPrefix(0);
                    setAddDiskOpen(true);
                  }}
                  onDelete={(d) => {
                    setModalError(null);
                    setDelDisk(d);
                  }}
                />
              )}
            </div>
          </div>

          {/* Topology node ops (preserved as independent Card) */}
          <div className="card">
            <h2 className="text-sm font-semibold text-foreground mb-3">拓扑节点操作</h2>
            <p className="text-xs text-muted-foreground mb-3">
              将节点注册到 / 注销出该文件系统的拓扑结构。
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setModalError(null);
                  setOpKind('register');
                  setOpNodeId('');
                }}
                className="btn-primary"
              >
                <Plus className="w-4 h-4" />
                注册节点
              </button>
              <button
                onClick={() => {
                  setModalError(null);
                  setOpKind('unregister');
                  setOpNodeId('');
                }}
                className="btn-outline"
              >
                <UserMinus className="w-4 h-4" />
                注销节点
              </button>
            </div>
          </div>

          {/* Raw JSON (preserved) */}
          <div className="card">
            <h2 className="text-sm font-semibold text-foreground mb-2">原始 JSON</h2>
            <pre
              className="rounded-md p-3 text-xs font-mono whitespace-pre-wrap break-all"
              style={{ background: 'var(--muted)' }}
            >
              {JSON.stringify(fs, null, 2)}
            </pre>
          </div>
        </>
      ) : (
        <ErrorBanner message="未找到文件系统" detail={`fs_uuid = ${decodedFsUuid}`} />
      )}

      {/* Add Meta Node Modal */}
      <AddNodeModal
        open={addMetaOpen}
        title="添加 Meta Node"
        description={`将节点添加到 fs=${decodedFsUuid} 的 meta node 列表`}
        value={addMetaNodeId}
        onChange={setAddMetaNodeId}
        onConfirm={onAddMeta}
        onClose={() => setAddMetaOpen(false)}
        submitting={submitting}
        error={modalError}
        nodes={sortedMetaNodes}
        nodesLoading={nodesLoading}
        preferredRole={NodeRole.META}
      />

      {/* Add Data Node Modal */}
      <AddNodeModal
        open={addDataOpen}
        title="添加 Data Node"
        description={`将节点添加到 fs=${decodedFsUuid} 的 data node 列表`}
        value={addDataNodeId}
        onChange={setAddDataNodeId}
        onConfirm={onAddData}
        onClose={() => setAddDataOpen(false)}
        submitting={submitting}
        error={modalError}
        nodes={sortedDataNodes}
        nodesLoading={nodesLoading}
        preferredRole={NodeRole.DATA}
      />

      {/* Delete Meta Node Modal */}
      <DeleteConfirmModal
        open={!!delMetaNodeId}
        title="删除 Meta Node"
        description={`确认从 fs=${decodedFsUuid} 移除该 Meta Node?`}
        target={delMetaNodeId ? { node_id: delMetaNodeId } : null}
        onClose={() => setDelMetaNodeId(null)}
        onConfirm={onDelMeta}
        submitting={submitting}
        error={modalError}
      />

      {/* Delete Data Node Modal */}
      <DeleteConfirmModal
        open={!!delDataNodeId}
        title="删除 Data Node"
        description={`确认从 fs=${decodedFsUuid} 移除该 Data Node?`}
        target={delDataNodeId ? { node_id: delDataNodeId } : null}
        onClose={() => setDelDataNodeId(null)}
        onConfirm={onDelData}
        submitting={submitting}
        error={modalError}
      />

      {/* Add Disk Modal */}
      <AddDiskModal
        open={addDiskOpen}
        onClose={() => setAddDiskOpen(false)}
        onConfirm={onAddDisk}
        deviceUuid={diskDeviceUuid}
        onDeviceUuidChange={setDiskDeviceUuid}
        qfsPrefix={diskQfsPrefix}
        onQfsPrefixChange={setDiskQfsPrefix}
        submitting={submitting}
        error={modalError}
      />

      {/* Delete Disk Modal */}
      <DeleteConfirmModal
        open={!!delDisk}
        title="删除磁盘"
        description={`确认从 fs=${decodedFsUuid} 移除该磁盘?`}
        target={delDisk}
        onClose={() => setDelDisk(null)}
        onConfirm={onDelDisk}
        submitting={submitting}
        error={modalError}
      />

      {/* Topology Op Modal (preserved) */}
      <Modal
        open={!!opKind}
        onClose={() => !submitting && setOpKind(null)}
        title={opKind === 'register' ? '注册拓扑节点' : '注销拓扑节点'}
        description={
          opKind
            ? `${opKind === 'register' ? '注册' : '注销'} node_id 到 fs=${decodedFsUuid}`
            : ''
        }
        size="sm"
        footer={
          <>
            <button
              onClick={() => setOpKind(null)}
              disabled={submitting}
              className="btn-outline"
            >
              取消
            </button>
            <button
              onClick={onTopologyOp}
              disabled={submitting || !opNodeId.trim()}
              className={opKind === 'register' ? 'btn-primary' : 'btn-danger'}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : opKind === 'register' ? (
                <Plus className="w-4 h-4" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              确认
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {modalError && <ErrorBanner message="操作失败" detail={modalError} />}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              node_id
            </label>
            <input
              value={opNodeId}
              onChange={(e) => setOpNodeId(e.target.value)}
              className="input font-mono"
              placeholder="例如 data-1"
              autoFocus
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ===== 子组件 =====

function BasicInfoTab({ fs }: { fs: QubuiFSType }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
      <Field label="fs_uuid" value={fs.fs_uuid} mono />
      <Field label="namespace" value={fs.namespace} mono />
      <Field label="fs_id" value={fs.fs_id != null ? String(fs.fs_id) : '—'} mono />
      <Field label="meta_service_id" value={fs.meta_service_id ?? '—'} mono />
      <Field label="disk_labels" value={String(fs.disk_labels?.length ?? 0)} />
      <Field label="mount_info" value={String(fs.mount_info?.length ?? 0)} />
      <Field
        label="meta/data nodes"
        value={`${fs.meta_node_id?.length ?? 0} / ${fs.data_node_id?.length ?? 0}`}
      />
    </div>
  );
}

function NodesTab({
  ids,
  onAdd,
  onDelete,
  emptyTitle,
  emptyDesc,
  addLabel,
}: {
  ids: string[];
  onAdd: () => void;
  onDelete: (id: string) => void;
  emptyTitle: string;
  emptyDesc: string;
  addLabel: string;
}) {
  return (
    <>
      {ids.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDesc} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="border-b text-left"
                style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}
              >
                <th className="px-4 py-2.5 font-medium text-muted-foreground">node_id</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {ids.map((id) => (
                <tr
                  key={id}
                  className="border-b last:border-0 hover:bg-[var(--muted)] transition-colors"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground break-all">
                    {id}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => onDelete(id)}
                      className="btn-ghost p-1.5"
                      title="删除节点"
                      style={{ color: 'var(--destructive)' }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 flex">
        <button onClick={onAdd} className="btn-primary">
          <Plus className="w-4 h-4" />
          {addLabel}
        </button>
      </div>
    </>
  );
}

function DisksTab({
  disks,
  onAdd,
  onDelete,
}: {
  disks: DiskLabel[];
  onAdd: () => void;
  onDelete: (d: DiskLabel) => void;
}) {
  return (
    <>
      {disks.length === 0 ? (
        <EmptyState title="暂无磁盘" description="点击下方按钮添加磁盘" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="border-b text-left"
                style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}
              >
                <th className="px-4 py-2.5 font-medium text-muted-foreground">device_uuid</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground">qfs_prefix</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground">idx</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {disks.map((d, i) => (
                <tr
                  key={`${d.device_uuid ?? ''}-${d.qfs_prefix ?? 0}-${i}`}
                  className="border-b last:border-0 hover:bg-[var(--muted)] transition-colors"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground break-all">
                    {d.device_uuid || '—'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {d.qfs_prefix ?? 0}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {d.idx ?? 0}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => onDelete(d)}
                      className="btn-ghost p-1.5"
                      title="删除磁盘"
                      style={{ color: 'var(--destructive)' }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 flex">
        <button onClick={onAdd} className="btn-primary">
          <Plus className="w-4 h-4" />
          添加磁盘
        </button>
      </div>
    </>
  );
}

function AddNodeModal({
  open,
  title,
  description,
  value,
  onChange,
  onConfirm,
  onClose,
  submitting,
  error,
  nodes,
  nodesLoading,
  preferredRole,
}: {
  open: boolean;
  title: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  submitting: boolean;
  error: string | null;
  nodes: CrushNode[];
  nodesLoading: boolean;
  preferredRole: NodeRole;
}) {
  const preferredLabel =
    preferredRole === NodeRole.META
      ? 'META'
      : preferredRole === NodeRole.DATA
      ? 'DATA'
      : '';
  return (
    <Modal
      open={open}
      onClose={() => !submitting && onClose()}
      title={title}
      description={description}
      size="md"
      footer={
        <>
          <button onClick={onClose} disabled={submitting} className="btn-outline">
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting || !value}
            className="btn-primary"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            确认添加
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <ErrorBanner message="操作失败" detail={error} />}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            node_id
          </label>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input font-mono"
            disabled={submitting || nodesLoading}
            autoFocus
          >
            <option value="" disabled>
              {nodesLoading
                ? '加载节点中…'
                : nodes.length === 0
                ? '暂无可用节点'
                : '请选择节点'}
            </option>
            {nodes.map((n) => {
              const matched = (n.role & preferredRole) !== 0;
              return (
                <option key={n.node_id} value={n.node_id}>
                  {n.node_id}
                  {matched && preferredLabel ? `  (★ ${preferredLabel})` : ''}
                </option>
              );
            })}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            节点列表来自 <code className="font-mono">listNodes()</code>
            ，角色匹配的节点已置顶并以 ★ 标记
          </p>
        </div>
      </div>
    </Modal>
  );
}

function AddDiskModal({
  open,
  onClose,
  onConfirm,
  deviceUuid,
  onDeviceUuidChange,
  qfsPrefix,
  onQfsPrefixChange,
  submitting,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deviceUuid: string;
  onDeviceUuidChange: (v: string) => void;
  qfsPrefix: number;
  onQfsPrefixChange: (v: number) => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <Modal
      open={open}
      onClose={() => !submitting && onClose()}
      title="添加磁盘"
      description="为该文件系统添加一块磁盘标签"
      size="md"
      footer={
        <>
          <button onClick={onClose} disabled={submitting} className="btn-outline">
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting || !deviceUuid.trim()}
            className="btn-primary"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            确认添加
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <ErrorBanner message="操作失败" detail={error} />}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            device_uuid <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <input
            value={deviceUuid}
            onChange={(e) => onDeviceUuidChange(e.target.value)}
            className="input font-mono"
            placeholder="例如 a1b2c3d4-..."
            disabled={submitting}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            qfs_prefix <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <input
            type="number"
            value={qfsPrefix}
            onChange={(e) => onQfsPrefixChange(Number(e.target.value) || 0)}
            className="input font-mono"
            placeholder="例如 0"
            disabled={submitting}
          />
        </div>
      </div>
    </Modal>
  );
}

function DeleteConfirmModal({
  open,
  title,
  description,
  target,
  onClose,
  onConfirm,
  submitting,
  error,
}: {
  open: boolean;
  title: string;
  description: string;
  target: unknown;
  onClose: () => void;
  onConfirm: () => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <Modal
      open={open}
      onClose={() => !submitting && onClose()}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button onClick={onClose} disabled={submitting} className="btn-outline">
            取消
          </button>
          <button onClick={onConfirm} disabled={submitting} className="btn-danger">
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            确认删除
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <ErrorBanner message="删除失败" detail={error} />}
        <pre
          className="rounded-md p-3 text-xs font-mono whitespace-pre-wrap break-all"
          style={{ background: 'var(--muted)' }}
        >
          {JSON.stringify(target, null, 2)}
        </pre>
      </div>
    </Modal>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className={`text-foreground ${mono ? 'font-mono break-all' : ''}`}>{value}</div>
    </div>
  );
}

function sortNodesByRole(nodes: CrushNode[], preferredRole: NodeRole): CrushNode[] {
  return [...nodes].sort((a, b) => {
    const aMatch = (a.role & preferredRole) !== 0 ? 0 : 1;
    const bMatch = (b.role & preferredRole) !== 0 ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    return a.node_id.localeCompare(b.node_id);
  });
}

function extractError(err: unknown): string {
  if (err instanceof ApiError) return [err.message, err.detail].filter(Boolean).join(' · ');
  if (err instanceof Error) return err.message;
  return String(err);
}
