import { useState, useEffect, useCallback } from 'react';
import { Package, Warehouse, Wallet } from 'lucide-react';
import ReportShell, { ReportTable } from '../../components/ReportShell';
import { reportsApi, warehousesApi } from '../../api';
import { useCurrency } from '../../context/CurrencyContext';

export default function StockReport() {
  const [report, setReport] = useState(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouses, setWarehouses] = useState([]);
  const [includeZero, setIncludeZero] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const { symbol } = useCurrency();
  const money = v => `${symbol}${Number(v || 0).toFixed(2)}`;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (warehouseId) params.set('warehouse_id', warehouseId);
      if (includeZero) params.set('include_zero', 'true');
      const query = params.toString();
      setReport(await reportsApi.stock(query ? `?${query}` : ''));
    } catch (err) {
      setError(err.message);
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [warehouseId, includeZero]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    warehousesApi.list().then(setWarehouses).catch(() => setWarehouses([]));
  }, []);

  const rows = report?.rows || [];

  const filters = (
    <>
      <label>
        Warehouse
        <select className="config-input" value={warehouseId}
                onChange={e => setWarehouseId(e.target.value)}>
          <option value="">All warehouses</option>
          {warehouses.map(w => (
            <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
          ))}
        </select>
      </label>
      <label className="master-checkbox" style={{ height: 'auto', marginBottom: '0.35rem' }}>
        <input type="checkbox" checked={includeZero}
               onChange={e => setIncludeZero(e.target.checked)} />
        <span>Include zero balances</span>
      </label>
    </>
  );

  const cards = report ? [
    { label: 'Stock Lines', icon: Package, color: '#8b5cf6', value: rows.length },
    {
      label: 'Warehouses', icon: Warehouse, color: '#f59e0b',
      value: new Set(rows.map(r => r.warehouse_id)).size
    },
    { label: 'Total Quantity', icon: Package, color: '#38bdf8', value: report.total_closing_qty },
    { label: 'Stock Value', icon: Wallet, color: '#10b981', value: money(report.total_stock_value) }
  ] : [];

  return (
    <ReportShell title="Stock Report"
                 subtitle="Closing stock by product and location, with its value."
                 filters={filters} cards={cards}
                 isLoading={isLoading} error={error} onRefresh={load}>
      {isLoading ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
      ) : (
        <ReportTable
          headers={[
            { label: 'Product' },
            { label: 'Warehouse' },
            { label: 'Opening', align: 'right' },
            { label: 'In', align: 'right' },
            { label: 'Out', align: 'right' },
            { label: 'Closing', align: 'right' },
            { label: 'Avg Cost', align: 'right' },
            { label: 'Value', align: 'right' }
          ]}
          isEmpty={rows.length === 0}
          empty="No stock on hand. Record opening stock or a goods receipt."
          footer={rows.length > 0 ? (
            <tr className="report-grand-row">
              <td colSpan="5">Total</td>
              <td style={{ textAlign: 'right' }}>{report.total_closing_qty}</td>
              <td></td>
              <td style={{ textAlign: 'right' }}>{money(report.total_stock_value)}</td>
            </tr>
          ) : null}
        >
          {rows.map((r, i) => (
            <tr key={`${r.product_id}-${r.warehouse_id}-${i}`}>
              <td>
                <div style={{ fontWeight: 600 }}>{r.ticker}</div>
                <div className="text-muted-small">{r.product_name}</div>
              </td>
              <td><span className="master-badge">{r.warehouse_name}</span></td>
              <td style={{ textAlign: 'right' }} className="text-muted-small">{r.opening_qty}</td>
              <td style={{ textAlign: 'right', color: '#10b981' }}>+{r.in_qty}</td>
              <td style={{ textAlign: 'right', color: '#f87171' }}>−{r.out_qty}</td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                {r.closing_qty}
                <span className="text-muted-small"> {r.unit || ''}</span>
              </td>
              <td style={{ textAlign: 'right' }} className="text-muted-small">{money(r.avg_cost)}</td>
              <td style={{ textAlign: 'right' }}><span className="price-tag">{money(r.stock_value)}</span></td>
            </tr>
          ))}
        </ReportTable>
      )}
    </ReportShell>
  );
}
