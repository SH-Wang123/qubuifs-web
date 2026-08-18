import { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { RequireConnected } from '@/components/guards';
import { useSessionStore } from '@/stores/session';
import { fetchSession } from '@/api/session';
import { ConnState } from '@/types/api';

import { ConnectPage } from '@/pages/Connect';
import { SystemPage } from '@/pages/System';
import { QubuiFSPage } from '@/pages/QubuiFS';
import { QubuiFSDetailPage } from '@/pages/QubuiFSDetail';
import { MetadataPage } from '@/pages/Metadata';
import { MetaServicesPage } from '@/pages/MetaServices';
import { MetaServiceDetailPage } from '@/pages/MetaServiceDetail';
import { NamespacesPage } from '@/pages/Namespaces';
import { NamespaceDetailPage } from '@/pages/NamespaceDetail';
import { DataNodesPage } from '@/pages/DataNodes';
import { DataNodeDetailPage } from '@/pages/DataNodeDetail';

/** 应用启动时初始化：拉取当前会话状态 */
function useBootstrapSession() {
  const setSession = useSessionStore((s) => s.setSession);
  const setConnState = useSessionStore((s) => s.setConnState);
  const setError = useSessionStore((s) => s.setError);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchSession();
        if (cancelled) return;
        if (s && s.connected) {
          setSession(s);
        } else {
          setConnState(ConnState.DISCONNECTED);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setConnState(ConnState.DISCONNECTED);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function AppRoutes() {
  useBootstrapSession();

  return (
    <Routes>
      <Route path="/connect" element={<ConnectPage />} />

      {/* 业务页面统一通过 Layout + 守卫包裹 */}
      <Route
        element={
          <RequireConnected>
            <Layout />
          </RequireConnected>
        }
      >
        <Route path="/system" element={<SystemPage />} />
        <Route path="/namespaces" element={<NamespacesPage />} />
        <Route path="/namespaces/:name" element={<NamespaceDetailPage />} />
        <Route path="/qubuifs" element={<QubuiFSPage />} />
        <Route path="/qubuifs/:fsUuid" element={<QubuiFSDetailPage />} />
        <Route path="/datanodes" element={<DataNodesPage />} />
        <Route path="/datanodes/:datanodeId" element={<DataNodeDetailPage />} />
        <Route path="/meta-services" element={<MetaServicesPage />} />
        <Route path="/meta-services/:serviceId" element={<MetaServiceDetailPage />} />
        <Route path="/metadata" element={<MetadataPage />} />
      </Route>

      {/* 兜底 */}
      <Route path="/" element={<Navigate to="/connect" replace />} />
      <Route path="*" element={<Navigate to="/connect" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}
