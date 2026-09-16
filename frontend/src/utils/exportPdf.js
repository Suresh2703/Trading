import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { parseCell, fileStem } from './reportExport';

/* The PDF is the version that gets filed or emailed, so it carries its own
   context: what the report is, which filters produced it, when it was run, and
   a page count so a printout can be checked for missing pages. */

const MARGIN = 36;
const INK = [15, 23, 42];
const MUTED = [100, 116, 139];
const HEADER_FILL = [30, 41, 59];

/** Past about eight columns portrait A4 starts truncating. */
const orientationFor = (report) =>
  report.tables.some((t) => t.headers.length > 6) ? 'landscape' : 'portrait';

const alignOf = (header, text) => {
  if (header?.align === 'right') return 'right';
  return parseCell(text).kind === 'text' ? 'left' : 'right';
};

export function buildReportPdf(report) {
  const doc = new jsPDF({ orientation: orientationFor(report), unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text(report.title, MARGIN, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);

  if (report.subtitle) {
    doc.text(doc.splitTextToSize(report.subtitle, pageWidth - MARGIN * 2), MARGIN, y);
    y += 12;
  }

  doc.text(`Generated ${report.generatedAt.toLocaleString()}`, MARGIN, y);
  y += 12;

  if (report.filters.length) {
    const line = report.filters.map((f) => `${f.label}: ${f.value}`).join('    ');
    doc.text(doc.splitTextToSize(line, pageWidth - MARGIN * 2), MARGIN, y);
    y += 12 * Math.ceil(doc.getTextWidth(line) / (pageWidth - MARGIN * 2));
  }

  y += 6;

  // Summary cards as a compact strip, so the headline figures survive printing.
  if (report.cards.length) {
    autoTable(doc, {
      startY: y,
      body: report.cards.map((c) => [c.label, c.value]),
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 3, textColor: INK },
      columnStyles: { 0: { textColor: MUTED }, 1: { fontStyle: 'bold', halign: 'right' } },
      tableWidth: Math.min(320, pageWidth - MARGIN * 2),
      margin: { left: MARGIN, right: MARGIN }
    });
    y = doc.lastAutoTable.finalY + 14;
  }

  report.tables.forEach((table) => {
    if (table.caption) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      doc.text(table.caption, MARGIN, y);
      y += 10;
    }

    autoTable(doc, {
      startY: y,
      head: [table.headers.map((h) => h.label)],
      body: table.rows.length ? table.rows : [[{
        content: 'Nothing to show.',
        colSpan: table.headers.length,
        styles: { halign: 'center', textColor: MUTED }
      }]],
      foot: table.footer.length ? table.footer : undefined,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak', textColor: INK },
      headStyles: { fillColor: HEADER_FILL, textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], textColor: INK, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: table.headers.reduce((acc, h, i) => {
        acc[i] = { halign: alignOf(h, table.rows[0]?.[i]) };
        return acc;
      }, {}),
      margin: { left: MARGIN, right: MARGIN, bottom: MARGIN + 10 }
    });

    y = doc.lastAutoTable.finalY + 18;
  });

  // Stamped last, once the total is known.
  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `${report.title}  ·  Page ${p} of ${pages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 18,
      { align: 'center' }
    );
  }

  return doc;
}

export function exportReportToPdf(report) {
  buildReportPdf(report).save(`${fileStem(report)}.pdf`);
}
