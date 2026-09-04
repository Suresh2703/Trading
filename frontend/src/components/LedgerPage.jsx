import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { chartOfAccountsApi, accountingReports } from '../api';
import { useCurrency } from '../context/CurrencyContext';
import './MasterPage.css';
import './VoucherPage.css';

/**
 * One account's ledger with a running balance.
 *
 * Cash, Bank and Tax are this same screen with the account picker restricted to
 * a group, so those pages are a config away rather than three near-copies.
 */
export default function LedgerPage({ config }) {
  const { title, subtitle, icon: Icon, group = null } = config;

  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const { symbol } = useCurrency();
  const money = v => `${symbol}${Number(v || 0).toFixed(2)}`;

  useEffect(() => {
    chartOfAccountsApi.list(group ? `?account_group=${group}` : '')
      .then(list => {
        setAccounts(list);
        // Land on a usable account rather than an empty screen.
        if (list.length > 0) setAccountId(String(list[0].id));
      })
      .catch(err => setError(err.message));
  }, [group]);

  const load = useCallback(async () => {
    if (!accountId) { setReport(null); return; }
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ account_id: accountId });
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      setReport(await accountingReports.ledger(`?${params}`));
    } catch (err) {
      setError(err.message);
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [accountId, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const cards = report ? [
    { label: 'Opening Balance', value: money(report.opening_balance), color: '#8b5cf6' },
    { label: 'Total Debit', value: money(report.total_debit), color: '#10b981' },
    { label: 'Total Credit', value: money(report.total_credit), color: '#f59e0b' },
    { label: 'Closing Balance', value: money(report.closing_balance), color: '#38bdf8' }
  ] : [];

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="products-header">
        <div className="page-title">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="report-controls">
          <label>
            Account
            <select className="config-input ledger-picker" value={accountId}
                    onChange={e => setAccountId(e.target.value)}>
              {accounts.length === 0 && <option value="">No accounts in this group</option>}
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </label>
          <label>
            From
            <input type="date" className="config-input" value={dateFrom}
                   onChange={e => setDateFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" className="config-input" value={dateTo}
                   onChange={e => setDateTo(e.target.value)} />
          </label>
          <button className="btn-primary"
                  style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                  onClick={load} disabled={isLoading || !accountId}>
            <RefreshCw size={16} /> {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {report && (
        <div className="summary-cards">
          {cards.map((c, i) => (
            <div className="summary-card glass-panel" key={i}>
              <div className="summary-icon" style={{ background: c.color + '33', color: c.color }}>
                <Icon size={24} />
              </div>
              <div>
                <div className="text-muted-small">{c.label}</div>
                <div className="big-number" style={{ fontSize: '1.35rem' }}>{c.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="glass-panel">
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Voucher</th>
                <th>Particulars</th>
                <th>Narration</th>
                <th style={{ textAlign: 'right' }}>Debit</th>
                <th style={{ textAlign: 'right' }}>Credit</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', color: '#f87171' }}>
                  <AlertTriangle size={14} /> {error}
                </td></tr>
              ) : isLoading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center' }}>Loading...</td></tr>
              ) : !report ? (
                <tr><td colSpan="7" style={{ textAlign: 'center' }}>Pick an account to view its ledger.</td></tr>
              ) : (
                <>
                  <tr className="report-section-title">
                    <td colSpan="6">Opening Balance</td>
                    <td style={{ textAlign: 'right' }}>{money(report.opening_balance)}</td>
                  </tr>
                  {report.lines.length === 0 ? (
                    <tr><td colSpan="7" style={{ textAlign: 'center' }}>
                      No movements on this account in the selected period.
                    </td></tr>
                  ) : report.lines.map((l, i) => (
                    <tr key={`${l.entry_id}-${i}`}>
                      <td className="text-muted-small">{l.entry_date}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{l.entry_no}</div>
                        <div className="text-muted-small">{l.entry_type}</div>
                      </td>
                      <td className="master-truncate text-muted-small" title={l.contra_accounts}>
                        {l.contra_accounts || '-'}
                      </td>
                      <td className="master-truncate text-muted-small" title={l.narration || ''}>
                        {l.narration || '-'}
                      </td>
                      <td style={{ textAlign: 'right' }} className="text-muted-small">
                        {l.debit ? money(l.debit) : '-'}
                      </td>
                      <td style={{ textAlign: 'right' }} className="text-muted-small">
                        {l.credit ? money(l.credit) : '-'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="price-tag">{money(l.running_balance)}</span>
                      </td>
                    </tr>
                  ))}
                  <tr className="report-total-row">
                    <td colSpan="4">Closing Balance</td>
                    <td style={{ textAlign: 'right' }}>{money(report.total_debit)}</td>
                    <td style={{ textAlign: 'right' }}>{money(report.total_credit)}</td>
                    <td style={{ textAlign: 'right' }}>{money(report.closing_balance)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
