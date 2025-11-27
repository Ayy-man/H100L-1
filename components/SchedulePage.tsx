import React, { useEffect, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Edit,
  ChevronLeft,
  ChevronRight,
  Info,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import ProtectedRoute from './ProtectedRoute';
import DashboardLayout from './dashboard/DashboardLayout';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { RescheduleGroupModal } from './dashboard/RescheduleGroupModal';
import { ReschedulePrivateModal } from './dashboard/ReschedulePrivateModal';
import { RescheduleSemiPrivateModal } from './dashboard/RescheduleSemiPrivateModal';
import { Skeleton } from './ui/skeleton';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/contexts/ProfileContext';
import { Registration } from '@/types';
import { toast } from 'sonner';

/**
 * Schedule Page Component
 *
 * Full calendar view of training sessions with schedule management:
 * - Monthly calendar view
 * - All training sessions displayed
 * - Reschedule training sessions
 * - View session details
 */
interface SundaySlotStatus {
  date: string;
  booked: boolean;
  bookingId?: string;
  availableSpots: number;
  maxCapacity: number;
  slotId?: string;
}

interface ScheduleException {
  exception_date: string;
  exception_type: string;
  replacement_day: string;
  replacement_time?: string;
  status: string;
}

interface SemiPrivatePairing {
  scheduled_day: string;
  scheduled_time: string;
  partner_name?: string;
}

const SchedulePage: React.FC = () => {
  const { user, selectedProfile, selectedProfileId } = useProfile();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [sundayStatuses, setSundayStatuses] = useState<Map<string, SundaySlotStatus>>(new Map());
  const [scheduleExceptions, setScheduleExceptions] = useState<ScheduleException[]>([]);
  const [semiPrivatePairing, setSemiPrivatePairing] = useState<SemiPrivatePairing | null>(null);

  // Fetch Sunday slot statuses for the current month
  const fetchSundayStatuses = async () => {
    if (!registration) return;

    try {
      const response = await fetch(
        `/api/sunday-upcoming-slots?registrationId=${registration.id}&firebaseUid=${registration.firebase_uid}&weeks=4`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const data = await response.json();

      if (data.success && data.weeks) {
        const statusMap = new Map<string, SundaySlotStatus>();

        data.weeks.forEach((week: any) => {
          if (week.slots && week.slots.length > 0) {
            // Find the slot player is booked for or get first available
            const bookedSlot = week.slots.find((s: any) => s.player_booked);
            const firstSlot = week.slots[0];
            const slotToUse = bookedSlot || firstSlot;

            statusMap.set(week.date, {
              date: week.date,
              booked: !!bookedSlot,
              bookingId: bookedSlot?.booking_id,
              availableSpots: slotToUse.available_spots,
              maxCapacity: slotToUse.max_capacity,
              slotId: slotToUse.slot_id,
            });
          }
        });

        setSundayStatuses(statusMap);
      }
    } catch (error) {
      console.error('Error fetching Sunday statuses:', error);
    }
  };

  // Fetch selected child's registration data
  useEffect(() => {
    const fetchRegistration = async () => {
      if (!selectedProfileId || !user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('registrations')
          .select('*')
          .eq('id', selectedProfileId)
          .eq('firebase_uid', user.uid) // Verify ownership
          .single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            setError('Registration not found.');
          } else {
            throw fetchError;
          }
        } else {
          setRegistration(data as Registration);
        }
      } catch (err) {
        console.error('Error fetching registration:', err);
        setError(err instanceof Error ? err.message : 'Failed to load schedule data');
        toast.error('Failed to load schedule data');
      } finally {
        setLoading(false);
      }
    };

    fetchRegistration();
  }, [selectedProfileId, user]);

  // Fetch Sunday statuses when registration or month changes
  useEffect(() => {
    if (registration) {
      fetchSundayStatuses();
    }
  }, [registration, currentMonth]);

  // Fetch schedule exceptions for one-time changes
  useEffect(() => {
    const fetchScheduleExceptions = async () => {
      if (!registration?.id) return;
      try {
        console.log('=== SchedulePage: FETCHING SCHEDULE EXCEPTIONS ===');
        console.log('Registration ID:', registration.id);
        const response = await fetch(
          `/api/schedule-exceptions?registrationId=${registration.id}`
        );
        if (response.ok) {
          const data = await response.json();
          console.log('=== SchedulePage: EXCEPTIONS RESPONSE ===');
          console.log('Success:', data.success);
          console.log('Count:', data.exceptions?.length || 0);
          console.log('Debug info:', data.debug);
          console.log('Full exceptions:', JSON.stringify(data.exceptions, null, 2));
          if (data.success && data.exceptions) {
            setScheduleExceptions(data.exceptions);
          }
        } else {
          console.error('Failed to fetch exceptions, status:', response.status);
        }
      } catch (error) {
        console.error('Failed to fetch schedule exceptions:', error);
      }
    };

    fetchScheduleExceptions();
  }, [registration?.id]);

  // Fetch semi-private pairing to get the ACTUAL scheduled day (not just preferences)
  useEffect(() => {
    const fetchSemiPrivatePairing = async () => {
      if (!registration || registration.form_data?.programType !== 'semi-private') return;

      try {
        console.log('=== SchedulePage: FETCHING SEMI-PRIVATE PAIRING ===');
        const response = await fetch('/api/reschedule-semi-private', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get_current_pairing',
            registrationId: registration.id,
            firebaseUid: registration.firebase_uid
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('SchedulePage pairing response:', data);
          if (data.success && data.paired && data.pairing) {
            setSemiPrivatePairing({
              scheduled_day: data.pairing.scheduledDay,
              scheduled_time: data.pairing.scheduledTime,
              partner_name: data.pairing.partnerName
            });
            console.log('Set semi-private pairing:', data.pairing.scheduledDay, data.pairing.scheduledTime);
          } else {
            console.log('Not paired, using availability preferences');
          }
        }
      } catch (error) {
        console.error('Failed to fetch semi-private pairing:', error);
      }
    };

    fetchSemiPrivatePairing();
  }, [registration]);

  // Get all sessions for the current month
  const getMonthSessions = () => {
    if (!registration) return [];

    const { form_data } = registration;
    const sessions: Array<{
      date: Date;
      day: string;
      type: 'synthetic' | 'real-ice';
      time?: string;
      isException?: boolean;
    }> = [];

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

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

    // Helper to format date as YYYY-MM-DD in local timezone
    const formatDate = (d: Date) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Helper to check for exception on a specific date
    const getExceptionForDate = (dateStr: string) => {
      return scheduleExceptions.find(
        (exc) => exc.exception_date === dateStr && exc.status === 'applied'
      );
    };

    // Add weekday sessions
    if (form_data.programType === 'group' && form_data.groupSelectedDays) {
      form_data.groupSelectedDays.forEach((day) => {
        const targetDay = dayMap[day.toLowerCase()];
        if (targetDay !== undefined) {
          let currentDate = new Date(firstDay);
          currentDate.setDate(1);

          // Find first occurrence of this day in the month
          while (currentDate.getDay() !== targetDay) {
            currentDate.setDate(currentDate.getDate() + 1);
          }

          // Add all occurrences of this day in the month
          while (currentDate <= lastDay) {
            const dateStr = formatDate(currentDate);
            const exception = getExceptionForDate(dateStr);

            if (exception && exception.exception_type === 'swap') {
              // Replace with the exception day
              const replacementDayNum = dayMap[exception.replacement_day.toLowerCase()];
              if (replacementDayNum !== undefined) {
                const replacementDate = new Date(currentDate);
                const dayDiff = replacementDayNum - currentDate.getDay();
                replacementDate.setDate(currentDate.getDate() + dayDiff);

                sessions.push({
                  date: replacementDate,
                  day: reverseDayMap[replacementDayNum] || exception.replacement_day,
                  type: 'synthetic',
                  isException: true,
                });
              }
            } else {
              // Normal session
              sessions.push({
                date: new Date(currentDate),
                day: day.charAt(0).toUpperCase() + day.slice(1),
                type: 'synthetic',
              });
            }
            currentDate.setDate(currentDate.getDate() + 7);
          }
        }
      });
    } else if (form_data.programType === 'private' && form_data.privateSelectedDays) {
      console.log('=== SchedulePage: Generating PRIVATE sessions ===');
      console.log('Private selected days:', form_data.privateSelectedDays);
      console.log('Schedule exceptions available:', scheduleExceptions.length);

      form_data.privateSelectedDays.forEach((day) => {
        const targetDay = dayMap[day.toLowerCase()];
        if (targetDay !== undefined) {
          let currentDate = new Date(firstDay);
          currentDate.setDate(1);

          while (currentDate.getDay() !== targetDay) {
            currentDate.setDate(currentDate.getDate() + 1);
          }

          while (currentDate <= lastDay) {
            const dateStr = formatDate(currentDate);
            console.log(`[SchedulePage] Checking date ${dateStr} for day ${day}`);
            const exception = getExceptionForDate(dateStr);

            if (exception && exception.exception_type === 'swap') {
              // Replace with the exception day
              console.log(`[SchedulePage] FOUND EXCEPTION: ${dateStr} -> ${exception.replacement_day}`);
              const replacementDayNum = dayMap[exception.replacement_day.toLowerCase()];
              if (replacementDayNum !== undefined) {
                const replacementDate = new Date(currentDate);
                const dayDiff = replacementDayNum - currentDate.getDay();
                replacementDate.setDate(currentDate.getDate() + dayDiff);

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
                date: new Date(currentDate),
                day: day.charAt(0).toUpperCase() + day.slice(1),
                type: 'synthetic',
                time: form_data.privateTimeSlot,
              });
            }
            currentDate.setDate(currentDate.getDate() + 7);
          }
        }
      });
    } else if (form_data.programType === 'semi-private') {
      console.log('=== SchedulePage: Generating SEMI-PRIVATE sessions ===');
      console.log('Semi-private pairing:', semiPrivatePairing);
      console.log('Semi-private availability (fallback):', form_data.semiPrivateAvailability);
      console.log('Schedule exceptions available:', scheduleExceptions.length);

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

      console.log('Semi-private scheduled day (1x/week):', day, 'from pairing:', !!semiPrivatePairing);

      const targetDay = dayMap[day.toLowerCase()];
      if (targetDay !== undefined) {
        let currentDate = new Date(firstDay);
        currentDate.setDate(1);

        while (currentDate.getDay() !== targetDay) {
          currentDate.setDate(currentDate.getDate() + 1);
        }

        while (currentDate <= lastDay) {
          const dateStr = formatDate(currentDate);
          console.log(`[SchedulePage] Checking semi-private date ${dateStr} for day ${day}`);
          const exception = getExceptionForDate(dateStr);

          if (exception && exception.exception_type === 'swap') {
            // Replace with the exception day
            console.log(`[SchedulePage] FOUND SEMI-PRIVATE EXCEPTION: ${dateStr} -> ${exception.replacement_day}`);
            const replacementDayNum = dayMap[exception.replacement_day.toLowerCase()];
            if (replacementDayNum !== undefined) {
              const replacementDate = new Date(currentDate);
              const dayDiff = replacementDayNum - currentDate.getDay();
              replacementDate.setDate(currentDate.getDate() + dayDiff);

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
              date: new Date(currentDate),
              day: day.charAt(0).toUpperCase() + day.slice(1),
              type: 'synthetic',
              time: semiPrivateTime,
            });
          }
          currentDate.setDate(currentDate.getDate() + 7);
        }
      }
    }

    // Add all Sundays for real ice (Group Training only)
    if (form_data.programType === 'group') {
      let currentDate = new Date(firstDay);
      while (currentDate.getDay() !== 0 && currentDate <= lastDay) {
        currentDate.setDate(currentDate.getDate() + 1);
      }

      while (currentDate <= lastDay) {
        sessions.push({
          date: new Date(currentDate),
          day: 'Sunday',
          type: 'real-ice',
        });
        currentDate.setDate(currentDate.getDate() + 7);
      }
    }

    sessions.sort((a, b) => a.date.getTime() - b.date.getTime());
    return sessions;
  };

  // Get calendar days for display
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const prevLastDay = new Date(year, month, 0);

    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      sessions: typeof monthSessions;
    }> = [];

    // Add previous month's trailing days
    const firstDayOfWeek = firstDay.getDay();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(prevLastDay);
      date.setDate(prevLastDay.getDate() - i);
      days.push({ date, isCurrentMonth: false, sessions: [] });
    }

    // Add current month's days
    const monthSessions = getMonthSessions();
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      const daySessions = monthSessions.filter(
        (s) =>
          s.date.getDate() === i &&
          s.date.getMonth() === month &&
          s.date.getFullYear() === year
      );
      days.push({ date, isCurrentMonth: true, sessions: daySessions });
    }

    // Add next month's leading days
    const remaining = 42 - days.length; // 6 weeks * 7 days
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, isCurrentMonth: false, sessions: [] });
    }

    return days;
  };


  const monthSessions = registration ? getMonthSessions() : [];
  const calendarDays = registration ? getCalendarDays() : [];
  const today = new Date();

  return (
    <ProtectedRoute>
      {loading ? (
        <DashboardLayout user={user || ({ email: 'loading...', uid: '' } as any)}>
          <div className="space-y-6">
            <Skeleton className="h-12 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
            <Skeleton className="h-96" />
          </div>
        </DashboardLayout>
      ) : error ? (
        <DashboardLayout user={user!}>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Schedule</AlertTitle>
            <AlertDescription>
              {error}
              <div className="mt-4">
                <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                  Refresh Page
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </DashboardLayout>
      ) : !registration ? (
        <DashboardLayout user={user!}>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>No Schedule Found</AlertTitle>
            <AlertDescription>
              {!selectedProfile
                ? 'Please select a child profile to view their training schedule.'
                : 'Complete your registration to view your training schedule.'}
            </AlertDescription>
          </Alert>
        </DashboardLayout>
      ) : (
        <DashboardLayout user={user!}>
          <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Training Schedule</h1>
                <p className="text-muted-foreground mt-1">
                  View and manage your training sessions
                </p>
              </div>
              <Button onClick={() => setIsRescheduleModalOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Reschedule
              </Button>
            </div>

            {/* Stats Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>This Month</CardDescription>
                  <CardTitle className="text-3xl">
                    {monthSessions.filter((s) => s.type === 'synthetic').length}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Training Sessions</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Program Type</CardDescription>
                  <CardTitle className="text-3xl capitalize">
                    {registration.form_data.programType}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {registration.form_data.programType === 'group' &&
                      `${registration.form_data.groupFrequency?.toUpperCase()} per week`}
                    {registration.form_data.programType === 'private' &&
                      `${registration.form_data.privateFrequency} sessions`}
                    {registration.form_data.programType === 'semi-private' && 'Custom schedule'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Training Days</CardDescription>
                  <CardTitle className="text-3xl">
                    {registration.form_data.programType === 'group' &&
                      registration.form_data.groupSelectedDays?.length}
                    {registration.form_data.programType === 'private' &&
                      registration.form_data.privateSelectedDays?.length}
                    {registration.form_data.programType === 'semi-private' &&
                      registration.form_data.semiPrivateAvailability?.length}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Days per week</p>
                </CardContent>
              </Card>
            </div>

            {/* Calendar */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarIcon className="h-5 w-5 text-primary" />
                      {currentMonth.toLocaleDateString('en-US', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {monthSessions.length} total sessions this month
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const newMonth = new Date(currentMonth);
                        newMonth.setMonth(newMonth.getMonth() - 1);
                        setCurrentMonth(newMonth);
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMonth(new Date())}
                    >
                      Today
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const newMonth = new Date(currentMonth);
                        newMonth.setMonth(newMonth.getMonth() + 1);
                        setCurrentMonth(newMonth);
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2">
                  {/* Day Headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div
                      key={day}
                      className="text-center text-sm font-semibold text-muted-foreground py-2"
                    >
                      {day}
                    </div>
                  ))}

                  {/* Calendar Days */}
                  {calendarDays.map((day, index) => {
                    const isToday =
                      day.date.toDateString() === today.toDateString();
                    const hasSessions = day.sessions.length > 0;
                    const isSunday = day.date.getDay() === 0;
                    const dateStr = day.date.toISOString().split('T')[0];
                    const sundayStatus = sundayStatuses.get(dateStr);

                    // Determine Sunday cell styling
                    let sundayBorderColor = '';
                    if (isSunday && day.isCurrentMonth && sundayStatus) {
                      if (sundayStatus.booked) {
                        sundayBorderColor = 'border-green-400 border-2';
                      } else if (sundayStatus.availableSpots === 0) {
                        sundayBorderColor = 'border-red-400 border-2';
                      } else if (sundayStatus.availableSpots <= 2) {
                        sundayBorderColor = 'border-yellow-400 border-2';
                      } else {
                        sundayBorderColor = 'border-blue-400 border-2';
                      }
                    }

                    return (
                      <div
                        key={index}
                        className={`min-h-[80px] p-2 border rounded-lg ${
                          !day.isCurrentMonth
                            ? 'bg-muted/30 text-muted-foreground'
                            : isToday
                            ? 'bg-primary/10 border-primary'
                            : hasSessions
                            ? 'bg-card hover:bg-accent cursor-pointer'
                            : 'bg-card'
                        } ${sundayBorderColor}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-sm font-medium ${
                              isToday ? 'text-primary font-bold' : ''
                            }`}
                          >
                            {day.date.getDate()}
                          </span>
                          {hasSessions && !isSunday && (
                            <Badge variant="secondary" className="h-5 text-xs px-1">
                              {day.sessions.length}
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1">
                          {day.sessions.slice(0, 2).map((session, idx) => (
                            <div key={idx}>
                              {session.type === 'real-ice' ? (
                                // Enhanced Sunday display - ALWAYS show booking status
                                <div className="space-y-1">
                                  <div className="flex flex-col gap-0.5">
                                    {sundayStatus ? (
                                      <>
                                        <div className={`text-xs px-1.5 py-0.5 rounded font-medium flex items-center gap-1 ${
                                          sundayStatus.booked
                                            ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                                            : sundayStatus.availableSpots === 0
                                            ? 'bg-red-500/20 text-red-700 dark:text-red-400'
                                            : sundayStatus.availableSpots <= 2
                                            ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
                                            : 'bg-blue-500/20 text-blue-700 dark:text-blue-400'
                                        }`}>
                                          {sundayStatus.booked ? (
                                            <>
                                              <CheckCircle className="h-3 w-3" />
                                              <span className="font-semibold">Booked</span>
                                            </>
                                          ) : sundayStatus.availableSpots === 0 ? (
                                            <>
                                              <XCircle className="h-3 w-3" />
                                              <span className="font-semibold">Full</span>
                                            </>
                                          ) : (
                                            <>
                                              🧊 <span className="font-semibold">Ice</span>
                                            </>
                                          )}
                                        </div>
                                        {!sundayStatus.booked && sundayStatus.availableSpots > 0 && (
                                          <div className="text-[10px] text-muted-foreground pl-1">
                                            {sundayStatus.availableSpots} spot{sundayStatus.availableSpots !== 1 ? 's' : ''} left
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      // Loading or no status available
                                      <div className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                        🧊 Ice
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                // Regular session display
                                <div
                                  className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                    session.type === 'real-ice'
                                      ? 'bg-primary/20 text-primary'
                                      : 'bg-secondary/50 text-secondary-foreground'
                                  }`}
                                >
                                  {session.type === 'real-ice' ? '🧊 Ice' : '🏒 Training'}
                                  {session.time && <div className="text-[10px] mt-0.5">{session.time}</div>}
                                </div>
                              )}
                            </div>
                          ))}
                          {day.sessions.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{day.sessions.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
              <CardFooter>
                <div className="space-y-3">
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-secondary/50"></div>
                      <span className="text-muted-foreground">Synthetic Ice</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-primary/20"></div>
                      <span className="text-muted-foreground">Real Ice</span>
                    </div>
                  </div>
                  {registration.form_data.programType === 'group' && (
                    <div className="flex items-center gap-4 text-xs flex-wrap">
                      <span className="font-medium text-muted-foreground">Sunday Ice Status:</span>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <span className="text-muted-foreground">Booked</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-blue-500/20"></div>
                        <span className="text-muted-foreground">Available</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-yellow-500/20"></div>
                        <span className="text-muted-foreground">Low Availability</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <XCircle className="h-3 w-3 text-red-600" />
                        <span className="text-muted-foreground">Full</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardFooter>
            </Card>

            {/* Location Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Training Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="font-semibold text-lg">SniperZone Hockey Training</p>
                    <p className="text-muted-foreground">7515 Boulevard Henri-Bourassa E</p>
                    <p className="text-muted-foreground">Montreal, Quebec H1E 1N9</p>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="font-semibold text-sm mb-2 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        Training Hours
                      </p>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        <li>Monday - Friday: 4:30 PM - 9:30 PM</li>
                        <li>Saturday: 9:00 AM - 5:00 PM</li>
                        {registration.form_data.programType === 'group' && (
                          <li>Sunday: 10:00 AM - 2:00 PM (Ice Practice)</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-sm mb-2">Important Notes</p>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        <li>• Arrive 10 minutes early</li>
                        <li>• Full equipment required</li>
                        <li>• Bring water and towel</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Reschedule Modals */}
            {registration && registration.form_data.programType === 'group' && (
              <RescheduleGroupModal
                isOpen={isRescheduleModalOpen}
                onClose={() => setIsRescheduleModalOpen(false)}
                registrationId={registration.id}
                firebaseUid={registration.firebase_uid}
                currentSchedule={{
                  days: registration.form_data.groupSelectedDays || [],
                  frequency: registration.form_data.groupFrequency || '1x',
                  playerCategory: registration.form_data.playerCategory || ''
                }}
                onSuccess={() => window.location.reload()}
              />
            )}
            {registration && registration.form_data.programType === 'private' && (
              <ReschedulePrivateModal
                isOpen={isRescheduleModalOpen}
                onClose={() => setIsRescheduleModalOpen(false)}
                registrationId={registration.id}
                firebaseUid={registration.firebase_uid}
                currentSchedule={{
                  day: registration.form_data.privateSelectedDays?.[0] || '',
                  timeSlot: registration.form_data.privateTimeSlot || '',
                  playerCategory: registration.form_data.playerCategory || ''
                }}
                onSuccess={() => {
                  console.log('RESCHEDULE SUCCESS - waiting 7s before refresh...');
                  setTimeout(() => window.location.reload(), 7000);
                }}
              />
            )}
            {registration && registration.form_data.programType === 'semi-private' && (
              <RescheduleSemiPrivateModal
                isOpen={isRescheduleModalOpen}
                onClose={() => setIsRescheduleModalOpen(false)}
                registrationId={registration.id}
                firebaseUid={registration.firebase_uid}
                currentSchedule={{
                  // Use pairing's scheduled day if paired, otherwise fall back to form data
                  day: semiPrivatePairing?.scheduled_day || registration.form_data.semiPrivateAvailability?.[0],
                  timeSlot: semiPrivatePairing?.scheduled_time || registration.form_data.semiPrivateTimeSlot || registration.form_data.semiPrivateTimeWindows?.[0],
                  playerCategory: registration.form_data.playerCategory || ''
                }}
                onSuccess={() => window.location.reload()}
              />
            )}
          </div>
        </DashboardLayout>
      )}
    </ProtectedRoute>
  );
};

export default SchedulePage;
