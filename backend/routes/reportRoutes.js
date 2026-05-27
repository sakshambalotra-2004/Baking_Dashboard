/**
 * reportRoutes.js
 * ─────────────────────────────────────────────────────────────
 * DRDO · SSPL · SIC Lab  —  Industrial Run Report (PDF)
 *
 * GET  /report/:id
 * GET  /report/:id?photoSize=small          thumbnail  ~90 pt tall
 * GET  /report/:id?photoSize=medium         default    ~150 pt tall  (default)
 * GET  /report/:id?photoSize=large          full-width ~220 pt tall
 *
 * All photos are also captioned.  If run.images[n].size is set
 * ( "small" | "medium" | "large" ) it overrides the global query param
 * for that individual image.
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const express            = require('express');
const router             = express.Router();
const PDFDocument        = require('pdfkit');
const fs                 = require('fs');
const path               = require('path');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { Chart: ChartJS }    = require('chart.js');
const annotationPlugin      = require('chartjs-plugin-annotation');
const Run                   = require('../models/Run');

/* Register annotation plugin once at module level */
ChartJS.register(annotationPlugin);

/* ═══════════════════════════════════════════════════════════════
   COLOUR PALETTE
═══════════════════════════════════════════════════════════════ */

const C = {
    // DRDO / government navy
    navy:     '#0D2347',
    navyMid:  '#1A3A6A',
    navyLt:   '#2A5298',

    // Accent — DRDO saffron/gold
    gold:     '#C8922A',
    goldLt:   '#F5E6C8',

    // Data colours
    success:  '#1A6B45',
    danger:   '#A02828',
    warn:     '#B06010',

    // Neutrals
    light:    '#F5F5F0',
    mid:      '#CCCCCC',
    muted:    '#777777',
    black:    '#1A1A1A',
    white:    '#FFFFFF',

    // Table rows
    row1:     '#FFFFFF',
    row2:     '#EEF1F7',

    // Section heading band
    secBg:    '#1A3A6A',
};

/* ═══════════════════════════════════════════════════════════════
   PAGE GEOMETRY  (A4 portrait)
═══════════════════════════════════════════════════════════════ */

const ML = 40, MR = 40, MT = 0, MB = 36;
const PW = 595.28;
const PH = 841.89;
const CW = PW - ML - MR;   // usable content width

/* ═══════════════════════════════════════════════════════════════
   PHOTO SIZE MAP
═══════════════════════════════════════════════════════════════ */

const PHOTO_SIZES = {
    small:  { h: 90,  cols: 3 },
    medium: { h: 150, cols: 2 },
    large:  { h: 220, cols: 1 },
};

/* ═══════════════════════════════════════════════════════════════
   LOW-LEVEL DRAW HELPERS
═══════════════════════════════════════════════════════════════ */

function fillRect(doc, x, y, w, h, color) {
    doc.save().rect(x, y, w, h).fill(color).restore();
}

function strokeRect(doc, x, y, w, h, color, lw = 0.5) {
    doc.save().rect(x, y, w, h).lineWidth(lw).strokeColor(color).stroke().restore();
}

function hRule(doc, y, color = C.mid, lw = 0.4) {
    doc.save()
        .moveTo(ML, y).lineTo(ML + CW, y)
        .lineWidth(lw).strokeColor(color).stroke()
        .restore();
}

function vLine(doc, x, y1, y2, color = C.mid, lw = 0.3) {
    doc.save()
        .moveTo(x, y1).lineTo(x, y2)
        .lineWidth(lw).strokeColor(color).stroke()
        .restore();
}

/* ═══════════════════════════════════════════════════════════════
   DRDO EMBLEM  (text-drawn — replace with actual logo image path
   by setting DRDO_LOGO_PATH env variable)
═══════════════════════════════════════════════════════════════ */

const DRDO_LOGO_PATH = process.env.DRDO_LOGO_PATH || null;

function drawEmblem(doc, x, y, size = 52) {
    if (DRDO_LOGO_PATH && fs.existsSync(DRDO_LOGO_PATH)) {
        doc.image(DRDO_LOGO_PATH, x, y, { width: size, height: size });
        return;
    }
    // Fallback: geometric placeholder for DRDO wheel / chakra
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r  = size / 2 - 2;
    doc.save()
        .circle(cx, cy, r)
        .lineWidth(1.5).strokeColor(C.gold).stroke();
    // spokes
    for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4;
        doc.moveTo(cx, cy)
            .lineTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang))
            .lineWidth(0.8).strokeColor(C.gold).stroke();
    }
    doc.save()
        .circle(cx, cy, r * 0.35)
        .lineWidth(1).strokeColor(C.gold).stroke()
        .restore();
    // DRDO letters in centre
    doc.font('Helvetica-Bold').fontSize(6).fillColor(C.gold)
        .text('DRDO', cx - 10, cy - 3.5, { lineBreak: false, width: 20, align: 'center' });
    doc.restore();
}

/* ═══════════════════════════════════════════════════════════════
   COVER PAGE
═══════════════════════════════════════════════════════════════ */

