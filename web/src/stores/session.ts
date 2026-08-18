import { create } from 'zustand';
import type { SessionState } from '@/types/api';
import { ConnState } from '@/types/api';

interface SessionStoreState {
  /** 状态机：INIT → HANDSHAKING → CONNECTED → FAILED/DISCONNECTED */
  connState: ConnState;
  /** 会话详情 */
  session: SessionState | null;
  /** 最后一次错误信息 */
  error: string | null;
  /** 设置状态 */
  setConnState: (s: ConnState) => void;
  setSession: (s: SessionState | null) => void;
  setError: (e: string | null) => void;
  /** 一次性重置 */
  reset: () => void;
  /** 是否已连接 */
  isConnected: () => boolean;
}

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  connState: ConnState.INIT,
  session: null,
  error: null,
  setConnState: (connState) => set({ connState }),
  setSession: (session) =>
    set({
      session,
      connState: session?.connected ? ConnState.CONNECTED : ConnState.DISCONNECTED,
    }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      connState: ConnState.INIT,
      session: null,
      error: null,
    }),
  isConnected: () => get().connState === ConnState.CONNECTED,
}));
