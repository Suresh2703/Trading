import { createPortal } from 'react-dom';
import './ReceiptDocument.css';

/**
 * The printable receipt.
 *
 * Rendered through a portal to document.body rather than inside the app, so
 * the print stylesheet can hide the whole shell and leave just this behind.
 * Printing from inside the layout would fight `height: 100vh; overflow:
 * hidden`, which clips everything to one page.
 *
 * It is invisible on screen — the modal already shows the sale — and exists
 * purely for the printer, sized for an 80mm till roll.
 */
export default function ReceiptDocument({ sale, symbol = '', duplicate = false,
                                          preview = false, onDismissPreview }) {
  if (!sale) return null;

  const money = (v) => `${symbol}${Number(v || 0).toFixed(2)}`;
  const invoice = sale.invoice;
  const outlet = sale.warehouse;
  const customer = sale.customer;

  const stamped = sale.created_at ? new Date(sale.created_at) : null;
  const when = stamped && !Number.isNaN(stamped.valueOf())
    ? stamped.toLocaleString()
    : sale.sale_date;

  // A walk-in is the anonymous default, so naming it on the receipt tells the
  // customer nothing; a real account is worth printing.
  const namedCustomer = customer && customer.code !== 'WALKIN' ? customer : null;

  const address = [outlet?.address, [outlet?.city, outlet?.state].filter(Boolean).join(', ')]
    .filter(Boolean);

  return createPortal(
    <div className={preview ? 'receipt-print-root rcpt-preview' : 'receipt-print-root'}
         role="document"
         aria-hidden={preview ? undefined : 'true'}
         onClick={preview ? onDismissPreview : undefined}>
      <div className="rcpt" onClick={(e) => e.stopPropagation()}>
        <header className="rcpt-head">
          <h1>{outlet?.name || 'Sales Receipt'}</h1>
          {address.map((line) => <div className="rcpt-sub" key={line}>{line}</div>)}
          {outlet?.phone && <div className="rcpt-sub">Tel {outlet.phone}</div>}
        </header>

        {duplicate && <div className="rcpt-duplicate">*** DUPLICATE ***</div>}
        {sale.status === 'VOID' && <div className="rcpt-void">*** VOIDED ***</div>}

        <div className="rcpt-rule" />

        <div className="rcpt-meta">
          <div><span>Receipt</span><span>{sale.receipt_no}</span></div>
          <div><span>Date</span><span>{when}</span></div>
          {sale.cashier_name && (
            <div><span>Served by</span><span>{sale.cashier_name}</span></div>
          )}
          {namedCustomer && (
            <div><span>Customer</span><span>{namedCustomer.name}</span></div>
          )}
          {namedCustomer?.gstin && (
            <div><span>GSTIN</span><span>{namedCustomer.gstin}</span></div>
          )}
        </div>

        <div className="rcpt-rule" />

        <table className="rcpt-items">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Qty</th>
              <th className="num">Price</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice?.lines?.map((line) => (
              <tr key={line.id}>
                <td>
                  <span className="rcpt-item-name">
                    {line.product?.name || line.product?.ticker || `#${line.product_id}`}
                  </span>
                  {line.product?.ticker && (
                    <span className="rcpt-item-code">{line.product.ticker}</span>
                  )}
                  {line.discount_pct > 0 && (
                    <span className="rcpt-item-code">less {line.discount_pct}%</span>
                  )}
                </td>
                <td className="num">{line.quantity}</td>
                <td className="num">{Number(line.unit_price || 0).toFixed(2)}</td>
                {/* Pre-tax, so the column adds up to the subtotal printed
                    below it. line_total carries the tax already and would read
                    as the tax being charged twice. */}
                <td className="num">{Number(line.line_subtotal || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="rcpt-rule" />

        <div className="rcpt-totals">
          <div><span>Subtotal</span><span>{money(invoice?.subtotal)}</span></div>
          <div><span>Tax</span><span>{money(invoice?.tax_total)}</span></div>
          <div className="grand"><span>TOTAL</span><span>{money(sale.amount_total)}</span></div>
          <div><span>Paid by</span><span>{sale.payment_method}</span></div>
          {sale.payment_bank && (
            <div><span>Bank</span><span>{sale.payment_bank}</span></div>
          )}
          {sale.payment_last4 && (
            <div><span>Account</span><span>**** **** **** {sale.payment_last4}</span></div>
          )}
          {sale.payment_reference && (
            <div><span>Ref</span><span>{sale.payment_reference}</span></div>
          )}
          {sale.amount_tendered > 0 && (
            <div><span>Tendered</span><span>{money(sale.amount_tendered)}</span></div>
          )}
          {sale.change_given > 0 && (
            <div><span>Change</span><span>{money(sale.change_given)}</span></div>
          )}
        </div>

        {/* Nothing was collected, so the receipt has to say who owes it. */}
        {sale.payment_method === 'CREDIT' && sale.bill_to_name && (
          <>
            <div className="rcpt-rule" />
            <div className="rcpt-billto">
              <div className="rcpt-billto-head">BILL TO</div>
              <div>{sale.bill_to_name}</div>
              {sale.bill_to_address && <div>{sale.bill_to_address}</div>}
            </div>
          </>
        )}

        <div className="rcpt-rule" />

        <footer className="rcpt-foot">
          {invoice?.doc_no && <div>Tax invoice {invoice.doc_no}</div>}
          {!sale.journal_entry_id && sale.status !== 'VOID' && (
            <div>Charged to account — payment outstanding</div>
          )}
          <div className="rcpt-thanks">Thank you for your custom</div>
        </footer>
      </div>
    </div>,
    document.body
  );
}
