import writeXlsxFile from 'write-excel-file/browser';
import { parseCell, fileStem, downloadBlob } from './reportExport';

/* A workbook is easier to work with than a picture of a table, so each report
   block becomes its own sheet with real numeric cells, and the run's context
   (title, filters, totals) leads in a summary sheet. */

const HEADER_FILL = '#1E293B';
const HEADER_TEXT = '#FFFFFF';

const MONEY = '#,##0.00';
const PERCENT = '0.00%';

const ILLEGAL_SHEET_CHARS = new Set(['[', ']', ':', '*', '?', '/', '\\']);

/** Excel rejects []:*?/\ in sheet names and truncates past 31 characters. */
function sheetName(raw, taken) {
  const base = [...String(raw || 'Sheet')]
    .map((ch) => (ILLEGAL_SHEET_CHARS.has(ch) ? ' ' : ch))
    .join('')
    .trim()
    .slice(0, 31) || 'Sheet';
  let name = base;
  let n = 2;
  while (taken.has(name)) {
    const suffix = ` (${n++})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
  }
  taken.add(name);
  return name;
}

function dataCell(text, align) {
  const parsed = parseCell(text);
  if (parsed.kind === 'blank') return { value: null };
  if (parsed.kind === 'text') return { type: String, value: parsed.value, align };

  const format = parsed.kind === 'percent' ? PERCENT
    : parsed.kind === 'money' ? MONEY
    : parsed.decimal ? MONEY : '#,##0';

  return { type: Number, value: parsed.value, format, align: align || 'right' };
}

/** Wide enough to read, not so wide it runs off the page. */
function columnWidths(headers, rows) {
  return headers.map((h, i) => {
    const longest = rows.reduce(
      (max, r) => Math.max(max, String(r[i] ?? '').length),
      String(h.label).length
    );
    return { width: Math.min(Math.max(longest + 2, 10), 46) };
  });
}

function tableSheet(table) {
  const rows = [];

  rows.push(table.headers.map((h) => ({
    type: String, value: h.label, fontWeight: 'bold',
    backgroundColor: HEADER_FILL, color: HEADER_TEXT,
    align: h.align === 'right' ? 'right' : 'left'
  })));

  table.rows.forEach((r) => {
    rows.push(r.map((c, i) => dataCell(c, table.headers[i]?.align)));
  });

  table.footer.forEach((r) => {
    rows.push(r.map((c, i) => ({ ...dataCell(c, table.headers[i]?.align), fontWeight: 'bold' })));
  });

  return { rows, columns: columnWidths(table.headers, [...table.rows, ...table.footer]) };
}

function summarySheet(report) {
  const rows = [
    [{ type: String, value: report.title, fontWeight: 'bold', fontSize: 16 }]
  ];
  if (report.subtitle) rows.push([{ type: String, value: report.subtitle }]);
  rows.push([{ type: String, value: `Generated ${report.generatedAt.toLocaleString()}` }]);
  rows.push([]);

  if (report.filters.length) {
    rows.push([{ type: String, value: 'Filters', fontWeight: 'bold' }]);
    report.filters.forEach((f) => rows.push([
      { type: String, value: f.label }, { type: String, value: f.value }
    ]));
    rows.push([]);
  }

  if (report.cards.length) {
    rows.push([{ type: String, value: 'Summary', fontWeight: 'bold' }]);
    report.cards.forEach((c) => rows.push([
      { type: String, value: c.label }, dataCell(c.value)
    ]));
  }

  return { rows, columns: [{ width: 34 }, { width: 22 }] };
}

/** The workbook as a Blob. Passing no fileName keeps the download separate. */
export async function buildReportWorkbook(report) {
  const taken = new Set();
  const sheets = [summarySheet(report)];
  const names = [sheetName('Summary', taken)];

  report.tables.forEach((t, i) => {
    sheets.push(tableSheet(t));
    // Untitled blocks are common on single-table reports, where the report's
    // own name says far more than "Table 1".
    const fallback = report.tables.length === 1 ? report.title : `Table ${i + 1}`;
    names.push(sheetName(t.caption || fallback, taken));
  });

  // Given no fileName the library hands back a { toBlob, toFile } handle
  // rather than saving, which is what lets the download stay separate.
  const workbook = writeXlsxFile(sheets.map((sheet, i) => ({
    data: sheet.rows,
    sheet: names[i],
    columns: sheet.columns,
    // Freeze the heading so a long ledger stays readable while scrolling.
    stickyRowsCount: i === 0 ? 0 : 1
  })));

  return workbook.toBlob();
}

export async function exportReportToExcel(report) {
  const blob = await buildReportWorkbook(report);
  downloadBlob(blob, `${fileStem(report)}.xlsx`);
}
