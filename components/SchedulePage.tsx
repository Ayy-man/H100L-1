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
 * - Request schedule changes
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

const SchedulePage: React.FC = () => {
  const { user, selectedProfile, selectedProfileId } = useProfile();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [sundayStatuses, setSundayStatuses] = useState<Map<string, SundaySlotStatus>>(new Map());

  // Fetch Sunday slot statuses for the current month
  const fetchSundayStatuses = async () => {
    if (!registration) return;

    try {
      const response = await fetch(
        `/api/sunday-upcoming-slots?registrationId=${registration.id}&firebaseUid=${registration.firebase_uid}&weeks=8`,
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

  // Get all sessions for the current month
  const getMonthSessions = () => {
    if (!registration) return [];

    const { form_data } = registration;
    const sessions: Array<{
      date: Date;
      day: string;
      type: 'synthetic' | 'real-ice';
      time?: string;
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
            sessions.push({
              date: new Date(currentDate),
              day: day.charAt(0).toUpperCase() + day.slice(1),
              type: 'synthetic',
            });
            currentDate.setDate(currentDate.getDate() + 7);
          }
        }
      });
    } else if (form_data.programType === 'private' && form_data.privateSelectedDays) {
      form_data.privateSelectedDays.forEach((day) => {
        const targetDay = dayMap[day.toLowerCase()];
        if (targetDay !== undefined) {
          let currentDate = new Date(firstDay);
          currentDate.setDate(1);

          while (currentDate.getDay() !== targetDay) {
            currentDate.setDate(currentDate.getDate() + 1);
          }

          while (currentDate <= lastDay) {
            sessions.push({
              date: new Date(currentDate),
              day: day.charAt(0).toUpperCase() + day.slice(1),
              type: 'synthetic',
              time: form_data.privateTimeSlot,
            });
            currentDate.setDate(currentDate.getDate() + 7);
          }
        }
      });
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
                              {session.type === 'real-ice' && sundayStatus ? (
                                // Enhanced Sunday display
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <div className={`text-xs p-1 rounded flex items-center gap-1 ${
                                      sundayStatus.booked
                                        ? 'bg-green-100 text-green-700'
                                        : sundayStatus.availableSpots === 0
                                        ? 'bg-red-100 text-red-700'
                                        : sundayStatus.availableSpots <= 2
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-blue-100 text-blue-700'
                                    }`}>
                                      {sundayStatus.booked ? (
                                        <>
                                          <CheckCircle className="h-3 w-3" />
                                          <span>Booked</span>
                                        </>
                                      ) : sundayStatus.availableSpots === 0 ? (
                                        <>
                                          <XCircle className="h-3 w-3" />
                                          <span>Full</span>
                                        </>
                                      ) : (
                                        <>
                                          🧊 Ice
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  {!sundayStatus.booked && sundayStatus.availableSpots > 0 && (
                                    <div className="text-xs text-muted-foreground">
                                      {sundayStatus.availableSpots} {sundayStatus.availableSpots === 1 ? 'spot' : 'spots'} left
                                    </div>
                                  )}
                                </div>
                              ) : (
                                // Regular session display
                                <div
                                  className={`text-xs p-1 rounded ${
                                    session.type === 'real-ice'
                                      ? 'bg-primary/20 text-primary'
                                      : 'bg-secondary/50 text-secondary-foreground'
                                  }`}
                                >
                                  {session.type === 'real-ice' ? '🧊 Ice' : '🏒 Training'}
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
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-secondary/50"></div>
                    <span className="text-muted-foreground">Synthetic Ice</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-primary/20"></div>
                    <span className="text-muted-foreground">Real Ice</span>
                  </div>
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
                registration={registration}
              />
            )}
            {registration && registration.form_data.programType === 'private' && (
              <ReschedulePrivateModal
                isOpen={isRescheduleModalOpen}
                onClose={() => setIsRescheduleModalOpen(false)}
                registration={registration}
              />
            )}
            {registration && registration.form_data.programType === 'semi-private' && (
              <RescheduleSemiPrivateModal
                isOpen={isRescheduleModalOpen}
                onClose={() => setIsRescheduleModalOpen(false)}
                registration={registration}
              />
            )}
          </div>
        </DashboardLayout>
      )}
    </ProtectedRoute>
  );
};

export default SchedulePage;
