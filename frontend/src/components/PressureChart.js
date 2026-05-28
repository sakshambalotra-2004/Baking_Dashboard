import React, { useMemo, useRef, useCallback, useState } from 'react';
import {
    Chart as ChartJS,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import annotationPluginLib from 'chartjs-plugin-annotation';
import zoomPlugin from 'chartjs-plugin-zoom';

ChartJS.register(
    LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, Filler,
    annotationPluginLib, zoomPlugin
);

/* ─── palette ────────────────────────────────────────────────── */
const C = {
    pre:    '#5B8DD9',
    growth: '#D85A30',
    post:   '#1D9E75',
    pres:   '#2563EB',
    grid:   '#EEEBE3',
    muted:  '#9CA3AF',
};

/* ─── time formatting (raw minutes → human label) ────────────── */
function fmtMinutes(m) {
    m = Math.round(m);
    if (m === 0) return '0';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60), rm = m % 60;
    if (h < 48) return rm ? `${h}h ${rm}m` : `${h}h`;
    const d = Math.floor(h / 24), rh = h % 24;
    return rh ? `${d}d ${rh}h` : `${d}d`;
}

/* ─── helpers ────────────────────────────────────────────────── */
const holdToMin = h => {
    if (!h || h.value == null) return 0;
    if (h.unit === 'hr')  return Number(h.value) * 60;
    if (h.unit === 'day') return Number(h.value) * 1440;
    return Number(h.value);
};
const fmtHold = h => (!h || !h.value) ? '' : `${h.value} ${h.unit}`;

/* ══════════════════════════════════════════════════════════════
   NORMALISED TIMELINE
   Each phase is mapped onto a virtual x range of equal width
   (0–100 for pre, 100–200 for growth, 200–300 for post) so
   no phase can visually dominate another.
   We store the actual elapsed-minutes value alongside every
   point so tooltips and tick labels still show real time.
══════════════════════════════════════════════════════════════ */
const PHASE_ORDER = ['pre', 'growth', 'post'];
const PHASE_WIDTH = 100; // virtual units per phase

/**
 * Given a real-time span [phaseStartMin, phaseEndMin] and a
 * real t value inside it, return the normalised virtual x.
 */
function normalise(t, phaseIndex, phaseStartMin, phaseEndMin) {
    const base    = phaseIndex * PHASE_WIDTH;
    const span    = phaseEndMin - phaseStartMin;
    if (span <= 0) return base + PHASE_WIDTH / 2;
    return base + ((t - phaseStartMin) / span) * PHASE_WIDTH;
}

