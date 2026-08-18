import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { DebugToggle } from './DebugToggle';
import { DebugPanel } from './DebugPanel';

export function Layout() {
  return (
    <div className="h-full flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--muted)' }}>
          <Outlet />
        </main>
      </div>
      <DebugToggle />
      <DebugPanel />
    </div>
  );
}
