import React, { useEffect, useState } from 'react';
import { FormData, ProgramType, Language } from '../../types';
import { content } from '../../constants';
import FormSelect from './FormSelect';
import FormCheckbox from './FormCheckbox';
import { motion, AnimatePresence } from 'framer-motion';
import { getGroupTimeSlot } from '../../lib/timeSlotAssignment';
import { checkCapacity, CapacityInfo } from '../../lib/capacityService';

interface FormStep2Props {
  data: FormData;
  errors: Partial<Record<keyof FormData, string>>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  handleMultiSelectChange: (name: keyof FormData, option: string) => void;
  language: Language;
}

const slideDown = {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto', transition: { duration: 0.3 } },
    exit: { opacity: 0, height: 0, transition: { duration: 0.2 } },
};

const FormStep2: React.FC<FormStep2Props> = ({ data, errors, handleChange, handleMultiSelectChange, language }) => {
  const t = content[language].form.step2;

  // Get the auto-assigned time slot for Group Training based on player category
  const assignedTimeSlot = data.programType === 'group' && data.playerCategory
    ? getGroupTimeSlot(data.playerCategory)
    : '';

  // Track capacity info
  const [capacityInfo, setCapacityInfo] = useState<CapacityInfo>({
    currentCapacity: 0,
    maxCapacity: 6,
    available: 6,
    isFull: false,
  });
  const [isCheckingCapacity, setIsCheckingCapacity] = useState(false);

  // Check capacity when relevant fields change
  useEffect(() => {
    const checkSlotCapacity = async () => {
      if (data.programType === 'group' && data.playerCategory && data.groupFrequency) {
        setIsCheckingCapacity(true);

        const timeSlot = getGroupTimeSlot(data.playerCategory);
        const day = data.groupFrequency === '2x'
          ? 'both' as const
          : data.groupDay || ('tuesday' as const);

        const info = await checkCapacity(timeSlot, data.groupFrequency, day);
        setCapacityInfo(info);
        setIsCheckingCapacity(false);
      }
    };

    checkSlotCapacity();
  }, [data.programType, data.playerCategory, data.groupFrequency, data.groupDay]);

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">{t.title}</h3>
      <FormSelect label={t.programType.label} name="programType" value={data.programType} handleChange={handleChange} error={errors.programType} required>
        <option value="">{t.programType.placeholder}</option>
        <option value="group">{t.group}</option>
        <option value="private">{t.private}</option>
        <option value="semi-private">{t.semiPrivate}</option>
      </FormSelect>
      
      <AnimatePresence>
        {data.programType === 'group' && (
          <motion.div variants={slideDown} initial="initial" animate="animate" exit="exit" className="space-y-6 bg-white/5 p-6 rounded-lg overflow-hidden">
            <h4 className="font-bold text-[#9BD4FF]">{t.groupDetails}</h4>

            {/* Display auto-assigned time slot with capacity */}
            {assignedTimeSlot && (
              <div className="bg-[#9BD4FF]/10 p-4 rounded-lg border border-[#9BD4FF]/20">
                <p className="text-sm font-medium text-gray-300 mb-1">{t.assignedTimeSlot}</p>
                <p className="text-lg font-bold text-[#9BD4FF]">{assignedTimeSlot}</p>
                <p className="text-xs text-gray-400 mt-1">{t.basedOnCategory} ({data.playerCategory})</p>

                {/* Capacity indicator */}
                {data.groupFrequency && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    {isCheckingCapacity ? (
                      <p className="text-sm text-gray-400">{t.checkingAvailability}</p>
                    ) : (
                      <>
                        {capacityInfo.isFull ? (
                          <div className="flex items-center gap-2 text-red-400">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium">{t.slotFull} ({capacityInfo.currentCapacity}/{capacityInfo.maxCapacity})</span>
                          </div>
                        ) : capacityInfo.available <= 2 ? (
                          <div className="flex items-center gap-2 text-yellow-400">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium">{t.onlySpots} {capacityInfo.available} {t.spotsRemaining} ({capacityInfo.currentCapacity}/{capacityInfo.maxCapacity})</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-green-400">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium">{capacityInfo.available} {t.spotsAvailable} ({capacityInfo.currentCapacity}/{capacityInfo.maxCapacity})</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Warning if slot is full */}
            {capacityInfo.isFull && data.groupFrequency && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
                <p className="text-red-400 font-medium">⚠️ {t.registrationUnavailable}</p>
                <p className="text-sm text-gray-300 mt-1">
                  {t.capacityMessage}
                </p>
              </div>
            )}

            <FormSelect label={t.frequency.label} name="groupFrequency" value={data.groupFrequency} handleChange={handleChange} error={errors.groupFrequency} required>
                <option value="">{t.frequency.placeholder}</option>
                <option value="1x">1x / week</option>
                <option value="2x">2x / week</option>
            </FormSelect>
            {data.groupFrequency === '1x' && (
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">{t.selectDay} <span className="text-red-500">*</span></label>
                    <div className="flex gap-4">
                        {['tuesday', 'friday'].map(day => (
                            <label key={day} className={`flex-1 p-4 border-2 rounded-lg cursor-pointer text-center ${data.groupDay === day ? 'border-[#9BD4FF] bg-[#9BD4FF]/10' : 'border-white/20'}`}>
                                <input type="radio" name="groupDay" value={day} checked={data.groupDay === day} onChange={handleChange} className="sr-only" />
                                <span className="capitalize">{day === 'tuesday' ? t.tuesday : t.friday}</span>
                            </label>
                        ))}
                    </div>
                    {errors.groupDay && <p className="mt-2 text-sm text-red-500">{errors.groupDay}</p>}
                </div>
            )}
             {data.groupFrequency === '2x' && (
                <div className="text-sm text-gray-300 p-4 bg-white/10 rounded-lg">
                    {t.autoScheduled}
                </div>
            )}

            {/* Sunday Practice Participation */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg">
              <FormCheckbox
                label={t.sundayPracticeLabel}
                name="sundayPractice"
                checked={data.sundayPractice}
                handleChange={handleChange}
              />
              <p className="text-xs text-gray-400 mt-2 ml-6">
                {t.sundayPracticeNote}
              </p>
            </div>
          </motion.div>
        )}

        {data.programType === 'private' && (
            <motion.div variants={slideDown} initial="initial" animate="animate" exit="exit" className="space-y-6 bg-white/5 p-6 rounded-lg overflow-hidden">
                <h4 className="font-bold text-[#9BD4FF]">{t.privateDetails}</h4>

                <FormSelect label={t.sessionFrequency} name="privateFrequency" value={data.privateFrequency} handleChange={handleChange} error={errors.privateFrequency} required>
                  <option value="">{t.frequency.placeholder}</option>
                  <option value="1x/week">1x / week</option>
                  <option value="2x/week">2x / week</option>
                  <option value="3x/week">3x / week</option>
                </FormSelect>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">{t.preferredDays} <span className="text-red-500">*</span></label>
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
                  <p className="text-xs text-gray-400 mt-2">{t.selectAllDays}</p>
                </div>

                <FormSelect label={t.preferredTime} name="privateTimeSlot" value={data.privateTimeSlot} handleChange={handleChange}>
                  <option value="">{t.timeSlotPlaceholder}</option>
                  <option value="Morning (6 AM - 12 PM)">{t.morningSlot}</option>
                  <option value="Afternoon (12 PM - 5 PM)">{t.afternoonSlot}</option>
                  <option value="Evening (5 PM - 9 PM)">{t.eveningSlot}</option>
                </FormSelect>

                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
                  <p className="text-sm text-gray-300">
                    {t.contactMessage}
                  </p>
                </div>
            </motion.div>
        )}

        {data.programType === 'semi-private' && (
             <motion.div variants={slideDown} initial="initial" animate="animate" exit="exit" className="space-y-6 bg-white/5 p-6 rounded-lg overflow-hidden">
                <h4 className="font-bold text-[#9BD4FF]">{t.semiPrivateDetails}</h4>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">{t.availableDays} <span className="text-red-500">*</span></label>
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
                  <p className="text-xs text-gray-400 mt-2">{t.selectAllAvailable}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">{t.timeWindows} <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {[
                      { value: 'Morning (6 AM - 12 PM)', label: t.morningSlot },
                      { value: 'Afternoon (12 PM - 5 PM)', label: t.afternoonSlot },
                      { value: 'Evening (5 PM - 9 PM)', label: t.eveningSlot }
                    ].map(timeWindow => (
                      <label
                        key={timeWindow.value}
                        className={`p-3 border rounded-lg cursor-pointer text-center text-sm ${
                          (data.semiPrivateTimeWindows || []).includes(timeWindow.value)
                            ? 'border-[#9BD4FF] bg-[#9BD4FF]/10 text-[#9BD4FF]'
                            : 'border-white/20 text-gray-300 hover:border-white/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={(data.semiPrivateTimeWindows || []).includes(timeWindow.value)}
                          onChange={() => handleMultiSelectChange('semiPrivateTimeWindows', timeWindow.value)}
                        />
                        {timeWindow.label}
                      </label>
                    ))}
                  </div>
                </div>

                <FormSelect label={t.matchingPreference.label} name="semiPrivateMatchingPreference" value={data.semiPrivateMatchingPreference} handleChange={handleChange}>
                  <option value="">{t.matchingPreferencePlaceholder}</option>
                  <option value="same-level">{t.sameLevel}</option>
                  <option value="flexible">{t.flexible}</option>
                  <option value="higher-level">{t.higherLevel}</option>
                </FormSelect>

                <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-lg">
                  <p className="text-sm font-medium text-purple-300 mb-2">{t.howSemiPrivateWorks}</p>
                  <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                    <li>{t.semiPrivatePoint1}</li>
                    <li>{t.semiPrivatePoint2}</li>
                    <li>{t.semiPrivatePoint3}</li>
                    <li>{t.semiPrivatePoint4}</li>
                  </ul>
                </div>
            </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};

export default FormStep2;
