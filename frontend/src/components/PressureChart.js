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
    annotationPluginLib,
    zoomPlugin
);

/* ══════════════════════════════════════════════════════════════
   PALETTE
══════════════════════════════════════════════════════════════ */
const C = {
    pre:    '#5B8DD9',
    growth: '#D85A30',
    post:   '#1D9E75',
    pres:   '#2563EB',
    grid:   '#EEEBE3',
    bg:     '#FAFAF7',
    text:   '#374151',
    muted:  '#9CA3AF',
};

/* ══════════════════════════════════════════════════════════════
   TIME FORMATTING  (minutes → readable label)
══════════════════════════════════════════════════════════════ */
/**
 * Smart tick formatter: picks the most readable unit based on the
 * total x-range so that all ticks are equally legible regardless of
 * whether the run spans minutes, hours, or days.
 *
 *  xMax < 180 min  → show minutes        "45 min"
 *  xMax < 2880 min → show hours          "3.5 hr"
 *  else            → show days           "2.1 day"
 */
function makeTimeUnit(xMax) {
    if (xMax < 180)   return { unit: 'min',  divisor: 1,    label: 'Time (min)'  };
    if (xMax < 2880)  return { unit: 'hr',   divisor: 60,   label: 'Time (hr)'   };
    return             { unit: 'day',  divisor: 1440, label: 'Time (day)'  };
}

function fmtTime(minutes, timeUnit) {
    const v = minutes / timeUnit.divisor;
    return timeUnit.unit === 'min'
        ? `${Math.round(v)} min`
        : `${parseFloat(v.toFixed(2))} ${timeUnit.unit}`;
}

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const holdToMin = (hold) => {
    if (!hold || hold.value == null) return 0;
    const { value, unit } = hold;
    if (unit === 'hr')  return Number(value) * 60;
    if (unit === 'day') return Number(value) * 1440;
    return Number(value);
};

const fmtHold = (hold) => {
    if (!hold || !hold.value) return '';
    return `${hold.value} ${hold.unit}`;
};

function buildTimeline(preGrowth, growth, postGrowth) {
    const allSteps = [
        ...(preGrowth  || []).map(s => ({ ...s, phase: 'pre'    })),
        ...(growth     || []).map(s => ({ ...s, phase: 'growth' })),
        ...(postGrowth || []).map(s => ({ ...s, phase: 'post'   })),
    ];
    if (!allSteps.length) return { tempPts: [], presPts: [], events: [], phaseSpans: {} };

    const tempPts = [{ x: 0, y: 25, phase: 'pre' }];
    const presPts = [{ x: 0, y: 0 }];
    const events  = [];
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

        tempPts.push({ x: tRampEnd, y: tgt, phase: ph });
        if (hMin > 0) tempPts.push({ x: tHoldEnd, y: tgt, phase: ph });

        if (pres != null) {
            presPts.push({ x: tRampEnd, y: pres });
            if (hMin > 0) presPts.push({ x: tHoldEnd, y: pres });
        }

        const spanStart = t;
        const spanEnd   = hMin > 0 ? tHoldEnd : tRampEnd;
        if (!phaseSpans[ph]) phaseSpans[ph] = [spanStart, spanEnd];
        else                 phaseSpans[ph][1] = spanEnd;

        events.push({
            t, tRampEnd, tHoldEnd, hMin, rampMin,
            temp: tgt, pres, ramp, hold: step.hold,
            remarks: step.remarks || '',
            phase: ph, step,
        });

        t        = hMin > 0 ? tHoldEnd : tRampEnd;
        prevTemp = tgt;
    });

    tempPts.push({ x: t + 10, y: 25, phase: 'post' });
    presPts.push({ x: t + 10, y: presPts[presPts.length - 1]?.y ?? 0 });

    return { tempPts, presPts, events, phaseSpans };
}

/* ── find remark closest to a given x value (within tolerance) ── */
function findRemarkAt(events, xMin) {
    const TOLERANCE = 5; // minutes
    let best = null, bestDist = Infinity;
    events.forEach(ev => {
        const candidates = [ev.t, ev.tRampEnd, ev.tHoldEnd];
        candidates.forEach(cx => {
            const d = Math.abs(cx - xMin);
            if (d < TOLERANCE && d < bestDist && ev.remarks) {
                bestDist = d;
                best = ev.remarks;
            }
        });
    });
    return best;
}

