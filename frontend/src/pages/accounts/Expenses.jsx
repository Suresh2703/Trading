import { Receipt } from 'lucide-react';
import VoucherPage from '../../components/VoucherPage';
import { journalEntriesApi } from '../../api';

const api = journalEntriesApi('EXPENSE');

const config = {
  title: 'Expenses',
  subtitle: 'Costs incurred, whether paid now or accrued.',
  singular: 'Expense',
  icon: Receipt,
  api,
  entryType: 'EXPENSE',
  numberPlaceholder: 'EX-001'
};

export default function Expenses() {
  return <VoucherPage config={config} />;
}
