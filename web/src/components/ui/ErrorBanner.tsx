import { AlertTriangle } from 'lucide-react';

export function ErrorBanner({ message, detail }: { message: string; detail?: string }) {
  return (
    <div
      className="rounded-md border px-4 py-3 flex items-start gap-3"
      style={{
        borderColor: 'color-mix(in srgb, var(--destructive) 40%, transparent)',
        background: 'color-mix(in srgb, var(--destructive) 8%, transparent)',
      }}
    >
      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--destructive)' }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--destructive)' }}>
          {message}
        </p>
        {detail && (
          <pre className="mt-1 text-xs font-mono whitespace-pre-wrap break-all text-muted-foreground">
            {detail}
          </pre>
        )}
      </div>
    </div>
  );
}
