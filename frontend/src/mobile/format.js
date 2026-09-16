/* Number formatting for a phone screen, where a full figure rarely fits. */

/**
 * Money, shortened.
 *
 * A dashboard tile is about six characters wide on a narrow phone, and
 * `$25,003,617.00` is not six characters — so anything from a thousand up is
 * rendered compactly. The locale does the shortening, which matters for INR:
 * `en-IN` groups in lakh and crore, the units the figures are actually
 * discussed in, rather than forcing them into millions.
 */
export function money(value, symbol = '$', { compact = true } = {}) {
  const n = Number(value) || 0;
  const locale = symbol === '₹' ? 'en-IN' : 'en-US';
  const short = compact && Math.abs(n) >= 1000;
  const formatted = new Intl.NumberFormat(locale, short
    ? { notation: 'compact', maximumFractionDigits: 1 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
  return `${n < 0 ? '-' : ''}${symbol}${formatted}`;
}

/** Plain counts and quantities. */
export function number(value, digits = 0) {
  const n = Number(value) || 0;
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits, maximumFractionDigits: digits
  }).format(n);
}

/** A short date for list rows: "12 Sep". */
export function shortDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** "just now" / "12 min ago" / "3 hr ago", for the freshness line. */
export function since(date) {
  if (!date) return 'never';
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)} hr ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
