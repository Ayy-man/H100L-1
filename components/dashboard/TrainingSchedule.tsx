import React from 'react';
import { Calendar, Clock, MapPin, Users } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Registration } from '@/types';

interface TrainingScheduleProps {
  registration: Registration;
}

/**
 * Training Schedule Component
 *
 * Displays upcoming training sessions based on the program type:
 * - Weekday synthetic ice sessions
 * - Sunday real ice practice
 * - Location details
 */
const TrainingSchedule: React.FC<TrainingScheduleProps> = ({ registration }) => {
  const { form_data } = registration;

  // Get next 4 weeks of training dates
  const getUpcomingSessions = () => {
    const sessions: Array<{
      date: Date;
      day: string;
      type: 'synthetic' | 'real-ice';
      time?: string;
    }> = [];

    const today = new Date();
    const weeksToShow = 4;

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

      for (let week = 0; week < weeksToShow; week++) {
        form_data.groupSelectedDays.forEach((day) => {
          const targetDay = dayMap[day.toLowerCase()];
          if (targetDay !== undefined) {
            const date = new Date(today);
            date.setDate(today.getDate() + (7 * week) + (targetDay - today.getDay() + 7) % 7);

            // Only add future dates
            if (date >= today) {
              sessions.push({
                date,
                day: day.charAt(0).toUpperCase() + day.slice(1),
                type: 'synthetic',
              });
            }
          }
        });
      }
    } else if (form_data.programType === 'private' && form_data.privateSelectedDays) {
      const dayMap: { [key: string]: number } = {
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
      };

      for (let week = 0; week < weeksToShow; week++) {
        form_data.privateSelectedDays.forEach((day) => {
          const targetDay = dayMap[day.toLowerCase()];
          if (targetDay !== undefined) {
            const date = new Date(today);
            date.setDate(today.getDate() + (7 * week) + (targetDay - today.getDay() + 7) % 7);

            if (date >= today) {
              sessions.push({
                date,
                day: day.charAt(0).toUpperCase() + day.slice(1),
                type: 'synthetic',
                time: form_data.privateTimeSlot,
              });
            }
          }
        });
      }
    } else if (form_data.programType === 'semi-private' && form_data.semiPrivateAvailability) {
      const dayMap: { [key: string]: number } = {
        monday: 1,
        wednesday: 3,
        thursday: 4,
      };

      for (let week = 0; week < weeksToShow; week++) {
        form_data.semiPrivateAvailability.forEach((day) => {
          const targetDay = dayMap[day.toLowerCase()];
          if (targetDay !== undefined) {
            const date = new Date(today);
            date.setDate(today.getDate() + (7 * week) + (targetDay - today.getDay() + 7) % 7);

            if (date >= today) {
              sessions.push({
                date,
                day: day.charAt(0).toUpperCase() + day.slice(1),
                type: 'synthetic',
              });
            }
          }
        });
      }
    }

    // Add Sunday ice practice sessions
    for (let week = 0; week < weeksToShow; week++) {
      const date = new Date(today);
      const daysUntilSunday = (7 - today.getDay() + 7) % 7 || 7;
      date.setDate(today.getDate() + daysUntilSunday + (7 * week));

      if (date >= today) {
        sessions.push({
          date,
          day: 'Sunday',
          type: 'real-ice',
        });
      }
    }

    // Sort by date
    sessions.sort((a, b) => a.date.getTime() - b.date.getTime());

    return sessions.slice(0, 8); // Show next 8 sessions
  };

  const upcomingSessions = getUpcomingSessions();

  // Get time slots for group training
  const getGroupTimeSlots = () => {
    return ['4:30 PM', '5:45 PM', '7:00 PM', '8:15 PM'];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Training Schedule
        </CardTitle>
        <CardDescription>
          Your upcoming training sessions and ice practice times
        </CardDescription>
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

        {/* Group Training Time Slots */}
        {form_data.programType === 'group' && (
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-primary" />
              <p className="font-semibold text-sm">Group Training Time Slots</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {getGroupTimeSlots().map((time) => (
                <Badge key={time} variant="outline" className="justify-center">
                  {time}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Choose your preferred time when you arrive
            </p>
          </div>
        )}

        <Separator />

        {/* Upcoming Sessions */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Next 8 Sessions
          </h3>

          <div className="space-y-2">
            {upcomingSessions.map((session, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  session.type === 'real-ice'
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-muted/50 border-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
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
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={session.type === 'real-ice' ? 'default' : 'secondary'}
                        >
                          {session.type === 'real-ice' ? 'Real Ice' : 'Synthetic Ice'}
                        </Badge>
                        {session.type === 'real-ice' && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/50">
                            Free Included
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
                  {form_data.programType === 'group' && session.type === 'synthetic' && (
                    <div className="text-right">
                      <Users className="h-4 w-4 text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">Max 6 players</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
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
  );
};

export default TrainingSchedule;
