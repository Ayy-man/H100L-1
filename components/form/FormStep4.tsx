import React from 'react';
import { FormData } from '../../types';

interface FormStep4Props {
  data: FormData;
}

const SummaryItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
        <dt className="text-sm font-medium text-gray-400">{label}</dt>
        <dd className="mt-1 text-sm text-white sm:mt-0 sm:col-span-2">{value || '-'}</dd>
    </div>
);

const FormStep4: React.FC<FormStep4Props> = ({ data }) => {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">Review Your Information</h3>
      <p className="text-gray-300">Please review all the information carefully before submitting your registration.</p>

      <div className="bg-white/5 p-6 rounded-lg">
        <dl className="divide-y divide-white/10">
            <SummaryItem label="Player Name" value={data.playerFullName} />
            <SummaryItem label="Date of Birth" value={data.dateOfBirth} />
            <SummaryItem label="Parent Email" value={data.parentEmail} />
            <SummaryItem label="Parent Phone" value={data.parentPhone} />
            <SummaryItem label="Emergency Contact" value={`${data.emergencyContactName} (${data.emergencyContactPhone})`} />
            <SummaryItem label="Program Type" value={<span className="capitalize">{data.programType}</span>} />
            {data.programType === 'group' && (
                <>
                    <SummaryItem label="Group Frequency" value={data.groupFrequency} />
                    <SummaryItem label="Group Day(s)" value={data.groupFrequency === '2x' ? 'Tuesday & Friday' : <span className="capitalize">{data.groupDay}</span>} />
                </>
            )}
            <SummaryItem label="Jersey Size" value={data.jerseySize} />
            <SummaryItem label="Action Plan" value={data.actionPlan?.name || 'Not provided'} />
            <SummaryItem label="Medical Report" value={data.medicalReport?.name || 'Not provided'} />
            <SummaryItem label="Consents" value="Photo/Video & Policies Agreed" />
        </dl>
      </div>
    </div>
  );
};

export default FormStep4;
