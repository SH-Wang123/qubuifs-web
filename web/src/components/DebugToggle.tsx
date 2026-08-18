import { Bug } from 'lucide-react';
import { useDebugStore } from '@/stores/debug';

/**
 * 调试开关浮动按钮：右下角圆形按钮，控制调试模式开关 + 弹出日志面板。
 * 仅当调试模式开启时显示日志面板触发器；关闭时按钮自身可重新开启。
 */
export function DebugToggle() {
  const enabled = useDebugStore((s) => s.enabled);
  const toggleEnabled = useDebugStore((s) => s.toggleEnabled);
  const togglePanel = useDebugStore((s) => s.togglePanel);
  const logsCount = useDebugStore((s) => s.logs.length);

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {/* 日志面板触发按钮（仅调试模式开时显示） */}
      {enabled && (
        <button
          type="button"
          onClick={togglePanel}
          className="btn-primary shadow-lg rounded-full w-11 h-11 !p-0 inline-flex items-center justify-center relative"
          aria-label="打开调试日志面板"
          title="请求/响应日志"
        >
          <Bug className="w-5 h-5" />
          {logsCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center text-[10px] font-bold rounded-full bg-white text-primary">
              {logsCount > 99 ? '99+' : logsCount}
            </span>
          )}
        </button>
      )}

      {/* 调试模式总开关 */}
      <button
        type="button"
        onClick={toggleEnabled}
        className={
          'rounded-full w-11 h-11 !p-0 inline-flex items-center justify-center shadow-lg border transition-colors ' +
          (enabled ? 'btn-ghost' : 'btn-outline')
        }
        style={
          enabled
            ? {
                background: 'color-mix(in srgb, var(--status-ok) 20%, transparent)',
                borderColor: 'var(--status-ok)',
                color: 'var(--status-ok)',
              }
            : undefined
        }
        aria-label={enabled ? '关闭调试模式' : '开启调试模式'}
        title={enabled ? '调试模式已开启（点击关闭）' : '调试模式已关闭（点击开启）'}
      >
        <Bug className="w-5 h-5" />
      </button>
    </div>
  );
}
