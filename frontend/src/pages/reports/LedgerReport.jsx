import { BookOpen } from 'lucide-react';
import LedgerPage from '../../components/LedgerPage';

// The same ledger the Accounts menu serves, reached from Reports.
const config = {
  title: 'Ledger Report',
  subtitle: 'Any account, its movements and running balance over a period.',
  icon: BookOpen,
  group: null
};

export default function LedgerReport() {
  return <LedgerPage config={config} />;
}
