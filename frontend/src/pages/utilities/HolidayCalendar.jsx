import { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, X, AlertTriangle, Trash2, Repeat
} from 'lucide-react';

import { holidaysApi } from '../../api';
import { usePermissions } from '../../context/PermissionContext';
import '../../components/MasterPage.css';
import '../../components/VoucherPage.css';
import './HolidayCalendar.css';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
// Monday-first, which is how a working week is read.
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TYPES = [
  { code: 'PUBLIC', label: 'Public holiday' },
  { code: 'OPTIONAL', label: 'Optional / restricted' },
  { code: 'COMPANY', label: 'Company holiday' }
];

const iso = (d) => d.toISOString().slice(0, 10);

export default function HolidayCalendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [days, setDays] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);   // { day, holiday? }

  const { canEdit } = usePermissions();
  const mayEdit = canEdit('MASTER_DATA');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await holidaysApi.calendar(year, month);
      setDays(data.days || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const step = (delta) => {
    const m = month + delta;
    if (m < 1) { setMonth(12); setYear((y) => y - 1); }
    else if (m > 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth(m);
  };

  // Blank cells so the 1st lands under its weekday, Monday-first.
  const firstWeekday = days.length
    ? (new Date(days[0].day + 'T00:00:00').getDay() + 6) % 7
    : 0;

  const save = async (form) => {
    setError(null);
    try {
      if (form.id) await holidaysApi.update(form.id, form);
      else await holidaysApi.create(form);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    setError(null);
    try {
      await holidaysApi.remove(id);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const marked = days.filter((d) => d.holiday);

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="products-header">
        <div className="page-title">
          <h1>Holiday Calendar</h1>
          <p>
            Mark the days the business does not work.
            {mayEdit ? ' Click any day to mark or edit it.' : ' Read-only for your role.'}
          </p>
        </div>
        <div className="report-controls">
          <button className="btn-ghost" onClick={() => step(-1)} aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <span className="hc-period">{MONTHS[month - 1]} {year}</span>
          <button className="btn-ghost" onClick={() => step(1)} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
          <button className="btn-ghost"
                  onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); }}>
            Today
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-panel hc-error"><AlertTriangle size={15} /> {error}</div>
      )}

      <div className="hc-layout">
        <div className="glass-panel hc-calendar">
          <div className="hc-weekdays">
            {WEEKDAYS.map((d) => <div key={d}>{d}</div>)}
          </div>

          {isLoading ? (
            <div className="hc-loading">Loading...</div>
          ) : (
            <div className="hc-grid">
              {Array.from({ length: firstWeekday }).map((_, i) => (
                <div className="hc-day blank" key={`blank-${i}`} />
              ))}

              {days.map((d) => {
                const isToday = d.day === iso(today);
                const classes = ['hc-day'];
                if (d.holiday) classes.push('holiday', d.holiday.holiday_type.toLowerCase());
                if (d.is_weekend) classes.push('weekend');
                if (isToday) classes.push('today');
                if (!mayEdit) classes.push('readonly');

                return (
                  <button key={d.day} className={classes.join(' ')}
                          disabled={!mayEdit}
                          title={d.holiday ? d.holiday.name : (mayEdit ? 'Mark as holiday' : '')}
                          onClick={() => mayEdit && setEditing({
                            day: d.day,
                            holiday: d.holiday,
                            projected: d.projected
                          })}>
                    <span className="hc-daynum">
                      {Number(d.day.slice(-2))}
                      {d.holiday?.is_recurring && <Repeat size={10} />}
                    </span>
                    {d.holiday && <span className="hc-dayname">{d.holiday.name}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass-panel hc-side">
          <h3><CalendarDays size={15} /> {MONTHS[month - 1]} holidays</h3>
          {marked.length === 0 && (
            <p className="text-muted-small">No holidays marked this month.</p>
          )}
          <ul className="hc-list">
            {marked.map((d) => (
              <li key={d.day} className={d.holiday.holiday_type.toLowerCase()}>
                <span className="hc-list-date">{Number(d.day.slice(-2))}</span>
                <span className="hc-list-body">
                  <strong>{d.holiday.name}</strong>
                  <em>
                    {TYPES.find((t) => t.code === d.holiday.holiday_type)?.label}
                    {d.projected && ' · repeats yearly'}
                  </em>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {editing && (
        <HolidayDialog entry={editing}
                       onSave={save}
                       onDelete={remove}
                       onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function HolidayDialog({ entry, onSave, onDelete, onClose }) {
  const existing = entry.holiday;
  const [form, setForm] = useState({
    id: existing?.id,
    holiday_date: existing?.holiday_date || entry.day,
    name: existing?.name || '',
    holiday_type: existing?.holiday_type || 'PUBLIC',
    is_recurring: existing?.is_recurring || false,
    description: existing?.description || ''
  });

  return (
    <div className="master-modal-backdrop" onClick={onClose}>
      <div className="master-modal glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="hc-dialog-head">
          <h3>{existing ? 'Edit holiday' : 'Mark as holiday'}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={17} /></button>
        </div>

        <p className="text-muted-small" style={{ marginBottom: '1rem' }}>
          {new Date(entry.day + 'T00:00:00').toDateString()}
          {entry.projected && ' — this repeats yearly; editing changes it for every year.'}
        </p>

        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
          <div className="form-group">
            <label>Name</label>
            <input className="config-input" required autoFocus value={form.name}
                   placeholder="e.g. Republic Day"
                   onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="form-group">
            <label>Type</label>
            <select className="config-input" value={form.holiday_type}
                    onChange={(e) => setForm({ ...form, holiday_type: e.target.value })}>
              {TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
            </select>
          </div>

          <label className="hc-check">
            <input type="checkbox" checked={form.is_recurring}
                   onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })} />
            <span>
              Repeats every year
              <em>Same date annually — entered once, shown in every year.</em>
            </span>
          </label>

          <div className="form-group">
            <label>Note</label>
            <input className="config-input" value={form.description || ''}
                   placeholder="Optional"
                   onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="master-modal-actions">
            {existing && (
              <button type="button" className="btn-danger hc-remove"
                      onClick={() => onDelete(existing.id)}>
                <Trash2 size={14} /> Unmark
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">
              {existing ? 'Save' : 'Mark holiday'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
