import { ArrowLeftRight } from 'lucide-react';
import VoucherPage from '../../components/VoucherPage';
import { journalEntriesApi } from '../../api';

// One screen over both voucher types: money out and money in.
const ENTRY_TYPES = ['RECEIPT', 'PAYMENT'];
const api = journalEntriesApi(ENTRY_TYPES);

const config = {
  title: 'Payments & Receipts',
  subtitle: 'Money in and money out that is not a customer or supplier settlement.',
  singular: 'Voucher',
  icon: ArrowLeftRight,
  api,
  entryTypes: ENTRY_TYPES,
  numberPlaceholder: 'RC-001 / PV-001',
  // Party settlements are owned by Receivables & Payables, so this register
  // handles the rest: rent, utilities, drawings, other income.
  blockedAccountGroups: ['RECEIVABLE', 'PAYABLE'],
  showParty: false
};

export default function PaymentsReceipts() {
  return <VoucherPage config={config} />;
}
