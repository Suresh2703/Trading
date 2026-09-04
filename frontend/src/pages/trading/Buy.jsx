import { TrendingUp, Package, Wallet } from 'lucide-react';
import MasterPage from '../../components/MasterPage';
import { tradesApi } from '../../api';
import {
  tradeFields, tradeSearchKeys, tradeLookups,
  tradeNoColumn, productColumn, quantityColumn, priceColumn, feesColumn,
  netValueColumn, counterpartyColumn, dateColumn, totalQty, totalNet
} from './tradeShared';

const api = tradesApi('BUY');

const config = {
  title: 'Buy',
  subtitle: 'Purchases into the trading book. Each buy opens a cost lot for FIFO.',
  singular: 'Buy Trade',
  icon: TrendingUp,
  api,
  lookups: tradeLookups,
  searchKeys: tradeSearchKeys,
  rowLabel: r => `${r.trade_no} — ${r.product?.ticker || ''}`,
  fields: tradeFields('BUY'),

  columns: [
    tradeNoColumn, productColumn, quantityColumn, priceColumn, feesColumn,
    netValueColumn, counterpartyColumn, dateColumn
  ],

  summary: [
    { label: 'Buy Trades', icon: TrendingUp, color: '#10b981', value: rows => rows.length },
    { label: 'Total Qty Bought', icon: Package, color: '#8b5cf6', value: totalQty },
    { label: 'Total Cost', icon: Wallet, color: '#f59e0b', value: totalNet }
  ]
};

export default function Buy() {
  return <MasterPage config={config} />;
}