function makePhaseBoxes(phaseSpans) {
    const boxes = {};
    const labels = { pre: 'Pre-Growth', growth: 'Growth', post: 'Post-Growth' };
    Object.entries(phaseSpans).forEach(([ph, span]) => {
        if (!span) return;
        boxes[`${ph}Box`] = {
            type: 'box',
            xMin: span[0], xMax: span[1],
            backgroundColor: C[ph] + '0D',
            borderColor:     C[ph] + '40',
            borderWidth: 1,
            borderDash: [5, 4],
            label: {
                display: true,
                content: labels[ph],
                position: { x: 'center', y: 'start' },
                color: C[ph],
                font: { size: 10, weight: '700', family: 'DM Sans, sans-serif' },
                padding: { x: 6, y: 3 },
                backgroundColor: C[ph] + '18',
            },
        };
        if (ph === 'pre' || ph === 'growth') {
            boxes[`${ph}Div`] = {
                type: 'line', xMin: span[1], xMax: span[1],
                borderColor: '#CCCCCC', borderWidth: 1, borderDash: [5, 4],
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
            xMin: ev.tRampEnd, xMax: ev.tHoldEnd,
            yMin: yArr, yMax: yArr,
            borderColor: '#CCCCCC', borderWidth: 1,
        };
        out[`holdLbl_${i}`] = {
            type: 'label',
            xValue: (ev.tRampEnd + ev.tHoldEnd) / 2,
            yValue: yArr,
            content: [`← ${fmtHold(ev.hold)} →`],
            yAdjust: -12,
            color: '#999',
            font: { size: 8.5, family: 'IBM Plex Mono, monospace' },
        };
    });
    return out;
}

function makeTempLabels(events) {
    const out = {};
    const seen = new Set();
    events.forEach((ev, i) => {
        const key = `${Math.round(ev.tRampEnd)}_${ev.temp}`;
        if (seen.has(key) || ev.temp === 25) return;
        seen.add(key);
        const above = ev.temp < 1700;
        const lines = [`${ev.temp}°C`];
        if (ev.ramp > 0) lines.push(`${ev.ramp}°C/min`);
        out[`tLbl_${i}`] = {
            type: 'label',
            xValue: ev.tRampEnd,
            yValue: ev.temp,
            content: lines,
            yAdjust: above ? -30 : 30,
            color: C[ev.phase],
            font: { size: 8.5, weight: '600', family: 'IBM Plex Mono, monospace' },
            backgroundColor: '#FFFFFFDD',
            borderRadius: 4,
            borderWidth: 0.5,
            borderColor: C[ev.phase] + '66',
            padding: { x: 5, y: 3 },
            callout: { display: true, borderColor: C[ev.phase] + '88', borderWidth: 0.8 },
        };
    });
    return out;
}

function makePresLabels(events) {
    const out = {};
    const seen = new Set();
    events.forEach((ev, i) => {
        if (ev.pres == null) return;
        const key = `${Math.round(ev.tRampEnd)}_${ev.pres}`;
        if (seen.has(key)) return;
        seen.add(key);
        out[`pLbl_${i}`] = {
            type: 'label',
            xValue: ev.tRampEnd,
            yValue: ev.pres,
            content: [`${ev.pres} torr`],
            yAdjust: -14,
            color: C.pres,
            font: { size: 8, family: 'IBM Plex Mono, monospace' },
            backgroundColor: '#EFF6FFEE',
            borderRadius: 4,
            borderWidth: 0.5,
            borderColor: '#BFDBFE',
            padding: { x: 4, y: 2 },
        };
    });
    return out;
}

/* ══════════════════════════════════════════════════════════════
   BASE OPTIONS  — now includes zoom + smart time axis + remarks
══════════════════════════════════════════════════════════════ */
function baseOptions(annotations, isTemp, xMax, timeUnit, events) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { right: 24, left: 4, top: isTemp ? 40 : 10, bottom: 4 } },
        plugins: {
            legend: { display: false },

            /* ── Tooltip: shows time in smart unit + remarks ── */
            tooltip: {
                backgroundColor: '#111827',
                titleFont: { family: 'DM Sans, sans-serif', size: 11 },
                bodyFont:  { family: 'IBM Plex Mono, monospace', size: 11 },
                footerFont:{ family: 'DM Sans, sans-serif', size: 10, style: 'italic' },
                padding: 10,
                callbacks: {
                    title: items => {
                        const xMin = parseFloat(items[0].raw.x);
                        return `⏱  ${fmtTime(xMin, timeUnit)}`;
                    },
                    label: item => isTemp
                        ? `🌡  ${item.raw.y}°C`
                        : `📊  ${item.raw.y} torr`,
                    /* Remarks shown in tooltip footer when available */
                    footer: items => {
                        const xMin = parseFloat(items[0].raw.x);
                        const remark = findRemarkAt(events, xMin);
                        return remark ? [`💬 ${remark}`] : [];
                    },
                },
                footerColor: '#A5F3C4',
                footerMarginTop: 6,
            },

            annotation: { annotations },

            /* ── Zoom: scroll-wheel zoom on x-axis, drag to pan ── */
            zoom: {
                pan:  { enabled: true, mode: 'x' },
                zoom: {
                    wheel:  { enabled: true },
                    pinch:  { enabled: true },
                    mode:   'x',
                    onZoomComplete({ chart }) {
                        chart.update('none');
                    },
                },
                limits: { x: { min: 0, max: xMax, minRange: xMax * 0.05 } },
            },
        },

        scales: {
            x: {
                type: 'linear',
                min: 0, max: xMax,
                title: {
                    display: !isTemp,
                    text: timeUnit.label,
                    color: C.muted,
                    font: { size: 10.5, family: 'DM Sans, sans-serif', weight: '600' },
                    padding: { top: 4 },
                },
                grid:  { color: C.grid, lineWidth: 0.8 },
                border: { color: '#CCCCCC' },
                ticks: {
                    display: !isTemp,
                    color: C.muted,
                    font: { size: 9, family: 'IBM Plex Mono, monospace' },
                    maxTicksLimit: 12,
                    /* Convert raw minutes to the chosen display unit */
                    callback: v => {
                        const val = v / timeUnit.divisor;
                        if (timeUnit.unit === 'min')  return `${Math.round(val)}`;
                        if (timeUnit.unit === 'hr')   return `${parseFloat(val.toFixed(1))}`;
                        return `${parseFloat(val.toFixed(2))}`;
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
                border: { color: '#CCCCCC' },
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

    const { tempPts, presPts, events, phaseSpans } = useMemo(
        () => buildTimeline(preGrowth, growth, postGrowth),
        [preGrowth, growth, postGrowth]
    );

    const [isZoomed, setIsZoomed] = useState(false);

    /* Reset both charts to original view */
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

    const xMax      = Math.max(...tempPts.map(p => p.x)) * 1.03;
    const timeUnit  = makeTimeUnit(xMax);   // ← smart unit selection

    const phaseBoxes   = makePhaseBoxes(phaseSpans);
    const holdArrows   = makeHoldArrows(events);
    const tempLabels   = makeTempLabels(events);
    const presLabels   = makePresLabels(events);

    /* growth markers */
    const gEvs = events.filter(e => e.phase === 'growth');
    const growthMarkers = {};
    if (gEvs.length) {
        const gs = gEvs[0];
        const ge = gEvs[gEvs.length - 1];
        const geEnd = ge.hMin > 0 ? ge.tHoldEnd : ge.tRampEnd;
        growthMarkers.gStart = {
            type: 'label', xValue: gs.tRampEnd, yValue: gs.temp,
            content: ['Growth started'], yAdjust: 22,
            color: C.growth, font: { size: 8.5, weight: '700', family: 'DM Sans, sans-serif' },
            backgroundColor: '#FDECEA99', borderRadius: 4,
            borderColor: C.growth + '44', borderWidth: 1,
            padding: { x: 5, y: 3 },
        };
        growthMarkers.gEnd = {
            type: 'label', xValue: geEnd, yValue: ge.temp,
            content: ['Growth terminated'], yAdjust: 22,
            color: C.growth, font: { size: 8.5, weight: '700', family: 'DM Sans, sans-serif' },
            backgroundColor: '#FDECEA99', borderRadius: 4,
            borderColor: C.growth + '44', borderWidth: 1,
            padding: { x: 5, y: 3 },
        };
        /* growth span arrow */
        const gSpan = phaseSpans.growth;
        if (gSpan) {
            const midT  = (gSpan[0] + gSpan[1]) / 2;
            const ySpan = gs.temp - gs.temp * 0.08;
            growthMarkers.gSpanLine = {
                type: 'line', xMin: gSpan[0], xMax: gSpan[1],
                yMin: ySpan, yMax: ySpan,
                borderColor: '#AAAAAA', borderWidth: 1,
            };
            growthMarkers.gSpanLbl = {
                type: 'label', xValue: midT, yValue: ySpan,
                content: [`← ${fmtHold(gs.hold)} →`],
                yAdjust: -12, color: '#666',
                font: { size: 9, weight: '600', family: 'DM Sans, sans-serif' },
            };
        }
    }

    /* ── Dataset: equal borderWidth for ALL phase segments ── */
    const tempData = {
        datasets: [{
            label: 'Temperature',
            data: tempPts.map(p => ({ x: p.x, y: p.y })),
            borderWidth: 2.8,          // uniform across all phases
            tension: 0,
            fill: false,
            pointRadius: ctx => tempPts[ctx.dataIndex]?.y === 25 ? 3 : 4.5,
            pointBackgroundColor: ctx => C[tempPts[ctx.dataIndex]?.phase] || '#888',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 1.5,
            pointHoverRadius: 8,
            pointHoverBorderWidth: 2.5,
            segment: {
                /* Each segment inherits color from its start-point phase */
                borderColor: ctx => C[tempPts[ctx.p0DataIndex]?.phase] || C.pre,
                /* Force identical borderWidth per segment — prevents any
                   phase from looking thinner/thicker than the others    */
                borderWidth: () => 2.8,
            },
        }],
    };

    const presData = {
        datasets: [{
            label: 'Pressure',
            data: presPts.map(p => ({ x: p.x, y: p.y })),
            borderColor: C.pres,
            backgroundColor: C.pres + '15',
            borderWidth: 2.8,          // matched to temp line weight
            stepped: 'before',
            fill: true,
            tension: 0,
            pointRadius: 3.5,
            pointBackgroundColor: '#FFFFFF',
            pointBorderColor: C.pres,
            pointBorderWidth: 1.5,
            pointHoverRadius: 7,
            pointHoverBorderWidth: 2,
        }],
    };

    const tempOpts = baseOptions(
        { ...phaseBoxes, ...holdArrows, ...tempLabels, ...growthMarkers },
        true, xMax, timeUnit, events
    );
    const presOpts = baseOptions(
        { ...phaseBoxes, ...presLabels },
        false, xMax, timeUnit, events
    );

    /* Track whether user has zoomed so we show Reset button */
    tempOpts.plugins.zoom.zoom.onZoomComplete = () => setIsZoomed(true);
    presOpts.plugins.zoom.zoom.onZoomComplete = () => setIsZoomed(true);
    tempOpts.plugins.zoom.pan.onPanComplete   = () => setIsZoomed(true);
    presOpts.plugins.zoom.pan.onPanComplete   = () => setIsZoomed(true);

    return (
        <div style={s.wrap}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@400;600;700&display=swap');`}</style>

            {/* title bar */}
            <div style={s.titleBar}>
                <div>
                    <div style={s.chartTitle}>{runId ? `${runId} — ` : ''}Temperature & Pressure Profile</div>
                    {operatorName && <div style={s.titleMeta}>Operator: {operatorName}</div>}
                </div>
                <div style={s.titleRight}>
                    {coilPosition && <span style={s.metaTag}>📍 {coilPosition}</span>}
                    {gasInfo       && <span style={s.metaTag}>⛽ {gasInfo}</span>}
                    {/* Zoom controls */}
                    <span style={s.zoomHint}>🔍 Scroll to zoom · Drag to pan</span>
                    {isZoomed && (
                        <button style={s.resetBtn} onClick={handleResetZoom}>
                            ↺ Reset Zoom
                        </button>
                    )}
                </div>
            </div>

            {/* legend */}
            <div style={s.legend}>
                {[
                    { ph: 'pre',    label: 'Pre-Growth'  },
                    { ph: 'growth', label: 'Growth'      },
                    { ph: 'post',   label: 'Post-Growth' },
                ].map(({ ph, label }) => (
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
                    <span style={s.remarksBadge}>💬 Hover points for remarks</span>
                </div>
            </div>

            {/* temperature subplot */}
            <div style={s.subLabel}>TEMPERATURE</div>
            <div style={s.areaTop}>
                <Line ref={tempChartRef} data={tempData} options={tempOpts} />
            </div>

            {/* divider */}
            <div style={s.divider} />

            {/* pressure subplot */}
            <div style={s.subLabel}>PRESSURE</div>
            <div style={s.areaBot}>
                <Line ref={presChartRef} data={presData} options={presOpts} />
            </div>

            {/* summary strip */}
            <div style={s.strip}>
                {[
                    { key: 'pre',    rows: preGrowth,  label: 'Pre-Growth'  },
                    { key: 'growth', rows: growth,      label: 'Growth'      },
                    { key: 'post',   rows: postGrowth,  label: 'Post-Growth' },
                ].map(({ key, rows, label }) => (
                    <div key={key} style={{ ...s.stripCell, borderTop: `3px solid ${C[key]}` }}>
                        <div style={{ ...s.stripTitle, color: C[key] }}>{label}</div>
                        <div style={s.stripSub}>{rows.length} step{rows.length !== 1 ? 's' : ''}</div>
                        {rows.map((r, i) => (
                            <div key={i} style={s.stripRow}>
                                <span style={s.stripIdx}>{i + 1}</span>
                                {r.temp     != null          && <span style={s.tag}>{r.temp}°C</span>}
                                {r.rampRate != null && r.rampRate > 0 && <span style={s.tag}>{r.rampRate}°C/m</span>}
                                {r.hold?.value               && <span style={s.tag}>{fmtHold(r.hold)}</span>}
                                {r.pressure != null          && <span style={{ ...s.tag, color: C.pres, background: '#EFF6FF' }}>{r.pressure}T</span>}
                                {r.remarks                   && <span style={s.remarkTag} title={r.remarks}>💬</span>}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════
   STYLES
══════════════════════════════════════════════════════════════ */
const s = {
    wrap: {
        background: '#FAFAF7', border: '1px solid #E4E1D9',
        borderRadius: 14, overflow: 'hidden',
        fontFamily: "'DM Sans', sans-serif",
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    },
    titleBar: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 20px 10px',
        borderBottom: '1px solid #EEEBE3', background: '#fff',
        flexWrap: 'wrap', gap: 8,
    },
    chartTitle: { fontSize: 13.5, fontWeight: 700, color: '#1A2B4A' },
    titleMeta:  { fontSize: 11, color: '#888', marginTop: 2 },
    titleRight: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' },
    metaTag: {
        fontSize: 11, fontWeight: 600, background: '#F0EDE6',
        color: '#555', padding: '3px 10px', borderRadius: 99,
    },
    zoomHint: {
        fontSize: 10, color: '#AAA', fontStyle: 'italic',
        fontFamily: 'DM Sans, sans-serif',
    },
    resetBtn: {
        fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
        background: '#EFF6FF', color: '#2563EB',
        border: '1px solid #BFDBFE', borderRadius: 6,
        padding: '3px 10px', fontFamily: 'DM Sans, sans-serif',
        transition: 'background 0.15s',
    },
    legend: {
        display: 'flex', gap: 18, padding: '10px 20px 8px',
        alignItems: 'center', background: '#fff',
        borderBottom: '1px solid #F5F3EF', flexWrap: 'wrap',
    },
    legendItem:  { display: 'flex', alignItems: 'center', gap: 6 },
    legendDot:   { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
    legendDash:  { width: 18, height: 3, borderRadius: 2, flexShrink: 0 },
    legendLabel: { fontSize: 11.5, fontWeight: 600, color: '#555' },
    remarksBadge:{ fontSize: 10, color: '#888', fontStyle: 'italic' },
    subLabel: {
        fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
        color: '#BBBBBB', textTransform: 'uppercase',
        padding: '8px 22px 0', background: '#FAFAF7',
    },
    areaTop: { height: 360, padding: '2px 20px 10px', background: '#FAFAF7' },
    divider: { height: 1, background: '#E4E1D9', margin: '0 20px' },
    areaBot: { height: 190, padding: '2px 20px 14px', background: '#FAFAF7' },
    strip: {
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: 12, padding: '14px 20px 16px',
        borderTop: '1px solid #EEEBE3', background: '#fff',
    },
    stripCell:  { paddingTop: 10 },
    stripTitle: { fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 },
    stripSub:   { fontSize: 10.5, color: '#AAA', marginBottom: 6 },
    stripRow:   { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 3 },
    stripIdx:   { fontSize: 9.5, fontWeight: 700, color: '#CCC', fontFamily: 'IBM Plex Mono, monospace', minWidth: 12 },
    tag: {
        fontSize: 10.5, fontWeight: 600, background: '#F0EDE6', color: '#555',
        padding: '1px 6px', borderRadius: 4, fontFamily: 'IBM Plex Mono, monospace',
    },
    remarkTag: {
        fontSize: 11, cursor: 'help', userSelect: 'none',
    },
    empty: {
        padding: '48px 24px', textAlign: 'center',
        background: '#FAFAF7', borderRadius: 14, border: '1px solid #E4E1D9',
    },
    emptyIcon: { fontSize: 28, marginBottom: 10, opacity: 0.4 },
    emptyText: { fontSize: 14, fontWeight: 600, color: '#888' },
    emptyHint: { fontSize: 12, color: '#BBB', marginTop: 4 },
};