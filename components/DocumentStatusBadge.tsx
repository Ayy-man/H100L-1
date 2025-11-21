import React from 'react';
import { MedicalFiles } from '../types';

interface DocumentStatusBadgeProps {
  medicalFiles?: MedicalFiles;
  hasMedicalConditions?: boolean;
  compact?: boolean;
}

const DocumentStatusBadge: React.FC<DocumentStatusBadgeProps> = ({
  medicalFiles,
  hasMedicalConditions = false,
  compact = false
}) => {
  const hasActionPlan = !!medicalFiles?.actionPlan;
  const hasMedicalReport = !!medicalFiles?.medicalReport;
  const hasAnyDocuments = hasActionPlan || hasMedicalReport;

  // Warning if medical conditions exist but no documents
  const showWarning = hasMedicalConditions && !hasAnyDocuments;

  if (compact) {
    // Compact badge for table views
    if (showWarning) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-semibold">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Missing Docs
        </span>
      );
    }

    if (hasAnyDocuments) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-semibold">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {hasActionPlan && hasMedicalReport ? '2 Docs' : '1 Doc'}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-500/10 text-gray-400 text-xs font-semibold">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
        No Docs
      </span>
    );
  }

  // Full display for detail views
  return (
    <div className="flex flex-wrap gap-2">
      {/* Action Plan Badge */}
      {hasActionPlan ? (
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-sm font-semibold">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Action Plan Uploaded
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-500/10 text-gray-400 text-sm font-semibold">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          No Action Plan
        </span>
      )}

      {/* Medical Report Badge */}
      {hasMedicalReport ? (
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-sm font-semibold">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Medical Report Uploaded
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-500/10 text-gray-400 text-sm font-semibold">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          No Medical Report
        </span>
      )}

      {/* Warning if medical conditions but no docs */}
      {showWarning && (
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 text-sm font-semibold">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Medical Conditions - Documents Needed
        </span>
      )}
    </div>
  );
};

export default DocumentStatusBadge;
