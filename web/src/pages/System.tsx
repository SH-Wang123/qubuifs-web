import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  CircleCheck,
  CirclePause,
  Tag,
  RefreshCw,
  FolderOpen,
  Server,
} from 'lucide-react';
import { useSessionStore } from '@/stores/session';
import { getHealthz, getReadyz, getVersion } from '@/api/control';
import type { HealthzData, ReadyzData, VersionData } from '@/types/api';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ApiError } from '@/api/client';

interface SystemState {
  health: HealthzData | null;
  healthError: string | null;
  ready: ReadyzData | null;
  readyError: string | null;
  version: VersionData | null;
  versionError: string | null;
}

export function SystemPage() {
  const navigate = useNavigate();
  const session = useSessionStore((s) => s.session);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<SystemState>({
    health: null,
    healthError: null,
    ready: null,
    readyError: null,
    version: null,
    versionError: null,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [h, r, v] = await Promise.allSettled([getHealthz(), getReadyz(), getVersion()]);
    setState({
      health: h.status === 'fulfilled' ? h.value : null,
      healthError: h.status === 'rejected' ? extractError(h.reason) : null,
      ready: r.status === 'fulfilled' ? r.value : null,
      readyError: r.status === 'rejected' ? extractError(r.reason) : null,
      version: v.status === 'fulfilled' ? v.value : null,
      versionError: v.status === 'rejected' ? extractError(v.reason) : null,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            系统状态
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            控制面健康、就绪与版本信息
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-outline">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {loading ? (
        <LoadingOverlay label="加载系统状态…" />
      ) : (
        <>
          {/* 4 Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Health */}
            <div className="card">
              <div className="flex items-start justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">健康状态</span>
                <CircleCheck
                  className="w-5 h-5"
                  style={{
                    color: state.health ? 'var(--status-ok)' : 'var(--status-err)',
                  }}
                />
              </div>
              <div className="mb-1">
                {state.health ? (
                  <StatusBadge kind="ok">OK</StatusBadge>
                ) : (
                  <StatusBadge kind="err">ERROR</StatusBadge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {state.health
                  ? '控制面进程运行正常'
                  : state.healthError || '健康检查失败'}
              </p>
            </div>

            {/* Ready */}
            <div className="card">
              <div className="flex items-start justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">就绪状态</span>
                <CirclePause
                  className="w-5 h-5"
                  style={{
                    color: state.ready?.ready ? 'var(--status-ok)' : 'var(--status-warn)',
                  }}
                />
              </div>
              <div className="mb-1">
                {state.ready ? (
                  <StatusBadge kind={state.ready.ready ? 'ok' : 'warn'}>
                    {state.ready.ready ? 'Ready' : 'Not Ready'}
                  </StatusBadge>
                ) : (
                  <StatusBadge kind="err">ERROR</StatusBadge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2 break-all">
                {state.ready
                  ? state.ready.ready
                    ? '控制面已就绪，可接受请求'
                    : `原因: ${state.ready.reason || '未知'}`
                  : state.readyError || '就绪检查失败'}
              </p>
            </div>

            {/* Version */}
            <div className="card">
              <div className="flex items-start justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">版本信息</span>
                <Tag className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              </div>
              <div className="mb-1">
                <code className="text-sm font-mono font-semibold text-foreground">
                  {state.version?.version || '—'}
                </code>
              </div>
              <div className="text-xs text-muted-foreground mt-2 font-mono space-y-0.5">
                {state.version?.git_commit && (
                  <div>commit: {state.version.git_commit.slice(0, 12)}</div>
                )}
                {state.version?.build_time && (
                  <div>built: {state.version.build_time}</div>
                )}
                {!state.version && (state.versionError || '版本信息获取失败')}
              </div>
            </div>

            {/* Connection */}
            <div className="card">
              <div className="flex items-start justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">连接信息</span>
                <Activity className="w-5 h-5" style={{ color: 'var(--status-ok)' }} />
              </div>
              <div className="mb-1">
                <StatusBadge kind="ok">CONNECTED</StatusBadge>
              </div>
              <p className="text-xs text-muted-foreground mt-2 font-mono break-all">
                {session?.endpoint}
              </p>
              {session?.connectedAt && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  自 {new Date(session.connectedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {/* Error details (调试期展示完整错误) */}
          {(state.healthError || state.readyError || state.versionError) && (
            <div className="space-y-2">
              {state.healthError && (
                <ErrorBanner message="healthz 失败" detail={state.healthError} />
              )}
              {state.readyError && (
                <ErrorBanner message="readyz 失败" detail={state.readyError} />
              )}
              {state.versionError && (
                <ErrorBanner message="version 失败" detail={state.versionError} />
              )}
            </div>
          )}

          {/* Quick Actions */}
          <div className="card">
            <h2 className="text-sm font-semibold text-foreground mb-3">快捷操作</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <QuickAction
                icon={<FolderOpen className="w-5 h-5" />}
                title="文件系统"
                description="管理 QubuiFS"
                onClick={() => navigate('/qubuifs')}
              />
              <QuickAction
                icon={<Server className="w-5 h-5" />}
                title="数据节点"
                description="管理 DataNode 与数据设备"
                onClick={() => navigate('/datanodes')}
              />
              <QuickAction
                icon={<Activity className="w-5 h-5" />}
                title="元数据导出"
                description="快照导出"
                onClick={() => navigate('/metadata')}
              />
            </div>
          </div>

          {/* Raw session JSON (调试阶段) */}
          <div className="card">
            <h2 className="text-sm font-semibold text-foreground mb-2">会话原始数据</h2>
            <p className="text-xs text-muted-foreground mb-2">
              调试阶段展示完整会话 JSON（包含 health / ready / version 详情）
            </p>
            <pre
              className="rounded-md p-3 text-xs font-mono whitespace-pre-wrap break-all overflow-x-auto"
              style={{ background: 'var(--muted)' }}
            >
              {JSON.stringify(session, null, 2)}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}

function QuickAction({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left p-3 rounded-md border transition-colors hover:bg-[var(--muted)]"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="text-primary mb-2">{icon}</div>
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
    </button>
  );
}

function extractError(err: unknown): string {
  if (err instanceof ApiError) {
    return [err.message, err.detail].filter(Boolean).join(' · ');
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
