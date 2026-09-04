import { useState, useEffect, useCallback } from 'react';
import { Landmark, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import { accountingReports } from '../../api';
import { useCurrency } from '../../context/CurrencyContext';
import '../../components/MasterPage.css';
import '../../components/VoucherPage.css';

export default function BalanceSheet() {
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
      setReport(await accountingReports.balanceSheet(asOf ? `?as_of=${asOf}` : ''));
    } catch (err) {
      setError(err.message);
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [asOf]);

  useEffect(() => { load(); }, [load]);

  const renderSection = (section, key, extraRow = null) => ([
    <tr className="report-section-title" key={`${key}-title`}>
      <td colSpan="3">{section.title}</td>
    </tr>,
    ...(section.rows.length === 0 && !extraRow
      ? [<tr key={`${key}-empty`}>
          <td colSpan="3" className="text-muted-small" style={{ textAlign: 'center' }}>
            Nothing here yet.
          </td>
        </tr>]
      : section.rows.map(r => (
          <tr key={`${key}-${r.account_id}`}>
            <td style={{ fontWeight: 600 }}>{r.code}</td>
            <td>{r.name}</td>
            <td style={{ textAlign: 'right' }} className="text-muted-small">
              {money(r.debit || r.credit)}
            </td>
          </tr>
        ))),
    ...(extraRow ? [extraRow] : []),
    <tr className="report-total-row" key={`${key}-total`}>
      <td colSpan="2">Total {section.title}</td>
      <td style={{ textAlign: 'right' }}>
        {money(section.total + (key === 'equity' ? report.net_profit : 0))}
      </td>
    </tr>
  ]);

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="products-header">
        <div className="page-title">
          <h1>Balance Sheet</h1>
          <p>Assets against liabilities and equity. Profit for the period is carried into equity.</p>
        </div>
        <div className="report-controls">
          <label>As of
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
              <Landmark size={24} />
            </div>
            <div>
              <div className="text-muted-small">Total Assets</div>
              <div className="big-number" style={{ fontSize: '1.4rem' }}>{money(report.total_assets)}</div>
            </div>
          </div>
          <div className="summary-card glass-panel">
            <div className="summary-icon" style={{ background: '#f59e0b33', color: '#f59e0b' }}>
              <Landmark size={24} />
            </div>
            <div>
              <div className="text-muted-small">Liabilities + Equity</div>
              <div className="big-number" style={{ fontSize: '1.4rem' }}>
                {money(report.total_liabilities_and_equity)}
              </div>
            </div>
          </div>
          <div className="summary-card glass-panel">
            <div className="summary-icon" style={{ background: '#8b5cf633', color: '#8b5cf6' }}>
              <Landmark size={24} />
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
                <th style={{ width: '100px' }}>Code</th>
                <th>Account</th>
                <th style={{ textAlign: 'right', width: '180px' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr><td colSpan="3" style={{ textAlign: 'center', color: '#f87171' }}>{error}</td></tr>
              ) : isLoading ? (
                <tr><td colSpan="3" style={{ textAlign: 'center' }}>Loading...</td></tr>
              ) : !report ? null : (
                <>
                  {renderSection(report.assets, 'assets')}
                  {renderSection(report.liabilities, 'liabilities')}
                  {renderSection(report.equity, 'equity', (
                    <tr key="equity-profit">
                      <td style={{ fontWeight: 600 }}>—</td>
                      <td>Profit for the period</td>
                      <td style={{ textAlign: 'right' }} className="text-muted-small">
                        {money(report.net_profit)}
                      </td>
                    </tr>
                  ))}
                  <tr className="report-grand-row">
                    <td colSpan="2">Total Liabilities &amp; Equity</td>
                    <td style={{ textAlign: 'right' }}>
                      {money(report.total_liabilities_and_equity)}
                    </td>
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
