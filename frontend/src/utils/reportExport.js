/**
 * Spooling reports to Excel and PDF.
 *
 * The export reads the report that is already on screen rather than re-fetching
 * it. Every report page is built from the same chrome — a title, a filter bar,
 * summary cards and one or more `table.data-table` blocks — so one reader
 * covers all of them, and the file can never disagree with the figures the
 * person was looking at when they pressed the button.
 *
 * Numbers are recovered from their formatted text so Excel receives real
 * numeric cells. A column of "$1,234.56" strings that cannot be summed is not
 * much use to an accountant.
 */

const CURRENCY = /[$€£₹¥]/g;
const PLACEHOLDERS = new Set(['', '-', '—', '–', 'N/A', 'n/a']);

/** Formatted text back to a typed value. */
export function parseCell(raw) {
  const text = String(raw ?? '')
    .replace(/\u00a0/g, ' ')
    // Figures render with a typographic minus, which Number() will not accept.
    .replace(/\u2212/g, '-')
    .trim();
  if (PLACEHOLDERS.has(text)) return { kind: 'blank', text };

  // Accounting convention: (1,234.56) is negative.
  const parenthesised = /^\(.*\)$/.test(text);
  let body = parenthesised ? text.slice(1, -1) : text;

  const isPercent = body.endsWith('%');
  if (isPercent) body = body.slice(0, -1);

  const hadCurrency = CURRENCY.test(body);
  CURRENCY.lastIndex = 0;
  body = body.replace(CURRENCY, '').replace(/,/g, '').trim();

  if (!/^[+-]?\d+(\.\d+)?$/.test(body)) return { kind: 'text', text, value: text };

  let value = Number(body);
  if (parenthesised) value = -value;

  if (isPercent) return { kind: 'percent', text, value: value / 100 };
  if (hadCurrency) return { kind: 'money', text, value };
  return { kind: 'number', text, value, decimal: body.includes('.') };
}

const cellText = (el) => {
  // innerText reflects rendered line breaks, so a stacked cell does not come
  // back as "WIDGET-AWidget Type A". textContent is the non-visual fallback.
  const raw = el.innerText ?? el.textContent ?? '';
  return raw.replace(/\s*\n\s*/g, ' – ').replace(/[ \t]+/g, ' ').trim();
};

/** The filter bar, so an export says which slice of the books it covers. */
function readFilters(root) {
  const bar = root.querySelector('.report-controls');
  if (!bar) return [];

  const out = [];
  bar.querySelectorAll('select, input').forEach((field) => {
    if (field.type === 'button' || field.type === 'submit') return;

    let value = field.value;
    if (field.tagName === 'SELECT') {
      value = field.selectedOptions[0] ? cellText(field.selectedOptions[0]) : '';
    } else if (field.type === 'checkbox' || field.type === 'radio') {
      // These carry value "on" whether or not they are ticked, so an unticked
      // box would otherwise be exported as though the filter were applied.
      if (!field.checked) return;
      value = 'Yes';
    }
    if (!value) return;

    // Filters are written either as `<label>From <input/></label>` or as a
    // bare control, so the name can sit in three different places.
    const wrapper = field.closest('label');
    const wrapperText = wrapper
      ? cellText(wrapper).replace(cellText(field), '').trim()
      : '';

    const label =
      field.getAttribute('aria-label') ||
      wrapperText ||
      field.previousElementSibling?.textContent?.trim() ||
      field.placeholder ||
      (field.type === 'date' ? 'Date' : 'Filter');

    // Trailing punctuation is left over from splitting the label off its field.
    out.push({ label: label.replace(/[\s:*–-]+$/, ''), value });
  });
  return out;
}

/**
 * A row as a flat list of column positions.
 *
 * A totals row usually writes "Total" once across three columns, so reading
 * cells by their index would file the figures under the wrong headings.
 * Expanding colSpan first keeps every value under the column it belongs to.
 */
function expandCells(tr) {
  const out = [];
  [...tr.cells].forEach((td) => {
    out.push(td);
    for (let k = 1; k < (td.colSpan || 1); k += 1) out.push(null);
  });
  return out;
}

const expandRow = (tr) => expandCells(tr).map((td) => (td ? cellText(td) : ''));

