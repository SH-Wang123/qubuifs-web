import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Trash2,
  Plus,
  Loader2,
  Activity,
  HardDrive,
  Server,
} from 'lucide-react';
import {
  getDataNode,
  getDataNodeStatus,
  listFreeDataNodeDevices,
  listManagedDataNodeDevices,
  addDataNodeDevice,
  deleteDataNodeDevice,
} from '@/api/control';
import {
  type CrushNode,
  type DataNodeStatus,
  type DeviceInfo,
  type DataNodeAddDeviceRequest,
  HealthStatus,
  DeviceClass,
} from '@/types/api';
import { ApiError } from '@/api/client';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';

export function DataNodeDetailPage() {
  const { datanodeId = '' } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [node, setNode] = useState<CrushNode | null>(null);
  const [status, setStatus] = useState<DataNodeStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [freeDevices, setFreeDevices] = useState<DeviceInfo[]>([]);
  const [managedDevices, setManagedDevices] = useState<DeviceInfo[]>([]);
  const [freeError, setFreeError] = useState<string | null>(null);
  const [managedError, setManagedError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteDev, setDeleteDev] = useState<DeviceInfo | null>(null);
  const [deletingDev, setDeletingDev] = useState(false);

  const decodedId = decodeURIComponent(datanodeId);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [n, s] = await Promise.allSettled([
      getDataNode(decodedId),
      getDataNodeStatus(decodedId),
    ]);
    if (n.status === 'fulfilled') setNode(n.value);
    else setError(extractError(n.reason));
    if (s.status === 'fulfilled') {
      setStatus(s.value);
      setStatusError(null);
    } else {
      setStatus(null);
      setStatusError(extractError(s.reason));
    }
    setLoading(false);
  }, [decodedId]);

  const loadDevices = useCallback(async () => {
    const [f, m] = await Promise.allSettled([
      listFreeDataNodeDevices(decodedId),
      listManagedDataNodeDevices(decodedId),
    ]);
    if (f.status === 'fulfilled')
      setFreeDevices(Array.isArray(f.value?.devices) ? f.value.devices : []);
    else {
      setFreeDevices([]);
      setFreeError(extractError(f.reason));
    }
    if (m.status === 'fulfilled')
      setManagedDevices(Array.isArray(m.value?.devices) ? m.value.devices : []);
    else {
      setManagedDevices([]);
      setManagedError(extractError(m.reason));
    }
  }, [decodedId]);

  const reload = useCallback(async () => {
    await Promise.all([load(), loadDevices()]);
  }, [load, loadDevices]);

  useEffect(() => {
    reload();
  }, [reload]);

  const onDeleteDevice = async () => {
    if (!deleteDev || deletingDev) return;
    setDeletingDev(true);
    try {
      await deleteDataNodeDevice(decodedId, deleteDev.device_uuid || '');
      setDeleteDev(null);
      await loadDevices();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setDeletingDev(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/datanodes')}
            className="btn-ghost p-1.5"
            aria-label="返回"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground font-mono break-all">
              {decodedId}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">DataNode 详情</p>
          </div>
        </div>
        <button onClick={reload} disabled={loading} className="btn-outline">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {error && <ErrorBanner message="加载 DataNode 失败" detail={error} />}

      {loading ? (
        <LoadingOverlay />
      ) : node ? (
        <>
          {/* Info cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="card">
              <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Server className="w-3.5 h-3.5" />
                基本信息
              </div>
              <div className="space-y-1 text-xs font-mono">
                <KV k="node_id" v={node.node_id} />
                <KV k="addr" v={node.addr} />
                <KV k="state" v={stateLabel(node.state)} />
                <KV k="des" v={node.des || '—'} />
                <KV k="namespace" v={node.namespace || '—'} />
              </div>
            </div>

            <div className="card">
              <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" />
                健康状态
              </div>
              {status ? (
                <div className="space-y-1 text-xs font-mono">
                  <div>
                    <StatusBadge kind={healthKind(status.health_status)}>
                      {healthLabel(status.health_status)}
                    </StatusBadge>
                  </div>
                  {status.ts_unix && (
                    <KV k="ts" v={new Date(status.ts_unix * 1000).toLocaleString()} />
                  )}
                  {status.message && <KV k="msg" v={status.message} />}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {statusError || '状态不可用'}
                </p>
              )}
            </div>

            <div className="card">
              <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5" />
                纳管设备
              </div>
              <div className="text-2xl font-semibold text-foreground">
                {managedDevices.length}
              </div>
              <button
                onClick={() => setAddOpen(true)}
                className="mt-2 btn-ghost p-1 text-xs"
              >
                <Plus className="w-3 h-3" />
                添加设备 (addDevice)
              </button>
            </div>
          </div>

          {/* Free devices (read-only) */}
          <DeviceTable
            title="未纳管设备（Free Devices）"
            subtitle="DataNode 主机上发现但尚未纳管的设备，只读"
            devices={freeDevices}
            loading={false}
            error={freeError}
            readOnly
          />

          {/* Managed devices (add/delete) */}
          <DeviceTable
            title="已纳管设备（Managed Devices）"
            subtitle="DataNode 当前纳管的设备，可添加或删除"
            devices={managedDevices}
            loading={false}
            error={managedError}
            readOnly={false}
            onAddClick={() => setAddOpen(true)}
            onDelete={(d) => setDeleteDev(d)}
            emptyAction={
              <button onClick={() => setAddOpen(true)} className="btn-primary">
                <Plus className="w-4 h-4" />
                添加设备
              </button>
            }
          />

          {/* Raw JSON */}
          <div className="card">
            <h2 className="text-sm font-semibold text-foreground mb-2">节点原始 JSON</h2>
            <pre
              className="rounded-md p-3 text-xs font-mono whitespace-pre-wrap break-all"
              style={{ background: 'var(--muted)' }}
            >
              {JSON.stringify(node, null, 2)}
            </pre>
          </div>
        </>
      ) : (
        <ErrorBanner message="未找到 DataNode" detail={`node_id = ${decodedId}`} />
      )}

      {/* Add device modal */}
      <AddDeviceModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={async () => {
          setAddOpen(false);
          await loadDevices();
        }}
        datanodeId={decodedId}
      />

      {/* Delete device confirm */}
      <Modal
        open={!!deleteDev}
        onClose={() => !deletingDev && setDeleteDev(null)}
        title="删除纳管设备"
        description={`确认从 DataNode ${decodedId} 移除设备 ${deleteDev?.device_uuid ?? ''}?`}
        size="sm"
        footer={
          <>
            <button
              onClick={() => setDeleteDev(null)}
              disabled={deletingDev}
              className="btn-outline"
            >
              取消
            </button>
            <button onClick={onDeleteDevice} disabled={deletingDev} className="btn-danger">
              {deletingDev ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              确认删除
            </button>
          </>
        }
      >
        <pre
          className="rounded-md p-3 text-xs font-mono whitespace-pre-wrap break-all"
          style={{ background: 'var(--muted)' }}
        >
          {JSON.stringify(deleteDev, null, 2)}
        </pre>
      </Modal>
    </div>
  );
}

function DeviceTable({
  title,
  subtitle,
  devices,
  loading,
  error,
  readOnly,
  onAddClick,
  onDelete,
  emptyAction,
}: {
  title: string;
  subtitle: string;
  devices: DeviceInfo[];
  loading: boolean;
  error: string | null;
  readOnly: boolean;
  onAddClick?: () => void;
  onDelete?: (d: DeviceInfo) => void;
  emptyAction?: React.ReactNode;
}) {
  return (
    <div className="card !p-0 overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        {!readOnly && onAddClick && (
          <button onClick={onAddClick} className="btn-outline">
            <Plus className="w-4 h-4" />
            添加设备
          </button>
        )}
      </div>
      {error && <ErrorBanner message="加载设备失败" detail={error} />}
      {loading ? (
        <LoadingOverlay />
      ) : devices.length === 0 && !error ? (
        <EmptyState
          title="无设备"
          description={readOnly ? '该 DataNode 无未纳管设备' : '该 DataNode 尚未纳管设备'}
          action={readOnly ? undefined : emptyAction}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="border-b text-left"
                style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}
              >
                <th className="px-4 py-2.5 font-medium text-muted-foreground">device_uuid</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground">class</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground">phy_path</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground">cap</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground">devType</th>
                {!readOnly && onDelete && (
                  <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">操作</th>
                )}
              </tr>
            </thead>
            <tbody>
              {devices.map((d, i) => (
                <tr
                  key={d.device_uuid || i}
                  className="border-b last:border-0 hover:bg-[var(--muted)]"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground break-all">
                    {d.device_uuid || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {deviceClassLabel(d.class)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground break-all">
                    {d.phy_path}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {formatBytes(d.cap)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {d.devType}
                  </td>
                  {!readOnly && onDelete && (
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => onDelete(d)}
                        className="btn-ghost p-1.5"
                        style={{ color: 'var(--destructive)' }}
                        title="删除设备"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AddDeviceModal({
  open,
  onClose,
  onSuccess,
  datanodeId,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  datanodeId: string;
}) {
  const [form, setForm] = useState<DataNodeAddDeviceRequest>({
    phy_path: '',
    dev_type: 0,
    force_init: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!form.phy_path.trim()) {
      setError('phy_path 不能为空');
      return;
    }
    setSubmitting(true);
    try {
      await addDataNodeDevice(datanodeId, {
        ...form,
        phy_path: form.phy_path.trim(),
      });
      setForm({ phy_path: '', dev_type: 0, force_init: false });
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
      title="添加纳管设备"
      description={`通过 addDevice 将设备添加到 DataNode ${datanodeId}`}
      size="md"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={submitting} className="btn-outline">
            取消
          </button>
          <button
            type="submit"
            form="dndev-add-form"
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            添加
          </button>
        </>
      }
    >
      <form id="dndev-add-form" onSubmit={onSubmit} className="space-y-3">
        {error && <ErrorBanner message="添加失败" detail={error} />}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            phy_path <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <input
            value={form.phy_path}
            onChange={(e) => setForm((p) => ({ ...p, phy_path: e.target.value }))}
            className="input font-mono"
            placeholder="/dev/sdb"
            disabled={submitting}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            dev_type <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <select
            value={form.dev_type}
            onChange={(e) => setForm((p) => ({ ...p, dev_type: Number(e.target.value) as 0 | 1 }))}
            className="input"
            disabled={submitting}
          >
            <option value={0}>LOCAL (0)</option>
            <option value={1}>TCP (1)</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="dndev-force-init"
            type="checkbox"
            checked={!!form.force_init}
            onChange={(e) => setForm((p) => ({ ...p, force_init: e.target.checked }))}
            disabled={submitting}
            className="w-4 h-4 cursor-pointer"
          />
          <label htmlFor="dndev-force-init" className="text-sm text-foreground cursor-pointer">
            force_init（强制初始化设备）
          </label>
        </div>
      </form>
    </Modal>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-foreground break-all">{v}</span>
    </div>
  );
}

function stateLabel(s: number): string {
  switch (s) {
    case 0:
      return 'IN';
    case 1:
      return 'OUT';
    case 2:
      return 'DRAIN';
    default:
      return String(s);
  }
}

function healthLabel(s: HealthStatus): string {
  switch (s) {
    case 0:
      return 'UNKNOWN';
    case 1:
      return 'OK';
    case 2:
      return 'WARN';
    case 3:
      return 'ERROR';
    case 4:
      return 'DOWN';
    default:
      return String(s);
  }
}

function healthKind(s: HealthStatus): 'ok' | 'warn' | 'err' | 'unknown' {
  switch (s) {
    case 1:
      return 'ok';
    case 2:
      return 'warn';
    case 3:
    case 4:
      return 'err';
    default:
      return 'unknown';
  }
}

function deviceClassLabel(c?: number): string {
  switch (c) {
    case 0:
      return 'UNKNOWN';
    case 1:
      return 'HDD';
    case 2:
      return 'SSD';
    case 3:
      return 'NVME';
    default:
      return String(c);
  }
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '—';
  const units = ['B', 'K', 'M', 'G', 'T', 'P'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(1)}${units[i]}`;
}

function extractError(err: unknown): string {
  if (err instanceof ApiError) return [err.message, err.detail].filter(Boolean).join(' · ');
  if (err instanceof Error) return err.message;
  return String(err);
}