import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Registration } from '@/types';
import { toast } from 'sonner';
import { RescheduleGroupModal } from './RescheduleGroupModal';
import { ReschedulePrivateModal } from './ReschedulePrivateModal';
import { RescheduleSemiPrivateModal } from './RescheduleSemiPrivateModal';
import { findSlotForCategory, findSundaySlotForCategory } from '@/lib/timeSlots';
import { PlayerCategory } from '@/types';

interface TrainingScheduleProps {
  registration: Registration;
}

interface SundayBookingStatus {
  eligible: boolean;
  already_booked: boolean;
  next_sunday: string;
  available_slots: Array<{
    slot_id: string;
    slot_date: string;
    start_time: string;
    end_time: string;
    capacity: number;
    current_bookings: number;
    spots_remaining: number;
  }>;
  existing_booking?: {
    booking_id: string;
    slot_date: string;
    start_time: string;
    end_time: string;
  };
  reason?: string;
}

/**
 * Training Schedule Component
 *
 * Displays upcoming training sessions based on the program type:
 * - Weekday synthetic ice sessions
 * - Sunday real ice practice (INTERACTIVE - can book next Sunday)
 * - Location details
 */
interface ScheduleException {
  exception_date: string;
  exception_type: string;
  replacement_day: string;
  replacement_time?: string;
  status: string;
}

interface DayCapacity {
  day: string;
  spotsUsed: number;
  spotsRemaining: number;
  totalCapacity: number;
  isFull: boolean;
}

interface SemiPrivatePairing {
  scheduled_day: string;
  scheduled_time: string;
  partner_name?: string;
}

interface WaitingInfo {
  waitingSince: string;
  preferredDays: string[];
  preferredTimeSlots: string[];
  playerCategory: string;
}

