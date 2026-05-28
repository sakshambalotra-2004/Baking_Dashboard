// src/components/ImageUpload.js

import React, { useRef } from 'react';

export default function ImageUpload({
    images,
    setImages
}) {

    const inputRef = useRef();

    const handleFiles = (files) => {

        const arr = Array.from(files);

        arr.forEach((file) => {

            if (!file.type.startsWith('image/')) return;

            const reader = new FileReader();

            reader.onload = (e) => {

                setImages((prev) => [
                    ...prev,
                    {
                        file,
                        src: e.target.result,
                        caption: ''
                    }
                ]);

            };

            reader.readAsDataURL(file);

        });

    };

    const removeImage = (index) => {

        setImages((prev) =>
            prev.filter((_, i) => i !== index)
        );

    };

    const updateCaption = (index, caption) => {

        setImages((prev) =>
            prev.map((img, i) =>
                i === index
                    ? { ...img, caption }
                    : img
            )
        );

    };

    return (
        <div>

            <h2>Images</h2>

            <div
                onClick={() => inputRef.current.click()}
                style={{
                    border: '2px dashed #ccc',
                    padding: '30px',
                    borderRadius: '10px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    marginBottom: '20px'
                }}
            >
                Upload Images
            </div>

            <input
                type="file"
                multiple
                accept="image/*"
                ref={inputRef}
                style={{ display: 'none' }}
                onChange={(e) => handleFiles(e.target.files)}
            />

            <div
                style={{
                    display: 'flex',
                    gap: '15px',
                    flexWrap: 'wrap'
                }}
            >

                {
                    images.map((img, index) => (

                        <div
                            key={index}
                            style={{
                                width: '160px',
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                background: '#fff'
                            }}
                        >

                            <img
                                src={img.src}
                                alt=""
                                style={{
                                    width: '100%',
                                    height: '120px',
                                    objectFit: 'cover'
                                }}
                            />

                            <input
                                type="text"
                                placeholder="Caption"
                                value={img.caption}
                                onChange={(e) =>
                                    updateCaption(index, e.target.value)
                                }
                                style={{
                                    width: '100%',
                                    border: 'none',
                                    borderTop: '1px solid #ddd',
                                    padding: '8px'
                                }}
                            />

                            <button
                                onClick={() => removeImage(index)}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    border: 'none',
                                    background: '#D85A30',
                                    color: '#fff',
                                    cursor: 'pointer'
                                }}
                            >
                                Remove
                            </button>

                        </div>

                    ))
                }

            </div>

        </div>
    );
}