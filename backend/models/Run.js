const mongoose = require('mongoose');

/* ── reusable phase step sub-schema ──────────────────────── */
const PhaseStepSchema = new mongoose.Schema({
    temp:     { type: Number, default: null },   // °C
    rampRate: { type: Number, default: null },   // °C/min
    hold: {
        value: { type: Number, default: null },
        unit:  { type: String, enum: ['min', 'hr', 'day'], default: 'min' }
    },
    pressure: { type: Number, default: null },   // bar
    remarks:  { type: String, default: '' }
}, { _id: false });

/* ── main run schema ─────────────────────────────────────── */
const RunSchema = new mongoose.Schema({

    runId:           { type: String, required: true, unique: true },
    operatorName:    { type: String, required: true },
    materialType:    { type: String, enum: ['carbide', 'source_powder'], default: 'carbide' },
    dateTime:        { type: Date,   default: Date.now },
    durationMinutes: { type: Number },
    status:          { type: String, enum: ['completed', 'in_progress', 'failed'], default: 'completed' },
    notes:           { type: String, default: '' },

    /* ── phase profiles ── */
    preGrowth:  { type: [PhaseStepSchema], default: [] },
    growth:     { type: [PhaseStepSchema], default: [] },
    postGrowth: { type: [PhaseStepSchema], default: [] },

    /* ── images ── */
    images: [{
        path:    { type: String },
        caption: { type: String, default: '' }
    }]

}, { timestamps: true });

module.exports = mongoose.model('Run', RunSchema);
