import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function RunForm() {

    const navigate = useNavigate();

    const [formData, setFormData] = useState({

        runId: '',
        operatorName: '',
        materialType: 'carbide',
        status: 'completed',
        durationMinutes: '',
        notes: ''

    });

    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {

        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {

        e.preventDefault();

        setLoading(true);

        try {

            const payload = {

                ...formData,

                temperatureLogs: [
                    { time: 0, value: 120 },
                    { time: 10, value: 240 },
                    { time: 20, value: 410 },
                    { time: 30, value: 680 }
                ],

                pressureLogs: [
                    { time: 0, value: 10 },
                    { time: 10, value: 20 },
                    { time: 20, value: 35 },
                    { time: 30, value: 45 }
                ]

            };

            await axios.post(
                'http://localhost:5000/api/runs',
                payload
            );

            alert('Run Added Successfully');

            navigate('/logs');

        } catch (error) {

            console.error(error);

            alert('Error Adding Run');
        }

        setLoading(false);
    };

    return (

        <div style={s.root}>

            <div style={s.card}>

                <h1 style={s.title}>
                    Add New Baking Run
                </h1>

                <form onSubmit={handleSubmit}>

                    <div style={s.group}>

                        <label style={s.label}>
                            Run ID
                        </label>

                        <input
                            type="text"
                            name="runId"
                            required
                            value={formData.runId}
                            onChange={handleChange}
                            style={s.input}
                        />

                    </div>

                    <div style={s.group}>

                        <label style={s.label}>
                            Operator Name
                        </label>

                        <input
                            type="text"
                            name="operatorName"
                            required
                            value={formData.operatorName}
                            onChange={handleChange}
                            style={s.input}
                        />

                    </div>

                    <div style={s.row}>

                        <div style={s.group}>

                            <label style={s.label}>
                                Material Type
                            </label>

                            <select
                                name="materialType"
                                value={formData.materialType}
                                onChange={handleChange}
                                style={s.input}
                            >
                                <option value="carbide">
                                    Carbide
                                </option>

                                <option value="source_powder">
                                    Source Powder
                                </option>

                            </select>

                        </div>

                        <div style={s.group}>

                            <label style={s.label}>
                                Status
                            </label>

                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                style={s.input}
                            >
                                <option value="completed">
                                    Completed
                                </option>

                                <option value="in_progress">
                                    In Progress
                                </option>

                                <option value="failed">
                                    Failed
                                </option>

                            </select>

                        </div>

                    </div>

                    <div style={s.group}>

                        <label style={s.label}>
                            Duration (minutes)
                        </label>

                        <input
                            type="number"
                            name="durationMinutes"
                            value={formData.durationMinutes}
                            onChange={handleChange}
                            style={s.input}
                        />

                    </div>

                    <div style={s.group}>

                        <label style={s.label}>
                            Notes
                        </label>

                        <textarea
                            name="notes"
                            rows="5"
                            value={formData.notes}
                            onChange={handleChange}
                            style={s.textarea}
                        />

                    </div>

                    <button
                        type="submit"
                        style={s.button}
                        disabled={loading}
                    >
                        {
                            loading
                                ? 'Saving...'
                                : 'Save Run'
                        }
                    </button>

                </form>

            </div>

        </div>
    );
}

const s = {

    root: {
        minHeight: '100vh',
        background: '#F6F4EF',
        padding: '40px',
        fontFamily: 'DM Sans, sans-serif'
    },

    card: {
        maxWidth: '700px',
        margin: '0 auto',
        background: '#fff',
        padding: '30px',
        borderRadius: '14px',
        border: '1px solid #E5E5E5'
    },

    title: {
        marginBottom: '24px'
    },

    row: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px'
    },

    group: {
        marginBottom: '20px'
    },

    label: {
        display: 'block',
        marginBottom: '8px',
        fontSize: '14px',
        fontWeight: '600'
    },

    input: {
        width: '100%',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #DDD',
        fontSize: '14px'
    },

    textarea: {
        width: '100%',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #DDD',
        fontSize: '14px',
        resize: 'vertical'
    },

    button: {
        background: '#BA7517',
        color: '#fff',
        border: 'none',
        padding: '14px 24px',
        borderRadius: '10px',
        cursor: 'pointer',
        fontSize: '15px',
        fontWeight: '600'
    }
};