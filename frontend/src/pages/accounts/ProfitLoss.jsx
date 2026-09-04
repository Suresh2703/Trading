import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Calculator, RefreshCw } from 'lucide-react';
import { accountingReports } from '../../api';
import { useCurrency } from '../../context/CurrencyContext';
import '../../components/MasterPage.css';
import '../../components/VoucherPage.css';

export default function ProfitLoss() {
  const [report, setReport] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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
      setReport(await accountingReports.profitLoss(query ? `?${query}` : ''));
    } catch (err) {
      setError(err.message);
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const profitable = (report?.net_profit || 0) >= 0;

  const renderSection = (section, label) => ([
    <tr className="report-section-title" key={`${label}-title`}>
      <td colSpan="3">{section.title}</td>
    </tr>,
    ...(section.rows.length === 0
      ? [<tr key={`${label}-empty`}>
          <td colSpan="3" className="text-muted-small" style={{ textAlign: 'center' }}>
            Nothing posted to {section.title.toLowerCase()} in this period.
          </td>
        </tr>]
      : section.rows.map(r => (
          <tr key={`${label}-${r.account_id}`}>
            <td style={{ fontWeight: 600 }}>{r.code}</td>
            <td>{r.name}</td>
            <td style={{ textAlign: 'right' }} className="text-muted-small">
              {money(r.credit || r.debit)}
            </td>
          </tr>
        ))),
    <tr className="report-total-row" key={`${label}-total`}>
      <td colSpan="2">Total {section.title}</td>
      <td style={{ textAlign: 'right' }}>{money(section.total)}</td>
    </tr>
  ]);

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="products-header">
        <div className="page-title">
          <h1>Profit &amp; Loss</h1>
          <p>Income less expenses for the period. Opening balances are excluded — they belong to earlier periods.</p>
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

      {report && (
        <div className="summary-cards">
          <div className="summary-card glass-panel">
            <div className="summary-icon" style={{ background: '#10b98133', color: '#10b981' }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <div className="text-muted-small">Total Income</div>
              <div className="big-number" style={{ fontSize: '1.4rem' }}>{money(report.income.total)}</div>
            </div>
          </div>
          <div className="summary-card glass-panel">
            <div className="summary-icon" style={{ background: '#f8717133', color: '#f87171' }}>
              <TrendingDown size={24} />
            </div>
            <div>
              <div className="text-muted-small">Total Expenses</div>
              <div className="big-number" style={{ fontSize: '1.4rem' }}>{money(report.expenses.total)}</div>
            </div>
          </div>
          <div className="summary-card glass-panel">
            <div className="summary-icon"
                 style={{ background: (profitable ? '#10b981' : '#f87171') + '33',
                          color: profitable ? '#10b981' : '#f87171' }}>
              <Calculator size={24} />
            </div>
            <div>
              <div className="text-muted-small">{profitable ? 'Net Profit' : 'Net Loss'}</div>
              <div className="big-number"
                   style={{ fontSize: '1.4rem', color: profitable ? '#10b981' : '#f87171' }}>
                {money(Math.abs(report.net_profit))}
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
                  {renderSection(report.income, 'income')}
                  {renderSection(report.expenses, 'expenses')}
                  <tr className="report-grand-row">
                    <td colSpan="2">{profitable ? 'Net Profit' : 'Net Loss'}</td>
                    <td style={{ textAlign: 'right', color: profitable ? '#10b981' : '#f87171' }}>
                      {money(Math.abs(report.net_profit))}
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
