import { useState, useEffect, useRef, useCallback } from 'react';
import {
  StickyNote, Plus, Trash2, Pin, PinOff, X, Check, AlertTriangle, Loader2
} from 'lucide-react';

import { notesApi } from '../api';
import './Notepad.css';

const AUTOSAVE_MS = 900;

/**
 * A scratchpad that follows the user rather than the browser.
 *
 * Typing autosaves after a pause instead of on every keystroke, so a long note
 * is not a request per character; the pending edit is also flushed when the
 * panel closes, so nothing is lost by pressing Escape mid-sentence.
 */
export default function Notepad({ open, onClose }) {
  const [notes, setNotes] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState({ title: '', content: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState(null);      // 'saving' | 'saved' | null
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const bodyRef = useRef(null);
  const timerRef = useRef(null);
  // Held in a ref as well so the flush-on-close effect sees the latest text
  // without re-running every keystroke.
  const pendingRef = useRef(null);

  const active = notes.find((n) => n.id === activeId) || null;

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await notesApi.list();
      setNotes(rows);
      setActiveId((current) => current ?? rows[0]?.id ?? null);
      if (rows[0] && activeId === null) {
        setDraft({ title: rows[0].title || '', content: rows[0].content || '' });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeId]);

  useEffect(() => { if (open) load(); }, [open]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Focus the body when the panel opens, so Ctrl+N lands ready to type.
  useEffect(() => {
    if (open && !isLoading) {
      const t = setTimeout(() => bodyRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open, isLoading, activeId]);

  const save = useCallback(async (id, values) => {
    if (!id) return;
    setStatus('saving');
    try {
      const saved = await notesApi.update(id, values);
      setNotes((rows) => rows.map((n) => (n.id === id ? saved : n)));
      pendingRef.current = null;
      setStatus('saved');
      setTimeout(() => setStatus((s) => (s === 'saved' ? null : s)), 2000);
    } catch (err) {
      setError(err.message);
      setStatus(null);
    }
  }, []);

  const edit = (patch) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    setError(null);
    if (!activeId) return;

    pendingRef.current = { id: activeId, values: next };
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(activeId, next), AUTOSAVE_MS);
  };

  // Anything typed but not yet saved is written out when the panel closes.
  useEffect(() => {
    if (open) return;
    clearTimeout(timerRef.current);
    const pending = pendingRef.current;
    if (pending) save(pending.id, pending.values);
  }, [open, save]);

  const choose = (note) => {
    clearTimeout(timerRef.current);
    if (pendingRef.current) save(pendingRef.current.id, pendingRef.current.values);
    setActiveId(note.id);
    setDraft({ title: note.title || '', content: note.content || '' });
  };

  const addNote = async () => {
    try {
      const created = await notesApi.create({ title: '', content: '' });
      setNotes((rows) => [created, ...rows]);
      setActiveId(created.id);
      setDraft({ title: '', content: '' });
      setTimeout(() => bodyRef.current?.focus(), 50);
    } catch (err) {
      setError(err.message);
    }
  };

  const togglePin = async (note) => {
    try {
      const saved = await notesApi.update(note.id, { pinned: !note.pinned });
      setNotes((rows) => rows.map((n) => (n.id === note.id ? saved : n))
        .sort((a, b) => (b.pinned - a.pinned)
          || new Date(b.updated_at) - new Date(a.updated_at)));
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (note) => {
    try {
      await notesApi.remove(note.id);
      const left = notes.filter((n) => n.id !== note.id);
      setNotes(left);
      setConfirmDelete(null);
      if (activeId === note.id) {
        const next = left[0] || null;
        setActiveId(next?.id ?? null);
        setDraft({ title: next?.title || '', content: next?.content || '' });
      }
    } catch (err) {
      setError(err.message);
    }
  };

  if (!open) return null;

  return (
    <div className="notepad-backdrop" onClick={onClose}>
      <div className="notepad glass-panel" onClick={(e) => e.stopPropagation()}
           role="dialog" aria-label="Notes">
        <header className="notepad-head">
          <h2><StickyNote size={17} /> Notes</h2>
          <div className="notepad-head-right">
            <span className="notepad-status">
              {status === 'saving' && <><Loader2 size={13} className="np-spin" /> Saving</>}
              {status === 'saved' && <><Check size={13} /> Saved</>}
            </span>
            <button className="icon-btn" onClick={onClose} aria-label="Close notes">
              <X size={18} />
            </button>
          </div>
        </header>

        {error && <div className="notepad-error"><AlertTriangle size={14} /> {error}</div>}

        <div className="notepad-body">
          <aside className="notepad-list">
            <button className="btn-primary notepad-new" onClick={addNote}>
              <Plus size={14} /> New note
            </button>

            {isLoading && <div className="notepad-empty">Loading...</div>}
            {!isLoading && notes.length === 0 && (
              <div className="notepad-empty">
                Nothing yet. Start one — it saves as you type.
              </div>
            )}

            {notes.map((note) => (
              <div key={note.id}
                   className={note.id === activeId ? 'notepad-item active' : 'notepad-item'}
                   onClick={() => choose(note)}>
                <div className="notepad-item-text">
                  <strong>{note.title || 'Untitled'}</strong>
                  <span>{note.preview || 'Empty'}</span>
                </div>
                <div className="notepad-item-actions">
                  <button className="icon-btn" title={note.pinned ? 'Unpin' : 'Pin'}
                          onClick={(e) => { e.stopPropagation(); togglePin(note); }}>
                    {note.pinned ? <Pin size={13} /> : <PinOff size={13} />}
                  </button>
                  <button className="icon-btn danger" title="Delete"
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(note); }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </aside>

          <section className="notepad-editor">
            {active ? (
              <>
                <input className="notepad-title" placeholder="Title"
                       value={draft.title}
                       onChange={(e) => edit({ title: e.target.value })} />
                <textarea ref={bodyRef} className="notepad-text"
                          placeholder="Type here. It saves on its own."
                          value={draft.content}
                          onChange={(e) => edit({ content: e.target.value })} />
              </>
            ) : (
              <div className="notepad-empty notepad-editor-empty">
                Pick a note, or start a new one.
              </div>
            )}
          </section>
        </div>

        {confirmDelete && (
          <div className="notepad-confirm">
            <span>Delete &ldquo;{confirmDelete.title || 'Untitled'}&rdquo;?</span>
            <div>
              <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => remove(confirmDelete)}>Delete</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
