import React, { useEffect, useState } from 'react';
import { FormData, ProgramType } from '../../types';
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
}

const slideDown = {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto', transition: { duration: 0.3 } },
    exit: { opacity: 0, height: 0, transition: { duration: 0.2 } },
};

const FormStep2: React.FC<FormStep2Props> = ({ data, errors, handleChange, handleMultiSelectChange }) => {
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

            {/* Display auto-assigned time slot with capacity */}
            {assignedTimeSlot && (
              <div className="bg-[#9BD4FF]/10 p-4 rounded-lg border border-[#9BD4FF]/20">
                <p className="text-sm font-medium text-gray-300 mb-1">Assigned Time Slot:</p>
                <p className="text-lg font-bold text-[#9BD4FF]">{assignedTimeSlot}</p>
                <p className="text-xs text-gray-400 mt-1">Based on your player category ({data.playerCategory})</p>

                {/* Capacity indicator */}
                {data.groupFrequency && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    {isCheckingCapacity ? (
                      <p className="text-sm text-gray-400">Checking availability...</p>
                    ) : (
                      <>
                        {capacityInfo.isFull ? (
                          <div className="flex items-center gap-2 text-red-400">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium">This time slot is FULL ({capacityInfo.currentCapacity}/{capacityInfo.maxCapacity})</span>
                          </div>
                        ) : capacityInfo.available <= 2 ? (
                          <div className="flex items-center gap-2 text-yellow-400">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium">Only {capacityInfo.available} spot{capacityInfo.available !== 1 ? 's' : ''} remaining! ({capacityInfo.currentCapacity}/{capacityInfo.maxCapacity})</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-green-400">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium">{capacityInfo.available} spot{capacityInfo.available !== 1 ? 's' : ''} available ({capacityInfo.currentCapacity}/{capacityInfo.maxCapacity})</span>
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
                <p className="text-red-400 font-medium">⚠️ Registration Unavailable</p>
                <p className="text-sm text-gray-300 mt-1">
                  This time slot is currently at full capacity. Please contact us at info@sniperzone.com to join the waitlist.
                </p>
              </div>
            )}

            <FormSelect label="Frequency" name="groupFrequency" value={data.groupFrequency} handleChange={handleChange} error={errors.groupFrequency} required>
                <option value="">-- Select Frequency --</option>
                <option value="1x">1x / week</option>
                <option value="2x">2x / week</option>
            </FormSelect>
            {data.groupFrequency === '1x' && (
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Select Day <span className="text-red-500">*</span></label>
                    <div className="flex gap-4">
                        {['tuesday', 'friday'].map(day => (
                            <label key={day} className={`flex-1 p-4 border-2 rounded-lg cursor-pointer text-center ${data.groupDay === day ? 'border-[#9BD4FF] bg-[#9BD4FF]/10' : 'border-white/20'}`}>
                                <input type="radio" name="groupDay" value={day} checked={data.groupDay === day} onChange={handleChange} className="sr-only" />
                                <span className="capitalize">{day}</span>
                            </label>
                        ))}
                    </div>
                    {errors.groupDay && <p className="mt-2 text-sm text-red-500">{errors.groupDay}</p>}
                </div>
            )}
             {data.groupFrequency === '2x' && (
                <div className="text-sm text-gray-300 p-4 bg-white/10 rounded-lg">
                    Sessions are automatically scheduled for **Tuesday & Friday**.
                </div>
            )}

            {/* Sunday Practice Participation */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg">
              <FormCheckbox
                label="I agree to participate in Sunday practices (once per month, 11:00 AM - 12:30 PM)"
                name="sundayPractice"
                checked={data.sundayPractice}
                handleChange={handleChange}
              />
              <p className="text-xs text-gray-400 mt-2 ml-6">
                Note: Sunday practices are mandatory for Group Training participants and occur once monthly on real ice.
              </p>
            </div>
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