function buildTimeline(preGrowth, growth, postGrowth) {
    const allSteps = [
        ...(preGrowth  || []).map(s => ({ ...s, phase: 'pre'    })),
        ...(growth     || []).map(s => ({ ...s, phase: 'growth' })),
        ...(postGrowth || []).map(s => ({ ...s, phase: 'post'   })),
    ];
    if (!allSteps.length) return { tempPts: [], presPts: [], events: [], phaseSpans: {}, phaseRanges: {} };

    /* ── pass 1: build raw-minute timeline ── */
    const rawEvents = [];
    const phaseSpans = { pre: null, growth: null, post: null };
    let t = 0, prevTemp = 25;

    allSteps.forEach(step => {
        const tgt     = step.temp     ?? prevTemp;
        const ramp    = step.rampRate ?? 0;
        const hMin    = holdToMin(step.hold);
        const pres    = step.pressure ?? null;
        const rampMin = ramp > 0 ? Math.abs(tgt - prevTemp) / ramp : 0;
        const ph      = step.phase;
        const tRampEnd = t + rampMin;
        const tHoldEnd = tRampEnd + hMin;
        const spanEnd  = hMin > 0 ? tHoldEnd : tRampEnd;

        if (!phaseSpans[ph]) phaseSpans[ph] = [t, spanEnd];
        else                 phaseSpans[ph][1] = spanEnd;

        rawEvents.push({ t, tRampEnd, tHoldEnd, hMin, rampMin, temp: tgt, pres, ramp, hold: step.hold, remarks: step.remarks || '', phase: ph });
        t = spanEnd;
        prevTemp = tgt;
    });

    /* ── build phaseRanges (real-minute start/end per phase) ── */
    const phaseRanges = {};
    PHASE_ORDER.forEach(ph => {
        phaseRanges[ph] = phaseSpans[ph] ? [...phaseSpans[ph]] : null;
    });

    /* ── pass 2: normalise all x coordinates ── */
    const toNorm = (realT, phase) => {
        const idx   = PHASE_ORDER.indexOf(phase);
        const range = phaseRanges[phase];
        if (!range) return idx * PHASE_WIDTH;
        return normalise(realT, idx, range[0], range[1]);
    };

    const tempPts = [{ x: 0, y: 25, phase: 'pre', realMin: 0 }];
    const presPts = [{ x: 0, y: 0,  realMin: 0 }];
    const events  = [];

    rawEvents.forEach((ev, i) => {
        const xRampEnd = toNorm(ev.tRampEnd, ev.phase);
        const xHoldEnd = toNorm(ev.tHoldEnd, ev.phase);

        tempPts.push({ x: xRampEnd, y: ev.temp, phase: ev.phase, realMin: ev.tRampEnd });
        if (ev.hMin > 0) tempPts.push({ x: xHoldEnd, y: ev.temp, phase: ev.phase, realMin: ev.tHoldEnd });

        if (ev.pres != null) {
            presPts.push({ x: xRampEnd, y: ev.pres, realMin: ev.tRampEnd });
            if (ev.hMin > 0) presPts.push({ x: xHoldEnd, y: ev.pres, realMin: ev.tHoldEnd });
        }

        events.push({ ...ev, xRampEnd, xHoldEnd });
    });

    /* tail point */
    const lastPhase = rawEvents[rawEvents.length - 1]?.phase ?? 'post';
    const lastIdx   = PHASE_ORDER.indexOf(lastPhase);
    const tailX     = (lastIdx + 1) * PHASE_WIDTH;
    tempPts.push({ x: tailX, y: 25, phase: lastPhase, realMin: t });
    presPts.push({ x: tailX, y: presPts[presPts.length - 1]?.y ?? 0, realMin: t });

    return { tempPts, presPts, events, phaseSpans, phaseRanges };
}

/* ─── tooltip remark lookup (by normalised x) ────────────────── */
function findRemarkAt(events, nx) {
    const TOL = 2;
    let best = null, bestD = Infinity;
    events.forEach(ev => {
        [ev.xRampEnd, ev.xHoldEnd].forEach(cx => {
            const d = Math.abs(cx - nx);
            if (d < TOL && d < bestD && ev.remarks) { bestD = d; best = ev.remarks; }
        });
    });
    return best;
}

/* ─── find real minutes from normalised x ────────────────────── */
function normToReal(nx, phaseRanges) {
    const rawIdx = nx / PHASE_WIDTH;
    const onBoundary = Number.isInteger(rawIdx) && rawIdx > 0;
    const idx = onBoundary
        ? Math.min(rawIdx - 1, PHASE_ORDER.length - 1)
        : Math.min(Math.floor(rawIdx), PHASE_ORDER.length - 1);
    const ph    = PHASE_ORDER[idx];
    const range = phaseRanges[ph];
    if (!range) return 0;
    const frac  = (nx - idx * PHASE_WIDTH) / PHASE_WIDTH;
    return range[0] + frac * (range[1] - range[0]);
}

/* ══════════════════════════════════════════════════════════════
   ANNOTATIONS
══════════════════════════════════════════════════════════════ */
function makePhaseBoxes(phaseRanges) {
    const boxes = {};
    const LABELS = { pre: 'Pre-Growth', growth: 'Growth', post: 'Post-Growth' };
    PHASE_ORDER.forEach((ph, idx) => {
        if (!phaseRanges[ph]) return;
        const xMin = idx * PHASE_WIDTH;
        const xMax = (idx + 1) * PHASE_WIDTH;
        boxes[`${ph}Box`] = {
            type: 'box', xMin, xMax,
            backgroundColor: C[ph] + '0D',
            borderColor:     C[ph] + '40',
            borderWidth: 1, borderDash: [5, 4],
            label: { display: false },
        };
        boxes[`${ph}PhaseLabel`] = {
            type: 'label',
            xValue: (xMin + xMax) / 2,
            yScaleID: 'y',
            yValue: 'max',
            yAdjust: 14,
            content: [LABELS[ph]],
            color: C[ph],
            font: { size: 10, weight: '700', family: 'DM Sans, sans-serif' },
            padding: { x: 7, y: 3 },
            backgroundColor: C[ph] + '20',
            borderRadius: 4, borderWidth: 1,
            borderColor: C[ph] + '44',
        };
        if (ph === 'pre' || ph === 'growth') {
            boxes[`${ph}Div`] = {
                type: 'line', xMin: xMax, xMax,
                borderColor: '#CCCCCC', borderWidth: 1.5, borderDash: [4, 4],
            };
        }
    });
    return boxes;
}

