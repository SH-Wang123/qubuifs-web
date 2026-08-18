import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Trash2, ChevronRight, Loader2 } from 'lucide-react';
import {
  listMetaServices,
  createMetaService,
  deleteMetaService,
  listNamespaces,
} from '@/api/control';
import type {
  MetaServiceData,
  MetaServiceCreateRequest,
  NamespaceData,
} from '@/types/api';
import { ApiError } from '@/api/client';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';

export function MetaServicesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<MetaServiceData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MetaServiceData | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMetaServices();
      setList(Array.isArray(data?.services) ? data.services : []);
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
      await deleteMetaService(deleteTarget.service_id);
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
            元数据服务
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            共 {list.length} 个元数据服务，点击行进入管理实例
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="btn-outline">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button onClick={() => setAddOpen(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            创建元数据服务
          </button>
        </div>
      </div>

      {error && <ErrorBanner message="加载元数据服务失败" detail={error} />}

      {loading ? (
        <LoadingOverlay label="加载元数据服务…" />
      ) : list.length === 0 ? (
        <div className="card">
          <EmptyState
            title="暂无元数据服务"
            description="元数据服务是逻辑元数据入口，创建后可在其中管理多个元数据实例"
            action={
              <button onClick={() => setAddOpen(true)} className="btn-primary">
                <Plus className="w-4 h-4" />
                创建元数据服务
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
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">service_id</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">namespace</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">fs_uuid_list</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">version</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">des</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((svc) => (
                  <tr
                    key={svc.service_id}
                    className="border-b last:border-0 hover:bg-[var(--muted)] transition-colors cursor-pointer"
                    style={{ borderColor: 'var(--border)' }}
                    onClick={() =>
                      navigate(
                        `/meta-services/${encodeURIComponent(svc.service_id)}`,
                      )
                    }
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground break-all">
                      {svc.service_id}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground break-all">
                      {(svc.namespace ?? []).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {svc.fs_uuid_list?.length ?? 0}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground break-all">
                      {svc.version || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground break-all max-w-[240px] truncate">
                      {svc.des || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() =>
                            navigate(
                              `/meta-services/${encodeURIComponent(svc.service_id)}`,
                            )
                          }
                          className="btn-ghost p-1.5"
                          title="查看详情"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(svc)}
                          className="btn-ghost p-1.5"
                          title="删除服务"
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

      <AddMetaServiceModal
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
        title="删除元数据服务"
        description={`确认删除 service_id = ${deleteTarget?.service_id ?? ''}?`}
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
          删除元数据服务将同时删除其下所有元数据实例，请谨慎操作。
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

function AddMetaServiceModal({
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
  const [des, setDes] = useState('');
  const [version, setVersion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 打开时拉取命名空间列表
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setNamespacesLoading(true);
    listNamespaces()
      .then((data) => {
        if (cancelled) return;
        setNamespaces(Array.isArray(data?.namespaces) ? data.namespaces : []);
      })
      .catch(() => {
        if (!cancelled) setNamespaces([]);
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
    setDes('');
    setVersion('');
    setError(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    const ns = namespace.trim();
    if (!ns) {
      setError('namespace 不能为空');
      return;
    }
    const body: MetaServiceCreateRequest = {
      namespace: [ns],
    };
    if (des.trim()) body.des = des.trim();
    if (version.trim()) body.version = version.trim();

    setSubmitting(true);
    try {
      await createMetaService(body);
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
      title="创建元数据服务"
      description="逻辑元数据服务，创建后可在其中管理元数据实例"
      size="lg"
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
            form="meta-service-add-form"
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            创建
          </button>
        </>
      }
    >
      <form id="meta-service-add-form" onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorBanner message="创建失败" detail={error} />}

        <div className="grid grid-cols-2 gap-3">
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
                  ? '加载中…'
                  : namespaces.length === 0
                  ? '暂无命名空间'
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
              命名空间来自「命名空间」页签，创建后不可修改
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              version
            </label>
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="input font-mono"
              placeholder="例如 v1.0.0"
              disabled={submitting}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            des
          </label>
          <input
            value={des}
            onChange={(e) => setDes(e.target.value)}
            className="input"
            placeholder="描述信息（可选）"
            disabled={submitting}
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
