import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

/* ── toast ── */
function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };
  return { toast, show };
}

/* ── empty phase row ── */
const emptyRow = () => ({ temp: '', rampRate: '', holdValue: '', holdUnit: 'min', pressure: '', remarks: '' });

/* ── phase row component ── */
function PhaseRow({ row, index, onUpdate, onRemove, accent }) {
  return (
    <tr style={s.tr}>
      <td style={s.tdIdx}><span style={{ ...s.rowIdx, background: accent + '22', color: accent }}>{index + 1}</span></td>
      <td style={s.td}>
        <div style={s.cellInputWrap}>
          <input
            type="number"
            value={row.temp}
            onChange={e => onUpdate(index, 'temp', e.target.value)}
            placeholder="—"
            style={s.cellInput}
          />
          <span style={s.cellUnit}>°C</span>
        </div>
      </td>
      <td style={s.td}>
        <div style={s.cellInputWrap}>
          <input
            type="number"
            value={row.rampRate}
            onChange={e => onUpdate(index, 'rampRate', e.target.value)}
            placeholder="—"
            style={s.cellInput}
          />
          <span style={s.cellUnit}>°C/min</span>
        </div>
      </td>
      <td style={s.td}>
        <div style={s.holdCell}>
          <input
            type="number"
            value={row.holdValue}
            onChange={e => onUpdate(index, 'holdValue', e.target.value)}
            placeholder="—"
            style={{ ...s.cellInput, width: 72 }}
          />
          <select
            value={row.holdUnit}
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
        <div style={s.cellInputWrap}>
          <input
            type="number"
            value={row.pressure}
            onChange={e => onUpdate(index, 'pressure', e.target.value)}
            placeholder="—"
            style={s.cellInput}
          />
          <span style={s.cellUnit}>bar</span>
        </div>
      </td>
      <td style={s.tdRemarks}>
        <input
          value={row.remarks}
          onChange={e => onUpdate(index, 'remarks', e.target.value)}
          placeholder="Notes…"
          style={s.remarksInput}
        />
      </td>
      <td style={s.tdAction}>
        <button onClick={() => onRemove(index)} style={s.rmRowBtn} title="Remove">✕</button>
      </td>
    </tr>
  );
}

