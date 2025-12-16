import React, { useState, useMemo } from 'react';
import {
  Repeat,
  User,
  Calendar,
  Clock,
  Loader2,
  Info,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProfile } from '@/contexts/ProfileContext';
import { toast } from 'sonner';
import type { ChildProfile } from '@/contexts/ProfileContext';
import type { DayOfWeek } from '@/types/credits';
import { findSlotForCategory } from '@/lib/timeSlots';
import type { PlayerCategory } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';

interface SetupRecurringModalProps {
  open: boolean;
  onClose: () => void;
  children: ChildProfile[];
  onSuccess: () => void;
}

// Days available for group training (7 days a week)
const AVAILABLE_DAYS: { value: DayOfWeek; labelEn: string; labelFr: string }[] = [
  { value: 'monday', labelEn: 'Monday', labelFr: 'Lundi' },
  { value: 'tuesday', labelEn: 'Tuesday', labelFr: 'Mardi' },
  { value: 'wednesday', labelEn: 'Wednesday', labelFr: 'Mercredi' },
  { value: 'thursday', labelEn: 'Thursday', labelFr: 'Jeudi' },
  { value: 'friday', labelEn: 'Friday', labelFr: 'Vendredi' },
  { value: 'saturday', labelEn: 'Saturday', labelFr: 'Samedi' },
  { value: 'sunday', labelEn: 'Sunday', labelFr: 'Dimanche' },
];

/**
 * SetupRecurringModal Component
 *
 * Modal for setting up automatic weekly bookings:
 * - Select child
 * - Select day of week
 * - Select time slot
 * - Creates recurring schedule via API
 */
const SetupRecurringModal: React.FC<SetupRecurringModalProps> = ({
  open,
  onClose,
  children,
  onSuccess,
}) => {
  const { user } = useProfile();
  const { language } = useLanguage();
  const isFrench = language === 'fr';
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | ''>('');
  const [loading, setLoading] = useState(false);

  // Auto-determine time slot based on selected child's category
  const selectedChildData = useMemo(() => {
    return children.find(c => c.registrationId === selectedChild);
  }, [children, selectedChild]);

  const assignedTimeSlot = useMemo(() => {
    if (!selectedChildData?.playerCategory) return null;
    return findSlotForCategory(selectedChildData.playerCategory as PlayerCategory);
  }, [selectedChildData]);

  // Reset form when modal closes
  const handleClose = () => {
    setSelectedChild('');
    setSelectedDay('');
    onClose();
  };

  // Create recurring schedule
  const handleSubmit = async () => {
    if (!user || !selectedChild || !selectedDay || !assignedTimeSlot) {
      toast.error(isFrench ? 'Veuillez sélectionner un joueur et un jour' : 'Please select a player and day');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/recurring-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebase_uid: user.uid,
          registration_id: selectedChild,
          session_type: 'group',
          day_of_week: selectedDay,
          time_slot: assignedTimeSlot.time,
        }),
      });

      // Handle non-JSON responses (e.g., Vercel errors)
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || `Server error (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create recurring schedule');
      }

      toast.success(isFrench ? 'Horaire récurrent configuré avec succès!' : 'Recurring schedule set up successfully!');
      onSuccess();
      handleClose();
    } catch (err) {
      console.error('Error creating recurring schedule:', err);
      toast.error(err instanceof Error ? err.message : (isFrench ? 'Échec de la configuration de l\'horaire récurrent' : 'Failed to set up recurring schedule'));
    } finally {
      setLoading(false);
    }
  };

  // Get the selected child's name for display
  const getChildName = (registrationId: string) => {
    return children.find(c => c.registrationId === registrationId)?.playerName || '';
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-primary" />
            {isFrench ? 'Configurer une réservation récurrente' : 'Set Up Recurring Booking'}
          </DialogTitle>
          <DialogDescription>
            {isFrench ? 'Réservez automatiquement le même créneau d\'entraînement chaque semaine. 1 crédit sera déduit chaque semaine.' : 'Automatically book the same training slot every week. 1 credit will be deducted each week.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Child Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              {isFrench ? 'Sélectionner le joueur' : 'Select Player'}
            </label>
            <Select value={selectedChild} onValueChange={setSelectedChild}>
              <SelectTrigger>
                <SelectValue placeholder={isFrench ? 'Choisir un joueur' : 'Choose a player'} />
              </SelectTrigger>
              <SelectContent>
                {children.map((child) => (
                  <SelectItem key={child.registrationId} value={child.registrationId}>
                    {child.playerName} ({child.playerCategory})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Day Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {isFrench ? 'Sélectionner le jour' : 'Select Day'}
            </label>
            <Select value={selectedDay} onValueChange={(v) => setSelectedDay(v as DayOfWeek)}>
              <SelectTrigger>
                <SelectValue placeholder={isFrench ? 'Choisir un jour' : 'Choose a day'} />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_DAYS.map((day) => (
                  <SelectItem key={day.value} value={day.value}>
                    {isFrench ? day.labelFr : day.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Auto-assigned Time Slot */}
          {selectedChild && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {isFrench ? 'Créneau horaire assigné' : 'Assigned Time Slot'}
              </label>
              {assignedTimeSlot ? (
                <div className="p-3 rounded-lg bg-muted border flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="font-medium">{assignedTimeSlot.time}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {isFrench ? `Basé sur la catégorie ${selectedChildData?.playerCategory}` : `Based on ${selectedChildData?.playerCategory} category`}
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-2">
                  <Info className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-yellow-600">
                    {isFrench ? 'Impossible de déterminer le créneau horaire pour la catégorie de ce joueur' : "Unable to determine time slot for this player's category"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {selectedChild && selectedDay && assignedTimeSlot && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm font-medium text-primary">{isFrench ? 'Résumé' : 'Summary'}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {isFrench ? (
                  <>
                    <strong>{getChildName(selectedChild)}</strong> sera automatiquement inscrit pour
                    l'entraînement de groupe chaque <strong>{AVAILABLE_DAYS.find(d => d.value === selectedDay)?.labelFr}</strong> à{' '}
                    <strong>{assignedTimeSlot.time}</strong>.
                  </>
                ) : (
                  <>
                    <strong>{getChildName(selectedChild)}</strong> will be automatically booked for
                    group training every <strong>{AVAILABLE_DAYS.find(d => d.value === selectedDay)?.labelEn}</strong> at{' '}
                    <strong>{assignedTimeSlot.time}</strong>.
                  </>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {isFrench ? '1 crédit sera déduit chaque semaine. Vous pouvez suspendre ou annuler à tout moment.' : '1 credit will be deducted weekly. You can pause or cancel anytime.'}
              </p>
            </div>
          )}

          {/* Info */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• {isFrench ? 'Les crédits sont déduits automatiquement chaque semaine' : 'Credits are deducted automatically each week'}</p>
            <p>• {isFrench ? 'L\'horaire est suspendu si les crédits sont épuisés' : 'Schedule pauses if credits run out'}</p>
            <p>• {isFrench ? 'Vous pouvez suspendre ou supprimer à tout moment depuis le tableau de bord' : 'You can pause or delete anytime from the dashboard'}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            {isFrench ? 'Annuler' : 'Cancel'}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedChild || !selectedDay || !assignedTimeSlot || loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isFrench ? 'Configuration...' : 'Setting up...'}
              </>
            ) : (
              <>
                <Repeat className="mr-2 h-4 w-4" />
                {isFrench ? 'Configurer récurrent' : 'Set Up Recurring'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SetupRecurringModal;
