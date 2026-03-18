'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '../../_components/AppHeader';
import { useCurrentUser } from '../../_components/useCurrentUser';
import { DEFAULT_SHORTCUTS, SHORTCUT_LABELS, formatKey } from '@/lib/shortcuts-defaults';

const GROUPS = [
  {
    id: 'editor',
    label: 'Label Editor',
    note: 'Ctrl/Meta combinations (Save, Copy, Paste, Undo, Redo, Select All) are fixed and cannot be remapped.',
    actions: [
      'editor.rotateCCW', 'editor.rotateCW',
      'editor.cancelOrClear', 'editor.deleteAnnotation',
      'editor.classUp', 'editor.classDown',
      'editor.toggleSelect', 'editor.navigatePrev', 'editor.navigateNext',
    ],
  },
  {
    id: 'viewer',
    label: 'Viewer (Lightbox)',
    note: null,
    actions: ['viewer.lightboxClose', 'viewer.lightboxPrev', 'viewer.lightboxNext'],
  },
];

// Keys that should never be captured (browser/system reserved)
const BLOCKED_KEYS = new Set(['F5', 'F12', 'Tab']);

export default function ShortcutsPage() {
  const router = useRouter();
  const { user } = useCurrentUser();

  const [current, setCurrent] = useState({ ...DEFAULT_SHORTCUTS });
  const [overrides, setOverrides] = useState({});
  const [capturingAction, setCapturingAction] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const captureRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/profile/shortcuts');
      if (!res.ok) return;
      const data = await res.json();
      setCurrent(data.shortcuts);
      setOverrides(data.overrides || {});
      setDirty(false);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  // Global keydown for capture mode
  useEffect(() => {
    if (!capturingAction) return;
    function onKey(e) {
      e.preventDefault();
      e.stopPropagation();
      // Ignore modifier-only presses
      if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) return;
      // Block system/browser reserved keys
      if (BLOCKED_KEYS.has(e.key)) return;
      // Don't allow Ctrl/Meta combos
      if (e.ctrlKey || e.metaKey) return;

      setCurrent((prev) => ({ ...prev, [capturingAction]: e.key }));
      setDirty(true);
      setCapturingAction(null);
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturingAction]);

  // Click outside capture row cancels capture
  useEffect(() => {
    if (!capturingAction) return;
    function onClick(e) {
      if (captureRef.current && !captureRef.current.contains(e.target)) {
        setCapturingAction(null);
      }
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [capturingAction]);

  // Detect conflicts: same key used for two actions in the same group context
  function getConflicts() {
    const conflicts = new Set();
    for (const group of GROUPS) {
      const seen = {};
      for (const action of group.actions) {
        const key = current[action]?.toLowerCase();
        if (!key) continue;
        if (seen[key]) {
          conflicts.add(action);
          conflicts.add(seen[key]);
        } else {
          seen[key] = action;
        }
      }
    }
    return conflicts;
  }

  async function handleSave() {
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const res = await fetch('/api/profile/shortcuts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortcuts: current }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Save failed');
      } else {
        setCurrent(data.shortcuts);
        setOverrides(data.overrides || {});
        setDirty(false);
        setSuccessMsg('Shortcuts saved.');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch {
      setErrorMsg('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm('Reset all shortcuts to defaults?')) return;
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const res = await fetch('/api/profile/shortcuts', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Reset failed');
      } else {
        setCurrent(data.shortcuts);
        setOverrides({});
        setDirty(false);
        setSuccessMsg('Reset to defaults.');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch {
      setErrorMsg('Network error');
    } finally {
      setSaving(false);
    }
  }

  function resetOne(action) {
    setCurrent((prev) => ({ ...prev, [action]: DEFAULT_SHORTCUTS[action] }));
    setDirty(true);
  }

  const conflicts = getConflicts();
  const hasOverrides = Object.keys(overrides).length > 0 || dirty;

  if (!user) return null;

  return (
    <div style={styles.page}>
      <AppHeader title="Keyboard Shortcuts" />
      <main style={styles.main}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.h1}>Keyboard Shortcuts</h1>
            <p style={styles.subtitle}>
              Click a key badge to remap it. Press the new key to confirm, or click elsewhere to cancel.
            </p>
          </div>
          <div style={styles.headerActions}>
            {hasOverrides && (
              <button style={styles.resetAllBtn} onClick={handleReset} disabled={saving}>
                Reset to Defaults
              </button>
            )}
            <button style={{ ...styles.saveBtn, opacity: (!dirty || saving) ? 0.5 : 1 }}
              onClick={handleSave} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {errorMsg && <div style={styles.errorBanner}>{errorMsg}</div>}
        {successMsg && <div style={styles.successBanner}>{successMsg}</div>}

        {GROUPS.map((group) => (
          <div key={group.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>{group.label}</h2>
              {group.note && <p style={styles.cardNote}>{group.note}</p>}
            </div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Action</th>
                  <th style={styles.th}>Key</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {group.actions.map((action) => {
                  const isCapturing = capturingAction === action;
                  const isConflict = conflicts.has(action);
                  const isCustom = current[action] !== DEFAULT_SHORTCUTS[action];
                  const isNav = action === 'editor.navigatePrev' || action === 'editor.navigateNext';

                  return (
                    <tr key={action} style={isConflict ? styles.rowConflict : styles.row}
                      ref={isCapturing ? captureRef : null}>
                      <td style={styles.td}>
                        <span style={styles.actionLabel}>{SHORTCUT_LABELS[action]}</span>
                        {isNav && (
                          <span style={styles.altNote}>
                            {action === 'editor.navigatePrev' ? '(← always active)' : '(→ always active)'}
                          </span>
                        )}
                      </td>
                      <td style={styles.td}>
                        {isCapturing ? (
                          <span style={styles.capturing}>Press a key…</span>
                        ) : (
                          <button
                            style={{
                              ...styles.keyBadge,
                              ...(isCustom ? styles.keyBadgeCustom : {}),
                              ...(isConflict ? styles.keyBadgeConflict : {}),
                            }}
                            onClick={() => setCapturingAction(action)}
                            title="Click to remap"
                          >
                            {formatKey(current[action])}
                          </button>
                        )}
                        {isConflict && !isCapturing && (
                          <span style={styles.conflictWarning}> conflict</span>
                        )}
                      </td>
                      <td style={styles.tdAction}>
                        {isCustom && !isCapturing && (
                          <button style={styles.resetOneBtn} onClick={() => resetOne(action)}
                            title="Reset to default">
                            ↺ {formatKey(DEFAULT_SHORTCUTS[action])}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </main>
    </div>
  );
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0a1628', color: '#e6edf7' },
  main: { maxWidth: '760px', margin: '0 auto', padding: '32px 24px', width: '100%' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', gap: '16px', flexWrap: 'wrap' },
  h1: { fontSize: '22px', fontWeight: 700, color: '#e6edf7', margin: 0 },
  subtitle: { fontSize: '13px', color: '#6b7fa3', marginTop: '6px', marginBottom: 0 },
  headerActions: { display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 },
  resetAllBtn: { background: 'transparent', border: '1px solid #25344d', borderRadius: '6px', color: '#9ba9c3', cursor: 'pointer', fontSize: '13px', padding: '7px 14px' },
  saveBtn: { background: '#e45d25', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: '7px 18px', transition: 'opacity 0.15s' },
  errorBanner: { background: 'rgba(220,53,69,0.15)', border: '1px solid rgba(220,53,69,0.4)', borderRadius: '8px', color: '#ff6b6b', padding: '10px 14px', marginBottom: '20px', fontSize: '13px' },
  successBanner: { background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', color: '#4ade80', padding: '10px 14px', marginBottom: '20px', fontSize: '13px' },
  card: { background: '#0d1a2e', border: '1px solid #1e2d45', borderRadius: '10px', marginBottom: '24px', overflow: 'hidden' },
  cardHeader: { padding: '18px 20px 14px', borderBottom: '1px solid #1e2d45' },
  cardTitle: { fontSize: '15px', fontWeight: 700, color: '#e6edf7', margin: 0 },
  cardNote: { fontSize: '12px', color: '#6b7fa3', margin: '4px 0 0' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '8px 20px', fontSize: '11px', fontWeight: 700, color: '#4b5f7a', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left', borderBottom: '1px solid #1e2d45' },
  row: { borderBottom: '1px solid #111e30' },
  rowConflict: { borderBottom: '1px solid #111e30', background: 'rgba(251,146,60,0.06)' },
  td: { padding: '11px 20px', verticalAlign: 'middle' },
  tdAction: { padding: '11px 20px', verticalAlign: 'middle', textAlign: 'right', width: '120px' },
  actionLabel: { fontSize: '13px', color: '#c9d5e8' },
  altNote: { fontSize: '11px', color: '#4b5f7a', marginLeft: '8px' },
  keyBadge: { background: '#1a2a42', border: '1px solid #2d4060', borderRadius: '5px', color: '#e6edf7', cursor: 'pointer', fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, minWidth: '40px', padding: '4px 10px', textAlign: 'center', transition: 'border-color 0.15s, background 0.15s' },
  keyBadgeCustom: { background: '#162236', border: '1px solid #2f7ff5', color: '#60a5fa' },
  keyBadgeConflict: { border: '1px solid #f97316', color: '#fb923c' },
  capturing: { display: 'inline-block', background: '#162236', border: '2px solid #2f7ff5', borderRadius: '5px', color: '#60a5fa', fontFamily: 'monospace', fontSize: '12px', padding: '4px 10px', animation: 'pulse 1s ease-in-out infinite' },
  conflictWarning: { fontSize: '11px', color: '#f97316', marginLeft: '6px' },
  resetOneBtn: { background: 'transparent', border: '1px solid #25344d', borderRadius: '5px', color: '#6b7fa3', cursor: 'pointer', fontSize: '11px', padding: '3px 8px' },
};
