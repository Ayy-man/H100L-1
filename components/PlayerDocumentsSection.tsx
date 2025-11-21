import React, { useState } from 'react';
import { MedicalFiles, Language } from '../types';
import { getSignedUrl, uploadMedicalFiles, validateFile } from '../lib/storageService';
import DocumentStatusBadge from './DocumentStatusBadge';

interface PlayerDocumentsSectionProps {
  medicalFiles?: MedicalFiles;
  hasMedicalConditions?: boolean;
  parentEmail: string;
  playerName: string;
  language?: Language;
  registrationId?: string;
  onUploadComplete?: (newFiles: MedicalFiles) => void;
}

const PlayerDocumentsSection: React.FC<PlayerDocumentsSectionProps> = ({
  medicalFiles,
  hasMedicalConditions,
  parentEmail,
  playerName,
  language = Language.FR,
  registrationId,
  onUploadComplete
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<{ actionPlan?: File; medicalReport?: File }>({});
  const [isUploading, setIsUploading] = useState(false);

  const hasAnyDocuments = medicalFiles?.actionPlan || medicalFiles?.medicalReport;
  const isFrench = language === Language.FR;

  // Translations
  const text = {
    title: isFrench ? 'Documents du joueur' : 'Player Documents',
    actionPlan: isFrench ? 'Plan d\'action' : 'Action Plan',
    medicalReport: isFrench ? 'Rapport médical' : 'Medical Report',
    view: isFrench ? 'Voir' : 'View',
    download: isFrench ? 'Télécharger' : 'Download',
    loading: isFrench ? 'Chargement...' : 'Loading...',
    noDocuments: isFrench ? 'Aucun document téléchargé' : 'No Documents Uploaded',
    noDocumentsDesc: isFrench ? 'Ce joueur n\'a pas encore téléchargé de documents médicaux.' : 'This player hasn\'t uploaded any medical documents yet.',
    requestDocs: isFrench ? 'Demander des documents' : 'Request Documents',
    uploadDocs: isFrench ? 'Téléverser des documents' : 'Upload Documents',
    print: isFrench ? 'Imprimer les documents' : 'Print Documents',
    markReviewed: isFrench ? 'Marquer comme vérifié' : 'Mark as Reviewed',
    uploadTitle: isFrench ? 'Téléverser des documents médicaux' : 'Upload Medical Documents',
    selectFile: isFrench ? 'Sélectionner un fichier' : 'Select File',
    uploading: isFrench ? 'Téléversement...' : 'Uploading...',
    upload: isFrench ? 'Téléverser' : 'Upload',
    cancel: isFrench ? 'Annuler' : 'Cancel',
    uploadSuccess: isFrench ? 'Documents téléversés avec succès!' : 'Documents uploaded successfully!',
    uploadError: isFrench ? 'Erreur lors du téléversement' : 'Upload failed',
  };

  const handleView = async (file: { url: string; filename: string }, fileType: string) => {
    setIsLoading(fileType);
    setError(null);

    try {
      const signedUrl = await getSignedUrl(file.url);
      window.open(signedUrl, '_blank');
    } catch (err) {
      console.error('Error viewing file:', err);
      setError(`Failed to load ${fileType}`);
    } finally {
      setIsLoading(null);
    }
  };

  const handleDownload = async (file: { url: string; filename: string }, fileType: string) => {
    setIsLoading(fileType);
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
      setError(`Failed to download ${fileType}`);
    } finally {
      setIsLoading(null);
    }
  };

  const handleRequestDocuments = () => {
    const isFrench = language === Language.FR;

    const subject = isFrench
      ? encodeURIComponent(`Demande de documents pour ${playerName}`)
      : encodeURIComponent(`Document Request for ${playerName}`);

    const greeting = isFrench ? 'Cher parent/tuteur,' : 'Dear Parent/Guardian,';
    const intro = isFrench
      ? `Nous remarquons qu'il nous manque certains documents médicaux pour ${playerName}. Veuillez télécharger les documents requis dès que possible.`
      : `We notice that we are missing some medical documents for ${playerName}. Please upload the required documents at your earliest convenience.`;

    const requiredLabel = isFrench ? 'Documents requis :' : 'Required:';
    const actionPlanLabel = isFrench ? '- Plan d\'action médical' : '- Medical Action Plan';
    const medicalReportLabel = isFrench ? '- Rapport médical' : '- Medical Report';

    const closing = isFrench ? 'Merci,\nÉquipe SniperZone' : 'Thank you,\nSniperZone Team';

    const body = encodeURIComponent(
      `${greeting}\n\n${intro}\n\n` +
      `${requiredLabel}\n${!medicalFiles?.actionPlan ? `${actionPlanLabel}\n` : ''}${!medicalFiles?.medicalReport ? `${medicalReportLabel}\n` : ''}\n` +
      `${closing}`
    );

    window.location.href = `mailto:${parentEmail}?subject=${subject}&body=${body}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'actionPlan' | 'medicalReport') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    setUploadingFiles(prev => ({ ...prev, [fileType]: file }));
    setError(null);
  };

  const handleUpload = async () => {
    if (!registrationId || Object.keys(uploadingFiles).length === 0) {
      setError(text.uploadError);
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const uploadedFiles = await uploadMedicalFiles(uploadingFiles, registrationId);

      // Notify parent component
      if (onUploadComplete) {
        onUploadComplete(uploadedFiles);
      }

      alert(text.uploadSuccess);
      setIsUploadModalOpen(false);
      setUploadingFiles({});
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(text.uploadError + ': ' + (err.message || 'Unknown error'));
    } finally {
      setIsUploading(false);
    }
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
    <div className="bg-white/5 p-4 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-lg font-bold text-white uppercase tracking-wider hover:text-[#9BD4FF] transition-colors"
        >
          <svg
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          {text.title}
        </button>
        <DocumentStatusBadge
          medicalFiles={medicalFiles}
          hasMedicalConditions={hasMedicalConditions}
          compact={true}
        />
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="space-y-4">
          {/* Status Badges */}
          <DocumentStatusBadge
            medicalFiles={medicalFiles}
            hasMedicalConditions={hasMedicalConditions}
          />

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Documents List */}
          {hasAnyDocuments ? (
            <div className="grid gap-3">
              {/* Action Plan */}
              {medicalFiles?.actionPlan && (
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-[#9BD4FF]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-[#9BD4FF]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{text.actionPlan}</p>
                      <p className="text-gray-400 text-xs truncate">{medicalFiles.actionPlan.filename}</p>
                      <p className="text-gray-500 text-xs">
                        {formatFileSize(medicalFiles.actionPlan.size)} • {formatDate(medicalFiles.actionPlan.uploadedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-2">
                    <button
                      onClick={() => handleView(medicalFiles.actionPlan!, 'actionPlan')}
                      disabled={isLoading === 'actionPlan'}
                      className="px-3 py-1.5 bg-[#9BD4FF]/10 text-[#9BD4FF] rounded text-xs font-semibold hover:bg-[#9BD4FF]/20 transition disabled:opacity-50"
                    >
                      {isLoading === 'actionPlan' ? text.loading : text.view}
                    </button>
                    <button
                      onClick={() => handleDownload(medicalFiles.actionPlan!, 'actionPlan')}
                      disabled={isLoading === 'actionPlan'}
                      className="px-3 py-1.5 bg-white/5 text-white rounded text-xs font-semibold hover:bg-white/10 transition disabled:opacity-50"
                    >
                      {text.download}
                    </button>
                  </div>
                </div>
              )}

              {/* Medical Report */}
              {medicalFiles?.medicalReport && (
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-[#9BD4FF]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-[#9BD4FF]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{text.medicalReport}</p>
                      <p className="text-gray-400 text-xs truncate">{medicalFiles.medicalReport.filename}</p>
                      <p className="text-gray-500 text-xs">
                        {formatFileSize(medicalFiles.medicalReport.size)} • {formatDate(medicalFiles.medicalReport.uploadedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-2">
                    <button
                      onClick={() => handleView(medicalFiles.medicalReport!, 'medicalReport')}
                      disabled={isLoading === 'medicalReport'}
                      className="px-3 py-1.5 bg-[#9BD4FF]/10 text-[#9BD4FF] rounded text-xs font-semibold hover:bg-[#9BD4FF]/20 transition disabled:opacity-50"
                    >
                      {isLoading === 'medicalReport' ? text.loading : text.view}
                    </button>
                    <button
                      onClick={() => handleDownload(medicalFiles.medicalReport!, 'medicalReport')}
                      disabled={isLoading === 'medicalReport'}
                      className="px-3 py-1.5 bg-white/5 text-white rounded text-xs font-semibold hover:bg-white/10 transition disabled:opacity-50"
                    >
                      {text.download}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-semibold mb-1">{text.noDocuments}</p>
              <p className="text-xs">{text.noDocumentsDesc}</p>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-white/10">
            <button
              onClick={handleRequestDocuments}
              className="flex items-center gap-2 px-4 py-2 bg-[#9BD4FF]/10 text-[#9BD4FF] rounded-lg text-sm font-semibold hover:bg-[#9BD4FF]/20 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {text.requestDocs}
            </button>

            <button
              onClick={() => setIsUploadModalOpen(true)}
              disabled={!registrationId}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 text-purple-400 rounded-lg text-sm font-semibold hover:bg-purple-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {text.uploadDocs}
            </button>

            {hasAnyDocuments && (
              <>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white rounded-lg text-sm font-semibold hover:bg-white/10 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  {text.print}
                </button>

                <button
                  className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 rounded-lg text-sm font-semibold hover:bg-green-500/20 transition"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {text.markReviewed}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-white/10 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">{text.uploadTitle}</h3>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Action Plan Upload */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {text.actionPlan}
              </label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => handleFileSelect(e, 'actionPlan')}
                className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#9BD4FF]/10 file:text-[#9BD4FF] hover:file:bg-[#9BD4FF]/20 file:cursor-pointer"
              />
              {uploadingFiles.actionPlan && (
                <p className="text-xs text-[#9BD4FF] mt-1">
                  {uploadingFiles.actionPlan.name} ({formatFileSize(uploadingFiles.actionPlan.size)})
                </p>
              )}
            </div>

            {/* Medical Report Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {text.medicalReport}
              </label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => handleFileSelect(e, 'medicalReport')}
                className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#9BD4FF]/10 file:text-[#9BD4FF] hover:file:bg-[#9BD4FF]/20 file:cursor-pointer"
              />
              {uploadingFiles.medicalReport && (
                <p className="text-xs text-[#9BD4FF] mt-1">
                  {uploadingFiles.medicalReport.name} ({formatFileSize(uploadingFiles.medicalReport.size)})
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setUploadingFiles({});
                  setError(null);
                }}
                disabled={isUploading}
                className="flex-1 bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition disabled:opacity-50"
              >
                {text.cancel}
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading || Object.keys(uploadingFiles).length === 0}
                className="flex-1 bg-[#9BD4FF] text-black font-bold py-2 px-4 rounded-lg hover:shadow-[0_0_15px_#9BD4FF] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? text.uploading : text.upload}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerDocumentsSection;
