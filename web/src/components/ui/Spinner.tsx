import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin', className)} />;
}

export function LoadingOverlay({ label = '加载中…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
      <Spinner className="w-4 h-4 mr-2" />
      {label}
    </div>
  );
}
