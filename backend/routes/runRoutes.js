
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');

const Run = require('../models/Run');

/* ── ensure uploads folder exists ─────────────────────────── */
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

/* ── multer config ────────────────────────────────────────── */
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

/* ── SAFE JSON PARSER ─────────────────────────────────────── */
const safeParse = (data, fallback = []) => {
    try {
        return typeof data === 'string' ? JSON.parse(data) : data || fallback;
    } catch (e) {
        return fallback;
    }
};

/* ── CREATE RUN ───────────────────────────────────────────── */
router.post('/', upload.array('images', 10), async (req, res) => {

    try {

        /* parse captions sent from frontend */
        const imageCaptions = safeParse(req.body.imageCaptions);

        /* map images with their own captions */
        const images = (req.files || []).map((file, index) => ({
            path: `/uploads/${file.filename}`,
            caption: imageCaptions[index] || ''
        }));

        const run = new Run({

            runId: req.body.runId,
            operatorName: req.body.operatorName,
            materialType: req.body.materialType,
            dateTime: req.body.dateTime,
            durationMinutes: req.body.durationMinutes,
            status: req.body.status,
            notes: req.body.notes,

            /* ── phase profiles ── */
            preGrowth:  safeParse(req.body.preGrowth),
            growth:     safeParse(req.body.growth),
            postGrowth: safeParse(req.body.postGrowth),

            images
        });

        await run.save();

        res.status(201).json({
            success: true,
            data: run
        });

    } catch (error) {
        console.log("CREATE RUN ERROR:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const deletedRun = await Run.findByIdAndDelete(req.params.id);

        if (!deletedRun) {
            return res.status(404).json({
                message: "Run not found",
            });
        }

        res.json({
            message: "Run deleted successfully",
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Server Error",
        });
    }
});


/* ── GET ALL RUNS ─────────────────────────────────────────── */
router.get('/', async (req, res) => {

    try {

        const runs = await Run.find().sort({ createdAt: -1 });

        res.json({
            success: true,
            data: runs
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

});

/* ── STATS ────────────────────────────────────────────────── */
router.get('/stats/summary', async (req, res) => {

    try {

        const runs = await Run.find();

        const total = runs.length;
        const carbide = runs.filter(r => r.materialType === 'carbide').length;
        const sourcePowder = runs.filter(r => r.materialType === 'source_powder').length;

        /* aggregate temps and pressures across all phase rows */
        let tempSum = 0, tempCount = 0;
        let pressureSum = 0, pressureCount = 0;

        const phases = ['preGrowth', 'growth', 'postGrowth'];

        runs.forEach(run => {
            phases.forEach(phase => {
                (run[phase] || []).forEach(step => {
                    if (step.temp != null) { tempSum += step.temp; tempCount++; }
                    if (step.pressure != null) { pressureSum += step.pressure; pressureCount++; }
                });
            });
        });

        const avgTemp     = tempCount     ? (tempSum / tempCount).toFixed(1)         : 0;
        const avgPressure = pressureCount ? (pressureSum / pressureCount).toFixed(1) : 0;

        res.json({
            success: true,
            data: {
                total,
                carbide,
                sourcePowder,
                avgTemp,
                avgPressure
            }
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

});

/* ── GET SINGLE RUN ───────────────────────────────────────── */
router.get('/:id', async (req, res) => {

    try {

        const run = await Run.findById(req.params.id);

        res.json(run);

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

});

/* ── UPDATE RUN ───────────────────────────────────────────── */
router.put('/:id', async (req, res) => {

    try {

        const updatedRun = await Run.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        res.json(updatedRun);

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

});

module.exports = router;
