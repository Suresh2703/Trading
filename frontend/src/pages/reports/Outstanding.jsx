import { useState, useEffect, useCallback } from 'react';
import { HandCoins, CreditCard, Scale } from 'lucide-react';
import ReportShell, { ReportTable } from '../../components/ReportShell';
import { reportsApi } from '../../api';
import { useCurrency } from '../../context/CurrencyContext';

/** Receivables and payables side by side, with the net cash position. */
export default function Outstanding() {
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
      setReport(await reportsApi.outstanding(asOf ? `?as_of=${asOf}` : ''));
    } catch (err) {
      setError(err.message);
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [asOf]);

  useEffect(() => { load(); }, [load]);

  const positive = (report?.net_position || 0) >= 0;

  const filters = (
    <label>As of
      <input type="date" className="config-input" value={asOf}
             onChange={e => setAsOf(e.target.value)} />
    </label>
  );

  const cards = report ? [
    {
      label: 'Total Receivable', icon: HandCoins, color: '#10b981',
      value: money(report.total_receivable), hint: 'Owed to you by customers'
    },
    {
      label: 'Total Payable', icon: CreditCard, color: '#f87171',
      value: money(report.total_payable), hint: 'Owed by you to suppliers'
    },
    {
      label: positive ? 'Net Receivable' : 'Net Payable',
      icon: Scale, color: positive ? '#10b981' : '#f87171',
      value: money(Math.abs(report.net_position)),
      hint: 'Receivables less payables'
    }
  ] : [];

  const partyTable = (rows, title, label, total, emptyText) => (
    <ReportTable
      title={title}
      headers={[
        { label },
        { label: 'Debit', align: 'right' },
        { label: 'Credit', align: 'right' },
        { label: 'Outstanding', align: 'right' }
      ]}
      isEmpty={rows.length === 0}
      empty={emptyText}
      footer={rows.length > 0 ? (
        <tr className="report-grand-row">
          <td colSpan="3">Total</td>
          <td style={{ textAlign: 'right' }}>{money(total)}</td>
        </tr>
      ) : null}
    >
      {rows.map((r, i) => (
        <tr key={i}>
          <td>
            <div style={{ fontWeight: 600 }}>{r.party_name}</div>
            <div className="text-muted-small">{r.party_type}</div>
          </td>
          <td style={{ textAlign: 'right' }} className="text-muted-small">{money(r.debit)}</td>
          <td style={{ textAlign: 'right' }} className="text-muted-small">{money(r.credit)}</td>
          <td style={{ textAlign: 'right' }}>
            <span style={{ fontWeight: 700, color: r.balance >= 0 ? '#10b981' : '#f87171' }}>
              {money(r.balance)}
            </span>
          </td>
        </tr>
      ))}
    </ReportTable>
  );

  return (
    <ReportShell title="Outstanding"
                 subtitle="What is still owed to you and by you, from the receivable and payable control accounts."
                 filters={filters} cards={cards}
                 isLoading={isLoading} error={error} onRefresh={load}>
      {isLoading || !report ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
      ) : (
        <>
          {partyTable(report.receivables, 'Receivables — owed to you', 'Customer',
                      report.total_receivable,
                      'Nothing outstanding from customers.')}
          {partyTable(report.payables, 'Payables — owed by you', 'Supplier',
                      report.total_payable,
                      'Nothing outstanding to suppliers.')}
        </>
      )}
    </ReportShell>
  );
}