function readTable(table) {
  const headerRow = table.querySelector('thead tr');
  const headerCells = [];
  if (headerRow) {
    [...headerRow.cells].forEach((th) => {
      for (let k = 0; k < (th.colSpan || 1); k += 1) headerCells.push(th);
    });
  }

  const bodyTrs = [...table.querySelectorAll('tbody tr')];

  /**
   * Columns that exist only to hold controls — an "Actions" column, or the
   * unlabelled one carrying a row-expander — are chrome, not figures. Exporting
   * them fills a spreadsheet column with "+".
   */
  const isChrome = (th, i) => {
    if (/^actions?$/i.test(cellText(th))) return true;
    if (cellText(th)) return false;
    const cells = bodyTrs
      .map((tr) => expandCells(tr)[i])
      .filter(Boolean);
    return cells.length > 0
      && cells.every((td) => td.querySelector('button') && !td.querySelector('button ~ *'));
  };

  const keep = headerCells
    .map((th, i) => (isChrome(th, i) ? -1 : i))
    .filter((i) => i >= 0);

  const headers = keep.map((i) => ({
    label: cellText(headerCells[i]),
    align: headerCells[i].style.textAlign || 'left'
  }));

  const blank = () => keep.map(() => '');

  /**
   * A row that is one cell spanning the table is either a section heading
   * ("INCOME", "EXPENSES") or the "nothing to show" placeholder. Telling them
   * apart matters: dropping the headings would flatten a P&L into an
   * unlabelled list of accounts. Only a table whose entire body is that one
   * row is empty; anywhere else the text is a heading worth keeping.
   */
  const pick = (tr, bodyCount) => {
    if (tr.cells.length === 1 && tr.cells[0].colSpan > 1) {
      if (bodyCount <= 1) return null;
      const row = blank();
      row[0] = cellText(tr.cells[0]);
      return row;
    }
    const cells = expandRow(tr);
    return keep.map((i) => cells[i] ?? '');
  };

  const rows = bodyTrs.map((tr) => pick(tr, bodyTrs.length)).filter(Boolean);

  const footTrs = [...table.querySelectorAll('tfoot tr')];
  const footer = footTrs.map((tr) => pick(tr, footTrs.length + 1)).filter(Boolean);

  if (!headers.length && !rows.length) return null;

  const panel = table.closest('.glass-panel');
  return { caption: panel?.querySelector('h3') ? cellText(panel.querySelector('h3')) : '',
           headers, rows, footer };
}

/** Everything the exporters need, read off the live report. */
export function collectReport(root, overrides = {}) {
  const titleEl = root.querySelector('.page-title h1');
  const subEl = root.querySelector('.page-title p');

  const cards = [...root.querySelectorAll('.summary-card')]
    .map((card) => {
      const labelEl = card.querySelector('.text-muted-small');
      const label = labelEl ? cellText(labelEl) : '';
      const valueEl = card.querySelector('.big-number');
      // Some cards state their figure as a badge rather than a number, so fall
      // back to whatever text is left once the label is taken out.
      const value = valueEl && cellText(valueEl)
        ? cellText(valueEl)
        : cellText(card).replace(label, '').trim();
      return { label, value };
    })
    .filter((c) => c.label || c.value);

  const tables = [...root.querySelectorAll('table.data-table')]
    // A table inside another table is an expanded detail row, already covered.
    .filter((t) => !t.parentElement.closest('table'))
    .map(readTable)
    .filter(Boolean);

  return {
    title: overrides.title || (titleEl ? cellText(titleEl) : 'Report'),
    subtitle: overrides.subtitle ?? (subEl ? cellText(subEl) : ''),
    cards,
    filters: readFilters(root),
    tables,
    generatedAt: new Date()
  };
}

export const slugify = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report';

export function fileStem(report) {
  const d = report.generatedAt;
  const stamp = [d.getFullYear(), d.getMonth() + 1, d.getDate()]
    .map((n) => String(n).padStart(2, '0')).join('-');
  return `${slugify(report.title)}-${stamp}`;
}

export function hasContent(report) {
  return report.tables.some((t) => t.rows.length > 0);
}

/** Hand a generated file to the browser. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