const TrainingSchedule: React.FC<TrainingScheduleProps> = ({ registration }) => {
  const { form_data, firebase_uid, id } = registration;
  const [sundayStatus, setSundayStatus] = useState<SundayBookingStatus | null>(null);
  const [loadingSunday, setLoadingSunday] = useState(false);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scheduleExceptions, setScheduleExceptions] = useState<ScheduleException[]>([]);
  const [dayCapacity, setDayCapacity] = useState<Record<string, DayCapacity>>({});
  const [semiPrivatePairing, setSemiPrivatePairing] = useState<SemiPrivatePairing | null>(null);
  const [isWaitingForPartner, setIsWaitingForPartner] = useState(false);
  const [waitingInfo, setWaitingInfo] = useState<WaitingInfo | null>(null);

  // Helper function to check Sunday eligibility
  const isSundayEligible = () => {
    // Only Group Training players
    if (form_data.programType !== 'group') return false;

    // Extract category number
    const playerCategory = form_data.playerCategory;
    if (!playerCategory) return false;

    // Extract numeric part from category (e.g., "M11" -> 11, "M13 Elite" -> 13)
    const categoryMatch = playerCategory.match(/M(\d+)/);
    if (!categoryMatch) return false;

    const categoryNum = parseInt(categoryMatch[1], 10);

    // Only M7-M15 are eligible for Sunday ice (M18/Junior are not)
    return categoryNum >= 7 && categoryNum <= 15;
  };

  // Get next 4 weeks of training dates
  const getUpcomingSessions = () => {
    const sessions: Array<{
      date: Date;
      day: string;
      type: 'synthetic' | 'real-ice';
      time?: string;
      isException?: boolean;
    }> = [];

    const today = new Date();
    const weeksToShow = 4;

    // Helper to format date as YYYY-MM-DD in LOCAL timezone (not UTC)
    // Using toISOString() can cause off-by-one-day errors due to timezone conversion
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Helper to check if there's an exception for a given date
    const getExceptionForDate = (dateStr: string) => {
      console.log(`[getExceptionForDate] Looking for exception on date: ${dateStr}`);
      console.log(`[getExceptionForDate] Available exceptions:`, scheduleExceptions.map(e => ({
        date: e.exception_date,
        replacement_day: e.replacement_day,
        status: e.status,
        type: e.exception_type
      })));

      const exception = scheduleExceptions.find(
        (exc) => exc.exception_date === dateStr && exc.status === 'applied'
      );

      if (exception) {
        console.log(`[getExceptionForDate] FOUND exception: ${dateStr} -> ${exception.replacement_day}`);
      } else {
        console.log(`[getExceptionForDate] No exception found for ${dateStr}`);
      }

      return exception;
    };

    // Add weekday sessions based on program type
    if (form_data.programType === 'group' && form_data.groupSelectedDays) {
      const dayMap: { [key: string]: number } = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };
      const reverseDayMap: { [key: number]: string } = {
        0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
        4: 'Thursday', 5: 'Friday', 6: 'Saturday',
      };

      // Get the assigned time slot based on player's age category
      const assignedSlot = form_data.playerCategory
        ? findSlotForCategory(form_data.playerCategory as PlayerCategory)
        : null;
      const groupTimeSlot = assignedSlot?.time;

      for (let week = 0; week < weeksToShow; week++) {
        form_data.groupSelectedDays.forEach((day) => {
          const targetDay = dayMap[day.toLowerCase()];
          if (targetDay !== undefined) {
            const date = new Date(today);
            date.setDate(today.getDate() + (7 * week) + (targetDay - today.getDay() + 7) % 7);

            // Only add future dates
            if (date >= today) {
              const dateStr = formatDate(date);
              const exception = getExceptionForDate(dateStr);

              if (exception && exception.exception_type === 'swap') {
                // Replace with the exception day
                const replacementDayNum = dayMap[exception.replacement_day.toLowerCase()];
                if (replacementDayNum !== undefined) {
                  const replacementDate = new Date(date);
                  // Calculate the replacement date in the same week
                  const dayDiff = replacementDayNum - date.getDay();
                  replacementDate.setDate(date.getDate() + dayDiff);

                  sessions.push({
                    date: replacementDate,
                    day: reverseDayMap[replacementDayNum] || exception.replacement_day,
                    type: 'synthetic',
                    time: groupTimeSlot,
                    isException: true,
                  });
                }
              } else {
                // Normal session
                sessions.push({
                  date,
                  day: day.charAt(0).toUpperCase() + day.slice(1),
                  type: 'synthetic',
                  time: groupTimeSlot,
                });
              }
            }
          }
        });
      }
    } else if (form_data.programType === 'private' && form_data.privateSelectedDays) {
      const dayMap: { [key: string]: number } = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };
      const reverseDayMap: { [key: number]: string } = {
        0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
        4: 'Thursday', 5: 'Friday', 6: 'Saturday',
      };

      for (let week = 0; week < weeksToShow; week++) {
        form_data.privateSelectedDays.forEach((day) => {
          const targetDay = dayMap[day.toLowerCase()];
          if (targetDay !== undefined) {
            const date = new Date(today);
            date.setDate(today.getDate() + (7 * week) + (targetDay - today.getDay() + 7) % 7);

            if (date >= today) {
              const dateStr = formatDate(date);
              const exception = getExceptionForDate(dateStr);

              if (exception && exception.exception_type === 'swap') {
                // Replace with the exception day
                const replacementDayNum = dayMap[exception.replacement_day.toLowerCase()];
                if (replacementDayNum !== undefined) {
                  const replacementDate = new Date(date);
                  const dayDiff = replacementDayNum - date.getDay();
                  replacementDate.setDate(date.getDate() + dayDiff);

                  sessions.push({
                    date: replacementDate,
                    day: reverseDayMap[replacementDayNum] || exception.replacement_day,
                    type: 'synthetic',
                    time: exception.replacement_time || form_data.privateTimeSlot,
                    isException: true,
                  });
                }
              } else {
                // Normal session
                sessions.push({
                  date,
                  day: day.charAt(0).toUpperCase() + day.slice(1),
                  type: 'synthetic',
                  time: form_data.privateTimeSlot,
                });
              }
            }
          }
        });
      }
    } else if (form_data.programType === 'semi-private') {
      const dayMap: { [key: string]: number } = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };
      const reverseDayMap: { [key: number]: string } = {
        0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
        4: 'Thursday', 5: 'Friday', 6: 'Saturday',
      };

      // Use pairing's scheduled day/time if paired, otherwise fall back to form data
      // This is CRITICAL - semiPrivateAvailability is PREFERENCES, not the actual schedule!
      const semiPrivateTime = semiPrivatePairing?.scheduled_time ||
        form_data.semiPrivateTimeSlot ||
        (form_data.semiPrivateTimeWindows && form_data.semiPrivateTimeWindows[0]) ||
        null;

      // Semi-private is ONLY 1x per week - use pairing day or first availability
      const day = semiPrivatePairing?.scheduled_day || form_data.semiPrivateAvailability?.[0];

      if (!day) {
        console.log('No semi-private day found (no pairing and no availability)');
        return sessions;
      }

      console.log('Semi-private scheduled day:', day, 'from pairing:', !!semiPrivatePairing);

      for (let week = 0; week < weeksToShow; week++) {
        const targetDay = dayMap[day.toLowerCase()];
        if (targetDay !== undefined) {
          const date = new Date(today);
          date.setDate(today.getDate() + (7 * week) + (targetDay - today.getDay() + 7) % 7);

          if (date >= today) {
            const dateStr = formatDate(date);
            const exception = getExceptionForDate(dateStr);

            if (exception && exception.exception_type === 'swap') {
              // Replace with the exception day
              const replacementDayNum = dayMap[exception.replacement_day.toLowerCase()];
              if (replacementDayNum !== undefined) {
                const replacementDate = new Date(date);
                const dayDiff = replacementDayNum - date.getDay();
                replacementDate.setDate(date.getDate() + dayDiff);

                sessions.push({
                  date: replacementDate,
                  day: reverseDayMap[replacementDayNum] || exception.replacement_day,
                  type: 'synthetic',
                  time: exception.replacement_time || semiPrivateTime,
                  isException: true,
                });
              }
            } else {
              // Normal session
              sessions.push({
                date,
                day: day.charAt(0).toUpperCase() + day.slice(1),
                type: 'synthetic',
                time: semiPrivateTime,
              });
            }
          }
        }
      }
    }

    // Add Sunday ice practice sessions ONLY if eligible (M7-M15 Group Training)
    if (isSundayEligible()) {
      // Get the Sunday time slot based on player's category
      const sundaySlot = form_data.playerCategory
        ? findSundaySlotForCategory(form_data.playerCategory as PlayerCategory)
        : null;

      for (let week = 0; week < weeksToShow; week++) {
        const date = new Date(today);
        const daysUntilSunday = (7 - today.getDay() + 7) % 7 || 7;
        date.setDate(today.getDate() + daysUntilSunday + (7 * week));

        if (date >= today) {
          sessions.push({
            date,
            day: 'Sunday',
            type: 'real-ice',
            time: sundaySlot?.time,
          });
        }
      }
    }

    // Sort by date
    sessions.sort((a, b) => a.date.getTime() - b.date.getTime());

    return sessions.slice(0, 8); // Show next 8 sessions
  };

  const upcomingSessions = getUpcomingSessions();

  // Fetch schedule exceptions for one-time changes
  useEffect(() => {
    const fetchScheduleExceptions = async () => {
      if (!id) return;
      try {
        console.log('=== FETCHING SCHEDULE EXCEPTIONS ===');
        console.log('Registration ID:', id);
        const response = await fetch(
          `/api/schedule-exceptions?registrationId=${id}`
        );
        if (response.ok) {
          const data = await response.json();
          console.log('=== EXCEPTIONS RESPONSE ===');
          console.log('Success:', data.success);
          console.log('Count:', data.exceptions?.length || 0);
          console.log('Debug info:', data.debug);
          console.log('Full exceptions:', JSON.stringify(data.exceptions, null, 2));
          if (data.success && data.exceptions) {
            setScheduleExceptions(data.exceptions);
          }
        } else {
          console.error('Failed to fetch exceptions, status:', response.status);
          const errorText = await response.text();
          console.error('Error response:', errorText);
        }
      } catch (error) {
        console.error('Failed to fetch schedule exceptions:', error);
      }
    };

    fetchScheduleExceptions();
  }, [id, refreshKey]);

  // Fetch semi-private pairing to get the ACTUAL scheduled day (not just preferences)
  useEffect(() => {
    const fetchSemiPrivatePairing = async () => {
      if (form_data.programType !== 'semi-private' || !id || !firebase_uid) return;

      try {
        console.log('=== FETCHING SEMI-PRIVATE PAIRING ===');
        const response = await fetch('/api/reschedule-semi-private', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get_current_pairing',
            registrationId: id,
            firebaseUid: firebase_uid
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Pairing response:', data);
          if (data.success && data.paired && data.pairing) {
            setSemiPrivatePairing({
              scheduled_day: data.pairing.scheduledDay,
              scheduled_time: data.pairing.scheduledTime,
              partner_name: data.pairing.partnerName
            });
            setIsWaitingForPartner(false);
            setWaitingInfo(null);
            console.log('Set semi-private pairing:', data.pairing.scheduledDay, data.pairing.scheduledTime);
          } else if (data.success && data.waiting && data.waitingInfo) {
            // Player is waiting to be paired
            setIsWaitingForPartner(true);
            setWaitingInfo(data.waitingInfo);
            setSemiPrivatePairing(null);
            console.log('Player is waiting for partner since:', data.waitingInfo.waitingSince);
          } else {
            console.log('Not paired and not waiting, using availability preferences');
            setIsWaitingForPartner(false);
            setWaitingInfo(null);
          }
        }
      } catch (error) {
        console.error('Failed to fetch semi-private pairing:', error);
      }
    };

    fetchSemiPrivatePairing();
  }, [form_data.programType, id, firebase_uid, refreshKey]);

  // Fetch capacity for group training days
  useEffect(() => {
    const fetchCapacity = async () => {
      if (form_data.programType !== 'group' || !form_data.groupSelectedDays) return;

      try {
        const days = form_data.groupSelectedDays.join(',');
        const response = await fetch(`/api/group-capacity?days=${days}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.capacity) {
            setDayCapacity(data.capacity);
          }
        }
      } catch (error) {
        console.error('Failed to fetch capacity:', error);
      }
    };

    fetchCapacity();
  }, [form_data.programType, form_data.groupSelectedDays, refreshKey]);

  // Fetch Sunday booking status
  useEffect(() => {
    const fetchSundayStatus = async () => {
      if (!firebase_uid || !id) return;

      setLoadingSunday(true);
      try {
        const response = await fetch(
          `/api/sunday-next-slot?registrationId=${id}&firebaseUid=${firebase_uid}`
        );
        const data = await response.json();

        console.log('TrainingSchedule - Sunday status:', data);

        if (response.ok && data.success) {
          setSundayStatus(data);
          // Toast notifications removed - only show on user actions (book/cancel)
        } else {
          console.error('Sunday status check failed:', data);
        }
      } catch (error) {
        console.error('Failed to fetch Sunday status:', error);
      } finally {
        setLoadingSunday(false);
      }
    };

    fetchSundayStatus();
  }, [firebase_uid, id]);

  // Handle Sunday booking
  const handleBookSunday = async () => {
    if (!sundayStatus?.available_slots?.[0]) return;

    const slot = sundayStatus.available_slots[0];

    if (slot.spots_remaining === 0) {
      toast.error('Full', {
        description: 'This Sunday practice is full',
      });
      return;
    }

    setBookingInProgress(true);
    try {
      const response = await fetch('/api/sunday-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: slot.slot_id,
          registrationId: id,
          firebaseUid: firebase_uid,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Booked!', {
          description: `Sunday ${new Date(slot.slot_date).toLocaleDateString()} at ${slot.start_time}`,
          duration: 4000,
        });

        // Refresh status
        const refreshResponse = await fetch(
          `/api/sunday-next-slot?registrationId=${id}&firebaseUid=${firebase_uid}`
        );
        const refreshData = await refreshResponse.json();
        if (refreshResponse.ok) {
          setSundayStatus(refreshData);
        }
      } else {
        toast.error('Booking Failed', {
          description: data.error || 'Unable to book Sunday practice',
        });
      }
    } catch (error) {
      console.error('Booking error:', error);
      toast.error('Error', {
        description: 'Failed to book Sunday practice',
      });
    } finally {
      setBookingInProgress(false);
    }
  };

  // Get next Sunday date
  const getNextSunday = () => {
    const today = new Date();
    const daysUntilSunday = (7 - today.getDay()) % 7 || 7;
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysUntilSunday);
    return nextSunday;
  };

  const nextSundayDate = getNextSunday();

  // Get time slots for group training
  const getGroupTimeSlots = () => {
    return ['4:30 PM', '5:45 PM', '7:00 PM', '8:15 PM'];
  };

  const handleRescheduleSuccess = () => {
    console.log('RESCHEDULE SUCCESS - waiting 7s before refresh so you can copy logs...');
    setRefreshKey(prev => prev + 1);
    setTimeout(() => {
      console.log('Now refreshing page...');
      window.location.reload();
    }, 7000);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Training Schedule
              </CardTitle>
              <CardDescription>
                Your upcoming training sessions and ice practice times
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRescheduleModalOpen(true)}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reschedule
            </Button>
          </div>
        </CardHeader>
      <CardContent className="space-y-4">
        {/* Location Card */}
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-foreground">Training Location</p>
              <p className="text-sm font-medium mt-1">
                7515 Boulevard Henri-Bourassa E
              </p>
              <p className="text-sm text-muted-foreground">
                Montreal, Quebec H1E 1N9
              </p>
            </div>
          </div>
        </div>

        {/* Waiting for Partner Indicator - Semi-Private Only */}
        {form_data.programType === 'semi-private' && isWaitingForPartner && waitingInfo && (
          <div className="p-4 rounded-lg bg-[#9BD4FF]/5 border border-[#9BD4FF]/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-[#9BD4FF] mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-white">
                  Waiting for Training Partner
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  You're on the waiting list since{' '}
                  {new Date(waitingInfo.waitingSince).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}. We're actively looking for a partner in your age group ({waitingInfo.playerCategory}).
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Questions? Contact <a href="mailto:info@sniperzone.ca" className="text-[#9BD4FF] underline hover:text-white">info@sniperzone.ca</a>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Group Training Time Slots */}
        {form_data.programType === 'group' && (() => {
          const assignedSlot = form_data.playerCategory
            ? findSlotForCategory(form_data.playerCategory as PlayerCategory)
            : null;

          return (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-primary" />
                <p className="font-semibold text-sm">Your Assigned Training Time</p>
              </div>
              {assignedSlot ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-primary text-primary font-semibold text-sm px-3 py-1">
                      {assignedSlot.time}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      ({form_data.playerCategory} category)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    This time is assigned based on your age category. Max 6 players per slot.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {getGroupTimeSlots().map((time) => (
                    <Badge key={time} variant="outline" className="justify-center">
                      {time}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        <Separator />

        {/* Upcoming Sessions */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Next 8 Sessions
          </h3>

          <div className="space-y-2">
            {upcomingSessions.map((session, index) => {
              // Check if this is the next Sunday (first Sunday in the list)
              const isNextSunday = session.type === 'real-ice' &&
                session.date.toDateString() === nextSundayDate.toDateString();

              // Get booking status for this Sunday
              const getSundayStatus = () => {
                if (!sundayStatus || !isNextSunday) return null;

                if (sundayStatus.already_booked) {
                  return {
                    label: 'Booked',
                    variant: 'default' as const,
                    className: 'bg-green-500/10 text-green-500 border-green-500/50',
                  };
                }

                if (sundayStatus.available_slots?.[0]) {
                  const spotsRemaining = sundayStatus.available_slots[0].spots_remaining;
                  if (spotsRemaining === 0) {
                    return {
                      label: 'Full',
                      variant: 'destructive' as const,
                      className: 'bg-red-500/10 text-red-500 border-red-500/50',
                    };
                  }
                  return {
                    label: 'Not Booked',
                    variant: 'outline' as const,
                    className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/50',
                  };
                }

                return null;
              };

              const statusBadge = getSundayStatus();

              return (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    session.type === 'real-ice'
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-muted/50 border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="text-center min-w-[60px]">
                        <p className="text-xs text-muted-foreground uppercase">
                          {session.date.toLocaleDateString('en-US', { month: 'short' })}
                        </p>
                        <p className="text-2xl font-bold text-foreground">
                          {session.date.getDate()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {session.day}
                        </p>
                      </div>
                      <Separator orientation="vertical" className="h-12" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {session.type === 'real-ice' && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/50">
                              Free Included
                            </Badge>
                          )}
                          {session.isException && (
                            <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/50">
                              One-time Change
                            </Badge>
                          )}
                          {statusBadge && (
                            <Badge variant={statusBadge.variant} className={statusBadge.className}>
                              {statusBadge.label}
                            </Badge>
                          )}
                        </div>
                        {session.time && (
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              {session.time}
                            </p>
                          </div>
                        )}
                        {session.type === 'real-ice' && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Sunday Ice Practice
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Booking button for next Sunday only */}
                    {isNextSunday && !loadingSunday && sundayStatus && !sundayStatus.already_booked && (
                      <Button
                        size="sm"
                        onClick={handleBookSunday}
                        disabled={bookingInProgress || sundayStatus.available_slots?.[0]?.spots_remaining === 0}
                        className="ml-2"
                      >
                        {bookingInProgress ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Booking...
                          </>
                        ) : (
                          'Book Now'
                        )}
                      </Button>
                    )}

                    {/* Live capacity indicator for group synthetic sessions */}
                    {form_data.programType === 'group' && session.type === 'synthetic' && (
                      <div className="text-right ml-2">
                        <Users className="h-4 w-4 text-muted-foreground mb-1" />
                        {(() => {
                          const capacity = dayCapacity[session.day.toLowerCase()];
                          if (capacity) {
                            const { spotsUsed, spotsRemaining, isFull } = capacity;
                            return (
                              <p className={`text-xs ${isFull ? 'text-red-400' : spotsRemaining <= 2 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                                {isFull ? 'Full (6/6)' : `${spotsUsed}/6 spots filled`}
                              </p>
                            );
                          }
                          return <p className="text-xs text-muted-foreground">Loading...</p>;
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Important Notes */}
        <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
          <p className="font-semibold text-sm mb-2">Important Notes</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>• Please arrive 10 minutes before your session</li>
            <li>• Bring your own water bottle and towel</li>
            <li>• Full hockey equipment required for all sessions</li>
            {form_data.programType === 'group' && (
              <li>• First-come, first-served for time slot selection</li>
            )}
            <li>• Sunday ice practice is included free with your subscription</li>
          </ul>
        </div>
      </CardContent>
    </Card>

    {/* Reschedule Modals */}
    {form_data.programType === 'group' && (
      <RescheduleGroupModal
        isOpen={isRescheduleModalOpen}
        onClose={() => setIsRescheduleModalOpen(false)}
        registrationId={id}
        firebaseUid={firebase_uid}
        currentSchedule={{
          days: form_data.groupSelectedDays || [],
          frequency: form_data.groupFrequency || '1x',
          playerCategory: form_data.playerCategory || ''
        }}
        onSuccess={handleRescheduleSuccess}
      />
    )}

    {form_data.programType === 'private' && (
      <ReschedulePrivateModal
        isOpen={isRescheduleModalOpen}
        onClose={() => setIsRescheduleModalOpen(false)}
        registrationId={id}
        firebaseUid={firebase_uid}
        currentSchedule={{
          day: form_data.privateSelectedDays?.[0] || '',
          days: form_data.privateSelectedDays || [],
          timeSlot: form_data.privateTimeSlot || '',
          playerCategory: form_data.playerCategory || '',
          frequency: form_data.privateFrequency || '1x'
        }}
        onSuccess={handleRescheduleSuccess}
      />
    )}

    {form_data.programType === 'semi-private' && (
      <RescheduleSemiPrivateModal
        isOpen={isRescheduleModalOpen}
        onClose={() => setIsRescheduleModalOpen(false)}
        registrationId={id}
        firebaseUid={firebase_uid}
        currentSchedule={{
          // Use pairing's scheduled day if paired, otherwise fall back to form data
          day: semiPrivatePairing?.scheduled_day || form_data.semiPrivateAvailability?.[0],
          timeSlot: semiPrivatePairing?.scheduled_time || form_data.semiPrivateTimeSlot || form_data.semiPrivateTimeWindows?.[0],
          playerCategory: form_data.playerCategory || ''
        }}
        onSuccess={handleRescheduleSuccess}
      />
    )}
  </>
  );
};

export default TrainingSchedule;
