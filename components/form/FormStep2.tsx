import React, { useEffect } from 'react';
import { FormData, ProgramType, WeekDay } from '../../types';
import FormSelect from './FormSelect';
import { motion, AnimatePresence } from 'framer-motion';
import { generateMonthlyDates, formatDateForDisplay, getCurrentMonthYear, getRemainingDates, isDateInPast } from '../../lib/dateUtils';

interface FormStep2Props {
  data: FormData;
  errors: Partial<Record<keyof FormData, string>>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  handleMultiSelectChange: (name: keyof FormData, option: string) => void;
}

const slideDown = {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto', transition: { duration: 0.3 } },
    exit: { opacity: 0, height: 0, transition: { duration: 0.2 } },
};

const FormStep2: React.FC<FormStep2Props> = ({ data, errors, handleChange, handleMultiSelectChange }) => {
  const daysOfWeek: { value: WeekDay; label: string }[] = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' },
  ];

  // Auto-generate monthly dates when days are selected
  useEffect(() => {
    if (data.groupSelectedDays.length > 0) {
      const dates = generateMonthlyDates(data.groupSelectedDays);
      // Update form data with generated dates
      handleMultiSelectChange('groupMonthlyDates' as keyof FormData, JSON.stringify(dates));
    }
  }, [data.groupSelectedDays]);

  const handleDayToggle = (day: WeekDay) => {
    handleMultiSelectChange('groupSelectedDays' as keyof FormData, day);
  };

  const maxDays = data.groupFrequency === '1x' ? 1 : data.groupFrequency === '2x' ? 2 : 0;
  const canSelectMore = data.groupSelectedDays.length < maxDays;

  const monthlyDates = data.groupMonthlyDates || [];
  const remainingDates = getRemainingDates(monthlyDates);

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">Program Selection</h3>
      <FormSelect label="Select Program Type" name="programType" value={data.programType} handleChange={handleChange} error={errors.programType} required>
        <option value="">-- Choose a Program --</option>
        <option value="group">Group Training</option>
        <option value="private">Private Training</option>
        <option value="semi-private">Semi-Private Training</option>
      </FormSelect>

      <AnimatePresence>
        {data.programType === 'group' && (
          <motion.div variants={slideDown} initial="initial" animate="animate" exit="exit" className="space-y-6 bg-white/5 p-6 rounded-lg overflow-hidden">
            <h4 className="font-bold text-[#9BD4FF]">Group Training Details</h4>

            {/* Frequency Selection */}
            <FormSelect label="Frequency" name="groupFrequency" value={data.groupFrequency} handleChange={handleChange} error={errors.groupFrequency} required>
                <option value="">-- Select Frequency --</option>
                <option value="1x">1x / week</option>
                <option value="2x">2x / week</option>
            </FormSelect>

            {/* Day Selection - Available 7 days a week */}
            {data.groupFrequency && (
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Select Your Training {data.groupFrequency === '1x' ? 'Day' : 'Days'} <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-gray-400 mb-3">
                      {data.groupFrequency === '1x'
                        ? 'Choose 1 day per week for your training'
                        : 'Choose 2 days per week for your training'}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                        {daysOfWeek.map(day => {
                          const isSelected = data.groupSelectedDays.includes(day.value);
                          const isDisabled = !isSelected && !canSelectMore;

                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => !isDisabled && handleDayToggle(day.value)}
                              disabled={isDisabled}
                              className={`p-3 border-2 rounded-lg text-center font-semibold text-sm transition-all ${
                                isSelected
                                  ? 'border-[#9BD4FF] bg-[#9BD4FF]/20 text-[#9BD4FF]'
                                  : isDisabled
                                  ? 'border-white/10 bg-white/5 text-gray-600 cursor-not-allowed'
                                  : 'border-white/20 bg-white/5 text-white hover:border-[#9BD4FF]/50 cursor-pointer'
                              }`}
                            >
                              {isSelected && (
                                <svg className="w-4 h-4 inline-block mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                              {day.label}
                            </button>
                          );
                        })}
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                      Selected: {data.groupSelectedDays.length} / {maxDays}
                    </p>
                    {errors.groupDay && <p className="mt-2 text-sm text-red-500">{errors.groupDay}</p>}
                </div>
            )}

            {/* Monthly Calendar Preview */}
            {data.groupSelectedDays.length > 0 && monthlyDates.length > 0 && (
              <div className="bg-white/10 p-4 rounded-lg">
                <h5 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#9BD4FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Your {getCurrentMonthYear()} Schedule
                </h5>
                <p className="text-sm text-gray-300 mb-3">
                  {remainingDates.length} training sessions scheduled for the rest of this month:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                  {monthlyDates.map((date, index) => (
                    <div
                      key={date}
                      className={`p-2 rounded text-sm text-center ${
                        isDateInPast(date)
                          ? 'bg-gray-600/20 text-gray-500 line-through'
                          : 'bg-[#9BD4FF]/10 text-[#9BD4FF]'
                      }`}
                    >
                      {formatDateForDisplay(date)}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-gray-400 italic">
                  💡 These dates will be automatically synced to your schedule after registration
                </p>
              </div>
            )}
          </motion.div>
        )}

        {data.programType === 'private' && (
            <motion.div variants={slideDown} initial="initial" animate="animate" exit="exit" className="space-y-6 bg-white/5 p-6 rounded-lg overflow-hidden">
                <h4 className="font-bold text-[#9BD4FF]">Private Training Details</h4>
                {/* Add Private Fields */}
                <p className="text-gray-400">Private training options coming soon.</p>
            </motion.div>
        )}

        {data.programType === 'semi-private' && (
             <motion.div variants={slideDown} initial="initial" animate="animate" exit="exit" className="space-y-6 bg-white/5 p-6 rounded-lg overflow-hidden">
                <h4 className="font-bold text-[#9BD4FF]">Semi-Private Training Details</h4>
                {/* Add Semi-Private Fields */}
                <p className="text-gray-400">Semi-Private training options coming soon.</p>
            </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};

export default FormStep2;
