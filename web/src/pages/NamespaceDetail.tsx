import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Pencil,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import {
  getNamespace,
  updateNamespace,
  listQubuiFS,
  listMetaServices,
  listNodes,
} from '@/api/control';
import { type NamespaceData, type NamespaceUpdateRequest, type QubuiFS, type MetaServiceData, type CrushNode, NodeRole } from '@/types/api';
import { ApiError } from '@/api/client';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';

export function NamespaceDetailPage() {
  const { name = '' } = useParams();
  const decodedName = decodeURIComponent(name);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [ns, setNs] = useState<NamespaceData | null>(null);
  const [filesystems, setFilesystems] = useState<QubuiFS[]>([]);
  const [metaServices, setMetaServices] = useState<MetaServiceData[]>([]);
  const [nodes, setNodes] = useState<CrushNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nsData, fsData, msData, nodeData] = await Promise.all([
        getNamespace(decodedName),
        listQubuiFS(),
        listMetaServices(),
        listNodes(),
      ]);
      setNs(nsData);
      setFilesystems(
        Array.isArray(fsData?.filesystems)
          ? fsData.filesystems.filter((f) => f.namespace === decodedName)
          : [],
      );
      setMetaServices(
        Array.isArray(msData?.services)
          ? msData.services.filter((s) =>
              Array.isArray(s.namespace) ? s.namespace.includes(decodedName) : false,
            )
          : [],
      );
      setNodes(
        Array.isArray(nodeData?.nodes)
          ? nodeData.nodes.filter((n) => n.namespace === decodedName)
          : [],
      );
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [decodedName]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/namespaces')}
            className="btn-ghost p-1.5"
            aria-label="返回"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground font-mono break-all">
              {decodedName}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">命名空间详情</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="btn-outline">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button onClick={() => setEditOpen(true)} className="btn-outline">
            <Pencil className="w-4 h-4" />
            编辑命名空间
          </button>
        </div>
      </div>

      {error && <ErrorBanner message="操作失败" detail={error} />}

      {loading ? (
        <LoadingOverlay label="加载命名空间详情…" />
      ) : ns ? (
        <>
          {/* Basic info */}
          <div className="card">
            <h2 className="text-sm font-semibold text-foreground mb-3">基本信息</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Field label="name" value={ns.name} mono />
              <Field label="description" value={ns.description || '—'} />
              <Field label="filesystem_count" value={String(ns.filesystem_count ?? 0)} mono />
            </div>
          </div>

          {/* Filesystems */}
          <SectionCard
            title="文件系统"
            count={filesystems.length}
            quickHint="快速管理该命名空间下的文件系统"
            onQuickClick={() => navigate('/qubuifs')}
            quickLabel="前往 QubuiFS 管理"
          >
            {filesystems.length === 0 ? (
              <EmptyState
                title="暂无文件系统"
                description="该命名空间下尚未创建 QubuiFS 文件系统"
              />
            ) : (
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
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">fs_id</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filesystems.map((fs) => (
                      <tr
                        key={fs.fs_uuid}
                        className="border-b last:border-0 hover:bg-[var(--muted)] transition-colors"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <td className="px-4 py-2.5 font-mono text-xs text-foreground break-all">
                          {fs.fs_uuid}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {fs.fs_id ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() =>
                              navigate(`/qubuifs/${encodeURIComponent(fs.fs_uuid)}`)
                            }
                            className="btn-ghost p-1.5"
                            title="查看文件系统"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Meta Services */}
          <SectionCard
            title="元数据服务"
            count={metaServices.length}
            quickHint="快速管理该命名空间下的元数据服务"
            onQuickClick={() => navigate('/meta-services')}
            quickLabel="前往元数据服务管理"
          >
            {metaServices.length === 0 ? (
              <EmptyState
                title="暂无元数据服务"
                description="该命名空间下尚未创建元数据服务"
              />
            ) : (
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
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">version</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">des</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metaServices.map((svc) => (
                      <tr
                        key={svc.service_id}
                        className="border-b last:border-0 hover:bg-[var(--muted)] transition-colors"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <td className="px-4 py-2.5 font-mono text-xs text-foreground break-all">
                          {svc.service_id}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground break-all">
                          {svc.version || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground break-all max-w-[240px] truncate">
                          {svc.des || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() =>
                              navigate(`/meta-services/${encodeURIComponent(svc.service_id)}`)
                            }
                            className="btn-ghost p-1.5"
                            title="查看元数据服务"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Nodes */}
          <SectionCard
            title="节点"
            count={nodes.length}
            quickHint="快速管理该命名空间下的数据节点"
            onQuickClick={() => navigate('/datanodes')}
            quickLabel="前往数据节点"
          >
            {nodes.length === 0 ? (
              <EmptyState
                title="暂无节点"
                description="该命名空间下尚未注册 Crush 节点"
              />
            ) : (
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
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">role</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">addr</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodes.map((node) => (
                      <tr
                        key={node.node_id}
                        className="border-b last:border-0 hover:bg-[var(--muted)] transition-colors"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <td className="px-4 py-2.5 font-mono text-xs text-foreground break-all">
                          {node.node_id}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {roleLabel(node.role)}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground break-all">
                          {node.addr || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => navigate('/datanodes')}
                            className="btn-ghost p-1.5"
                            title="管理数据节点"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      ) : (
        <ErrorBanner message="未找到命名空间" detail={`name = ${decodedName}`} />
      )}

      <EditNamespaceModal
        open={editOpen}
        ns={ns}
        onClose={() => setEditOpen(false)}
        onSuccess={async () => {
          setEditOpen(false);
          await load();
        }}
      />
    </div>
  );
}

function SectionCard({
  title,
  count,
  quickHint,
  quickLabel,
  onQuickClick,
  children,
}: {
  title: string;
  count: number;
  quickHint: string;
  quickLabel: string;
  onQuickClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card !p-0 overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <h2 className="text-sm font-semibold text-foreground">
          {title}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            共 {count} 个
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">{quickHint}</span>
          <button onClick={onQuickClick} className="btn-outline">
            <ExternalLink className="w-3.5 h-3.5" />
            {quickLabel}
          </button>
        </div>
      </div>
      {children}
    </div>
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
            form="namespace-detail-edit-form"
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
            保存
          </button>
        </>
      }
    >
      <form id="namespace-detail-edit-form" onSubmit={onSubmit} className="space-y-4">
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

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className={`text-foreground ${mono ? 'font-mono break-all' : ''}`}>{value}</div>
    </div>
  );
}

function roleLabel(role: number): string {
  const parts: string[] = [];
  if (role & NodeRole.META) parts.push('META');
  if (role & NodeRole.DATA) parts.push('DATA');
  if (role & NodeRole.GATEWAY) parts.push('GW');
  return parts.length ? parts.join('|') : 'NONE';
}

function extractError(err: unknown): string {
  if (err instanceof ApiError) return [err.message, err.detail].filter(Boolean).join(' · ');
  if (err instanceof Error) return err.message;
  return String(err);
}
