import React, { useState } from 'react';
import { MedicalFiles, Language } from '../types';
import { getSignedUrl } from '../lib/storageService';
import DocumentStatusBadge from './DocumentStatusBadge';

interface PlayerDocumentsSectionProps {
  medicalFiles?: MedicalFiles;
  hasMedicalConditions?: boolean;
  parentEmail: string;
  playerName: string;
  language?: Language;
}

const PlayerDocumentsSection: React.FC<PlayerDocumentsSectionProps> = ({
  medicalFiles,
  hasMedicalConditions,
  parentEmail,
  playerName,
  language = Language.FR
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    print: isFrench ? 'Imprimer les documents' : 'Print Documents',
    markReviewed: isFrench ? 'Marquer comme vérifié' : 'Mark as Reviewed',
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
    </div>
  );
};

export default PlayerDocumentsSection;
