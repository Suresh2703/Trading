/* The small shared pieces every mobile screen is built from. */
import { RefreshCw, WifiOff } from 'lucide-react';

import { since } from './format';

/** A screen: sticky title row, then scrolling content. */
export function Screen({ title, action, children }) {
  return (
    <>
      <header className="m-screen-head">
        <h1>{title}</h1>
        {action}
      </header>
      <div className="m-screen-body">{children}</div>
    </>
  );
}

/**
 * When the figures on screen were last true, and a way to ask again.
 *
 * Shown on every data screen because the app is expected to be read offline,
 * where the most important thing about a number is its age.
 */
export function Freshness({ at, stale, busy, onRefresh }) {
  return (
    <button type="button" className={`m-fresh${stale ? ' is-stale' : ''}`}
            onClick={onRefresh} disabled={busy}
            aria-label={stale ? `Showing figures from ${since(at)}. Refresh` : 'Refresh'}>
      {stale ? <WifiOff size={13} /> : <RefreshCw size={13} className={busy ? 'is-spinning' : ''} />}
      <span>{stale ? since(at) : busy ? 'Updating' : since(at)}</span>
    </button>
  );
}

/** One figure in the summary grid. */
export function Tile({ icon: Icon, label, value, note, tone }) {
  return (
    <div className={`m-tile${tone ? ` m-tile-${tone}` : ''}`}>
      <span className="m-tile-head"><Icon size={14} /> {label}</span>
      <strong className="m-tile-value">{value}</strong>
      {note && <span className="m-tile-note">{note}</span>}
    </div>
  );
}

/** Nothing to show, or nothing reachable. */
export function EmptyState({ icon: Icon, title, detail, action }) {
  return (
    <div className="m-empty">
      {Icon && <Icon size={32} />}
      <strong>{title}</strong>
      {detail && <p>{detail}</p>}
      {action && (
        <button type="button" className="m-btn" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

/** A segmented control — the mobile stand-in for a row of tabs. */
export function Segmented({ options, value, onChange }) {
  return (
    <div className="m-segmented" role="tablist">
      {options.map((opt) => (
        <button key={opt.value} type="button" role="tab"
                aria-selected={value === opt.value}
                className={value === opt.value ? 'is-active' : ''}
                onClick={() => onChange(opt.value)}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
