import type { ReactNode } from 'react';
import { Button } from './Button';
import { AlertCircle, FolderSearch2 } from 'lucide-react';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[var(--radius-md)] bg-line/60 ${className}`}
      aria-hidden="true"
    />
  );
}

export function EventCardSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-soft space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="space-y-2 pt-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <div className="pt-4 border-t border-line/60 flex items-center justify-between">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
    </div>
  );
}

export function ErrorState({
  title = 'No se pudo cargar la información',
  message = 'Ocurrió un problema de conexión al consultar el servidor.',
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-danger/30 bg-danger/5 p-6 text-center space-y-3 my-4"
    >
      <div className="h-10 w-10 mx-auto rounded-full bg-danger/10 text-danger flex items-center justify-center">
        <AlertCircle className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h3 className="font-serif text-base font-bold text-danger">{title}</h3>
        <p className="text-xs text-muted max-w-md mx-auto">{message}</p>
      </div>
      {onRetry && (
        <div className="pt-2">
          <Button variant="secundario" size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  title = 'No se encontraron resultados',
  message = 'No hay registros disponibles que coincidan con la búsqueda.',
  action,
}: {
  title?: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface p-8 text-center space-y-3 my-4">
      <div className="h-10 w-10 mx-auto rounded-full bg-canvas text-muted flex items-center justify-center">
        <FolderSearch2 className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h3 className="font-serif text-base font-bold text-ink">{title}</h3>
        <p className="text-xs text-muted max-w-md mx-auto">{message}</p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