function drawCoverPage(doc, run, photoSizeLabel) {

    /* ── Top decorative band ── */
    fillRect(doc, 0, 0, PW, 8, C.gold);
    fillRect(doc, 0, 8, PW, 120, C.navy);
    fillRect(doc, 0, 128, PW, 4, C.gold);

    /* ── Emblem left ── */
    drawEmblem(doc, ML, 16, 88);

    /* ── Organisation text ── */
    doc.font('Helvetica-Bold').fontSize(11).fillColor(C.gold)
        .text('DEFENCE RESEARCH AND DEVELOPMENT ORGANISATION', ML + 100, 22, {
            width: CW - 100, align: 'center', lineBreak: false
        });

    doc.font('Helvetica-Bold').fontSize(14).fillColor(C.white)
        .text('SOLID STATE PHYSICS LABORATORY  (SSPL)', ML + 100, 40, {
            width: CW - 100, align: 'center'
        });

    doc.font('Helvetica').fontSize(9.5).fillColor('#A8C4E8')
        .text('Lucknow Road, Timarpur, Delhi – 110 054', ML + 100, 68, {
            width: CW - 100, align: 'center'
        });

    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.gold)
        .text('SIC LAB  ·  INDUSTRIAL FURNACE MONITORING SYSTEM', ML + 100, 84, {
            width: CW - 100, align: 'center'
        });

    /* ── Emblem right (mirror) ── */
    drawEmblem(doc, PW - MR - 88, 16, 88);

    /* ── Report title block ── */
    const titleY = 148;
    fillRect(doc, ML, titleY, CW, 76, C.light);
    strokeRect(doc, ML, titleY, CW, 76, C.navy, 1);

    doc.font('Helvetica-Bold').fontSize(18).fillColor(C.navy)
        .text('INDUSTRIAL RUN REPORT', ML, titleY + 14, {
            width: CW, align: 'center'
        });

    const typeLabel = run.materialType === 'carbide'
        ? 'Carbide Baking Process'
        : 'Source Powder Baking Process';

    doc.font('Helvetica').fontSize(11).fillColor(C.navyLt)
        .text(typeLabel, ML, titleY + 40, { width: CW, align: 'center' });

    /* ── Run identification strip ── */
    const stripY = titleY + 76 + 12;
    const stripH = 22;
    fillRect(doc, ML, stripY, CW, stripH, C.navyMid);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.white)
        .text(`Run ID :  ${run.runId}`, ML + 10, stripY + 6, { lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor('#A8C4E8')
        .text(`Operator :  ${run.operatorName}`, ML + 180, stripY + 6, { lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor('#A8C4E8')
        .text(
            `Date :  ${new Date(run.dateTime).toLocaleString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            })}`,
            ML + 360, stripY + 6, { lineBreak: false }
        );

    /* ── Meta grid ── */
    const metaY = stripY + stripH + 14;
    const metaItems = [
        { label: 'Run ID',           value: run.runId },
        { label: 'Material Type',    value: run.materialType === 'carbide' ? 'Carbide' : 'Source Powder' },
        { label: 'Status',           value: (run.status || '').replace('_', ' ').toUpperCase() },
        { label: 'Operator',         value: run.operatorName },
        { label: 'Duration',         value: run.durationMinutes ? `${run.durationMinutes} min` : '—' },
        { label: 'Date & Time',      value: new Date(run.dateTime).toLocaleString('en-GB') },
        { label: 'Temperature Logs', value: (run.temperatureLogs || []).length },
        { label: 'Pressure Logs',    value: (run.pressureLogs    || []).length },
        { label: 'Images',           value: (run.images          || []).length },
        { label: 'Photo Size',       value: photoSizeLabel.charAt(0).toUpperCase() + photoSizeLabel.slice(1) },
        { label: 'Report Generated', value: new Date().toLocaleString('en-GB') },
        { label: 'Classification',   value: 'CONFIDENTIAL' },
    ];
    drawMetaGrid(doc, metaItems, metaY, 3);

    /* ── Decorative bottom band ── */
    fillRect(doc, 0, PH - 44, PW, 4, C.gold);
    fillRect(doc, 0, PH - 40, PW, 40, C.navy);

    doc.font('Helvetica').fontSize(7.5).fillColor('#A8C4E8')
        .text(
            'DRDO – SSPL  ·  SIC Lab  ·  This document is the property of DRDO and must not be reproduced without authorisation',
            ML, PH - 28, { width: CW, align: 'center' }
        );
}

/* helper: 3-column meta grid (reused on cover) */
function drawMetaGrid(doc, items, y, cols = 3) {
    const cellW = CW / cols;
    const cellH = 28;
    const rows  = Math.ceil(items.length / cols);

    for (let r = 0; r < rows; r++) {
        const bg = r % 2 === 0 ? C.row1 : C.row2;
        fillRect(doc, ML, y, CW, cellH, bg);
        hRule(doc, y + cellH, C.mid, 0.25);

        for (let c = 0; c < cols; c++) {
            const idx = r * cols + c;
            if (idx >= items.length) break;
            const item = items[idx];
            const x    = ML + c * cellW;

            doc.font('Helvetica').fontSize(7).fillColor(C.muted)
                .text(item.label, x + 7, y + 5, { width: cellW - 14, lineBreak: false });

            const valColor = item.label === 'Classification' ? C.danger
                           : item.label === 'Status' && item.value.includes('COMPLETED') ? C.success
                           : C.black;

            doc.font('Helvetica-Bold').fontSize(8.5).fillColor(valColor)
                .text(String(item.value || '—'), x + 7, y + 15, {
                    width: cellW - 14, lineBreak: false
                });

            if (c < cols - 1) vLine(doc, x + cellW, y, y + cellH, C.mid, 0.3);
        }
        y += cellH;
    }
    hRule(doc, y, C.navy, 0.8);
    return y + 6;
}

/* ═══════════════════════════════════════════════════════════════
   RUNNING PAGE HEADER  (pages 2+)
═══════════════════════════════════════════════════════════════ */

function pageHeader(doc, run, pageNum, totalPages) {
    const BH = 44;
    fillRect(doc, 0, 0, PW, 5, C.gold);
    fillRect(doc, 0, 5, PW, BH - 5, C.navy);

    // Left logo area
    drawEmblem(doc, ML, 8, 30);

    // Organisation line
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.gold)
        .text('DRDO · SSPL · SIC Lab', ML + 36, 10, { lineBreak: false });

    doc.font('Helvetica').fontSize(7).fillColor('#A8C4E8')
        .text('Industrial Run Report', ML + 36, 22, { lineBreak: false });

    // Centre: run id + type
    const typeLabel = run.materialType === 'carbide' ? 'Carbide Baking' : 'Source Powder Baking';
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.white)
        .text(`Run ID: ${run.runId}  ·  ${typeLabel}`, ML + 120, 12, {
            width: CW - 220, align: 'center', lineBreak: false
        });

    // Right: page
    doc.font('Helvetica').fontSize(7.5).fillColor('#A8C4E8')
        .text(`Page ${pageNum}${totalPages ? ' / ' + totalPages : ''}`, 0, 10, {
            align: 'right', width: PW - MR, lineBreak: false
        });

    const dateStr = new Date(run.dateTime).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
    doc.font('Helvetica').fontSize(7).fillColor('#A8C4E8')
        .text(dateStr, 0, 22, { align: 'right', width: PW - MR, lineBreak: false });

    return BH + 10;   // y where content begins
}

/* ═══════════════════════════════════════════════════════════════
   SECTION LABEL  (coloured pill)
═══════════════════════════════════════════════════════════════ */

function sectionLabel(doc, text, y, accent = false) {
    const bg = accent ? C.gold : C.secBg;
    fillRect(doc, ML, y, CW, 18, bg);

    // left accent bar
    fillRect(doc, ML, y, 4, 18, accent ? C.navy : C.gold);

    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.white)
        .text(text.toUpperCase(), ML + 10, y + 5, { lineBreak: false });

    return y + 18;
}

