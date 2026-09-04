import { BookOpen } from 'lucide-react';
import LedgerPage from '../../components/LedgerPage';

const config = {
  title: 'General Ledger',
  subtitle: 'Pick any account to see its movements and running balance.',
  icon: BookOpen,
  group: null
};

export default function GeneralLedger() {
  return <LedgerPage config={config} />;
}
