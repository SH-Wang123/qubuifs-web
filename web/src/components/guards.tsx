import { Navigate, useLocation } from 'react-router-dom';
import { useSessionStore } from '@/stores/session';
import { ConnState } from '@/types/api';

/**
 * 路由守卫：未连接时跳转到 /connect。
 * 进入握手过程中也允许（避免循环跳转）。
 */
export function RequireConnected({ children }: { children: React.ReactElement }) {
  const connState = useSessionStore((s) => s.connState);
  const location = useLocation();

  if (connState !== ConnState.CONNECTED) {
    return <Navigate to="/connect" replace state={{ from: location.pathname }} />;
  }
  return children;
}
