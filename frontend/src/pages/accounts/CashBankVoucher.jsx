import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Banknote, Landmark, Wallet, Plus, X, RefreshCw, AlertTriangle,
  ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight
} from 'lucide-react';
import { chartOfAccountsApi, accountingReports, journalEntriesApi } from '../../api';
import { useCurrency } from '../../context/CurrencyContext';
import '../../components/MasterPage.css';
import '../../components/DocumentPage.css';
import '../../components/VoucherPage.css';
import './CashBankVoucher.css';

const today = () => new Date().toISOString().slice(0, 10);
const num = v => (v === '' || v === null || v === undefined ? 0 : Number(v));

// The three things you can do with money in a cash or bank account. Each maps
// onto a two-line journal entry; `sign` says which side the cash/bank account
// takes, so the counter-account always gets the other one.
const VOUCHER_KINDS = [
  {
    key: 'RECEIPT', label: 'Receipt', icon: ArrowDownToLine, colour: '#10b981',
    hint: 'Money coming in', entryType: 'RECEIPT', cashSide: 'debit',
    counterLabel: 'Received from (credit account)'
  },
  {
    key: 'PAYMENT', label: 'Payment', icon: ArrowUpFromLine, colour: '#f87171',
    hint: 'Money going out', entryType: 'PAYMENT', cashSide: 'credit',
    counterLabel: 'Paid to (debit account)'
  },
  {
    key: 'CONTRA', label: 'Contra', icon: ArrowLeftRight, colour: '#38bdf8',
    hint: 'Between your own cash and bank', entryType: 'CONTRA', cashSide: 'credit',
    counterLabel: 'Transfer to (cash or bank account)'
  }
];

const api = journalEntriesApi(null);

/**
 * Cash & Bank in one screen: the balances across both, a voucher form for
 * recording money in, out or moved between them, and the ledger of whichever
 * account is selected.
 *
 * The form is a shortcut over the same double-entry machinery the Journal
 * screen uses — it writes a balanced two-line entry rather than a special kind
 * of record, so nothing here can produce a voucher the ledger cannot explain.
 */
