import React from 'react';
import { FormData } from '../../types';
import { calculatePrice, formatPrice } from '../../lib/stripe';

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
  const pricing = calculatePrice(data);

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">Review Your Information</h3>
      <p className="text-gray-300">Please review all the information carefully before proceeding to payment.</p>

      <div className="bg-white/5 p-6 rounded-lg">
        <h4 className="text-lg font-semibold text-white mb-4">Registration Summary</h4>
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
                    <SummaryItem
                      label="Training Days"
                      value={
                        data.groupSelectedDays.length > 0
                          ? data.groupSelectedDays.map(day => day.charAt(0).toUpperCase() + day.slice(1)).join(', ')
                          : 'Not selected'
                      }
                    />
                    <SummaryItem
                      label="Monthly Sessions"
                      value={
                        data.groupMonthlyDates && data.groupMonthlyDates.length > 0
                          ? `${data.groupMonthlyDates.length} sessions scheduled this month`
                          : 'No sessions scheduled'
                      }
                    />
                </>
            )}
            {data.programType === 'private' && (
                <>
                    <SummaryItem label="Session Frequency" value={data.privateFrequency} />
                    <SummaryItem
                      label="Preferred Days"
                      value={
                        data.privateSelectedDays && data.privateSelectedDays.length > 0
                          ? data.privateSelectedDays.join(', ')
                          : 'Not specified'
                      }
                    />
                    <SummaryItem label="Preferred Time" value={data.privateTimeSlot || 'Not specified'} />
                </>
            )}
            {data.programType === 'semi-private' && (
                <>
                    <SummaryItem
                      label="Available Days"
                      value={
                        data.semiPrivateAvailability && data.semiPrivateAvailability.length > 0
                          ? data.semiPrivateAvailability.join(', ')
                          : 'Not specified'
                      }
                    />
                    <SummaryItem
                      label="Time Windows"
                      value={
                        data.semiPrivateTimeWindows && data.semiPrivateTimeWindows.length > 0
                          ? data.semiPrivateTimeWindows.join(', ')
                          : 'Not specified'
                      }
                    />
                    <SummaryItem label="Matching Preference" value={data.semiPrivateMatchingPreference || 'Not specified'} />
                </>
            )}
            <SummaryItem label="Jersey Size" value={data.jerseySize} />
            <SummaryItem label="Action Plan" value={data.actionPlan?.name || 'Not provided'} />
            <SummaryItem label="Medical Report" value={data.medicalReport?.name || 'Not provided'} />
            <SummaryItem label="Consents" value="Photo/Video & Policies Agreed" />
        </dl>
      </div>

      {/* Pricing Summary */}
      <div className="bg-gradient-to-br from-green-500/10 to-blue-500/10 border border-green-500/20 p-6 rounded-lg">
        <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Pricing Summary
        </h4>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-300">{pricing.description}</span>
            <span className="text-2xl font-bold text-white">{formatPrice(pricing.amount)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Billing</span>
            <span className="text-gray-300">
              {pricing.interval === 'month' ? 'Billed monthly (cancel anytime)' : 'One-time payment'}
            </span>
          </div>
          <div className="pt-3 border-t border-white/10">
            <p className="text-xs text-gray-400">
              💳 You'll complete payment in the next step using our secure Stripe payment system.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormStep4;
