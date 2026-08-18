import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  RefreshCw,
  Trash2,
  ChevronRight,
  Loader2,
  Pencil,
} from 'lucide-react';
import {
  listNamespaces,
  createNamespace,
  updateNamespace,
  deleteNamespace,
} from '@/api/control';
import type {
  NamespaceData,
  NamespaceCreateRequest,
  NamespaceUpdateRequest,
} from '@/types/api';
import { ApiError } from '@/api/client';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';

export function NamespacesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<NamespaceData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<NamespaceData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NamespaceData | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listNamespaces();
      setList(Array.isArray(data?.namespaces) ? data.namespaces : []);
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
      await deleteNamespace(deleteTarget.name);
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
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            命名空间
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            共 {list.length} 个
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="btn-outline">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button onClick={() => setAddOpen(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            创建命名空间
          </button>
        </div>
      </div>

      {error && <ErrorBanner message="加载命名空间失败" detail={error} />}

      {loading ? (
        <LoadingOverlay label="加载命名空间…" />
      ) : list.length === 0 ? (
        <div className="card">
          <EmptyState
            title="暂无命名空间"
            description="命名空间是 QubuiFS / 元数据服务 / 节点的逻辑隔离单元，创建后可在其下管理资源"
            action={
              <button onClick={() => setAddOpen(true)} className="btn-primary">
                <Plus className="w-4 h-4" />
                创建命名空间
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
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">name</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">description</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">filesystem_count</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((ns) => (
                  <tr
                    key={ns.name}
                    className="border-b last:border-0 hover:bg-[var(--muted)] transition-colors cursor-pointer"
                    style={{ borderColor: 'var(--border)' }}
                    onClick={() =>
                      navigate(`/namespaces/${encodeURIComponent(ns.name)}`)
                    }
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground break-all">
                      {ns.name}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground break-all max-w-[280px] truncate">
                      {ns.description || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {ns.filesystem_count ?? 0}
                    </td>
                    <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() =>
                            navigate(`/namespaces/${encodeURIComponent(ns.name)}`)
                          }
                          className="btn-ghost p-1.5"
                          title="查看详情"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditTarget(ns)}
                          className="btn-ghost p-1.5"
                          title="编辑命名空间"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(ns)}
                          className="btn-ghost p-1.5"
                          title="删除命名空间"
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

      <AddNamespaceModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={async () => {
          setAddOpen(false);
          await load();
        }}
      />

      <EditNamespaceModal
        open={!!editTarget}
        ns={editTarget}
        onClose={() => setEditTarget(null)}
        onSuccess={async () => {
          setEditTarget(null);
          await load();
        }}
      />

      <Modal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="删除命名空间"
        description={`确认删除 name = ${deleteTarget?.name ?? ''}?`}
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
          只能删除未被引用的空命名空间。若该命名空间下仍存在文件系统、元数据服务或节点，删除将失败。
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

function AddNamespaceModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setDescription('');
    setError(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('name 不能为空');
      return;
    }
    const body: NamespaceCreateRequest = { name: trimmedName };
    if (description.trim()) body.description = description.trim();

    setSubmitting(true);
    try {
      await createNamespace(body);
      reset();
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
      onClose={() => {
        if (!submitting) {
          reset();
          onClose();
        }
      }}
      title="创建命名空间"
      description="命名空间创建后名称不可修改"
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={() => {
              if (!submitting) {
                reset();
                onClose();
              }
            }}
            disabled={submitting}
            className="btn-outline"
          >
            取消
          </button>
          <button
            type="submit"
            form="namespace-add-form"
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            创建
          </button>
        </>
      }
    >
      <form id="namespace-add-form" onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorBanner message="创建失败" detail={error} />}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            name <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input font-mono"
            placeholder="例如 default"
            disabled={submitting}
            autoFocus
          />
          <p className="mt-1 text-xs text-muted-foreground">
            命名空间名称，创建后不可修改
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input min-h-[72px]"
            placeholder="描述信息（可选）"
            disabled={submitting}
          />
        </div>
      </form>
    </Modal>
  );
}

function EditNamespaceModal({
  open,
  ns,
  onClose,
  onSuccess,
}: {
  open: boolean;
  ns: NamespaceData | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && ns) {
      setDescription(ns.description ?? '');
      setError(null);
    }
  }, [open, ns]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !ns) return;
    setError(null);
    const trimmed = description.trim();
    if (!trimmed) {
      setError('description 不能为空');
      return;
    }
    const body: NamespaceUpdateRequest = { description: trimmed };

    setSubmitting(true);
    try {
      await updateNamespace(ns.name, body);
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
      title="编辑命名空间"
      description="name 不可修改，仅可修改 description"
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            disabled={submitting}
            className="btn-outline"
          >
            取消
          </button>
          <button
            type="submit"
            form="namespace-edit-form"
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
            保存
          </button>
        </>
      }
    >
      <form id="namespace-edit-form" onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorBanner message="保存失败" detail={error} />}

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1.5">
            name（只读）
          </label>
          <input
            value={ns?.name ?? ''}
            readOnly
            className="input font-mono opacity-70"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            description <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input min-h-[72px]"
            placeholder="描述信息"
            disabled={submitting}
            autoFocus
          />
        </div>
      </form>
    </Modal>
  );
}

function extractError(err: unknown): string {
  if (err instanceof ApiError) return [err.message, err.detail].filter(Boolean).join(' · ');
  if (err instanceof Error) return err.message;
  return String(err);
}
