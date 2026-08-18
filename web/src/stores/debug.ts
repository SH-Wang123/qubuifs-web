import { create } from 'zustand';
import type { DebugLogEntry } from '@/types/api';

const MAX_LOGS = 200;

interface DebugState {
  /** 调试开关（开时记录并显示日志面板触发按钮） */
  enabled: boolean;
  /** 日志面板可见性 */
  panelOpen: boolean;
  /** 日志列表（按时间倒序，最新在前） */
  logs: DebugLogEntry[];
  /** 切换调试开关 */
  toggleEnabled: () => void;
  setEnabled: (v: boolean) => void;
  togglePanel: () => void;
  setPanelOpen: (v: boolean) => void;
  appendLog: (entry: Omit<DebugLogEntry, 'id'>) => void;
  clearLogs: () => void;
}

let seq = 0;
function nextId(): string {
  seq = (seq + 1) % Number.MAX_SAFE_INTEGER;
  return `log-${Date.now()}-${seq}`;
}

export const useDebugStore = create<DebugState>((set) => ({
  enabled: true,
  panelOpen: false,
  logs: [],
  toggleEnabled: () => set((s) => ({ enabled: !s.enabled })),
  setEnabled: (v) => set({ enabled: v }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  setPanelOpen: (v) => set({ panelOpen: v }),
  appendLog: (entry) =>
    set((s) => {
      if (!s.enabled) return s;
      const next: DebugLogEntry = { id: nextId(), ...entry };
      const logs = [next, ...s.logs].slice(0, MAX_LOGS);
      return { logs };
    }),
  clearLogs: () => set({ logs: [] }),
}));
