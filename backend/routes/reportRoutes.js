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
const Run                = require('../models/Run');

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
   SPARKLINE CHART
═══════════════════════════════════════════════════════════════ */

async function sparkChart({ labels, data, label, borderColor, bgColor }) {
    const canvas = new ChartJSNodeCanvas({ width: 1060, height: 220, backgroundColour: '#FFFFFF' });
    const cfg = {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label, 
                data: data.map(v => Number(v) || 0), // Casts string numbers to true Numbers
                borderColor,
                backgroundColor: bgColor,
                borderWidth: 2.5, tension: 0.35,
                fill: true, pointRadius: 3,
            }]
        },
        options: {
            responsive: false, animation: false,
            plugins: {
                legend: { display: true, position: 'top', labels: { font: { size: 11 } } }
            },
            scales: {
                x: { title: { display: true, text: 'Time (min)', font: { size: 10 } }, ticks: { font: { size: 9 } } },
                y: { title: { display: true, text: label,        font: { size: 10 } }, ticks: { font: { size: 9 } } },
            }
        }
    };
    
    // Renders output directly to a Buffer in memory
    return await canvas.renderToBuffer(cfg);
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

        /* ── Pre-render charts ── */
        const tempLogs     = run.temperatureLogs || [];
        const pressureLogs = run.pressureLogs    || [];

        // Now generates buffers directly without saving files
        const [tempChartBuf, pressureChartBuf] = await Promise.all([
            sparkChart({
                labels: tempLogs.map(t => t.time),
                data:   tempLogs.map(t => t.value),
                label:  'Temperature (°C)',
                borderColor: '#C8922A', bgColor: 'rgba(200,146,42,0.13)'
            }),
            sparkChart({
                labels: pressureLogs.map(p => p.time),
                data:   pressureLogs.map(p => p.value),
                label:  'Pressure (bar)',
                borderColor: '#1A6B45', bgColor: 'rgba(26,107,69,0.13)'
            }),
        ]);

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

        /* Temperature Chart */
        y = guard(doc, run, y, 130, pc, totalPages);
        y = sectionLabel(doc, '3.  Temperature Trend Chart', y);
        y += 5;
        const chartH = 115;
        // Inject memory buffer instead of file path
        doc.image(tempChartBuf, ML, y, { width: CW, height: chartH });
        y += chartH + 6;

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

        /* Pressure Chart */
        y = guard(doc, run, y, 130, pc, totalPages);
        y = sectionLabel(doc, '5.  Pressure Trend Chart', y);
        y += 5;
        // Inject memory buffer instead of file path
        doc.image(pressureChartBuf, ML, y, { width: CW, height: chartH });
        y += chartH + 10;

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