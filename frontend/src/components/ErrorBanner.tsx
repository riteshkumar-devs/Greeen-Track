import { AlertCircle, X } from 'lucide-react';
import { ApiClientError } from '../services/apiClient';

interface ErrorBannerProps {
  error: unknown;
  onDismiss?: () => void;
  title?: string;
}

export function ErrorBanner({ error, onDismiss, title }: ErrorBannerProps) {
  if (!error) return null;

  const isApiErr = error instanceof ApiClientError;
  const code = isApiErr ? error.payload.code : 'ERROR';
  const message =
    error instanceof Error ? error.message : 'An unexpected error occurred while processing the request.';
  const status = isApiErr && error.status > 0 ? error.status : null;

  return (
    <div
      role="alert"
      className="gt-page-enter flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2 font-medium">
            <span>{title ?? 'Request rejected by server'}</span>
            <span className="font-mono text-xs text-red-700 tabular-nums">
              {status ? `${status} · ` : ''}
              {code}
            </span>
          </div>
          <p className="text-red-800">{message}</p>
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="rounded p-1 text-red-600 transition-colors hover:bg-red-100 hover:text-red-900"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
