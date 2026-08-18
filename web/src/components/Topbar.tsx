import { useLocation } from 'react-router-dom';
import { Sun, Moon, Bug } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useSessionStore } from '@/stores/session';
import { useDebugStore } from '@/stores/debug';
import { StatusDot } from './ui/StatusBadge';
import { ConnState } from '@/types/api';

function mapConnToKind(state: ConnState): 'ok' | 'warn' | 'err' | 'unknown' {
  switch (state) {
    case ConnState.CONNECTED:
      return 'ok';
    case ConnState.HANDSHAKING:
      return 'warn';
    case ConnState.FAILED:
      return 'err';
    case ConnState.INIT:
    case ConnState.DISCONNECTED:
    default:
      return 'unknown';
  }
}

function mapConnToLabel(state: ConnState): string {
  switch (state) {
    case ConnState.CONNECTED:
      return '已连接';
    case ConnState.HANDSHAKING:
      return '握手中';
    case ConnState.FAILED:
      return '连接失败';
    case ConnState.INIT:
      return '未初始化';
    case ConnState.DISCONNECTED:
      return '已断开';
    default:
      return '未知';
  }
}

/** 面包屑映射：路由 → 显示名 */
function breadcrumbFor(pathname: string): { root: string; current: string } {
  if (pathname.startsWith('/system')) return { root: 'QubuiFS', current: '系统状态' };
  if (pathname.startsWith('/namespaces')) {
    const segs = pathname.split('/').filter(Boolean);
    return { root: 'QubuiFS', current: segs.length > 1 ? '命名空间详情' : '命名空间' };
  }
  if (pathname.startsWith('/qubuifs')) {
    const segs = pathname.split('/').filter(Boolean);
    return { root: 'QubuiFS', current: segs.length > 2 ? '文件系统详情' : '文件系统' };
  }
  if (pathname.startsWith('/datanodes')) {
    const segs = pathname.split('/').filter(Boolean);
    return { root: 'QubuiFS', current: segs.length > 1 ? '数据节点详情' : '数据节点' };
  }
  if (pathname.startsWith('/meta-services')) {
    const segs = pathname.split('/').filter(Boolean);
    return { root: 'QubuiFS', current: segs.length > 1 ? '元数据服务详情' : '元数据服务' };
  }
  if (pathname.startsWith('/metadata')) return { root: 'QubuiFS', current: '元数据导出' };
  if (pathname.startsWith('/connect')) return { root: 'QubuiFS', current: '连接控制面' };
  return { root: 'QubuiFS', current: '' };
}

export function Topbar() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const connState = useSessionStore((s) => s.connState);
  const session = useSessionStore((s) => s.session);
  const debugEnabled = useDebugStore((s) => s.enabled);
  const togglePanel = useDebugStore((s) => s.togglePanel);

  const { root, current } = breadcrumbFor(location.pathname);

  return (
    <header
      className="flex items-center justify-between px-6 py-3 border-b"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--background)',
      }}
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <span className="font-medium text-foreground">{root}</span>
        {current && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">{current}</span>
          </>
        )}
      </nav>

      {/* Right Actions */}
      <div className="flex items-center gap-3 text-sm">
        {/* Connection Indicator */}
        <div className="flex items-center gap-1.5">
          <StatusDot kind={mapConnToKind(connState)} />
          <span className="text-foreground font-medium">{mapConnToLabel(connState)}</span>
        </div>
        {session?.endpoint && (
          <span className="text-muted-foreground font-mono text-xs hidden sm:inline">
            {session.endpoint}
          </span>
        )}

        {/* Debug toggle (only shows when enabled) */}
        {debugEnabled && (
          <button
            type="button"
            onClick={togglePanel}
            className="btn-ghost p-1.5"
            aria-label="调试日志"
            title="查看请求/响应日志"
          >
            <Bug className="w-4 h-4" />
          </button>
        )}

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="btn-ghost p-1.5"
          aria-label="切换主题"
          title={theme === 'light' ? '切换到深色' : '切换到浅色'}
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
