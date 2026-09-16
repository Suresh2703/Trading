import { useState } from 'react';
import { AlertTriangle, Package, TrendingUp, Users } from 'lucide-react';

import { useCurrency } from '../context/CurrencyContext';
import { reportsApi } from '../api';
import { useLiveData } from './useLiveData';
import { money, number } from './format';
import { EmptyState, Freshness, Screen, Segmented } from './parts';

const VIEWS = [
  { value: 'sales', label: 'Sales' },
  { value: 'stock', label: 'Stock' },
  { value: 'outstanding', label: 'Outstanding' }
];

/**
 * The three reports worth reading on a phone.
 *
 * Each is reduced to a ranked list — the question a phone gets asked is "who
 * owes most" or "what is running out", not "show me every line". The full
 * breakdowns stay on the desktop screens, which is what the link at the
 * bottom of each list is for.
 */
export default function Reports() {
  const [view, setView] = useState('sales');
  const { symbol } = useCurrency();

  // Keyed on `view`, so switching tab refetches rather than showing the
  // previous report's rows under the new heading.
  const { data, error, loading, updatedAt, stale, reload } =
    useLiveData(() => reportsApi[view](), [view]);

  return (
    <Screen title="Reports"
            action={<Freshness at={updatedAt} stale={stale} busy={loading} onRefresh={reload} />}>
      <Segmented options={VIEWS} value={view} onChange={setView} />

      {error && (
        <EmptyState icon={AlertTriangle} title="No connection" detail={error}
                    action={{ label: 'Try again', onClick: reload }} />
      )}

      {!data && loading && !error && (
        <div className="m-skeleton-list">{[0, 1, 2, 3, 4].map((i) => <div key={i} />)}</div>
      )}

      {data && view === 'sales' && <SalesView data={data} symbol={symbol} />}
      {data && view === 'stock' && <StockView data={data} symbol={symbol} />}
      {data && view === 'outstanding' && <OutstandingView data={data} symbol={symbol} />}
    </Screen>
  );
}

function Totals({ items }) {
  return (
    <div className="m-totals">
      {items.map(({ label, value }) => (
        <div key={label}><span>{label}</span><strong>{value}</strong></div>
      ))}
    </div>
  );
}

/** A ranked list with a proportional bar, so the shape reads at a glance. */
function RankedList({ rows, empty, icon }) {
  if (!rows.length) return <EmptyState icon={icon} title={empty} />;
  const max = Math.max(...rows.map((r) => Math.abs(r.amount)), 1);
  return (
    <ul className="m-rank">
      {rows.map((row, i) => (
        <li key={`${row.title}-${i}`}>
          <div className="m-rank-head">
            <span className="m-rank-title">{row.title}</span>
            <span className="m-rank-amount">{row.display}</span>
          </div>
          {row.sub && <span className="m-rank-sub">{row.sub}</span>}
          <div className="m-rank-bar" aria-hidden="true">
            <span style={{ width: `${(Math.abs(row.amount) / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function SalesView({ data, symbol }) {
  const rows = data.by_party.slice(0, 15).map((r) => ({
    title: r.label,
    sub: `${number(r.count)} invoices`,
    amount: r.total,
    display: money(r.total, symbol)
  }));
  return (
    <>
      <Totals items={[
        { label: 'Invoiced', value: money(data.grand_total, symbol) },
        { label: 'Tax', value: money(data.tax_total, symbol) },
        { label: 'Documents', value: number(data.document_count) }
      ]} />
      <h2 className="m-list-title">Top customers</h2>
      <RankedList rows={rows} empty="No sales in this period" icon={Users} />
    </>
  );
}

function StockView({ data, symbol }) {
  // Lowest closing quantity first: the reason to open stock on a phone is to
  // find what is about to run out, not to admire what is well supplied.
  const rows = [...data.rows]
    .sort((a, b) => a.closing_qty - b.closing_qty)
    .slice(0, 20)
    .map((r) => ({
      title: r.ticker || r.product_name,
      sub: `${r.warehouse_name} · ${money(r.stock_value, symbol)}`,
      amount: r.closing_qty,
      display: `${number(r.closing_qty, 2)}${r.unit ? ` ${r.unit}` : ''}`
    }));
  return (
    <>
      <Totals items={[
        { label: 'Stock value', value: money(data.total_stock_value, symbol) },
        { label: 'Quantity', value: number(data.total_closing_qty, 2) },
        { label: 'Lines', value: number(data.rows.length) }
      ]} />
      <h2 className="m-list-title">Lowest on hand</h2>
      <RankedList rows={rows} empty="No stock recorded" icon={Package} />
    </>
  );
}

function OutstandingView({ data, symbol }) {
  const receivable = data.receivables.slice(0, 10).map((r) => ({
    title: r.party_name, amount: r.balance, display: money(r.balance, symbol)
  }));
  const payable = data.payables.slice(0, 10).map((r) => ({
    title: r.party_name, amount: r.balance, display: money(r.balance, symbol)
  }));
  return (
    <>
      <Totals items={[
        { label: 'Receivable', value: money(data.total_receivable, symbol) },
        { label: 'Payable', value: money(data.total_payable, symbol) },
        { label: 'Net', value: money(data.net_position, symbol) }
      ]} />
      <h2 className="m-list-title">Owed to you</h2>
      <RankedList rows={receivable} empty="Nothing outstanding" icon={TrendingUp} />
      <h2 className="m-list-title">Owed by you</h2>
      <RankedList rows={payable} empty="Nothing owed" icon={TrendingUp} />
    </>
  );
}
