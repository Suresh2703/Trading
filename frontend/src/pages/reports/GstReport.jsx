import { useState, useEffect, useCallback } from 'react';
import { Percent, ArrowUpFromLine, ArrowDownToLine, Scale } from 'lucide-react';
import ReportShell, { ReportTable } from '../../components/ReportShell';
import { reportsApi } from '../../api';
import { useCurrency } from '../../context/CurrencyContext';

/**
 * Output tax charged on sales against input tax paid on purchases.
 * The difference is what is owed to — or reclaimable from — the authority.
 */
export default function GstReport() {
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
      setReport(await reportsApi.gst(query ? `?${query}` : ''));
    } catch (err) {
      setError(err.message);
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const payable = (report?.net_payable || 0) >= 0;

  const filters = (
    <>
      <label>From
        <input type="date" className="config-input" value={dateFrom}
               onChange={e => setDateFrom(e.target.value)} />
      </label>
      <label>To
        <input type="date" className="config-input" value={dateTo}
               onChange={e => setDateTo(e.target.value)} />
      </label>
    </>
  );

  const cards = report ? [
    {
      label: 'Output Tax', icon: ArrowUpFromLine, color: '#10b981',
      value: money(report.output_tax), hint: 'Charged on sales invoices'
    },
    {
      label: 'Input Tax', icon: ArrowDownToLine, color: '#38bdf8',
      value: money(report.input_tax), hint: 'Paid on purchase invoices'
    },
    {
      label: payable ? 'Net Payable' : 'Net Reclaimable',
      icon: Scale, color: payable ? '#f59e0b' : '#10b981',
      value: money(Math.abs(report.net_payable)),
      hint: 'Output tax less input tax'
    }
  ] : [];

  const rateTable = (rows, title, taxableTotal, taxTotal, emptyText) => (
    <ReportTable
      title={title}
      headers={[
        { label: 'Tax Rate' },
        { label: 'Rate %', align: 'right' },
        { label: 'Taxable Value', align: 'right' },
        { label: 'Tax Amount', align: 'right' }
      ]}
      isEmpty={rows.length === 0}
      empty={emptyText}
      footer={rows.length > 0 ? (
        <tr className="report-grand-row">
          <td colSpan="2">Total</td>
          <td style={{ textAlign: 'right' }}>{money(taxableTotal)}</td>
          <td style={{ textAlign: 'right' }}>{money(taxTotal)}</td>
        </tr>
      ) : null}
    >
      {rows.map(r => (
        <tr key={r.tax_name}>
          <td style={{ fontWeight: 600 }}>{r.tax_name}</td>
          <td style={{ textAlign: 'right' }} className="text-muted-small">
            {Number(r.rate).toFixed(2)}%
          </td>
          <td style={{ textAlign: 'right' }} className="text-muted-small">
            {money(r.taxable_value)}
          </td>
          <td style={{ textAlign: 'right' }}>
            <span className="price-tag">{money(r.tax_amount)}</span>
          </td>
        </tr>
      ))}
    </ReportTable>
  );

  return (
    <ReportShell title="GST / Tax Report"
                 subtitle="Tax charged on sales invoices against tax paid on purchase invoices."
                 filters={filters} cards={cards}
                 isLoading={isLoading} error={error} onRefresh={load}>
      {isLoading || !report ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
      ) : (
        <>
          {rateTable(report.output_rows, 'Output Tax — Sales',
                     report.output_taxable, report.output_tax,
                     'No sales invoices with tax in this period.')}
          {rateTable(report.input_rows, 'Input Tax — Purchases',
                     report.input_taxable, report.input_tax,
                     'No purchase invoices with tax in this period.')}

          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div className={payable ? 'voucher-balance' : 'voucher-balance balanced'}>
              <div className="voucher-balance-figures">
                <div><span>Output Tax</span><strong>{money(report.output_tax)}</strong></div>
                <div><span>Input Tax</span><strong>{money(report.input_tax)}</strong></div>
              </div>
              <div className="voucher-balance-state">
                {payable
                  ? <>Net payable {money(report.net_payable)}</>
                  : <>Net reclaimable {money(Math.abs(report.net_payable))}</>}
              </div>
            </div>
          </div>
        </>
      )}
    </ReportShell>
  );
}
