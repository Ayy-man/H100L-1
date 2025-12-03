import React, { useEffect, useState, useMemo } from 'react';
import { FormData, ProgramType, WeekDay, PlayerCategory } from '../../types';
import FormSelect from './FormSelect';
import { motion, AnimatePresence } from 'framer-motion';
import { generateMonthlyDates, formatDateForDisplay, getCurrentMonthYear, getRemainingDates, isDateInPast } from '../../lib/dateUtils';
import { findSlotForCategory } from '../../lib/timeSlots';

interface FormStep2Props {
  data: FormData;
  errors: Partial<Record<keyof FormData, string>>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  handleMultiSelectChange: (name: keyof FormData, option: string) => void;
  onAvailabilityCheckChange?: (isChecking: boolean) => void;
}

interface SlotAvailability {
  time: string;
  day: string;
  availableSpots: number;
  totalCapacity: number;
  isFull: boolean;
  programTypes: string[];
}

const slideDown = {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto', transition: { duration: 0.3 } },
    exit: { opacity: 0, height: 0, transition: { duration: 0.2 } },
};

// Day restrictions based on program type
const GROUP_TRAINING_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']; // Available daily
const PRIVATE_TRAINING_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']; // Available all 7 days

const FormStep2: React.FC<FormStep2Props> = ({ data, errors, handleChange, handleMultiSelectChange, onAvailabilityCheckChange }) => {
  const [availability, setAvailability] = useState<SlotAvailability[]>([]);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  // Notify parent when availability check state changes
  useEffect(() => {
    onAvailabilityCheckChange?.(isCheckingAvailability);
  }, [isCheckingAvailability, onAvailabilityCheckChange]);

  // Semi-private suggestions state
  const [semiPrivateSuggestions, setSemiPrivateSuggestions] = useState<Array<{
    day: string;
    time: string;
    displayTime: string;
    partnerCount: number;
  }>>([]);
  const [blockedTimes, setBlockedTimes] = useState<Array<{
    day: string;
    time: string;
    displayTime: string;
  }>>([]);
  const [unpairedPlayersCount, setUnpairedPlayersCount] = useState(0);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const daysOfWeek: { value: WeekDay; label: string }[] = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' },
  ];

  // Check availability when program type or selected days change
  useEffect(() => {
    if (data.programType && (data.groupSelectedDays.length > 0 || data.privateSelectedDays?.length > 0)) {
      checkAvailability();
    }
  }, [data.programType, data.groupSelectedDays, data.privateSelectedDays]);

  // Fetch semi-private suggestions when semi-private is selected and player category is set
  useEffect(() => {
    if (data.programType === 'semi-private' && data.playerCategory) {
      fetchSemiPrivateSuggestions();
    }
  }, [data.programType, data.playerCategory, data.semiPrivateAvailability]);

  const fetchSemiPrivateSuggestions = async () => {
    setIsLoadingSuggestions(true);
    try {
      const selectedDay = data.semiPrivateAvailability?.[0];
      const response = await fetch('/api/semi-private-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerCategory: data.playerCategory,
          selectedDay
        })
      });

      if (!response.ok) {
        console.error('Failed to fetch semi-private suggestions');
        return;
      }

      const result = await response.json();
      if (result.success) {
        setSemiPrivateSuggestions(result.suggestedTimes || []);
        setBlockedTimes(result.blockedTimes || []);
        setUnpairedPlayersCount(result.totalUnpairedPlayers || 0);
      }
    } catch (error) {
      console.error('Error fetching semi-private suggestions:', error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const checkAvailability = async () => {
    setIsCheckingAvailability(true);
    setAvailabilityError(null);

    try {
      const selectedDays = data.programType === 'group'
        ? data.groupSelectedDays
        : data.privateSelectedDays || [];

      const response = await fetch('/api/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getSlots',
          programType: data.programType,
          selectedDays
        })
      });

      // Check if response is OK
      if (!response.ok) {
        // Try to parse error message
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to check availability');
        } else {
          // Non-JSON response (e.g., server error page)
          const errorText = await response.text();
          console.error('Non-JSON error response:', errorText);
          throw new Error('Server error occurred. Please try again later.');
        }
      }

      const result = await response.json();

      if (result.success) {
        setAvailability(result.slots || []);
      } else {
        setAvailabilityError(result.error || 'Failed to check availability');
      }
    } catch (error) {
      console.error('Availability check error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Could not connect to availability service';
      setAvailabilityError(errorMessage);
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  // Auto-generate monthly dates when days are selected
  useEffect(() => {
    if (data.groupSelectedDays.length > 0) {
      const dates = generateMonthlyDates(data.groupSelectedDays);
      handleMultiSelectChange('groupMonthlyDates' as keyof FormData, JSON.stringify(dates));
    }
  }, [data.groupSelectedDays]);

  const handleDayToggle = (day: WeekDay) => {
    // Enforce day restrictions
    if (data.programType === 'group' && !GROUP_TRAINING_DAYS.includes(day)) {
      return; // Can't select this day for group training
    }
    if ((data.programType === 'private' || data.programType === 'semi-private') && !PRIVATE_TRAINING_DAYS.includes(day)) {
      return; // Can't select this day for private training
    }

    handleMultiSelectChange('groupSelectedDays' as keyof FormData, day);
  };

  const isDayAvailable = (day: WeekDay): boolean => {
    if (data.programType === 'group') {
      return GROUP_TRAINING_DAYS.includes(day);
    }
    if (data.programType === 'private' || data.programType === 'semi-private') {
      return PRIVATE_TRAINING_DAYS.includes(day);
    }
    return true;
  };

  const getDayCapacity = (day: string): SlotAvailability | null => {
    return availability.find(slot => slot.day.toLowerCase() === day.toLowerCase()) || null;
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
        <option value="private" disabled>Private Training (Coming Soon)</option>
        <option value="semi-private" disabled>Semi-Private Training (Coming Soon)</option>
      </FormSelect>

      <AnimatePresence>
        {data.programType === 'group' && (
          <motion.div variants={slideDown} initial="initial" animate="animate" exit="exit" className="space-y-6 bg-white/5 p-6 rounded-lg overflow-hidden">
            <h4 className="font-bold text-[#9BD4FF]">Group Training Details</h4>

            {/* Schedule Info - Show assigned time based on age category */}
            {(() => {
              const assignedSlot = data.playerCategory
                ? findSlotForCategory(data.playerCategory as PlayerCategory)
                : null;

              return (
                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
                  <p className="text-sm text-gray-300">
                    📅 <strong>Group Training Schedule:</strong> Available <span className="text-[#9BD4FF]">7 days a week</span>
                  </p>
                  {assignedSlot ? (
                    <div className="mt-2 p-3 bg-[#9BD4FF]/10 border border-[#9BD4FF]/30 rounded-lg">
                      <p className="text-sm font-semibold text-[#9BD4FF]">
                        🕐 Your Assigned Time: {assignedSlot.time}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Based on {data.playerCategory} age category • Max 6 players per slot
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1">
                      Time slots: 4:30 PM, 5:45 PM, 7:00 PM, 8:15 PM (based on age category)
                    </p>
                  )}
                </div>
              );
            })()}

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
                        ? 'Choose any 1 day per week for your training'
                        : 'Choose any 2 days per week for your training'}
                    </p>

                    {/* Check Availability Button */}
                    <button
                      type="button"
                      onClick={checkAvailability}
                      disabled={isCheckingAvailability}
                      className="mb-4 px-4 py-2 bg-green-500/20 border border-green-500/50 text-green-400 rounded-lg hover:bg-green-500/30 transition text-sm font-medium disabled:opacity-50"
                    >
                      {isCheckingAvailability ? '🔄 Checking...' : '🔍 Check Availability'}
                    </button>

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                        {daysOfWeek.map(day => {
                          const isSelected = data.groupSelectedDays.includes(day.value);
                          const isAllowedDay = isDayAvailable(day.value);
                          const dayCapacity = getDayCapacity(day.label);
                          const isDisabled = !isSelected && (!canSelectMore || !isAllowedDay);

                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => isAllowedDay && !isDisabled && handleDayToggle(day.value)}
                              disabled={isDisabled || !isAllowedDay}
                              className={`p-2 sm:p-3 border-2 rounded-lg text-center font-semibold text-xs sm:text-sm transition-all min-h-[60px] flex flex-col items-center justify-center relative overflow-hidden ${
                                isSelected
                                  ? 'border-[#9BD4FF] bg-[#9BD4FF]/20 text-[#9BD4FF]'
                                  : !isAllowedDay
                                  ? 'border-white/10 bg-gray-700/30 text-gray-600 cursor-not-allowed'
                                  : isDisabled
                                  ? 'border-white/10 bg-white/5 text-gray-600 cursor-not-allowed'
                                  : dayCapacity?.isFull
                                  ? 'border-red-500/50 bg-red-500/10 text-red-400 cursor-not-allowed'
                                  : 'border-white/20 bg-white/5 text-white hover:border-[#9BD4FF]/50 cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center justify-center gap-0.5 mb-1 w-full overflow-hidden">
                                {isSelected && (
                                  <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                                <span className="truncate text-[11px] sm:text-sm">{day.label}</span>
                              </div>

                              {/* Capacity Badge */}
                              {isAllowedDay && dayCapacity && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  dayCapacity.isFull
                                    ? 'bg-red-500 text-white'
                                    : dayCapacity.availableSpots <= 2
                                    ? 'bg-yellow-500 text-black'
                                    : 'bg-green-500 text-white'
                                }`}>
                                  {dayCapacity.isFull ? 'FULL' : `${dayCapacity.availableSpots}/${dayCapacity.totalCapacity}`}
                                </span>
                              )}

                              {!isAllowedDay && (
                                <span className="text-[9px] text-gray-500 absolute bottom-1">
                                  Not available
                                </span>
                              )}
                            </button>
                          );
                        })}
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                      Selected: {data.groupSelectedDays.length} / {maxDays}
                    </p>
                    {errors.groupDay && <p className="mt-2 text-sm text-red-500">{errors.groupDay}</p>}
                    {availabilityError && (
                      <p className="mt-2 text-sm text-yellow-500">⚠️ {availabilityError}</p>
                    )}
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

        {/* Private Training - COMING SOON */}
        {data.programType === 'private' && (
            <motion.div variants={slideDown} initial="initial" animate="animate" exit="exit" className="space-y-6 bg-yellow-500/10 border-2 border-yellow-500/30 p-6 rounded-lg overflow-hidden">
                <div className="text-center py-8">
                  <span className="text-6xl mb-4 block">🚧</span>
                  <h4 className="font-bold text-yellow-400 text-2xl mb-2">Coming Soon</h4>
                  <p className="text-gray-300">
                    Private Training is not yet available for registration.
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                    Please select <strong>Group Training</strong> to continue.
                  </p>
                </div>
            </motion.div>
        )}

        {/* Semi-Private Training - COMING SOON */}
        {data.programType === 'semi-private' && (
            <motion.div variants={slideDown} initial="initial" animate="animate" exit="exit" className="space-y-6 bg-yellow-500/10 border-2 border-yellow-500/30 p-6 rounded-lg overflow-hidden">
                <div className="text-center py-8">
                  <span className="text-6xl mb-4 block">🚧</span>
                  <h4 className="font-bold text-yellow-400 text-2xl mb-2">Coming Soon</h4>
                  <p className="text-gray-300">
                    Semi-Private Training is not yet available for registration.
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                    Please select <strong>Group Training</strong> to continue.
                  </p>
                </div>
            </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};

export default FormStep2;
