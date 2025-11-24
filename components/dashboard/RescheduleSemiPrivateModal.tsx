import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Users, Star, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface RescheduleSemiPrivateModalProps {
  isOpen: boolean;
  onClose: () => void;
  registrationId: string;
  firebaseUid: string;
  currentSchedule: {
    day?: string;
    timeSlot?: string;
    playerCategory: string;
  };
  onSuccess: () => void;
}

interface CurrentPairing {
  id: string;
  partnerName: string;
  partnerCategory: string;
  scheduledDay: string;
  scheduledTime: string;
  pairedDate: string;
}

interface SuggestedTime {
  day: string;
  time: string;
  partnerName: string;
  partnerCategory: string;
  unpairedSince: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
  hasUnpairedPartner: boolean;
  partnerName?: string;
  isCurrent: boolean;
  priority: 'high' | 'normal';
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

export const RescheduleSemiPrivateModal: React.FC<RescheduleSemiPrivateModalProps> = ({
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
  const [currentPairing, setCurrentPairing] = useState<CurrentPairing | null>(null);
  const [suggestedTimes, setSuggestedTimes] = useState<SuggestedTime[]>([]);
  const [weekAvailability, setWeekAvailability] = useState<DayAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedDay(null);
      setSelectedTime(null);
      setError(null);
      setSuccess(false);
      setShowWarning(false);
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsLoadingData(true);
    try {
      // Load current pairing
      const pairingResponse = await fetch('/api/reschedule-semi-private', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_current_pairing',
          registrationId,
          firebaseUid
        })
      });

      const pairingData = await pairingResponse.json();
      if (pairingData.success && pairingData.paired) {
        setCurrentPairing(pairingData.pairing);
      }

