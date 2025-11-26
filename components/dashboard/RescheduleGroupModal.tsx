import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface RescheduleGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  registrationId: string;
  firebaseUid: string;
  currentSchedule: {
    days: string[];
    frequency: string;
    playerCategory: string;
  };
  onSuccess: () => void;
}

interface DayAvailability {
  day: string;
  available: boolean;
  spotsRemaining: number;
  totalCapacity: number;
  isFull: boolean;
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday', short: 'Mon' },
  { value: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { value: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { value: 'thursday', label: 'Thursday', short: 'Thu' },
  { value: 'friday', label: 'Friday', short: 'Fri' },
  { value: 'saturday', label: 'Saturday', short: 'Sat' },
  { value: 'sunday', label: 'Sunday', short: 'Sun' },
];

export const RescheduleGroupModal: React.FC<RescheduleGroupModalProps> = ({
  isOpen,
  onClose,
  registrationId,
  firebaseUid,
  currentSchedule,
  onSuccess
}) => {
  const toast = useToast();
  const [changeType, setChangeType] = useState<'one_time' | 'permanent'>('permanent');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const maxDays = currentSchedule.frequency === '1x' ? 1 : 2;

  useEffect(() => {
    if (isOpen) {
      setSelectedDays([]);
      setError(null);
      setSuccess(false);
      checkAvailability();
    }
  }, [isOpen]);

  const checkAvailability = async () => {
    setIsCheckingAvailability(true);
    try {
      const response = await fetch('/api/reschedule-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check_availability',
          registrationId,
          firebaseUid,
          newDays: DAYS_OF_WEEK.map(d => d.value)
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

      const data = await response.json();
      if (data.success) {
        setAvailability(data.availability);
      } else {
        setError(data.error || 'Failed to check availability');
      }
    } catch (err) {
      console.error('Error checking availability:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to check availability';
      setError(errorMessage);
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  const handleDayToggle = (day: string) => {
    const dayAvailability = availability.find(a => a.day === day);
    if (dayAvailability?.isFull) return;

    setSelectedDays(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day);
      } else if (prev.length < maxDays) {
        return [...prev, day];
      } else {
        return [...prev.slice(1), day];
      }
    });
  };

  const handleSubmit = async () => {
    if (selectedDays.length !== maxDays) {
      setError(`Please select exactly ${maxDays} day(s)`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // For one-time changes, we need to specify the date(s) that will be swapped
      // For permanent changes, we use effectiveDate for when the change takes effect
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const dayMap: { [key: string]: number } = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6,
      };

      // For one-time changes, calculate the next occurrence of ALL original days
      // and map each to its corresponding new day
      let daySwaps: Array<{ originalDay: string; originalDate: string; newDay: string }> = [];

      // Helper to format date as YYYY-MM-DD in LOCAL timezone (not UTC)
      const formatLocalDate = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      if (changeType === 'one_time' && currentSchedule.days.length > 0) {
        // Create a swap entry for each original day -> new day
        currentSchedule.days.forEach((originalDay, index) => {
          const originalDayLower = originalDay.toLowerCase();
          const targetDayNum = dayMap[originalDayLower];

          if (targetDayNum !== undefined) {
            // Calculate next occurrence of this original day
            // Use same formula as TrainingSchedule calendar: (targetDay - today.getDay() + 7) % 7
            // Do NOT use || 7, so if today IS the training day, we target today (or same-week occurrence)
            const daysUntil = (targetDayNum - today.getDay() + 7) % 7;
            const nextOccurrence = new Date(today);
            nextOccurrence.setDate(today.getDate() + daysUntil);

            // Use local date format to avoid timezone issues
            const originalDate = formatLocalDate(nextOccurrence);

            // Map to corresponding new day (by index)
            const newDay = selectedDays[index] || selectedDays[0];

            daySwaps.push({
              originalDay: originalDayLower,
              originalDate,
              newDay: newDay.toLowerCase()
            });
          }
        });
      }

      const response = await fetch('/api/reschedule-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reschedule',
          registrationId,
          firebaseUid,
          changeType,
          originalDays: currentSchedule.days,
          newDays: selectedDays,
          // Send daySwaps array for one-time changes, effectiveDate for permanent
          ...(changeType === 'one_time'
            ? { daySwaps }
            : { effectiveDate: todayStr })
        })
      });

      // Check if response is OK
      if (!response.ok) {
        // Try to parse error message
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to reschedule');
        } else {
          // Non-JSON response (e.g., server error page)
          const errorText = await response.text();
          console.error('Non-JSON error response:', errorText);
          throw new Error('Server error occurred. Please try again later.');
        }
      }

      const data = await response.json();
      if (data.success) {
        setSuccess(true);
        toast.success('Schedule Updated', `Your training days have been successfully changed to ${selectedDays.map(d => getDayLabel(d)).join(', ')}`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } else {
        const errorMsg = data.error || 'Failed to reschedule';
        setError(errorMsg);
        toast.error('Rescheduling Failed', errorMsg);
      }
    } catch (err) {
      console.error('Error rescheduling:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to reschedule. Please try again.';
      setError(errorMsg);
      toast.error('Error', errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const getDayLabel = (day: string) => {
    return DAYS_OF_WEEK.find(d => d.value === day)?.label || day;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/10"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <h2 className="text-2xl font-bold text-white">Reschedule Group Training</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Current Schedule */}
            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Current Schedule</h3>
              <div className="flex flex-wrap gap-2">
                {currentSchedule.days.map(day => (
                  <span key={day} className="px-3 py-1 bg-[#9BD4FF]/20 text-[#9BD4FF] rounded-full text-sm font-medium">
                    {getDayLabel(day)}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Frequency: {currentSchedule.frequency} per week • Category: {currentSchedule.playerCategory}
              </p>
            </div>

            {/* Change Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Change Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setChangeType('one_time')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    changeType === 'one_time'
                      ? 'border-[#9BD4FF] bg-[#9BD4FF]/10 text-[#9BD4FF]'
                      : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20'
                  }`}
                >
                  <div className="font-medium">This Week Only</div>
                  <div className="text-xs mt-1 opacity-75">One-time change</div>
                </button>
                <button
                  onClick={() => setChangeType('permanent')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    changeType === 'permanent'
                      ? 'border-[#9BD4FF] bg-[#9BD4FF]/10 text-[#9BD4FF]'
                      : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20'
                  }`}
                >
                  <div className="font-medium">Permanent Change</div>
                  <div className="text-xs mt-1 opacity-75">Update ongoing schedule</div>
                </button>
              </div>
            </div>

            {/* Day Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Select New Training {maxDays === 1 ? 'Day' : 'Days'}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <p className="text-xs text-gray-400 mb-3">
                {maxDays === 1
                  ? 'Choose 1 day per week for your training'
                  : 'Choose 2 days per week for your training'}
              </p>

              {isCheckingAvailability ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9BD4FF]"></div>
                  <span className="ml-3 text-gray-400">Checking availability...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {DAYS_OF_WEEK.map(day => {
                    const dayAvailability = availability.find(a => a.day === day.label);
                    const isSelected = selectedDays.includes(day.value);
                    const isFull = dayAvailability?.isFull;
                    const spotsRemaining = dayAvailability?.spotsRemaining ?? 0;

                    return (
                      <button
                        key={day.value}
                        onClick={() => handleDayToggle(day.value)}
                        disabled={isFull}
                        className={`p-3 rounded-lg border-2 transition-all min-h-[80px] flex flex-col items-center justify-center relative ${
                          isSelected
                            ? 'border-[#9BD4FF] bg-[#9BD4FF]/20 text-[#9BD4FF]'
                            : isFull
                            ? 'border-red-500/50 bg-red-500/10 text-red-400 cursor-not-allowed'
                            : 'border-white/20 bg-white/5 text-white hover:border-[#9BD4FF]/50 cursor-pointer'
                        }`}
                      >
                        <div className="font-medium text-sm">{day.short}</div>

                        {dayAvailability && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded mt-1 ${
                            isFull
                              ? 'bg-red-500 text-white'
                              : spotsRemaining <= 2
                              ? 'bg-yellow-500 text-black'
                              : 'bg-green-500 text-white'
                          }`}>
                            {isFull ? 'FULL' : `${spotsRemaining} left`}
                          </span>
                        )}

                        {isSelected && (
                          <svg className="w-4 h-4 absolute top-2 right-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <p className="mt-2 text-xs text-gray-400">
                Selected: {selectedDays.length} / {maxDays}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4">
                <p className="text-green-400 text-sm">✓ Schedule updated successfully!</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-6 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading || selectedDays.length !== maxDays}
              className="px-6 py-2 bg-[#9BD4FF] text-black rounded-lg hover:bg-[#7BB4DD] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isLoading ? 'Updating...' : 'Confirm Change'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default RescheduleGroupModal;
