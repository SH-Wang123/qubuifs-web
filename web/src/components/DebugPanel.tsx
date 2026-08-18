import { useState, useMemo } from 'react';
import { X, Trash2, ChevronDown, ChevronRight, Search, Copy } from 'lucide-react';
import { useDebugStore } from '@/stores/debug';
import { cn } from '@/lib/utils';
import type { DebugLogEntry } from '@/types/api';

function statusColor(status: number): string {
  if (status === 0) return 'var(--status-err)';
  if (status < 200) return 'var(--status-warn)';
  if (status < 300) return 'var(--status-ok)';
  if (status < 400) return 'var(--status-warn)';
  if (status < 500) return 'var(--status-err)';
  return 'var(--status-err)';
}

function methodColor(method: string): string {
  switch (method) {
    case 'GET':
      return 'var(--chart-5)';
    case 'POST':
      return 'var(--chart-1)';
    case 'DELETE':
      return 'var(--status-err)';
    case 'PUT':
    case 'PATCH':
      return 'var(--chart-3)';
    default:
      return 'var(--muted-foreground)';
  }
}

function prettyJson(text: string | null): string {
  if (!text) return '';
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function DebugPanel() {
  const open = useDebugStore((s) => s.panelOpen);
  const setPanelOpen = useDebugStore((s) => s.setPanelOpen);
  const logs = useDebugStore((s) => s.logs);
  const clearLogs = useDebugStore((s) => s.clearLogs);

  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!filter.trim()) return logs;
    const q = filter.toLowerCase();
    return logs.filter(
      (l) =>
        l.url.toLowerCase().includes(q) ||
        l.method.toLowerCase().includes(q) ||
        String(l.status).includes(q) ||
        (l.respBody ?? '').toLowerCase().includes(q) ||
        (l.reqBody ?? '').toLowerCase().includes(q) ||
        (l.error ?? '').toLowerCase().includes(q),
    );
  }, [logs, filter]);

  if (!open) return null;

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyEntry = async (entry: DebugLogEntry) => {
    const text = JSON.stringify(entry, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* 右侧抽屉 */}
      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-[640px] pointer-events-auto flex flex-col shadow-2xl border-l"
        style={{
          background: 'var(--background)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">请求 / 响应日志</h2>
            <span className="text-xs text-muted-foreground">{filtered.length} 条</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={clearLogs}
              className="btn-ghost p-1.5"
              aria-label="清空日志"
              title="清空日志"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="btn-ghost p-1.5"
              aria-label="关闭面板"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter */}
        <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="过滤：URL / 方法 / 状态 / 响应体…"
              className="input pl-8 py-1.5 text-xs"
            />
          </div>
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {logs.length === 0 ? '尚无日志记录' : '无匹配的日志'}
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {filtered.map((entry) => {
                const isOpen = expanded.has(entry.id);
                return (
                  <li
                    key={entry.id}
                    className="px-4 py-2 hover:bg-[var(--muted)] transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(entry.id)}
                      className="w-full flex items-center gap-2 text-left"
                    >
                      {isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                      )}
                      <span
                        className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                        style={{
                          color: methodColor(entry.method),
                          background: 'color-mix(in srgb, currentColor 15%, transparent)',
                        }}
                      >
                        {entry.method}
                      </span>
                      <span
                        className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded text-white"
                        style={{ background: statusColor(entry.status) }}
                      >
                        {entry.status === 0 ? 'ERR' : entry.status}
                      </span>
                      <span className="flex-1 truncate text-xs font-mono text-foreground">
                        {entry.url}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {entry.elapsed}ms
                      </span>
                    </button>

                    {isOpen && (
                      <div className="mt-2 ml-7 space-y-2 text-xs">
                        <LogSection
                          title="时间"
                          content={entry.ts}
                        />
                        {entry.reqBody && (
                          <LogSection title="请求体" content={prettyJson(entry.reqBody)} />
                        )}
                        {entry.respBody && (
                          <LogSection
                            title="响应体"
                            content={prettyJson(entry.respBody)}
                          />
                        )}
                        {entry.error && (
                          <LogSection
                            title="错误"
                            content={entry.error}
                            color="var(--destructive)"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => copyEntry(entry)}
                          className="btn-ghost p-1 text-[10px] gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          {copiedId === entry.id ? '已复制' : '复制 JSON'}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer hint */}
        <div
          className="px-4 py-2 border-t text-[10px] text-muted-foreground font-mono"
          style={{ borderColor: 'var(--border)' }}
        >
          仅当调试模式开启时记录。最多保留 200 条。
        </div>
      </div>

      {/* 点击遮罩关闭 */}
      <div
        className="absolute left-0 top-0 bottom-0 pointer-events-auto bg-black/30"
        onClick={() => setPanelOpen(false)}
        style={{ width: 'calc(100% - 640px)' }}
      />
    </div>
  );
}

function LogSection({
  title,
  content,
  color,
}: {
  title: string;
  content: string;
  color?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        {title}
      </div>
      <pre
        className={cn(
          'rounded-md p-2 font-mono text-[11px] whitespace-pre-wrap break-all overflow-x-auto',
        )}
        style={{
          background: 'var(--muted)',
          color: color ?? 'var(--foreground)',
        }}
      >
        {content}
      </pre>
    </div>
  );
}