      // Load suggested times
      const suggestedResponse = await fetch('/api/reschedule-semi-private', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_suggested_times',
          registrationId,
          firebaseUid
        })
      });

      const suggestedData = await suggestedResponse.json();
      if (suggestedData.success) {
        setSuggestedTimes(suggestedData.suggestedTimes || []);
      }

      // Load availability
      const availResponse = await fetch('/api/reschedule-semi-private', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_availability',
          registrationId,
          firebaseUid
        })
      });

      const availData = await availResponse.json();
      if (availData.success) {
        setWeekAvailability(availData.availability);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load availability data');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSlotClick = (day: string, time: string, slot: TimeSlot) => {
    if (!slot.available || slot.isCurrent) return;

    setSelectedDay(day);
    setSelectedTime(time);
    setError(null);

    // Show warning if leaving a paired partner
    if (currentPairing && (day !== currentPairing.scheduledDay || time !== currentPairing.scheduledTime)) {
      setShowWarning(true);
    } else {
      setShowWarning(false);
    }
  };

  const handleSuggestedTimeClick = (suggested: SuggestedTime) => {
    setSelectedDay(suggested.day);
    setSelectedTime(suggested.time);
    setError(null);

    if (currentPairing) {
      setShowWarning(true);
    } else {
      setShowWarning(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedDay || !selectedTime) {
      setError('Please select a new day and time');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/reschedule-semi-private', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reschedule',
          registrationId,
          firebaseUid,
          changeType,
          newDay: selectedDay,
          newTime: selectedTime,
          effectiveDate: new Date().toISOString().split('T')[0]
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
        if (data.newPartner) {
          toast.success('Paired & Rescheduled!', `You've been paired with ${data.newPartner.name} for ${selectedDay} at ${selectedTime}`);
        } else {
          toast.warning('Rescheduled', `Your session has been moved to ${selectedDay} at ${selectedTime}. You'll be paired when a partner becomes available.`);
        }
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2500);
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
    return DAYS_OF_WEEK.find(d => d.value === day.toLowerCase())?.label || day;
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
          className="bg-gray-900 rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto border border-white/10"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-gray-900 z-10">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Users className="w-6 h-6 text-purple-400" />
                Reschedule Semi-Private Training
              </h2>
              {currentSchedule.day && currentSchedule.timeSlot && (
                <p className="text-sm text-gray-400 mt-1">
                  Current: {currentSchedule.day} at {currentSchedule.timeSlot}
                </p>
              )}
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
            {isLoadingData ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                <span className="ml-3 text-gray-400">Loading availability...</span>
              </div>
            ) : (
              <>
                {/* Current Status */}
                {currentPairing ? (
                  <div className="bg-purple-500/10 border border-purple-500/50 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Users className="w-5 h-5 text-purple-400 mt-0.5" />
                      <div>
                        <h3 className="font-medium text-purple-400">Currently Paired</h3>
                        <p className="text-sm text-gray-300 mt-1">
                          Training with: <span className="font-medium">{currentPairing.partnerName}</span> ({currentPairing.partnerCategory})
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Schedule: {currentPairing.scheduledDay} at {currentPairing.scheduledTime}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-500/10 border border-yellow-500/50 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                      <div>
                        <h3 className="font-medium text-yellow-400">Currently Unpaired</h3>
                        <p className="text-sm text-gray-300 mt-1">
                          We're looking for a partner for you. Check the suggested times below!
                        </p>
                      </div>
                    </div>
                  </div>
                )}

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

                {/* Suggested Times - Priority Display */}
                {suggestedTimes.length > 0 && (
                  <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-2 border-yellow-500/50 p-5 rounded-lg">
                    <div className="flex items-center gap-2 mb-4">
                      <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                      <h3 className="font-bold text-yellow-400">Recommended Times - Partner Available!</h3>
                    </div>
                    <p className="text-sm text-gray-300 mb-4">
                      These time slots have players in your age category waiting for a partner
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {suggestedTimes.map((suggested, index) => {
                        const isSelected = selectedDay === suggested.day && selectedTime === suggested.time;
                        return (
                          <button
                            key={index}
                            onClick={() => handleSuggestedTimeClick(suggested)}
                            className={`p-4 rounded-lg border-2 transition-all text-left ${
                              isSelected
                                ? 'border-yellow-400 bg-yellow-400/20'
                                : 'border-yellow-500/30 bg-yellow-500/10 hover:border-yellow-400/50'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="font-medium text-yellow-300">
                                  {getDayLabel(suggested.day)} at {suggested.time}
                                </div>
                                <div className="text-xs text-gray-300 mt-1">
                                  Partner: {suggested.partnerName}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  Category: {suggested.partnerCategory}
                                </div>
                              </div>
                              {isSelected && (
                                <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* All Available Times - Calendar Grid */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    All Available Times
                  </label>

                  <div className="bg-white/5 p-4 rounded-lg border border-white/10 overflow-x-auto">
                    {/* Legend */}
                    <div className="flex flex-wrap items-center gap-4 mb-4 text-xs">
                      <div className="flex items-center gap-2">
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        <span className="text-gray-400">Partner Available</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-500/20 border border-green-500 rounded"></div>
                        <span className="text-gray-400">Available</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-500/20 border border-red-500 rounded"></div>
                        <span className="text-gray-400">Booked</span>
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
                            const hasPartner = slot?.hasUnpairedPartner || false;

                            if (!slot) {
                              return <div key={`${day.value}-${time}`} className="h-12 bg-gray-800/50 rounded" />;
                            }

                            return (
                              <button
                                key={`${day.value}-${time}`}
                                onClick={() => handleSlotClick(day.value, time, slot)}
                                disabled={!slot.available || slot.isCurrent}
                                className={`h-12 rounded border-2 transition-all relative ${
                                  slot.isCurrent
                                    ? 'border-purple-500 bg-purple-500/20 text-purple-400 cursor-default'
                                    : isSelected
                                    ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                                    : hasPartner
                                    ? 'border-yellow-500/70 bg-yellow-500/15 text-yellow-300 hover:bg-yellow-500/25 hover:border-yellow-400 cursor-pointer'
                                    : slot.available
                                    ? 'border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:border-green-500 cursor-pointer'
                                    : 'border-red-500/50 bg-red-500/10 text-red-400 cursor-not-allowed opacity-50'
                                }`}
                              >
                                {hasPartner && (
                                  <Star className="w-3 h-3 absolute top-1 right-1 text-yellow-400 fill-yellow-400" />
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
                  </div>
                </div>

                {/* Warning about leaving partner */}
                {showWarning && currentPairing && (
                  <div className="bg-orange-500/10 border border-orange-500/50 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-orange-400">This will end your current pairing</h4>
                        <p className="text-sm text-gray-300 mt-1">
                          Rescheduling will unpair you from <span className="font-medium">{currentPairing.partnerName}</span>.
                          They will be notified and we'll help them find a new partner.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Selected time confirmation */}
                {selectedDay && selectedTime && (
                  <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
                    <p className="text-blue-400 text-sm">
                      ✓ New schedule: {getDayLabel(selectedDay)} at {selectedTime}
                    </p>
                    {(() => {
                      const slot = getSlotForDay(selectedDay, selectedTime);
                      if (slot?.hasUnpairedPartner) {
                        return (
                          <p className="text-green-400 text-sm mt-2">
                            🎉 Great news! You'll be automatically paired with {slot.partnerName}
                          </p>
                        );
                      } else {
                        return (
                          <p className="text-yellow-400 text-sm mt-2">
                            ℹ️ No partner at this time yet. We'll notify you when one is found.
                          </p>
                        );
                      }
                    })()}
                  </div>
                )}

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
              </>
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

export default RescheduleSemiPrivateModal;
