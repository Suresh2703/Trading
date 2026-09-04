import { useState, useEffect, useCallback } from 'react';
import { BookOpen, RefreshCw } from 'lucide-react';
import { journalEntriesApi } from '../../api';
import { useCurrency } from '../../context/CurrencyContext';
import '../../components/MasterPage.css';
import '../../components/DocumentPage.css';
import '../../components/VoucherPage.css';

const today = () => new Date().toISOString().slice(0, 10);
const api = journalEntriesApi(null);

/**
 * Every voucher in a date range, whatever its type — the daily register.
 * Expanding a row shows the individual debit and credit postings.
 */
export default function DayBook() {
  const [rows, setRows] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState(today());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  const { symbol } = useCurrency();
  const money = v => `${symbol}${Number(v || 0).toFixed(2)}`;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const query = params.toString();
      setRows(await api.listRange(query ? `?${query}` : ''));
    } catch (err) {
      setError(err.message);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const total = rows.filter(r => r.status !== 'CANCELLED')
                    .reduce((a, r) => a + (r.total_debit || 0), 0);

  const statusClass = s =>
    s === 'POSTED' ? 'doc-status confirmed'
      : s === 'CANCELLED' ? 'doc-status cancelled' : 'doc-status draft';

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="products-header">
        <div className="page-title">
          <h1>Day Book</h1>
          <p>Every voucher posted in the period, in date order.</p>
        </div>
        <div className="report-controls">
          <label>From
            <input type="date" className="config-input" value={dateFrom}
                   onChange={e => setDateFrom(e.target.value)} />
          </label>
          <label>To
            <input type="date" className="config-input" value={dateTo}
                   onChange={e => setDateTo(e.target.value)} />
          </label>
          <button className="btn-primary"
                  style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                  onClick={load} disabled={isLoading}>
            <RefreshCw size={16} /> {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="summary-cards">
        <div className="summary-card glass-panel">
          <div className="summary-icon" style={{ background: '#8b5cf633', color: '#8b5cf6' }}>
            <BookOpen size={24} />
          </div>
          <div>
            <div className="text-muted-small">Vouchers</div>
            <div className="big-number" style={{ fontSize: '1.5rem' }}>{rows.length}</div>
          </div>
        </div>
        <div className="summary-card glass-panel">
          <div className="summary-icon" style={{ background: '#10b98133', color: '#10b981' }}>
            <BookOpen size={24} />
          </div>
          <div>
            <div className="text-muted-small">Total Posted</div>
            <div className="big-number" style={{ fontSize: '1.5rem' }}>{money(total)}</div>
          </div>
        </div>
      </div>

      <div className="glass-panel">
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '32px' }}></th>
                <th>Date</th>
                <th>Voucher</th>
                <th>Type</th>
                <th>Narration</th>
                <th>Party</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', color: '#f87171' }}>{error}</td></tr>
              ) : isLoading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center' }}>Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center' }}>
                  No vouchers in this period.
                </td></tr>
              ) : rows.map(r => {
                const open = expanded[r.id];
                return [
                  <tr key={r.id}>
                    <td>
                      <button className="action-btn edit pnl-expand"
                              title={open ? 'Hide postings' : 'Show postings'}
                              onClick={() => setExpanded({ ...expanded, [r.id]: !open })}>
                        {open ? '−' : '+'}
                      </button>
                    </td>
                    <td className="text-muted-small">{r.entry_date}</td>
                    <td style={{ fontWeight: 600 }}>{r.entry_no}</td>
                    <td><span className="master-badge muted">{r.entry_type}</span></td>
                    <td className="master-truncate text-muted-small" title={r.narration || ''}>
                      {r.narration || '-'}
                    </td>
                    <td className="text-muted-small">{r.party_name || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="price-tag">{money(r.total_debit)}</span>
                    </td>
                    <td><span className={statusClass(r.status)}>{r.status}</span></td>
                  </tr>,
                  open && (
                    <tr key={`${r.id}-lines`} className="pnl-lots-row">
                      <td></td>
                      <td colSpan="7">
                        <table className="data-table" style={{ margin: 0 }}>
                          <tbody>
                            {r.lines.map(l => (
                              <tr key={l.id}>
                                <td style={{ width: '40%' }}>
                                  {l.account
                                    ? `${l.account.code} — ${l.account.name}`
                                    : `#${l.account_id}`}
                                </td>
                                <td className="text-muted-small">{l.line_narration || ''}</td>
                                <td style={{ textAlign: 'right', width: '15%' }}
                                    className="text-muted-small">
                                  {l.debit ? `Dr ${money(l.debit)}` : ''}
                                </td>
                                <td style={{ textAlign: 'right', width: '15%' }}
                                    className="text-muted-small">
                                  {l.credit ? `Cr ${money(l.credit)}` : ''}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )
                ];
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
