import { RefreshCw } from 'lucide-react'
import { describeError } from '../services/wazuhApi'

// Shown on every data page when the Wazuh Manager could not be reached and the
// page is running on built-in sample data.
export default function ConnectionNotice({ source, error, onRetry, className = '' }) {
  if (source !== 'mock') return null
  const { title, detail } = error ? describeError(error) : { title: 'Wazuh Manager unreachable — check IP/network', detail: '' }
  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 border border-line border-l-[3px] border-l-accent bg-panel px-4 py-3 text-xs ${className}`}
    >
      <span className="font-semibold uppercase tracking-widest text-accent">{error?.kind === 'endpoint' ? 'Partial data' : 'No connection'}</span>
      <span className="min-w-0 flex-1 basis-64">
        <span className="block text-ink">{title}</span>
        <span className="block text-muted">
          {detail && `${detail} · `}
          {error?.kind === 'endpoint' ? 'this view uses sample data' : 'showing sample data until the connection is restored'}
        </span>
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 border border-line px-3 py-1.5 uppercase tracking-widest text-ink transition-colors hover:border-accent hover:text-accent"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  )
}
