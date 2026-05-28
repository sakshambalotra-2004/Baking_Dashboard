import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import RunProfileChart from '../components/PressureChart';

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

/* ── phase config ────────────────────────────────────────── */
const PHASES = [
    { key: 'preGrowth',  label: 'Pre-Growth',  accent: '#5B8DD9', bg: '#E8F1FD' },
    { key: 'growth',     label: 'Growth',       accent: '#D85A30', bg: '#FDECEA' },
    { key: 'postGrowth', label: 'Post-Growth',  accent: '#1D9E75', bg: '#DFF5EE' },
];

const holdStr = (hold) => {
    if (!hold || hold.value == null) return '—';
    return `${hold.value} ${hold.unit}`;
};

/* ── resolve image src safely ─────────────────────────────
   Images can arrive as:
   1. { path: '/uploads/foo.jpg' }  → prepend server origin
   2. { url: 'https://...' }        → use directly
   3. { src: 'data:image/...' }     → already a data-URL (local preview)
   ────────────────────────────────────────────────────────── */
const imgSrc = (img) => {
    if (!img) return '';
    if (img.src) return img.src;
    if (img.url) return img.url;
    if (img.path) return `http://localhost:5000${img.path}`;
    return '';
};

/* ── phase table (read-only) ─────────────────────────────── */
function PhaseTable({ phase, rows }) {
    if (!rows || rows.length === 0) return (
        <div style={s.phaseEmpty}>
            <span style={{ opacity: 0.4, marginRight: 8 }}>—</span>No steps recorded
        </div>
    );
    return (
        <div style={s.tableScroll}>
            <table style={s.table}>
                <thead>
                    <tr>
                        <th style={s.thIdx}>#</th>
                        <th style={s.th}>Temp (°C)</th>
                        <th style={s.th}>Ramp (°C/min)</th>
                        <th style={s.th}>Hold</th>
                        <th style={s.th}>Pressure (bar)</th>
                        <th style={{ ...s.th, minWidth: 160 }}>Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} style={s.tr}>
                            <td style={s.tdIdx}>
                                <span style={{ ...s.rowIdx, background: phase.accent + '22', color: phase.accent }}>{i + 1}</span>
                            </td>
                            <td style={s.td}><span style={s.mono}>{row.temp ?? '—'}</span></td>
                            <td style={s.td}><span style={s.mono}>{row.rampRate ?? '—'}</span></td>
                            <td style={s.td}><span style={s.mono}>{holdStr(row.hold)}</span></td>
                            <td style={s.td}><span style={s.mono}>{row.pressure ?? '—'}</span></td>
                            <td style={s.tdRemarks}>{row.remarks || <span style={{ color: '#CCC' }}>—</span>}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* ── editable phase row ───────────────────────────────────── */
function EditablePhaseRow({ row, index, onUpdate, onRemove, accent }) {
    return (
        <tr style={s.tr}>
            <td style={s.tdIdx}>
                <span style={{ ...s.rowIdx, background: accent + '22', color: accent }}>{index + 1}</span>
            </td>
            <td style={s.td}>
                <div style={s.cellWrap}>
                    <input
                        type="number"
                        value={row.temp ?? ''}
                        onChange={e => onUpdate(index, 'temp', e.target.value)}
                        placeholder="—"
                        style={s.cellInput}
                    />
                    <span style={s.cellUnit}>°C</span>
                </div>
            </td>
            <td style={s.td}>
                <div style={s.cellWrap}>
                    <input
                        type="number"
                        value={row.rampRate ?? ''}
                        onChange={e => onUpdate(index, 'rampRate', e.target.value)}
                        placeholder="—"
                        style={s.cellInput}
                    />
                    <span style={s.cellUnit}>°C/min</span>
                </div>
            </td>
            <td style={s.td}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <input
                        type="number"
                        value={row.hold?.value ?? ''}
                        onChange={e => onUpdate(index, 'holdValue', e.target.value)}
                        placeholder="—"
                        style={{ ...s.cellInput, width: 65 }}
                    />
                    <select
                        value={row.hold?.unit ?? 'min'}
                        onChange={e => onUpdate(index, 'holdUnit', e.target.value)}
                        style={s.holdSelect}
                    >
                        <option value="min">min</option>
                        <option value="hr">hr</option>
                        <option value="day">day</option>
                    </select>
                </div>
            </td>
            <td style={s.td}>
                <div style={s.cellWrap}>
                    <input
                        type="number"
                        value={row.pressure ?? ''}
                        onChange={e => onUpdate(index, 'pressure', e.target.value)}
                        placeholder="—"
                        style={s.cellInput}
                    />
                    <span style={s.cellUnit}>bar</span>
                </div>
            </td>
            <td style={s.tdRemarks}>
                <input
                    value={row.remarks || ''}
                    onChange={e => onUpdate(index, 'remarks', e.target.value)}
                    placeholder="Notes…"
                    style={s.remarksInput}
                />
            </td>
            <td style={s.tdAction}>
                <button onClick={() => onRemove(index)} style={s.rmBtn} title="Remove row">✕</button>
            </td>
        </tr>
    );
}

/* ══ main ════════════════════════════════════════════════════ */
export default function RunDetails() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [run, setRun]                   = useState(null);
    const [loading, setLoading]           = useState(true);
    const [lightbox, setLightbox]         = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting]         = useState(false);
    const [activePhase, setActivePhase]   = useState('preGrowth');

    /* ── edit-mode state (only for in_progress runs) ── */
    const [editMode, setEditMode]         = useState(false);
    const [saving, setSaving]             = useState(false);
    const [editStatus, setEditStatus]     = useState('');
    const [editDuration, setEditDuration] = useState('');
    const [editNotes, setEditNotes]       = useState('');
    const [editPhases, setEditPhases]     = useState({
        preGrowth: [], growth: [], postGrowth: []
    });
    const [saveMsg, setSaveMsg]           = useState(null); // { text, ok }

    useEffect(() => { fetchRun(); }, []);

    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') setLightbox(null); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const fetchRun = async () => {
        try {
            const res = await axios.get(`http://localhost:5000/api/runs/${id}`);
            const data = res.data.data ?? res.data; // handle both { data: {...} } and plain object
            setRun(data);
            /* pre-fill edit state */
            setEditStatus(data.status || 'in_progress');
            setEditDuration(data.durationMinutes ?? '');
            setEditNotes(data.notes ?? '');
            setEditPhases({
                preGrowth:  (data.preGrowth  || []).map(r => ({ ...r })),
                growth:     (data.growth     || []).map(r => ({ ...r })),
                postGrowth: (data.postGrowth || []).map(r => ({ ...r })),
            });
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    /* ── delete run + clean up uploaded image files ── */
    const deleteRun = async () => {
        setDeleting(true);
        try {
            // Collect server-side file paths so the backend can remove the
            // physical files from the uploads folder alongside the DB record.
            const imagePaths = (run?.images || [])
                .map(img => img.path)   // only images stored as { path: '/uploads/...' }
                .filter(Boolean);       // drop undefined / null / url-only entries

            await axios.delete(`http://localhost:5000/api/runs/${id}`, {
                data: { imagePaths },   // axios sends this as the DELETE request body
            });
            navigate('/logs');
        } catch (err) {
            console.error(err);
            alert('Failed to delete run.');
            setDeleting(false);
            setShowDeleteModal(false);
        }
    };

    /* ── save edits ── */
    const saveEdits = async () => {
        setSaving(true);
        try {
            const payload = {
                status:          editStatus,
                durationMinutes: editDuration !== '' ? Number(editDuration) : undefined,
                notes:           editNotes,
                preGrowth:       editPhases.preGrowth,
                growth:          editPhases.growth,
                postGrowth:      editPhases.postGrowth,
            };
            const res = await axios.put(`http://localhost:5000/api/runs/${id}`, payload);
            const updated = res.data.data ?? res.data;
            setRun(updated);
            setEditMode(false);
            setSaveMsg({ text: 'Run updated successfully', ok: true });
            setTimeout(() => setSaveMsg(null), 3000);
        } catch (err) {
            console.error(err);
            setSaveMsg({ text: 'Failed to save changes', ok: false });
            setTimeout(() => setSaveMsg(null), 3500);
        }
        setSaving(false);
    };

    /* ── phase row helpers for edit mode ── */
    const makePhaseHandlers = (key) => ({
        add: () => setEditPhases(p => ({
            ...p,
            [key]: [...p[key], { temp: '', rampRate: '', hold: { value: '', unit: 'min' }, pressure: '', remarks: '' }]
        })),
        update: (i, field, value) => setEditPhases(p => ({
            ...p,
            [key]: p[key].map((row, idx) => {
                if (idx !== i) return row;
                if (field === 'holdValue') return { ...row, hold: { ...row.hold, value } };
                if (field === 'holdUnit')  return { ...row, hold: { ...row.hold, unit: value } };
                return { ...row, [field]: value };
            })
        })),
        remove: (i) => setEditPhases(p => ({
            ...p,
            [key]: p[key].filter((_, idx) => idx !== i)
        })),
    });

    const downloadReport = () => window.open(`http://localhost:5000/api/reports/${id}`, '_blank');

    /* ── loading / not found ── */
    if (loading) return (
        <div style={s.stateScreen}>
            <div style={s.spinnerAnim} />
            <p style={s.stateText}>Loading run details…</p>
        </div>
    );
    if (!run) return (
        <div style={s.stateScreen}>
            <p style={s.stateText}>Run not found.</p>
            <Link to="/logs" style={s.backBtn}>← Back to Logs</Link>
        </div>
    );

    /* ── derived data ── */
    const preGrowth  = run.preGrowth  || [];
    const growth     = run.growth     || [];
    const postGrowth = run.postGrowth || [];
    const images     = run.images     || [];

    const statusMap = {
        completed:   { label: 'Completed',   style: s.badgeCompleted   },
        in_progress: { label: 'In Progress', style: s.badgeInProgress  },
        failed:      { label: 'Failed',      style: s.badgeFailed      },
    };

    /* show current status badge: if in edit mode, reflect editStatus */
    const displayStatus = editMode ? editStatus : run.status;
    const badge = statusMap[displayStatus] || { label: displayStatus, style: s.badgeDefault };

    const activePhaseConfig = PHASES.find(p => p.key === activePhase);
    const activeRows = editMode ? editPhases[activePhase] : (run[activePhase] || []);
    const totalSteps = preGrowth.length + growth.length + postGrowth.length;
    const isInProgress = run.status === 'in_progress';

    return (
        <div style={s.root}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600;700&display=swap');
                * { box-sizing: border-box; }
                .img-card:hover .img-overlay { opacity: 1 !important; }
                .img-card:hover img { transform: scale(1.04); }
                .phase-tab:hover { background: #F7F5F1 !important; }
                .action-btn:hover { opacity: 0.85; transform: translateY(-1px); }
                .cell-input:focus { border-color: #BA7517 !important; outline: none; }
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes slideIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
            `}</style>

            {/* ── TOAST ── */}
            {saveMsg && (
                <div style={{ ...s.toast, ...(saveMsg.ok ? s.toastOk : s.toastErr) }}>
                    {saveMsg.ok ? '✓' : '✕'} {saveMsg.text}
                </div>
            )}

            {/* ── LIGHTBOX ── */}
            {lightbox && (
                <div style={s.lightboxOverlay} onClick={() => setLightbox(null)}>
                    <button style={s.lightboxClose} onClick={() => setLightbox(null)}>✕</button>
                    <div style={s.lightboxInner} onClick={e => e.stopPropagation()}>
                        <img src={lightbox.src} alt="preview" style={s.lightboxImg} />
                        {lightbox.caption?.trim() && (
                            <p style={s.lightboxCaption}>{lightbox.caption}</p>
                        )}
                    </div>
                </div>
            )}

            {/* ── DELETE MODAL ── */}
            {showDeleteModal && (
                <div style={s.lightboxOverlay} onClick={() => !deleting && setShowDeleteModal(false)}>
                    <div style={s.modalBox} onClick={e => e.stopPropagation()}>
                        <div style={s.modalIcon}>⚠</div>
                        <h3 style={s.modalTitle}>Delete Run?</h3>
                        <p style={s.modalBody}>
                            This will permanently delete <strong>{run.runId}</strong> and all its data. This cannot be undone.
                        </p>
                        <div style={s.modalActions}>
                            <button
                                style={s.modalCancelBtn}
                                onClick={() => setShowDeleteModal(false)}
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                            <button
                                style={s.modalDeleteBtn}
                                onClick={deleteRun}
                                disabled={deleting}
                            >
                                {deleting ? 'Deleting…' : 'Yes, Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div style={s.page}>

                {/* ── HEADER ── */}
                <div style={s.header}>
                    <div style={s.headerLeft}>
                        <Link to="/logs" style={s.backBtn}>← Run Logs</Link>
                        <div style={s.titleRow}>
                            <h1 style={s.title}>{run.runId}</h1>
                            <span style={{ ...s.badge, ...badge.style }}>{badge.label}</span>
                            {isInProgress && (
                                <span style={s.editablePill}>✎ Editable</span>
                            )}
                        </div>
                        <p style={s.subtitle}>
                            {run.materialType === 'carbide' ? '🔩 Carbide' : '🧪 Source Powder'}
                            &nbsp;·&nbsp;Operator: <strong>{run.operatorName}</strong>
                            {run.durationMinutes && <>&nbsp;·&nbsp;{run.durationMinutes} min total</>}
                            {run.dateTime && <>&nbsp;·&nbsp;{new Date(run.dateTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>}
                        </p>
                    </div>

                    <div style={s.headerActions}>
                        {/* Edit / Save / Cancel buttons — only for in_progress */}
                        {isInProgress && !editMode && (
                            <button
                                onClick={() => setEditMode(true)}
                                style={s.editBtn}
                                className="action-btn"
                            >
                                ✎ Edit Run
                            </button>
                        )}
                        {editMode && (
                            <>
                                <button
                                    onClick={() => { setEditMode(false); setEditStatus(run.status); }}
                                    style={s.cancelEditBtn}
                                    disabled={saving}
                                    className="action-btn"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveEdits}
                                    style={s.saveEditBtn}
                                    disabled={saving}
                                    className="action-btn"
                                >
                                    {saving ? 'Saving…' : '✓ Save Changes'}
                                </button>
                            </>
                        )}
                        {!editMode && (
                            <button onClick={downloadReport} style={s.downloadBtn} className="action-btn">
                                {run.status === 'completed' ? '↓ Download PDF' : '⚡ Generate Report'}
                            </button>
                        )}
                        <button
                            onClick={() => setShowDeleteModal(true)}
                            style={s.deleteRunBtn}
                            className="action-btn"
                        >
                            🗑 Delete Run
                        </button>
                    </div>
                </div>

                <div style={s.divider} />

                {/* ── EDIT META PANEL (in_progress only) ── */}
                {editMode && (
                    <div style={s.editPanel}>
                        <div style={s.editPanelTitle}>✎ Editing Run</div>
                        <div style={s.editPanelGrid}>

                            {/* Status */}
                            <div style={s.editField}>
                                <label style={s.editLabel}>Status</label>
                                <select
                                    value={editStatus}
                                    onChange={e => setEditStatus(e.target.value)}
                                    style={s.editSelect}
                                >
                                    <option value="in_progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                    <option value="failed">Failed</option>
                                </select>
                            </div>

                            {/* Duration */}
                            <div style={s.editField}>
                                <label style={s.editLabel}>Duration (min)</label>
                                <input
                                    type="number"
                                    value={editDuration}
                                    onChange={e => setEditDuration(e.target.value)}
                                    placeholder="e.g. 120"
                                    style={s.editInput}
                                    className="cell-input"
                                />
                            </div>

                            {/* Notes — full width */}
                            <div style={{ ...s.editField, gridColumn: '1 / -1' }}>
                                <label style={s.editLabel}>Operator Notes</label>
                                <textarea
                                    value={editNotes}
                                    onChange={e => setEditNotes(e.target.value)}
                                    rows={3}
                                    placeholder="Add notes…"
                                    style={s.editTextarea}
                                    className="cell-input"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* ── STAT PILLS ── */}
                <div style={s.statRow}>
                    {[
                        { label: 'Total Steps', value: totalSteps },
                        { label: 'Pre-Growth',  value: `${preGrowth.length} steps`,  color: '#5B8DD9' },
                        { label: 'Growth',      value: `${growth.length} steps`,     color: '#D85A30' },
                        { label: 'Post-Growth', value: `${postGrowth.length} steps`, color: '#1D9E75' },
                        { label: 'Images',      value: images.length },
                    ].map((stat, i) => (
                        <div key={i} style={s.statPill}>
                            <span style={{ ...s.statValue, ...(stat.color ? { color: stat.color } : {}) }}>{stat.value}</span>
                            <span style={s.statLabel}>{stat.label}</span>
                        </div>
                    ))}
                </div>

                {/* ── PROFILE CHART ── */}
                {totalSteps > 0 && (
                    <div style={{ ...s.card, marginBottom: 20 }}>
                        <div style={s.cardHeader}>
                            <span style={{ ...s.cardDot, background: '#BA7517' }} />
                            <h3 style={s.cardTitle}>Temperature Profile</h3>
                        </div>
                        {/* overflow:visible + padding ensures axis/tick labels are never clipped */}
                        <div style={{ overflowX: 'auto', padding: '4px 8px 12px 8px' }}>
                            <RunProfileChart
                                preGrowth={preGrowth}
                                growth={growth}
                                postGrowth={postGrowth}
                            />
                        </div>
                    </div>
                )}

                {/* ── PHASE TABLES ── */}
                <div style={s.card}>
                    <div style={s.cardHeader}>
                        <span style={{ ...s.cardDot, background: activePhaseConfig?.accent || '#888' }} />
                        <h3 style={s.cardTitle}>Phase Profile</h3>
                        {editMode && (
                            <span style={s.editingChip}>Editing</span>
                        )}
                    </div>

                    {/* tabs */}
                    <div style={s.phaseTabs}>
                        {PHASES.map(p => {
                            const isActive = activePhase === p.key;
                            const rows = editMode ? editPhases[p.key] : (run[p.key] || []);
                            return (
                                <button
                                    key={p.key}
                                    className="phase-tab"
                                    onClick={() => setActivePhase(p.key)}
                                    style={{
                                        ...s.phaseTab,
                                        ...(isActive ? {
                                            borderBottom: `2px solid ${p.accent}`,
                                            color: p.accent,
                                            background: p.bg + '99',
                                            fontWeight: 700,
                                        } : {}),
                                    }}
                                >
                                    {p.label}
                                    <span style={{
                                        ...s.phaseTabCount,
                                        background: isActive ? p.accent : '#EEE',
                                        color: isActive ? '#fff' : '#888',
                                    }}>{rows.length}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* read-only or editable table */}
                    {editMode ? (
                        <div>
                            {activeRows.length === 0 ? (
                                <div style={s.phaseEmpty}>
                                    <span style={{ opacity: 0.4, marginRight: 8 }}>—</span>No steps yet
                                </div>
                            ) : (
                                <div style={s.tableScroll}>
                                    <table style={s.table}>
                                        <thead>
                                            <tr>
                                                <th style={s.thIdx}>#</th>
                                                <th style={s.th}>Temp (°C)</th>
                                                <th style={s.th}>Ramp (°C/min)</th>
                                                <th style={s.th}>Hold</th>
                                                <th style={s.th}>Pressure (bar)</th>
                                                <th style={{ ...s.th, minWidth: 160 }}>Remarks</th>
                                                <th style={s.thAction} />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeRows.map((row, i) => {
                                                const handlers = makePhaseHandlers(activePhase);
                                                return (
                                                    <EditablePhaseRow
                                                        key={i}
                                                        row={row}
                                                        index={i}
                                                        accent={activePhaseConfig?.accent || '#888'}
                                                        onUpdate={handlers.update}
                                                        onRemove={handlers.remove}
                                                    />
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <div style={s.addRowBar}>
                                <button
                                    onClick={makePhaseHandlers(activePhase).add}
                                    style={{ ...s.addRowBtn, color: activePhaseConfig?.accent || '#BA7517' }}
                                >
                                    <span style={{ ...s.addRowPlus, background: (activePhaseConfig?.accent || '#BA7517') + '18' }}>+</span>
                                    Add Step
                                </button>
                            </div>
                        </div>
                    ) : (
                        <PhaseTable phase={activePhaseConfig} rows={activeRows} />
                    )}
                </div>

                {/* ── NOTES ── */}
                {(run.notes?.trim() || editMode) && (
                    <div style={s.card}>
                        <div style={s.cardHeader}>
                            <span style={{ ...s.cardDot, background: '#888' }} />
                            <h3 style={s.cardTitle}>Operator Notes</h3>
                        </div>
                        {editMode ? (
                            <textarea
                                value={editNotes}
                                onChange={e => setEditNotes(e.target.value)}
                                rows={4}
                                style={s.noteTextarea}
                                className="cell-input"
                                placeholder="Add notes…"
                            />
                        ) : (
                            <p style={s.noteText}>{run.notes}</p>
                        )}
                    </div>
                )}

                {/* ── IMAGES ── */}
                {/* BUG FIX: images were rendering broken if img.path was undefined;
                    now using imgSrc() resolver that handles path / url / src variants */}
                {images.length > 0 && (
                    <div style={s.card}>
                        <div style={s.cardHeader}>
                            <span style={{ ...s.cardDot, background: '#6C4EBF' }} />
                            <h3 style={s.cardTitle}>Uploaded Images</h3>
                            <span style={s.imageCount}>{images.length} file{images.length !== 1 ? 's' : ''}</span>
                        </div>

                        <div style={s.imageGrid}>
                            {images.map((img, i) => {
                                const src = imgSrc(img);
                                const caption = img.caption?.trim() || '';
                                return (
                                    <div
                                        key={i}
                                        className="img-card"
                                        style={s.imageCard}
                                        onClick={() => setLightbox({ src, caption })}
                                        title={caption || `Image #${i + 1}`}
                                    >
                                        {/* thumbnail */}
                                        <div style={{ position: 'relative', overflow: 'hidden' }}>
                                            <img
                                                src={src}
                                                alt={caption || `run-image-${i + 1}`}
                                                style={{ ...s.image, transition: 'transform 0.22s ease' }}
                                                onError={e => { e.target.style.display = 'none'; }}
                                            />
                                            {/* hover overlay */}
                                            <div
                                                className="img-overlay"
                                                style={{ ...s.imageHoverOverlay, opacity: 0, transition: 'opacity 0.18s' }}
                                            >
                                                <span style={{ color: '#fff', fontSize: 26, fontWeight: 300 }}>⤢</span>
                                            </div>
                                            {/* index badge */}
                                            <span style={s.imageBadge}>#{i + 1}</span>
                                        </div>

                                        {/* caption area — always shown, prominent */}
                                        <div style={s.imageCaptionBox}>
                                            {caption ? (
                                                <>
                                                    <div style={s.imageCaptionLabel}>Caption</div>
                                                    <div style={s.imageCaptionText}>{caption}</div>
                                                </>
                                            ) : (
                                                <div style={s.imageCaptionEmpty}>No caption</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

/* ══ styles ══════════════════════════════════════════════════ */
const s = {
    root: {
        background: '#F0EDE8', minHeight: '100vh',
        fontFamily: "'DM Sans', sans-serif", padding: '0 0 60px',
    },
    page: { maxWidth: 1180, margin: '0 auto', padding: '36px 40px' },

    stateScreen: {
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', gap: 16,
    },
    spinnerAnim: {
        width: 36, height: 36,
        border: '3px solid #DDD', borderTopColor: '#1A2B4A',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    },
    stateText: { fontSize: 16, color: '#666' },

    /* toast */
    toast: {
        position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
        padding: '13px 20px', borderRadius: 10,
        fontSize: 13.5, fontWeight: 600, color: '#fff',
        boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
        animation: 'slideIn 0.2s ease',
    },
    toastOk:  { background: '#1D9E75' },
    toastErr: { background: '#D85A30' },

    /* header */
    header: {
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', gap: 24, marginBottom: 20,
    },
    headerLeft: { display: 'flex', flexDirection: 'column', gap: 6 },
    backBtn: {
        display: 'inline-flex', alignItems: 'center',
        textDecoration: 'none', fontSize: 13, fontWeight: 600,
        color: '#555', background: '#fff', border: '1px solid #DDD',
        padding: '7px 14px', borderRadius: 8, width: 'fit-content',
    },
    titleRow: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, flexWrap: 'wrap' },
    title: { margin: 0, fontSize: 28, fontWeight: 700, color: '#1A2B4A', letterSpacing: -0.5 },
    subtitle: { margin: 0, fontSize: 14, color: '#777' },
    headerActions: {
        display: 'flex', alignItems: 'center', gap: 10,
        paddingTop: 34, flexShrink: 0, flexWrap: 'wrap',
    },
    divider: { height: 1, background: '#DDD8D0', marginBottom: 24 },

    /* badges */
    badge: {
        padding: '5px 12px', borderRadius: 999,
        fontSize: 11, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.06em',
    },
    badgeCompleted:  { background: '#DFF5EE', color: '#157A58' },
    badgeInProgress: { background: '#FEF0D6', color: '#9A6010' },
    badgeFailed:     { background: '#FDECEA', color: '#B03030' },
    badgeDefault:    { background: '#EEEEEE', color: '#555555' },

    editablePill: {
        padding: '4px 10px', borderRadius: 999,
        fontSize: 11, fontWeight: 700,
        background: '#EEF4FF', color: '#3B68C9',
        letterSpacing: '0.04em',
    },

    /* action buttons */
    downloadBtn: {
        background: '#1A2B4A', color: '#fff', border: 'none',
        padding: '10px 20px', borderRadius: 9,
        fontWeight: 600, fontSize: 14, cursor: 'pointer',
        fontFamily: 'inherit', transition: 'all 0.15s',
    },
    deleteRunBtn: {
        background: '#fff', color: '#B03030',
        border: '1.5px solid #F0C0C0',
        padding: '9px 18px', borderRadius: 9,
        fontWeight: 600, fontSize: 14, cursor: 'pointer',
        fontFamily: 'inherit', transition: 'all 0.15s',
    },
    editBtn: {
        background: '#EEF4FF', color: '#3B68C9',
        border: '1.5px solid #BDD0F4',
        padding: '9px 18px', borderRadius: 9,
        fontWeight: 600, fontSize: 14, cursor: 'pointer',
        fontFamily: 'inherit', transition: 'all 0.15s',
    },
    saveEditBtn: {
        background: '#BA7517', color: '#fff', border: 'none',
        padding: '10px 20px', borderRadius: 9,
        fontWeight: 700, fontSize: 14, cursor: 'pointer',
        fontFamily: 'inherit', transition: 'all 0.15s',
    },
    cancelEditBtn: {
        background: '#fff', color: '#555',
        border: '1.5px solid #DDD',
        padding: '9px 18px', borderRadius: 9,
        fontWeight: 600, fontSize: 14, cursor: 'pointer',
        fontFamily: 'inherit', transition: 'all 0.15s',
    },

    /* edit panel */
    editPanel: {
        background: '#FFFBF2',
        border: '1.5px solid #F0D898',
        borderRadius: 12, padding: '20px 24px',
        marginBottom: 20,
    },
    editPanelTitle: {
        fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.1em', color: '#9A6010', marginBottom: 16,
    },
    editPanelGrid: {
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px',
    },
    editField: { display: 'flex', flexDirection: 'column', gap: 6 },
    editLabel: { fontSize: 12, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.07em' },
    editInput: {
        padding: '10px 12px', border: '1.5px solid #E0DDD5',
        borderRadius: 8, fontSize: 14,
        fontFamily: "'DM Sans', sans-serif",
        background: '#fff', color: '#222',
    },
    editSelect: {
        padding: '10px 12px', border: '1.5px solid #E0DDD5',
        borderRadius: 8, fontSize: 14,
        fontFamily: "'DM Sans', sans-serif",
        background: '#fff', color: '#222',
    },
    editTextarea: {
        padding: '10px 12px', border: '1.5px solid #E0DDD5',
        borderRadius: 8, fontSize: 14,
        fontFamily: "'DM Sans', sans-serif",
        background: '#fff', color: '#222',
        resize: 'vertical',
    },

    /* stat pills */
    statRow: {
        display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap',
    },
    statPill: {
        background: '#fff', border: '1px solid #E8E4DF',
        borderRadius: 10, padding: '10px 16px',
        display: 'flex', flexDirection: 'column', gap: 2,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    },
    statValue: { fontSize: 18, fontWeight: 700, color: '#1A2B4A', lineHeight: 1.2 },
    statLabel: { fontSize: 11, fontWeight: 600, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.07em' },

    /* cards */
    card: {
        background: '#fff', borderRadius: 14,
        padding: '24px 24px 20px',
        border: '1px solid #E8E4DF', marginBottom: 16,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    },
    cardHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 },
    cardDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
    cardTitle: { margin: 0, fontSize: 16, fontWeight: 700, color: '#1A2B4A', flex: 1 },
    editingChip: {
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: '#9A6010',
        background: '#FEF0D6', padding: '3px 10px', borderRadius: 999,
    },

    /* phase tabs */
    phaseTabs: {
        display: 'flex', gap: 2, marginBottom: 16,
        borderBottom: '1px solid #EEEBE3',
    },
    phaseTab: {
        padding: '9px 16px', background: 'none',
        border: 'none', borderBottom: '2px solid transparent',
        fontSize: 13, fontWeight: 500, color: '#888',
        cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
        display: 'flex', alignItems: 'center', gap: 7,
        transition: 'all 0.15s', borderRadius: '8px 8px 0 0',
        marginBottom: -1,
    },
    phaseTabCount: {
        fontSize: 11, fontWeight: 700,
        padding: '2px 7px', borderRadius: 99,
        transition: 'all 0.15s',
    },
    phaseEmpty: {
        padding: '20px 16px', fontSize: 13, color: '#AAA',
        background: '#FAFAF7', borderRadius: 10,
        border: '1px dashed #E0DDD5',
    },

    /* phase table */
    tableScroll: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' },
    th: {
        padding: '10px 14px', fontSize: 11, fontWeight: 700,
        color: '#888', textTransform: 'uppercase', letterSpacing: '0.07em',
        background: '#F7F5F1', borderBottom: '1px solid #EEEBE3', textAlign: 'left',
    },
    thIdx: {
        padding: '10px 8px 10px 16px', width: 44,
        fontSize: 11, fontWeight: 700, color: '#888',
        textTransform: 'uppercase', letterSpacing: '0.07em',
        background: '#F7F5F1', borderBottom: '1px solid #EEEBE3',
    },
    thAction: {
        width: 44, background: '#F7F5F1', borderBottom: '1px solid #EEEBE3',
    },
    tr: { borderBottom: '1px solid #F4F2EF' },
    td: { padding: '10px 14px', fontSize: 13, color: '#333', verticalAlign: 'middle' },
    tdIdx: { padding: '10px 8px 10px 16px', verticalAlign: 'middle' },
    tdRemarks: { padding: '10px 14px', fontSize: 12.5, color: '#666', verticalAlign: 'middle' },
    tdAction: { padding: '8px', verticalAlign: 'middle', width: 44 },
    rowIdx: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 24, borderRadius: 6,
        fontSize: 11, fontWeight: 700,
    },
    mono: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 },

    /* editable cell inputs */
    cellWrap: { display: 'flex', alignItems: 'center', gap: 5 },
    cellInput: {
        padding: '7px 9px', border: '1.5px solid #E0DDD5',
        borderRadius: 7, fontSize: 13,
        fontFamily: "'IBM Plex Mono', monospace",
        background: '#FAFAF7', color: '#222',
        width: '100%', minWidth: 65,
        transition: 'border-color 0.15s',
    },
    cellUnit: { fontSize: 11, fontWeight: 600, color: '#BBB', whiteSpace: 'nowrap', flexShrink: 0 },
    holdSelect: {
        padding: '7px 8px', border: '1.5px solid #E0DDD5',
        borderRadius: 7, fontSize: 12, fontWeight: 600,
        fontFamily: "'DM Sans', sans-serif",
        background: '#FAFAF7', color: '#555',
        cursor: 'pointer', flexShrink: 0,
    },
    remarksInput: {
        width: '100%', padding: '7px 10px',
        border: '1.5px solid #E0DDD5', borderRadius: 7,
        fontSize: 13, fontFamily: "'DM Sans', sans-serif",
        background: '#FAFAF7', color: '#222',
        transition: 'border-color 0.15s',
    },
    rmBtn: {
        width: 28, height: 28, borderRadius: '50%',
        border: '1.5px solid #EEE', background: '#fff',
        color: '#D85A30', cursor: 'pointer', fontSize: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
    },

    /* add row bar */
    addRowBar: { padding: '10px 16px', borderTop: '1px solid #F4F2EF' },
    addRowBtn: {
        display: 'inline-flex', alignItems: 'center', gap: 7,
        fontSize: 12.5, fontWeight: 600, background: 'none',
        border: 'none', cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif", opacity: 0.8,
    },
    addRowPlus: {
        width: 20, height: 20, borderRadius: 5,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700, lineHeight: 1, flexShrink: 0,
    },

    /* notes */
    noteText: {
        margin: 0, fontSize: 14, color: '#444', lineHeight: 1.7,
        background: '#FAFAF8', border: '1px solid #EDEAE4',
        borderRadius: 10, padding: '16px 18px',
    },
    noteTextarea: {
        width: '100%', padding: '14px 16px',
        border: '1.5px solid #E0DDD5', borderRadius: 10,
        fontSize: 14, lineHeight: 1.7,
        fontFamily: "'DM Sans', sans-serif",
        background: '#FAFAF8', color: '#444',
        resize: 'vertical',
    },

    /* ── images (fully reworked) ── */
    imageCount: {
        fontSize: 12, color: '#999', fontWeight: 600,
        background: '#F4F2EF', padding: '3px 10px', borderRadius: 999,
    },
    imageGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 16,
    },
    imageCard: {
        borderRadius: 12, overflow: 'hidden',
        border: '1px solid #EDEAE4', background: '#fff',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.2s, transform 0.2s',
    },
    image: {
        width: '100%', height: 170, objectFit: 'cover', display: 'block',
    },
    imageHoverOverlay: {
        position: 'absolute', inset: 0,
        background: 'rgba(26,43,74,0.42)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    imageBadge: {
        position: 'absolute', top: 8, left: 8,
        background: 'rgba(0,0,0,0.55)', color: '#fff',
        fontSize: 10, fontWeight: 700, padding: '3px 8px',
        borderRadius: 6, letterSpacing: '0.05em',
    },
    /* prominent caption box */
    imageCaptionBox: {
        padding: '12px 14px',
        borderTop: '1px solid #EDEAE4',
        background: '#FAFAF7',
        minHeight: 48,
    },
    imageCaptionLabel: {
        fontSize: 10, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.1em',
        color: '#AAA', marginBottom: 4,
    },
    imageCaptionText: {
        fontSize: 13, color: '#333', lineHeight: 1.45, fontWeight: 500,
    },
    imageCaptionEmpty: {
        fontSize: 12, color: '#CCC', fontStyle: 'italic',
    },

    /* lightbox */
    lightboxOverlay: {
        position: 'fixed', inset: 0,
        background: 'rgba(10,15,25,0.82)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 32, backdropFilter: 'blur(4px)',
    },
    lightboxClose: {
        position: 'fixed', top: 20, right: 24,
        background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
        color: '#fff', width: 38, height: 38, borderRadius: '50%',
        fontSize: 16, cursor: 'pointer', zIndex: 1001, fontFamily: 'inherit',
    },
    lightboxInner: {
        maxWidth: 860, width: '100%', borderRadius: 12,
        overflow: 'hidden', background: '#111',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
    },
    lightboxImg: { width: '100%', maxHeight: '75vh', objectFit: 'contain', display: 'block' },
    lightboxCaption: {
        margin: 0, padding: '14px 20px', fontSize: 14, color: '#DDD',
        background: '#1a1a1a', borderTop: '1px solid #333', lineHeight: 1.5,
    },

    /* delete modal */
    modalBox: {
        background: '#fff', borderRadius: 16,
        padding: '36px 32px 28px', maxWidth: 420,
        width: '100%', textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    },
    modalIcon: { fontSize: 36, marginBottom: 12, color: '#D97706' },
    modalTitle: { margin: '0 0 10px', fontSize: 20, fontWeight: 700, color: '#1A2B4A' },
    modalBody: { margin: '0 0 24px', fontSize: 14, color: '#555', lineHeight: 1.6 },
    modalActions: { display: 'flex', gap: 12, justifyContent: 'center' },
    modalCancelBtn: {
        flex: 1, background: '#F4F2EF', color: '#444',
        border: '1px solid #DDD', padding: '11px 0', borderRadius: 9,
        fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
    },
    modalDeleteBtn: {
        flex: 1, background: '#B03030', color: '#fff',
        border: 'none', padding: '11px 0', borderRadius: 9,
        fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
    },
};