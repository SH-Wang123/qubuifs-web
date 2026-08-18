import { NavLink, useNavigate } from 'react-router-dom';
import {
  CircleCheck,
  FolderOpen,
  FileDown,
  LogOut,
  Database,
  Layers,
  Server,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/stores/session';
import { disconnectSession } from '@/api/session';
import { useState } from 'react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  /** 匹配前缀，用于让子路由也高亮 */
  matchPrefix?: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/system', label: '系统状态', icon: <CircleCheck className="w-[18px] h-[18px]" /> },
  { to: '/namespaces', label: '命名空间', icon: <Layers className="w-[18px] h-[18px]" />, matchPrefix: '/namespaces' },
  { to: '/qubuifs', label: '文件系统', icon: <FolderOpen className="w-[18px] h-[18px]" />, matchPrefix: '/qubuifs' },
  { to: '/datanodes', label: '数据节点', icon: <Server className="w-[18px] h-[18px]" />, matchPrefix: '/datanodes' },
  { to: '/meta-services', label: '元数据服务', icon: <Database className="w-[18px] h-[18px]" />, matchPrefix: '/meta-services' },
  { to: '/metadata', label: '元数据导出', icon: <FileDown className="w-[18px] h-[18px]" /> },
];

export function Sidebar() {
  const session = useSessionStore((s) => s.session);
  const reset = useSessionStore((s) => s.reset);
  const navigate = useNavigate();
  const [disconnecting, setDisconnecting] = useState(false);

  const onDisconnect = async () => {
    if (disconnecting) return;
    setDisconnecting(true);
    try {
      await disconnectSession();
    } catch {
      /* 即使断开失败也清空本地状态 */
    } finally {
      reset();
      setDisconnecting(false);
      navigate('/connect', { replace: true });
    }
  };

  return (
    <aside
      className="w-[240px] min-w-[240px] h-full flex flex-col border-r"
      style={{
        background: 'var(--sidebar)',
        borderColor: 'var(--sidebar-border)',
      }}
    >
      {/* Brand */}
      <div
        className="flex items-center gap-2 px-5 py-4 border-b"
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        <img src="/logo.png" alt="QubuiFS" className="w-7 h-7 rounded" />
        <span
          className="text-lg font-semibold tracking-tight"
          style={{ color: 'var(--sidebar-primary)' }}
        >
          QubuiFS
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium border-l-2 transition-colors',
                isActive
                  ? 'border-l-primary bg-[var(--sidebar-accent)] text-[var(--sidebar-primary)]'
                  : 'border-l-transparent text-[var(--sidebar-foreground)] hover:bg-[var(--muted)]',
              )
            }
            style={({ isActive }) =>
              isActive
                ? {
                    borderColor: 'var(--sidebar-primary)',
                    background: 'var(--sidebar-accent)',
                    color: 'var(--sidebar-primary)',
                  }
                : undefined
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Sidebar Footer */}
      <div
        className="px-5 py-4 border-t space-y-3"
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        <div className="text-xs text-muted-foreground font-mono break-all">
          {session?.endpoint ?? '未连接'}
        </div>
        <button
          type="button"
          onClick={onDisconnect}
          disabled={disconnecting}
          className="w-full px-3 py-1.5 text-sm font-medium rounded-md border bg-transparent transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--muted-foreground)',
          }}
        >
          <LogOut className="w-3.5 h-3.5" />
          {disconnecting ? '断开中…' : '断开连接'}
        </button>
      </div>
    </aside>
  );
}
