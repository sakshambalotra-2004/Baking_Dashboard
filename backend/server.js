const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

/* middleware */
app.use(cors());
app.use(express.json());

/* serve uploaded images */
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* mongodb connection */
mongoose.connect('mongodb://127.0.0.1:27017/baking_logs')
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log(err));

/* routes */
const runRoutes = require('./routes/runRoutes');
app.use('/api/runs', runRoutes);

app.use('/uploads', express.static('uploads'));
const reportRoutes = require('./routes/reportRoutes');

app.use('/api/reports', reportRoutes);

app.use(
    express.static(
        path.join(__dirname, '../frontend/build')
    )
);

app.get('*', (req, res) => {
    res.sendFile(
        path.join(__dirname, '../frontend/build/index.html')
    );
});

/* start server */
app.listen(5000, '0.0.0.0', () => {
    console.log('Server Running');
});