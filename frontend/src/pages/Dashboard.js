import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
);

/* ─── helpers ──────────────────────────────────────────────── */
const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

const MATERIAL_LABEL = { carbide: 'Carbide', source_powder: 'Source Powder' };
const STATUS_COLOR   = { completed: '#1D9E75', in_progress: '#BA7517', failed: '#D85A30' };
const STATUS_BG      = { completed: '#DFF5EE', in_progress: '#FEF0D6', failed: '#FDECEA' };

/** Max temperature across all three phase arrays */
const maxTempOfRun = (run) => {
  const allSteps = [
    ...(run.preGrowth  || []),
    ...(run.growth     || []),
    ...(run.postGrowth || []),
  ];
  const temps = allSteps.map(s => s.temp).filter(v => v != null);
  return temps.length ? Math.max(...temps) : (
    // fallback to legacy temperatureLogs
    run.temperatureLogs?.length
      ? Math.max(...run.temperatureLogs.map(p => p.value))
      : null
  );
};

/** Max pressure across all three phase arrays */
const maxPressureOfRun = (run) => {
  const allSteps = [
    ...(run.preGrowth  || []),
    ...(run.growth     || []),
    ...(run.postGrowth || []),
  ];
  const pres = allSteps.map(s => s.pressure).filter(v => v != null);
  return pres.length ? Math.max(...pres) : (
    run.pressureLogs?.length
      ? Math.max(...run.pressureLogs.map(p => p.value))
      : null
  );
};

/** Total steps across all phases */
const totalSteps = (run) =>
  (run.preGrowth?.length || 0) +
  (run.growth?.length    || 0) +
  (run.postGrowth?.length || 0);

/* ─── StatCard ─────────────────────────────────────────────── */
function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div className="db-stat-card" style={{ '--accent': accent }}>
      <div className="db-stat-icon">{icon}</div>
      <div className="db-stat-label">{label}</div>
      <div className="db-stat-value">{value ?? '—'}</div>
      {sub && <div className="db-stat-sub">{sub}</div>}
    </div>
  );
}

/* ─── Phase Badge ──────────────────────────────────────────── */
function PhasePip({ label, count, accent, bg }) {
  if (!count) return null;
  return (
    <span className="db-phase-pip" style={{ color: accent, background: bg }}>
      {label} · {count}
    </span>
  );
}

/* ─── RunRow ───────────────────────────────────────────────── */
function RunRow({ run, selected, onSelect }) {
  const maxTemp = maxTempOfRun(run);
  const maxPres = maxPressureOfRun(run);
  const isCarb  = run.materialType === 'carbide';
  const steps   = totalSteps(run);

  return (
    <div
      className={`db-run-row${selected ? ' db-run-row--selected' : ''}`}
      onClick={() => onSelect(run)}
    >
      <div className="db-run-id">
        <span className="db-run-dot" style={{ background: STATUS_COLOR[run.status] }} />
        {run.runId}
      </div>

      <span className={`db-badge ${isCarb ? 'db-badge--carbide' : 'db-badge--source'}`}>
        {isCarb ? 'Carbide' : 'Source Powder'}
      </span>

      <div className="db-run-operator">{run.operatorName}</div>
      <div className="db-run-date">{fmtDate(run.dateTime)}</div>

      {/* Phase step counts */}
      <div className="db-phase-pips">
        <PhasePip label="Pre"    count={run.preGrowth?.length}  accent="#5B8DD9" bg="#E8F1FD" />
        <PhasePip label="Growth" count={run.growth?.length}     accent="#D85A30" bg="#FDECEA" />
        <PhasePip label="Post"   count={run.postGrowth?.length} accent="#1D9E75" bg="#DFF5EE" />
        {steps === 0 && <span className="db-no-phases">No phases</span>}
      </div>

      {/* Mini bars */}
      <div className="db-run-bars">
        <span className="db-mini-bar" title="Max Temperature">
          <span
            className="db-mini-fill db-mini-fill--temp"
            style={{ width: `${Math.min(((maxTemp ?? 0) / 1500) * 100, 100)}%` }}
          />
          <span className="db-mini-lbl">{maxTemp != null ? `${maxTemp}°C` : '—'}</span>
        </span>
        <span className="db-mini-bar" title="Max Pressure">
          <span
            className="db-mini-fill db-mini-fill--pres"
            style={{ width: `${Math.min(((maxPres ?? 0) / 100) * 100, 100)}%` }}
          />
          <span className="db-mini-lbl">{maxPres != null ? `${maxPres} bar` : '—'}</span>
        </span>
      </div>

      <Link
        to={`/runs/${run._id}`}
        className="db-open-btn"
        onClick={(e) => e.stopPropagation()}
      >
        Open →
      </Link>
    </div>
  );
}

