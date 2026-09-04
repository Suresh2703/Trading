import { TrendingDown, Package, Wallet } from 'lucide-react';
import MasterPage from '../../components/MasterPage';
import { tradesApi } from '../../api';
import {
  tradeFields, tradeSearchKeys, tradeLookups,
  tradeNoColumn, productColumn, quantityColumn, priceColumn, feesColumn,
  netValueColumn, realizedColumn, dateColumn, totalQty, totalNet
} from './tradeShared';

const api = tradesApi('SELL');

const config = {
  title: 'Sell',
  subtitle: 'Sales out of the trading book. Profit is realized FIFO against the oldest buy lots.',
  singular: 'Sell Trade',
  icon: TrendingDown,
  api,
  lookups: tradeLookups,
  searchKeys: tradeSearchKeys,
  rowLabel: r => `${r.trade_no} — ${r.product?.ticker || ''}`,
  fields: tradeFields('SELL'),

  columns: [
    tradeNoColumn, productColumn, quantityColumn, priceColumn, feesColumn,
    netValueColumn, realizedColumn, dateColumn
  ],

  summary: [
    { label: 'Sell Trades', icon: TrendingDown, color: '#f87171', value: rows => rows.length },
    { label: 'Total Qty Sold', icon: Package, color: '#8b5cf6', value: totalQty },
    {
      label: 'Realized P&L',
      icon: Wallet,
      color: '#10b981',
      value: (rows, ctx) =>
        ctx.symbol + rows.reduce((a, r) => a + (r.realized_pnl || 0), 0).toFixed(2)
    }
  ]
};

export default function Sell() {
  return <MasterPage config={config} />;
}
