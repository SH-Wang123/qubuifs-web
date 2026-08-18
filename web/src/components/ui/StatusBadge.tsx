import { cn } from '@/lib/utils';

type StatusKind = 'ok' | 'warn' | 'err' | 'info' | 'unknown';

interface StatusBadgeProps {
  kind?: StatusKind;
  children: React.ReactNode;
  className?: string;
}

const kindClass: Record<StatusKind, string> = {
  ok: 'text-white',
  warn: 'text-black',
  err: 'text-white',
  info: 'text-white',
  unknown: 'text-white',
};

const kindBg: Record<StatusKind, string> = {
  ok: 'var(--status-ok)',
  warn: 'var(--status-warn)',
  err: 'var(--status-err)',
  info: 'var(--primary)',
  unknown: 'var(--status-unknown)',
};

export function StatusBadge({ kind = 'unknown', children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn('badge', kindClass[kind], className)}
      style={{ background: kindBg[kind] }}
    >
      {children}
    </span>
  );
}

/** 健康状态点（小圆点） */
export function StatusDot({ kind = 'unknown', className }: { kind?: StatusKind; className?: string }) {
  return (
    <span
      className={cn('inline-block w-2 h-2 rounded-full', className)}
      style={{ background: kindBg[kind] }}
    />
  );
}