/* ═══════════════════════════════════════════════════════════════
   KV GRID  (key/value pairs, N columns)
═══════════════════════════════════════════════════════════════ */

function kvGrid(doc, items, y, cols = 3) {
    return drawMetaGrid(doc, items, y, cols);
}

/* ═══════════════════════════════════════════════════════════════
   COMPACT TABLE
═══════════════════════════════════════════════════════════════ */

function compactTable(doc, headers, rows, colWidths, y, maxRows = 20) {
    const rowH   = 14;
    const totalW = colWidths.reduce((a, b) => a + b, 0);

    // Header
    fillRect(doc, ML, y, totalW, rowH, C.navyMid);
    let cx = ML;
    headers.forEach((h, i) => {
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.white)
            .text(h, cx + 4, y + 3, { width: colWidths[i] - 8, lineBreak: false });
        if (i < headers.length - 1)
            vLine(doc, cx + colWidths[i], y, y + rowH, '#FFFFFF44', 0.4);
        cx += colWidths[i];
    });
    y += rowH;

    const display = rows.slice(0, maxRows);
    display.forEach((row, ri) => {
        const bg = ri % 2 === 0 ? C.row1 : C.row2;
        fillRect(doc, ML, y, totalW, rowH, bg);
        strokeRect(doc, ML, y, totalW, rowH, '#DDDDDD', 0.2);

        cx = ML;
        row.forEach((cell, ci) => {
            doc.font('Helvetica').fontSize(7.5).fillColor(C.black)
                .text(String(cell ?? '—'), cx + 4, y + 3, {
                    width: colWidths[ci] - 8, lineBreak: false
                });
            cx += colWidths[ci];
        });
        y += rowH;
    });

    if (rows.length > maxRows) {
        doc.font('Helvetica').fontSize(7).fillColor(C.muted)
            .text(`… ${rows.length - maxRows} more entries omitted`, ML, y + 3);
        y += 14;
    }

    hRule(doc, y, C.navy, 0.7);
    return y + 8;
}

/* ═══════════════════════════════════════════════════════════════
   CHART PALETTE  (mirrors PressureChart.js exactly)
═══════════════════════════════════════════════════════════════ */

const CC = {
    pre:    '#5B8DD9',
    growth: '#D85A30',
    post:   '#1D9E75',
    pres:   '#2563EB',
    grid:   '#EEEBE3',
    bg:     '#FAFAF7',
    text:   '#374151',
    muted:  '#9CA3AF',
};

