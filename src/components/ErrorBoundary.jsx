import { Component } from 'react'

// Last line of defence: a crash inside a page shows a terminal-style fault
// screen instead of a blank page. Remounted per route (see App.jsx key).
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[Sentrivue] page crashed:', error, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div role="alert" className="mx-auto max-w-2xl px-4 py-24">
        <p className="text-xs uppercase tracking-[0.25em] text-accent">// fault</p>
        <h1 className="mt-3 font-display text-3xl font-bold uppercase">This view crashed</h1>
        <p className="mt-4 border-l-2 border-line pl-4 text-sm text-muted">{String(error?.message || error)}</p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-8 border border-accent px-4 py-2 text-xs uppercase tracking-widest text-accent transition-colors hover:bg-accent hover:text-bg"
        >
          &gt; retry
        </button>
      </div>
    )
  }
}
