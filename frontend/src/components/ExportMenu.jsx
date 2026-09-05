import { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';

import { collectReport, hasContent } from '../utils/reportExport';
import './ExportMenu.css';

/* The spreadsheet and PDF writers are roughly half a megabyte between them and
   most visits never export, so they are fetched on the click rather than in
   the initial bundle. */
const writers = {
  xlsx: () => import('../utils/exportExcel').then((m) => m.exportReportToExcel),
  pdf: () => import('../utils/exportPdf').then((m) => m.exportReportToPdf)
};

/**
 * Spools the report currently on screen to Excel or PDF.
 *
 * It reads the rendered report rather than re-querying, so what lands in the
 * file is exactly what was on screen — including the filters that produced it.
 * `containerRef` should wrap the whole report; without one it falls back to the
 * scrolling content area, which amounts to the same thing on a report page.
 */
export default function ExportMenu({ containerRef, title, subtitle, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = async (kind) => {
    const root = containerRef?.current || document.querySelector('.content-scroll');
    if (!root) { setError('Nothing to export yet.'); return; }

    setBusy(kind);
    setError(null);
    try {
      const report = collectReport(root, { title, subtitle });
      if (!report.tables.length) throw new Error('This report has no table to export.');
      if (!hasContent(report)) throw new Error('The report is empty — nothing to export.');

      const write = await writers[kind]();
      await write(report);

      setOpen(false);
    } catch (err) {
      setError(err.message || 'Export failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="export-menu" ref={wrapRef}>
      <button type="button"
              className="btn-ghost export-trigger"
              disabled={disabled || Boolean(busy)}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => { setError(null); setOpen(!open); }}>
        {busy ? <Loader2 size={16} className="export-spin" /> : <Download size={16} />}
        Export
      </button>

      {open && (
        <div className="export-pop glass-panel" role="menu">
          <button type="button" role="menuitem"
                  onClick={() => run('xlsx')} disabled={Boolean(busy)}>
            <FileSpreadsheet size={15} />
            <span>
              Excel<small>.xlsx — one sheet per table</small>
            </span>
          </button>
          <button type="button" role="menuitem"
                  onClick={() => run('pdf')} disabled={Boolean(busy)}>
            <FileText size={15} />
            <span>
              PDF<small>.pdf — print ready</small>
            </span>
          </button>
          {error && <div className="export-error">{error}</div>}
        </div>
      )}
    </div>
  );
}
