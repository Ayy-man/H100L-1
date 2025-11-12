import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WeekDay } from '../types';
import { generateMonthlyDates, formatDateForDisplay, getCurrentMonthYear } from '../lib/dateUtils';

interface ScheduleEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  registrationId: string;
  playerName: string;
  currentDays: WeekDay[];
  frequency: '1x' | '2x';
  onSave: (newDays: WeekDay[], newMonthlyDates: string[]) => Promise<void>;
}

const ScheduleEditModal: React.FC<ScheduleEditModalProps> = ({
  isOpen,
  onClose,
  registrationId,
  playerName,
  currentDays,
  frequency,
  onSave,
}) => {
  const [selectedDays, setSelectedDays] = useState<WeekDay[]>(currentDays);
  const [isSaving, setIsSaving] = useState(false);
  const [previewDates, setPreviewDates] = useState<string[]>([]);

  const daysOfWeek: { value: WeekDay; label: string }[] = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' },
  ];

  const maxDays = frequency === '1x' ? 1 : 2;
  const canSelectMore = selectedDays.length < maxDays;

  // Update selected days when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedDays(currentDays);
    }
  }, [isOpen, currentDays]);

  // Generate preview dates when selection changes
  useEffect(() => {
    if (selectedDays.length > 0) {
      const dates = generateMonthlyDates(selectedDays);
      setPreviewDates(dates);
    } else {
      setPreviewDates([]);
    }
  }, [selectedDays]);

  const handleDayToggle = (day: WeekDay) => {
    if (selectedDays.includes(day)) {
      // Remove day
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else if (canSelectMore) {
      // Add day
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(selectedDays, previewDates);
      onClose();
    } catch (error: any) {
      alert(`Failed to update schedule: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = JSON.stringify(selectedDays.sort()) !== JSON.stringify(currentDays.sort());

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex justify-between items-start p-6 border-b border-white/10">
            <div>
              <h2 className="text-2xl font-bold text-white uppercase tracking-wider">
                Edit Training Schedule
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                {playerName} • {frequency} per week
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Day Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Training {frequency === '1x' ? 'Day' : 'Days'} <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-400 mb-3">
                {frequency === '1x'
                  ? 'Choose 1 day per week for training'
                  : 'Choose 2 days per week for training'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {daysOfWeek.map(day => {
                  const isSelected = selectedDays.includes(day.value);
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
                Selected: {selectedDays.length} / {maxDays}
              </p>
            </div>

            {/* Preview */}
            {previewDates.length > 0 && (
              <div className="bg-white/10 p-4 rounded-lg">
                <h5 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#9BD4FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  New {getCurrentMonthYear()} Schedule
                </h5>
                <p className="text-sm text-gray-300 mb-3">
                  {previewDates.length} training sessions scheduled:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                  {previewDates.map((date) => (
                    <div
                      key={date}
                      className="p-2 rounded text-sm text-center bg-[#9BD4FF]/10 text-[#9BD4FF]"
                    >
                      {formatDateForDisplay(date)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Change Summary */}
            {hasChanges && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg">
                <p className="text-sm font-medium text-yellow-300 mb-2">📝 Schedule Changes</p>
                <div className="text-xs text-gray-300 space-y-1">
                  <p>
                    <span className="text-red-400">Old:</span>{' '}
                    {currentDays.length > 0
                      ? currentDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')
                      : 'None'}
                  </p>
                  <p>
                    <span className="text-green-400">New:</span>{' '}
                    {selectedDays.length > 0
                      ? selectedDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')
                      : 'None'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-white/10 flex gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 bg-gray-700 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-600 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges || selectedDays.length === 0}
              className="flex-1 bg-[#9BD4FF] text-black font-bold py-3 px-6 rounded-lg hover:shadow-[0_0_15px_#9BD4FF] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ScheduleEditModal;
