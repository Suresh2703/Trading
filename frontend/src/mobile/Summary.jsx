import { AlertTriangle, ArrowDownRight, ArrowUpRight, Boxes, FileText,
         Receipt, TrendingUp, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useCurrency } from '../context/CurrencyContext';
import { reportsApi } from '../api';
import { useLiveData } from './useLiveData';
import { money, number, shortDate } from './format';
import { EmptyState, Freshness, Screen, Tile } from './parts';

/**
 * The figures someone opens the app to check.
 *
 * Ordered by how often it is the reason the app was opened: what came in,
 * what is owed, what needs doing. Everything comes from one `/reports/dashboard`
 * call, so every number on the screen is the same moment.
 */
export default function Summary() {
  const { symbol } = useCurrency();
  const { data, error, loading, updatedAt, stale, reload } =
    useLiveData(() => reportsApi.dashboard(), []);

  if (error) {
    return (
      <Screen title="Summary">
        <EmptyState icon={AlertTriangle} title="No connection"
                    detail={error} action={{ label: 'Try again', onClick: reload }} />
      </Screen>
    );
  }

  const revenue = data?.revenue;
  const attention = data?.attention;
  const todo = attention ? (attention.draft_sales + attention.draft_purchases
    + attention.draft_journals + attention.out_of_stock) : 0;

  return (
    <Screen title="Summary"
            action={<Freshness at={updatedAt} stale={stale} busy={loading} onRefresh={reload} />}>
      {!data && loading && <div className="m-skeleton-hero" />}

      {data && (
        <>
          <section className="m-hero">
            <span className="m-hero-label">Revenue</span>
            <strong className="m-hero-value">{money(revenue.total, symbol)}</strong>
            <span className="m-hero-note">
              {number(revenue.invoice_count)} invoices &middot; avg {money(revenue.average_invoice, symbol)}
            </span>
          </section>

          <div className="m-tiles">
            {/* Coloured by sign rather than by category. Money owed to the
                business is good news, but a receivable that has gone negative
                is a bookkeeping fault, and showing it in the same green as a
                healthy balance would bury exactly the figure worth noticing.
                A zero payable is neither good nor bad, so it stays plain. */}
            <Tile icon={ArrowDownRight} label="Receivable"
                  tone={data.customers.total_receivable < 0 ? 'danger' : 'success'}
                  value={money(data.customers.total_receivable, symbol)}
                  note={`${number(data.customers.with_balance)} customers`} />
            <Tile icon={ArrowUpRight} label="Payable"
                  tone={data.payables.total_payable > 0 ? 'danger' : undefined}
                  value={money(data.payables.total_payable, symbol)}
                  note={`${number(data.payables.supplier_count)} suppliers`} />
            <Tile icon={Boxes} label="Stock value"
                  value={money(data.inventory.total_value, symbol)}
                  note={`${number(data.inventory.product_count)} items`} />
            <Tile icon={TrendingUp} label="Pipeline"
                  value={money(data.pipeline.order_value, symbol)}
                  note={`${number(data.pipeline.orders)} orders open`} />
          </div>

          {(todo > 0 || attention.unbalanced_books) && (
            <section className="m-card m-attention">
              <h2 className="m-card-title"><AlertTriangle size={15} /> Needs attention</h2>
              <ul className="m-chips">
                {attention.unbalanced_books &&
                  <li className="m-chip m-chip-danger">Books do not balance</li>}
                {attention.out_of_stock > 0 &&
                  <li className="m-chip m-chip-warning">{attention.out_of_stock} out of stock</li>}
                {attention.draft_sales > 0 &&
                  <li className="m-chip">{attention.draft_sales} draft sales</li>}
                {attention.draft_purchases > 0 &&
                  <li className="m-chip">{attention.draft_purchases} draft purchases</li>}
                {attention.draft_journals > 0 &&
                  <li className="m-chip">{attention.draft_journals} draft journals</li>}
              </ul>
            </section>
          )}

          <section className="m-card">
            <h2 className="m-card-title"><Receipt size={15} /> Pipeline</h2>
            <div className="m-split">
              <div><strong>{number(data.pipeline.orders)}</strong><span>Orders</span></div>
              <div><strong>{number(data.pipeline.deliveries)}</strong><span>Deliveries</span></div>
              <div><strong>{number(data.pipeline.invoices)}</strong><span>Invoices</span></div>
              <div><strong>{number(data.pipeline.conversion_pct, 0)}%</strong><span>Converted</span></div>
            </div>
          </section>

          <section className="m-card">
            <h2 className="m-card-title"><FileText size={15} /> Recent activity</h2>
            {data.recent.length === 0
              ? <p className="m-muted">Nothing posted yet.</p>
              : (
                <ul className="m-rows">
                  {data.recent.map((row, i) => (
                    <li key={`${row.reference}-${i}`} className="m-row">
                      <div className="m-row-main">
                        <span className="m-row-title">{row.reference}</span>
                        <span className="m-row-sub">{row.party || row.kind} &middot; {shortDate(row.entry_date)}</span>
                      </div>
                      <div className="m-row-side">
                        <span className="m-row-amount">{money(row.amount, symbol)}</span>
                        <span className={`m-status m-status-${row.status.toLowerCase()}`}>{row.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
          </section>

          <Link to="/m/reports" className="m-cta">
            <Wallet size={16} /> Open full reports
          </Link>
        </>
      )}
    </Screen>
  );
}
