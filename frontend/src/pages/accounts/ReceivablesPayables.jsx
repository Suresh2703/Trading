import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  HandCoins, CreditCard, Scale, Plus, X, RefreshCw, AlertTriangle
} from 'lucide-react';
import {
  reportsApi, accountingReports, chartOfAccountsApi, journalEntriesApi,
  customersApi, suppliersApi
} from '../../api';
import { useCurrency } from '../../context/CurrencyContext';
import '../../components/MasterPage.css';
import '../../components/DocumentPage.css';
import '../../components/VoucherPage.css';
import './CashBankVoucher.css';
import './ReceivablesPayables.css';

const today = () => new Date().toISOString().slice(0, 10);
const num = v => (v === '' || v === null || v === undefined ? 0 : Number(v));

// The two sides of the same screen. `settleSide` is the side the control
// account takes when the balance is settled: collecting from a customer
// credits receivables, paying a supplier debits payables.
const SIDES = {
  RECEIVABLE: {
    key: 'RECEIVABLE',
    label: 'Receivables',
    partyLabel: 'Customer',
    partyType: 'CUSTOMER',
    colour: '#10b981',
    icon: HandCoins,
    blurb: 'Owed to you by customers',
    action: 'Record Receipt',
    actionVerb: 'received from',
    entryType: 'RECEIPT',
    controlGroup: 'RECEIVABLE',
    settleSide: 'credit',      // Cr receivables, Dr cash/bank
    empty: 'Nothing outstanding from customers.'
  },
  PAYABLE: {
    key: 'PAYABLE',
    label: 'Payables',
    partyLabel: 'Supplier',
    partyType: 'SUPPLIER',
    colour: '#f87171',
    icon: CreditCard,
    blurb: 'Owed by you to suppliers',
    action: 'Record Payment',
    actionVerb: 'paid to',
    entryType: 'PAYMENT',
    controlGroup: 'PAYABLE',
    settleSide: 'debit',       // Dr payables, Cr cash/bank
    empty: 'Nothing outstanding to suppliers.'
  }
};

const api = journalEntriesApi(null);

/**
 * Receivables and Payables on one screen.
 *
 * The Outstanding report already shows both side by side; this is the working
 * version — pick a party, read their statement, and settle the balance without
 * leaving the page. Settlement writes an ordinary balanced journal entry, so
 * the ledger, trial balance and the report all move together.
 */
