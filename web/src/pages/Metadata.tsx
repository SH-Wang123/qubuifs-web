import { useState } from 'react';
import { FileDown, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { exportMetadata } from '@/api/control';
import type { ExportMetadataData } from '@/types/api';
import { ApiError } from '@/api/client';

export function MetadataPage() {
  const [dest, setDest] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExportMetadataData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportedAt, setExportedAt] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dest.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const data = await exportMetadata({ dest: dest.trim() });
      setResult(data);
      setExportedAt(new Date().toISOString());
    } catch (err) {
      if (err instanceof ApiError) {
        setError([err.message, err.detail].filter(Boolean).join(' · '));
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          元数据导出
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          将当前控制面的元数据快照导出到指定路径
        </p>
      </div>

      {/* Form Card */}
      <div className="card">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="dest"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              导出路径 <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <input
              id="dest"
              type="text"
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              placeholder="/var/lib/qubuifs/export/meta.tar.gz"
              className="input font-mono"
              disabled={submitting}
              autoFocus
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              元数据将导出到控制面服务器的指定路径，请确保路径可写
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || !dest.trim()}
            className="btn-primary"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                导出中…
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                导出
              </>
            )}
          </button>
        </form>
      </div>

      {/* Result */}
      {(result || error) && (
        <div className="card">
          <h2 className="text-sm font-semibold text-foreground mb-3">导出结果</h2>
          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className="w-5 h-5"
                  style={{ color: 'var(--status-ok)' }}
                />
                <span className="text-sm font-medium text-foreground">导出成功</span>
              </div>
              <div
                className="rounded-md p-3 text-xs font-mono"
                style={{ background: 'var(--muted)' }}
              >
                <div className="grid grid-cols-[100px_1fr] gap-y-1">
                  <span className="text-muted-foreground">导出路径</span>
                  <span className="text-foreground break-all">{result.dest}</span>
                  {exportedAt && (
                    <>
                      <span className="text-muted-foreground">导出时间</span>
                      <span className="text-foreground">
                        {new Date(exportedAt).toLocaleString()}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          {error && !result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5" style={{ color: 'var(--destructive)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--destructive)' }}>
                  导出失败
                </span>
              </div>
              <pre
                className="rounded-md p-3 text-xs font-mono whitespace-pre-wrap break-all"
                style={{
                  background: 'color-mix(in srgb, var(--destructive) 8%, transparent)',
                  color: 'var(--destructive)',
                }}
              >
                {error}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Help text */}
      <div
        className="rounded-md p-4 text-sm"
        style={{
          background: 'color-mix(in srgb, var(--primary) 8%, transparent)',
          color: 'var(--accent-foreground)',
        }}
      >
        元数据导出功能将控制面当前的元数据状态快照保存到服务器本地路径。导出期间控制面服务不受影响。
      </div>
    </div>
  );
}
