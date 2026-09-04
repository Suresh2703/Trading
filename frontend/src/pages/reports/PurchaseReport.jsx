import DocumentReport from './DocumentReport';
import { reportsApi } from '../../api';

const config = {
  title: 'Purchase Report',
  subtitle: 'Purchases broken down by supplier, product and month.',
  fetcher: reportsApi.purchase,
  partyLabel: 'Supplier',
  docTypes: ['INVOICE', 'ORDER', 'RECEIPT', 'RETURN', 'DEBIT_NOTE']
};

export default function PurchaseReport() {
  return <DocumentReport config={config} />;
}
