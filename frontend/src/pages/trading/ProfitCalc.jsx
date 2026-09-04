import { useState, useEffect, useCallback } from 'react';
import {
  Calculator, TrendingUp, TrendingDown, Wallet, RefreshCw, ChevronDown, ChevronRight
} from 'lucide-react';
import { positionsApi } from '../../api';
import { useCurrency } from '../../context/CurrencyContext';
import '../../components/MasterPage.css';
import './ProfitCalc.css';

/**
 * Profit on the trading book, split into what has been banked and what is
 * still riding on open positions.
 *
 *   realized   = proceeds - FIFO cost of the lots a sale consumed
 *   unrealized = open lots marked against the product's current price
 *
 * Both come from the server so the arithmetic is not duplicated here.
 */
export default function ProfitCalc() {
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [includeClosed, setIncludeClosed] = useState(false);
  const [expanded, setExpanded] = useState({});

  const { symbol } = useCurrency();

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setSummary(await positionsApi.list(includeClosed ? '?include_closed=true' : ''));
    } catch (err) {
      setError(err.message);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [includeClosed]);

  useEffect(() => { load(); }, [load]);

  const money = v => `${symbol}${Number(v || 0).toFixed(2)}`;

  const signed = (v) => {
    const value = Number(v || 0);
    const positive = value >= 0;
    return (
      <span style={{ color: positive ? '#10b981' : '#f87171', fontWeight: 700 }}>
        {positive ? '+' : '−'}{symbol}{Math.abs(value).toFixed(2)}
      </span>
    );
  };

  const positions = summary?.positions || [];
  const netProfit = (summary?.total_realized || 0) + (summary?.total_unrealized || 0);

  const cards = [
    { label: 'Realized P&L', icon: TrendingUp, color: '#10b981',
      value: signed(summary?.total_realized), hint: 'Banked on closed sales' },
    { label: 'Unrealized P&L', icon: TrendingDown, color: '#f59e0b',
      value: signed(summary?.total_unrealized), hint: 'Open positions at market' },
    { label: 'Net P&L', icon: Calculator, color: '#8b5cf6',
      value: signed(netProfit), hint: 'Realized + unrealized' },
    { label: 'Fees Paid', icon: Wallet, color: '#94a3b8',
      value: <span style={{ fontWeight: 700 }}>{money(summary?.total_fees)}</span>,
      hint: 'Already inside the figures above' }
  ];

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="products-header">
        <div className="page-title">
          <h1>Profit Calculator</h1>
          <p>FIFO cost basis: sales consume the oldest buy lots first.</p>
        </div>
        <div className="dashboard-controls">
          <label className="master-checkbox" style={{ height: 'auto' }}>
            <input type="checkbox" checked={includeClosed}
                   onChange={e => setIncludeClosed(e.target.checked)} />
            <span>Show closed positions</span>
          </label>
          <button className="btn-primary"
                  style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                  onClick={load} disabled={isLoading}>
            <RefreshCw size={16} /> {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="summary-cards">
        {cards.map((card, i) => (
          <div className="summary-card glass-panel" key={i}>
            <div className="summary-icon" style={{ background: card.color + '33', color: card.color }}>
              <card.icon size={24} />
            </div>
            <div>
              <div className="text-muted-small">{card.label}</div>
              <div className="big-number" style={{ fontSize: '1.4rem' }}>{card.value}</div>
              <div className="text-muted-small pnl-hint">{card.hint}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-panel">
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '32px' }}></th>
                <th>Product</th>
                <th style={{ textAlign: 'right' }}>Qty Held</th>
                <th style={{ textAlign: 'right' }}>Avg Cost</th>
                <th style={{ textAlign: 'right' }}>Cost Value</th>
                <th style={{ textAlign: 'right' }}>Market Price</th>
                <th style={{ textAlign: 'right' }}>Market Value</th>
                <th style={{ textAlign: 'right' }}>Unrealized</th>
                <th style={{ textAlign: 'right' }}>Realized</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="9" style={{ textAlign: 'center' }}>Loading...</td></tr>
              ) : error ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', color: '#f87171' }}>{error}</td></tr>
              ) : positions.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center' }}>
                    No trades yet. Record a buy to open a position.
                  </td>
                </tr>
              ) : positions.map(p => {
                const open = expanded[p.product_id];
                return [
                  <tr key={p.product_id}>
                    <td>
                      {p.open_lots.length > 0 && (
                        <button className="action-btn edit pnl-expand"
                                title={open ? 'Hide lots' : 'Show open lots'}
                                onClick={() => setExpanded({ ...expanded, [p.product_id]: !open })}>
                          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.ticker}</div>
                      <div className="text-muted-small">{p.product_name}</div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{p.quantity}</td>
                    <td style={{ textAlign: 'right' }} className="text-muted-small">{money(p.average_cost)}</td>
                    <td style={{ textAlign: 'right' }} className="text-muted-small">{money(p.cost_value)}</td>
                    <td style={{ textAlign: 'right' }} className="text-muted-small">{money(p.market_price)}</td>
                    <td style={{ textAlign: 'right' }}><span className="price-tag">{money(p.market_value)}</span></td>
                    <td style={{ textAlign: 'right' }}>{signed(p.unrealized_pnl)}</td>
                    <td style={{ textAlign: 'right' }}>{signed(p.realized_pnl)}</td>
                  </tr>,
                  open && (
                    <tr key={`${p.product_id}-lots`} className="pnl-lots-row">
                      <td></td>
                      <td colSpan="8">
                        <div className="pnl-lots">
                          <div className="pnl-lots-title">
                            Open lots — the next sale consumes these from the top
                          </div>
                          {p.open_lots.map(lot => (
                            <div className="pnl-lot" key={lot.buy_trade_id}>
                              <span className="master-badge muted">{lot.trade_no}</span>
                              <span className="text-muted-small">{lot.trade_date}</span>
                              <span>{lot.quantity} @ {money(lot.unit_cost)}</span>
                              <span className="price-tag">
                                {money(lot.quantity * lot.unit_cost)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                ];
              })}
            </tbody>
            {positions.length > 0 && (
              <tfoot>
                <tr className="pnl-total-row">
                  <td colSpan="4" style={{ fontWeight: 700 }}>Totals</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(summary.total_cost_value)}</td>
                  <td></td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(summary.total_market_value)}</td>
                  <td style={{ textAlign: 'right' }}>{signed(summary.total_unrealized)}</td>
                  <td style={{ textAlign: 'right' }}>{signed(summary.total_realized)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
