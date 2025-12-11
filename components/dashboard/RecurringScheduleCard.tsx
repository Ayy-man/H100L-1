import React, { useState } from 'react';
import {
  Repeat,
  Plus,
  Pause,
  Play,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Calendar,
  Clock,
  User,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useProfile } from '@/contexts/ProfileContext';
import { toast } from 'sonner';
import type { RecurringSchedule, DayOfWeek } from '@/types/credits';
import type { ChildProfile } from '@/contexts/ProfileContext';

interface RecurringScheduleCardProps {
  schedules: RecurringSchedule[];
  loading: boolean;
  children: ChildProfile[];
  onRefresh: () => void;
}

/**
 * RecurringScheduleCard Component
 *
 * Manages recurring weekly bookings:
 * - View active recurring schedules
 * - Pause/resume schedules
 * - Delete schedules
 * - Set up new recurring bookings
 */
const RecurringScheduleCard: React.FC<RecurringScheduleCardProps> = ({
  schedules,
  loading,
  children,
  onRefresh,
}) => {
  const { user } = useProfile();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Get child name by registration ID
  const getChildName = (registrationId: string) => {
    return children.find(c => c.registrationId === registrationId)?.playerName || 'Unknown';
  };

  // Format day of week
  const formatDayOfWeek = (day: DayOfWeek) => {
    return day.charAt(0).toUpperCase() + day.slice(1);
  };

  // Get status badge
  const getStatusBadge = (schedule: RecurringSchedule) => {
    if (!schedule.is_active) {
      if (schedule.paused_reason === 'insufficient_credits') {
        return (
          <Badge variant="destructive" className="text-xs">
            <AlertTriangle className="mr-1 h-3 w-3" />
            No Credits
          </Badge>
        );
      }
      return (
        <Badge variant="secondary" className="text-xs">
          <Pause className="mr-1 h-3 w-3" />
          Paused
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">
        <Play className="mr-1 h-3 w-3" />
        Active
      </Badge>
    );
  };

  // Toggle recurring schedule (pause/resume)
  const handleToggle = async (schedule: RecurringSchedule) => {
    if (!user) return;

    setTogglingId(schedule.id);

    try {
      const response = await fetch('/api/recurring-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_id: schedule.id,
          firebase_uid: user.uid,
          is_active: !schedule.is_active,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update schedule');
      }

      toast.success(schedule.is_active ? 'Schedule paused' : 'Schedule resumed');
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update schedule');
    } finally {
      setTogglingId(null);
    }
  };

  // Delete recurring schedule
  const handleDelete = async (scheduleId: string) => {
    if (!user) return;

    try {
      const response = await fetch('/api/recurring-schedule', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_id: scheduleId,
          firebase_uid: user.uid,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete schedule');
      }

      toast.success('Recurring schedule deleted');
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete schedule');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Repeat className="h-5 w-5 text-primary" />
                Recurring Schedules
              </CardTitle>
              <CardDescription>
                Automatic weekly bookings (uses 1 credit per session)
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              className="h-8 w-8"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {schedules.length === 0 ? (
            <div className="text-center py-8">
              <Repeat className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-2">
                No recurring schedules set up
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Set up automatic weekly bookings for consistent training
              </p>
              <Button variant="outline" disabled>
                <Plus className="mr-2 h-4 w-4" />
                Coming Soon
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    schedule.is_active
                      ? 'bg-card hover:bg-accent/50'
                      : 'bg-muted/30 border-dashed'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          Every {formatDayOfWeek(schedule.day_of_week)}
                        </span>
                        {getStatusBadge(schedule)}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {schedule.time_slot}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {getChildName(schedule.registration_id)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {schedule.session_type === 'group' ? 'Group Training' : schedule.session_type}
                        </span>
                      </div>

                      {schedule.next_booking_date && schedule.is_active && (
                        <p className="text-xs text-muted-foreground">
                          Next booking: {new Date(schedule.next_booking_date + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      )}

                      {schedule.paused_reason === 'insufficient_credits' && (
                        <p className="text-xs text-red-500 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Buy credits to resume automatic bookings
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggle(schedule)}
                        disabled={togglingId === schedule.id || schedule.paused_reason === 'insufficient_credits'}
                        className="h-8 w-8"
                        title={schedule.is_active ? 'Pause' : 'Resume'}
                      >
                        {togglingId === schedule.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : schedule.is_active ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingId(schedule.id)}
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info note */}
          {schedules.length > 0 && (
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Recurring bookings are processed weekly. 1 credit is deducted per session.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recurring Schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop all future automatic bookings for this schedule.
              Existing bookings will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Schedule</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && handleDelete(deletingId)}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete Schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RecurringScheduleCard;