/* ── Mirrors buildTimeline() from PressureChart.js ── */
function buildTimeline(preGrowth, growth, postGrowth) {
    // Use toObject() so Mongoose subdocument fields spread correctly
    const toPlain = s => (s && typeof s.toObject === 'function' ? s.toObject() : { ...s });
    const allSteps = [
        ...(preGrowth  || []).map(s => ({ ...toPlain(s), phase: 'pre'    })),
        ...(growth     || []).map(s => ({ ...toPlain(s), phase: 'growth' })),
        ...(postGrowth || []).map(s => ({ ...toPlain(s), phase: 'post'   })),
    ];
    if (!allSteps.length) return { tempPts: [], presPts: [], events: [], phaseSpans: {} };

    const tempPts    = [{ x: 0, y: 25, phase: 'pre' }];
    const presPts    = [{ x: 0, y: 0 }];
    const events     = [];
    const phaseSpans = { pre: null, growth: null, post: null };
    let t = 0, prevTemp = 25;

    allSteps.forEach(step => {
        const tgt     = step.temp     ?? prevTemp;
        const ramp    = step.rampRate ?? 0;
        const hold    = step.hold || {};
        const hMin    = hold.unit === 'hr'  ? (Number(hold.value) || 0) * 60
                      : hold.unit === 'day' ? (Number(hold.value) || 0) * 1440
                      :                       (Number(hold.value) || 0);
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

        const spanEnd = hMin > 0 ? tHoldEnd : tRampEnd;
        if (!phaseSpans[ph]) phaseSpans[ph] = [t, spanEnd];
        else                 phaseSpans[ph][1] = spanEnd;

        events.push({ t, tRampEnd, tHoldEnd, hMin, rampMin,
            temp: tgt, pres, ramp, hold: step.hold, remarks: step.remarks || '', phase: ph });

        t        = hMin > 0 ? tHoldEnd : tRampEnd;
        prevTemp = tgt;
    });

    tempPts.push({ x: t + 10, y: 25, phase: 'post' });
    presPts.push({ x: t + 10, y: presPts[presPts.length - 1]?.y ?? 0 });

    return { tempPts, presPts, events, phaseSpans };
}

function makeTimeUnit(xMax) {
    if (xMax < 180)  return { unit: 'min',  divisor: 1,    label: 'Time (min)'  };
    if (xMax < 2880) return { unit: 'hr',   divisor: 60,   label: 'Time (hr)'   };
    return                   { unit: 'day',  divisor: 1440, label: 'Time (day)'  };
}

function fmtHold(hold) {
    if (!hold || !hold.value) return '';
    return `${hold.value} ${hold.unit}`;
}