/* ── phase table ── */
function PhaseTable({ label, icon, accent, color, rows, onAdd, onUpdate, onRemove }) {
  return (
    <div style={{ ...s.phaseCard, borderTop: `3px solid ${accent}` }}>
      <div style={s.phaseHead}>
        <div style={s.phaseHeadLeft}>
          <span style={{ ...s.phaseIcon, background: color }}>{icon}</span>
          <div>
            <div style={s.phaseLabel}>{label}</div>
            <div style={s.phaseSub}>{rows.length} step{rows.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <button onClick={onAdd} style={{ ...s.addStepBtn, color: accent, borderColor: accent }} className="add-step-btn">
          + Add Step
        </button>
      </div>

      {rows.length === 0 ? (
        <div style={s.phaseEmpty}>
          <span style={s.phaseEmptyIcon}>{icon}</span>
          <span>No steps yet — click <strong>+ Add Step</strong> to begin</span>
        </div>
      ) : (
        <div style={s.tableScroll}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.thIdx}>#</th>
                <th style={s.th}>Temperature</th>
                <th style={s.th}>Ramp Rate</th>
                <th style={s.th}>Hold Duration</th>
                <th style={s.th}>Pressure</th>
                <th style={{ ...s.th, minWidth: 160 }}>Remarks</th>
                <th style={s.thAction}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <PhaseRow key={i} row={row} index={i} accent={accent} onUpdate={onUpdate} onRemove={onRemove} />
              ))}
              <tr>
                <td colSpan={7} style={{ padding: '6px 16px 10px' }}>
                  <button
                    onClick={onAdd}
                    style={{ ...s.addInlineBtn, color: accent }}
                    className="add-inline-btn"
                  >
                    <span style={{ ...s.addInlinePlus, background: accent + '18', color: accent }}>+</span>
                    Add step
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── field ── */
function Field({ label, required, error, children, fullWidth }) {
  return (
    <div style={{ ...s.field, ...(fullWidth ? { gridColumn: '1 / -1' } : {}) }}>
      <label style={s.label}>
        {label}{required && <span style={{ color: '#D85A30' }}> *</span>}
      </label>
      {children}
      {error && <span style={s.errMsg}>⚠ {error}</span>}
    </div>
  );
}

/* ══ main ═══════════════════════════════════════════════════ */
export default function AddRun() {
  const navigate = useNavigate();
  const { toast, show } = useToast();
  const fileInputRef = useRef();

  /* meta */
  const [runId, setRunId] = useState('');
  const [operator, setOperator] = useState('');
  const [materialType, setMaterialType] = useState('carbide');
  const [dateTime, setDateTime] = useState('');
  const [duration, setDuration] = useState('');
  const [durationUnit, setDurationUnit] = useState('min');
  const [status, setStatus] = useState('completed');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  /* phase rows */
  const [preRows, setPreRows] = useState([]);
  const [growthRows, setGrowthRows] = useState([]);
  const [postRows, setPostRows] = useState([]);

  /* image */
  const [images, setImages] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  /* phase helpers */
  const makeHandlers = (set) => ({
    add: () => set(r => [...r, emptyRow()]),
    update: (i, f, v) => set(r => r.map((row, idx) => idx === i ? { ...row, [f]: v } : row)),
    remove: (i) => set(r => r.filter((_, idx) => idx !== i)),
  });
  const pre = makeHandlers(setPreRows);
  const growth = makeHandlers(setGrowthRows);
  const post = makeHandlers(setPostRows);

  /* image helpers */
  const handleFiles = files => {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = e => setImages(p => [...p, { file, src: e.target.result, caption: '' }]);
      reader.readAsDataURL(file);
    });
  };
  const removeImage = i => setImages(imgs => imgs.filter((_, idx) => idx !== i));
  const updateCaption = (i, val) => setImages(imgs => imgs.map((img, idx) => idx === i ? { ...img, caption: val } : img));

  /* validate */
  const validate = () => {
    const errs = {};
    if (!runId.trim()) errs.runId = 'Run ID is required';
    if (!operator.trim()) errs.operator = 'Operator name is required';
    setErrors(errs);
    return !Object.keys(errs).length;
  };

  /* serialize phase */
  const serializePhase = rows =>
    rows.filter(r => r.temp || r.rampRate || r.holdValue || r.pressure)
      .map(r => ({
        temp: parseFloat(r.temp) || null,
        rampRate: parseFloat(r.rampRate) || null,
        hold: r.holdValue ? { value: parseFloat(r.holdValue), unit: r.holdUnit } : null,
        pressure: parseFloat(r.pressure) || null,
        remarks: r.remarks.trim(),
      }));

  /* submit */
  const submitData = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const formData = new FormData();
      images.forEach(img => formData.append('images', img.file));
      formData.append('imageCaptions', JSON.stringify(images.map(img => img.caption.trim())));
      formData.append('runId', runId.trim());
      formData.append('operatorName', operator.trim());
      formData.append('materialType', materialType);
      formData.append('dateTime', dateTime || new Date().toISOString());
      const durationInMinutes = duration ? (durationUnit === 'hr' ? parseFloat(duration) * 60 : durationUnit === 'day' ? parseFloat(duration) * 1440 : parseFloat(duration)) : '';
      formData.append('durationMinutes', durationInMinutes || '');
      formData.append('status', status);
      formData.append('notes', notes.trim());
      formData.append('preGrowth', JSON.stringify(serializePhase(preRows)));
      formData.append('growth', JSON.stringify(serializePhase(growthRows)));
      formData.append('postGrowth', JSON.stringify(serializePhase(postRows)));

      await axios.post('http://localhost:5000/api/runs', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      show('Run saved successfully!', 'success');
      setTimeout(() => navigate('/'), 1400);
    } catch (err) {
      show(err.response?.data?.message || 'Failed to save. Check the server.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const clearAll = () => {
    setRunId(''); setOperator(''); setMaterialType('carbide');
    setDateTime(''); setDuration(''); setDurationUnit('min'); setStatus('completed');
    setNotes(''); setPreRows([]); setGrowthRows([]); setPostRows([]);
    setImages([]); setErrors({});
  };

  const statusOptions = [
    { value: 'completed', label: '✓ Completed', activeStyle: s.pillCompleted },
    { value: 'in_progress', label: '⟳ In Progress', activeStyle: s.pillInProgress },
    { value: 'failed', label: '✕ Failed', activeStyle: s.pillFailed },
  ];

  return (
    <div style={s.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #F0EDE6; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
        ::placeholder { color: #C0BAB0; font-size: 13px; }
        input:focus, select:focus, textarea:focus {
          outline: none !important; border-color: #BA7517 !important;
          box-shadow: 0 0 0 3px rgba(186,117,23,0.15) !important;
        }
        .add-step-btn:hover { opacity: 0.8; }
        .add-inline-btn:hover { opacity: 1 !important; }
        select:focus { outline: none !important; border-color: #BA7517 !important; box-shadow: 0 0 0 3px rgba(186,117,23,0.15) !important; }
        .back-btn:hover { background: #F6F4EF !important; }
        .save-btn:hover:not(:disabled) { background: #9A6010 !important; transform: translateY(-1px); }
        .cancel-btn:hover { background: #F0EDE6 !important; }
        .rm-img-btn:hover { background: rgba(0,0,0,0.75) !important; }
        input[type="datetime-local"]::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; }
        tr:hover td { background: #FAFAF7; }
      `}</style>

      {/* header */}
      <div style={s.pageHeader}>
        <div>
          <div style={s.pageTitleBadge}>NEW RUN</div>
          <h1 style={s.pageTitle}>Log Baking Run</h1>
          <p style={s.pageSub}>Record pre-growth, growth, and post-growth phase data for carbide or source powder runs</p>
        </div>
        <button onClick={() => navigate('/')} style={s.backBtn} className="back-btn">← Dashboard</button>
      </div>

      {/* ── Run Info ── */}
      <div style={{ ...s.card, borderTop: '3px solid #BA7517' }}>
        <div style={s.cardHead}>
          <span style={{ ...s.phaseIcon, background: '#FEF0D6' }}>🔖</span>
          <span style={s.cardHeadLabel}>Run Information</span>
        </div>
        <div style={s.cardBody}>
          <div style={s.grid2}>
            <Field label="Run ID" required error={errors.runId}>
              <input value={runId} onChange={e => { setRunId(e.target.value); setErrors(e2 => ({ ...e2, runId: '' })); }}
                placeholder="e.g. RUN-2024-001" style={{ ...s.input, ...(errors.runId ? s.inputErr : {}) }} />
            </Field>

            <Field label="Material Type">
              <select value={materialType} onChange={e => setMaterialType(e.target.value)} style={s.input}>
                <option value="carbide">🔩 Carbide</option>
                <option value="source_powder">🧪 Source Powder</option>
              </select>
            </Field>

            <Field label="Operator Name" required error={errors.operator}>
              <input value={operator} onChange={e => { setOperator(e.target.value); setErrors(e2 => ({ ...e2, operator: '' })); }}
                placeholder="Full name" style={{ ...s.input, ...(errors.operator ? s.inputErr : {}) }} />
            </Field>

            <Field label="Date & Time">
              <input type="datetime-local" value={dateTime} onChange={e => setDateTime(e.target.value)} style={s.input} />
            </Field>

            <Field label="Duration">
              <div style={s.durationWrap}>
                <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
                  placeholder="e.g. 120" style={{ ...s.input, ...s.durationInput }} />
                <select value={durationUnit} onChange={e => setDurationUnit(e.target.value)} style={s.durationSelect}>
                  <option value="min">min</option>
                  <option value="hr">hr</option>
                  <option value="day">day</option>
                </select>
              </div>
            </Field>

            <Field label="Run Status">
              <div style={s.pillGroup}>
                {statusOptions.map(opt => (
                  <button key={opt.value} onClick={() => setStatus(opt.value)}
                    style={{ ...s.pill, ...(status === opt.value ? opt.activeStyle : {}) }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Notes & Observations" fullWidth>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Batch details, observations, anomalies…" rows={3} style={s.textarea} />
            </Field>
          </div>
        </div>
      </div>

      {/* ── Phase divider label ── */}
      <div style={s.phaseDivider}>
        <div style={s.phaseDividerLine} />
        <span style={s.phaseDividerLabel}>GROWTH PHASE PROFILES</span>
        <div style={s.phaseDividerLine} />
      </div>

      {/* ── Pre-Growth ── */}
      <PhaseTable
        label="Pre-Growth" icon="⬆️" accent="#5B8DD9" color="#E8F1FD"
        rows={preRows} onAdd={pre.add} onUpdate={pre.update} onRemove={pre.remove}
      />

      {/* ── Growth ── */}
      <PhaseTable
        label="Growth" icon="🔥" accent="#D85A30" color="#FDECEA"
        rows={growthRows} onAdd={growth.add} onUpdate={growth.update} onRemove={growth.remove}
      />

      {/* ── Post-Growth ── */}
      <PhaseTable
        label="Post-Growth" icon="❄️" accent="#1D9E75" color="#DFF5EE"
        rows={postRows} onAdd={post.add} onUpdate={post.update} onRemove={post.remove}
      />

      {/* ── Images ── */}
      <div style={{ ...s.card, borderTop: '3px solid #7A6C55', marginTop: 16 }}>
        <div style={s.cardHead}>
          <span style={{ ...s.phaseIcon, background: '#F0EDE6' }}>🖼️</span>
          <span style={s.cardHeadLabel}>Run Images</span>
        </div>
        <div style={s.cardBody}>
          <div
            onClick={() => fileInputRef.current.click()}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            style={{ ...s.dropZone, ...(dragOver ? s.dropZoneActive : {}) }}
          >
            <div style={s.dropIcon}>📁</div>
            <div style={s.dropText}>Click to upload or drag & drop images</div>
            <div style={s.dropHint}>PNG, JPG, WEBP — up to 10 MB each · Multiple files supported</div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple
            style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />

          {images.length > 0 && (
            <>
              <div style={s.imgCount}>{images.length} image{images.length !== 1 ? 's' : ''} selected</div>
              <div style={s.imgPreviewRow}>
                {images.map((img, i) => (
                  <div key={i} style={s.imgCard}>
                    <div style={{ position: 'relative' }}>
                      <img src={img.src} alt={`upload-${i}`} style={s.imgThumb} />
                      <button onClick={() => removeImage(i)} className="rm-img-btn" style={s.imgRmBtn}>✕</button>
                      <div style={s.imgOverlay}><span style={s.imgIndex}>#{i + 1}</span></div>
                    </div>
                    <div style={s.captionWrap}>
                      <label style={s.captionLabel}>Caption</label>
                      <input value={img.caption} onChange={e => updateCaption(i, e.target.value)}
                        placeholder="Describe this image…" style={s.captionInput} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── footer ── */}
      <div style={s.footer}>
        <div>{(errors.runId || errors.operator) && <span style={s.footerErr}>⚠ Please fill in all required fields</span>}</div>
        <div style={s.footerBtns}>
          <button onClick={clearAll} style={s.cancelBtn} className="cancel-btn">Clear All</button>
          <button onClick={submitData} disabled={saving}
            style={{ ...s.saveBtn, ...(saving ? s.saveBtnDisabled : {}) }} className="save-btn">
            {saving ? <><span style={s.spinner}>⟳</span> Saving…</> : <>✓ Save Run</>}
          </button>
        </div>
      </div>

      {/* toast */}
      {toast && (
        <div style={{ ...s.toast, ...(toast.type === 'success' ? s.toastSuccess : s.toastError) }}>
          <span style={s.toastIcon}>{toast.type === 'success' ? '✓' : '✕'}</span>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ══ styles ══════════════════════════════════════════════════ */
const s = {
  root: {
    fontFamily: "'DM Sans', sans-serif",
    maxWidth: 980,
    margin: '0 auto',
    padding: '32px 24px 100px',
    background: '#F0EDE6',
    minHeight: '100vh',
    color: '#1a1a1a',
  },

  /* header */
  pageHeader: {
    display: 'flex', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 32,
  },
  pageTitleBadge: {
    display: 'inline-block', fontSize: 10, fontWeight: 700,
    letterSpacing: '0.12em', color: '#BA7517', background: '#FEF0D6',
    border: '1px solid #F0D090', padding: '3px 9px', borderRadius: 4, marginBottom: 8,
  },
  pageTitle: { fontSize: 26, fontWeight: 700, letterSpacing: -0.5, margin: '0 0 6px', color: '#111' },
  pageSub: { fontSize: 13, color: '#888', margin: 0, lineHeight: 1.5, maxWidth: 520 },
  backBtn: {
    padding: '9px 18px', borderRadius: 8, border: '1.5px solid #DDD',
    background: '#fff', fontSize: 13, fontWeight: 500, color: '#555',
    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
    whiteSpace: 'nowrap', marginLeft: 16, transition: 'all 0.15s',
  },

  /* shared card */
  card: {
    background: '#fff', border: '1px solid #E4E1D9',
    borderRadius: 14, overflow: 'hidden', marginBottom: 16,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  cardHead: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '14px 20px', background: '#FAFAF7',
    borderBottom: '1px solid #EEEBE3',
  },
  cardHeadLabel: {
    fontSize: 13, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: '#444',
  },
  cardBody: { padding: '20px 20px 22px' },

  /* form grid */
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 },
  field: { display: 'flex', flexDirection: 'column', gap: 7 },
  label: { fontSize: 12, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em' },
  input: {
    width: '100%', padding: '11px 14px', border: '1.5px solid #DDD', borderRadius: 8,
    fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: '#111', background: '#fff',
    transition: 'border-color 0.15s, box-shadow 0.15s', appearance: 'none',
  },
  inputErr: { borderColor: '#D85A30', background: '#FFF8F7' },
  errMsg: { fontSize: 11.5, color: '#D85A30', fontWeight: 500 },
  textarea: {
    width: '100%', padding: '11px 14px', border: '1.5px solid #DDD', borderRadius: 8,
    fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: '#111',
    background: '#fff', resize: 'vertical', lineHeight: 1.6, transition: 'border-color 0.15s',
  },
  inputUnit: {
    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
    fontSize: 12, fontWeight: 600, color: '#AAA', pointerEvents: 'none',
  },
  durationWrap: {
    display: 'flex', gap: 8, alignItems: 'center',
  },
  durationInput: {
    flex: 1, minWidth: 0,
  },
  durationSelect: {
    padding: '11px 28px 11px 12px', border: '1.5px solid #DDD',
    borderRadius: 8, fontSize: 14, fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    background: '#fff', color: '#555',
    cursor: 'pointer', flexShrink: 0,
    appearance: 'none', WebkitAppearance: 'none',
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23AAA'/%3E%3C/svg%3E\")",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  pillGroup: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  pill: {
    padding: '8px 16px', borderRadius: 99, border: '1.5px solid #DDD',
    fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: '#FAFAF7',
    color: '#666', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s',
  },
  pillCompleted: { borderColor: '#1D9E75', background: '#DFF5EE', color: '#157A58' },
  pillInProgress: { borderColor: '#BA7517', background: '#FEF0D6', color: '#9A6010' },
  pillFailed: { borderColor: '#D85A30', background: '#FDECEA', color: '#B33' },

  /* phase section */
  phaseDivider: {
    display: 'flex', alignItems: 'center', gap: 12,
    margin: '24px 0 16px',
  },
  phaseDividerLine: { flex: 1, height: 1, background: '#DDD8CE' },
  phaseDividerLabel: {
    fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em',
    color: '#AAA', textTransform: 'uppercase', whiteSpace: 'nowrap',
  },
  phaseCard: {
    background: '#fff', border: '1px solid #E4E1D9',
    borderRadius: 14, overflow: 'hidden', marginBottom: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  phaseHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px', background: '#FAFAF7', borderBottom: '1px solid #EEEBE3',
  },
  phaseHeadLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  phaseIcon: {
    width: 30, height: 30, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0,
  },
  phaseLabel: { fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#444' },
  phaseSub: { fontSize: 11, color: '#AAA', marginTop: 2 },
  addStepBtn: {
    fontSize: 12.5, fontWeight: 600, background: 'none',
    border: '1.5px solid', borderRadius: 8,
    padding: '7px 14px', cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif", transition: 'opacity 0.15s',
  },
  phaseEmpty: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '22px 20px', fontSize: 13, color: '#AAA',
    background: '#FAFAF7', borderTop: 'none',
  },
  phaseEmptyIcon: { fontSize: 18, opacity: 0.5 },

  /* table */
  tableScroll: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' },
  th: {
    padding: '10px 12px', fontSize: 11, fontWeight: 700,
    color: '#888', textTransform: 'uppercase', letterSpacing: '0.07em',
    background: '#F7F5F1', borderBottom: '1px solid #EEEBE3',
    textAlign: 'left', whiteSpace: 'nowrap',
  },
  thIdx: {
    padding: '10px 8px 10px 16px', width: 40,
    fontSize: 11, fontWeight: 700, color: '#888',
    textTransform: 'uppercase', letterSpacing: '0.07em',
    background: '#F7F5F1', borderBottom: '1px solid #EEEBE3',
  },
  thAction: {
    width: 44, background: '#F7F5F1', borderBottom: '1px solid #EEEBE3',
  },
  tr: { borderBottom: '1px solid #F0EDE6', transition: 'background 0.1s' },
  td: { padding: '8px 12px', verticalAlign: 'middle' },
  tdIdx: { padding: '8px 8px 8px 16px', verticalAlign: 'middle', width: 40 },
  tdRemarks: { padding: '8px 12px', verticalAlign: 'middle', minWidth: 160 },
  tdAction: { padding: '8px 12px 8px 8px', verticalAlign: 'middle', width: 44 },
  rowIdx: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 22, height: 22, borderRadius: 6,
    fontSize: 11, fontWeight: 700,
  },

  /* cell inputs */
  cellInputWrap: { display: 'flex', alignItems: 'center', gap: 5 },
  cellInput: {
    padding: '7px 10px', border: '1.5px solid #E0DDD5',
    borderRadius: 7, fontSize: 13,
    fontFamily: "'IBM Plex Mono', monospace",
    background: '#FAFAF7', color: '#222',
    width: '100%', minWidth: 70,
    transition: 'border-color 0.15s',
  },
  cellUnit: { fontSize: 11, fontWeight: 600, color: '#BBB', whiteSpace: 'nowrap', flexShrink: 0 },

  /* hold cell */
  holdCell: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' },
  holdSelect: {
    padding: '7px 8px', border: '1.5px solid #E0DDD5',
    borderRadius: 7, fontSize: 12, fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    background: '#FAFAF7', color: '#555',
    cursor: 'pointer', flexShrink: 0,
    appearance: 'none', WebkitAppearance: 'none',
    paddingRight: 24,
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23AAA'/%3E%3C/svg%3E\")",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    transition: 'border-color 0.15s',
  },
  addInlineBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    fontSize: 12.5, fontWeight: 600, background: 'none',
    border: 'none', cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    padding: '2px 4px', opacity: 0.75,
    transition: 'opacity 0.15s',
  },
  addInlinePlus: {
    width: 20, height: 20, borderRadius: 5,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 700, lineHeight: 1,
    flexShrink: 0,
  },

  remarksInput: {
    width: '100%', padding: '7px 10px',
    border: '1.5px solid #E0DDD5', borderRadius: 7,
    fontSize: 13, fontFamily: "'DM Sans', sans-serif",
    background: '#FAFAF7', color: '#222',
    transition: 'border-color 0.15s',
  },
  rmRowBtn: {
    width: 28, height: 28, borderRadius: '50%',
    border: '1.5px solid #EEE', background: '#fff',
    color: '#D85A30', cursor: 'pointer', fontSize: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
  },

  /* images */
  dropZone: {
    border: '2px dashed #CCC9C0', borderRadius: 12,
    padding: '28px 20px', textAlign: 'center',
    cursor: 'pointer', transition: 'all 0.2s',
    marginBottom: 14, background: '#FAFAF7',
  },
  dropZoneActive: { borderColor: '#BA7517', background: '#FEF9F0' },
  dropIcon: { fontSize: 26, marginBottom: 8 },
  dropText: { fontSize: 14, color: '#444', fontWeight: 500 },
  dropHint: { fontSize: 12, color: '#AAA', marginTop: 4 },
  imgCount: {
    fontSize: 12, fontWeight: 600, color: '#888',
    marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  imgPreviewRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  imgCard: {
    borderRadius: 10, overflow: 'hidden',
    border: '1.5px solid #E4E1D9', width: 148,
    background: '#FAFAF7', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  imgThumb: { width: 148, height: 100, objectFit: 'cover', display: 'block' },
  imgRmBtn: {
    position: 'absolute', top: 6, right: 6,
    background: 'rgba(0,0,0,0.55)', color: '#fff',
    border: 'none', borderRadius: '50%',
    width: 22, height: 22, fontSize: 10,
    cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.15s',
  },
  imgOverlay: {
    position: 'absolute', bottom: 0, left: 0,
    background: 'linear-gradient(transparent, rgba(0,0,0,0.45))',
    width: '100%', padding: '16px 8px 4px',
  },
  imgIndex: { fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: 700 },
  captionWrap: { padding: '8px 10px 10px' },
  captionLabel: {
    display: 'block', fontSize: 10, fontWeight: 700,
    color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4,
  },
  captionInput: {
    width: '100%', padding: '6px 8px',
    border: '1.5px solid #E4E1D9', borderRadius: 6,
    fontSize: 11.5, fontFamily: "'DM Sans', sans-serif",
    background: '#fff', color: '#444', transition: 'border-color 0.15s',
  },

  /* footer */
  footer: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', paddingTop: 12,
  },
  footerErr: { fontSize: 12.5, color: '#D85A30', fontWeight: 500 },
  footerBtns: { display: 'flex', gap: 10 },
  cancelBtn: {
    padding: '11px 22px', borderRadius: 8, border: '1.5px solid #DDD',
    background: '#fff', fontSize: 13.5, fontWeight: 500, color: '#666',
    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s',
  },
  saveBtn: {
    padding: '11px 28px', borderRadius: 8, border: 'none',
    background: '#BA7517', color: '#fff', fontSize: 13.5, fontWeight: 700,
    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
    display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
  },
  saveBtnDisabled: { opacity: 0.55, cursor: 'not-allowed' },
  spinner: { display: 'inline-block' },

  toast: {
    position: 'fixed', bottom: 28, right: 28,
    padding: '13px 20px', borderRadius: 10,
    fontSize: 13.5, fontWeight: 500, color: '#fff',
    zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10,
    boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
  },
  toastSuccess: { background: '#1D9E75' },
  toastError: { background: '#D85A30' },
  toastIcon: {
    width: 20, height: 20, borderRadius: '50%',
    background: 'rgba(255,255,255,0.25)',
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 11, fontWeight: 700,
  },
};
