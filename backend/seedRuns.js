/**
 * seed.js  —  Industrial Run Data Seed
 * Usage: node seed.js
 *
 * Populates the Run collection with realistic carbide sintering
 * and source-powder CVD run profiles covering a mix of statuses,
 * material types, and multi-phase temperature / pressure programs.
 */

'use strict';

const mongoose = require('mongoose');
const Run      = require('./models/Run'); // adjust path as needed

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/baking_logs';

/* ══════════════════════════════════════════════════════════════
   SEED DATA
══════════════════════════════════════════════════════════════ */
const runs = [

    /* ────────────────────────────────────────────────────────
       RUN 001  |  Carbide  |  Completed
       Standard WC-Co sintering cycle with dewax + sinter
    ──────────────────────────────────────────────────────── */
    {
        runId:        'RUN-2024-001',
        operatorName: 'Arjun Mehta',
        materialType: 'carbide',
        dateTime:     new Date('2024-03-04T06:00:00Z'),
        status:       'completed',
        notes:        'Standard WC-Co (94/6) grade. Dewax stage held slightly longer due to high binder content in batch.',

        preGrowth: [
            { temp: 150,  rampRate: 3,   hold: { value: 30,  unit: 'min' }, pressure: null,  remarks: 'Moisture outgassing stage' },
            { temp: 350,  rampRate: 2,   hold: { value: 45,  unit: 'min' }, pressure: null,  remarks: 'Wax burn-off; slight CO peak observed on analyzer' },
            { temp: 600,  rampRate: 3,   hold: { value: 20,  unit: 'min' }, pressure: null,  remarks: 'Debind complete; atmosphere switched to H₂' },
            { temp: 900,  rampRate: 5,   hold: { value: 15,  unit: 'min' }, pressure: 50,    remarks: 'Pre-sinter neck formation check' },
        ],

        growth: [
            { temp: 1350, rampRate: 4,   hold: { value: 60,  unit: 'min' }, pressure: 100,   remarks: 'Liquid phase sintering onset — hold critical for density' },
            { temp: 1410, rampRate: 2,   hold: { value: 90,  unit: 'min' }, pressure: 150,   remarks: 'Peak sinter; density target 14.85 g/cc' },
        ],

        postGrowth: [
            { temp: 1200, rampRate: 3,   hold: { value: 20,  unit: 'min' }, pressure: 100,   remarks: 'Controlled cool to avoid thermal shock' },
            { temp: 800,  rampRate: 5,   hold: { value: 10,  unit: 'min' }, pressure: 50,    remarks: null },
            { temp: 25,   rampRate: 10,  hold: { value: 0,   unit: 'min' }, pressure: null,  remarks: 'Free cool to ambient' },
        ],

        images: [
            { path: 'uploads/run001_pre.jpg',  caption: 'Green compact — pre-sinter' },
            { path: 'uploads/run001_post.jpg', caption: 'Sintered part — post-sinter' },
        ],
    },

    /* ────────────────────────────────────────────────────────
       RUN 002  |  Source Powder  |  Completed
       CVD graphene precursor activation — long growth phase
    ──────────────────────────────────────────────────────── */
    {
        runId:        'RUN-2024-002',
        operatorName: 'Priya Nair',
        materialType: 'source_powder',
        dateTime:     new Date('2024-03-11T22:00:00Z'),
        status:       'completed',
        notes:        'CH₄/H₂ = 1:4 ratio. Growth phase extended to 90 hr per protocol SP-07. Post-run Raman shows D/G < 0.08.',

        preGrowth: [
            { temp: 200,  rampRate: 5,   hold: { value: 20,  unit: 'min' }, pressure: 10,    remarks: 'Pump-down and leak check — base pressure < 5 mTorr' },
            { temp: 500,  rampRate: 3,   hold: { value: 30,  unit: 'min' }, pressure: 20,    remarks: 'Surface oxide reduction in H₂ atmosphere' },
            { temp: 900,  rampRate: 5,   hold: { value: 45,  unit: 'min' }, pressure: 40,    remarks: 'Cu foil anneal; grain boundary healing' },
            { temp: 1050, rampRate: 2,   hold: { value: 30,  unit: 'min' }, pressure: 40,    remarks: 'Thermal equilibration before CH₄ introduction' },
        ],

        growth: [
            { temp: 1050, rampRate: 0,   hold: { value: 90,  unit: 'hr'  }, pressure: 50,    remarks: 'Graphene nucleation and growth. CH₄ flow: 2 sccm. H₂ flow: 8 sccm.' },
        ],

        postGrowth: [
            { temp: 800,  rampRate: 15,  hold: { value: 5,   unit: 'min' }, pressure: 40,    remarks: 'Fast quench to freeze grain structure' },
            { temp: 400,  rampRate: 8,   hold: { value: 10,  unit: 'min' }, pressure: 20,    remarks: 'CH₄ purged; H₂ only' },
            { temp: 25,   rampRate: 5,   hold: { value: 0,   unit: 'min' }, pressure: null,  remarks: 'Vent to atmosphere; sample retrieved at < 50°C' },
        ],

        images: [
            { path: 'uploads/run002_raman.jpg',  caption: 'Raman spectrum — post growth' },
            { path: 'uploads/run002_sem.jpg',    caption: 'SEM surface morphology' },
        ],
    },

    /* ────────────────────────────────────────────────────────
       RUN 003  |  Carbide  |  Failed
       TiC coating run — failed due to pressure spike at peak
    ──────────────────────────────────────────────────────── */
    {
        runId:        'RUN-2024-003',
        operatorName: 'Vikram Rao',
        materialType: 'carbide',
        dateTime:     new Date('2024-03-18T08:30:00Z'),
        status:       'failed',
        notes:        'Pressure spike to 380 torr at 1480°C triggered auto-shutdown. Root cause: faulty inlet valve (V-07). Parts scrapped. Valve replaced.',

        preGrowth: [
            { temp: 200,  rampRate: 5,   hold: { value: 15,  unit: 'min' }, pressure: 30,    remarks: 'Pump-down nominal' },
            { temp: 700,  rampRate: 4,   hold: { value: 20,  unit: 'min' }, pressure: 50,    remarks: 'Pre-heat; no anomalies' },
            { temp: 1000, rampRate: 5,   hold: { value: 15,  unit: 'min' }, pressure: 80,    remarks: 'Pre-sinter dwell' },
        ],

        growth: [
            { temp: 1480, rampRate: 3,   hold: { value: 20,  unit: 'min' }, pressure: 120,   remarks: '⚠ Pressure spike at 18 min into hold — auto-shutdown triggered' },
        ],

        postGrowth: [
            { temp: 25,   rampRate: 15,  hold: { value: 0,   unit: 'min' }, pressure: null,  remarks: 'Emergency cool' },
        ],

        images: [
            { path: 'uploads/run003_alarm_log.jpg', caption: 'Alarm log screenshot at failure' },
        ],
    },

    /* ────────────────────────────────────────────────────────
       RUN 004  |  Source Powder  |  Completed
       MoS₂ synthesis — moderate temperature, multi-step growth
    ──────────────────────────────────────────────────────── */
    {
        runId:        'RUN-2024-004',
        operatorName: 'Deepa Krishnan',
        materialType: 'source_powder',
        dateTime:     new Date('2024-04-02T04:00:00Z'),
        status:       'completed',
        notes:        'MoS₂ monolayer target on SiO₂/Si substrate. S precursor: thiourea. Mo source: MoO₃ powder upstream. XPS confirmed S:Mo = 1.97.',

        preGrowth: [
            { temp: 100,  rampRate: 5,   hold: { value: 10,  unit: 'min' }, pressure: 5,     remarks: 'Ar purge — 3 cycles to clear residual O₂' },
            { temp: 300,  rampRate: 3,   hold: { value: 15,  unit: 'min' }, pressure: 10,    remarks: 'Thiourea source zone pre-heat' },
            { temp: 500,  rampRate: 4,   hold: { value: 20,  unit: 'min' }, pressure: 15,    remarks: 'MoO₃ zone stabilisation' },
        ],

        growth: [
            { temp: 750,  rampRate: 5,   hold: { value: 15,  unit: 'min' }, pressure: 20,    remarks: 'Nucleation burst — flow: 200 sccm Ar' },
            { temp: 800,  rampRate: 2,   hold: { value: 3,   unit: 'hr'  }, pressure: 25,    remarks: 'Lateral growth phase; triangle domains confirmed by optical' },
        ],

        postGrowth: [
            { temp: 600,  rampRate: 8,   hold: { value: 10,  unit: 'min' }, pressure: 15,    remarks: 'Fast cool; S partial pressure maintained to suppress vacancies' },
            { temp: 200,  rampRate: 5,   hold: { value: 5,   unit: 'min' }, pressure: null,  remarks: null },
            { temp: 25,   rampRate: 5,   hold: { value: 0,   unit: 'min' }, pressure: null,  remarks: 'Sample retrieved; stored in N₂ box' },
        ],

        images: [
            { path: 'uploads/run004_optical.jpg', caption: 'Optical image — MoS₂ triangular domains' },
            { path: 'uploads/run004_xps.jpg',     caption: 'XPS S 2p spectrum' },
        ],
    },

    /* ────────────────────────────────────────────────────────
       RUN 005  |  Carbide  |  Completed
       WC-Ni cermet — HIP post-sinter to close porosity
    ──────────────────────────────────────────────────────── */
    {
        runId:        'RUN-2024-005',
        operatorName: 'Arjun Mehta',
        materialType: 'carbide',
        dateTime:     new Date('2024-04-15T05:00:00Z'),
        status:       'completed',
        notes:        'WC-12Ni grade. Post-sinter HIP at 1350°C / 1000 bar Ar. Hardness HV30: 1410. Coercivity: 9.8 kA/m — within spec.',

        preGrowth: [
            { temp: 200,  rampRate: 3,   hold: { value: 30,  unit: 'min' }, pressure: null,  remarks: 'Organic burnoff — CO₂ atmosphere' },
            { temp: 450,  rampRate: 2,   hold: { value: 60,  unit: 'min' }, pressure: null,  remarks: 'Extended dewax; thick-section parts' },
            { temp: 800,  rampRate: 4,   hold: { value: 20,  unit: 'min' }, pressure: 30,    remarks: 'Pre-sinter in H₂; porosity 28% open' },
            { temp: 1100, rampRate: 4,   hold: { value: 30,  unit: 'min' }, pressure: 60,    remarks: 'Neck growth stage; shrinkage 8% recorded' },
        ],

        growth: [
            { temp: 1380, rampRate: 3,   hold: { value: 45,  unit: 'min' }, pressure: 120,   remarks: 'Liquid phase; Ni binder redistribution' },
            { temp: 1350, rampRate: 1,   hold: { value: 2,   unit: 'hr'  }, pressure: 1000,  remarks: 'HIP dwell — 1000 bar Ar; pore closure target < 0.1%' },
        ],

        postGrowth: [
            { temp: 1100, rampRate: 2,   hold: { value: 15,  unit: 'min' }, pressure: 500,   remarks: 'Pressure bleed-down phase' },
            { temp: 600,  rampRate: 5,   hold: { value: 10,  unit: 'min' }, pressure: 100,   remarks: null },
            { temp: 25,   rampRate: 8,   hold: { value: 0,   unit: 'min' }, pressure: null,  remarks: 'Unload after < 60°C confirmed' },
        ],

        images: [
            { path: 'uploads/run005_density.jpg',  caption: 'Archimedes density measurement log' },
            { path: 'uploads/run005_micro.jpg',    caption: 'Metallographic cross-section ×400' },
        ],
    },

    /* ────────────────────────────────────────────────────────
       RUN 006  |  Source Powder  |  In Progress
       hBN synthesis — very long growth (days)
    ──────────────────────────────────────────────────────── */
    {
        runId:        'RUN-2024-006',
        operatorName: 'Priya Nair',
        materialType: 'source_powder',
        dateTime:     new Date('2024-05-01T00:00:00Z'),
        status:       'in_progress',
        notes:        'Hexagonal boron nitride on Pt foil. Ammonia borane precursor. Target: 5–7 layer hBN for dielectric applications. Growth still ongoing.',

        preGrowth: [
            { temp: 150,  rampRate: 3,   hold: { value: 20,  unit: 'min' }, pressure: 8,     remarks: 'System leak check — achieved 3 mTorr base' },
            { temp: 400,  rampRate: 4,   hold: { value: 30,  unit: 'min' }, pressure: 15,    remarks: 'AB precursor sublimation zone preheat' },
            { temp: 700,  rampRate: 5,   hold: { value: 20,  unit: 'min' }, pressure: 20,    remarks: 'Pt foil anneal in H₂ — surface reconstruction' },
            { temp: 1000, rampRate: 3,   hold: { value: 30,  unit: 'min' }, pressure: 25,    remarks: 'Final equilibration; NH₃ + H₂ carrier introduced' },
        ],

        growth: [
            { temp: 1050, rampRate: 1,   hold: { value: 3,   unit: 'day' }, pressure: 30,    remarks: 'hBN multilayer growth — continuous monitoring every 12 hr' },
        ],

        postGrowth: [],   // not yet started

        images: [],
    },

    /* ────────────────────────────────────────────────────────
       RUN 007  |  Carbide  |  Completed
       TiCN/Al₂O₃ CVD coating on carbide inserts
    ──────────────────────────────────────────────────────── */
    {
        runId:        'RUN-2024-007',
        operatorName: 'Sanjay Pillai',
        materialType: 'carbide',
        dateTime:     new Date('2024-05-08T07:00:00Z'),
        status:       'completed',
        notes:        'MT-TiCN + κ-Al₂O₃ duplex coating. TiCN layer: 8 µm. Al₂O₃: 4 µm. TRS tested — avg 2450 MPa. Adhesion class HF1.',

        preGrowth: [
            { temp: 200,  rampRate: 5,   hold: { value: 15,  unit: 'min' }, pressure: 20,    remarks: 'Pump-down + N₂ purge' },
            { temp: 500,  rampRate: 4,   hold: { value: 20,  unit: 'min' }, pressure: 40,    remarks: 'HCl etch of substrate surface — 5 min active etch' },
            { temp: 850,  rampRate: 3,   hold: { value: 15,  unit: 'min' }, pressure: 60,    remarks: 'TiCl₄ introduction; nucleation layer' },
        ],

        growth: [
            { temp: 885,  rampRate: 1,   hold: { value: 4,   unit: 'hr'  }, pressure: 80,    remarks: 'MT-TiCN growth — TiCl₄:CH₃CN:H₂:N₂ = 2:1:80:17' },
            { temp: 1000, rampRate: 2,   hold: { value: 30,  unit: 'min' }, pressure: 80,    remarks: 'Transition zone + CO₂ introduction for Al₂O₃' },
            { temp: 1000, rampRate: 0,   hold: { value: 2,   unit: 'hr'  }, pressure: 80,    remarks: 'κ-Al₂O₃ deposition — CO₂:H₂:AlCl₃ = 4:96:0.3' },
        ],

        postGrowth: [
            { temp: 800,  rampRate: 3,   hold: { value: 10,  unit: 'min' }, pressure: 60,    remarks: 'Reactive gas purge with N₂' },
            { temp: 400,  rampRate: 5,   hold: { value: 10,  unit: 'min' }, pressure: 30,    remarks: null },
            { temp: 25,   rampRate: 8,   hold: { value: 0,   unit: 'min' }, pressure: null,  remarks: 'Retrieve inserts; 100% visual inspection' },
        ],

        images: [
            { path: 'uploads/run007_xsec.jpg',   caption: 'Cross-section SEM — TiCN + Al₂O₃ layers' },
            { path: 'uploads/run007_eds.jpg',    caption: 'EDS line scan across coating' },
        ],
    },

    /* ────────────────────────────────────────────────────────
       RUN 008  |  Source Powder  |  Completed
       WS₂ synthesis for lubrication coating R&D
    ──────────────────────────────────────────────────────── */
    {
        runId:        'RUN-2024-008',
        operatorName: 'Deepa Krishnan',
        materialType: 'source_powder',
        dateTime:     new Date('2024-05-20T03:00:00Z'),
        status:       'completed',
        notes:        'WS₂ few-layer on steel substrate for tribological testing. CoF measured: 0.04 (dry). Adhesion scratch test Lc2: 28 N.',

        preGrowth: [
            { temp: 100,  rampRate: 5,   hold: { value: 10,  unit: 'min' }, pressure: 5,     remarks: 'He leak test — 2 × 10⁻⁸ mbar·L/s achieved' },
            { temp: 300,  rampRate: 4,   hold: { value: 15,  unit: 'min' }, pressure: 10,    remarks: 'S powder zone heat; first S vapour detected' },
            { temp: 600,  rampRate: 5,   hold: { value: 15,  unit: 'min' }, pressure: 15,    remarks: 'WO₃ precursor active; Ar carrier 150 sccm' },
        ],

        growth: [
            { temp: 850,  rampRate: 3,   hold: { value: 20,  unit: 'min' }, pressure: 20,    remarks: 'Nucleation at 850°C; first layer visible optically' },
            { temp: 900,  rampRate: 2,   hold: { value: 2,   unit: 'hr'  }, pressure: 25,    remarks: 'Layer growth — target 5–10 layers confirmed by reflectance' },
        ],

        postGrowth: [
            { temp: 700,  rampRate: 10,  hold: { value: 5,   unit: 'min' }, pressure: 20,    remarks: 'S overpressure maintained during cool to suppress W-rich phases' },
            { temp: 300,  rampRate: 6,   hold: { value: 5,   unit: 'min' }, pressure: null,  remarks: null },
            { temp: 25,   rampRate: 5,   hold: { value: 0,   unit: 'min' }, pressure: null,  remarks: 'Retrieve in glove bag; air-sensitive sample' },
        ],

        images: [
            { path: 'uploads/run008_tем.jpg',      caption: 'TEM lattice image — 7-layer WS₂' },
            { path: 'uploads/run008_tribology.jpg', caption: 'CoF vs. cycles tribology curve' },
        ],
    },

];

