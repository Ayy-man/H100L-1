import React from 'react';
import { FormData, Language } from '../../types';
import { content } from '../../constants';

interface FormStep4Props {
  data: FormData;
  language: Language;
}

const SummaryItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
        <dt className="text-sm font-medium text-gray-400">{label}</dt>
        <dd className="mt-1 text-sm text-white sm:mt-0 sm:col-span-2">{value || '-'}</dd>
    </div>
);

const FormStep4: React.FC<FormStep4Props> = ({ data, language }) => {
  const t = content[language].form.step4;

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">{t.reviewTitle}</h3>
      <p className="text-gray-300">{t.subtitle}</p>

      <div className="bg-white/5 p-6 rounded-lg">
        <dl className="divide-y divide-white/10">
            <SummaryItem label={t.labels.playerName} value={data.playerFullName} />
            <SummaryItem label={t.labels.dateOfBirth} value={data.dateOfBirth} />
            <SummaryItem label={t.labels.parentEmail} value={data.parentEmail} />
            <SummaryItem label={t.labels.parentPhone} value={data.parentPhone} />
            <SummaryItem label={t.labels.emergencyContact} value={`${data.emergencyContactName} (${data.emergencyContactPhone})`} />
            <SummaryItem label={t.labels.programType} value={<span className="capitalize">{data.programType}</span>} />
            {data.programType === 'group' && (
                <>
                    <SummaryItem label={t.labels.groupFrequency} value={data.groupFrequency} />
                    <SummaryItem label={t.labels.groupDays} value={data.groupFrequency === '2x' ? t.labels.tuesdayFriday : <span className="capitalize">{data.groupDay}</span>} />
                </>
            )}
            <SummaryItem label={t.labels.jerseySize} value={data.jerseySize} />
            <SummaryItem label={t.labels.medicalReport} value={data.medicalReport?.name} />
            <SummaryItem label={t.labels.consents} value={t.labels.consentsAgreed} />
        </dl>
      </div>
    </div>
  );
};

export default FormStep4;
