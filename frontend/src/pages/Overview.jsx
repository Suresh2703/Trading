import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  Tooltip, ResponsiveContainer
} from 'recharts';
import {
  GripHorizontal, RefreshCw, Package, AlertTriangle, Check,
  TrendingUp, TrendingDown, Clock
} from 'lucide-react';
import './Overview.css';
import { useCurrency } from '../context/CurrencyContext';
import { reportsApi } from '../api';

const PIPELINE_COLORS = ['#8b5cf6', '#3b82f6', '#10b981'];

function currentUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

export default function Overview() {
  const { symbol } = useCurrency();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await reportsApi.dashboard());
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const money = v => `${symbol}${Number(v || 0).toFixed(2)}`;
  const compact = v => {
    const n = Number(v || 0);
    if (Math.abs(n) >= 1_000_000) return `${symbol}${(n / 1_000_000).toFixed(2)}M`;
    if (Math.abs(n) >= 1_000) return `${symbol}${(n / 1_000).toFixed(1)}K`;
    return money(n);
  };

  const user = currentUser();

  if (isLoading && !data) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', margin: '1rem 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171' }}>
          <AlertTriangle size={18} /> Could not load the dashboard: {error}
        </div>
        <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={load}>
          Try again
        </button>
      </div>
    );
  }

  const { revenue, pipeline, customers, payables, inventory, attention, trading, recent } = data;

  const pipelineData = [
    { name: 'Orders', value: pipeline.orders, color: PIPELINE_COLORS[0] },
    { name: 'Deliveries', value: pipeline.deliveries, color: PIPELINE_COLORS[1] },
    { name: 'Invoices', value: pipeline.invoices, color: PIPELINE_COLORS[2] }
  ].filter(d => d.value > 0);

  // Recharts needs at least one point; an empty book should not render a broken axis.
  const revenueSeries = revenue.by_month.map(p => ({ name: p.label, value: p.value }));
  const productSeries = inventory.by_product.map(p => ({ name: p.label, value: p.value }));

  const attentionItems = [
    { label: 'Draft sales documents', count: attention.draft_sales, colour: '#f59e0b', to: 'Sales' },
    { label: 'Draft purchase documents', count: attention.draft_purchases, colour: '#f59e0b', to: 'Purchases' },
    { label: 'Draft journal entries', count: attention.draft_journals, colour: '#f59e0b', to: 'Accounts' },
    { label: 'Products out of stock', count: attention.out_of_stock, colour: '#ef4444', to: 'Inventory' }
  ].filter(i => i.count > 0);

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="dashboard-header">
        <div className="dashboard-title">
          <h1>Dashboard</h1>
          <p>Welcome{user?.username ? `, ${user.username}` : ''} — live figures from your books.</p>
        </div>
        <div className="dashboard-controls">
          <button className="btn-primary"
                  style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                  onClick={load} disabled={isLoading}>
            <RefreshCw size={16} /> {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="dashboard-grid">

        {/* Revenue — confirmed sales invoices */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="drag-handle"><GripHorizontal size={14} /> Revenue</div>
          </div>
          <div className="dash-card-body">
            <div className="flex-between">
              <div>
                <div className="big-number">{money(revenue.total)}</div>
                <div className="text-muted-small">
                  From {revenue.invoice_count} sales invoice{revenue.invoice_count === 1 ? '' : 's'}
                </div>
                <div className="text-muted-small">Avg invoice: {money(revenue.average_invoice)}</div>
                <div className="text-muted-small">Best month: {money(revenue.best_month)}</div>
              </div>
            </div>
            <div style={{ flex: 1, marginTop: '1rem', minHeight: '120px' }}>
              {revenueSeries.length === 0 ? (
                <div className="dash-empty">No invoices raised yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueSeries}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333' }}
                             formatter={v => money(v)} />
                    <Area type="monotone" dataKey="value" stroke="#4ade80" strokeWidth={2}
                          fillOpacity={1} fill="url(#colorValue)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Sales pipeline — how far orders have travelled */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="drag-handle"><GripHorizontal size={14} /> Sales Pipeline</div>
          </div>
          <div className="dash-card-body">
            <div className="flex-between">
              <div>
                <div className="big-number" style={{ fontSize: '1.5rem' }}>
                  {/* A percentage of zero orders would read as 0%, which is
                      worse than admitting there is nothing to divide by. */}
                  {pipeline.orders > 0 ? `${pipeline.conversion_pct}%` : '—'}
                </div>
                <div className="text-muted-small">
                  {pipeline.orders > 0 ? 'Invoices raised per order' : 'No confirmed orders yet'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="trend-up">{pipeline.invoices}</div>
                <div className="text-muted-small">Invoiced</div>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center',
                          alignItems: 'center', minHeight: '120px' }}>
              {pipelineData.length === 0 ? (
                <div className="dash-empty">No sales documents yet.</div>
              ) : (
                <PieChart width={120} height={120}>
                  <Pie data={pipelineData} innerRadius={35} outerRadius={50}
                       dataKey="value" stroke="none">
                    {pipelineData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              )}
            </div>
            <div className="flex-between" style={{ fontSize: '0.65rem', color: '#888' }}>
              <span><span style={{ color: PIPELINE_COLORS[0] }}>●</span> Orders ({pipeline.orders})</span>
              <span><span style={{ color: PIPELINE_COLORS[1] }}>●</span> Deliveries ({pipeline.deliveries})</span>
              <span><span style={{ color: PIPELINE_COLORS[2] }}>●</span> Invoices ({pipeline.invoices})</span>
            </div>
          </div>
        </div>

        {/* Customers and what they owe */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="drag-handle"><GripHorizontal size={14} /> Customers</div>
          </div>
          <div className="dash-card-body">
            <div className="flex-between">
              <div>
                <div className="big-number">{customers.total}</div>
                <div className="text-muted-small">Total Customers</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="trend-up">{customers.active}</div>
                <div className="text-muted-small">Active</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr',
                          gap: '0.5rem', marginTop: '1rem' }}>
              <div style={{ background: '#1e3a8a', padding: '0.75rem', borderRadius: '6px' }}>
                <div style={{ color: '#fff', fontWeight: 'bold' }}>
                  {compact(customers.total_receivable)}
                </div>
                <div style={{ color: '#93c5fd', fontSize: '0.7rem' }}>Receivable</div>
              </div>
              <div style={{ background: '#9a3412', padding: '0.75rem', borderRadius: '6px' }}>
                <div style={{ color: '#fff', fontWeight: 'bold' }}>{customers.with_balance}</div>
                <div style={{ color: '#fdba74', fontSize: '0.7rem' }}>Owing money</div>
              </div>
            </div>
            <div style={{ flex: 1, marginTop: '1rem', overflowY: 'auto' }}>
              {customers.top.length === 0 ? (
                <div className="dash-empty">Nothing outstanding.</div>
              ) : customers.top.map((c, i) => (
                <div className="flex-between dash-list-row" key={i}>
                  <span style={{ fontSize: '0.8rem' }}>{c.label}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4ade80' }}>
                    {money(c.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Payables */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="drag-handle"><GripHorizontal size={14} /> Accounts Payable</div>
          </div>
          <div className="dash-card-body">
            <div className="big-number">{money(payables.total_payable)}</div>
            <div className="text-muted-small" style={{ marginBottom: '1rem' }}>
              Owed to {payables.supplier_count} supplier{payables.supplier_count === 1 ? '' : 's'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <div className="tag-blue">Receivable</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.25rem' }}>
                  {compact(customers.total_receivable)}
                </div>
              </div>
              <div className="mini-stat-card">
                <span className="text-muted-small">Net position</span>
                <div style={{
                  fontSize: '1.2rem', fontWeight: 700, marginTop: '0.25rem',
                  color: customers.total_receivable - payables.total_payable >= 0 ? '#4ade80' : '#f87171'
                }}>
                  {compact(customers.total_receivable - payables.total_payable)}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 'auto', borderTop: '1px solid #2a2a2a', paddingTop: '1rem' }}>
              <div className="text-muted-small">Largest balances</div>
              {payables.top.length === 0 ? (
                <div className="dash-empty" style={{ padding: '0.5rem 0' }}>
                  Nothing owed to suppliers.
                </div>
              ) : payables.top.map((p, i) => (
                <div className="flex-between" key={i} style={{ marginTop: '0.35rem' }}>
                  <div style={{ fontSize: '0.85rem' }}>{p.label}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700 }}>{money(p.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Inventory items */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="drag-handle"><GripHorizontal size={14} /> Inventory Items</div>
          </div>
          <div className="dash-card-body">
            <div className="flex-between">
              <div>
                <div className="big-number">{inventory.total_quantity}</div>
                <div className="text-muted-small">
                  Units across {inventory.product_count} product{inventory.product_count === 1 ? '' : 's'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="big-number" style={{ fontSize: '1.2rem' }}>
                  {compact(inventory.total_value)}
                </div>
                <div className="text-muted-small">Total Value</div>
              </div>
            </div>
            <div style={{ flex: 1, marginTop: '1rem', minHeight: '120px' }}>
              {productSeries.length === 0 ? (
                <div className="dash-empty">No stock on hand.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productSeries}>
                    <Tooltip cursor={{ fill: '#2a2a2a' }}
                             contentStyle={{ background: '#1a1a1a', border: '1px solid #333' }}
                             formatter={v => money(v)} />
                    <Bar dataKey="value" fill="#a855f7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Inventory value by location */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="drag-handle"><GripHorizontal size={14} /> Inventory Value</div>
          </div>
          <div className="dash-card-body">
            <div className="big-number" style={{ fontSize: '1.5rem' }}>
              {money(inventory.total_value)}
            </div>
            <div className="text-muted-small" style={{ marginBottom: '1rem' }}>
              Across {inventory.location_count} location{inventory.location_count === 1 ? '' : 's'}
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              {inventory.by_location.length === 0 ? (
                <div className="dash-empty">No stock to value.</div>
              ) : inventory.by_location.map((loc, i) => {
                const pct = inventory.total_value
                  ? (loc.value / inventory.total_value) * 100 : 0;
                const colours = ['#f59e0b', '#3b82f6', '#10b981', '#a855f7'];
                return (
                  <div key={loc.label} style={{ marginTop: i === 0 ? 0 : '1rem' }}>
                    <div className="flex-between" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                      <span>{loc.label}</span>
                      <span>{money(loc.value)}</span>
                    </div>
                    <div className="progress-bar-container">
                      {/* .progress-fill is the class the stylesheet actually defines */}
                      <div className="progress-fill"
                           style={{ width: `${pct}%`, background: colours[i % colours.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 'auto' }}>
              {inventory.out_of_stock > 0 ? (
                <div className="dash-alert danger">
                  <AlertTriangle size={14} />
                  {inventory.out_of_stock} product/location line{inventory.out_of_stock === 1 ? '' : 's'} at zero stock
                </div>
              ) : (
                <div className="dash-alert ok">
                  <Check size={14} /> No stock lines are at zero
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Needs attention — replaces the old hardcoded task list */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="drag-handle"><GripHorizontal size={14} /> Needs Attention</div>
          </div>
          <div className="dash-card-body" style={{ overflowY: 'auto' }}>
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', margin: 0 }}>Open items</h3>
              <span className={attention.unbalanced_books ? 'report-balanced off' : 'report-balanced'}>
                {attention.unbalanced_books
                  ? <><AlertTriangle size={12} /> Books out of balance</>
                  : <><Check size={12} /> Books balanced</>}
              </span>
            </div>

            {attentionItems.length === 0 ? (
              <div className="dash-empty">Nothing needs attention right now.</div>
            ) : attentionItems.map((item, i) => (
              <div className="task-item" key={i}>
                <div className="task-dot" style={{ background: item.colour }} />
                <div style={{ flex: 1, fontSize: '0.85rem' }}>{item.label}</div>
                <div className="text-muted-small">{item.count} in {item.to}</div>
              </div>
            ))}

            <div style={{ marginTop: '1rem', borderTop: '1px solid #2a2a2a', paddingTop: '0.75rem' }}>
              <div className="text-muted-small" style={{ marginBottom: '0.5rem' }}>Trading book</div>
              <div className="flex-between" style={{ fontSize: '0.85rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <TrendingUp size={13} color="#4ade80" /> Realized
                </span>
                <span style={{ fontWeight: 600, color: trading.realized >= 0 ? '#4ade80' : '#f87171' }}>
                  {money(trading.realized)}
                </span>
              </div>
              <div className="flex-between" style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <TrendingDown size={13} color="#f59e0b" /> Unrealized
                </span>
                <span style={{ fontWeight: 600, color: trading.unrealized >= 0 ? '#4ade80' : '#f87171' }}>
                  {money(trading.unrealized)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="drag-handle"><GripHorizontal size={14} /> Recent Activity</div>
          </div>
          <div className="dash-card-body" style={{ overflowY: 'auto' }}>
            <div className="flex-between">
              <h3 style={{ fontSize: '1rem', margin: 0 }}>Latest documents</h3>
              <div className="text-muted-small">{recent.length} shown</div>
            </div>
            <div className="flex-between text-muted-small" style={{ marginBottom: '1rem' }}>
              <span>Sales and purchases</span>
              <span>Net of tax</span>
            </div>

            {recent.length === 0 ? (
              <div className="dash-empty">No documents recorded yet.</div>
            ) : recent.map((tx, i) => (
              <div className="transaction-item" key={i}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div className="tx-icon">
                    <Package size={16} color={tx.kind === 'SALES' ? '#4ade80' : '#f59e0b'} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      {tx.party || 'No party'}
                    </div>
                    <div className="text-muted-small"
                         style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      {tx.reference} <Clock size={11} /> {tx.entry_date}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    color: tx.kind === 'SALES' ? '#4ade80' : '#f59e0b',
                    fontSize: '0.85rem', fontWeight: 600
                  }}>
                    {tx.kind === 'SALES' ? '+' : '−'}{money(tx.amount)}
                  </div>
                  <div className={tx.status === 'CONFIRMED' ? 'tag-green' : 'tag-blue'}
                       style={{ marginTop: '0.25rem', display: 'inline-block' }}>
                    {tx.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
