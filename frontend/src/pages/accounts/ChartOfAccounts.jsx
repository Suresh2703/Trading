import { BookOpen, CheckCircle2, Layers } from 'lucide-react';
import MasterPage from '../../components/MasterPage';
import { chartOfAccountsApi } from '../../api';
import { statusCell, badgeCell, truncateCell, activeField } from '../../components/masterCells';

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

// CASH, BANK, RECEIVABLE, PAYABLE and TAX drive the ledger and outstanding
// screens; the rest only affect how accounts are grouped for reading.
const ACCOUNT_GROUPS = [
  'CASH', 'BANK', 'RECEIVABLE', 'PAYABLE', 'TAX',
  'CURRENT_ASSET', 'FIXED_ASSET', 'CURRENT_LIABILITY', 'LOAN',
  'CAPITAL', 'RESERVE', 'DIRECT_INCOME', 'INDIRECT_INCOME',
  'DIRECT_EXPENSE', 'INDIRECT_EXPENSE', 'OTHER'
];

const config = {
  title: 'Chart of Accounts',
  subtitle: 'Every account the ledger can post to.',
  singular: 'Account',
  icon: BookOpen,
  api: chartOfAccountsApi,
  searchKeys: ['code', 'name', 'account_type', 'account_group', 'description'],
  rowLabel: r => `${r.code} — ${r.name}`,
  lookups: { accounts: chartOfAccountsApi },

  fields: [
    { key: 'code', label: 'Account Code', required: true, placeholder: 'e.g. 1000' },
    { key: 'name', label: 'Account Name', required: true, placeholder: 'e.g. Cash in Hand' },
    { key: 'account_type', label: 'Type', type: 'select', required: true, options: ACCOUNT_TYPES },
    { key: 'account_group', label: 'Group', type: 'select', required: true, options: ACCOUNT_GROUPS },
    {
      key: 'parent_id',
      label: 'Parent Account',
      lookup: { from: 'accounts', valueKey: 'id', label: a => `${a.code} — ${a.name}` },
      placeholder: 'None (top level)'
    },
    // Non-nullable float server-side, so a blank must become 0 rather than null.
    { key: 'opening_balance', label: 'Opening Balance', type: 'number', step: '0.01', placeholder: '0.00', emptyValue: 0 },
    { key: 'opening_is_debit', label: 'Opening is a debit', type: 'checkbox' },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'What gets posted here?', fullWidth: true },
    activeField
  ],

  columns: [
    { key: 'code', label: 'Code', render: r => <span style={{ fontWeight: 600 }}>{r.code}</span> },
    { key: 'name', label: 'Account Name' },
    { key: 'account_type', label: 'Type', render: r => badgeCell(r.account_type) },
    {
      key: 'account_group',
      label: 'Group',
      render: r => badgeCell((r.account_group || '').replace(/_/g, ' '), true)
    },
    {
      key: 'opening_balance',
      label: 'Opening',
      align: 'right',
      render: (r, ctx) => (r.opening_balance
        ? (
          <span className="text-muted-small">
            {ctx.symbol}{Number(r.opening_balance).toFixed(2)} {r.opening_is_debit ? 'Dr' : 'Cr'}
          </span>
        )
        : <span className="text-muted-small">-</span>)
    },
    { key: 'description', label: 'Description', render: r => truncateCell(r.description) },
    { key: 'is_active', label: 'Status', render: statusCell }
  ],

  summary: [
    { label: 'Accounts', icon: BookOpen, color: '#8b5cf6', value: rows => rows.length },
    { label: 'Active', icon: CheckCircle2, color: '#10b981', value: rows => rows.filter(r => r.is_active).length },
    {
      label: 'Account Types',
      icon: Layers,
      color: '#f59e0b',
      value: rows => new Set(rows.map(r => r.account_type)).size
    }
  ]
};

export default function ChartOfAccounts() {
  return <MasterPage config={config} />;
}
