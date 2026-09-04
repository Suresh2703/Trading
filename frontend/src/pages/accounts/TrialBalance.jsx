import { useState, useEffect, useCallback } from 'react';
import { Scale, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import { accountingReports } from '../../api';
import { useCurrency } from '../../context/CurrencyContext';
import '../../components/MasterPage.css';
import '../../components/VoucherPage.css';

export default function TrialBalance() {
  const [report, setReport] = useState(null);
  const [asOf, setAsOf] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const { symbol } = useCurrency();
  const money = v => `${symbol}${Number(v || 0).toFixed(2)}`;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setReport(await accountingReports.trialBalance(asOf ? `?as_of=${asOf}` : ''));
    } catch (err) {
      setError(err.message);
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [asOf]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="products-header">
        <div className="page-title">
          <h1>Trial Balance</h1>
          <p>Every account with a balance, proving the books add up.</p>
        </div>
        <div className="report-controls">
          <label>
            As of
            <input type="date" className="config-input" value={asOf}
                   onChange={e => setAsOf(e.target.value)} />
          </label>
          <button className="btn-primary"
                  style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                  onClick={load} disabled={isLoading}>
            <RefreshCw size={16} /> {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {report && (
        <div className="summary-cards">
          <div className="summary-card glass-panel">
            <div className="summary-icon" style={{ background: '#10b98133', color: '#10b981' }}>
              <Scale size={24} />
            </div>
            <div>
              <div className="text-muted-small">Total Debit</div>
              <div className="big-number" style={{ fontSize: '1.4rem' }}>{money(report.total_debit)}</div>
            </div>
          </div>
          <div className="summary-card glass-panel">
            <div className="summary-icon" style={{ background: '#f59e0b33', color: '#f59e0b' }}>
              <Scale size={24} />
            </div>
            <div>
              <div className="text-muted-small">Total Credit</div>
              <div className="big-number" style={{ fontSize: '1.4rem' }}>{money(report.total_credit)}</div>
            </div>
          </div>
          <div className="summary-card glass-panel">
            <div className="summary-icon" style={{ background: '#8b5cf633', color: '#8b5cf6' }}>
              <Scale size={24} />
            </div>
            <div>
              <div className="text-muted-small">Status</div>
              <div style={{ marginTop: '0.35rem' }}>
                <span className={report.is_balanced ? 'report-balanced' : 'report-balanced off'}>
                  {report.is_balanced ? <><Check size={13} /> Balanced</>
                    : <><AlertTriangle size={13} /> Out of balance</>}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel">
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Debit</th>
                <th style={{ textAlign: 'right' }}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', color: '#f87171' }}>{error}</td></tr>
              ) : isLoading ? (
                <tr><td colSpan="5" style={{ textAlign: 'center' }}>Loading...</td></tr>
              ) : !report || report.rows.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center' }}>
                  No account has a balance yet. Post a journal entry to begin.
                </td></tr>
              ) : report.rows.map(r => (
                <tr key={r.account_id}>
                  <td style={{ fontWeight: 600 }}>{r.code}</td>
                  <td>{r.name}</td>
                  <td><span className="master-badge muted">{r.account_type}</span></td>
                  <td style={{ textAlign: 'right' }} className="text-muted-small">
                    {r.debit ? money(r.debit) : '-'}
                  </td>
                  <td style={{ textAlign: 'right' }} className="text-muted-small">
                    {r.credit ? money(r.credit) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            {report && report.rows.length > 0 && (
              <tfoot>
                <tr className="report-grand-row">
                  <td colSpan="3">Total</td>
                  <td style={{ textAlign: 'right' }}>{money(report.total_debit)}</td>
                  <td style={{ textAlign: 'right' }}>{money(report.total_credit)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
