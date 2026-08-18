import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plug, Bug, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { useSessionStore } from '@/stores/session';
import { connectSession } from '@/api/session';
import { ConnState } from '@/types/api';
import { StatusDot } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';

const DEFAULT_IP = '192.168.8.175';
const DEFAULT_PORT = '9983';

export function ConnectPage() {
  const navigate = useNavigate();
  const connState = useSessionStore((s) => s.connState);
  const session = useSessionStore((s) => s.session);
  const setConnState = useSessionStore((s) => s.setConnState);
  const setSession = useSessionStore((s) => s.setSession);
  const setError = useSessionStore((s) => s.setError);
  const error = useSessionStore((s) => s.error);

  const [protocol, setProtocol] = useState<'http' | 'https'>('http');
  const [ip, setIp] = useState(DEFAULT_IP);
  const [port, setPort] = useState(DEFAULT_PORT);
  const [submitting, setSubmitting] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [failModal, setFailModal] = useState<{ endpoint: string; message: string; detail?: string } | null>(null);

  // 已连接时直接跳转
  useEffect(() => {
    if (connState === ConnState.CONNECTED) {
      navigate('/system', { replace: true });
    }
  }, [connState, navigate]);

  // 拼接端点
  const endpoint = `${protocol}://${ip.trim()}:${port.trim()}`;
  const canSubmit = ip.trim() !== '' && port.trim() !== '' && !submitting;

  const doConnect = async (ep: string) => {
    setSubmitting(true);
    setError(null);
    setConnState(ConnState.HANDSHAKING);
    try {
      const s = await connectSession(ep);
      setSession(s);
      setTimeout(() => navigate('/system', { replace: true }), 200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const detail = (err as { detail?: string })?.detail;
      setError(msg);
      setConnState(ConnState.FAILED);
      setFailModal({ endpoint: ep, message: msg, detail });
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    await doConnect(endpoint);
  };

  const onMock = async () => {
    if (submitting) return;
    await doConnect('mock://local');
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'var(--background)' }}
    >
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="QubuiFS" className="w-14 h-14 rounded-xl mb-3" />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            QubuiFS 控制台
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            连接到分布式文件系统控制面
          </p>
        </div>

        {/* Connect Card */}
        <div className="card">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                控制面端点 <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <div className="grid grid-cols-[88px_1fr_88px] gap-2 items-end">
                {/* 协议 */}
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">协议</label>
                  <select
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value as 'http' | 'https')}
                    disabled={submitting}
                    className="input h-[38px] px-2"
                  >
                    <option value="http">http://</option>
                    <option value="https">https://</option>
                  </select>
                </div>
                {/* IP */}
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">IP</label>
                  <input
                    type="text"
                    value={ip}
                    onChange={(e) => setIp(e.target.value)}
                    placeholder="10.0.0.12"
                    className="input font-mono"
                    disabled={submitting}
                    autoFocus
                  />
                </div>
                {/* 端口 */}
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">端口</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="9665"
                    className="input font-mono"
                    disabled={submitting}
                  />
                </div>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                预览：<code className="font-mono">{endpoint}</code>
              </p>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-primary w-full"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  握手中…
                </>
              ) : (
                <>
                  <Plug className="w-4 h-4" />
                  连接
                </>
              )}
            </button>
          </form>

          {/* Mock 快捷入口（仅调试期） */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-[11px] text-muted-foreground">或</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>
          <button
            type="button"
            onClick={onMock}
            disabled={submitting}
            className="mt-3 w-full text-sm py-2 rounded-md border transition-colors hover:bg-[var(--muted)]"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--muted-foreground)',
            }}
          >
            使用内置 Mock 控制面（<code className="font-mono">mock://local</code>）
          </button>

          {/* Error Modal */}
          <Modal
            open={!!failModal}
            onClose={() => setFailModal(null)}
            title="连接失败"
            size="md"
            footer={
              <button onClick={() => setFailModal(null)} className="btn-primary">
                知道了
              </button>
            }
          >
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle
                  className="w-5 h-5 mt-0.5 flex-shrink-0"
                  style={{ color: 'var(--destructive)' }}
                />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    无法连接到控制面
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {failModal?.endpoint}
                  </p>
                </div>
              </div>
              <div
                className="rounded-md p-3 text-xs font-mono whitespace-pre-wrap break-all"
                style={{
                  background: 'var(--muted)',
                  color: 'var(--foreground)',
                }}
              >
                {failModal?.message}
                {failModal?.detail && `\n\n${failModal.detail}`}
              </div>
              <p className="text-xs text-muted-foreground">
                请检查端点地址是否正确、控制面服务是否已启动、网络是否可达。
              </p>
            </div>
          </Modal>

          {/* Status indicator */}
          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 text-sm">
              <StatusDot
                kind={
                  connState === ConnState.CONNECTED
                    ? 'ok'
                    : connState === ConnState.HANDSHAKING
                    ? 'warn'
                    : connState === ConnState.FAILED
                    ? 'err'
                    : 'unknown'
                }
              />
              <span className="text-foreground font-medium">
                {connState === ConnState.HANDSHAKING
                  ? '正在执行握手（healthz → version → readyz）…'
                  : connState === ConnState.CONNECTED
                  ? '连接成功'
                  : connState === ConnState.FAILED
                  ? '连接失败'
                  : '尚未连接'}
              </span>
            </div>

            {/* 详细握手信息（调试阶段展开） */}
            <button
              type="button"
              onClick={() => setShowDetail((v) => !v)}
              className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showDetail ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              <Bug className="w-3.5 h-3.5" />
              调试信息
            </button>

            {showDetail && (
              <div
                className="mt-2 rounded-md p-3 text-xs font-mono whitespace-pre-wrap break-all"
                style={{
                  background: 'var(--muted)',
                  color: 'var(--foreground)',
                }}
              >
                {`当前状态: ${connState}
endpoint: ${endpoint || '(未填写)'}
session: ${session ? JSON.stringify(session, null, 2) : '(无)'}`}
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          连接成功后，所有请求将通过网关转发到控制面。
        </p>
      </div>
    </div>
  );
}
