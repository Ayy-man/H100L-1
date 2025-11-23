import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, Users, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  SUNDAY_PRACTICE_CONFIG,
  BOOKING_STATUS_DISPLAY,
  type BookingStatus,
  type RosterEntry,
  type SundayRosterResponse,
} from '@/lib/sunday-practice-config';

interface SlotRoster {
  slot_id: string;
  time_range: string;
  age_range: string;
  capacity: string;
  bookings: RosterEntry[];
}

/**
 * Sunday Roster View Component (Admin Only)
 *
 * Provides comprehensive Sunday practice roster management for admins:
 * - View all bookings for a specific Sunday
 * - Mark attendance (attended/no-show)
 * - See real-time capacity
 * - Filter by time slot
 * - Export roster data
 *
 * This component is designed to be integrated into the AdminDashboard
 * as a new tab called "Sunday Roster" or "Sunday Practice"
 */
const SundayRosterView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [practiceDate, setPracticeDate] = useState<string>('');
  const [slots, setSlots] = useState<SlotRoster[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [markingAttendance, setMarkingAttendance] = useState<string | null>(null);

  // Calculate next Sunday on mount
  useEffect(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysUntilSunday);
    const dateStr = nextSunday.toISOString().split('T')[0];
    setSelectedDate(dateStr);
    fetchRoster(dateStr);
  }, []);

  // Fetch roster for a specific date
  const fetchRoster = async (date?: string) => {
    setLoading(true);
    try {
      const queryDate = date || selectedDate;
      const url = queryDate
        ? `/api/sunday-roster?date=${queryDate}`
        : '/api/sunday-roster';

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data: SundayRosterResponse = await response.json();

      if (!data.success) {
        if (data.code === 'NO_SLOTS_FOUND') {
          toast.info('No slots found for this date');
          setSlots([]);
          setPracticeDate(data.practice_date || '');
        } else {
          toast.error(data.error || 'Failed to fetch roster');
        }
        return;
      }

      setPracticeDate(data.practice_date || '');
      setSlots(data.slots || []);
    } catch (error) {
      console.error('Error fetching roster:', error);
      toast.error('Failed to load Sunday roster');
    } finally {
      setLoading(false);
    }
  };

  // Mark attendance
  const handleMarkAttendance = async (bookingId: string, attended: boolean) => {
    setMarkingAttendance(bookingId);
    try {
      const response = await fetch('/api/sunday-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          attended,
          markedBy: 'Admin', // TODO: Replace with actual admin name/email
        }),
      });

      const data = await response.json();

      if (!data.success) {
        toast.error(data.error || 'Failed to mark attendance');
        return;
      }

      toast.success(`Marked as ${attended ? 'attended' : 'no-show'}`);

      // Refresh roster
      await fetchRoster();
    } catch (error) {
      console.error('Attendance marking error:', error);
      toast.error('Failed to mark attendance');
    } finally {
      setMarkingAttendance(null);
    }
  };

  // Export roster to CSV
  const handleExportCSV = () => {
    if (slots.length === 0) {
      toast.error('No data to export');
      return;
    }

    const csvRows: string[] = [];
    csvRows.push('Time Slot,Age Range,Player Name,Category,Parent Name,Parent Email,Status,Attended,Booked At');

    slots.forEach((slot) => {
      slot.bookings.forEach((booking) => {
        csvRows.push([
          slot.time_range,
          slot.age_range,
          booking.player_name,
          booking.player_category,
          booking.parent_name,
          booking.parent_email,
          booking.booking_status,
          booking.attended === null ? 'Not Marked' : booking.attended ? 'Yes' : 'No',
          new Date(booking.booked_at).toLocaleString(),
        ].join(','));
      });
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sunday-roster-${practiceDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success('Roster exported successfully');
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const totalBookings = slots.reduce((sum, slot) => sum + slot.bookings.length, 0);
    const confirmedBookings = slots.reduce(
      (sum, slot) => sum + slot.bookings.filter((b) => b.booking_status === 'confirmed').length,
      0
    );
    const attendedCount = slots.reduce(
      (sum, slot) => sum + slot.bookings.filter((b) => b.attended === true).length,
      0
    );
    const noShowCount = slots.reduce(
      (sum, slot) => sum + slot.bookings.filter((b) => b.attended === false).length,
      0
    );

    return {
      total: totalBookings,
      confirmed: confirmedBookings,
      attended: attendedCount,
      noShow: noShowCount,
    };
  }, [slots]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Sunday Practice Roster</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage Sunday real ice practice bookings and attendance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRoster()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={slots.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Date Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Date</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <Button onClick={() => fetchRoster(selectedDate)} disabled={loading}>
              Load Roster
            </Button>
          </div>
          {practiceDate && (
            <p className="text-sm text-muted-foreground">
              Showing roster for:{' '}
              <span className="font-semibold text-foreground">
                {new Date(practiceDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Confirmed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-2xl font-bold">{stats.confirmed}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Attended
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-blue-600" />
              <p className="text-2xl font-bold">{stats.attended}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              No Shows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <p className="text-2xl font-bold">{stats.noShow}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </CardContent>
        </Card>
      )}

      {/* Roster Tables */}
      {!loading && slots.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold text-foreground mb-2">No Bookings Found</p>
            <p className="text-sm text-muted-foreground">
              There are no bookings for this date. Try selecting a different date.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && slots.map((slot, index) => (
        <Card key={slot.slot_id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  {slot.time_range}
                </CardTitle>
                <CardDescription>
                  Age Group: {slot.age_range} • Capacity: {slot.capacity}
                </CardDescription>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {slot.capacity}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {slot.bookings.length === 0 ? (
              <div className="p-4 rounded-lg bg-muted/50 border border-border text-center">
                <p className="text-sm text-muted-foreground">No bookings for this time slot</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slot.bookings.map((booking) => {
                    const statusDisplay = BOOKING_STATUS_DISPLAY[booking.booking_status];
                    return (
                      <TableRow key={booking.booking_id}>
                        <TableCell className="font-medium">
                          {booking.player_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{booking.player_category}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{booking.parent_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {booking.parent_email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={statusDisplay.color}
                          >
                            {statusDisplay.icon} {statusDisplay.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {booking.booking_status === 'confirmed' && (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkAttendance(booking.booking_id, true)}
                                disabled={markingAttendance === booking.booking_id}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Present
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkAttendance(booking.booking_id, false)}
                                disabled={markingAttendance === booking.booking_id}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                No-Show
                              </Button>
                            </div>
                          )}
                          {booking.attended !== null && (
                            <p className="text-xs text-muted-foreground">
                              Marked: {new Date(booking.booked_at).toLocaleDateString()}
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default SundayRosterView;
