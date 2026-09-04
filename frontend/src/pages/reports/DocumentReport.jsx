import { useState, useEffect, useCallback } from 'react';
import { FileText, Wallet, Percent, Package } from 'lucide-react';
import ReportShell, { ReportTable } from '../../components/ReportShell';
import { reportsApi } from '../../api';
import { useCurrency } from '../../context/CurrencyContext';

/**
 * Sales and Purchase reports — the same shape pointed at either module.
 *
 * The document type is a filter rather than a fixed value: an invoice report
 * measures revenue, but you may want to look at orders in hand or deliveries
 * made. Counting them all together would report the same trade several times,
 * so exactly one type is summarised at a time.
 */
export default function DocumentReport({ config }) {
  const { title, subtitle, fetcher, docTypes, partyLabel } = config;

  const [report, setReport] = useState(null);
  const [docType, setDocType] = useState('INVOICE');
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
      const params = new URLSearchParams({ doc_type: docType });
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      setReport(await fetcher(`?${params}`));
    } catch (err) {
      setError(err.message);
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetcher, docType, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const filters = (
    <>
      <label>
        Document Type
        <select className="config-input" value={docType}
                onChange={e => setDocType(e.target.value)}>
          {docTypes.map(t => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </label>
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
    { label: 'Documents', icon: FileText, color: '#8b5cf6', value: report.document_count },
    { label: 'Subtotal', icon: Wallet, color: '#38bdf8', value: money(report.subtotal) },
    { label: 'Tax', icon: Percent, color: '#f59e0b', value: money(report.tax_total) },
    { label: 'Grand Total', icon: Wallet, color: '#10b981', value: money(report.grand_total) }
  ] : [];

  const breakdownRow = (r, showQty = false) => (
    <tr key={r.key}>
      <td style={{ fontWeight: 600 }}>{r.label}</td>
      {showQty
        ? <td style={{ textAlign: 'right' }} className="text-muted-small">{r.quantity}</td>
        : <td style={{ textAlign: 'right' }} className="text-muted-small">{r.count}</td>}
      <td style={{ textAlign: 'right' }} className="text-muted-small">{money(r.subtotal)}</td>
      <td style={{ textAlign: 'right' }} className="text-muted-small">{money(r.tax)}</td>
      <td style={{ textAlign: 'right' }}><span className="price-tag">{money(r.total)}</span></td>
    </tr>
  );

  const headers = (firstLabel, secondLabel) => [
    { label: firstLabel },
    { label: secondLabel, align: 'right' },
    { label: 'Subtotal', align: 'right' },
    { label: 'Tax', align: 'right' },
    { label: 'Total', align: 'right' }
  ];

  const grandFooter = report ? (
    <tr className="report-grand-row">
      <td colSpan="2">Total</td>
      <td style={{ textAlign: 'right' }}>{money(report.subtotal)}</td>
      <td style={{ textAlign: 'right' }}>{money(report.tax_total)}</td>
      <td style={{ textAlign: 'right' }}>{money(report.grand_total)}</td>
    </tr>
  ) : null;

  return (
    <ReportShell title={title} subtitle={subtitle} filters={filters} cards={cards}
                 isLoading={isLoading} error={error} onRefresh={load}>
      {isLoading || !report ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          Loading...
        </div>
      ) : (
        <>
          <ReportTable title={`By ${partyLabel}`} headers={headers(partyLabel, 'Docs')}
                       isEmpty={report.by_party.length === 0}
                       empty={`No ${docType.toLowerCase().replace(/_/g, ' ')} documents in this period.`}
                       footer={report.by_party.length > 0 ? grandFooter : null}>
            {report.by_party.map(r => breakdownRow(r))}
          </ReportTable>

          <ReportTable title="By Product" headers={headers('Product', 'Qty')}
                       isEmpty={report.by_product.length === 0}>
            {report.by_product.map(r => breakdownRow(r, true))}
          </ReportTable>

          <ReportTable title="By Month" headers={headers('Period', 'Docs')}
                       isEmpty={report.by_period.length === 0}>
            {report.by_period.map(r => breakdownRow(r))}
          </ReportTable>

          <ReportTable title="By Status" headers={headers('Status', 'Docs')}
                       isEmpty={report.by_status.length === 0}>
            {report.by_status.map(r => breakdownRow(r))}
          </ReportTable>
        </>
      )}
    </ReportShell>
  );
}

export { Package };