/* ══════════════════════════════════════════════════════════════
   CONNECT + INSERT
══════════════════════════════════════════════════════════════ */
async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log(`✅  Connected to MongoDB: ${MONGO_URI}`);

        /* Wipe existing seed runs (safe for dev; remove in production) */
        const ids = runs.map(r => r.runId);
        const deleted = await Run.deleteMany({ runId: { $in: ids } });
        if (deleted.deletedCount) {
            console.log(`🗑   Cleared ${deleted.deletedCount} existing seed run(s)`);
        }

        /* Compute durationMinutes from phase steps before inserting */
        const enriched = runs.map(run => {
            const allSteps = [...run.preGrowth, ...run.growth, ...run.postGrowth];
            const totalMin = allSteps.reduce((acc, step) => {
                if (!step.hold?.value) return acc;
                const v = step.hold.value;
                const u = step.hold.unit;
                if (u === 'hr')  return acc + v * 60;
                if (u === 'day') return acc + v * 1440;
                return acc + v;
            }, 0);
            return { ...run, durationMinutes: Math.round(totalMin) };
        });

        const inserted = await Run.insertMany(enriched, { ordered: false });
        console.log(`\n🌱  Seeded ${inserted.length} runs:\n`);
        inserted.forEach(r =>
            console.log(
                `   ${r.runId.padEnd(16)} | ${r.materialType.padEnd(14)} | ${r.status.padEnd(11)} | ${r.durationMinutes} min`
            )
        );

        console.log('\n✅  Seed complete.\n');
    } catch (err) {
        console.error('❌  Seed failed:', err.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

seed();