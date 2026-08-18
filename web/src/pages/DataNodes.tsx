import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Trash2, ChevronRight, Loader2 } from 'lucide-react';
import {
  listDataNodes,
  unregisterDataNode,
  listImageCatalog,
  listClusterDataNodes,
  deployDataNode,
} from '@/api/control';
import {
  type CrushNode,
  type ImageVersion,
  type ClusterDataNodeCandidate,
  InOutState,
} from '@/types/api';
import { ApiError } from '@/api/client';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';

export function DataNodesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<CrushNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CrushNode | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDataNodes();
      setList(Array.isArray(data?.datanodes) ? data.datanodes : []);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await unregisterDataNode(deleteTarget.node_id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">DataNode 管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            共 {list.length} 个 DataNode
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="btn-outline">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button onClick={() => setAddOpen(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            创建 DataNode
          </button>
        </div>
      </div>

      {error && <ErrorBanner message="加载 DataNode 列表失败" detail={error} />}

      {loading ? (
        <LoadingOverlay label="加载 DataNode 列表…" />
      ) : list.length === 0 ? (
        <div className="card">
          <EmptyState
            title="暂无 DataNode"
            description="点击右上角「创建 DataNode」注册一个新节点"
            action={
              <button onClick={() => setAddOpen(true)} className="btn-primary">
                <Plus className="w-4 h-4" />
                创建 DataNode
              </button>
            }
          />
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b text-left"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--muted)',
                  }}
                >
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">node_id</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">addr</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">state</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">devices</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">des</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((node) => (
                  <tr
                    key={node.node_id}
                    className="border-b last:border-0 hover:bg-[var(--muted)] transition-colors"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground break-all">
                      {node.node_id}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground break-all">
                      {node.addr}
                    </td>
                    <td className="px-4 py-2.5">
                      <StateBadge state={node.state} />
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {node.device?.length ?? 0}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">
                      {node.des || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() =>
                            navigate(`/datanodes/${encodeURIComponent(node.node_id)}`)
                          }
                          className="btn-ghost p-1.5"
                          title="查看详情"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(node)}
                          className="btn-ghost p-1.5"
                          title="删除 DataNode"
                          style={{ color: 'var(--destructive)' }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddDataNodeModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={async () => {
          setAddOpen(false);
          await load();
        }}
      />

      <Modal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="删除 DataNode"
        description={`确认注销 node_id = ${deleteTarget?.node_id ?? ''}?`}
        size="sm"
        footer={
          <>
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="btn-outline"
            >
              取消
            </button>
            <button onClick={onDelete} disabled={deleting} className="btn-danger">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              确认删除
            </button>
          </>
        }
      >
        <p className="text-sm text-foreground">
          注销 DataNode 将把它从控制面拓扑中移除。若有纳管设备需谨慎。
        </p>
        <pre
          className="mt-3 rounded-md p-3 text-xs font-mono whitespace-pre-wrap break-all"
          style={{ background: 'var(--muted)' }}
        >
          {JSON.stringify(deleteTarget, null, 2)}
        </pre>
      </Modal>
    </div>
  );
}

function AddDataNodeModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [node, setNode] = useState('');
  const [imageVersion, setImageVersion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 镜像目录（data 分组）
  const [images, setImages] = useState<ImageVersion[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imagesError, setImagesError] = useState<string | null>(null);

  // k8s 候选节点
  const [candidates, setCandidates] = useState<ClusterDataNodeCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);

  // 弹框打开时并行拉取镜像目录与候选节点
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    setImagesLoading(true);
    setImagesError(null);
    setCandidatesLoading(true);
    setCandidatesError(null);

    listImageCatalog()
      .then((catalog) => {
        if (cancelled) return;
        setImages(Array.isArray(catalog?.data) ? catalog.data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setImagesError(extractError(err));
      })
      .finally(() => {
        if (!cancelled) setImagesLoading(false);
      });

    listClusterDataNodes()
      .then((arr) => {
        if (cancelled) return;
        setCandidates(Array.isArray(arr) ? arr : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setCandidatesError(extractError(err));
      })
      .finally(() => {
        if (!cancelled) setCandidatesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!node.trim()) {
      setError('部署节点 (node) 不能为空');
      return;
    }
    if (!imageVersion.trim()) {
      setError('image_version 不能为空');
      return;
    }
    setSubmitting(true);
    try {
      await deployDataNode({ node: node.trim(), image_version: imageVersion.trim() });
      setNode('');
      setImageVersion('');
      onSuccess();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !submitting && onClose()}
      title="创建 DataNode"
      description="在选定的集群节点上部署 DataNode Pod"
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={submitting} className="btn-outline">
            取消
          </button>
          <button
            type="submit"
            form="datanode-add-form"
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            创建
          </button>
        </>
      }
    >
      <form id="datanode-add-form" onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorBanner message="创建失败" detail={error} />}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            部署节点 (node) <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          {candidatesError ? (
            <ErrorBanner message="加载候选节点失败" detail={candidatesError} />
          ) : (
            <select
              value={node}
              onChange={(e) => setNode(e.target.value)}
              className="input font-mono"
              disabled={submitting || candidatesLoading || candidates.length === 0}
            >
              <option value="" disabled>
                {candidatesLoading
                  ? '加载集群节点中…'
                  : candidates.length === 0
                  ? '暂无可用节点'
                  : '请选择部署节点'}
              </option>
              {candidates.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                  {c.qubuifs_node ? '  (已有 DataNode)' : ''}
                </option>
              ))}
            </select>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            候选节点来自 <code className="font-mono">/cluster/datanodes</code>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            image_version <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          {imagesError ? (
            <ErrorBanner message="加载镜像列表失败" detail={imagesError} />
          ) : (
            <select
              value={imageVersion}
              onChange={(e) => setImageVersion(e.target.value)}
              className="input font-mono"
              disabled={submitting || imagesLoading || images.length === 0}
            >
              <option value="" disabled>
                {imagesLoading
                  ? '加载镜像中…'
                  : images.length === 0
                  ? '暂无可用镜像'
                  : '请选择镜像版本'}
              </option>
              {images.map((img) => (
                <option key={img.image} value={img.version}>
                  {img.version}
                  {img.image ? `  (${img.image})` : ''}
                </option>
              ))}
            </select>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            镜像列表来自 <code className="font-mono">/images/catalog</code> 的 data 分组
          </p>
        </div>
      </form>
    </Modal>
  );
}

function StateBadge({ state }: { state: InOutState }) {
  switch (state) {
    case InOutState.IN:
      return <StatusBadge kind="ok">IN</StatusBadge>;
    case InOutState.OUT:
      return <StatusBadge kind="err">OUT</StatusBadge>;
    case InOutState.DRAIN:
      return <StatusBadge kind="warn">DRAIN</StatusBadge>;
    default:
      return <StatusBadge kind="unknown">{state}</StatusBadge>;
  }
}

function extractError(err: unknown): string {
  if (err instanceof ApiError) return [err.message, err.detail].filter(Boolean).join(' · ');
  if (err instanceof Error) return err.message;
  return String(err);
}