/* ─── Phase Steps Mini Table ───────────────────────────────── */
function PhaseStepsPanel({ label, accent, bg, rows }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="db-phase-block">
      <div className="db-phase-block-title" style={{ color: accent, borderLeft: `3px solid ${accent}` }}>
        {label} — {rows.length} step{rows.length !== 1 ? 's' : ''}
      </div>
      <div className="db-phase-block-rows">
        {rows.map((r, i) => (
          <div key={i} className="db-phase-row">
            <span className="db-phase-idx" style={{ background: accent + '22', color: accent }}>{i + 1}</span>
            {r.temp     != null && <span className="db-phase-tag">{r.temp}°C</span>}
            {r.rampRate != null && <span className="db-phase-tag">{r.rampRate}°C/min</span>}
            {r.hold?.value      && <span className="db-phase-tag">{r.hold.value} {r.hold.unit}</span>}
            {r.pressure != null && <span className="db-phase-tag">{r.pressure} bar</span>}
            {r.remarks  && <span className="db-phase-remarks">{r.remarks}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── RunDetailPanel ───────────────────────────────────────── */
function RunDetailPanel({ run, onClose }) {
  if (!run) return null;
  const maxTemp = maxTempOfRun(run);
  const maxPres = maxPressureOfRun(run);
  const steps   = totalSteps(run);

  const hasPhases =
    (run.preGrowth?.length || 0) +
    (run.growth?.length    || 0) +
    (run.postGrowth?.length || 0) > 0;

  return (
    <div className="db-detail-panel">
      {/* header */}
      <div className="db-detail-header">
        <div>
          <div className="db-detail-runid">{run.runId}</div>
          <div className="db-detail-sub">
            {MATERIAL_LABEL[run.materialType]} · {run.operatorName} · {fmtDate(run.dateTime)}
          </div>
        </div>
        <button className="db-close-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>

      {/* stat grid */}
      <div className="db-detail-stats">
        {[
          { label: 'Max Temp',     value: maxTemp != null ? `${maxTemp}°C` : '—',           accent: '#BA7517' },
          { label: 'Max Pressure', value: maxPres != null ? `${maxPres} bar` : '—',          accent: '#1D9E75' },
          { label: 'Status',       value: run.status.replace('_', ' '),                       accent: STATUS_COLOR[run.status] },
          { label: 'Duration',     value: run.durationMinutes ? `${run.durationMinutes} min` : '—', accent: '#888' },
          { label: 'Phase Steps',  value: steps || '—',                                       accent: '#5B8DD9' },
          { label: 'Images',       value: run.images?.length || 0,                            accent: '#9B6CC8' },
        ].map((s) => (
          <div key={s.label} className="db-detail-stat">
            <div className="db-detail-stat-label">{s.label}</div>
            <div className="db-detail-stat-value" style={{ color: s.accent }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* phase steps */}
      {hasPhases ? (
        <div className="db-phase-steps-wrap">
          <PhaseStepsPanel label="Pre-Growth"  accent="#5B8DD9" bg="#E8F1FD" rows={run.preGrowth}  />
          <PhaseStepsPanel label="Growth"      accent="#D85A30" bg="#FDECEA" rows={run.growth}     />
          <PhaseStepsPanel label="Post-Growth" accent="#1D9E75" bg="#DFF5EE" rows={run.postGrowth} />
        </div>
      ) : (
        <div className="db-no-phase-msg">No phase data recorded for this run.</div>
      )}

      {/* notes */}
      {run.notes && (
        <div className="db-detail-notes">
          <div className="db-detail-notes-label">Notes</div>
          <div className="db-detail-notes-body">{run.notes}</div>
        </div>
      )}

      {/* images */}
      {run.images?.length > 0 && (
        <div className="db-detail-images">
          {run.images.slice(0, 4).map((img, i) => (
            <div key={i} className="db-img-thumb">
              <img
                src={img.src || img.url || `http://localhost:5000${img.path}`}
                alt={img.caption || `Image ${i + 1}`}
              />
              {img.caption && <div className="db-img-caption">{img.caption}</div>}
            </div>
          ))}
        </div>
      )}

      <Link to={`/runs/${run._id}`} className="db-full-btn">View Full Run →</Link>
    </div>
  );
}

/* ─── Dashboard (main) ─────────────────────────────────────── */
export default function Dashboard() {
  const [runs, setRuns] = useState([]);
  const [stats, setStats] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortField, setSortField] = useState('dateTime');
  const [sortDir, setSortDir] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [runsRes, statsRes] = await Promise.all([
        axios.get('http://localhost:5000/api/runs'),
        axios.get('http://localhost:5000/api/runs/stats/summary'),
      ]);
      setRuns(runsRes.data.data ?? runsRes.data);
      setStats(statsRes.data.data ?? null);
    } catch {
      setError('Could not reach the server. Make sure the backend is running on port 5000.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* derived stats from runs (phase-aware fallback if API stats are absent) */
  const derivedStats = {
    total:        runs.length,
    carbide:      runs.filter(r => r.materialType === 'carbide').length,
    sourcePowder: runs.filter(r => r.materialType === 'source_powder').length,
    completed:    runs.filter(r => r.status === 'completed').length,
    failed:       runs.filter(r => r.status === 'failed').length,
    avgTemp: (() => {
      const vals = runs.map(maxTempOfRun).filter(v => v != null);
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    })(),
    avgPressure: (() => {
      const vals = runs.map(maxPressureOfRun).filter(v => v != null);
      return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
    })(),
  };

  const S = {
    total:        stats?.total        ?? derivedStats.total,
    carbide:      stats?.carbide      ?? derivedStats.carbide,
    sourcePowder: stats?.sourcePowder ?? derivedStats.sourcePowder,
    completed:    stats?.completed    ?? derivedStats.completed,
    failed:       stats?.failed       ?? derivedStats.failed,
    avgTemp:      stats?.avgTemp      ?? derivedStats.avgTemp,
    avgPressure:  stats?.avgPressure  ?? derivedStats.avgPressure,
  };

  /* filter + sort */
  const filtered = runs
    .filter((r) => {
      const q = search.toLowerCase();
      return (
        (!q || r.runId.toLowerCase().includes(q) || r.operatorName.toLowerCase().includes(q)) &&
        (!filterType   || r.materialType === filterType) &&
        (!filterStatus || r.status       === filterStatus)
      );
    })
    .sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (sortField === 'maxTemp') {
        va = maxTempOfRun(a) ?? -1;
        vb = maxTempOfRun(b) ?? -1;
      }
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      return va < vb ? (sortDir === 'asc' ? -1 : 1) : va > vb ? (sortDir === 'asc' ? 1 : -1) : 0;
    });

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  };

  /* chart: recent 10 runs, max temp per phase */
  const recentRuns = [...runs]
    .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))
    .slice(0, 10)
    .reverse();

  const overviewData = {
    labels: recentRuns.map((r) => r.runId),
    datasets: [
      {
        label: 'Max Temp (°C)',
        data: recentRuns.map(r => maxTempOfRun(r) ?? 0),
        backgroundColor: 'rgba(186,117,23,0.85)',
        borderRadius: 5,
        borderSkipped: false,
      },
      {
        label: 'Max Pressure (bar)',
        data: recentRuns.map(r => maxPressureOfRun(r) ?? 0),
        backgroundColor: 'rgba(29,158,117,0.85)',
        borderRadius: 5,
        borderSkipped: false,
      },
    ],
  };

  /* donut: status split */
  const donutData = {
    labels: ['Completed', 'In Progress', 'Failed'],
    datasets: [{
      data: [
        runs.filter(r => r.status === 'completed').length,
        runs.filter(r => r.status === 'in_progress').length,
        runs.filter(r => r.status === 'failed').length,
      ],
      backgroundColor: ['#1D9E75', '#BA7517', '#D85A30'],
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="db-root">

        {/* page header */}
        <div className="db-page-header">
          <div>
            <h1 className="db-page-title">Baking Run Dashboard</h1>
            <p className="db-page-sub">Phase-by-phase view of all industrial baking runs</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/logs"  className="db-new-btn db-new-btn--ghost">Logs</Link>
            <Link to="/add"   className="db-new-btn">+ New Run</Link>
          </div>
        </div>

        {error && (
          <div className="db-error">
            {error}
            <button onClick={fetchAll}>Retry</button>
          </div>
        )}

        {loading ? (
          <div className="db-loading">
            <div className="db-spinner" />
            Loading runs…
          </div>
        ) : (
          <>
            {/* stat cards */}
            <div className="db-stats-row">
              <StatCard label="Total Runs"       value={S.total}        accent="#BA7517" icon="📋" />
              <StatCard label="Carbide"          value={S.carbide}      accent="#8B6914" icon="🔩" />
              <StatCard label="Source Powder"    value={S.sourcePowder} accent="#1D9E75" icon="🧪" />
              <StatCard label="Avg Peak Temp"    value={S.avgTemp != null ? `${S.avgTemp}°C` : '—'}   accent="#D85A30" icon="🌡️" />
              <StatCard label="Avg Peak Pressure" value={S.avgPressure != null ? `${S.avgPressure} bar` : '—'} accent="#4A7FB5" icon="📊" />
            </div>

            {/* charts row */}
            {recentRuns.length > 0 && (
              <div className="db-charts-row">
                {/* bar chart */}
                <div className="db-card db-chart-card db-chart-bar">
                  <div className="db-card-title">Recent 10 Runs — Peak Temp &amp; Pressure</div>
                  <div style={{ height: 200 }}>
                    <Bar
                      data={overviewData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 12 } },
                        },
                        scales: {
                          y: { beginAtZero: true, ticks: { font: { size: 10 } } },
                          x: { ticks: { font: { size: 10 }, maxRotation: 40 } },
                        },
                      }}
                    />
                  </div>
                </div>

                {/* donut */}
                <div className="db-card db-chart-card db-chart-donut">
                  <div className="db-card-title">Status Breakdown</div>
                  <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Doughnut
                      data={donutData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '65%',
                        plugins: {
                          legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } },
                        },
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* run list + side panel */}
            <div className={`db-main${selected ? ' db-main--split' : ''}`}>

              <div className="db-card db-list-card">
                {/* filters */}
                <div className="db-filters">
                  <input
                    className="db-search"
                    placeholder="Search run ID or operator…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <select className="db-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                    <option value="">All materials</option>
                    <option value="carbide">Carbide</option>
                    <option value="source_powder">Source Powder</option>
                  </select>
                  <select className="db-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="">All statuses</option>
                    <option value="completed">Completed</option>
                    <option value="in_progress">In Progress</option>
                    <option value="failed">Failed</option>
                  </select>
                  <span className="db-count">{filtered.length} run{filtered.length !== 1 ? 's' : ''}</span>
                </div>

                {/* column headers */}
                <div className="db-run-header">
                  <button className="db-col-btn" onClick={() => toggleSort('runId')}>
                    Run ID {sortField === 'runId' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                  <span>Material</span>
                  <button className="db-col-btn" onClick={() => toggleSort('operatorName')}>
                    Operator {sortField === 'operatorName' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                  <button className="db-col-btn" onClick={() => toggleSort('dateTime')}>
                    Date {sortField === 'dateTime' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                  <span>Phases</span>
                  <button className="db-col-btn" onClick={() => toggleSort('maxTemp')}>
                    Temp / Pres {sortField === 'maxTemp' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                  <span />
                </div>

                {filtered.length === 0 ? (
                  <div className="db-empty">
                    No runs match your filters. <Link to="/add">Log a new run →</Link>
                  </div>
                ) : (
                  filtered.map((run) => (
                    <RunRow
                      key={run._id}
                      run={run}
                      selected={selected?._id === run._id}
                      onSelect={(r) => setSelected((prev) => (prev?._id === r._id ? null : r))}
                    />
                  ))
                )}
              </div>

              {selected && (
                <RunDetailPanel run={selected} onClose={() => setSelected(null)} />
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ─── scoped CSS ───────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');

  .db-root {
    font-family: 'DM Sans', sans-serif;
    max-width: 1440px;
    margin: 0 auto;
    padding: 28px 24px 60px;
    color: #1a1a1a;
  }

  .db-page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
  .db-page-title  { font-size: 24px; font-weight: 700; letter-spacing: -.4px; margin: 0 0 3px; }
  .db-page-sub    { font-size: 13px; color: #777; margin: 0; }

  .db-new-btn {
    display: inline-flex; align-items: center; gap: 6px;
    background: #BA7517; color: #fff; text-decoration: none;
    padding: 9px 18px; border-radius: 8px; font-size: 13px; font-weight: 600;
    transition: opacity .15s; white-space: nowrap; border: 1.5px solid #BA7517;
  }
  .db-new-btn:hover { opacity: .85; }
  .db-new-btn--ghost { background: #fff; color: #BA7517; }
  .db-new-btn--ghost:hover { background: #FEF9F0; opacity: 1; }

  /* stat cards */
  .db-stats-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 20px; }
  .db-stat-card {
    background: #fff; border: 1px solid #E8E5DE;
    border-top: 3px solid var(--accent, #BA7517);
    border-radius: 10px; padding: 16px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .db-stat-icon  { font-size: 18px; margin-bottom: 6px; }
  .db-stat-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: .06em; }
  .db-stat-value { font-size: 26px; font-weight: 700; font-family: 'IBM Plex Mono', monospace; color: var(--accent, #1a1a1a); line-height: 1.1; }
  .db-stat-sub   { font-size: 11px; color: #AAA; margin-top: 2px; }

  /* charts row */
  .db-charts-row { display: grid; grid-template-columns: 1fr 280px; gap: 14px; margin-bottom: 16px; }
  .db-chart-donut { display: flex; flex-direction: column; }

  /* cards */
  .db-card { background: #fff; border: 1px solid #E8E5DE; border-radius: 10px; overflow: hidden; }
  .db-chart-card { padding: 16px; }
  .db-card-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #777; margin-bottom: 14px; }

  /* main split */
  .db-main { display: grid; grid-template-columns: 1fr; gap: 16px; }
  .db-main--split { grid-template-columns: 1fr 360px; align-items: start; }

  /* filters bar */
  .db-filters { display: flex; gap: 8px; align-items: center; padding: 12px 14px; border-bottom: 1px solid #F0EDE6; flex-wrap: wrap; }
  .db-search {
    flex: 1; min-width: 180px; padding: 8px 11px;
    border: 1px solid #DDD; border-radius: 7px;
    font-size: 13px; font-family: inherit; outline: none; transition: border-color .15s;
  }
  .db-search:focus { border-color: #BA7517; }
  .db-select {
    padding: 8px 10px; border: 1px solid #DDD; border-radius: 7px;
    font-size: 13px; font-family: inherit; background: #fff; cursor: pointer; outline: none;
  }
  .db-select:focus { border-color: #BA7517; }
  .db-count { font-size: 12px; color: #AAA; margin-left: auto; white-space: nowrap; }

  /* column header */
  .db-run-header {
    display: grid;
    grid-template-columns: 140px 110px 120px 100px 160px 1fr 56px;
    gap: 6px; padding: 8px 14px;
    background: #FAFAF8; border-bottom: 1px solid #F0EDE6;
    font-size: 11px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: .05em;
  }
  .db-col-btn {
    background: none; border: none; cursor: pointer; font: inherit;
    font-size: 11px; font-weight: 600; color: #888; text-transform: uppercase;
    letter-spacing: .05em; padding: 0; text-align: left;
  }
  .db-col-btn:hover { color: #BA7517; }

  /* run row */
  .db-run-row {
    display: grid;
    grid-template-columns: 140px 110px 120px 100px 160px 1fr 56px;
    gap: 6px; align-items: center;
    padding: 10px 14px; border-bottom: 1px solid #F5F3EE;
    cursor: pointer; font-size: 13px; transition: background .12s;
  }
  .db-run-row:last-child      { border-bottom: none; }
  .db-run-row:hover           { background: #FDFCF8; }
  .db-run-row--selected       { background: #FEF9F0 !important; border-left: 3px solid #BA7517; padding-left: 11px; }

  .db-run-dot  { width: 7px; height: 7px; border-radius: 50%; display: inline-block; margin-right: 6px; flex-shrink: 0; }
  .db-run-id   { font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 500; display: flex; align-items: center; }
  .db-run-operator, .db-run-date { font-size: 12px; color: #555; }

  .db-badge { font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 99px; letter-spacing: .03em; white-space: nowrap; }
  .db-badge--carbide { background: #FEF0D6; color: #9A6010; }
  .db-badge--source  { background: #DFF5EE; color: #157A58; }

  /* phase pips */
  .db-phase-pips { display: flex; gap: 4px; flex-wrap: wrap; }
  .db-phase-pip  { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 4px; white-space: nowrap; font-family: 'IBM Plex Mono', monospace; }
  .db-no-phases  { font-size: 10px; color: #CCC; font-style: italic; }

  /* inline mini bar charts */
  .db-run-bars { display: flex; flex-direction: column; gap: 4px; }
  .db-mini-bar {
    position: relative; height: 16px; background: #F0EDE6;
    border-radius: 3px; overflow: hidden; display: flex; align-items: center;
  }
  .db-mini-fill { position: absolute; left: 0; top: 0; height: 100%; border-radius: 3px; min-width: 3px; transition: width .5s ease; }
  .db-mini-fill--temp { background: rgba(186,117,23,.55); }
  .db-mini-fill--pres { background: rgba(29,158,117,.55); }
  .db-mini-lbl { position: relative; z-index: 1; font-size: 10px; font-family: 'IBM Plex Mono', monospace; padding: 0 5px; color: #333; white-space: nowrap; }

  .db-open-btn { font-size: 12px; color: #BA7517; text-decoration: none; font-weight: 600; white-space: nowrap; transition: opacity .15s; }
  .db-open-btn:hover { opacity: .7; }

  /* loading / error / empty */
  .db-loading { display: flex; align-items: center; gap: 10px; padding: 60px; color: #777; font-size: 14px; justify-content: center; }
  .db-spinner  { width: 20px; height: 20px; border: 2px solid #E8E5DE; border-top-color: #BA7517; border-radius: 50%; animation: db-spin .7s linear infinite; }
  @keyframes db-spin { to { transform: rotate(360deg); } }
  .db-error { background: #FEF0EF; border: 1px solid #F5C6C3; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #B33; margin-bottom: 16px; display: flex; gap: 10px; align-items: center; }
  .db-error button { border: none; background: #B33; color: #fff; border-radius: 4px; padding: 3px 10px; font-size: 12px; cursor: pointer; }
  .db-empty { padding: 36px; text-align: center; color: #999; font-size: 13px; }
  .db-empty a { color: #BA7517; }

  /* detail side panel */
  .db-detail-panel {
    background: #fff; border: 1px solid #E8E5DE; border-radius: 10px;
    padding: 18px; display: flex; flex-direction: column; gap: 14px;
    overflow-y: auto; max-height: 85vh; position: sticky; top: 16px;
  }
  .db-detail-header { display: flex; justify-content: space-between; align-items: flex-start; }
  .db-detail-runid  { font-family: 'IBM Plex Mono', monospace; font-size: 15px; font-weight: 600; }
  .db-detail-sub    { font-size: 11px; color: #888; margin-top: 4px; }
  .db-close-btn { background: none; border: 1px solid #DDD; border-radius: 50%; width: 28px; height: 28px; cursor: pointer; font-size: 12px; color: #555; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .db-close-btn:hover { background: #F5F3EE; }

  .db-detail-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .db-detail-stat  { background: #FAFAF8; border-radius: 7px; padding: 8px 10px; }
  .db-detail-stat-label { font-size: 10px; color: #AAA; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 2px; }
  .db-detail-stat-value { font-size: 15px; font-weight: 700; font-family: 'IBM Plex Mono', monospace; }

  /* phase blocks in detail panel */
  .db-phase-steps-wrap { display: flex; flex-direction: column; gap: 10px; }
  .db-phase-block { }
  .db-phase-block-title {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em;
    padding-left: 8px; margin-bottom: 6px;
  }
  .db-phase-block-rows { display: flex; flex-direction: column; gap: 4px; }
  .db-phase-row { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; padding: 4px 0; border-bottom: 1px solid #F5F3EE; }
  .db-phase-row:last-child { border-bottom: none; }
  .db-phase-idx {
    display: inline-flex; align-items: center; justify-content: center;
    width: 20px; height: 20px; border-radius: 5px;
    font-size: 10px; font-weight: 700; flex-shrink: 0;
    font-family: 'IBM Plex Mono', monospace;
  }
  .db-phase-tag {
    font-size: 11px; font-weight: 600;
    background: #F0EDE6; color: #444; padding: 2px 7px; border-radius: 4px;
    font-family: 'IBM Plex Mono', monospace;
  }
  .db-phase-remarks { font-size: 11px; color: #888; font-style: italic; }
  .db-no-phase-msg  { font-size: 12px; color: #AAA; text-align: center; padding: 12px 0; }

  .db-detail-notes { background: #FAFAF8; border-radius: 7px; padding: 10px 12px; }
  .db-detail-notes-label { font-size: 10px; color: #AAA; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
  .db-detail-notes-body  { font-size: 12px; line-height: 1.6; color: #444; }

  .db-detail-images { display: flex; gap: 8px; flex-wrap: wrap; }
  .db-img-thumb img { width: 78px; height: 58px; object-fit: cover; border-radius: 6px; border: 1px solid #E8E5DE; display: block; }
  .db-img-caption { font-size: 10px; color: #888; margin-top: 3px; max-width: 78px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .db-full-btn {
    display: block; text-align: center; background: #BA7517; color: #fff;
    text-decoration: none; padding: 10px; border-radius: 7px;
    font-size: 13px; font-weight: 600; transition: opacity .15s;
  }
  .db-full-btn:hover { opacity: .85; }

  @media (max-width: 1100px) {
    .db-charts-row { grid-template-columns: 1fr; }
    .db-chart-donut { display: none; }
  }
  @media (max-width: 900px) {
    .db-stats-row { grid-template-columns: repeat(3, 1fr); }
    .db-main--split { grid-template-columns: 1fr; }
    .db-run-header,
    .db-run-row { grid-template-columns: 1fr 100px 60px; }
    .db-run-header > *:nth-child(3),
    .db-run-header > *:nth-child(4),
    .db-run-header > *:nth-child(5),
    .db-run-header > *:nth-child(6),
    .db-run-row > .db-run-operator,
    .db-run-row > .db-run-date,
    .db-run-row > .db-phase-pips,
    .db-run-row > .db-run-bars { display: none; }
  }
`;