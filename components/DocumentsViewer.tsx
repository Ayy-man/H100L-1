import React, { useState } from 'react';
import { MedicalFiles } from '../types';
import { getSignedUrl } from '../lib/storageService';

interface DocumentsViewerProps {
  medicalFiles?: MedicalFiles;
}

interface FileCardProps {
  title: string;
  file?: {
    url: string;
    filename: string;
    size: number;
    uploadedAt: string;
  };
}

const FileCard: React.FC<FileCardProps> = ({ title, file }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!file) {
    return (
      <div className="bg-white/5 p-6 rounded-lg border border-white/10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-white font-semibold mb-1">{title}</h4>
            <p className="text-sm text-gray-400">Not provided</p>
          </div>
        </div>
      </div>
    );
  }

  const handleView = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const signedUrl = await getSignedUrl(file.url);
      window.open(signedUrl, '_blank');
    } catch (err) {
      console.error('Error viewing file:', err);
      setError('Failed to load file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const signedUrl = await getSignedUrl(file.url);
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading file:', err);
      setError('Failed to download file');
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white/5 p-6 rounded-lg border border-white/10 hover:border-[#9BD4FF]/30 transition-colors">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-[#9BD4FF]/10 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-[#9BD4FF]" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-semibold mb-1">{title}</h4>
          <p className="text-sm text-gray-300 mb-2 truncate">{file.filename}</p>
          <div className="flex flex-wrap gap-3 text-xs text-gray-400 mb-3">
            <span>{formatFileSize(file.size)}</span>
            <span>•</span>
            <span>{formatDate(file.uploadedAt)}</span>
          </div>
          {error && (
            <p className="text-sm text-red-400 mb-2">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleView}
              disabled={isLoading}
              className="px-4 py-2 bg-[#9BD4FF]/10 text-[#9BD4FF] rounded-lg text-sm font-semibold hover:bg-[#9BD4FF]/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : 'View'}
            </button>
            <button
              onClick={handleDownload}
              disabled={isLoading}
              className="px-4 py-2 bg-white/5 text-white rounded-lg text-sm font-semibold hover:bg-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DocumentsViewer: React.FC<DocumentsViewerProps> = ({ medicalFiles }) => {
  if (!medicalFiles || (!medicalFiles.actionPlan && !medicalFiles.medicalReport)) {
    return (
      <div className="text-center py-8 text-gray-400">
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-lg font-semibold mb-2">No Documents Available</p>
        <p className="text-sm">This registration has no uploaded documents.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2 mb-4">
        Medical Documents
      </h3>
      <div className="grid gap-4">
        <FileCard title="Action Plan" file={medicalFiles.actionPlan} />
        <FileCard title="Medical Report" file={medicalFiles.medicalReport} />
      </div>
    </div>
  );
};

export default DocumentsViewer;
