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

  const daysOfWeek: { value: WeekDay; label: string; short: string }[] = [
    { value: 'monday', label: 'Monday', short: 'Mon' },
    { value: 'tuesday', label: 'Tuesday', short: 'Tue' },
    { value: 'wednesday', label: 'Wednesday', short: 'Wed' },
    { value: 'thursday', label: 'Thursday', short: 'Thu' },
    { value: 'friday', label: 'Friday', short: 'Fri' },
    { value: 'saturday', label: 'Saturday', short: 'Sat' },
    { value: 'sunday', label: 'Sunday', short: 'Sun' },
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
        <option value="private">Private Training</option>
        <option value="semi-private">Semi-Private Training</option>
      </FormSelect>

      <AnimatePresence>
        {data.programType === 'group' && (
          <motion.div variants={slideDown} initial="initial" animate="animate" exit="exit" className="space-y-6 bg-white/5 p-6 rounded-lg overflow-hidden">
            <h4 className="font-bold text-[#9BD4FF]">Group Training Details</h4>

            {/* Credit-based booking info */}
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
              <p className="text-sm text-gray-300">
                🎟️ <strong>Credit-Based System:</strong> Buy credits, book any available slot
              </p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="text-[#9BD4FF] font-semibold">$45</span> single session
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="text-[#9BD4FF] font-semibold">$350</span> for 10 sessions ($35 each)
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="text-[#9BD4FF] font-semibold">$500</span> for 20 sessions ($25 each) - Best Value!
                </div>
              </div>
            </div>

            {/* Schedule Info - Show assigned time based on age category */}
            {(() => {
              const assignedSlot = data.playerCategory
                ? findSlotForCategory(data.playerCategory as PlayerCategory)
                : null;

              return (
                <div className="bg-[#9BD4FF]/10 border border-[#9BD4FF]/30 p-4 rounded-lg">
                  <p className="text-sm text-gray-300 mb-2">
                    📅 <strong>Available 7 days a week</strong>
                  </p>
                  {assignedSlot ? (
                    <>
                      <p className="text-sm font-semibold text-[#9BD4FF]">
                        🕐 Your Time Slot: {assignedSlot.time}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Based on {data.playerCategory} age category • Max 6 players per slot
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400">
                      Time slots: 4:30 PM, 5:45 PM, 7:00 PM, 8:15 PM (based on age category)
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg">
              <p className="text-sm text-gray-300">
                ✨ <strong>How it works:</strong>
              </p>
              <ol className="mt-2 text-xs text-gray-400 space-y-1 list-decimal list-inside">
                <li>Complete registration to create your account</li>
                <li>Buy credit packages from your dashboard</li>
                <li>Book any available session using your credits</li>
                <li>Train as often as you want - credits valid for 12 months!</li>
              </ol>
            </div>
          </motion.div>
        )}

        {/* Private Training Details */}
        {data.programType === 'private' && (
            <motion.div variants={slideDown} initial="initial" animate="animate" exit="exit" className="space-y-6 bg-purple-500/10 border-2 border-purple-500/30 p-6 rounded-lg overflow-hidden">
                <h4 className="font-bold text-purple-400">Private Training Details</h4>
                <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-lg">
                  <p className="text-sm text-gray-300">
                    🎯 <strong>1-on-1 personalized training</strong>
                  </p>
                  <div className="mt-3 space-y-2">
                    <p className="text-sm text-gray-400">
                      <strong className="text-purple-400">$89.99</strong> per session (+ tax)
                    </p>
                    <p className="text-sm text-gray-400">
                      📅 Available 7 days a week
                    </p>
                    <p className="text-sm text-gray-400">
                      ⏰ Flexible scheduling based on availability
                    </p>
                  </div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
                  <p className="text-xs text-gray-400">
                    💡 After registration, you can book private sessions directly from your dashboard.
                  </p>
                </div>
            </motion.div>
        )}

        {/* Semi-Private Training Details */}
        {data.programType === 'semi-private' && (
            <motion.div variants={slideDown} initial="initial" animate="animate" exit="exit" className="space-y-6 bg-teal-500/10 border-2 border-teal-500/30 p-6 rounded-lg overflow-hidden">
                <h4 className="font-bold text-teal-400">Semi-Private Training Details</h4>
                <div className="bg-teal-500/10 border border-teal-500/20 p-4 rounded-lg">
                  <p className="text-sm text-gray-300">
                    👥 <strong>Small group training (2-3 players)</strong>
                  </p>
                  <div className="mt-3 space-y-2">
                    <p className="text-sm text-gray-400">
                      <strong className="text-teal-400">$69.00</strong> per session (+ tax)
                    </p>
                    <p className="text-sm text-gray-400">
                      📅 Available 7 days a week
                    </p>
                    <p className="text-sm text-gray-400">
                      👫 Train with players of similar skill level
                    </p>
                  </div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
                  <p className="text-xs text-gray-400">
                    💡 After registration, you can book semi-private sessions directly from your dashboard.
                  </p>
                </div>
            </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};

export default FormStep2;
