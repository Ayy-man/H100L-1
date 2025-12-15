import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  User,
  Coins,
  CreditCard,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import type { SessionType, SlotCapacity } from '@/types/credits';
import { SESSION_PRICING, CREDITS_PER_SESSION } from '@/types/credits';
import { formatPrice, getSessionPrice } from '@/lib/stripe';

interface BookSessionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  child?: ChildProfile | null;
  children?: ChildProfile[];
  allChildren?: ChildProfile[];
  preSelectedDate?: Date | null;
}

interface TimeSlotOption {
  time: string;
  available: boolean;
  currentBookings: number;
  maxCapacity: number;
}

/**
 * BookSessionModal Component
 *
 * Modal for booking a training session:
 * - Select child (if multiple)
 * - Select session type (group, Sunday, private, semi-private)
 * - Select date
 * - Select time slot
 * - Confirm and book (deduct credit or pay)
 */
const BookSessionModal: React.FC<BookSessionModalProps> = ({
  open,
  onClose,
  onSuccess,
  child,
  children = [],
  allChildren = [],
  preSelectedDate,
}) => {
  const { user } = useProfile();

  // Selection state
  const [selectedChild, setSelectedChild] = useState<string>(child?.registrationId || '');
  const [sessionType, setSessionType] = useState<SessionType>('group');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');

  // Data state
  const [availableSlots, setAvailableSlots] = useState<TimeSlotOption[]>([]);
  const [creditBalance, setCreditBalance] = useState<number>(0);

  // Loading state
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Derive children list (support both 'children' and 'allChildren' props)
  const childrenList = children.length > 0 ? children : (allChildren.length > 0 ? allChildren : (child ? [child] : []));

  // Pre-select date if provided
  useEffect(() => {
    if (preSelectedDate && open) {
      const dateStr = `${preSelectedDate.getFullYear()}-${String(preSelectedDate.getMonth() + 1).padStart(2, '0')}-${String(preSelectedDate.getDate()).padStart(2, '0')}`;
      setSelectedDate(dateStr);
      setCurrentMonth(preSelectedDate);
    }
  }, [preSelectedDate, open]);

  // Initialize selected child
  useEffect(() => {
    if (child && !selectedChild) {
      setSelectedChild(child.registrationId);
    }
  }, [child, selectedChild]);

  // Fetch credit balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!user) return;
      try {
        const response = await fetch(`/api/credit-balance?firebase_uid=${user.uid}`);
        const data = await response.json();
        setCreditBalance(data.total_credits || 0);
      } catch (err) {
        console.error('Error fetching balance:', err);
      }
    };
    if (open) fetchBalance();
  }, [user, open]);

  // Fetch available slots when date changes
  useEffect(() => {
    const fetchSlots = async () => {
      if (!selectedDate || !selectedChild) return;

      setLoadingSlots(true);
      try {
        const response = await fetch(
          `/api/check-availability?date=${selectedDate}&session_type=${sessionType}&registration_id=${selectedChild}`
        );
        const data = await response.json();

        if (data.slots) {
          setAvailableSlots(data.slots);
        } else {
          setAvailableSlots([]);
        }
      } catch (err) {
        console.error('Error fetching slots:', err);
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [selectedDate, sessionType, selectedChild]);

  // Handle booking
  const handleBook = async () => {
    if (!user || !selectedChild || !selectedDate || !selectedTime) {
      toast.error('Please complete all selections');
      return;
    }

    setBooking(true);

    try {
      // For group sessions, use credits; for others, use payment
      if (sessionType === 'group') {
        const response = await fetch('/api/book-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firebase_uid: user.uid,
            registration_id: selectedChild,
            session_type: sessionType,
            session_date: selectedDate,
            time_slot: selectedTime,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to book session');
        }

        toast.success('Session booked successfully!');
        onSuccess?.();
        onClose();
      } else {
        // Paid session - redirect to Stripe
        const response = await fetch('/api/purchase-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firebase_uid: user.uid,
            registration_id: selectedChild,
            session_type: sessionType,
            session_date: selectedDate,
            time_slot: selectedTime,
            success_url: `${window.location.origin}/dashboard?payment=success&type=session`,
            cancel_url: `${window.location.origin}/dashboard?payment=cancelled`,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to start checkout');
        }

        window.location.href = data.checkout_url;
      }
    } catch (err) {
      console.error('Booking error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to book session');
    } finally {
      setBooking(false);
    }
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const days: (Date | null)[] = [];

    // Padding for days before month starts
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }

    // Days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  // Check if date is selectable
  const isDateSelectable = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  };

  // Get cost info
  const getCostInfo = () => {
    if (sessionType === 'group') {
      return {
        type: 'credit',
        amount: CREDITS_PER_SESSION.group,
        label: `${CREDITS_PER_SESSION.group} Credit`,
        canAfford: creditBalance >= CREDITS_PER_SESSION.group,
      };
    }

    const pricing = SESSION_PRICING[sessionType as keyof typeof SESSION_PRICING];
    return {
      type: 'payment',
      amount: pricing?.price || 0,
      label: pricing ? formatPrice(pricing.price) : '$0',
      canAfford: true, // Payment sessions don't require credits
    };
  };

  const costInfo = getCostInfo();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Book a Session
          </DialogTitle>
          <DialogDescription>
            Select a date and time for your training session
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Child Selection (if multiple) */}
          {childrenList.length > 1 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Player</label>
              <Select value={selectedChild} onValueChange={setSelectedChild}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a player" />
                </SelectTrigger>
                <SelectContent>
                  {childrenList.map((c) => (
                    <SelectItem key={c.registrationId} value={c.registrationId}>
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {c.playerName} ({c.playerCategory})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Session Type Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Session Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['group', 'sunday', 'semi_private', 'private'] as SessionType[]).map((type) => {
                const labels: Record<SessionType, string> = {
                  group: 'Group Training',
                  sunday: 'Sunday Ice',
                  private: 'Private',
                  semi_private: 'Semi-Private',
                };
                const costs: Record<SessionType, string> = {
                  group: '1 Credit',
                  sunday: '$50',
                  private: '$89.99',
                  semi_private: '$69',
                };

                return (
                  <button
                    key={type}
                    onClick={() => {
                      setSessionType(type);
                      setSelectedTime('');
                    }}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      sessionType === type
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <p className="font-medium text-sm">{labels[type]}</p>
                    <p className="text-xs text-muted-foreground">{costs[type]}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Calendar */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Date</label>
            <div className="border rounded-lg p-3">
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-medium">
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="py-1">{day}</div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1">
                {generateCalendarDays().map((date, i) => {
                  if (!date) {
                    return <div key={`empty-${i}`} className="h-8" />;
                  }

                  const dateStr = date.toISOString().split('T')[0];
                  const isSelected = selectedDate === dateStr;
                  const isSelectable = isDateSelectable(date);

                  return (
                    <button
                      key={dateStr}
                      onClick={() => {
                        setSelectedDate(dateStr);
                        setSelectedTime('');
                      }}
                      disabled={!isSelectable}
                      className={`h-8 rounded text-sm transition-colors ${
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : isSelectable
                          ? 'hover:bg-accent'
                          : 'text-muted-foreground/50 cursor-not-allowed'
                      }`}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Time Slots */}
          {selectedDate && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Time</label>
              {loadingSlots ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : availableSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No available slots for this date
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() => setSelectedTime(slot.time)}
                      disabled={!slot.available}
                      className={`p-2 rounded-lg border text-sm transition-all ${
                        selectedTime === slot.time
                          ? 'border-primary bg-primary/5 font-medium'
                          : slot.available
                          ? 'border-border hover:border-primary/50'
                          : 'border-border bg-muted/50 text-muted-foreground cursor-not-allowed'
                      }`}
                    >
                      <Clock className="h-3 w-3 mx-auto mb-1" />
                      {slot.time}
                      <p className="text-xs text-muted-foreground">
                        {slot.available
                          ? `${slot.maxCapacity - slot.currentBookings} spots`
                          : 'Full'}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cost Summary */}
          {selectedDate && selectedTime && (
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cost</span>
                <div className="flex items-center gap-2">
                  {costInfo.type === 'credit' ? (
                    <>
                      <Coins className="h-4 w-4 text-primary" />
                      <span className="font-medium">{costInfo.label}</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 text-primary" />
                      <span className="font-medium">{costInfo.label}</span>
                    </>
                  )}
                </div>
              </div>
              {costInfo.type === 'credit' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Your balance: {creditBalance} credit{creditBalance !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          {/* Insufficient Credits Warning */}
          {sessionType === 'group' && !costInfo.canAfford && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Not enough credits. You need {CREDITS_PER_SESSION.group} credit but have {creditBalance}.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleBook}
            disabled={!selectedChild || !selectedDate || !selectedTime || booking || (sessionType === 'group' && !costInfo.canAfford)}
            className="flex-1"
          >
            {booking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Booking...
              </>
            ) : sessionType === 'group' ? (
              <>
                <Coins className="mr-2 h-4 w-4" />
                Book with Credit
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Pay & Book
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BookSessionModal;
