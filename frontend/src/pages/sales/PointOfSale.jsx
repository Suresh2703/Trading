import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, AlertTriangle, Check,
  Receipt, Printer, RotateCcw, X, Banknote, CreditCard, Smartphone, UserCheck
} from 'lucide-react';

import { posApi } from '../../api';
import { useCurrency } from '../../context/CurrencyContext';
import '../../components/MasterPage.css';
import '../../components/VoucherPage.css';
import './PointOfSale.css';

const METHOD_ICONS = { CASH: Banknote, CARD: CreditCard, UPI: Smartphone, CREDIT: UserCheck };

// Notes people actually reach for at a till.
const QUICK_CASH = [100, 200, 500, 1000, 2000];

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function PointOfSale() {
  const { symbol } = useCurrency();
  const money = (v) => `${symbol}${Number(v || 0).toFixed(2)}`;

  const [terminal, setTerminal] = useState(null);
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState([]);

  const [warehouseId, setWarehouseId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [taxId, setTaxId] = useState('');
  const [method, setMethod] = useState('CASH');
  const [tendered, setTendered] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [recent, setRecent] = useState([]);
  const [showRecent, setShowRecent] = useState(false);

  const searchRef = useRef(null);

  // --- opening the till ----------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    posApi.terminal()
      .then((data) => {
        if (cancelled) return;
        setTerminal(data);
        setWarehouseId(data.warehouse ? String(data.warehouse.id) : '');
        setCustomerId(data.walk_in_customer ? String(data.walk_in_customer.id) : '');
        setMethod(data.payment_methods[0]?.code || 'CASH');
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setIsLoading(false));
    return () => { cancelled = true; };
  }, []);

  const loadProducts = useCallback(async () => {
    if (!warehouseId) return;
    setIsSearching(true);
    try {
      const params = new URLSearchParams({ warehouse_id: warehouseId });
      if (query.trim()) params.set('q', query.trim());
      setProducts(await posApi.products(`?${params}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSearching(false);
    }
  }, [warehouseId, query]);

  // Debounced so typing a code does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(loadProducts, 220);
    return () => clearTimeout(timer);
  }, [loadProducts]);

  // --- the cart ------------------------------------------------------------
  const addToCart = (product) => {
    setError(null);
    setCart((lines) => {
      const existing = lines.find((l) => l.product_id === product.id);
      if (existing) {
        return lines.map((l) => l.product_id === product.id
          ? { ...l, quantity: l.quantity + 1 } : l);
      }
      return [...lines, {
        product_id: product.id,
        ticker: product.ticker,
        name: product.name,
        unit_name: product.unit_name,
        on_hand: product.on_hand,
        quantity: 1,
        unit_price: product.current_price,
        discount_pct: 0
      }];
    });
  };

  const setLine = (productId, patch) =>
    setCart((lines) => lines.map((l) =>
      l.product_id === productId ? { ...l, ...patch } : l));

  const removeLine = (productId) =>
    setCart((lines) => lines.filter((l) => l.product_id !== productId));

  const clearCart = () => { setCart([]); setTendered(''); setError(null); };

  // Totals mirror the server's arithmetic so the drawer figure matches the
  // invoice; the server stays the authority and recomputes on post.
  const taxRate = useMemo(() => {
    const tax = terminal?.taxes.find((t) => String(t.id) === String(taxId));
    return tax ? tax.rate || 0 : 0;
  }, [terminal, taxId]);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, l) => sum
      + round2(l.quantity * l.unit_price * (1 - (l.discount_pct || 0) / 100)), 0);
    const tax = round2(round2(subtotal) * taxRate / 100);
    return { subtotal: round2(subtotal), tax, grand: round2(round2(subtotal) + tax) };
  }, [cart, taxRate]);

  const activeMethod = terminal?.payment_methods.find((m) => m.code === method);
  const takesTender = Boolean(activeMethod?.takes_tender);
  const tenderedValue = Number(tendered || 0);
  const change = takesTender ? round2(tenderedValue - totals.grand) : 0;
  const shortBy = takesTender ? round2(totals.grand - tenderedValue) : 0;

  const canPay = cart.length > 0 && !isPosting
    && (!takesTender || tenderedValue >= totals.grand - 0.005);

  // --- checkout ------------------------------------------------------------
  const pay = async () => {
    if (!canPay) return;
    setIsPosting(true);
    setError(null);
    try {
      const sale = await posApi.checkout({
        customer_id: customerId ? Number(customerId) : null,
        warehouse_id: warehouseId ? Number(warehouseId) : null,
        payment_method: method,
        amount_tendered: takesTender ? tenderedValue : 0,
        lines: cart.map((l) => ({
          product_id: l.product_id,
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
          discount_pct: Number(l.discount_pct || 0),
          tax_id: taxId ? Number(taxId) : null
        }))
      });
      setReceipt(sale);
      clearCart();
      loadProducts();          // stock has moved
      searchRef.current?.focus();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsPosting(false);
    }
  };

  const openRecent = async () => {
    setShowRecent(true);
    try {
      setRecent(await posApi.sales('?limit=25'));
    } catch (err) {
      setError(err.message);
    }
  };

  const voidSale = async (id) => {
    try {
      await posApi.void(id);
      setRecent(await posApi.sales('?limit=25'));
      loadProducts();
    } catch (err) {
      setError(err.message);
    }
  };

  if (isLoading) {
    return <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
      Opening the till...
    </div>;
  }

  return (
    <div className="pos-page">
      <div className="products-header">
        <div className="page-title">
          <h1>Point of Sale</h1>
          <p>Ring up a counter sale — stock, invoice and payment in one step.</p>
        </div>
        <div className="report-controls">
          <label>
            Till
            <select className="config-input" value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}>
              {terminal?.warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </label>
          <button className="btn-ghost pos-recent-btn" onClick={openRecent}>
            <Receipt size={16} /> Recent
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-panel pos-error">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="pos-layout">
        {/* --- catalogue ---------------------------------------------- */}
        <div className="glass-panel pos-catalogue">
          <div className="pos-search">
            <Search size={17} />
            <input ref={searchRef} autoFocus className="config-input"
                   placeholder="Scan or search by code or name..."
                   value={query} onChange={(e) => setQuery(e.target.value)} />
            {query && (
              <button className="icon-btn" onClick={() => setQuery('')} title="Clear">
                <X size={15} />
              </button>
            )}
          </div>

          <div className="pos-grid">
            {isSearching && products.length === 0 && (
              <div className="pos-empty">Searching...</div>
            )}
            {!isSearching && products.length === 0 && (
              <div className="pos-empty">No products match.</div>
            )}
            {products.map((p) => {
              const out = p.on_hand <= 0;
              return (
                <button key={p.id}
                        className={out ? 'pos-tile out' : 'pos-tile'}
                        onClick={() => addToCart(p)}
                        disabled={out}
                        title={out ? 'Out of stock at this till' : `Add ${p.name}`}>
                  <span className="pos-tile-code">{p.ticker}</span>
                  <span className="pos-tile-name">{p.name}</span>
                  <span className="pos-tile-foot">
                    <strong>{money(p.current_price)}</strong>
                    <em className={out ? 'danger' : ''}>
                      {out ? 'Out of stock' : `${p.on_hand}${p.unit_name ? ' ' + p.unit_name : ''}`}
                    </em>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* --- cart ---------------------------------------------------- */}
        <div className="glass-panel pos-cart">
          <div className="pos-cart-head">
            <h3><ShoppingCart size={16} /> Cart <span>{cart.length}</span></h3>
            {cart.length > 0 && (
              <button className="btn-ghost pos-clear" onClick={clearCart}>Clear</button>
            )}
          </div>

          <div className="pos-lines">
            {cart.length === 0 && (
              <div className="pos-empty">Nothing scanned yet.</div>
            )}
            {cart.map((l) => {
              const over = l.quantity > l.on_hand;
              return (
                <div className={over ? 'pos-line over' : 'pos-line'} key={l.product_id}>
                  <div className="pos-line-top">
                    <span className="pos-line-name">
                      <strong>{l.ticker}</strong> {l.name}
                    </span>
                    <button className="icon-btn danger" title="Remove"
                            onClick={() => removeLine(l.product_id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="pos-line-controls">
                    <div className="pos-stepper">
                      <button onClick={() => setLine(l.product_id,
                        { quantity: Math.max(1, l.quantity - 1) })} title="Less">
                        <Minus size={13} />
                      </button>
                      <input type="number" min="0" step="any" value={l.quantity}
                             onChange={(e) => setLine(l.product_id,
                               { quantity: Math.max(0, Number(e.target.value)) })} />
                      <button onClick={() => setLine(l.product_id,
                        { quantity: l.quantity + 1 })} title="More">
                        <Plus size={13} />
                      </button>
                    </div>
                    <input className="config-input pos-price" type="number" min="0" step="0.01"
                           value={l.unit_price} title="Unit price"
                           onChange={(e) => setLine(l.product_id,
                             { unit_price: Number(e.target.value) })} />
                    <input className="config-input pos-disc" type="number" min="0" max="100"
                           value={l.discount_pct} title="Discount %"
                           onChange={(e) => setLine(l.product_id,
                             { discount_pct: Number(e.target.value) })} />
                    <span className="pos-line-total">
                      {money(l.quantity * l.unit_price * (1 - (l.discount_pct || 0) / 100))}
                    </span>
                  </div>
                  {over && (
                    <div className="pos-line-warn">
                      Only {l.on_hand} on hand — the till will refuse this.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pos-foot">
            <div className="pos-foot-row">
              <label>Customer</label>
              <select className="config-input" value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}>
                {terminal?.customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="pos-foot-row">
              <label>Tax</label>
              <select className="config-input" value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}>
                <option value="">No tax</option>
                {terminal?.taxes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="pos-totals">
              <div><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
              <div><span>Tax{taxRate ? ` (${taxRate}%)` : ''}</span><span>{money(totals.tax)}</span></div>
              <div className="grand"><span>Total</span><span>{money(totals.grand)}</span></div>
            </div>

            <div className="pos-methods">
              {terminal?.payment_methods.map((m) => {
                const Icon = METHOD_ICONS[m.code] || Banknote;
                return (
                  <button key={m.code}
                          className={m.code === method ? 'pos-method active' : 'pos-method'}
                          onClick={() => { setMethod(m.code); setTendered(''); }}
                          title={m.account_name || 'Left on the customer account'}>
                    <Icon size={15} /> {m.label}
                  </button>
                );
              })}
            </div>

            {takesTender && (
              <div className="pos-tender">
                <div className="pos-quick">
                  {QUICK_CASH.map((note) => (
                    <button key={note} onClick={() => setTendered(String(note))}>
                      {symbol}{note}
                    </button>
                  ))}
                  <button onClick={() => setTendered(totals.grand.toFixed(2))}>Exact</button>
                </div>
                <div className="pos-foot-row">
                  <label>Tendered</label>
                  <input className="config-input" type="number" min="0" step="0.01"
                         value={tendered} placeholder="0.00"
                         onChange={(e) => setTendered(e.target.value)} />
                </div>
                <div className={change >= 0 ? 'pos-change' : 'pos-change short'}>
                  {change >= 0
                    ? <>Change <strong>{money(change)}</strong></>
                    : <>Short by <strong>{money(shortBy)}</strong></>}
                </div>
              </div>
            )}

            {method === 'CREDIT' && (
              <div className="pos-note">
                Nothing is collected now — this stays on the customer&apos;s account
                and shows in Outstanding.
              </div>
            )}

            <button className="btn-primary pos-pay" onClick={pay} disabled={!canPay}>
              {isPosting ? 'Posting...' : <>Take payment · {money(totals.grand)}</>}
            </button>
          </div>
        </div>
      </div>

      {receipt && (
        <ReceiptModal sale={receipt} money={money}
                      onClose={() => setReceipt(null)} />
      )}

      {showRecent && (
        <RecentModal sales={recent} money={money} onVoid={voidSale}
                     onOpen={setReceipt} onClose={() => setShowRecent(false)} />
      )}
    </div>
  );
}

function ReceiptModal({ sale, money, onClose }) {
  const invoice = sale.invoice;
  return (
    <div className="master-modal-backdrop" onClick={onClose}>
      <div className="master-modal glass-panel pos-receipt" onClick={(e) => e.stopPropagation()}>
        <div className="pos-receipt-head">
          <div className="pos-receipt-ok"><Check size={20} /></div>
          <h3>{sale.receipt_no}</h3>
          <p className="text-muted-small">
            {sale.sale_date} · {sale.payment_method}
            {sale.cashier_name ? ` · ${sale.cashier_name}` : ''}
          </p>
        </div>

        <div className="pos-receipt-body">
          {invoice?.lines.map((l) => (
            <div className="pos-receipt-line" key={l.id}>
              <span>{l.product?.ticker || l.product_id} × {l.quantity}</span>
              <span>{money(l.line_total)}</span>
            </div>
          ))}
          <div className="pos-receipt-line sub">
            <span>Subtotal</span><span>{money(invoice?.subtotal)}</span>
          </div>
          <div className="pos-receipt-line sub">
            <span>Tax</span><span>{money(invoice?.tax_total)}</span>
          </div>
          <div className="pos-receipt-line total">
            <span>Total</span><span>{money(sale.amount_total)}</span>
          </div>
          {sale.change_given > 0 && (
            <>
              <div className="pos-receipt-line sub">
                <span>Tendered</span><span>{money(sale.amount_tendered)}</span>
              </div>
              <div className="pos-receipt-line sub">
                <span>Change</span><span>{money(sale.change_given)}</span>
              </div>
            </>
          )}
          <div className="pos-receipt-docs text-muted-small">
            Invoice {invoice?.doc_no}
            {sale.journal_entry_id ? ' · receipt posted' : ' · on account'}
          </div>
        </div>

        <div className="master-modal-actions">
          <button className="btn-ghost" onClick={() => window.print()}>
            <Printer size={15} /> Print
          </button>
          <button className="btn-primary" onClick={onClose}>New sale</button>
        </div>
      </div>
    </div>
  );
}

function RecentModal({ sales, money, onVoid, onOpen, onClose }) {
  const [confirming, setConfirming] = useState(null);
  return (
    <div className="master-modal-backdrop" onClick={onClose}>
      <div className="master-modal glass-panel pos-recent" onClick={(e) => e.stopPropagation()}>
        <h3>Recent sales</h3>
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Receipt</th><th>Date</th><th>Method</th>
                <th style={{ textAlign: 'right' }}>Total</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center' }}>No sales yet.</td></tr>
              )}
              {sales.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.receipt_no}</strong></td>
                  <td>{s.sale_date}</td>
                  <td>{s.payment_method}</td>
                  <td style={{ textAlign: 'right' }}>{money(s.amount_total)}</td>
                  <td>
                    <span className={s.status === 'VOID' ? 'role-badge' : 'role-badge admin'}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    <button className="action-btn" title="View receipt"
                            onClick={() => { onOpen(s); onClose(); }}>
                      <Receipt size={15} />
                    </button>
                    {s.status !== 'VOID' && (
                      confirming === s.id ? (
                        <button className="action-btn delete" title="Confirm void"
                                onClick={() => { onVoid(s.id); setConfirming(null); }}>
                          <Check size={15} />
                        </button>
                      ) : (
                        <button className="action-btn delete" title="Void this sale"
                                onClick={() => setConfirming(s.id)}>
                          <RotateCcw size={15} />
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="master-modal-actions">
          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
