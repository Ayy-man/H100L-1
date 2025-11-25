import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface ReschedulePrivateModalProps {
  isOpen: boolean;
  onClose: () => void;
  registrationId: string;
  firebaseUid: string;
  currentSchedule: {
    day: string;
    timeSlot: string;
    playerCategory: string;
  };
  onSuccess: () => void;
}

interface TimeSlot {
  time: string;
  available: boolean;
  isCurrent: boolean;
  error?: string;
}

interface DayAvailability {
  day: string;
  slots: TimeSlot[];
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

const TIME_SLOTS = ['8-9', '9-10', '10-11', '11-12', '12-13', '13-14', '14-15'];

export const ReschedulePrivateModal: React.FC<ReschedulePrivateModalProps> = ({
  isOpen,
  onClose,
  registrationId,
  firebaseUid,
  currentSchedule,
  onSuccess
}) => {
  const toast = useToast();
  const [changeType, setChangeType] = useState<'one_time' | 'permanent'>('permanent');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [weekAvailability, setWeekAvailability] = useState<DayAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedDay(null);
      setSelectedTime(null);
      setError(null);
      setSuccess(false);
      loadAvailability();
    }
  }, [isOpen]);

  const loadAvailability = async () => {
    setIsLoadingAvailability(true);
    try {
      const response = await fetch('/api/reschedule-private', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_availability',
          registrationId,
          firebaseUid
        })
      });

      // Check if response is OK
      if (!response.ok) {
        // Try to parse error message
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load availability');
        } else {
          // Non-JSON response (e.g., server error page)
          const errorText = await response.text();
          console.error('Non-JSON error response:', errorText);
          throw new Error('Server error occurred. Please try again later.');
        }
      }

      const data = await response.json();
      if (data.success) {
        setWeekAvailability(data.availability);
      } else {
        setError(data.error || 'Failed to load availability');
      }
    } catch (err) {
      console.error('Error loading availability:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load availability';
      setError(errorMessage);
    } finally {
      setIsLoadingAvailability(false);
    }
  };

  const handleSlotClick = (day: string, time: string, isAvailable: boolean, isCurrent: boolean) => {
    if (!isAvailable || isCurrent) return;

    setSelectedDay(day);
    setSelectedTime(time);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selectedDay || !selectedTime) {
      setError('Please select a new day and time');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Calculate next occurrence of selected day for one-time changes
      const getNextOccurrence = (dayName: string): string => {
        const daysMap: { [key: string]: number } = {
          'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
          'thursday': 4, 'friday': 5, 'saturday': 6
        };

        const today = new Date();
        const targetDay = daysMap[dayName.toLowerCase()];
        const currentDay = today.getDay();

        let daysUntilTarget = targetDay - currentDay;
        if (daysUntilTarget <= 0) {
          daysUntilTarget += 7; // Next week
        }

        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + daysUntilTarget);
        return nextDate.toISOString().split('T')[0];
      };

      const requestBody: any = {
        action: 'reschedule',
        registrationId,
        firebaseUid,
        changeType,
        newDay: selectedDay,
        newTime: selectedTime,
      };

      // Add appropriate date field based on change type
      if (changeType === 'one_time') {
        requestBody.specificDate = getNextOccurrence(selectedDay);
      } else {
        requestBody.effectiveDate = new Date().toISOString().split('T')[0];
      }

      const response = await fetch('/api/reschedule-private', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
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
        toast.success('Session Rescheduled', `Your private training has been moved to ${getDayLabel(selectedDay)} at ${selectedTime}`);
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

  const getSlotForDay = (day: string, time: string): TimeSlot | undefined => {
    const dayData = weekAvailability.find(d => d.day === day);
    return dayData?.slots.find(s => s.time === time);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-gray-900 rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto border border-white/10"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-gray-900 z-10">
            <div>
              <h2 className="text-2xl font-bold text-white">Reschedule Private Training</h2>
              <p className="text-sm text-gray-400 mt-1">
                Current: {currentSchedule.day} at {currentSchedule.timeSlot}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Change Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Change Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setChangeType('one_time')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    changeType === 'one_time'
                      ? 'border-purple-500 bg-purple-500/10 text-purple-400'
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
                      ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                      : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20'
                  }`}
                >
                  <div className="font-medium">Permanent Change</div>
                  <div className="text-xs mt-1 opacity-75">Update ongoing schedule</div>
                </button>
              </div>
            </div>

            {/* Weekly Calendar Grid */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Select New Time Slot <span className="text-red-500">*</span>
              </label>

              {isLoadingAvailability ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                  <span className="ml-3 text-gray-400">Loading availability...</span>
                </div>
              ) : (
                <div className="bg-white/5 p-4 rounded-lg border border-white/10 overflow-x-auto">
                  {/* Legend */}
                  <div className="flex items-center gap-4 mb-4 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-purple-500/20 border border-purple-500 rounded"></div>
                      <span className="text-gray-400">Current</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500/20 border border-green-500 rounded"></div>
                      <span className="text-gray-400">Available</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-500/20 border border-red-500 rounded"></div>
                      <span className="text-gray-400">Booked</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-500/20 border border-blue-500 rounded"></div>
                      <span className="text-gray-400">Selected</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-8 gap-2 min-w-[700px]">
                    {/* Time column header */}
                    <div className="font-medium text-gray-400 text-sm flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>

                    {/* Day headers */}
                    {DAYS_OF_WEEK.map(day => (
                      <div key={day.value} className="font-medium text-gray-300 text-sm text-center">
                        {day.label}
                      </div>
                    ))}

                    {/* Time slots */}
                    {TIME_SLOTS.map(time => (
                      <React.Fragment key={time}>
                        {/* Time label */}
                        <div className="text-xs text-gray-400 flex items-center justify-end pr-2">
                          {time}
                        </div>

                        {/* Day slots */}
                        {DAYS_OF_WEEK.map(day => {
                          const slot = getSlotForDay(day.value, time);
                          const isSelected = selectedDay === day.value && selectedTime === time;
                          const isCurrent = slot?.isCurrent || false;
                          const isAvailable = slot?.available !== false;

                          return (
                            <button
                              key={`${day.value}-${time}`}
                              onClick={() => handleSlotClick(day.value, time, isAvailable, isCurrent)}
                              disabled={!isAvailable || isCurrent}
                              className={`h-12 rounded border-2 transition-all relative ${
                                isCurrent
                                  ? 'border-purple-500 bg-purple-500/20 text-purple-400 cursor-default'
                                  : isSelected
                                  ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                                  : isAvailable
                                  ? 'border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:border-green-500 cursor-pointer'
                                  : 'border-red-500/50 bg-red-500/10 text-red-400 cursor-not-allowed opacity-50'
                              }`}
                            >
                              {isCurrent && (
                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium">
                                  Current
                                </span>
                              )}
                              {isSelected && (
                                <svg className="w-5 h-5 absolute inset-0 m-auto" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>

                  {selectedDay && selectedTime && (
                    <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/50 rounded-lg">
                      <p className="text-blue-400 text-sm">
                        ✓ New schedule: {getDayLabel(selectedDay)} at {selectedTime}
                      </p>
                    </div>
                  )}
                </div>
              )}
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
                <p className="text-green-400 text-sm">✓ Session rescheduled successfully!</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10 sticky bottom-0 bg-gray-900">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-6 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading || !selectedDay || !selectedTime}
              className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isLoading ? 'Rescheduling...' : 'Confirm Reschedule'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ReschedulePrivateModal;
