import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Trash2, ChevronRight, Loader2 } from 'lucide-react';
import {
  listQubuiFS,
  createQubuiFS,
  deleteQubuiFS,
  listNodes,
  listNamespaces,
  listMetaServices,
} from '@/api/control';
import type {
  QubuiFS as QubuiFSType,
  QubuiFSCreateRequest,
  DiskLabel,
  CrushNode,
  NamespaceData,
  MetaServiceData,
} from '@/types/api';
import { NodeRole } from '@/types/api';
import { ApiError } from '@/api/client';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';

export function QubuiFSPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<QubuiFSType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QubuiFSType | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listQubuiFS();
      setList(Array.isArray(data?.filesystems) ? data.filesystems : []);
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
      await deleteQubuiFS(deleteTarget.fs_uuid);
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">文件系统</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            共 {list.length} 个 QubuiFS
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="btn-outline">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button onClick={() => setCreateOpen(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            创建
          </button>
        </div>
      </div>

      {error && <ErrorBanner message="加载文件系统列表失败" detail={error} />}

      {loading ? (
        <LoadingOverlay label="加载文件系统列表…" />
      ) : list.length === 0 ? (
        <div className="card">
          <EmptyState
            title="暂无文件系统"
            description="点击右上角「创建」添加第一个 QubuiFS"
            action={
              <button onClick={() => setCreateOpen(true)} className="btn-primary">
                <Plus className="w-4 h-4" />
                创建文件系统
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
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">fs_uuid</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">namespace</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">fs_id</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">disk_labels</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">meta_service</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">meta 节点</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">data 节点</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">mount_info</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((fs) => (
                  <tr
                    key={fs.fs_uuid}
                    className="border-b last:border-0 hover:bg-[var(--muted)] transition-colors"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground break-all">
                      {fs.fs_uuid}
                    </td>
                    <td className="px-4 py-2.5 text-foreground">{fs.namespace}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {fs.fs_id ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {fs.disk_labels?.length ?? 0}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                      {fs.meta_service_id ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono break-all">
                      {fs.meta_node_id && fs.meta_node_id.length > 0
                        ? `${fs.meta_node_id.length}: ${fs.meta_node_id.join(', ')}`
                        : '0'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono break-all">
                      {fs.data_node_id && fs.data_node_id.length > 0
                        ? `${fs.data_node_id.length}: ${fs.data_node_id.join(', ')}`
                        : '0'}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {fs.mount_info?.length ?? 0}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/qubuifs/${encodeURIComponent(fs.fs_uuid)}`)}
                          className="btn-ghost p-1.5"
                          title="查看详情"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(fs)}
                          className="btn-ghost p-1.5"
                          title="删除"
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

      {/* Create Modal */}
      <CreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={async () => {
          setCreateOpen(false);
          await load();
        }}
      />

      {/* Delete Confirm */}
      <Modal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="删除文件系统"
        description={`确认删除 fs_uuid = ${deleteTarget?.fs_uuid ?? ''}?`}
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
          删除后该文件系统及其拓扑节点关联将被移除，此操作不可逆。
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

/* ===== Create Modal ===== */

interface DiskLabelInput {
  device_uuid: string;
  qfs_prefix: string;
  idx: string;
}

function CreateModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [namespace, setNamespace] = useState('');
  const [namespaces, setNamespaces] = useState<NamespaceData[]>([]);
  const [namespacesLoading, setNamespacesLoading] = useState(false);
  const [metaServiceId, setMetaServiceId] = useState('');
  const [metaServices, setMetaServices] = useState<MetaServiceData[]>([]);
  const [diskLabels, setDiskLabels] = useState<DiskLabelInput[]>([
    { device_uuid: '', qfs_prefix: '0', idx: '0' },
  ]);
  const [nodes, setNodes] = useState<CrushNode[]>([]);
  const [selectedData, setSelectedData] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 打开时并行拉取节点列表、命名空间列表、元数据服务列表
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setNamespacesLoading(true);
    Promise.all([
      listNodes().catch(() => ({ nodes: [] as CrushNode[] })),
      listNamespaces().catch(() => ({ namespaces: [] as NamespaceData[] })),
      listMetaServices().catch(() => ({ services: [] as MetaServiceData[] })),
    ])
      .then(([nodeData, nsData, msData]) => {
        if (cancelled) return;
        setNodes(Array.isArray(nodeData?.nodes) ? nodeData.nodes : []);
        setNamespaces(Array.isArray(nsData?.namespaces) ? nsData.namespaces : []);
        setMetaServices(Array.isArray(msData?.services) ? msData.services : []);
      })
      .finally(() => {
        if (!cancelled) setNamespacesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const reset = () => {
    setNamespace('');
    setMetaServiceId('');
    setDiskLabels([{ device_uuid: '', qfs_prefix: '0', idx: '0' }]);
    setSelectedData(new Set());
    setError(null);
  };

  const toggleData = (id: string) => {
    setSelectedData((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!namespace.trim()) {
      setError('namespace 不能为空');
      return;
    }
    if (!metaServiceId.trim()) {
      setError('meta_service_id 不能为空');
      return;
    }
    const dl: DiskLabel[] = diskLabels
      .filter((d) => d.device_uuid.trim())
      .map((d) => ({
        device_uuid: d.device_uuid.trim(),
        qfs_prefix: Number(d.qfs_prefix) || 0,
        idx: Number(d.idx) || 0,
      }));
    const data = Array.from(selectedData);

    const body: QubuiFSCreateRequest = {
      namespace: namespace.trim(),
      meta_service_id: metaServiceId.trim(),
    };
    if (dl.length > 0) body.disk_labels = dl;
    if (data.length > 0) body.data_node_id = data;

    setSubmitting(true);
    try {
      await createQubuiFS(body);
      reset();
      onSuccess();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  // 根据节点 role 判断是否为 data 候选（role 位掩码含 DATA=2）
  const isDataCandidate = (n: CrushNode) => (n.role & NodeRole.DATA) !== 0;

  return (
    <Modal
      open={open}
      onClose={() => !submitting && (onClose(), reset())}
      title="创建文件系统"
      description="元数据将提交到控制面构建 pb.QubuiFS"
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={() => {
              onClose();
              reset();
            }}
            disabled={submitting}
            className="btn-outline"
          >
            取消
          </button>
          <button
            type="submit"
            form="qubuifs-create-form"
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            创建
          </button>
        </>
      }
    >
      <form id="qubuifs-create-form" onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorBanner message="创建失败" detail={error} />}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            namespace <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <select
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
            className="input font-mono"
            disabled={submitting || namespacesLoading || namespaces.length === 0}
            autoFocus
          >
            <option value="" disabled>
              {namespacesLoading
                ? '加载命名空间中…'
                : namespaces.length === 0
                ? '暂无可用命名空间'
                : '请选择命名空间'}
            </option>
            {namespaces.map((ns) => (
              <option key={ns.name} value={ns.name}>
                {ns.name}
                {ns.description ? ` — ${ns.description}` : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            命名空间来自「命名空间」页签，需先创建命名空间才能创建文件系统
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-foreground">
              disk_labels
              <span className="ml-1 text-xs text-muted-foreground">（可选，创建后可在详情页管理）</span>
            </label>
            <button
              type="button"
              onClick={() =>
                setDiskLabels((prev) => [
                  ...prev,
                  { device_uuid: '', qfs_prefix: '0', idx: String(prev.length) },
                ])
              }
              className="btn-ghost p-1 text-xs"
              disabled={submitting}
            >
              <Plus className="w-3 h-3" />
              添加
            </button>
          </div>
          <div className="space-y-2">
            {diskLabels.map((d, i) => (
              <div key={i} className="grid grid-cols-[1fr_100px_80px_32px] gap-2 items-center">
                <input
                  value={d.device_uuid}
                  onChange={(e) =>
                    setDiskLabels((prev) =>
                      prev.map((x, idx) => (idx === i ? { ...x, device_uuid: e.target.value } : x)),
                    )
                  }
                  placeholder="device_uuid"
                  className="input font-mono text-xs"
                  disabled={submitting}
                />
                <input
                  value={d.qfs_prefix}
                  onChange={(e) =>
                    setDiskLabels((prev) =>
                      prev.map((x, idx) => (idx === i ? { ...x, qfs_prefix: e.target.value } : x)),
                    )
                  }
                  placeholder="qfs_prefix"
                  className="input font-mono text-xs"
                  disabled={submitting}
                />
                <input
                  value={d.idx}
                  onChange={(e) =>
                    setDiskLabels((prev) =>
                      prev.map((x, idx) => (idx === i ? { ...x, idx: e.target.value } : x)),
                    )
                  }
                  placeholder="idx"
                  className="input font-mono text-xs"
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() =>
                    setDiskLabels((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  className="btn-ghost p-1"
                  disabled={submitting || diskLabels.length === 1}
                  style={{ color: 'var(--destructive)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* meta_service_id 选择框（必填，从元数据服务列表加载） */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            meta_service_id <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <select
            value={metaServiceId}
            onChange={(e) => setMetaServiceId(e.target.value)}
            className="input font-mono"
            disabled={submitting || namespacesLoading || metaServices.length === 0}
          >
            <option value="" disabled>
              {namespacesLoading
                ? '加载中…'
                : metaServices.length === 0
                ? '暂无元数据服务'
                : '请选择元数据服务'}
            </option>
            {metaServices.map((ms) => (
              <option key={ms.service_id} value={ms.service_id}>
                {ms.service_id}
                {ms.namespace?.length ? ` (${ms.namespace.join(', ')})` : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            元数据服务来自「元数据服务」页签，需先创建元数据服务才能创建文件系统
          </p>
        </div>

        {/* data_node_id 多选框（可选，创建后可在详情页管理） */}
        <NodeCheckboxList
          title="data_node_id"
          nodes={nodes}
          candidates={isDataCandidate}
          selected={selectedData}
          onToggle={toggleData}
          disabled={submitting}
          emptyHint="暂无可选节点（role 含 DATA）"
        />
        <p className="text-xs text-muted-foreground">
          data 节点为可选项，创建文件系统后可在详情页内继续添加或移除。
        </p>
      </form>
    </Modal>
  );
}

/** 节点多选列表组件：先展示"推荐候选"（按 role 匹配），再展示其余节点 */
function NodeCheckboxList({
  title,
  required,
  nodes,
  candidates,
  selected,
  onToggle,
  disabled,
  emptyHint,
}: {
  title: string;
  required?: boolean;
  nodes: CrushNode[];
  candidates: (n: CrushNode) => boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  disabled?: boolean;
  emptyHint?: string;
}) {
  const recommended = nodes.filter(candidates);
  const others = nodes.filter((n) => !candidates(n));

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-foreground">
          {title} {required && <span style={{ color: 'var(--destructive)' }}>*</span>}
        </label>
        <span className="text-xs text-muted-foreground">已选 {selected.size}</span>
      </div>
      <div
        className="rounded-md border max-h-44 overflow-y-auto"
        style={{ borderColor: 'var(--border)' }}
      >
        {nodes.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground text-center">
            {emptyHint || '暂无节点'}
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {recommended.length > 0 && (
              <>
                <li
                  className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0"
                  style={{ background: 'var(--muted)' }}
                >
                  推荐（role 匹配）
                </li>
                {recommended.map((n) => (
                  <NodeCheckboxRow
                    key={n.node_id}
                    node={n}
                    checked={selected.has(n.node_id)}
                    onToggle={() => onToggle(n.node_id)}
                    disabled={disabled}
                  />
                ))}
              </>
            )}
            {others.length > 0 && (
              <>
                <li
                  className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0"
                  style={{ background: 'var(--muted)' }}
                >
                  其它节点
                </li>
                {others.map((n) => (
                  <NodeCheckboxRow
                    key={n.node_id}
                    node={n}
                    checked={selected.has(n.node_id)}
                    onToggle={() => onToggle(n.node_id)}
                    disabled={disabled}
                  />
                ))}
              </>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function NodeCheckboxRow({
  node,
  checked,
  onToggle,
  disabled,
}: {
  node: CrushNode;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <li>
      <label
        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-[var(--muted)] transition-colors"
        style={{ opacity: disabled ? 0.6 : 1 }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          disabled={disabled}
          className="w-3.5 h-3.5 rounded"
        />
        <span className="font-mono text-xs text-foreground truncate">{node.node_id}</span>
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">
          role={node.role}
        </span>
      </label>
    </li>
  );
}

function extractError(err: unknown): string {
  if (err instanceof ApiError) return [err.message, err.detail].filter(Boolean).join(' · ');
  if (err instanceof Error) return err.message;
  return String(err);
}