function makeHoldArrows(events) {
    const out = {};
    events.forEach((ev, i) => {
        if (ev.hMin <= 0 || ev.temp === 25) return;
        const yArr = ev.temp + ev.temp * 0.015;
        out[`hold_${i}`] = {
            type: 'line',
            xMin: ev.xRampEnd, xMax: ev.xHoldEnd,
            yMin: yArr, yMax: yArr,
            borderColor: '#CCCCCC', borderWidth: 1,
        };
        out[`holdLbl_${i}`] = {
            type: 'label',
            xValue: (ev.xRampEnd + ev.xHoldEnd) / 2,
            yValue: yArr,
            content: [fmtHold(ev.hold)],
            yAdjust: -12, color: '#999',
            font: { size: 8.5, family: 'IBM Plex Mono, monospace' },
        };
    });
    return out;
}

function makeTempLabels(events) {
    const out = {};
    const seen = new Set();
    const maxTemp = Math.max(...events.map(e => e.temp));
    const byPhase = {};
    events.forEach(ev => {
        if (!byPhase[ev.phase]) byPhase[ev.phase] = [];
        byPhase[ev.phase].push(ev);
    });

    let labelCount = 0;
    events.forEach((ev, i) => {
        const key = `${Math.round(ev.xRampEnd)}_${ev.temp}`;
        if (seen.has(key) || ev.temp === 25) return;
        seen.add(key);

        const lines = [`${ev.temp}°C`];
        if (ev.ramp > 0) lines.push(`${ev.ramp}°C/min`);

        const nearTop   = ev.temp > maxTemp * 0.80;
        const phEvs      = byPhase[ev.phase] || [];
        const isLastInPhase = phEvs[phEvs.length - 1] === ev;
        const above   = nearTop ? false : (labelCount % 2 === 0);
        const stagger = Math.floor(labelCount / 2) * 16;
        const yAdjust = above ? -(34 + stagger) : (34 + stagger);
        const xAdjust = isLastInPhase ? -4 : 0;
        labelCount++;

        out[`tLbl_${i}`] = {
            type: 'label',
            xValue: ev.xRampEnd, yValue: ev.temp,
            content: lines,
            yAdjust, xAdjust,
            textAlign: isLastInPhase ? 'right' : 'center',
            color: C[ev.phase],
            font: { size: 8.5, weight: '600', family: 'IBM Plex Mono, monospace' },
            backgroundColor: '#FFFFFFDD',
            borderRadius: 4, borderWidth: 0.5,
            borderColor: C[ev.phase] + '66',
            padding: { x: 5, y: 3 },
            callout: { display: true, borderColor: C[ev.phase] + '88', borderWidth: 0.8 },
        };
    });
    return out;
}

function makePresLabels(events, maxPres) {
    const out = {};
    const seen = new Set();
    events.forEach((ev, i) => {
        if (ev.pres == null) return;
        const key = `${Math.round(ev.xRampEnd)}_${ev.pres}`;
        if (seen.has(key)) return;
        seen.add(key);

        /* Push label BELOW the point when pressure is near the chart top,
           so it doesn't get clipped by the container edge.               */
        const nearTop = maxPres > 0 && ev.pres >= maxPres * 0.80;
        const yAdjust = nearTop ? 14 : -14;

        out[`pLbl_${i}`] = {
            type: 'label',
            xValue: ev.xRampEnd, yValue: ev.pres,
            content: [`${ev.pres} torr`],
            yAdjust,
            color: C.pres,
            font: { size: 8, family: 'IBM Plex Mono, monospace' },
            backgroundColor: '#EFF6FFEE',
            borderRadius: 4, borderWidth: 0.5,
            borderColor: '#BFDBFE',
            padding: { x: 4, y: 2 },
        };
    });
    return out;
}

