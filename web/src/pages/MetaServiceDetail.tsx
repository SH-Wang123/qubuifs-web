import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Trash2,
  Loader2,
  Plus,
  Pencil,
} from 'lucide-react';
import {
  getMetaService,
  updateMetaService,
  listMetaInstances,
  createMetaInstance,
  updateMetaInstance,
  deleteMetaInstance,
  listImageCatalog,
} from '@/api/control';
import type {
  MetaServiceData,
  MetaServiceUpdateRequest,
  MetaInstanceData,
  MetaInstanceCreateRequest,
  MetaInstanceUpdateRequest,
  ImageVersion,
} from '@/types/api';
import { ApiError } from '@/api/client';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';

export function MetaServiceDetailPage() {
  const { serviceId = '' } = useParams();
  const decodedServiceId = decodeURIComponent(serviceId);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [svc, setSvc] = useState<MetaServiceData | null>(null);
  const [instances, setInstances] = useState<MetaInstanceData[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [addInstanceOpen, setAddInstanceOpen] = useState(false);
  const [editInstance, setEditInstance] = useState<MetaInstanceData | null>(null);
  const [deleteInstance, setDeleteInstance] = useState<MetaInstanceData | null>(null);
  const [deletingInstance, setDeletingInstance] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [svcData, instData] = await Promise.all([
        getMetaService(decodedServiceId),
        listMetaInstances(decodedServiceId),
      ]);
      setSvc(svcData);
      setInstances(Array.isArray(instData?.instances) ? instData.instances : []);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [decodedServiceId]);

  useEffect(() => {
    load();
  }, [load]);

  const onDeleteInstance = async () => {
    if (!deleteInstance || deletingInstance) return;
    setDeletingInstance(true);
    try {
      await deleteMetaInstance(decodedServiceId, deleteInstance.instance_id);
      setDeleteInstance(null);
      await load();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setDeletingInstance(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/meta-services')}
            className="btn-ghost p-1.5"
            aria-label="返回"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground font-mono break-all">
              {decodedServiceId}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">元数据服务详情</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="btn-outline">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button onClick={() => setEditOpen(true)} className="btn-outline">
            <Pencil className="w-4 h-4" />
            编辑服务
          </button>
          <button onClick={() => setAddInstanceOpen(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            创建实例
          </button>
        </div>
      </div>

      {error && <ErrorBanner message="操作失败" detail={error} />}

      {loading ? (
        <LoadingOverlay />
      ) : svc ? (
        <>
          {/* Service basic info */}
          <div className="card">
            <h2 className="text-sm font-semibold text-foreground mb-3">基本信息</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Field label="service_id" value={svc.service_id} mono />
              <Field
                label="namespace"
                value={(svc.namespace ?? []).join(', ') || '—'}
                mono
              />
              <Field label="version" value={svc.version || '—'} mono />
              <Field label="des" value={svc.des || '—'} />
              <Field
                label="fs_uuid_list"
                value={`${svc.fs_uuid_list?.length ?? 0} 个`}
              />
            </div>
            {svc.fs_uuid_list && svc.fs_uuid_list.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-muted-foreground mb-1">fs_uuid_list</div>
                <div className="flex flex-wrap gap-1.5">
                  {svc.fs_uuid_list.map((uuid) => (
                    <code
                      key={uuid}
                      className="text-xs font-mono px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--muted)', color: 'var(--foreground)' }}
                    >
                      {uuid}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Instances */}
          <div className="card !p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold text-foreground">
                元数据实例
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  共 {instances.length} 个
                </span>
              </h2>
              <button
                onClick={() => setAddInstanceOpen(true)}
                className="btn-outline"
              >
                <Plus className="w-4 h-4" />
                创建实例
              </button>
            </div>
            {instances.length === 0 ? (
              <EmptyState
                title="暂无元数据实例"
                description="在该元数据服务下创建实例，控制面会异步生成 Pod 并上报运行地址"
                action={
                  <button onClick={() => setAddInstanceOpen(true)} className="btn-primary">
                    <Plus className="w-4 h-4" />
                    创建实例
                  </button>
                }
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
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">instance_id</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">addr</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">image</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">version</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground">des</th>
                      <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instances.map((inst) => (
                      <tr
                        key={inst.instance_id}
                        className="border-b last:border-0 hover:bg-[var(--muted)] transition-colors"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <td className="px-4 py-2.5 font-mono text-xs text-foreground break-all">
                          {inst.instance_id}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground break-all">
                          {inst.addr
                            ? `${inst.addr}${inst.meta_rpc_port ? ':' + inst.meta_rpc_port : ''}`
                            : '待分配'}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground break-all max-w-[200px] truncate">
                          {inst.image || '—'}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground break-all">
                          {inst.version || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground break-all max-w-[200px] truncate">
                          {inst.des || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => setEditInstance(inst)}
                              className="btn-ghost p-1.5"
                              title="编辑实例"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteInstance(inst)}
                              className="btn-ghost p-1.5"
                              title="删除实例"
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
            )}
          </div>

          {/* Raw JSON */}
          <div className="card">
            <h2 className="text-sm font-semibold text-foreground mb-2">服务原始 JSON</h2>
            <pre
              className="rounded-md p-3 text-xs font-mono whitespace-pre-wrap break-all"
              style={{ background: 'var(--muted)' }}
            >
              {JSON.stringify(svc, null, 2)}
            </pre>
          </div>
        </>
      ) : (
        <ErrorBanner message="未找到元数据服务" detail={`service_id = ${decodedServiceId}`} />
      )}

      {/* Edit Service Modal */}
      <EditMetaServiceModal
        open={editOpen}
        svc={svc}
        onClose={() => setEditOpen(false)}
        onSuccess={async () => {
          setEditOpen(false);
          await load();
        }}
      />

      {/* Create Instance Modal */}
      <InstanceFormModal
        open={addInstanceOpen}
        mode="create"
        onClose={() => setAddInstanceOpen(false)}
        onSuccess={async () => {
          setAddInstanceOpen(false);
          await load();
        }}
        serviceId={decodedServiceId}
      />

      {/* Edit Instance Modal */}
      <InstanceFormModal
        open={!!editInstance}
        mode="edit"
        instance={editInstance ?? undefined}
        onClose={() => setEditInstance(null)}
        onSuccess={async () => {
          setEditInstance(null);
          await load();
        }}
        serviceId={decodedServiceId}
      />

      {/* Delete Instance Modal */}
      <Modal
        open={!!deleteInstance}
        onClose={() => !deletingInstance && setDeleteInstance(null)}
        title="删除元数据实例"
        description={`确认删除 instance_id = ${deleteInstance?.instance_id ?? ''}?`}
        size="sm"
        footer={
          <>
            <button
              onClick={() => setDeleteInstance(null)}
              disabled={deletingInstance}
              className="btn-outline"
            >
              取消
            </button>
            <button
              onClick={onDeleteInstance}
              disabled={deletingInstance}
              className="btn-danger"
            >
              {deletingInstance ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              确认删除
            </button>
          </>
        }
      >
        <pre
          className="rounded-md p-3 text-xs font-mono whitespace-pre-wrap break-all"
          style={{ background: 'var(--muted)' }}
        >
          {JSON.stringify(deleteInstance, null, 2)}
        </pre>
      </Modal>
    </div>
  );
}

function EditMetaServiceModal({
  open,
  svc,
  onClose,
  onSuccess,
}: {
  open: boolean;
  svc: MetaServiceData | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [fsUuidList, setFsUuidList] = useState('');
  const [des, setDes] = useState('');
  const [version, setVersion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && svc) {
      setFsUuidList((svc.fs_uuid_list ?? []).join(', '));
      setDes(svc.des ?? '');
      setVersion(svc.version ?? '');
      setError(null);
    }
  }, [open, svc]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !svc) return;
    setError(null);
    const body: MetaServiceUpdateRequest = {};
    const fsList = fsUuidList
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (fsList.length > 0) body.fs_uuid_list = fsList;
    if (des.trim()) body.des = des.trim();
    if (version.trim()) body.version = version.trim();

    setSubmitting(true);
    try {
      await updateMetaService(svc.service_id, body);
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
      title="编辑元数据服务"
      description="service_id 与 namespace 不可修改"
      size="lg"
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
            form="meta-service-edit-form"
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
            保存
          </button>
        </>
      }
    >
      <form id="meta-service-edit-form" onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorBanner message="保存失败" detail={error} />}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              service_id（只读）
            </label>
            <input
              value={svc?.service_id ?? ''}
              readOnly
              className="input font-mono opacity-70"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              namespace（只读）
            </label>
            <input
              value={(svc?.namespace ?? []).join(', ')}
              readOnly
              className="input font-mono opacity-70"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            fs_uuid_list
          </label>
          <textarea
            value={fsUuidList}
            onChange={(e) => setFsUuidList(e.target.value)}
            className="input font-mono min-h-[72px]"
            placeholder="关联的文件系统 UUID，逗号或换行分隔"
            disabled={submitting}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
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
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              des
            </label>
            <input
              value={des}
              onChange={(e) => setDes(e.target.value)}
              className="input"
              placeholder="描述信息"
              disabled={submitting}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}

function InstanceFormModal({
  open,
  mode,
  instance,
  onClose,
  onSuccess,
  serviceId,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  instance?: MetaInstanceData;
  onClose: () => void;
  onSuccess: () => void;
  serviceId: string;
}) {
  const [image, setImage] = useState('');
  const [des, setDes] = useState('');
  const [version, setVersion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 镜像目录
  const [images, setImages] = useState<ImageVersion[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imagesError, setImagesError] = useState<string | null>(null);

  // 弹框打开时拉取镜像目录
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setImagesLoading(true);
    setImagesError(null);
    listImageCatalog()
      .then((catalog) => {
        if (cancelled) return;
        setImages(Array.isArray(catalog?.meta) ? catalog.meta : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setImagesError(extractError(err));
      })
      .finally(() => {
        if (!cancelled) setImagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // 打开或 instance 变化时初始化表单字段
  useEffect(() => {
    if (open) {
      setImage(instance?.image ?? '');
      setDes(instance?.des ?? '');
      setVersion(instance?.version ?? '');
      setError(null);
    }
  }, [open, instance]);

  // 选中镜像后同步填充 version
  const onSelectImage = (value: string) => {
    setImage(value);
    const picked = images.find((it) => it.image === value);
    if (picked && picked.version && !version.trim()) {
      setVersion(picked.version);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    const img = image.trim();
    if (!img) {
      setError('image 不能为空');
      return;
    }
    const base: MetaInstanceCreateRequest | MetaInstanceUpdateRequest = {
      image: img,
    };
    if (des.trim()) base.des = des.trim();
    if (version.trim()) base.version = version.trim();

    setSubmitting(true);
    try {
      if (mode === 'create') {
        await createMetaInstance(serviceId, base as MetaInstanceCreateRequest);
      } else if (instance) {
        await updateMetaInstance(
          serviceId,
          instance.instance_id,
          base as MetaInstanceUpdateRequest,
        );
      }
      onSuccess();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const isEdit = mode === 'edit';

  return (
    <Modal
      open={open}
      onClose={() => !submitting && onClose()}
      title={isEdit ? '编辑元数据实例' : '创建元数据实例'}
      description={
        isEdit
          ? `修改 instance_id = ${instance?.instance_id ?? ''}`
          : `在 service_id = ${serviceId} 下创建实例`
      }
      size="lg"
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
            form="meta-instance-form"
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {isEdit ? '保存' : '创建'}
          </button>
        </>
      }
    >
      <form id="meta-instance-form" onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorBanner message="操作失败" detail={error} />}

        {isEdit && (
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              instance_id（只读）
            </label>
            <input
              value={instance?.instance_id ?? ''}
              readOnly
              className="input font-mono opacity-70"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            image <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          {imagesError ? (
            <ErrorBanner message="加载镜像列表失败" detail={imagesError} />
          ) : (
            <select
              value={image}
              onChange={(e) => onSelectImage(e.target.value)}
              className="input font-mono"
              disabled={submitting || imagesLoading || images.length === 0}
              autoFocus
            >
              <option value="" disabled>
                {imagesLoading
                  ? '加载镜像中…'
                  : images.length === 0
                  ? '暂无可用镜像'
                  : '请选择镜像'}
              </option>
              {images.map((img) => (
                <option key={img.image} value={img.image}>
                  {img.image}
                  {img.version ? `  (${img.version})` : ''}
                </option>
              ))}
            </select>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            镜像列表来自 <code className="font-mono">/images/catalog</code> 的 meta 组件；选中后 version 字段会自动填充
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
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

function extractError(err: unknown): string {
  if (err instanceof ApiError) return [err.message, err.detail].filter(Boolean).join(' · ');
  if (err instanceof Error) return err.message;
  return String(err);
}
