import type { SessionState } from '@/types/api';
import { loggedFetch } from './client';

/** 握手：连接控制面端点 */
export async function connectSession(endpoint: string): Promise<SessionState> {
  const resp = await loggedFetch('/api/session/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data?.message || `握手失败 (HTTP ${resp.status})`);
  }
  return data as SessionState;
}

/** 查询当前会话状态 */
export async function fetchSession(): Promise<SessionState | null> {
  const resp = await loggedFetch('/api/session', { method: 'GET' });
  if (resp.status === 404 || resp.status === 409) return null;
  if (!resp.ok) {
    throw new Error(`查询会话失败 (HTTP ${resp.status})`);
  }
  const data = await resp.json();
  return data as SessionState;
}

/** 断开会话 */
export async function disconnectSession(): Promise<void> {
  await loggedFetch('/api/session', { method: 'DELETE' });
}

/** 重新探测（再次执行握手健康检查） */
export async function probeSession(): Promise<SessionState> {
  const resp = await loggedFetch('/api/session/probe', {
    method: 'POST',
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data?.message || `重新探测失败 (HTTP ${resp.status})`);
  }
  return data as SessionState;
}