/* ══════════════════════════════════════════════════════════════
   BASE OPTIONS
══════════════════════════════════════════════════════════════ */
function buildTickValues(phaseRanges) {
    const ticks = new Set([0]);
    const presentPhases = PHASE_ORDER.filter(ph => phaseRanges[ph]);
    presentPhases.forEach((ph, i) => {
        const base = PHASE_ORDER.indexOf(ph) * PHASE_WIDTH;
        [25, 50, 75].forEach(p => ticks.add(base + p));
        ticks.add(base + PHASE_WIDTH);
    });
    return [...ticks].sort((a, b) => a - b);
}

function baseOptions(annotations, isTemp, phaseRanges) {
    const tickValues = buildTickValues(phaseRanges);
    const xMax = PHASE_ORDER.filter(ph => phaseRanges[ph]).length * PHASE_WIDTH;

    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        clip: false,
        layout: {
            /* FIX 1: increased top padding for pressure chart (was 16) so
               labels sitting above the highest data point are not clipped
               by the container div edge.                                   */
            padding: { right: 60, left: 8, top: isTemp ? 100 : 40, bottom: 8 },
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#111827',
                titleFont: { family: 'DM Sans, sans-serif', size: 11 },
                bodyFont:  { family: 'IBM Plex Mono, monospace', size: 11 },
                footerFont:{ family: 'DM Sans, sans-serif', size: 10, style: 'italic' },
                padding: 10,
                callbacks: {
                    title: items => {
                        const nx      = parseFloat(items[0].raw.x);
                        const realMin = normToReal(nx, phaseRanges);
                        return `⏱  ${fmtMinutes(realMin)}`;
                    },
                    label: item => isTemp ? `🌡  ${item.raw.y}°C` : `📊  ${item.raw.y} torr`,
                    footer: items => {
                        const nx = parseFloat(items[0].raw.x);
                        const remark = findRemarkAt(annotations._events || [], nx);
                        return remark ? [`💬 ${remark}`] : [];
                    },
                },
                footerColor: '#A5F3C4',
                footerMarginTop: 6,
            },
            annotation: { annotations },
            zoom: {
                pan:  { enabled: true, mode: 'x' },
                zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x',
                        onZoomComplete({ chart }) { chart.update('none'); } },
                limits: { x: { min: 0, max: xMax, minRange: PHASE_WIDTH * 0.2 } },
            },
        },
        scales: {
            x: {
                type: 'linear', min: 0, max: xMax,
                title: {
                    display: !isTemp, text: 'Time',
                    color: C.muted,
                    font: { size: 10.5, family: 'DM Sans, sans-serif', weight: '600' },
                    padding: { top: 4 },
                },
                grid:  { color: C.grid, lineWidth: 0.8 },
                border:{ color: '#CCCCCC' },
                ticks: {
                    display: !isTemp,
                    color: C.muted,
                    font: { size: 9.5, family: 'IBM Plex Mono, monospace' },
                    maxRotation: 30,
                    afterBuildTicks(axis) {
                        axis.ticks = tickValues
                            .filter(v => v >= 0 && v <= xMax)
                            .map(v => ({ value: v }));
                    },
                    callback(v) {
                        const realMin = normToReal(v, phaseRanges);
                        return fmtMinutes(realMin);
                    },
                },
            },
            y: {
                min: 0,
                title: {
                    display: true,
                    text: isTemp ? 'Temperature (°C)' : 'Pressure (torr)',
                    color: isTemp ? C.muted : C.pres,
                    font: { size: 10.5, family: 'DM Sans, sans-serif', weight: '600' },
                },
                ticks: {
                    color: isTemp ? C.muted : C.pres,
                    font: { size: 9, family: 'IBM Plex Mono, monospace' },
                    callback: v => isTemp ? `${v}°C` : `${v}`,
                    maxTicksLimit: 7,
                },
                grid:  { color: C.grid, lineWidth: 0.8 },
                border:{ color: '#CCCCCC' },
            },
        },
    };
}

