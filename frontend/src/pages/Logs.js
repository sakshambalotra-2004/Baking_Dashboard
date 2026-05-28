import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

export default function Logs() {

    const [runs, setRuns] = useState([]);
    const [filteredRuns, setFilteredRuns] = useState([]);

    const [search, setSearch] = useState('');
    const [materialFilter, setMaterialFilter] = useState('all');

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadRuns();
    }, []);

    useEffect(() => {
        filterRuns();
    }, [search, materialFilter, runs]);

    const loadRuns = async () => {

        try {

            const response = await axios.get(
                'http://localhost:5000/api/runs'
            );

            setRuns(response.data.data);
            setFilteredRuns(response.data.data);
        } catch (error) {
            console.error(error);
        }

        setLoading(false);
    };

    const filterRuns = () => {

        let data = [...runs];

        if (search) {
            data = data.filter((run) =>
                run.runId?.toLowerCase().includes(search.toLowerCase()) ||
                run.operatorName?.toLowerCase().includes(search.toLowerCase())
            );
        }

        if (materialFilter !== 'all') {
            data = data.filter(
                (run) => run.materialType === materialFilter
            );
        }

        setFilteredRuns(data);
    };

    const getStatusStyle = (status) => {

        switch (status) {

            case 'completed':
                return s.completed;

            case 'in_progress':
                return s.inProgress;

            case 'failed':
                return s.failed;

            default:
                return s.defaultStatus;
        }
    };

    if (loading) {
        return (
            <div style={s.loading}>
                Loading Logs...
            </div>
        );
    }

    return (

        <div style={s.root}>

            <div style={s.header}>
                <div>
                    <h1 style={s.title}>
                        Baking Run Logs
                    </h1>

                    <p style={s.subtitle}>
                        View and manage all industrial baking runs
                    </p>
                </div>

                <Link to="/add" style={s.addBtn}>
                    + Add New Run
                </Link>
            </div>

            {/* FILTER BAR */}

            <div style={s.filterBar}>

                <input
                    placeholder="Search by Run ID or Operator..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={s.searchInput}
                />

                <select
                    value={materialFilter}
                    onChange={(e) => setMaterialFilter(e.target.value)}
                    style={s.select}
                >
                    <option value="all">
                        All Materials
                    </option>

                    <option value="carbide">
                        Carbide
                    </option>

                    <option value="source_powder">
                        Source Powder
                    </option>

                </select>

            </div>

            {/* LOGS */}

            {
                filteredRuns.length === 0 ? (

                    <div style={s.empty}>
                        No Runs Found
                    </div>

                ) : (

                    <div style={s.grid}>

                        {
                            filteredRuns.map((run) => (

                                <div
                                    key={run._id}
                                    style={s.card}
                                >

                                    <div style={s.cardTop}>

                                        <div>

                                            <h2 style={s.runId}>
                                                {run.runId}
                                            </h2>

                                            <div style={s.material}>
                                                {
                                                    run.materialType === 'carbide'
                                                        ? 'Carbide Baking'
                                                        : 'Source Powder Baking'
                                                }
                                            </div>

                                        </div>

                                        <div
                                            style={{
                                                ...s.status,
                                                ...getStatusStyle(run.status)
                                            }}
                                        >
                                            {run.status}
                                        </div>

                                    </div>

                                    <div style={s.info}>

                                        <div>
                                            <span style={s.label}>
                                                Operator
                                            </span>

                                            <div style={s.value}>
                                                {run.operatorName}
                                            </div>
                                        </div>

                                        <div>
                                            <span style={s.label}>
                                                Duration
                                            </span>

                                            <div style={s.value}>
                                                {run.durationMinutes || '--'} min
                                            </div>
                                        </div>

                                        <div>
                                            <span style={s.label}>
                                                Date
                                            </span>

                                            <div style={s.value}>
                                                {
                                                    new Date(
                                                        run.dateTime
                                                    ).toLocaleString()
                                                }
                                            </div>
                                        </div>

                                    </div>

                                    {
                                        run.images?.length > 0 && (

                                            <div>

                                                <img
                                                    src={`http://localhost:5000${run.images[0].path}`}
                                                    alt="run"
                                                    style={s.preview}
                                                />

                                                {
                                                    run.images[0].caption && (
                                                        <div style={s.caption}>
                                                            {run.images[0].caption}
                                                        </div>
                                                    )
                                                }

                                            </div>

                                        )
                                    }

                                    <div style={s.footer}>

                                        <Link
                                            to={`/runs/${run._id}`}
                                            style={s.openBtn}
                                        >
                                            Open Run →
                                        </Link>

                                    </div>

                                </div>

                            ))
                        }

                    </div>

                )
            }

        </div>

    );
}

/* STYLES */

const s = {

    root: {
        background: '#F6F4EF',
        minHeight: '100vh',
        padding: '30px',
        fontFamily: 'DM Sans, sans-serif',
    },

    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '25px',
    },

    title: {
        margin: 0,
        fontSize: '28px',
    },

    subtitle: {
        color: '#777',
        marginTop: '5px',
        fontSize: '13px',
    },

    addBtn: {
        background: '#BA7517',
        color: '#fff',
        textDecoration: 'none',
        padding: '10px 18px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '600',
    },

    filterBar: {
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
    },

    searchInput: {
        flex: 1,
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #DDD',
        fontSize: '14px',
    },

    caption: {
        padding: '10px',
        fontSize: '13px',
        color: '#555',
        borderTop: '1px solid #EEE',
        background: '#FAFAFA'
    },

    select: {
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #DDD',
        minWidth: '180px',
    },

    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))',
        gap: '18px',
    },

    card: {
        background: '#fff',
        borderRadius: '14px',
        border: '1px solid #E5E5E5',
        overflow: 'hidden',
        boxShadow: '0 3px 10px rgba(0,0,0,0.04)',
    },

    cardTop: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '18px',
    },

    runId: {
        margin: 0,
        fontSize: '18px',
    },

    material: {
        fontSize: '12px',
        color: '#888',
        marginTop: '4px',
    },

    status: {
        padding: '6px 12px',
        borderRadius: '999px',
        fontSize: '11px',
        height: 'fit-content',
        textTransform: 'uppercase',
        fontWeight: '600',
    },

    completed: {
        background: '#DFF5EE',
        color: '#157A58',
    },

    inProgress: {
        background: '#FEF0D6',
        color: '#9A6010',
    },

    failed: {
        background: '#FDECEA',
        color: '#B33',
    },

    defaultStatus: {
        background: '#EEE',
        color: '#555',
    },

    info: {
        padding: '0 18px 18px',
        display: 'grid',
        gap: '12px',
    },

    label: {
        fontSize: '11px',
        color: '#888',
        textTransform: 'uppercase',
    },

    value: {
        fontSize: '14px',
        marginTop: '3px',
    },

    preview: {
        width: '100%',
        height: '180px',
        objectFit: 'cover',
    },

    footer: {
        padding: '18px',
        borderTop: '1px solid #EEE',
    },

    openBtn: {
        textDecoration: 'none',
        color: '#BA7517',
        fontWeight: '600',
    },

    empty: {
        background: '#fff',
        padding: '40px',
        borderRadius: '12px',
        textAlign: 'center',
        color: '#888',
    },

    loading: {
        padding: '50px',
        textAlign: 'center',
        fontSize: '18px',
    },
};