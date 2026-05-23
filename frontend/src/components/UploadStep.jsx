import { useDropzone } from 'react-dropzone';
import { Upload, FileText } from 'lucide-react';
import StepIndicator from "./StepIndicator";
import { useState } from 'react';

export default function UploadStep({ currentStep, onUpload}) {
    const [file, setFile] = useState(null)

    async function handleUpload(){
        const formData = new FormData();
        formData.append('syllabus', file)

        const response = await fetch('http://localhost:3000/extract', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        onUpload(data)
    }

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: { 'application/pdf': ['.pdf'] },
        maxFiles: 1,
        onDrop: (acceptedFiles) => {
            setFile(acceptedFiles[0])
        }
    });

    return (
        <div className='max-w-2xl mx-auto px-4 py-8'>
            <h1 className="text-3xl font-bold text-gray-900 text-center mb-8">Syllabus to Calendar</h1>
            <StepIndicator currentStep={currentStep} />

            <div className="mt-8">
                <h2 className="text-2xl font-bold text-gray-900 text-center mb-1">Upload Your Syllabus</h2>
                <p className="text-gray-400 text-center mb-6">Drop your PDF syllabus here or click to browse</p>

                <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-2xl p-16 flex flex-col items-center gap-6 cursor-pointer transition-colors ${isDragActive ? 'border-gray-900 bg-gray-50' : 'border-gray-300 bg-white'}`}
                >
                    <input {...getInputProps()} />

                    <div className="bg-gray-100 p-6 rounded-2xl">
                        <Upload className="w-10 h-10 text-gray-500" />
                    </div>

                    <p className="text-gray-900 font-semibold text-lg">
                        {file === null ? "Drag and drop your PDF syllabus here" : file.name}
                    </p>

                    <div className="flex items-center gap-3 w-40">
                        <div className="flex-1 h-px bg-gray-300" />
                        <span className="text-gray-400 text-sm">or</span>
                        <div className="flex-1 h-px bg-gray-300" />
                    </div>

                    <button className="bg-gray-900 text-white font-bold px-12 py-3 rounded-full text-base">
                        Browse Files
                    </button>

                    <div className="flex items-center gap-2 border border-gray-200 rounded-full px-4 py-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-400 text-sm">Supports PDF files only</span>
                    </div>
                </div>
            </div>
            {file !== null ? 
                <button className="w-full bg-gray-900 text-white font-bold py-3 rounded-full text-base mt-4"
                        onClick={handleUpload}>
                    Upload Syllabus
                </button>: 
                null
            }
        </div>
    );
}
