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
    small:   { h: 80,  cols: 3, label: 'Small (3 per row)'    },
    medium:  { h: 150, cols: 2, label: 'Medium (2 per row)'   },
    large:   { h: 220, cols: 1, label: 'Large (full width)'   },
    xlarge:  { h: 300, cols: 1, label: 'X-Large (full width)' },
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
   COVER PAGE
═══════════════════════════════════════════════════════════════ */

function drawCoverPage(doc, run, photoSizeLabel) {

    /* ── Institutional header band ── */
    fillRect(doc, 0, 0, PW, 6, C.gold);
    fillRect(doc, 0, 6, PW, 110, C.navy);
    fillRect(doc, 0, 116, PW, 3, C.gold);


    const hcx = ML + 90;
    const hcw = CW - 180;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.gold)
        .text('DEFENCE RESEARCH AND DEVELOPMENT ORGANISATION', hcx, 18, { width: hcw, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(13).fillColor(C.white)
        .text('SOLID STATE PHYSICS LABORATORY (SSPL)', hcx, 34, { width: hcw, align: 'center' });
    doc.font('Helvetica').fontSize(8.5).fillColor('#A8C4E8')
        .text('Lucknow Road, Timarpur, Delhi – 110 054', hcx, 56, { width: hcw, align: 'center' });
    doc.font('Helvetica').fontSize(8).fillColor(C.gold)
        .text('SIC Lab  ·  Industrial Furnace Monitoring System', hcx, 70, { width: hcw, align: 'center' });

    // Thin divider below header
    fillRect(doc, ML, 126, CW, 0.5, C.mid);

    /* ── Document classification badge ── */
    const classY = 132;
    const classW = 120;
    fillRect(doc, (PW - classW) / 2, classY, classW, 16, C.danger);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.white)
        .text('CONFIDENTIAL', (PW - classW) / 2, classY + 4, { width: classW, align: 'center' });

    /* ── Report type label ── */
    doc.font('Helvetica').fontSize(9).fillColor(C.muted)
        .text('LABORATORY RUN REPORT', ML, 158, { width: CW, align: 'center' });

    /* ── Main report title ── */
    const typeLabel = run.materialType === 'carbide'
        ? 'Carbide Baking Process'
        : 'Source Powder Baking Process';
    doc.font('Helvetica-Bold').fontSize(22).fillColor(C.navy)
        .text(typeLabel, ML, 175, { width: CW, align: 'center' });

    // Title underline
    const titleUnderY = 205;
    fillRect(doc, (PW / 2) - 60, titleUnderY, 120, 2, C.gold);

    /* ── Subtitle / run description ── */
    doc.font('Helvetica').fontSize(10).fillColor(C.navyLt)
        .text(`Run ID: ${run.runId}  ·  ${run.operatorName}`, ML, 215, { width: CW, align: 'center' });

    /* ── Horizontal divider ── */
    hRule(doc, 234, C.mid, 0.5);

    /* ── Abstract / summary box ── */
    const absY = 242;
    fillRect(doc, ML, absY, CW, 12, C.navyMid);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.white)
        .text('ABSTRACT', ML + 8, absY + 2, { lineBreak: false });

    const absTextY = absY + 16;
    const statusStr = (run.status || 'unknown').replace('_', ' ');
    const durStr    = run.durationMinutes ? `${run.durationMinutes} min` : 'not recorded';
    const matStr    = run.materialType === 'carbide' ? 'carbide' : 'source powder';
    const dateStr   = new Date(run.dateTime).toLocaleString('en-GB', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const absText =
        `This report documents the industrial baking run (${run.runId}) conducted on ${dateStr} ` +
        `at SSPL SIC Lab. The experiment processed ${matStr} ` +
        `material over a duration of ${durStr} and was recorded with status: ${statusStr.toUpperCase()}. ` +
        `The report includes phase-wise thermal and pressure profiles across Pre-Growth, Growth, ` +
        `and Post-Growth stages, trend charts, and photographic documentation.`;

    fillRect(doc, ML, absTextY, CW, 72, '#F9F9F6');
    strokeRect(doc, ML, absTextY, CW, 72, C.mid, 0.4);
    doc.font('Helvetica').fontSize(8.5).fillColor(C.black)
        .text(absText, ML + 8, absTextY + 8, { width: CW - 16, lineBreak: true, align: 'justify' });

    /* ── Key facts strip ── */
    const factsY = absTextY + 76;
    const facts  = [
        { label: 'Run ID',         value: run.runId },
        { label: 'Material',       value: matStr.charAt(0).toUpperCase() + matStr.slice(1) },
        { label: 'Status',         value: statusStr.toUpperCase() },
        { label: 'Duration',       value: durStr },
        { label: 'Date',           value: new Date(run.dateTime).toLocaleDateString('en-GB') },
        { label: 'Operator',       value: '' },
    ];
    const fw = CW / facts.length;
    fillRect(doc, ML, factsY, CW, 36, C.light);
    strokeRect(doc, ML, factsY, CW, 36, C.mid, 0.4);
    facts.forEach((f, i) => {
        const fx = ML + i * fw;
        if (i > 0) vLine(doc, fx, factsY, factsY + 36, C.mid, 0.4);
        doc.font('Helvetica').fontSize(7).fillColor(C.muted)
            .text(f.label.toUpperCase(), fx + 5, factsY + 5, { width: fw - 10, align: 'center' });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.navy)
            .text(String(f.value), fx + 5, factsY + 17, { width: fw - 10, align: 'center', lineBreak: false });
    });

    /* ── Table of Contents ── */
    const tocY = factsY + 48;
    fillRect(doc, ML, tocY, CW, 12, C.navyMid);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.white)
        .text('TABLE OF CONTENTS', ML + 8, tocY + 2, { lineBreak: false });

    const tocItems = [
        { n: '1', title: 'Run Summary & Experimental Parameters' },
        { n: '2', title: 'Pre-Growth Phase Profile' },
        { n: '3', title: 'Growth Phase Profile' },
        { n: '4', title: 'Post-Growth Phase Profile' },
        { n: '5', title: 'Temperature Trend Analysis' },
        { n: '6', title: 'Pressure Trend Analysis' },
        { n: '7', title: 'Operator Notes & Observations' },
        { n: '8', title: 'Photographic Documentation' },
    ];
    let ty = tocY + 14;
    fillRect(doc, ML, ty, CW, tocItems.length * 14, C.white);
    strokeRect(doc, ML, ty, CW, tocItems.length * 14, C.mid, 0.3);
    tocItems.forEach((item, i) => {
        const bg = i % 2 === 0 ? C.white : C.row2;
        fillRect(doc, ML, ty, CW, 14, bg);
        doc.font('Helvetica-Bold').fontSize(8).fillColor(C.navy)
            .text(item.n + '.', ML + 8, ty + 3, { width: 16, lineBreak: false });
        doc.font('Helvetica').fontSize(8).fillColor(C.black)
            .text(item.title, ML + 26, ty + 3, { width: CW - 40, lineBreak: false });
        const dotsX = ML + CW - 30;
        doc.font('Helvetica').fontSize(8).fillColor(C.muted)
            .text('· · ·', dotsX, ty + 3, { width: 26, align: 'right', lineBreak: false });
        ty += 14;
    });
    hRule(doc, ty, C.navy, 0.6);

    /* ── Photo size note ── */
    const noteY = ty + 8;
    doc.font('Helvetica').fontSize(7).fillColor(C.muted)
        .text(
            `Photo size in this report: ${(PHOTO_SIZES[photoSizeLabel] || PHOTO_SIZES.medium).label}  ` +
            `  ·  Adjust via query param: ?photoSize=small | medium | large | xlarge`,
            ML, noteY, { width: CW, align: 'center' }
        );

    /* ── Bottom institutional footer ── */
    fillRect(doc, 0, PH - 42, PW, 3, C.gold);
    fillRect(doc, 0, PH - 39, PW, 39, C.navy);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.white)
        .text('DRDO – SSPL  ·  SIC Lab', ML, PH - 30, { width: CW, align: 'center' });
    doc.font('Helvetica').fontSize(6.5).fillColor('#A8C4E8')
        .text(
            'This document is the property of DRDO and must not be reproduced or distributed without written authorisation.',
            ML, PH - 18, { width: CW, align: 'center' }
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

    // Organisation line (no emblem — starts at left margin)
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.gold)
        .text('SSPL · SIC Lab', ML, 10, { lineBreak: false });
    doc.font('Helvetica').fontSize(7).fillColor('#A8C4E8')
        .text('Industrial Run Report', ML, 22, { lineBreak: false });

    // Centre: run id + type
    const typeLabel = run.materialType === 'carbide' ? 'Carbide Baking' : 'Source Powder Baking';
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.white)
        .text(`Run ID: ${run.runId}  ·  ${typeLabel}`, ML + 90, 12, {
            width: CW - 180, align: 'center', lineBreak: false
        });

    // Right: page number + date
    doc.font('Helvetica').fontSize(7.5).fillColor('#A8C4E8')
        .text(`Page ${pageNum}${totalPages ? ' / ' + totalPages : ''}`, 0, 10, {
            align: 'right', width: PW - MR, lineBreak: false
        });
    const dateStr = new Date(run.dateTime).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
    doc.font('Helvetica').fontSize(7).fillColor('#A8C4E8')
        .text(dateStr, 0, 22, { align: 'right', width: PW - MR, lineBreak: false });

    return BH + 10;
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
                font: { size: 13, weight: '700' },
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
            font: { size: 11 },
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
            font: { size: 11, weight: '600' },
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
            font: { size: 11 },
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
        font: { size: 11, weight: '700' },
        backgroundColor: '#FDECEA99', borderRadius: 4,
        borderColor: CC.growth + '44', borderWidth: 1, padding: { x: 5, y: 3 },
    };
    out.gEnd = {
        type: 'label', xValue: geEnd, yValue: ge.temp,
        content: ['Growth terminated'], yAdjust: 22, color: CC.growth,
        font: { size: 11, weight: '700' },
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
            font: { size: 11, weight: '600' },
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

    const canvas = new ChartJSNodeCanvas({ width: 1600, height: 640, backgroundColour: CC.bg });

    return canvas.renderToBuffer({
        type: 'line',
        data: { datasets },
        options: {
            responsive: false, animation: false,
            layout: { padding: { right: 36, left: 8, top: 70, bottom: 8 } },
            plugins: {
                legend: { display: false },
                annotation: { annotations },
            },
            scales: {
                x: {
                    type: 'linear', min: 0, max: xMax,
                    title: { display: false },
                    grid: { color: CC.grid, lineWidth: 1 },
                    ticks: { display: false },
                },
                y: {
                    min: 0,
                    title: {
                        display: true, text: 'Temperature (\u00b0C)',
                        color: CC.muted, font: { size: 14, weight: '600' },
                    },
                    ticks: {
                        color: CC.muted, font: { size: 12 },
                        callback: v => v + '\u00b0C', maxTicksLimit: 8,
                    },
                    grid: { color: CC.grid, lineWidth: 1 },
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

    const canvas = new ChartJSNodeCanvas({ width: 1600, height: 360, backgroundColour: CC.bg });

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
            layout: { padding: { right: 36, left: 8, top: 16, bottom: 8 } },
            plugins: {
                legend: { display: false },
                annotation: { annotations },
            },
            scales: {
                x: {
                    type: 'linear', min: 0, max: xMax,
                    title: {
                        display: true, text: timeUnit.label,
                        color: CC.muted, font: { size: 14, weight: '600' },
                    },
                    grid: { color: CC.grid, lineWidth: 1 },
                    ticks: { color: CC.muted, font: { size: 12 }, maxTicksLimit: 12 },
                },
                y: {
                    min: 0,
                    title: {
                        display: true, text: 'Pressure (torr)',
                        color: CC.pres, font: { size: 14, weight: '600' },
                    },
                    ticks: { color: CC.pres, font: { size: 12 }, maxTicksLimit: 7 },
                    grid: { color: CC.grid, lineWidth: 1 },
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
    // Footer removed per user request
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
           PAGE 2 — SECTION 1: RUN SUMMARY & EXPERIMENTAL PARAMETERS
        ════════════════════════════════════════════ */

        let y = newPage(doc, run, pc, totalPages);

        /* ── Status banner ── */
        const sc = statusColor(run.status);
        fillRect(doc, ML, y, CW, 22, sc + '18');
        fillRect(doc, ML, y, 4, 22, sc);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(sc)
            .text(`RUN STATUS:  ${(run.status || '').toUpperCase().replace('_', ' ')}`, ML + 12, y + 7, { lineBreak: false });
        const generatedStr = `Report generated: ${new Date().toLocaleString('en-GB')}`;
        doc.font('Helvetica').fontSize(7.5).fillColor(C.muted)
            .text(generatedStr, ML, y + 8, { width: CW - 10, align: 'right', lineBreak: false });
        y += 30;

        /* ── Section 1: Experimental Parameters ── */
        y = sectionLabel(doc, '1.  Run Summary & Experimental Parameters', y);
        y = kvGrid(doc, [
            { label: 'Run ID',              value: run.runId },
            { label: 'Operator Name',       value: '' },
            { label: 'Material Type',       value: run.materialType === 'carbide' ? 'Carbide' : 'Source Powder' },
            { label: 'Run Status',          value: (run.status || '').replace('_', ' ').toUpperCase() },
            { label: 'Duration',            value: run.durationMinutes ? `${run.durationMinutes} min` : '—' },
            { label: 'Date & Time',         value: new Date(run.dateTime).toLocaleString('en-GB') },
            { label: 'Pre-Growth Steps',    value: (run.preGrowth  || []).length },
            { label: 'Growth Steps',        value: (run.growth     || []).length },
            { label: 'Post-Growth Steps',   value: (run.postGrowth || []).length },
            { label: 'Temperature Points',  value: tempLogs.length },
            { label: 'Pressure Points',     value: pressureLogs.length },
            { label: 'Images Attached',     value: (run.images || []).length },
        ], y, 3);
        y += 12;

        /* ── Helper: draw one phase table ── */
        function drawPhaseTable(title, steps, secNum) {
            if (!steps || !steps.length) return;
            y = guard(doc, run, y, 60, pc, totalPages);
            y = sectionLabel(doc, `${secNum}.  ${title}`, y);
            y += 4;

            // Introductory italic note
            doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(C.muted)
                .text(`Table ${secNum - 1}. ${title} — step-by-step thermal and pressure parameters.`, ML + 4, y);
            y += 12;

            const phRows = steps.map((s, i) => [
                i + 1,
                s.temp     != null ? `${s.temp} °C`        : '—',
                s.rampRate != null ? `${s.rampRate} °C/min` : '—',
                s.hold && s.hold.value != null ? `${s.hold.value} ${s.hold.unit || 'min'}` : '—',
                s.pressure != null ? `${s.pressure} torr`  : '—',
                s.remarks  || '—',
            ]);
            y = compactTable(doc,
                ['Step', 'Temp (°C)', 'Ramp Rate', 'Hold', 'Pressure (torr)', 'Remarks'],
                phRows,
                [34, 70, 74, 60, 90, CW - 328],
                y, 30
            );
            y += 10;
        }

        drawPhaseTable('Pre-Growth Phase Profile',  run.preGrowth  || [], 2);
        drawPhaseTable('Growth Phase Profile',      run.growth     || [], 3);
        drawPhaseTable('Post-Growth Phase Profile', run.postGrowth || [], 4);

        /* ════════════════════════════════════════════
           SECTION 5: TEMPERATURE TREND ANALYSIS
        ════════════════════════════════════════════ */

        y = guard(doc, run, y, 280, pc, totalPages);
        y = sectionLabel(doc, '5.  Temperature Trend Analysis', y);
        y += 6;

        /* Introductory text — scientific style */
        doc.font('Helvetica').fontSize(8.5).fillColor(C.black)
            .text(
                'The figure below presents the temperature profile recorded across all three phases of the run. ' +
                'Each phase is colour-coded (blue: Pre-Growth, orange: Growth, green: Post-Growth). ' +
                'Ramp rates (°C/min) and hold durations are annotated on the chart.',
                ML + 4, y, { width: CW - 8, align: 'justify' }
            );
        y = doc.y + 10;

        const tempChartH = 230;
        if (tempChartBuf) {
            y = guard(doc, run, y, tempChartH + 22, pc, totalPages);
            // Figure border
            strokeRect(doc, ML, y, CW, tempChartH + 2, C.mid, 0.4);
            doc.image(tempChartBuf, ML + 1, y + 1, { width: CW - 2, height: tempChartH });
            y += tempChartH + 6;
            // Scientific figure caption
            doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(C.muted)
                .text(
                    `Figure 1. Temperature (°C) vs. Time profile for Run ${run.runId}. ` +
                    `Segments represent Pre-Growth (blue), Growth (orange), and Post-Growth (green) phases. ` +
                    `Annotations show set-point temperatures, ramp rates, and hold durations.`,
                    ML + 4, y, { width: CW - 8, align: 'justify' }
                );
            y = doc.y + 14;
        } else {
            fillRect(doc, ML, y, CW, 32, C.row2);
            strokeRect(doc, ML, y, CW, 32, C.mid, 0.3);
            doc.font('Helvetica').fontSize(8).fillColor(C.muted)
                .text('No temperature profile available — phase steps contain no temperature data.', ML + 8, y + 11, { width: CW - 16, align: 'center' });
            y += 40;
        }

        // Condensed data table of key points
        if (tempLogs.length > 0) {
            y = guard(doc, run, y, 60, pc, totalPages);
            doc.font('Helvetica').fontSize(7.5).fillColor(C.muted)
                .text('Table 4. Key temperature data points derived from phase step profiles.', ML + 4, y);
            y += 10;
            const tRows = tempLogs.map((t, i) => [i + 1, `${t.time} min`, `${t.value} °C`]);
            y = compactTable(doc,
                ['#', 'Time (min)', 'Temperature (°C)'],
                tRows, [36, 120, CW - 156], y, 15
            );
            y += 8;
        }

        /* ════════════════════════════════════════════
           SECTION 6: PRESSURE TREND ANALYSIS
        ════════════════════════════════════════════ */

        y = guard(doc, run, y, 220, pc, totalPages);
        y = sectionLabel(doc, '6.  Pressure Trend Analysis', y);
        y += 6;

        doc.font('Helvetica').fontSize(8.5).fillColor(C.black)
            .text(
                'The figure below shows the chamber pressure profile (torr) as a stepped function ' +
                'across the run timeline. Pressure set-points are held constant within each step. ' +
                'Phase boundaries are indicated by shaded background regions.',
                ML + 4, y, { width: CW - 8, align: 'justify' }
            );
        y = doc.y + 10;

        const presChartH = 160;
        if (pressureChartBuf) {
            y = guard(doc, run, y, presChartH + 22, pc, totalPages);
            strokeRect(doc, ML, y, CW, presChartH + 2, C.mid, 0.4);
            doc.image(pressureChartBuf, ML + 1, y + 1, { width: CW - 2, height: presChartH });
            y += presChartH + 6;
            doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(C.muted)
                .text(
                    `Figure 2. Chamber pressure (torr) vs. Time profile for Run ${run.runId}. ` +
                    `Stepped line represents discrete pressure set-points. Phase regions are colour-coded.`,
                    ML + 4, y, { width: CW - 8, align: 'justify' }
                );
            y = doc.y + 14;
        } else {
            fillRect(doc, ML, y, CW, 32, C.row2);
            strokeRect(doc, ML, y, CW, 32, C.mid, 0.3);
            doc.font('Helvetica').fontSize(8).fillColor(C.muted)
                .text('No pressure profile available — no pressure values recorded in phase steps.', ML + 8, y + 11, { width: CW - 16, align: 'center' });
            y += 40;
        }

        if (pressureLogs.length > 0) {
            y = guard(doc, run, y, 60, pc, totalPages);
            doc.font('Helvetica').fontSize(7.5).fillColor(C.muted)
                .text('Table 5. Key pressure data points derived from phase step profiles.', ML + 4, y);
            y += 10;
            const pRows = pressureLogs.map((p, i) => [i + 1, `${p.time} min`, `${p.value} torr`]);
            y = compactTable(doc,
                ['#', 'Time (min)', 'Pressure (torr)'],
                pRows, [36, 120, CW - 156], y, 15
            );
            y += 8;
        }

        /* ════════════════════════════════════════════
           SECTION 7: OPERATOR NOTES & OBSERVATIONS
        ════════════════════════════════════════════ */

        if (run.notes && run.notes.trim()) {
            y = guard(doc, run, y, 80, pc, totalPages);
            y = sectionLabel(doc, '7.  Operator Notes & Observations', y);
            y += 6;
            doc.font('Helvetica').fontSize(8.5).fillColor(C.muted)
                .text('The following observations were recorded by the operator during or after the run:', ML + 4, y);
            y += 12;
            fillRect(doc, ML, y, CW, 6, C.white);
            fillRect(doc, ML, y, 3, 999, C.gold);   // left accent — will be clipped by text
            doc.font('Helvetica').fontSize(9).fillColor(C.black)
                .text(run.notes.trim(), ML + 12, y, { width: CW - 16, align: 'justify' });
            y = doc.y + 6;
            // Vertical gold bar (proper height now known)
            fillRect(doc, ML, y - (doc.y - y + 6) + 6, 3, doc.y - y + 6, C.gold);
            hRule(doc, y + 4, C.navy, 0.7);
            y += 14;
        }

        /* ════════════════════════════════════════════
           SECTION 8: PHOTOGRAPHIC DOCUMENTATION
        ════════════════════════════════════════════ */

        const images = run.images || [];

        if (images.length > 0) {

            y = guard(doc, run, y, 70, pc, totalPages);
            y = sectionLabel(doc, `8.  Photographic Documentation  (${images.length} image${images.length !== 1 ? 's' : ''})`, y, true);
            y += 6;

            doc.font('Helvetica').fontSize(8).fillColor(C.black)
                .text(
                    `The following images were captured and submitted with this run record. ` +
                    `Current display size: ${(PHOTO_SIZES[globalSizeKey] || PHOTO_SIZES.medium).label}. ` +
                    `To change image size, append ?photoSize=small | medium | large | xlarge to the report URL.`,
                    ML + 4, y, { width: CW - 8 }
                );
            y = doc.y + 10;

            let figNum    = 3;   // Figures 1 & 2 are charts above
            let col       = 0;
            let rowStartY = y;

            for (let idx = 0; idx < images.length; idx++) {
                const img     = images[idx];
                const sizeKey = Object.keys(PHOTO_SIZES).includes(img.size) ? img.size : globalSizeKey;
                const pSize   = PHOTO_SIZES[sizeKey];
                const cols    = pSize.cols;
                const thumbH  = pSize.h;
                const gutter  = 10;
                const thumbW  = (CW - gutter * (cols - 1)) / cols;
                const captionH = 22;   // space below image for figure caption

                if (col >= cols) { col = 0; rowStartY += thumbH + captionH + 8; y = rowStartY; }

                if (col === 0) {
                    y = guard(doc, run, rowStartY, thumbH + captionH + 10, pc, totalPages);
                    if (y < rowStartY - 5) {
                        // new page was added — re-draw section label continuation
                        y = sectionLabel(doc, '8.  Photographic Documentation (continued)', y, true);
                        y += 6;
                    }
                    rowStartY = y;
                }

                const x = ML + col * (thumbW + gutter);

                /* Light-grey image frame */
                fillRect(doc, x, rowStartY, thumbW, thumbH, '#F4F3EF');
                strokeRect(doc, x, rowStartY, thumbW, thumbH, C.mid, 0.5);

                /* Image or placeholder */
                const imgPath = path.join(__dirname, '..', img.path);
                if (fs.existsSync(imgPath)) {
                    doc.image(imgPath, x + 2, rowStartY + 2, {
                        fit:    [thumbW - 4, thumbH - 4],
                        align:  'center',
                        valign: 'center',
                    });
                } else {
                    doc.font('Helvetica').fontSize(7).fillColor(C.muted)
                        .text('Image not found', x + 4, rowStartY + thumbH / 2 - 6, {
                            width: thumbW - 8, align: 'center',
                        });
                }

                /* Figure number badge */
                fillRect(doc, x + 3, rowStartY + 3, 36, 11, C.navy + 'CC');
                doc.font('Helvetica-Bold').fontSize(6.5).fillColor(C.white)
                    .text(`Fig. ${figNum}`, x + 5, rowStartY + 5, { width: 32, lineBreak: false });

                /* Scientific figure caption below image */
                const caption = img.caption?.trim() || `Experimental image ${idx + 1} from Run ${run.runId}`;
                doc.font('Helvetica-Oblique').fontSize(7).fillColor(C.muted)
                    .text(`Figure ${figNum}. ${caption}`, x, rowStartY + thumbH + 4, {
                        width: thumbW, align: 'center',
                    });

                figNum++;
                col++;
                if (col >= cols) {
                    col = 0;
                    rowStartY += thumbH + captionH + 8;
                    y = rowStartY;
                }
            }
            if (col !== 0) y = rowStartY + PHOTO_SIZES[globalSizeKey].h + 30;
        }

        /* ════════════════════════════════════════════
           FINAL PAGE FOOTER
        ════════════════════════════════════════════ */

        pageFooter(doc, run);
        doc.end();

    } catch (err) {
        console.error('[reportRoutes] Error generating PDF:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;