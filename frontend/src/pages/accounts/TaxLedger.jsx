import { Percent } from 'lucide-react';
import LedgerPage from '../../components/LedgerPage';

const config = {
  title: 'GST / Tax',
  subtitle: 'Input and output tax accounts — what you can reclaim and what you owe.',
  icon: Percent,
  group: 'TAX'
};

export default function TaxLedger() {
  return <LedgerPage config={config} />;
}
