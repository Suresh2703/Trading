import { useRef } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import ExportMenu from './ExportMenu';
import './MasterPage.css';
import './VoucherPage.css';

/**
 * Chrome shared by every report page: title, filter bar, summary cards and the
 * loading / error / empty states. Each report supplies its own filters and body
 * so the pages stay about their numbers rather than their scaffolding.
 */
export default function ReportShell({
  title, subtitle, filters, cards = [], isLoading, error, onRefresh, children
}) {
  const reportRef = useRef(null);

  return (
    <div style={{ paddingBottom: '2rem' }} ref={reportRef}>
      <div className="products-header">
        <div className="page-title">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="report-controls">
          {filters}
          <ExportMenu containerRef={reportRef} title={title} subtitle={subtitle}
                      disabled={isLoading || Boolean(error)} />
          <button className="btn-primary"
                  style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                  onClick={onRefresh} disabled={isLoading}>
            <RefreshCw size={16} /> {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {cards.length > 0 && (
        <div className="summary-cards">
          {cards.map((card, i) => (
            <div className="summary-card glass-panel" key={i}>
              <div className="summary-icon"
                   style={{ background: card.color + '33', color: card.color }}>
                <card.icon size={24} />
              </div>
              <div>
                <div className="text-muted-small">{card.label}</div>
                <div className="big-number"
                     style={{ fontSize: '1.35rem', color: card.valueColor }}>
                  {card.value}
                </div>
                {card.hint && <div className="text-muted-small pnl-hint">{card.hint}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {error ? (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div className="master-error"><AlertTriangle size={16} /> {error}</div>
        </div>
      ) : children}
    </div>
  );
}

/** A titled table block — reports are mostly stacks of these. */
export function ReportTable({ title, headers, children, empty = 'Nothing to show.',
                              isEmpty = false, footer = null }) {
  return (
    <div className="glass-panel" style={{ marginBottom: '1.25rem' }}>
      {title && (
        <div style={{ padding: '1rem 1.25rem 0' }}>
          <h3 style={{ fontSize: '0.95rem', margin: 0 }}>{title}</h3>
        </div>
      )}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} style={h.align ? { textAlign: h.align } : undefined}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isEmpty ? (
              <tr>
                <td colSpan={headers.length} style={{ textAlign: 'center' }}>{empty}</td>
              </tr>
            ) : children}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
    </div>
  );
}