export default function CashBankVoucher() {
  const [summary, setSummary] = useState(null);
  const [accounts, setAccounts] = useState([]);      // cash + bank
  const [allAccounts, setAllAccounts] = useState([]); // for the counter side
  const [selectedId, setSelectedId] = useState('');
  const [ledger, setLedger] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState('RECEIPT');
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const { symbol } = useCurrency();
  const money = v => `${symbol}${Number(v || 0).toFixed(2)}`;

  const activeKind = VOUCHER_KINDS.find(k => k.key === kind);

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await accountingReports.cashBank();
      setSummary(data);
      setAccounts(data.accounts);
      // Land on an account so the ledger below is never blank on arrival.
      setSelectedId(prev => prev || (data.accounts[0]?.account_id ?? ''));
    } catch (err) {
      setError(err.message);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  useEffect(() => {
    chartOfAccountsApi.list().then(setAllAccounts).catch(() => setAllAccounts([]));
  }, []);

  const loadLedger = useCallback(async () => {
    if (!selectedId) { setLedger(null); return; }
    try {
      setLedger(await accountingReports.ledger(`?account_id=${selectedId}`));
    } catch (err) {
      setError(err.message);
      setLedger(null);
    }
  }, [selectedId]);

  useEffect(() => { loadLedger(); }, [loadLedger]);

  const refresh = () => { loadSummary(); loadLedger(); };

  // Contra moves money between cash/bank accounts, so its counter side is
  // restricted to those; the other kinds can face any account.
  const counterAccounts = useMemo(() => {
    const notSelf = a => String(a.id) !== String(form.cash_account_id);
    if (kind === 'CONTRA') {
      return allAccounts.filter(a => ['CASH', 'BANK'].includes(a.account_group) && notSelf(a));
    }
    // Receivable and payable accounts are deliberately absent: a movement on
    // those is a party settlement, which Receivables & Payables owns.
    return allAccounts.filter(
      a => notSelf(a) && !['RECEIVABLE', 'PAYABLE'].includes(a.account_group));
  }, [kind, allAccounts, form.cash_account_id]);

  const openForm = (kindKey, accountId) => {
    setKind(kindKey);
    setForm({
      entry_no: '', entry_date: today(),
      cash_account_id: accountId || selectedId || '',
      counter_account_id: '', amount: '', reference_no: '', narration: ''
    });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setFormError(null); };

  // Preview of the two lines the voucher will write, so what is about to be
  // posted is visible before saving rather than only afterwards in the ledger.
  const preview = useMemo(() => {
    const amount = num(form.amount);
    const cash = allAccounts.find(a => String(a.id) === String(form.cash_account_id));
    const counter = allAccounts.find(a => String(a.id) === String(form.counter_account_id));
    if (!activeKind || !amount) return null;
    const cashLine = { account: cash, side: activeKind.cashSide, amount };
    const counterLine = {
      account: counter,
      side: activeKind.cashSide === 'debit' ? 'credit' : 'debit',
      amount
    };
    return [cashLine, counterLine];
  }, [form, allAccounts, activeKind]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);
    try {
      const amount = num(form.amount);
      const cashSide = activeKind.cashSide;
      const payload = {
        entry_no: form.entry_no,
        entry_type: activeKind.entryType,
        entry_date: form.entry_date,
        narration: form.narration || null,
        reference_no: form.reference_no || null,
        status: 'POSTED',
        lines: [
          {
            account_id: Number(form.cash_account_id),
            debit: cashSide === 'debit' ? amount : 0,
            credit: cashSide === 'credit' ? amount : 0
          },
          {
            account_id: Number(form.counter_account_id),
            debit: cashSide === 'debit' ? 0 : amount,
            credit: cashSide === 'debit' ? amount : 0
          }
        ]
      };
      await api.create(payload);
      closeForm();
      refresh();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const cards = summary ? [
    { label: 'Cash in Hand', icon: Banknote, color: '#10b981', value: money(summary.total_cash) },
    { label: 'Bank Balance', icon: Landmark, color: '#38bdf8', value: money(summary.total_bank) },
    { label: 'Total Liquid Funds', icon: Wallet, color: '#8b5cf6', value: money(summary.total) }
  ] : [];

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="products-header">
        <div className="page-title">
          <h1>Cash &amp; Bank Voucher</h1>
          <p>Record receipts, payments and transfers, and see every cash and bank balance in one place.</p>
        </div>
        <div className="dashboard-controls">
          <button className="btn-primary"
                  style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                  onClick={() => (showForm ? closeForm() : openForm('RECEIPT'))}>
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Cancel' : 'New Voucher'}
          </button>
          <button className="btn-ghost"
                  style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                  onClick={refresh} disabled={isLoading}>
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

      {/* Account strip — click one to switch the ledger below */}
      <div className="cb-accounts">
        {accounts.length === 0 && !isLoading ? (
          <div className="glass-panel" style={{ padding: '1.25rem', width: '100%' }}>
            <div className="text-muted-small">
              No cash or bank accounts yet. Add one in Chart of Accounts with the
              group set to CASH or BANK.
            </div>
          </div>
        ) : accounts.map(a => (
          <button key={a.account_id}
                  className={String(a.account_id) === String(selectedId)
                    ? 'cb-account glass-panel selected' : 'cb-account glass-panel'}
                  onClick={() => setSelectedId(a.account_id)}>
            <div className="cb-account-head">
              {a.account_group === 'CASH'
                ? <Banknote size={15} color="#10b981" />
                : <Landmark size={15} color="#38bdf8" />}
              <span className="cb-account-code">{a.code}</span>
            </div>
            <div className="cb-account-name">{a.name}</div>
            <div className="cb-account-balance">{money(a.balance)}</div>
          </button>
        ))}
      </div>

      {showForm && (
        <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>New Cash / Bank Voucher</h2>

          <div className="cb-kinds">
            {VOUCHER_KINDS.map(k => (
              <button type="button" key={k.key}
                      className={k.key === kind ? 'cb-kind active' : 'cb-kind'}
                      style={k.key === kind ? { borderColor: k.colour, color: k.colour } : undefined}
                      onClick={() => setForm(f => ({ ...f, counter_account_id: '' })) || setKind(k.key)}>
                <k.icon size={15} />
                <span>{k.label}</span>
                <span className="cb-kind-hint">{k.hint}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <p className="cb-scope-note">
              For settling a customer or supplier balance, use{' '}
              <strong>Receivables &amp; Payables</strong> — it picks the control
              account and records the party for you.
            </p>

            <div className="master-form-grid">
              <div>
                <label className="text-muted-small">Voucher No. *</label>
                <input className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                       required value={form.entry_no} placeholder="CB-001"
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
                  {kind === 'CONTRA' ? 'Transfer from (cash/bank) *' : 'Cash / Bank Account *'}
                </label>
                <select className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                        required value={form.cash_account_id}
                        onChange={e => setForm({ ...form, cash_account_id: e.target.value, counter_account_id: '' })}>
                  <option value="">Select account</option>
                  {accounts.map(a => (
                    <option key={a.account_id} value={a.account_id}>{a.code} — {a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-muted-small">{activeKind.counterLabel} *</label>
                <select className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                        required value={form.counter_account_id}
                        onChange={e => setForm({ ...form, counter_account_id: e.target.value })}>
                  <option value="">Select account</option>
                  {counterAccounts.map(a => (
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
                          value={form.narration} placeholder="What is this voucher for?"
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

      {/* Ledger for the selected account */}
      <div className="glass-panel">
        {ledger && (
          <div className="cb-ledger-head">
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>{ledger.code} — {ledger.name}</h3>
              <div className="text-muted-small">
                Opening {money(ledger.opening_balance)} · {ledger.lines.length} movement
                {ledger.lines.length === 1 ? '' : 's'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="text-muted-small">Closing balance</div>
              <div className="big-number" style={{ fontSize: '1.3rem' }}>
                {money(ledger.closing_balance)}
              </div>
            </div>
          </div>
        )}
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Voucher</th>
                <th>Particulars</th>
                <th>Narration</th>
                <th style={{ textAlign: 'right' }}>In</th>
                <th style={{ textAlign: 'right' }}>Out</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center' }}>Loading...</td></tr>
              ) : !ledger ? (
                <tr><td colSpan="7" style={{ textAlign: 'center' }}>
                  Select a cash or bank account above.
                </td></tr>
              ) : ledger.lines.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center' }}>
                  No movements on this account yet. Post a voucher to begin.
                </td></tr>
              ) : ledger.lines.map((l, i) => (
                <tr key={`${l.entry_id}-${i}`}>
                  <td className="text-muted-small">{l.entry_date}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{l.entry_no}</div>
                    <div className="text-muted-small">{l.entry_type}</div>
                  </td>
                  <td className="master-truncate text-muted-small" title={l.contra_accounts}>
                    {l.contra_accounts || '-'}
                  </td>
                  <td className="master-truncate text-muted-small" title={l.narration || ''}>
                    {l.narration || '-'}
                  </td>
                  <td style={{ textAlign: 'right', color: l.debit ? '#10b981' : undefined }}>
                    {l.debit ? money(l.debit) : '-'}
                  </td>
                  <td style={{ textAlign: 'right', color: l.credit ? '#f87171' : undefined }}>
                    {l.credit ? money(l.credit) : '-'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="price-tag">{money(l.running_balance)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            {ledger && ledger.lines.length > 0 && (
              <tfoot>
                <tr className="report-total-row">
                  <td colSpan="4">Closing Balance</td>
                  <td style={{ textAlign: 'right' }}>{money(ledger.total_debit)}</td>
                  <td style={{ textAlign: 'right' }}>{money(ledger.total_credit)}</td>
                  <td style={{ textAlign: 'right' }}>{money(ledger.closing_balance)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
