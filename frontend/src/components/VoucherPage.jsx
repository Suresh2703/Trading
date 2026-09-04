import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, X, AlertTriangle, Trash, Check } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import { chartOfAccountsApi, customersApi, suppliersApi } from '../api';
import './MasterPage.css';
import './DocumentPage.css';
import './VoucherPage.css';
import '../pages/accounts/CashBankVoucher.css';

const STATUSES = ['POSTED', 'DRAFT', 'CANCELLED'];
const today = () => new Date().toISOString().slice(0, 10);
const blankLine = () => ({ account_id: '', debit: '', credit: '', line_narration: '' });
const num = v => (v === '' || v === null || v === undefined ? 0 : Number(v));

/**
 * A double-entry voucher screen: header plus debit/credit lines.
 *
 * Journals, payments, receipts and expenses are all the same record with a
 * different `entry_type`, so one component serves all four. The running
 * debit/credit totals are shown live because an entry that does not balance
 * cannot be saved — better to see it before pressing Save than after.
 */
export default function VoucherPage({ config }) {
  const {
    title, subtitle, singular, icon: Icon, api, entryType, numberPlaceholder,
    // A screen may cover several voucher types (payments and receipts on one
    // page). With one type the tabs and the Type column stay hidden.
    entryTypes = null,
    // Groups this screen must not post to, because another screen owns them.
    blockedAccountGroups = [],
    // Party fields belong to the screen that owns party settlements.
    showParty = true
  } = config;
  const multiType = Array.isArray(entryTypes) && entryTypes.length > 1;

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
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [accounts, setAccounts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const { symbol } = useCurrency();
  const money = v => `${symbol}${Number(v || 0).toFixed(2)}`;

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
      chartOfAccountsApi.list().catch(() => []),
      customersApi.list().catch(() => []),
      suppliersApi.list().catch(() => [])
    ]).then(([a, c, s]) => {
      if (cancelled) return;
      setAccounts(a); setCustomers(c); setSuppliers(s);
    });
    return () => { cancelled = true; };
  }, []);

  const totals = useMemo(() => {
    const debit = lines.reduce((a, l) => a + num(l.debit), 0);
    const credit = lines.reduce((a, l) => a + num(l.credit), 0);
    return { debit, credit, difference: debit - credit };
  }, [lines]);

  const balanced = Math.abs(totals.difference) < 0.005 && totals.debit > 0;

  const parties = header.party_type === 'SUPPLIER' ? suppliers : customers;

  const openCreate = () => {
    setEditingId(null);
    setHeader({
      entry_no: '', entry_date: today(), narration: '', reference_no: '',
      party_type: '', party_id: '', status: 'POSTED',
      entry_type: multiType
        ? (typeFilter !== 'ALL' ? typeFilter : entryTypes[0])
        : entryType
    });
    setLines([blankLine(), blankLine()]);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setHeader({
      entry_no: row.entry_no ?? '',
      entry_type: row.entry_type ?? entryType,
      entry_date: row.entry_date ?? today(),
      narration: row.narration ?? '',
      reference_no: row.reference_no ?? '',
      party_type: row.party_type ?? '',
      party_id: row.party_id ?? '',
      status: row.status ?? 'POSTED'
    });
    setLines((row.lines || []).map(l => ({
      account_id: l.account_id ?? '',
      debit: l.debit ? String(l.debit) : '',
      credit: l.credit ? String(l.credit) : '',
      line_narration: l.line_narration ?? ''
    })));
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); setFormError(null); };

  const setLine = (idx, patch) =>
    setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const addLine = () => setLines([...lines, blankLine()]);

  const removeLine = (idx) =>
    setLines(lines.length <= 2 ? lines : lines.filter((_, i) => i !== idx));

  // A line carries one side only, so entering one clears the other.
  const setDebit = (idx, value) => setLine(idx, { debit: value, credit: '' });
  const setCredit = (idx, value) => setLine(idx, { credit: value, debit: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);
    try {
      const payload = {
        entry_no: header.entry_no,
        // Only meaningful on a multi-type page; the api binds it otherwise.
        ...(multiType ? { entry_type: header.entry_type } : {}),
        entry_date: header.entry_date,
        narration: header.narration || null,
        reference_no: header.reference_no || null,
        party_type: header.party_type || null,
        party_id: header.party_id ? Number(header.party_id) : null,
        status: header.status,
        lines: lines.map(l => ({
          account_id: Number(l.account_id),
          debit: num(l.debit),
          credit: num(l.credit),
          line_narration: l.line_narration || null
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
    const byType = typeFilter === 'ALL'
      ? rows : rows.filter(r => r.entry_type === typeFilter);
    if (!term) return byType;
    return byType.filter(r =>
      [r.entry_no, r.narration, r.reference_no, r.status, r.party_name]
        .some(v => String(v ?? '').toLowerCase().includes(term))
    );
  }, [rows, search, typeFilter]);

  const statusClass = s =>
    s === 'POSTED' ? 'doc-status confirmed'
      : s === 'CANCELLED' ? 'doc-status cancelled' : 'doc-status draft';

  const accountLabel = a => `${a.code} — ${a.name}`;

  const selectableAccounts = useMemo(() => (
    blockedAccountGroups.length === 0
      ? accounts
      : accounts.filter(a => !blockedAccountGroups.includes(a.account_group))
  ), [accounts, blockedAccountGroups]);

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
            <input type="text" placeholder={'Search ' + title.toLowerCase() + '...'}
                   value={search} onChange={e => setSearch(e.target.value)}
                   style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', marginLeft: '0.5rem' }} />
          </div>
          <button className="btn-primary"
                  style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                  onClick={() => (showForm ? closeForm() : openCreate())}>
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
            <div className="text-muted-small">Posted Value</div>
            <div className="big-number" style={{ fontSize: '1.5rem' }}>
              {money(rows.filter(r => r.status === 'POSTED')
                       .reduce((a, r) => a + (r.total_debit || 0), 0))}
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

      {multiType && (
        <div className="financial-tabs">
          {['ALL', ...entryTypes].map(t => (
            <button key={t}
                    className={t === typeFilter ? 'financial-tab active' : 'financial-tab'}
                    onClick={() => setTypeFilter(t)}>
              {t === 'ALL' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase() + 's'}
              <span className="rp-tab-count">
                {t === 'ALL' ? rows.length : rows.filter(r => r.entry_type === t).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
            {editingId === null ? 'New ' + singular : 'Edit ' + singular}
            {multiType && header.entry_type
              ? ` — ${header.entry_type.charAt(0)}${header.entry_type.slice(1).toLowerCase()}`
              : ''}
          </h2>
          <form onSubmit={handleSubmit}>
            {multiType && (
              <div className="vp-types">
                {entryTypes.map(t => (
                  <button type="button" key={t}
                          className={t === header.entry_type ? 'vp-type active' : 'vp-type'}
                          onClick={() => setHeader({ ...header, entry_type: t })}>
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            )}
            {blockedAccountGroups.length > 0 && (
              <p className="cb-scope-note">
                Receivable and payable accounts are not listed here — settling a
                customer or supplier balance belongs to{' '}
                <strong>Receivables &amp; Payables</strong>.
              </p>
            )}

            <div className="master-form-grid">
              <div>
                <label className="text-muted-small">Voucher No. *</label>
                <input className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                       required value={header.entry_no} placeholder={numberPlaceholder}
                       onChange={e => setHeader({ ...header, entry_no: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className="text-muted-small">Date *</label>
                <input type="date" className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                       required value={header.entry_date}
                       onChange={e => setHeader({ ...header, entry_date: e.target.value })} />
              </div>
              <div>
                <label className="text-muted-small">Reference No.</label>
                <input className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                       value={header.reference_no} placeholder="Cheque / bill ref"
                       onChange={e => setHeader({ ...header, reference_no: e.target.value.toUpperCase() })} />
              </div>
{showParty && (<>
              <div>
                <label className="text-muted-small">Party Type</label>
                <select className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                        value={header.party_type}
                        onChange={e => setHeader({ ...header, party_type: e.target.value, party_id: '' })}>
                  <option value="">None</option>
                  <option value="CUSTOMER">Customer</option>
                  <option value="SUPPLIER">Supplier</option>
                </select>
              </div>
              {header.party_type && (
                <div>
                  <label className="text-muted-small">
                    {header.party_type === 'SUPPLIER' ? 'Supplier' : 'Customer'}
                  </label>
                  <select className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                          value={header.party_id}
                          onChange={e => setHeader({ ...header, party_id: e.target.value })}>
                    <option value="">Select</option>
                    {parties.map(p => (
                      <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                    ))}
                  </select>
                </div>
              )}
</>)}
              <div>
                <label className="text-muted-small">Status *</label>
                <select className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                        value={header.status}
                        onChange={e => setHeader({ ...header, status: e.target.value })}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="master-field-full">
                <label className="text-muted-small">Narration</label>
                <textarea className="config-input"
                          style={{ width: '100%', marginTop: '0.25rem', minHeight: '50px', resize: 'vertical' }}
                          value={header.narration} placeholder="What is this voucher for?"
                          onChange={e => setHeader({ ...header, narration: e.target.value })} />
              </div>
            </div>

            <div className="doc-lines">
              <div className="doc-lines-head">
                <h3>Entries</h3>
                <button type="button" className="btn-ghost doc-add-line" onClick={addLine}>
                  <Plus size={14} /> Add Line
                </button>
              </div>

              <div className="data-table-container">
                <table className="data-table doc-lines-table">
                  <thead>
                    <tr>
                      <th style={{ width: '34%' }}>Account</th>
                      <th style={{ width: '24%' }}>Narration</th>
                      <th style={{ width: '17%', textAlign: 'right' }}>Debit</th>
                      <th style={{ width: '17%', textAlign: 'right' }}>Credit</th>
                      <th style={{ width: '8%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={idx}>
                        <td>
                          <select className="config-input doc-line-input" required
                                  value={line.account_id}
                                  onChange={e => setLine(idx, { account_id: e.target.value })}>
                            <option value="">Select account</option>
                            {selectableAccounts.map(a => (
                              <option key={a.id} value={a.id}>{accountLabel(a)}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input className="config-input doc-line-input" placeholder="Optional"
                                 value={line.line_narration}
                                 onChange={e => setLine(idx, { line_narration: e.target.value })} />
                        </td>
                        <td>
                          <input type="number" step="0.01" min="0"
                                 className="config-input doc-line-input voucher-amount"
                                 value={line.debit}
                                 onChange={e => setDebit(idx, e.target.value)} />
                        </td>
                        <td>
                          <input type="number" step="0.01" min="0"
                                 className="config-input doc-line-input voucher-amount"
                                 value={line.credit}
                                 onChange={e => setCredit(idx, e.target.value)} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button type="button" className="action-btn delete"
                                  onClick={() => removeLine(idx)} title="Remove line"
                                  disabled={lines.length <= 2}>
                            <Trash size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={balanced ? 'voucher-balance balanced' : 'voucher-balance'}>
                <div className="voucher-balance-figures">
                  <div><span>Total Debit</span><strong>{money(totals.debit)}</strong></div>
                  <div><span>Total Credit</span><strong>{money(totals.credit)}</strong></div>
                </div>
                <div className="voucher-balance-state">
                  {balanced ? (
                    <><Check size={16} /> Balanced</>
                  ) : (
                    <><AlertTriangle size={16} /> Out by {money(Math.abs(totals.difference))}</>
                  )}
                </div>
              </div>
            </div>

            {formError && (
              <div className="master-error"><AlertTriangle size={16} /> {formError}</div>
            )}

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn-ghost" onClick={closeForm}>Cancel</button>
              <button type="submit" className="btn-primary" style={{ padding: '0.5rem 2rem' }}
                      disabled={isSaving || !balanced}
                      title={balanced ? undefined : 'Debits must equal credits'}>
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
                <th>Voucher No.</th>
                <th>Date</th>
                <th>Narration</th>
                {(multiType || !entryType) && <th>Type</th>}
                <th>Party</th>
                <th style={{ textAlign: 'right' }}>Debit</th>
                <th style={{ textAlign: 'right' }}>Credit</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="9" style={{ textAlign: 'center' }}>Loading...</td></tr>
              ) : loadError ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', color: '#f87171' }}>{loadError}</td></tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center' }}>
                    {search ? 'No matches for your search.' : 'Nothing here yet. Create one above!'}
                  </td>
                </tr>
              ) : visibleRows.map(row => (
                <tr key={row.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{row.entry_no}</div>
                    {row.reference_no && <div className="text-muted-small">ref {row.reference_no}</div>}
                  </td>
                  <td className="text-muted-small">{row.entry_date}</td>
                  <td className="master-truncate text-muted-small" title={row.narration || ''}>
                    {row.narration || '-'}
                  </td>
                  {(multiType || !entryType) && (
                    <td><span className="master-badge muted">{row.entry_type}</span></td>
                  )}
                  <td className="text-muted-small">{row.party_name || '-'}</td>
                  <td style={{ textAlign: 'right' }}><span className="price-tag">{money(row.total_debit)}</span></td>
                  <td style={{ textAlign: 'right' }} className="text-muted-small">{money(row.total_credit)}</td>
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
              <strong>{pendingDelete.entry_no}</strong> and its {pendingDelete.line_count} line(s)
              will be permanently removed from the ledger.
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
