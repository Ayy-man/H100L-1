import React, { useState, useEffect } from 'react';
import { Calendar, Users, Download, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface Booking {
  booking_id: string;
  player_name: string;
  player_category: string;
  parent_name: string;
  parent_email: string;
  booking_status: string;
  booked_at: string;
  cancelled_at?: string;
  attendance_status: 'pending' | 'attended' | 'absent' | 'excused';
  attendance_marked_at?: string;
  attendance_marked_by?: string;
  attendance_notes?: string;
  registration_id: string;
}

interface Slot {
  slot_id: string;
  start_time: string;
  end_time: string;
  time_range: string;
  min_category: string;
  max_category: string;
  max_capacity: number;
  current_bookings: number;
  available_spots: number;
  bookings: Booking[];
}

interface RosterData {
  practice_date: string;
  slots: Slot[];
}

interface Stats {
  total_bookings: number;
  attended_count: number;
  absent_count: number;
  excused_count: number;
  pending_count: number;
  attendance_rate: number;
}

interface SundayRosterAdminProps {
  adminUser: { name: string; email: string } | null;
}

/**
 * Sunday Roster Admin Component
 *
 * Admin panel for managing Sunday practice rosters:
 * - View bookings by date
 * - Mark attendance (attended/absent/excused)
 * - Export roster to CSV
 * - View attendance statistics
 */
const SundayRosterAdmin: React.FC<SundayRosterAdminProps> = ({ adminUser }) => {
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availableSundays, setAvailableSundays] = useState<string[]>([]);
  const [rosterData, setRosterData] = useState<RosterData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [attendanceNotes, setAttendanceNotes] = useState('');

  // Generate next 8 Sundays
  useEffect(() => {
    const sundays: string[] = [];
    const today = new Date();
    let currentDate = new Date(today);

    // Find next Sunday (or today if it's Sunday)
    const daysUntilSunday = currentDate.getDay() === 0 ? 0 : 7 - currentDate.getDay();
    currentDate.setDate(currentDate.getDate() + daysUntilSunday);

    // Generate 8 Sundays
    for (let i = 0; i < 8; i++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      sundays.push(dateStr);
      currentDate.setDate(currentDate.getDate() + 7);
    }

    setAvailableSundays(sundays);
    setSelectedDate(sundays[0]); // Default to next Sunday
  }, []);

  // Fetch roster when date changes
  useEffect(() => {
    if (selectedDate) {
      fetchRoster(selectedDate);
    }
  }, [selectedDate]);

  // Fetch roster data from API
  const fetchRoster = async (date: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/sunday-roster?date=${date}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!data.success) {
        toast.error(data.error || 'Failed to load roster');
        setRosterData(null);
        setStats(null);
        return;
      }

      setRosterData(data.roster);
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching roster:', error);
      toast.error('Failed to load roster data');
      setRosterData(null);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  // Mark attendance
  const markAttendance = async (
    bookingId: string,
    status: 'attended' | 'absent' | 'excused',
    notes?: string
  ) => {
    setActionLoading(bookingId);
    try {
      const response = await fetch('/api/sunday-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          attendanceStatus: status,
          markedBy: adminUser?.email || 'admin@sniperzone.ca',
          notes: notes || null,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        toast.error(data.error || 'Failed to mark attendance');
        return;
      }

      toast.success(`Marked as ${status}`);

      // Refresh roster
      if (selectedDate) {
        await fetchRoster(selectedDate);
      }
    } catch (error) {
      console.error('Error marking attendance:', error);
      toast.error('Failed to mark attendance');
    } finally {
      setActionLoading(null);
      setNotesDialogOpen(false);
      setSelectedBooking(null);
      setAttendanceNotes('');
    }
  };

  // Export roster to CSV
  const exportRoster = () => {
    if (!selectedDate) {
      toast.error('Please select a date first');
      return;
    }

    // Open export URL in new tab to trigger download
    window.open(`/api/sunday-export-roster?date=${selectedDate}`, '_blank');
    toast.success('Exporting roster...');
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00'); // Noon to avoid timezone issues
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Get attendance status badge
  const getAttendanceBadge = (status: string) => {
    switch (status) {
      case 'attended':
        return <Badge className="bg-[#9BD4FF]/20 text-[#9BD4FF] hover:bg-[#9BD4FF]/20 font-medium">Attended</Badge>;
      case 'absent':
        return <Badge className="bg-white/10 text-gray-400 hover:bg-white/10 font-medium">Absent</Badge>;
      case 'excused':
        return <Badge className="bg-white/20 text-white hover:bg-white/20 font-medium">Excused</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Date Selector and Export */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Sunday Practice Roster
              </CardTitle>
              <CardDescription>View and manage Sunday practice attendance</CardDescription>
            </div>
            <Button onClick={exportRoster} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 w-full sm:w-auto">
              <Label htmlFor="date-select" className="text-sm font-medium mb-2 block">
                Select Sunday
              </Label>
              <Select value={selectedDate} onValueChange={setSelectedDate}>
                <SelectTrigger id="date-select" className="w-full sm:w-[300px]">
                  <SelectValue placeholder="Select a Sunday" />
                </SelectTrigger>
                <SelectContent>
                  {availableSundays.map((date, index) => (
                    <SelectItem key={date} value={date}>
                      {formatDate(date)} {index === 0 && '(Next)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Card */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Attendance Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#9BD4FF]">{stats.total_bookings}</div>
                <div className="text-sm text-muted-foreground">Total Bookings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[#9BD4FF]">{stats.attended_count}</div>
                <div className="text-sm text-muted-foreground">Attended</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-400">{stats.absent_count}</div>
                <div className="text-sm text-muted-foreground">Absent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{stats.excused_count}</div>
                <div className="text-sm text-muted-foreground">Excused</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[#9BD4FF]">{stats.attendance_rate}%</div>
                <div className="text-sm text-muted-foreground">Attendance Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Roster Tables - One for Each Time Slot */}
      {loading ? (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      ) : !rosterData || !rosterData.slots || rosterData.slots.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No slots found for this date</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        rosterData.slots.map((slot) => (
          <Card key={slot.slot_id}>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    {slot.time_range}
                  </CardTitle>
                  <CardDescription>
                    {slot.min_category} - {slot.max_category} • {slot.current_bookings}/{slot.max_capacity} spots filled
                  </CardDescription>
                </div>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {slot.available_spots} spots available
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {slot.bookings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No bookings for this time slot</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Player Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Parent Name</TableHead>
                        <TableHead>Parent Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slot.bookings.map((booking) => (
                        <TableRow key={booking.booking_id}>
                          <TableCell className="font-medium">{booking.player_name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{booking.player_category}</Badge>
                          </TableCell>
                          <TableCell>{booking.parent_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {booking.parent_email}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {getAttendanceBadge(booking.attendance_status)}
                              {booking.attendance_marked_at && (
                                <div className="text-xs text-muted-foreground">
                                  {new Date(booking.attendance_marked_at).toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => markAttendance(booking.booking_id, 'attended')}
                                disabled={actionLoading === booking.booking_id}
                                className="text-[#9BD4FF] hover:text-[#7BB4DD] hover:bg-[#9BD4FF]/10 border-[#9BD4FF]/30"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => markAttendance(booking.booking_id, 'absent')}
                                disabled={actionLoading === booking.booking_id}
                                className="text-gray-400 hover:text-white hover:bg-white/10 border-white/20"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                              <Dialog open={notesDialogOpen && selectedBooking?.booking_id === booking.booking_id} onOpenChange={(open) => {
                                setNotesDialogOpen(open);
                                if (!open) {
                                  setSelectedBooking(null);
                                  setAttendanceNotes('');
                                }
                              }}>
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedBooking(booking);
                                      setAttendanceNotes(booking.attendance_notes || '');
                                      setNotesDialogOpen(true);
                                    }}
                                    className="text-white hover:text-[#9BD4FF] hover:bg-white/10 border-white/20"
                                  >
                                    <AlertCircle className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Mark as Excused</DialogTitle>
                                    <DialogDescription>
                                      Mark {booking.player_name} as excused with optional notes
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div>
                                      <Label htmlFor="notes">Notes (Optional)</Label>
                                      <Textarea
                                        id="notes"
                                        value={attendanceNotes}
                                        onChange={(e) => setAttendanceNotes(e.target.value)}
                                        placeholder="e.g., Player was sick, family emergency..."
                                        className="mt-2"
                                        rows={3}
                                      />
                                    </div>
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setNotesDialogOpen(false);
                                        setSelectedBooking(null);
                                        setAttendanceNotes('');
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      onClick={() => markAttendance(booking.booking_id, 'excused', attendanceNotes)}
                                      disabled={actionLoading === booking.booking_id}
                                    >
                                      Mark as Excused
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default SundayRosterAdmin;
