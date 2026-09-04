import { FileText } from 'lucide-react';
import VoucherPage from '../../components/VoucherPage';
import { journalEntriesApi } from '../../api';

const api = journalEntriesApi('JOURNAL');

const config = {
  title: 'Journal Entries',
  subtitle: 'Free-form double-entry vouchers. Debits must equal credits.',
  singular: 'Journal Entry',
  icon: FileText,
  api,
  entryType: 'JOURNAL',
  numberPlaceholder: 'JV-001'
};

export default function JournalEntries() {
  return <VoucherPage config={config} />;
}
