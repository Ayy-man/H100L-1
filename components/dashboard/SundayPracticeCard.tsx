import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Registration } from '@/types';
import {
  SUNDAY_PRACTICE_CONFIG,
  formatTimeSlot,
  formatPracticeDate,
  canCancelBooking,
  type NextSlotResponse,
} from '@/lib/sunday-practice-config';

interface SundayPracticeCardProps {
  registration: Registration;
}

interface AvailableSlot {
  slot_id: string;
  date: string;
  start_time: string;
  end_time: string;
  time_range: string;
  min_category: string;
  max_category: string;
  available_spots: number;
  max_capacity: number;
  current_bookings: number;
  player_booked: boolean;
  booking_id?: string;
}

interface WeekSlots {
  date: string;
  slots: AvailableSlot[];
}

/**
 * Sunday Practice Card Component
 *
 * Displays Sunday real ice practice booking options for parents.
 * Only visible to Group Training players (M11+).
 *
 * Features:
 * - Eligibility check (Group Training + M11+)
 * - Next Sunday slot availability
 * - Book/Cancel functionality
 * - Real-time capacity updates
 * - Booking status display
 */
const SundayPracticeCard: React.FC<SundayPracticeCardProps> = ({ registration }) => {
  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState(false);
  const [upcomingWeeks, setUpcomingWeeks] = useState<WeekSlots[]>([]);
  const [ineligibleReason, setIneligibleReason] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch eligibility and available slots for next 2 weeks
  const fetchNextSlot = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/sunday-upcoming-slots?registrationId=${registration.id}&firebaseUid=${registration.firebase_uid}&weeks=2`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const data = await response.json();


      if (!response.ok) {
        console.error('API error:', data);
        setEligible(false);
        setIneligibleReason(data.error || data.reason || 'Unable to check eligibility');
        return;
      }

      if (!data.success) {
        console.error('Failed to fetch upcoming slots:', data);
        setEligible(false);
        setIneligibleReason(data.reason || data.error || 'Unable to check eligibility');
        return;
      }

      setEligible(data.eligible);

      if (!data.eligible) {
        setIneligibleReason(data.reason || 'Not eligible for Sunday practice');
        return;
      }

      // Process weeks data
      if (data.weeks && data.weeks.length > 0) {
        setUpcomingWeeks(data.weeks);
      } else {
        setUpcomingWeeks([]);
      }
    } catch (error) {
      console.error('Error fetching upcoming slots:', error);
      toast.error('Failed to load Sunday practice information');
      setEligible(false);
    } finally {
      setLoading(false);
    }
  };

  // Book a slot
  const handleBook = async (slotId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/sunday-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId,
          registrationId: registration.id,
          firebaseUid: registration.firebase_uid,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        toast.error(data.error || SUNDAY_PRACTICE_CONFIG.messages.bookingError);
        return;
      }

      toast.success(SUNDAY_PRACTICE_CONFIG.messages.bookingSuccess);

      // Refresh data
      await fetchNextSlot();
    } catch (error) {
      console.error('Booking error:', error);
      toast.error(SUNDAY_PRACTICE_CONFIG.messages.bookingError);
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel a booking
  const handleCancel = async (bookingId: string) => {
    if (!bookingId) return;

    setActionLoading(true);
    try {
      const response = await fetch('/api/sunday-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          registrationId: registration.id,
          firebaseUid: registration.firebase_uid,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        toast.error(data.error || 'Failed to cancel booking');
        return;
      }

      toast.success(SUNDAY_PRACTICE_CONFIG.messages.cancellationSuccess);

      // Refresh data
      await fetchNextSlot();
    } catch (error) {
      console.error('Cancellation error:', error);
      toast.error('Failed to cancel booking');
    } finally {
      setActionLoading(false);
    }
  };

  // Get all booked slots across all weeks
  const getBookedSlots = () => {
    const booked: Array<{ week: WeekSlots; slot: AvailableSlot }> = [];
    upcomingWeeks.forEach((week) => {
      week.slots?.forEach((slot) => {
        if (slot.player_booked) {
          booked.push({ week, slot });
        }
      });
    });
    return booked;
  };

  // Get all available (not booked) slots across all weeks
  const getAvailableSlots = () => {
    const available: Array<{ week: WeekSlots; slot: AvailableSlot }> = [];
    upcomingWeeks.forEach((week) => {
      week.slots?.forEach((slot) => {
        if (!slot.player_booked) {
          available.push({ week, slot });
        }
      });
    });
    return available;
  };

  // Helper function to get capacity status information
  const getCapacityStatus = (availableSpots: number, maxCapacity: number) => {
    if (availableSpots === 0) {
      return {
        text: 'Fully Booked',
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200',
        badgeVariant: 'destructive' as const,
      };
    } else if (availableSpots <= 2) {
      return {
        text: `Almost Full - ${availableSpots} spot${availableSpots === 1 ? '' : 's'} left`,
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-700',
        borderColor: 'border-yellow-200',
        badgeVariant: 'secondary' as const,
      };
    } else {
      return {
        text: `${availableSpots} spots remaining`,
        bgColor: 'bg-green-50',
        textColor: 'text-green-700',
        borderColor: 'border-green-200',
        badgeVariant: 'default' as const,
      };
    }
  };

  // Load data on mount
  useEffect(() => {
    fetchNextSlot();
  }, [registration.id]);

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Sunday Real Ice Practice
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Not eligible
  if (!eligible) {
    return (
      <Card className="border-muted">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            Sunday Real Ice Practice
          </CardTitle>
          <CardDescription>Free weekly ice practice included with Group Training</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
            <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <p className="text-sm text-muted-foreground">{ineligibleReason}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const bookedSlots = getBookedSlots();
  const availableSlots = getAvailableSlots();

  // Already booked - show existing bookings
  if (bookedSlots.length > 0) {
    return (
      <Card className="border-primary/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Sunday Real Ice Practice
          </CardTitle>
          <CardDescription>Your upcoming Sunday practice session</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Booking Confirmation */}
          <div className="p-4 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-green-900">Booking Confirmed</p>
                <p className="text-sm text-green-700 mt-1">
                  You're all set for Sunday practice!
                </p>
              </div>
            </div>
          </div>

          {/* Practice Details */}
          {bookedSlots.map(({ week, slot }) => (
            <div key={slot.slot_id} className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Date</p>
                  <p className="text-base font-semibold text-foreground">
                    {formatPracticeDate(new Date(week.date))}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Time</p>
                  <p className="text-base font-semibold text-foreground">
                    {slot.time_range}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Location</p>
                  <p className="text-base font-semibold text-foreground">
                    {SUNDAY_PRACTICE_CONFIG.location.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {SUNDAY_PRACTICE_CONFIG.location.fullAddress}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Capacity</p>
                  <p className="text-base font-semibold text-foreground">
                    {slot.current_bookings}/{slot.max_capacity} spots filled
                  </p>
                </div>
              </div>

              {slot.booking_id && (
                <>
                  <Separator />
                  {/* Cancel Button with Confirmation Dialog */}
                  {canCancelBooking(new Date(week.date)) && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          disabled={actionLoading}
                          className="w-full text-destructive hover:text-destructive"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancel Booking
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel Sunday Practice Booking?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to cancel your booking for {formatPracticeDate(new Date(week.date))} at {slot.time_range}?
                            This will free up your spot for other players.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleCancel(slot.booking_id!)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            {actionLoading ? 'Cancelling...' : 'Yes, Cancel Booking'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <p className="text-xs text-muted-foreground text-center">
                    ℹ️ You can cancel anytime before the practice
                  </p>
                </>
              )}
            </div>
          ))}

          {/* Important Notes */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="font-semibold text-xs mb-1">Important Notes</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• Please arrive 15 minutes before your session</li>
              <li>• Bring full hockey equipment</li>
              <li>• Sunday practice is included free with your subscription</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Available to book
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Sunday Real Ice Practice
        </CardTitle>
        <CardDescription>
          Book your free weekly ice practice session
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Available Time Slots - Grouped by Week */}
        {availableSlots.length > 0 ? (
          <div className="space-y-4">
            <p className="font-semibold text-sm">Next 2 Sundays - Select Your Time Slot</p>

            {/* Group slots by week */}
            {upcomingWeeks.map((week, weekIndex) => {
              const weekAvailableSlots = availableSlots.filter(
                (item) => item.week.date === week.date
              );

              if (weekAvailableSlots.length === 0) return null;

              return (
                <div key={week.date} className="space-y-3">
                  {/* Week Header */}
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        <div>
                          <p className="font-semibold text-sm">
                            {weekIndex === 0 ? 'This Sunday' : 'Next Sunday'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatPracticeDate(new Date(week.date))}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Slots for this week */}
                  {weekAvailableSlots.map(({ slot }) => {
                    const capacityStatus = getCapacityStatus(slot.available_spots, slot.max_capacity);
                    return (
                      <div
                        key={slot.slot_id}
                        className="p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex-1">
                            <p className="font-semibold text-base">{slot.time_range}</p>
                            <p className="text-sm text-muted-foreground">
                              Ages: {slot.min_category} - {slot.max_category}
                            </p>
                          </div>
                          <Badge
                            variant={capacityStatus.badgeVariant}
                            className={`flex items-center gap-1 ${capacityStatus.bgColor} ${capacityStatus.textColor} ${capacityStatus.borderColor}`}
                          >
                            <Users className="h-3 w-3" />
                            {slot.available_spots}/{slot.max_capacity}
                          </Badge>
                        </div>

                        {/* Capacity Status Text */}
                        <div className={`mb-3 p-2 rounded text-center text-sm font-medium ${capacityStatus.bgColor} ${capacityStatus.textColor}`}>
                          {capacityStatus.text}
                        </div>

                        <Button
                          onClick={() => handleBook(slot.slot_id)}
                          disabled={actionLoading || slot.available_spots === 0}
                          className="w-full"
                        >
                          {actionLoading
                            ? 'Booking...'
                            : slot.available_spots === 0
                            ? 'Fully Booked'
                            : 'Book My Spot'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-muted/50 border border-border text-center">
            <p className="text-sm text-muted-foreground">
              {SUNDAY_PRACTICE_CONFIG.display.emptySlotMessage}
            </p>
          </div>
        )}

        <Separator />

        {/* Location Info */}
        <div className="p-4 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Practice Location</p>
              <p className="text-sm font-medium mt-1">
                {SUNDAY_PRACTICE_CONFIG.location.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {SUNDAY_PRACTICE_CONFIG.location.fullAddress}
              </p>
            </div>
          </div>
        </div>

        {/* Important Notes */}
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
          <p className="font-semibold text-xs mb-1 text-blue-900">
            Important Information
          </p>
          <ul className="space-y-1 text-xs text-blue-700">
            <li>• Sunday practice is FREE and included with your subscription</li>
            <li>• You can book for either of the next 2 upcoming Sundays</li>
            <li>• Cancel anytime before the practice if plans change</li>
            <li>• Arrive 15 minutes early with full equipment</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default SundayPracticeCard;