/* ── Phase background boxes ── */
function makePhaseBoxes(phaseSpans) {
    const boxes = {};
    const labels = { pre: 'Pre-Growth', growth: 'Growth', post: 'Post-Growth' };
    Object.entries(phaseSpans).forEach(([ph, span]) => {
        if (!span) return;
        boxes[`${ph}Box`] = {
            type: 'box',
            xMin: span[0], xMax: span[1],
            backgroundColor: CC[ph] + '0D',
            borderColor:     CC[ph] + '40',
            borderWidth: 1,
            borderDash: [5, 4],
            label: {
                display: true,
                content: labels[ph],
                position: { x: 'center', y: 'start' },
                color: CC[ph],
                font: { size: 10, weight: '700' },
                padding: { x: 6, y: 3 },
                backgroundColor: CC[ph] + '18',
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

/* ── Hold duration arrows ── */
function makeHoldArrows(events) {
    const out = {};
    events.forEach((ev, i) => {
        if (ev.hMin <= 0 || ev.temp === 25) return;
        const yArr = ev.temp + ev.temp * 0.015;
        out[`hold_${i}`]    = { type: 'line', xMin: ev.tRampEnd, xMax: ev.tHoldEnd,
            yMin: yArr, yMax: yArr, borderColor: '#CCCCCC', borderWidth: 1 };
        out[`holdLbl_${i}`] = { type: 'label',
            xValue: (ev.tRampEnd + ev.tHoldEnd) / 2, yValue: yArr,
            content: [`\u2190 ${fmtHold(ev.hold)} \u2192`],
            yAdjust: -12, color: '#999',
            font: { size: 8 },
        };
    });
    return out;
}

/* ── Temperature point labels ── */
function makeTempLabels(events) {
    const out = {}, seen = new Set();
    events.forEach((ev, i) => {
        const key = `${Math.round(ev.tRampEnd)}_${ev.temp}`;
        if (seen.has(key) || ev.temp === 25) return;
        seen.add(key);
        const lines = [`${ev.temp}\u00b0C`];
        if (ev.ramp > 0) lines.push(`${ev.ramp}\u00b0C/min`);
        out[`tLbl_${i}`] = {
            type: 'label', xValue: ev.tRampEnd, yValue: ev.temp,
            content: lines, yAdjust: -30,
            color: CC[ev.phase],
            font: { size: 8, weight: '600' },
            backgroundColor: '#FFFFFFDD',
            borderRadius: 4, borderWidth: 0.5, borderColor: CC[ev.phase] + '66',
            padding: { x: 5, y: 3 },
        };
    });
    return out;
}

/* ── Pressure point labels ── */
function makePresLabels(events) {
    const out = {}, seen = new Set();
    events.forEach((ev, i) => {
        if (ev.pres == null) return;
        const key = `${Math.round(ev.tRampEnd)}_${ev.pres}`;
        if (seen.has(key)) return;
        seen.add(key);
        out[`pLbl_${i}`] = {
            type: 'label', xValue: ev.tRampEnd, yValue: ev.pres,
            content: [`${ev.pres} torr`], yAdjust: -14,
            color: CC.pres,
            font: { size: 8 },
            backgroundColor: '#EFF6FFEE',
            borderRadius: 4, borderWidth: 0.5, borderColor: '#BFDBFE',
            padding: { x: 4, y: 2 },
        };
    });
    return out;
}

/* ── Growth start/end markers ── */
function makeGrowthMarkers(events, phaseSpans) {
    const out = {};
    const gEvs = events.filter(e => e.phase === 'growth');
    if (!gEvs.length) return out;
    const gs = gEvs[0], ge = gEvs[gEvs.length - 1];
    const geEnd = ge.hMin > 0 ? ge.tHoldEnd : ge.tRampEnd;
    out.gStart = {
        type: 'label', xValue: gs.tRampEnd, yValue: gs.temp,
        content: ['Growth started'], yAdjust: 22, color: CC.growth,
        font: { size: 8, weight: '700' },
        backgroundColor: '#FDECEA99', borderRadius: 4,
        borderColor: CC.growth + '44', borderWidth: 1, padding: { x: 5, y: 3 },
    };
    out.gEnd = {
        type: 'label', xValue: geEnd, yValue: ge.temp,
        content: ['Growth terminated'], yAdjust: 22, color: CC.growth,
        font: { size: 8, weight: '700' },
        backgroundColor: '#FDECEA99', borderRadius: 4,
        borderColor: CC.growth + '44', borderWidth: 1, padding: { x: 5, y: 3 },
    };
    const gSpan = phaseSpans.growth;
    if (gSpan) {
        const midT  = (gSpan[0] + gSpan[1]) / 2;
        const ySpan = gs.temp - gs.temp * 0.08;
        out.gSpanLine = {
            type: 'line', xMin: gSpan[0], xMax: gSpan[1],
            yMin: ySpan, yMax: ySpan,
            borderColor: '#AAAAAA', borderWidth: 1,
        };
        out.gSpanLbl = {
            type: 'label', xValue: midT, yValue: ySpan,
            content: [`\u2190 ${fmtHold(gs.hold)} \u2192`],
            yAdjust: -12, color: '#666',
            font: { size: 9, weight: '600' },
        };
    }
    return out;
}

/* ── Render TEMPERATURE chart to buffer (mirrors frontend top subplot) ── */
async function renderTempChart(preGrowth, growth, postGrowth) {
    const { tempPts, events, phaseSpans } = buildTimeline(preGrowth, growth, postGrowth);
    // Always has at least the origin point; bail only if no real steps were added
    const hasRealData = tempPts.some(p => p.y !== 25);
    if (!hasRealData) return null;

    const xMax     = Math.max(...tempPts.map(p => p.x)) * 1.03;
    const timeUnit = makeTimeUnit(xMax);
    const annotations = {
        ...makePhaseBoxes(phaseSpans),
        ...makeHoldArrows(events),
        ...makeTempLabels(events),
        ...makeGrowthMarkers(events, phaseSpans),
    };

    // Build one dataset per phase so each gets its own color
    // (segment callbacks are not supported in chartjs-node-canvas)
    const phases = ['pre', 'growth', 'post'];
    const datasets = phases.map(ph => {
        // Include one overlap point at phase boundaries so lines connect
        const pts = [];
        let prevPoint = null;
        tempPts.forEach((p, i) => {
            if (p.phase === ph) {
                if (pts.length === 0 && prevPoint) pts.push({ x: prevPoint.x, y: prevPoint.y });
                pts.push({ x: p.x, y: p.y });
            }
            prevPoint = p;
        });
        return {
            label: ph,
            data: pts,
            borderColor: CC[ph],
            borderWidth: 2.8,
            tension: 0,
            fill: false,
            pointRadius: pts.map(p => p.y === 25 ? 2 : 4),
            pointBackgroundColor: pts.map(p => p.y === 25 ? CC[ph] + '55' : CC[ph]),
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 1.5,
        };
    });

    const canvas = new ChartJSNodeCanvas({ width: 1060, height: 380, backgroundColour: CC.bg });

    return canvas.renderToBuffer({
        type: 'line',
        data: { datasets },
        options: {
            responsive: false, animation: false,
            layout: { padding: { right: 24, left: 4, top: 50, bottom: 4 } },
            plugins: {
                legend: { display: false },
                annotation: { annotations },
            },
            scales: {
                x: {
                    type: 'linear', min: 0, max: xMax,
                    title: { display: false },
                    grid: { color: CC.grid, lineWidth: 0.8 },
                    ticks: { display: false },
                },
                y: {
                    min: 0,
                    title: {
                        display: true, text: 'Temperature (\u00b0C)',
                        color: CC.muted, font: { size: 11, weight: '600' },
                    },
                    ticks: {
                        color: CC.muted, font: { size: 9 },
                        callback: v => v + '\u00b0C', maxTicksLimit: 7,
                    },
                    grid: { color: CC.grid, lineWidth: 0.8 },
                },
            },
        },
    });
}

/* ── Render PRESSURE chart to buffer (mirrors frontend bottom subplot) ── */
async function renderPresChart(preGrowth, growth, postGrowth) {
    const { presPts, events, phaseSpans } = buildTimeline(preGrowth, growth, postGrowth);
    const hasRealPres = presPts.some(p => p.y !== 0);
    if (!hasRealPres) return null;

    const xMax     = Math.max(...presPts.map(p => p.x)) * 1.03;
    const timeUnit = makeTimeUnit(xMax);
    const annotations = {
        ...makePhaseBoxes(phaseSpans),
        ...makePresLabels(events),
    };

    const canvas = new ChartJSNodeCanvas({ width: 1060, height: 210, backgroundColour: CC.bg });

    return canvas.renderToBuffer({
        type: 'line',
        data: {
            datasets: [{
                label: 'Pressure',
                data: presPts.map(p => ({ x: p.x, y: p.y })),
                borderColor: CC.pres,
                backgroundColor: CC.pres + '15',
                borderWidth: 2.8,
                stepped: 'before',
                fill: true,
                tension: 0,
                pointRadius: 3.5,
                pointBackgroundColor: '#FFFFFF',
                pointBorderColor: CC.pres,
                pointBorderWidth: 1.5,
            }],
        },
        options: {
            responsive: false, animation: false,
            layout: { padding: { right: 24, left: 4, top: 10, bottom: 4 } },
            plugins: {
                legend: { display: false },
                annotation: { annotations },
            },
            scales: {
                x: {
                    type: 'linear', min: 0, max: xMax,
                    title: {
                        display: true, text: timeUnit.label,
                        color: CC.muted, font: { size: 11, weight: '600' },
                    },
                    grid: { color: CC.grid, lineWidth: 0.8 },
                    ticks: { color: CC.muted, font: { size: 9 }, maxTicksLimit: 12 },
                },
                y: {
                    min: 0,
                    title: {
                        display: true, text: 'Pressure (torr)',
                        color: CC.pres, font: { size: 11, weight: '600' },
                    },
                    ticks: { color: CC.pres, font: { size: 9 }, maxTicksLimit: 7 },
                    grid: { color: CC.grid, lineWidth: 0.8 },
                },
            },
        },
    });
}

/* ═══════════════════════════════════════════════════════════════
   STATUS BADGE COLOUR
═══════════════════════════════════════════════════════════════ */

function statusColor(status) {
    return status === 'completed'  ? C.success
         : status === 'in_progress'? C.warn
         : C.danger;
}

/* ═══════════════════════════════════════════════════════════════
   PAGE FOOTER
═══════════════════════════════════════════════════════════════ */

function pageFooter(doc, run) {
    const fy = PH - MB;
    hRule(doc, fy, C.gold, 0.5);
    doc.font('Helvetica').fontSize(6.5).fillColor(C.muted)
        .text(
            `Operator: ${run.operatorName}  ·  Generated: ${new Date().toLocaleString('en-GB')}  ·  DRDO – SSPL  ·  SIC Lab  ·  CONFIDENTIAL`,
            ML, fy + 4, { width: CW, align: 'center' }
        );
}

/* ═══════════════════════════════════════════════════════════════
   SAFE NEW PAGE  (adds footer to current page first)
═══════════════════════════════════════════════════════════════ */

function newPage(doc, run, pageCounter, totalPages) {
    pageFooter(doc, run);
    doc.addPage({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    pageCounter.n++;
    return pageHeader(doc, run, pageCounter.n, totalPages);
}

/* ═══════════════════════════════════════════════════════════════
   OVERFLOW GUARD  – call before drawing any block of height ~h
   Returns updated y (possibly on a new page).
═══════════════════════════════════════════════════════════════ */

function guard(doc, run, y, neededH, pc, totalPages) {
    if (y + neededH > PH - MB - 10) {
        y = newPage(doc, run, pc, totalPages);
    }
    return y;
}

/* ═══════════════════════════════════════════════════════════════
   PDF ROUTE
═══════════════════════════════════════════════════════════════ */

router.get('/:id', async (req, res) => {
    try {

        const run = await Run.findById(req.params.id);
        if (!run) return res.status(404).json({ message: 'Run not found' });

        /* ── Photo size from query param (default: medium) ── */
        const globalSizeKey   = ['small', 'medium', 'large'].includes(req.query.photoSize)
                                ? req.query.photoSize
                                : 'medium';
        const globalPhotoSize = PHOTO_SIZES[globalSizeKey];

        /* ── Pre-render charts — exact replica of PressureChart.js ── */
        const pg = run.preGrowth  || [];
        const gr = run.growth     || [];
        const po = run.postGrowth || [];


        // Derive flat log aliases for the summary tables
        const { tempPts, presPts } = buildTimeline(pg, gr, po);
        const tempLogs     = tempPts.map(p => ({ time: Math.round(p.x), value: p.y }));
        const pressureLogs = presPts.map(p => ({ time: Math.round(p.x), value: p.y }));

        const [tempChartResult, pressureChartResult] = await Promise.allSettled([
            renderTempChart(pg, gr, po),
            renderPresChart(pg, gr, po),
        ]);

        const tempChartBuf     = tempChartResult.status     === 'fulfilled' ? tempChartResult.value     : null;
        const pressureChartBuf = pressureChartResult.status === 'fulfilled' ? pressureChartResult.value : null;

        if (tempChartResult.status === 'rejected')
            console.error('[reportRoutes] Temperature chart ERROR:', tempChartResult.reason);
        else if (!tempChartBuf)
            console.warn('[reportRoutes] Temperature chart: no real data (all steps at 25°C or empty)');

        if (pressureChartResult.status === 'rejected')
            console.error('[reportRoutes] Pressure chart ERROR:', pressureChartResult.reason);
        else if (!pressureChartBuf)
            console.warn('[reportRoutes] Pressure chart: no pressure values found in phase steps');

        /* ── Estimate total pages (rough) ── */
        const imgCount    = (run.images || []).length;
        const imgCols     = globalPhotoSize.cols;
        const imgPages    = imgCount > 0 ? Math.ceil(imgCount / (imgCols * 3)) : 0;
        const totalPages  = 4 + imgPages;   // cover + 3 data pages + overflow

        /* ── Create PDF document ── */
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: MT, bottom: MB, left: ML, right: MR },
            autoFirstPage: false,
            compress: true,
            info: {
                Title:   `Run Report – ${run.runId}`,
                Author:  run.operatorName,
                Subject: 'DRDO SSPL SIC Lab Industrial Run Report',
                Creator: 'SSPL Report System',
            },
        });

        res.setHeader('Content-Disposition', `attachment; filename="SSPL-Run-${run.runId}.pdf"`);
        res.setHeader('Content-Type', 'application/pdf');
        doc.pipe(res);

        /* ════════════════════════════════════════════
           PAGE 1 — COVER
        ════════════════════════════════════════════ */

        doc.addPage({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
        drawCoverPage(doc, run, globalSizeKey);

        const pc = { n: 1 };   // page counter object (mutable)

        /* ════════════════════════════════════════════
           PAGE 2 — RUN SUMMARY + TEMPERATURE
        ════════════════════════════════════════════ */

        let y = newPage(doc, run, pc, totalPages);

        /* Status strip */
        const sc = statusColor(run.status);
        fillRect(doc, ML, y, CW, 20, sc + '22');
        fillRect(doc, ML, y, 5, 20, sc);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(sc)
            .text(
                `STATUS :  ${(run.status || '').toUpperCase().replace('_', ' ')}`,
                ML + 12, y + 6, { lineBreak: false }
            );
        y += 20 + 10;

        /* Run Summary */
        y = sectionLabel(doc, '1.  Run Summary', y);
        y = kvGrid(doc, [
            { label: 'Run ID',           value: run.runId },
            { label: 'Operator Name',    value: run.operatorName },
            { label: 'Material Type',    value: run.materialType },
            { label: 'Status',           value: (run.status || '').replace('_', ' ') },
            { label: 'Duration',         value: run.durationMinutes ? `${run.durationMinutes} min` : '—' },
            { label: 'Date & Time',      value: new Date(run.dateTime).toLocaleString('en-GB') },
            { label: 'Temp Log Entries', value: tempLogs.length },
            { label: 'Pressure Entries', value: pressureLogs.length },
            { label: 'Images Attached',  value: (run.images || []).length },
        ], y, 3);
        y += 10;

        /* Temperature Logs Table */
        y = guard(doc, run, y, 100, pc, totalPages);
        y = sectionLabel(doc, '2.  Temperature Logs', y);

        const tRows = tempLogs.map((t, i) => [
            i + 1,
            `${t.time} min`,
            `${t.value} °C`,
            t.note || '',
        ]);
        y = compactTable(doc,
            ['#', 'Time (min)', 'Temperature (°C)', 'Note'],
            tRows,
            [36, 120, 140, CW - 296],
            y, 20
        );
        y += 8;

        /* Temperature Chart — taller to match frontend subplot proportions */
        const tempChartH = 160;   // matches renderTempChart 380px canvas height
        if (tempChartBuf) {
            y = guard(doc, run, y, tempChartH + 30, pc, totalPages);
            y = sectionLabel(doc, '3.  Temperature Trend Chart', y);
            y += 5;
            doc.image(tempChartBuf, ML, y, { width: CW, height: tempChartH });
            y += tempChartH + 6;
        } else {
            y = guard(doc, run, y, 40, pc, totalPages);
            y = sectionLabel(doc, '3.  Temperature Trend Chart', y);
            y += 8;
            doc.font('Helvetica').fontSize(8).fillColor(C.muted)
                .text('No temperature data available to render chart.', ML + 8, y);
            y += 20;
        }

        /* ════════════════════════════════════════════
           PAGE 3 — PRESSURE LOGS + NOTES
        ════════════════════════════════════════════ */

        y = newPage(doc, run, pc, totalPages);

        /* Pressure Logs */
        y = sectionLabel(doc, '4.  Pressure Logs', y);
        const pRows = pressureLogs.map((p, i) => [
            i + 1,
            `${p.time} min`,
            `${p.value} bar`,
            p.note || '',
        ]);
        y = compactTable(doc,
            ['#', 'Time (min)', 'Pressure (bar)', 'Note'],
            pRows,
            [36, 120, 140, CW - 296],
            y, 20
        );
        y += 8;

        /* Pressure Chart — shorter to match frontend subplot proportions */
        const presChartH = 88;    // matches renderPresChart 210px canvas height
        if (pressureChartBuf) {
            y = guard(doc, run, y, presChartH + 30, pc, totalPages);
            y = sectionLabel(doc, '5.  Pressure Trend Chart', y);
            y += 5;
            doc.image(pressureChartBuf, ML, y, { width: CW, height: presChartH });
            y += presChartH + 10;
        } else {
            y = guard(doc, run, y, 40, pc, totalPages);
            y = sectionLabel(doc, '5.  Pressure Trend Chart', y);
            y += 8;
            doc.font('Helvetica').fontSize(8).fillColor(C.muted)
                .text('No pressure data available to render chart.', ML + 8, y);
            y += 20;
        }

        /* Operator Notes */
        if (run.notes && run.notes.trim()) {
            y = guard(doc, run, y, 60, pc, totalPages);
            y = sectionLabel(doc, '6.  Operator Notes', y);
            fillRect(doc, ML, y, CW, 1, C.light);   // spacer
            y += 6;
            doc.font('Helvetica').fontSize(8.5).fillColor(C.black)
                .text(run.notes.trim(), ML + 8, y, { width: CW - 16 });
            y = doc.y + 10;
            hRule(doc, y, C.navy, 0.7);
            y += 10;
        }

        /* ════════════════════════════════════════════
           PHOTOS  —  user-adjustable size
        ════════════════════════════════════════════ */

        const images = run.images || [];

        if (images.length > 0) {

            y = guard(doc, run, y, 60, pc, totalPages);
            y = sectionLabel(doc, `7.  Uploaded Images  (${images.length} photo${images.length !== 1 ? 's' : ''} · size: ${globalSizeKey})`, y, true);
            y += 8;

            /* Photo size legend */
            doc.font('Helvetica').fontSize(7).fillColor(C.muted)
                .text(
                    'Photo size can be adjusted via query parameter:  ?photoSize=small  |  medium  |  large',
                    ML, y, { width: CW }
                );
            y += 14;

            let col = 0;
            let rowStartY = y;

            for (let idx = 0; idx < images.length; idx++) {
                const img       = images[idx];
                // Per-image size override
                const sizeKey   = ['small', 'medium', 'large'].includes(img.size)
                                  ? img.size
                                  : globalSizeKey;
                const photoSize = PHOTO_SIZES[sizeKey];
                const cols      = photoSize.cols;
                const thumbH    = photoSize.h;
                const gutter    = 10;
                const thumbW    = (CW - gutter * (cols - 1)) / cols;

                // If col count changed mid-layout (per-image size differs), reset columns
                if (col >= cols) {
                    col = 0;
                    y  = rowStartY + thumbH + 22;
                    rowStartY = y;
                }

                /* Overflow check */
                if (col === 0) {
                    y = guard(doc, run, rowStartY, thumbH + 30, pc, totalPages);
                    if (pc.n > 1 && y < 60) {   // freshly added page
                        y = sectionLabel(doc, `7.  Images (continued)`, y, true);
                        y += 8;
                    }
                    rowStartY = y;
                }

                const x = ML + col * (thumbW + gutter);

                /* Image frame */
                fillRect(doc, x, rowStartY, thumbW, thumbH, '#F0EEE8');
                strokeRect(doc, x, rowStartY, thumbW, thumbH, C.navy, 0.5);

                const imgPath = path.join(__dirname, '..', img.path);
                if (fs.existsSync(imgPath)) {
                    doc.image(imgPath, x + 2, rowStartY + 2, {
                        fit:   [thumbW - 4, thumbH - 4],
                        align: 'center',
                        valign:'center',
                    });
                } else {
                    doc.font('Helvetica').fontSize(7).fillColor(C.muted)
                        .text('Image not found', x + 4, rowStartY + thumbH / 2 - 4, {
                            width: thumbW - 8, align: 'center', lineBreak: false
                        });
                }

                /* Caption */
                const caption = img.caption?.trim() || `Image ${idx + 1}`;
                doc.font('Helvetica').fontSize(6.5).fillColor(C.muted)
                    .text(caption, x, rowStartY + thumbH + 3, {
                        width: thumbW, align: 'center', lineBreak: false
                    });

                col++;
                if (col >= cols) {
                    col = 0;
                    rowStartY += thumbH + 22;
                    y = rowStartY;
                }
            }

            // flush last row
            if (col !== 0) y = rowStartY + PHOTO_SIZES[globalSizeKey].h + 22;
        }

        /* ════════════════════════════════════════════
           FINAL PAGE FOOTER
        ════════════════════════════════════════════ */

        pageFooter(doc, run);

        // No cleanup needed anymore because we are not creating files.
        doc.end();

    } catch (err) {
        console.error('[reportRoutes] Error generating PDF:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;