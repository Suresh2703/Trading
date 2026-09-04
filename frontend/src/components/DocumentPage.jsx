import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, X, AlertTriangle, Trash } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import { productsApi, taxesApi, warehousesApi } from '../api';
import './MasterPage.css';
import './DocumentPage.css';

const STATUSES = ['DRAFT', 'CONFIRMED', 'CANCELLED'];

const today = () => new Date().toISOString().slice(0, 10);

const blankLine = () => ({
  product_id: '', quantity: '1', unit_price: '', discount_pct: '0', tax_id: ''
});

const num = v => (v === '' || v === null || v === undefined ? 0 : Number(v));

/**
 * A header + line-items screen for sales documents.
 *
 * Unlike MasterPage (one flat record per row) a document owns a variable number
 * of lines, and every money figure is derived rather than entered — the totals
 * shown while editing use the same arithmetic the server applies on save.
 */
export default function DocumentPage({ config }) {
  const {
    title, subtitle, singular, icon: Icon, api,
    // The counterparty differs by module: sales documents face a customer,
    // purchase documents face a supplier.
    party,   // { key: 'customer'|'supplier', field, label, api }
    needsLocation = false, parentType = null, parentLabel = 'Raised against'
  } = config;

  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [header, setHeader] = useState({});
  const [lines, setLines] = useState([]);
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState(null);
  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [parents, setParents] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const { symbol } = useCurrency();

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setRows(await api.list());
    } catch (err) {
      setLoadError(err.message);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      party.api.list().catch(() => []),
      productsApi.list().catch(() => []),
      taxesApi.list().catch(() => []),
      parentType ? api.listByType(parentType).catch(() => []) : Promise.resolve([]),
      needsLocation ? warehousesApi.list().catch(() => []) : Promise.resolve([])
    ]).then(([pa, p, t, par, wh]) => {
      if (cancelled) return;
      setParties(pa); setProducts(p); setTaxes(t); setParents(par); setWarehouses(wh);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const taxById = useMemo(
    () => Object.fromEntries(taxes.map(t => [String(t.id), t])), [taxes]
  );

  // --- Derived money, mirroring the server's calculation -------------------
  const lineMath = (line) => {
    const gross = num(line.quantity) * num(line.unit_price);
    const subtotal = gross * (1 - num(line.discount_pct) / 100);
    const rate = taxById[String(line.tax_id)]?.rate || 0;
    const tax = subtotal * rate / 100;
    return { subtotal, tax, total: subtotal + tax };
  };

  const totals = useMemo(() => {
    return lines.reduce((acc, line) => {
      const m = lineMath(line);
      return {
        subtotal: acc.subtotal + m.subtotal,
        tax: acc.tax + m.tax,
        total: acc.total + m.total
      };
    }, { subtotal: 0, tax: 0, total: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, taxById]);

  // --- Form open/close ----------------------------------------------------
  const openCreate = () => {
    setEditingId(null);
    setHeader({
      doc_no: '', doc_date: today(), partyId: '', parent_id: '',
      warehouse_id: '', reference_no: '',
      status: 'DRAFT', notes: ''
    });
    setLines([blankLine()]);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setHeader({
      doc_no: row.doc_no ?? '',
      doc_date: row.doc_date ?? today(),
      partyId: row[party.field] ?? '',
      parent_id: row.parent_id ?? '',
      warehouse_id: row.warehouse_id ?? '',
      reference_no: row.reference_no ?? '',
      status: row.status ?? 'DRAFT',
      notes: row.notes ?? ''
    });
    setLines((row.lines || []).map(l => ({
      product_id: l.product_id ?? '',
      quantity: String(l.quantity ?? ''),
      unit_price: String(l.unit_price ?? ''),
      discount_pct: String(l.discount_pct ?? '0'),
      tax_id: l.tax_id ?? '',
      remarks: l.remarks ?? ''
    })));
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  };

  // --- Line editing -------------------------------------------------------
  const setLine = (idx, patch) =>
    setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const addLine = () => setLines([...lines, blankLine()]);

  const removeLine = (idx) =>
    setLines(lines.length === 1 ? [blankLine()] : lines.filter((_, i) => i !== idx));

  // Picking a product seeds the price from the product master.
  const onPickProduct = (idx, productId) => {
    const product = products.find(p => String(p.id) === String(productId));
    const patch = { product_id: productId };
    if (product && !lines[idx].unit_price) {
      patch.unit_price = String(product.current_price ?? '');
    }
    setLine(idx, patch);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);
    try {
      const payload = {
        doc_no: header.doc_no,
        doc_date: header.doc_date,
        [party.field]: Number(header.partyId),
        parent_id: header.parent_id ? Number(header.parent_id) : null,
        warehouse_id: header.warehouse_id ? Number(header.warehouse_id) : null,
        reference_no: header.reference_no || null,
        status: header.status,
        notes: header.notes || null,
        lines: lines.map(l => ({
          product_id: Number(l.product_id),
          quantity: num(l.quantity),
          unit_price: num(l.unit_price),
          discount_pct: num(l.discount_pct),
          tax_id: l.tax_id ? Number(l.tax_id) : null,
          remarks: l.remarks || null
        }))
      };
      if (editingId === null) await api.create(payload);
      else await api.update(editingId, payload);
      closeForm();
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await api.remove(pendingDelete.id);
      setPendingDelete(null);
      await load();
    } catch (err) {
      setPendingDelete({ ...pendingDelete, error: err.message });
    }
  };

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(r =>
      [r.doc_no, r.reference_no, r.status, r.warehouse?.name, r[party.key]?.name, r[party.key]?.code]
        .some(v => String(v ?? '').toLowerCase().includes(term))
    );
  }, [rows, search]);

  const money = v => `${symbol}${Number(v || 0).toFixed(2)}`;

  const statusClass = s =>
    s === 'CONFIRMED' ? 'doc-status confirmed'
      : s === 'CANCELLED' ? 'doc-status cancelled'
        : 'doc-status draft';

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="products-header">
        <div className="page-title">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="dashboard-controls">
          <div className="control-btn" style={{ background: 'transparent', padding: '0.25rem 0.5rem' }}>
            <Search size={16} color="#888" />
            <input
              type="text"
              placeholder={'Search ' + title.toLowerCase() + '...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', marginLeft: '0.5rem' }}
            />
          </div>
          <button
            className="btn-primary"
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
            onClick={() => (showForm ? closeForm() : openCreate())}
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Cancel' : 'New ' + singular}
          </button>
        </div>
      </div>

      <div className="summary-cards">
        <div className="summary-card glass-panel">
          <div className="summary-icon" style={{ background: '#8b5cf633', color: '#8b5cf6' }}>
            <Icon size={24} />
          </div>
          <div>
            <div className="text-muted-small">{title}</div>
            <div className="big-number" style={{ fontSize: '1.5rem' }}>{rows.length}</div>
          </div>
        </div>
        <div className="summary-card glass-panel">
          <div className="summary-icon" style={{ background: '#10b98133', color: '#10b981' }}>
            <Icon size={24} />
          </div>
          <div>
            <div className="text-muted-small">Confirmed Value</div>
            <div className="big-number" style={{ fontSize: '1.5rem' }}>
              {money(rows.filter(r => r.status === 'CONFIRMED')
                       .reduce((a, r) => a + (r.grand_total || 0), 0))}
            </div>
          </div>
        </div>
        <div className="summary-card glass-panel">
          <div className="summary-icon" style={{ background: '#f59e0b33', color: '#f59e0b' }}>
            <Icon size={24} />
          </div>
          <div>
            <div className="text-muted-small">Draft</div>
            <div className="big-number" style={{ fontSize: '1.5rem' }}>
              {rows.filter(r => r.status === 'DRAFT').length}
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
            {editingId === null ? 'New ' + singular : 'Edit ' + singular}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="master-form-grid">
              <div>
                <label className="text-muted-small">Document No. *</label>
                <input className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                       required value={header.doc_no}
                       placeholder={config.numberPlaceholder || 'DOC-001'}
                       onChange={e => setHeader({ ...header, doc_no: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className="text-muted-small">Date *</label>
                <input type="date" className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                       required value={header.doc_date}
                       onChange={e => setHeader({ ...header, doc_date: e.target.value })} />
              </div>
              <div>
                <label className="text-muted-small">{party.label} *</label>
                <select className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                        required value={header.partyId}
                        onChange={e => setHeader({ ...header, partyId: e.target.value })}>
                  <option value="">Select {party.label.toLowerCase()}</option>
                  {parties.map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
              {needsLocation && (
                <div>
                  <label className="text-muted-small">Warehouse *</label>
                  <select className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                          required value={header.warehouse_id}
                          onChange={e => setHeader({ ...header, warehouse_id: e.target.value })}>
                    <option value="">Select warehouse</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {parentType && (
                <div>
                  <label className="text-muted-small">{parentLabel}</label>
                  <select className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                          value={header.parent_id}
                          onChange={e => setHeader({ ...header, parent_id: e.target.value })}>
                    <option value="">None</option>
                    {parents.map(p => (
                      <option key={p.id} value={p.id}>{p.doc_no} — {p[party.key]?.name || ''}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-muted-small">Reference No.</label>
                <input className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                       value={header.reference_no} placeholder="Customer PO / ref"
                       onChange={e => setHeader({ ...header, reference_no: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className="text-muted-small">Status *</label>
                <select className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                        value={header.status}
                        onChange={e => setHeader({ ...header, status: e.target.value })}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="master-field-full">
                <label className="text-muted-small">Notes</label>
                <textarea className="config-input"
                          style={{ width: '100%', marginTop: '0.25rem', minHeight: '50px', resize: 'vertical' }}
                          value={header.notes}
                          onChange={e => setHeader({ ...header, notes: e.target.value })} />
              </div>
            </div>

            <div className="doc-lines">
              <div className="doc-lines-head">
                <h3>Line Items</h3>
                <button type="button" className="btn-ghost doc-add-line" onClick={addLine}>
                  <Plus size={14} /> Add Line
                </button>
              </div>

              <div className="data-table-container">
                <table className="data-table doc-lines-table">
                  <thead>
                    <tr>
                      <th style={{ width: '26%' }}>Product</th>
                      <th style={{ width: '10%' }}>Qty</th>
                      <th style={{ width: '13%' }}>Unit Price</th>
                      <th style={{ width: '10%' }}>Disc %</th>
                      <th style={{ width: '16%' }}>Tax</th>
                      <th style={{ width: '13%', textAlign: 'right' }}>Amount</th>
                      <th style={{ width: '6%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => {
                      const m = lineMath(line);
                      return (
                        <tr key={idx}>
                          <td>
                            <select className="config-input doc-line-input" required
                                    value={line.product_id}
                                    onChange={e => onPickProduct(idx, e.target.value)}>
                              <option value="">Select product</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>{p.ticker} — {p.name}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input type="number" step="0.01" min="0" required
                                   className="config-input doc-line-input"
                                   value={line.quantity}
                                   onChange={e => setLine(idx, { quantity: e.target.value })} />
                          </td>
                          <td>
                            <input type="number" step="0.01" min="0" required
                                   className="config-input doc-line-input"
                                   value={line.unit_price}
                                   onChange={e => setLine(idx, { unit_price: e.target.value })} />
                          </td>
                          <td>
                            <input type="number" step="0.01" min="0" max="100"
                                   className="config-input doc-line-input"
                                   value={line.discount_pct}
                                   onChange={e => setLine(idx, { discount_pct: e.target.value })} />
                          </td>
                          <td>
                            <select className="config-input doc-line-input"
                                    value={line.tax_id}
                                    onChange={e => setLine(idx, { tax_id: e.target.value })}>
                              <option value="">No tax</option>
                              {taxes.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="price-tag">{money(m.total)}</div>
                            {m.tax > 0 && (
                              <div className="text-muted-small">incl. tax {money(m.tax)}</div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button type="button" className="action-btn delete"
                                    onClick={() => removeLine(idx)} title="Remove line">
                              <Trash size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="doc-totals">
                <div><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div>
                <div><span>Tax</span><strong>{money(totals.tax)}</strong></div>
                <div className="doc-grand"><span>Grand Total</span><strong>{money(totals.total)}</strong></div>
              </div>
            </div>

            {formError && (
              <div className="master-error"><AlertTriangle size={16} /> {formError}</div>
            )}

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn-ghost" onClick={closeForm}>Cancel</button>
              <button type="submit" className="btn-primary" style={{ padding: '0.5rem 2rem' }} disabled={isSaving}>
                {isSaving ? 'Saving...' : (editingId === null ? 'Save' : 'Update')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-panel">
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Document No.</th>
                <th>Date</th>
                <th>{party.label}</th>
                {needsLocation && <th>Warehouse</th>}
                <th style={{ textAlign: 'right' }}>Lines</th>
                <th style={{ textAlign: 'right' }}>Subtotal</th>
                <th style={{ textAlign: 'right' }}>Tax</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={needsLocation ? 10 : 9} style={{ textAlign: 'center' }}>Loading...</td></tr>
              ) : loadError ? (
                <tr><td colSpan={needsLocation ? 10 : 9} style={{ textAlign: 'center', color: '#f87171' }}>{loadError}</td></tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={needsLocation ? 10 : 9} style={{ textAlign: 'center' }}>
                    {search ? 'No matches for your search.' : 'Nothing here yet. Create one above!'}
                  </td>
                </tr>
              ) : visibleRows.map(row => (
                <tr key={row.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{row.doc_no}</div>
                    {row.reference_no && (
                      <div className="text-muted-small">ref {row.reference_no}</div>
                    )}
                  </td>
                  <td className="text-muted-small">{row.doc_date}</td>
                  <td>
                    <div>{row[party.key]?.name || '-'}</div>
                    <div className="text-muted-small">{row[party.key]?.code || ''}</div>
                  </td>
                  {needsLocation && (
                    <td>{row.warehouse ? <span className="master-badge">{row.warehouse.name}</span> : '-'}</td>
                  )}
                  <td style={{ textAlign: 'right' }} className="text-muted-small">{row.line_count}</td>
                  <td style={{ textAlign: 'right' }} className="text-muted-small">{money(row.subtotal)}</td>
                  <td style={{ textAlign: 'right' }} className="text-muted-small">{money(row.tax_total)}</td>
                  <td style={{ textAlign: 'right' }}><span className="price-tag">{money(row.grand_total)}</span></td>
                  <td><span className={statusClass(row.status)}>{row.status}</span></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="action-btn edit" onClick={() => openEdit(row)} title="Edit">
                      <Edit2 size={16} />
                    </button>
                    <button className="action-btn delete" onClick={() => setPendingDelete(row)} title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pendingDelete && (
        <div className="master-modal-backdrop" onClick={() => setPendingDelete(null)}>
          <div className="master-modal glass-panel" onClick={e => e.stopPropagation()}>
            <div className="master-modal-icon"><AlertTriangle size={22} /></div>
            <h3>Delete {singular.toLowerCase()}?</h3>
            <p className="text-muted-small">
              <strong>{pendingDelete.doc_no}</strong> and its {pendingDelete.line_count} line(s)
              will be permanently removed.
              {needsLocation && ' Any stock it posted will be reversed.'}
            </p>
            {pendingDelete.error && (
              <div className="master-error"><AlertTriangle size={16} /> {pendingDelete.error}</div>
            )}
            <div className="master-modal-actions">
              <button className="btn-ghost" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
