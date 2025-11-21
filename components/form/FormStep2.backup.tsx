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
                              className={`p-2 sm:p-3 border-2 rounded-lg text-center font-semibold text-xs sm:text-sm transition-all min-h-[44px] flex flex-col items-center justify-center ${
                                isSelected
                                  ? 'border-[#9BD4FF] bg-[#9BD4FF]/20 text-[#9BD4FF]'
                                  : isDisabled
                                  ? 'border-white/10 bg-white/5 text-gray-600 cursor-not-allowed'
                                  : 'border-white/20 bg-white/5 text-white hover:border-[#9BD4FF]/50 cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1">
                                {isSelected && (
                                  <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                                <span className="truncate">{day.label}</span>
                              </div>
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

                <FormSelect label="Session Frequency" name="privateFrequency" value={data.privateFrequency} handleChange={handleChange} error={errors.privateFrequency} required>
                  <option value="">-- Select Frequency --</option>
                  <option value="1x/week">1x / week</option>
                  <option value="2x/week">2x / week</option>
                  <option value="3x/week">3x / week</option>
                </FormSelect>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Preferred Days <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                      <label
                        key={day}
                        className={`p-3 border rounded-lg cursor-pointer text-center text-sm ${
                          (data.privateSelectedDays || []).includes(day)
                            ? 'border-[#9BD4FF] bg-[#9BD4FF]/10 text-[#9BD4FF]'
                            : 'border-white/20 text-gray-300 hover:border-white/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={(data.privateSelectedDays || []).includes(day)}
                          onChange={() => handleMultiSelectChange('privateSelectedDays', day)}
                        />
                        {day}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Select all days you're available for private sessions</p>
                </div>

                <FormSelect label="Preferred Time Slot" name="privateTimeSlot" value={data.privateTimeSlot} handleChange={handleChange}>
                  <option value="">-- Select Time Slot --</option>
                  <option value="Morning (6 AM - 12 PM)">Morning (6 AM - 12 PM)</option>
                  <option value="Afternoon (12 PM - 5 PM)">Afternoon (12 PM - 5 PM)</option>
                  <option value="Evening (5 PM - 9 PM)">Evening (5 PM - 9 PM)</option>
                </FormSelect>

                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
                  <p className="text-sm text-gray-300">
                    📞 Our team will contact you within 24 hours to schedule your private training sessions based on your preferences.
                  </p>
                </div>
            </motion.div>
        )}

        {data.programType === 'semi-private' && (
             <motion.div variants={slideDown} initial="initial" animate="animate" exit="exit" className="space-y-6 bg-white/5 p-6 rounded-lg overflow-hidden">
                <h4 className="font-bold text-[#9BD4FF]">Semi-Private Training Details</h4>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Available Days <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                      <label
                        key={day}
                        className={`p-3 border rounded-lg cursor-pointer text-center text-sm ${
                          (data.semiPrivateAvailability || []).includes(day)
                            ? 'border-[#9BD4FF] bg-[#9BD4FF]/10 text-[#9BD4FF]'
                            : 'border-white/20 text-gray-300 hover:border-white/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={(data.semiPrivateAvailability || []).includes(day)}
                          onChange={() => handleMultiSelectChange('semiPrivateAvailability', day)}
                        />
                        {day}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Select all days you're available (we'll match you with players with similar availability)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Preferred Time Windows <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {['Morning (6 AM - 12 PM)', 'Afternoon (12 PM - 5 PM)', 'Evening (5 PM - 9 PM)'].map(timeWindow => (
                      <label
                        key={timeWindow}
                        className={`p-3 border rounded-lg cursor-pointer text-center text-sm ${
                          (data.semiPrivateTimeWindows || []).includes(timeWindow)
                            ? 'border-[#9BD4FF] bg-[#9BD4FF]/10 text-[#9BD4FF]'
                            : 'border-white/20 text-gray-300 hover:border-white/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={(data.semiPrivateTimeWindows || []).includes(timeWindow)}
                          onChange={() => handleMultiSelectChange('semiPrivateTimeWindows', timeWindow)}
                        />
                        {timeWindow}
                      </label>
                    ))}
                  </div>
                </div>

                <FormSelect label="Matching Preference" name="semiPrivateMatchingPreference" value={data.semiPrivateMatchingPreference} handleChange={handleChange}>
                  <option value="">-- Select Preference --</option>
                  <option value="same-level">Same skill level</option>
                  <option value="flexible">Flexible - any skill level</option>
                  <option value="higher-level">Train with higher skill level</option>
                </FormSelect>

                <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-lg">
                  <p className="text-sm font-medium text-purple-300 mb-2">🤝 How Semi-Private Works</p>
                  <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                    <li>We'll match you with 1-2 other players of similar age and skill level</li>
                    <li>Our intelligent matching system finds the best compatibility based on your preferences</li>
                    <li>More affordable than private training while maintaining personalized attention</li>
                    <li>You'll be notified within 48 hours when a compatible group is formed</li>
                  </ul>
                </div>
            </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};

export default FormStep2;