export default function ReceivablesPayables() {
  const [side, setSide] = useState('RECEIVABLE');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selected, setSelected] = useState(null);   // the party row
  const [statement, setStatement] = useState([]);
  const [statementLoading, setStatementLoading] = useState(false);

  const [controlAccounts, setControlAccounts] = useState([]);
  const [cashBankAccounts, setCashBankAccounts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const { symbol } = useCurrency();
  const money = v => `${symbol}${Number(v || 0).toFixed(2)}`;

  const config = SIDES[side];

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // One call returns both sides, so switching tabs needs no extra request.
      setData(await reportsApi.outstanding());
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    chartOfAccountsApi.list('?account_groups=CASH,BANK')
      .then(setCashBankAccounts).catch(() => setCashBankAccounts([]));
    customersApi.list().then(setCustomers).catch(() => setCustomers([]));
    suppliersApi.list().then(setSuppliers).catch(() => setSuppliers([]));
  }, []);

  // The control accounts differ per side, so refetch when the tab changes.
  useEffect(() => {
    chartOfAccountsApi.list(`?account_group=${config.controlGroup}`)
      .then(setControlAccounts).catch(() => setControlAccounts([]));
  }, [config.controlGroup]);

  const rows = useMemo(() => (
    data ? (side === 'RECEIVABLE' ? data.receivables : data.payables) : []
  ), [data, side]);

  const total = side === 'RECEIVABLE'
    ? (data?.total_receivable ?? 0)
    : (data?.total_payable ?? 0);

  // Selecting a party pulls their vouchers so the balance can be explained.
  const loadStatement = useCallback(async (row) => {
    if (!row?.party_id) { setStatement([]); return; }
    setStatementLoading(true);
    try {
      const params = new URLSearchParams({
        party_type: row.party_type, party_id: row.party_id
      });
      setStatement(await api.listRange(`?${params}`));
    } catch {
      setStatement([]);
    } finally {
      setStatementLoading(false);
    }
  }, []);

  const selectParty = (row) => {
    setSelected(row);
    loadStatement(row);
  };

  // Switching side clears the selection — a customer makes no sense under Payables.
  const switchSide = (next) => {
    setSide(next);
    setSelected(null);
    setStatement([]);
    setShowForm(false);
  };

  const openForm = (row) => {
    const target = row || selected;
    setForm({
      entry_no: '',
      entry_date: today(),
      // A settlement always belongs to someone: seeded from the row when the
      // form is opened from one, chosen explicitly otherwise.
      party_id: target?.party_id ? String(target.party_id) : '',
      control_account_id: controlAccounts[0]?.id ?? '',
      cash_account_id: cashBankAccounts[0]?.id ?? '',
      amount: target?.balance ? String(Math.abs(target.balance)) : '',
      reference_no: '',
      narration: ''
    });
    if (target) setSelected(target);
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setFormError(null); };

  const preview = useMemo(() => {
    const amount = num(form.amount);
    if (!amount) return null;
    const control = controlAccounts.find(a => String(a.id) === String(form.control_account_id));
    const cash = cashBankAccounts.find(a => String(a.id) === String(form.cash_account_id));
    // Settling receivables credits them and debits cash; payables the reverse.
    return config.settleSide === 'credit'
      ? [{ account: cash, side: 'debit', amount },
         { account: control, side: 'credit', amount }]
      : [{ account: control, side: 'debit', amount },
         { account: cash, side: 'credit', amount }];
  }, [form, controlAccounts, cashBankAccounts, config.settleSide]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);
    try {
      const amount = num(form.amount);
      const control = { account_id: Number(form.control_account_id) };
      const cash = { account_id: Number(form.cash_account_id) };
      const lines = config.settleSide === 'credit'
        ? [{ ...cash, debit: amount, credit: 0 },
           { ...control, debit: 0, credit: amount }]
        : [{ ...control, debit: amount, credit: 0 },
           { ...cash, debit: 0, credit: amount }];

      await api.create({
        entry_no: form.entry_no,
        entry_type: config.entryType,
        entry_date: form.entry_date,
        narration: form.narration || null,
        reference_no: form.reference_no || null,
        party_type: config.partyType,
        party_id: Number(form.party_id),
        status: 'POSTED',
        lines
      });
      closeForm();
      await load();
      if (selected) loadStatement(selected);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const partyOptions = side === 'RECEIVABLE' ? customers : suppliers;

  // Outstanding for whichever party the form is pointed at, so the amount can
  // be sanity-checked against the balance even when picked from the dropdown.
  const outstandingFor = (partyId) => {
    if (!partyId) return null;
    const row = rows.find(r => String(r.party_id) === String(partyId));
    return row ? row.balance : 0;
  };

  const net = data ? (data.total_receivable - data.total_payable) : 0;

  const cards = data ? [
    { label: 'Total Receivable', icon: HandCoins, color: '#10b981',
      value: money(data.total_receivable), hint: 'Owed to you by customers' },
    { label: 'Total Payable', icon: CreditCard, color: '#f87171',
      value: money(data.total_payable), hint: 'Owed by you to suppliers' },
    { label: net >= 0 ? 'Net Receivable' : 'Net Payable', icon: Scale,
      color: net >= 0 ? '#10b981' : '#f87171',
      value: money(Math.abs(net)), hint: 'Receivables less payables' }
  ] : [];

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="products-header">
        <div className="page-title">
          <h1>Receivables &amp; Payables</h1>
          <p>Who owes what, and settle it — from the receivable and payable control accounts.</p>
        </div>
        <div className="dashboard-controls">
          <button className="btn-primary"
                  style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                  onClick={() => (showForm ? closeForm() : openForm(null))}
                  disabled={controlAccounts.length === 0}>
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Cancel' : config.action}
          </button>
          <button className="btn-ghost"
                  style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                  onClick={load} disabled={isLoading}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {cards.length > 0 && (
        <div className="summary-cards">
          {cards.map((c, i) => (
            <div className="summary-card glass-panel" key={i}>
              <div className="summary-icon" style={{ background: c.color + '33', color: c.color }}>
                <c.icon size={24} />
              </div>
              <div>
                <div className="text-muted-small">{c.label}</div>
                <div className="big-number" style={{ fontSize: '1.4rem' }}>{c.value}</div>
                <div className="text-muted-small pnl-hint">{c.hint}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div className="master-error"><AlertTriangle size={16} /> {error}</div>
        </div>
      )}

      <div className="financial-tabs">
        {Object.values(SIDES).map(s => (
          <button key={s.key}
                  className={s.key === side ? 'financial-tab active' : 'financial-tab'}
                  onClick={() => switchSide(s.key)}>
            {s.label}
            <span className="rp-tab-count">
              {data ? (s.key === 'RECEIVABLE' ? data.receivables.length : data.payables.length) : 0}
            </span>
          </button>
        ))}
      </div>

      {showForm && (
        <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.35rem' }}>{config.action}</h2>
          <p className="text-muted-small" style={{ marginBottom: '1rem' }}>
            {outstandingFor(form.party_id) !== null
              ? `Outstanding for this ${config.partyLabel.toLowerCase()}: `
                + money(outstandingFor(form.party_id))
              : `Choose the ${config.partyLabel.toLowerCase()} this settlement belongs to.`}
          </p>

          <form onSubmit={handleSubmit}>
            <div className="master-form-grid">
              <div>
                <label className="text-muted-small">{config.partyLabel} *</label>
                <select className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                        required value={form.party_id}
                        onChange={e => setForm({ ...form, party_id: e.target.value })}>
                  <option value="">Select {config.partyLabel.toLowerCase()}</option>
                  {partyOptions.map(p => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-muted-small">Voucher No. *</label>
                <input className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                       required value={form.entry_no}
                       placeholder={side === 'RECEIVABLE' ? 'RC-001' : 'PV-001'}
                       onChange={e => setForm({ ...form, entry_no: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className="text-muted-small">Date *</label>
                <input type="date" className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                       required value={form.entry_date}
                       onChange={e => setForm({ ...form, entry_date: e.target.value })} />
              </div>
              <div>
                <label className="text-muted-small">
                  {side === 'RECEIVABLE' ? 'Receivable Account *' : 'Payable Account *'}
                </label>
                <select className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                        required value={form.control_account_id}
                        onChange={e => setForm({ ...form, control_account_id: e.target.value })}>
                  <option value="">Select account</option>
                  {controlAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-muted-small">
                  {side === 'RECEIVABLE' ? 'Received into *' : 'Paid from *'}
                </label>
                <select className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                        required value={form.cash_account_id}
                        onChange={e => setForm({ ...form, cash_account_id: e.target.value })}>
                  <option value="">Select cash / bank account</option>
                  {cashBankAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-muted-small">Amount *</label>
                <input type="number" step="0.01" min="0.01" required
                       className="config-input voucher-amount"
                       style={{ width: '100%', marginTop: '0.25rem' }}
                       value={form.amount} placeholder="0.00"
                       onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <label className="text-muted-small">Reference No.</label>
                <input className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                       value={form.reference_no} placeholder="Cheque / UTR"
                       onChange={e => setForm({ ...form, reference_no: e.target.value.toUpperCase() })} />
              </div>
              <div className="master-field-full">
                <label className="text-muted-small">Narration</label>
                <textarea className="config-input"
                          style={{ width: '100%', marginTop: '0.25rem', minHeight: '48px', resize: 'vertical' }}
                          value={form.narration} placeholder="What is this settlement for?"
                          onChange={e => setForm({ ...form, narration: e.target.value })} />
              </div>
            </div>

            {preview && (
              <div className="cb-preview">
                <div className="cb-preview-title">This will post</div>
                {preview.map((line, i) => (
                  <div className="cb-preview-line" key={i}>
                    <span className={line.side === 'debit' ? 'cb-side dr' : 'cb-side cr'}>
                      {line.side === 'debit' ? 'Dr' : 'Cr'}
                    </span>
                    <span className="cb-preview-account">
                      {line.account ? `${line.account.code} — ${line.account.name}` : 'Select an account'}
                    </span>
                    <span className="cb-preview-amount">{money(line.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {formError && (
              <div className="master-error"><AlertTriangle size={16} /> {formError}</div>
            )}

            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn-ghost" onClick={closeForm}>Cancel</button>
              <button type="submit" className="btn-primary" style={{ padding: '0.5rem 2rem' }}
                      disabled={isSaving}>
                {isSaving ? 'Posting...' : 'Post Voucher'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rp-split">
        {/* Party list */}
        <div className="glass-panel">
          <div className="cb-ledger-head">
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>{config.label}</h3>
              <div className="text-muted-small">{config.blurb}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="text-muted-small">Total</div>
              <div className="big-number" style={{ fontSize: '1.2rem', color: config.colour }}>
                {money(total)}
              </div>
            </div>
          </div>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{config.partyLabel}</th>
                  <th style={{ textAlign: 'right' }}>Debit</th>
                  <th style={{ textAlign: 'right' }}>Credit</th>
                  <th style={{ textAlign: 'right' }}>Outstanding</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center' }}>Loading...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center' }}>{config.empty}</td></tr>
                ) : rows.map((r, i) => (
                  <tr key={i}
                      className={selected?.party_id === r.party_id && selected?.party_type === r.party_type
                        ? 'rp-row selected' : 'rp-row'}
                      onClick={() => selectParty(r)}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.party_name}</div>
                      <div className="text-muted-small">{r.party_type}</div>
                    </td>
                    <td style={{ textAlign: 'right' }} className="text-muted-small">{money(r.debit)}</td>
                    <td style={{ textAlign: 'right' }} className="text-muted-small">{money(r.credit)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, color: r.balance >= 0 ? config.colour : '#94a3b8' }}>
                        {money(r.balance)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn-ghost rp-settle"
                              onClick={e => { e.stopPropagation(); openForm(r); }}>
                        Settle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="report-grand-row">
                    <td colSpan="3">Total</td>
                    <td style={{ textAlign: 'right' }}>{money(total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Statement for the selected party */}
        <div className="glass-panel">
          <div className="cb-ledger-head">
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>
                {selected ? selected.party_name : 'Party Statement'}
              </h3>
              <div className="text-muted-small">
                {selected
                  ? `${statement.length} voucher${statement.length === 1 ? '' : 's'}`
                  : `Select a ${config.partyLabel.toLowerCase()} to see their vouchers`}
              </div>
            </div>
            {selected && (
              <div style={{ textAlign: 'right' }}>
                <div className="text-muted-small">Outstanding</div>
                <div className="big-number" style={{ fontSize: '1.2rem' }}>
                  {money(selected.balance)}
                </div>
              </div>
            )}
          </div>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Voucher</th>
                  <th>Narration</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {!selected ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center' }}>
                    Nothing selected.
                  </td></tr>
                ) : statementLoading ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center' }}>Loading...</td></tr>
                ) : statement.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center' }}>
                    No vouchers recorded against this {config.partyLabel.toLowerCase()}.
                  </td></tr>
                ) : statement.map(e => (
                  <tr key={e.id}>
                    <td className="text-muted-small">{e.entry_date}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{e.entry_no}</div>
                      <div className="text-muted-small">{e.entry_type}</div>
                    </td>
                    <td className="master-truncate text-muted-small" title={e.narration || ''}>
                      {e.narration || '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="price-tag">{money(e.total_debit)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
