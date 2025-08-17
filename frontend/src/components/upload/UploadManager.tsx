// frontend/src/components/upload/UploadManager.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUploadStore } from '@stores/uploadStore';
import { uploadFile } from '@utils/uploadClient';
import { logger } from '@utils/logger';

export const UploadManager: React.FC = () => {
    const navigate = useNavigate();
    const { addUpload, updateUpload, updateProgress, markSuccess, markError } = useUploadStore();
    const [dragOver, setDragOver] = useState(false);

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];

        const uploadId = addUpload(file);

        try {
            updateUpload(uploadId, { status: 'uploading' });
            updateProgress(uploadId, 0);

            const result = await uploadFile(file, (p) => updateProgress(uploadId, p));

            markSuccess(uploadId, result.moduleId);
            navigate(`/training/${result.moduleId}`);
        } catch (err: any) {
            logger.error('Upload failed', err);
            markError(uploadId, err);
        }
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
    };

    const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFiles(e.target.files);
    };

    return (
        <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer ${dragOver ? 'bg-gray-100' : 'bg-white'
                }`}
            onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
        >
            <input
                id="file-upload"
                type="file"
                accept="video/*"
                className="hidden"
                onChange={onSelect}
            />
            <label htmlFor="file-upload" className="block text-blue-600">
                Click to select a video
            </label>
            <p className="text-gray-500 mt-2">or drag and drop</p>
        </div>
    );
};