/* ══════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════ */
export default function RunProfileChart({
    preGrowth    = [],
    growth       = [],
    postGrowth   = [],
    runId        = '',
    operatorName = '',
    coilPosition = '',
    gasInfo      = '',
}) {
    const tempChartRef = useRef(null);
    const presChartRef = useRef(null);
    const [isZoomed, setIsZoomed] = useState(false);

    const { tempPts, presPts, events, phaseRanges } = useMemo(
        () => buildTimeline(preGrowth, growth, postGrowth),
        [preGrowth, growth, postGrowth]
    );

    const handleResetZoom = useCallback(() => {
        tempChartRef.current?.resetZoom();
        presChartRef.current?.resetZoom();
        setIsZoomed(false);
    }, []);

    if (!tempPts.length) {
        return (
            <div style={s.empty}>
                <div style={s.emptyIcon}>📈</div>
                <div style={s.emptyText}>No phase data to display</div>
                <div style={s.emptyHint}>Add steps to see the profile chart</div>
            </div>
        );
    }

    /* FIX 2: compute max pressure so makePresLabels can decide
       whether to place each label above or below its data point. */
    const maxPres = Math.max(0, ...events.filter(e => e.pres != null).map(e => e.pres));

    const phaseBoxes  = makePhaseBoxes(phaseRanges);
    const holdArrows  = makeHoldArrows(events);
    const tempLabels  = makeTempLabels(events);
    const presLabels  = makePresLabels(events, maxPres);   // ← pass maxPres

    /* growth markers */
    const gEvs = events.filter(e => e.phase === 'growth');
    const growthMarkers = {};
    if (gEvs.length) {
        const gs   = gEvs[0];
        const ge   = gEvs[gEvs.length - 1];
        const geX  = ge.hMin > 0 ? ge.xHoldEnd : ge.xRampEnd;
        growthMarkers.gStart = {
            type: 'label', xValue: gs.xRampEnd, yValue: gs.temp,
            content: ['Growth started'], yAdjust: 22, color: C.growth,
            font: { size: 8.5, weight: '700', family: 'DM Sans, sans-serif' },
            backgroundColor: '#FDECEA99', borderRadius: 4,
            borderColor: C.growth + '44', borderWidth: 1, padding: { x: 5, y: 3 },
        };
        growthMarkers.gEnd = {
            type: 'label', xValue: geX, yValue: ge.temp,
            content: ['Growth terminated'], yAdjust: 22, color: C.growth,
            font: { size: 8.5, weight: '700', family: 'DM Sans, sans-serif' },
            backgroundColor: '#FDECEA99', borderRadius: 4,
            borderColor: C.growth + '44', borderWidth: 1, padding: { x: 5, y: 3 },
        };
        const gRange = phaseRanges.growth;
        if (gRange) {
            const midX  = PHASE_ORDER.indexOf('growth') * PHASE_WIDTH + PHASE_WIDTH / 2;
            const ySpan = gs.temp - gs.temp * 0.08;
            growthMarkers.gSpanLine = {
                type: 'line', xMin: gs.xRampEnd, xMax: geX,
                yMin: ySpan, yMax: ySpan,
                borderColor: '#AAAAAA', borderWidth: 1,
            };
            growthMarkers.gSpanLbl = {
                type: 'label', xValue: midX, yValue: ySpan,
                content: [`← ${fmtMinutes(gRange[1] - gRange[0])} →`],
                yAdjust: -12, color: '#666',
                font: { size: 9, weight: '600', family: 'DM Sans, sans-serif' },
            };
        }
    }

    const tempAnnotations = { ...phaseBoxes, ...holdArrows, ...tempLabels, ...growthMarkers, _events: events };
    const presAnnotations = { ...phaseBoxes, ...presLabels, _events: events };

    const tempOpts = baseOptions(tempAnnotations, true,  phaseRanges);
    const presOpts = baseOptions(presAnnotations, false, phaseRanges);

    tempOpts.plugins.zoom.zoom.onZoomComplete = () => setIsZoomed(true);
    presOpts.plugins.zoom.zoom.onZoomComplete = () => setIsZoomed(true);
    tempOpts.plugins.zoom.pan.onPanComplete   = () => setIsZoomed(true);
    presOpts.plugins.zoom.pan.onPanComplete   = () => setIsZoomed(true);

    const tempData = {
        datasets: [{
            label: 'Temperature',
            data: tempPts.map(p => ({ x: p.x, y: p.y })),
            borderWidth: 2.8, tension: 0, fill: false,
            pointRadius: ctx => tempPts[ctx.dataIndex]?.y === 25 ? 3 : 4.5,
            pointBackgroundColor: ctx => C[tempPts[ctx.dataIndex]?.phase] || '#888',
            pointBorderColor: '#FFFFFF', pointBorderWidth: 1.5,
            pointHoverRadius: 8, pointHoverBorderWidth: 2.5,
            segment: {
                borderColor: ctx => C[tempPts[ctx.p0DataIndex]?.phase] || C.pre,
                borderWidth: () => 2.8,
            },
        }],
    };

    const presData = {
        datasets: [{
            label: 'Pressure',
            data: presPts.map(p => ({ x: p.x, y: p.y })),
            borderColor: C.pres, backgroundColor: C.pres + '15',
            borderWidth: 2.8, stepped: 'before', fill: true, tension: 0,
            pointRadius: 3.5, pointBackgroundColor: '#FFFFFF',
            pointBorderColor: C.pres, pointBorderWidth: 1.5,
            pointHoverRadius: 7, pointHoverBorderWidth: 2,
        }],
    };

    return (
        <div style={s.wrap}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@400;600;700&display=swap');`}</style>

            <div style={s.titleBar}>
                <div>
                    <div style={s.chartTitle}>{runId ? `${runId} — ` : ''}Temperature & Pressure Profile</div>
                    {operatorName && <div style={s.titleMeta}>Operator: {operatorName}</div>}
                </div>
                <div style={s.titleRight}>
                    {coilPosition && <span style={s.metaTag}>📍 {coilPosition}</span>}
                    {gasInfo       && <span style={s.metaTag}>⛽ {gasInfo}</span>}
                    <span style={s.zoomHint}>🔍 Scroll to zoom · Drag to pan</span>
                    {isZoomed && <button style={s.resetBtn} onClick={handleResetZoom}>↺ Reset Zoom</button>}
                </div>
            </div>

            <div style={s.legend}>
                {[{ ph:'pre', label:'Pre-Growth' }, { ph:'growth', label:'Growth' }, { ph:'post', label:'Post-Growth' }].map(({ ph, label }) => (
                    <div key={ph} style={s.legendItem}>
                        <span style={{ ...s.legendDot, background: C[ph] }} />
                        <span style={s.legendLabel}>{label}</span>
                    </div>
                ))}
                <div style={s.legendItem}>
                    <span style={{ ...s.legendDash, background: C.pres }} />
                    <span style={{ ...s.legendLabel, color: C.pres }}>Pressure (torr)</span>
                </div>
                <div style={{ ...s.legendItem, marginLeft: 'auto' }}>
                    <span style={s.phaseNote}>Each phase shown at equal width · hover for real time</span>
                </div>
            </div>

            <div style={s.subLabel}>TEMPERATURE</div>
            <div style={s.areaTop}>
                <Line ref={tempChartRef} data={tempData} options={tempOpts} />
            </div>

            <div style={s.divider} />

            <div style={s.subLabel}>PRESSURE</div>
            {/* FIX 3: increased height from 190 → 220 for extra breathing room */}
            <div style={s.areaBot}>
                <Line ref={presChartRef} data={presData} options={presOpts} />
            </div>

            <div style={s.strip}>
                {[
                    { key: 'pre',    rows: preGrowth,  label: 'Pre-Growth'  },
                    { key: 'growth', rows: growth,      label: 'Growth'      },
                    { key: 'post',   rows: postGrowth,  label: 'Post-Growth' },
                ].map(({ key, rows, label }) => (
                    <div key={key} style={{ ...s.stripCell, borderTop: `3px solid ${C[key]}` }}>
                        <div style={{ ...s.stripTitle, color: C[key] }}>{label}</div>
                        <div style={s.stripDuration}>
                            {phaseRanges[key] ? fmtMinutes(phaseRanges[key][1] - phaseRanges[key][0]) : '—'}
                        </div>
                        <div style={s.stripSub}>{rows.length} step{rows.length !== 1 ? 's' : ''}</div>
                        {rows.map((r, i) => (
                            <div key={i} style={s.stripRow}>
                                <span style={s.stripIdx}>{i + 1}</span>
                                {r.temp     != null              && <span style={s.tag}>{r.temp}°C</span>}
                                {r.rampRate != null && r.rampRate > 0 && <span style={s.tag}>{r.rampRate}°C/m</span>}
                                {r.hold?.value                   && <span style={s.tag}>{fmtHold(r.hold)}</span>}
                                {r.pressure != null              && <span style={{ ...s.tag, color: C.pres, background: '#EFF6FF' }}>{r.pressure}T</span>}
                                {r.remarks                       && <span style={s.remarkTag} title={r.remarks}>💬</span>}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ─── styles ─────────────────────────────────────────────────── */
const s = {
    wrap: {
        background: '#FAFAF7', border: '1px solid #E4E1D9',
        borderRadius: 14, overflow: 'hidden',
        fontFamily: "'DM Sans', sans-serif",
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    },
    titleBar: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 20px 10px', borderBottom: '1px solid #EEEBE3',
        background: '#fff', flexWrap: 'wrap', gap: 8,
    },
    chartTitle: { fontSize: 13.5, fontWeight: 700, color: '#1A2B4A' },
    titleMeta:  { fontSize: 11, color: '#888', marginTop: 2 },
    titleRight: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' },
    metaTag: { fontSize: 11, fontWeight: 600, background: '#F0EDE6', color: '#555', padding: '3px 10px', borderRadius: 99 },
    zoomHint: { fontSize: 10, color: '#AAA', fontStyle: 'italic', fontFamily: 'DM Sans, sans-serif' },
    resetBtn: {
        fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
        background: '#EFF6FF', color: '#2563EB',
        border: '1px solid #BFDBFE', borderRadius: 6,
        padding: '3px 10px', fontFamily: 'DM Sans, sans-serif',
    },
    legend: {
        display: 'flex', gap: 18, padding: '10px 20px 8px',
        alignItems: 'center', background: '#fff',
        borderBottom: '1px solid #F5F3EF', flexWrap: 'wrap',
    },
    legendItem:   { display: 'flex', alignItems: 'center', gap: 6 },
    legendDot:    { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
    legendDash:   { width: 18, height: 3, borderRadius: 2, flexShrink: 0 },
    legendLabel:  { fontSize: 11.5, fontWeight: 600, color: '#555' },
    phaseNote:    { fontSize: 10, color: '#AAA', fontStyle: 'italic' },
    subLabel: {
        fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
        color: '#BBBBBB', textTransform: 'uppercase',
        padding: '8px 22px 0', background: '#FAFAF7',
    },
    areaTop: { height: 420, padding: '2px 20px 10px', background: '#FAFAF7' },
    divider: { height: 1, background: '#E4E1D9', margin: '0 20px' },
    /* FIX 3: height increased from 190 → 220 */
    areaBot: { height: 220, padding: '2px 20px 14px', background: '#FAFAF7' },
    strip: {
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: 12, padding: '14px 20px 16px',
        borderTop: '1px solid #EEEBE3', background: '#fff',
    },
    stripCell:     { paddingTop: 10 },
    stripTitle:    { fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 1 },
    stripDuration: { fontSize: 11, fontWeight: 700, color: '#444', marginBottom: 2 },
    stripSub:      { fontSize: 10.5, color: '#AAA', marginBottom: 6 },
    stripRow:      { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 3 },
    stripIdx:      { fontSize: 9.5, fontWeight: 700, color: '#CCC', fontFamily: 'IBM Plex Mono, monospace', minWidth: 12 },
    tag: {
        fontSize: 10.5, fontWeight: 600, background: '#F0EDE6', color: '#555',
        padding: '1px 6px', borderRadius: 4, fontFamily: 'IBM Plex Mono, monospace',
    },
    remarkTag: { fontSize: 11, cursor: 'help', userSelect: 'none' },
    empty: {
        padding: '48px 24px', textAlign: 'center',
        background: '#FAFAF7', borderRadius: 14, border: '1px solid #E4E1D9',
    },
    emptyIcon: { fontSize: 28, marginBottom: 10, opacity: 0.4 },
    emptyText: { fontSize: 14, fontWeight: 600, color: '#888' },
    emptyHint: { fontSize: 12, color: '#BBB', marginTop: 4 },
};