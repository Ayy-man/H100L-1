import React, { useEffect, useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Info,
  Plus,
  RefreshCw,
  User,
} from 'lucide-react';
import ProtectedRoute from './ProtectedRoute';
import DashboardLayout from './dashboard/DashboardLayout';
import BookSessionModal from './dashboard/BookSessionModal';
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
import { Skeleton } from './ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { useProfile } from '@/contexts/ProfileContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLocalDateString } from '@/lib/dateUtils';
import { toast } from 'sonner';
import type { SessionBookingWithDetails } from '@/types/credits';
import type { ChildProfile } from '@/contexts/ProfileContext';

/**
 * Schedule Page Component (Credit Model)
 *
 * Calendar view of actual booked sessions:
 * - View all booked sessions for selected child or all children
 * - Book new sessions from the calendar
 * - Navigate by month
 */

const SchedulePage: React.FC = () => {
  const { user, children, loading: profileLoading } = useProfile();
  const { language } = useLanguage();
  const isFrench = language === 'fr';
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bookings, setBookings] = useState<SessionBookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChildId, setSelectedChildId] = useState<string>('all');
  const [showBookModal, setShowBookModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Fetch bookings for the current month
  const fetchBookings = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get first and last day of month (use local date to avoid timezone shift)
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const firstDay = getLocalDateString(new Date(year, month, 1));
      const lastDay = getLocalDateString(new Date(year, month + 1, 0));

      const response = await fetch(
        `/api/my-bookings?firebase_uid=${user.uid}&from_date=${firstDay}&to_date=${lastDay}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }

      const data = await response.json();
      setBookings(data.bookings || []);
    } catch (err) {
      console.error('Error fetching bookings:', err);
      toast.error(isFrench ? 'Échec du chargement de l\'horaire' : 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  // Fetch bookings when user or month changes
  useEffect(() => {
    if (user) {
      fetchBookings();
    }
  }, [user, currentMonth]);

  // Filter bookings by selected child
  const filteredBookings = useMemo(() => {
    if (selectedChildId === 'all') return bookings;
    return bookings.filter(b => b.registration_id === selectedChildId);
  }, [bookings, selectedChildId]);

  // Get calendar days for display
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const prevLastDay = new Date(year, month, 0);

    const days: Array<{
      date: Date;
      dateStr: string;
      isCurrentMonth: boolean;
      bookings: SessionBookingWithDetails[];
    }> = [];

    // Add previous month's trailing days
    const firstDayOfWeek = firstDay.getDay();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(prevLastDay);
      date.setDate(prevLastDay.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      days.push({ date, dateStr, isCurrentMonth: false, bookings: [] });
    }

    // Add current month's days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayBookings = filteredBookings.filter(b => b.session_date === dateStr);
      days.push({ date, dateStr, isCurrentMonth: true, bookings: dayBookings });
    }

    // Add next month's leading days
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      const dateStr = date.toISOString().split('T')[0];
      days.push({ date, dateStr, isCurrentMonth: false, bookings: [] });
    }

    return days;
  };

  const calendarDays = getCalendarDays();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Get session type display info
  const getSessionTypeInfo = (type: string) => {
    switch (type) {
      case 'group':
        return { label: isFrench ? 'Groupe' : 'Group', color: 'bg-blue-500/20 text-blue-700 dark:text-blue-400' };
      case 'sunday':
        return { label: isFrench ? 'Glace' : 'Ice', color: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400' };
      case 'private':
        return { label: isFrench ? 'Privé' : 'Private', color: 'bg-purple-500/20 text-purple-700 dark:text-purple-400' };
      case 'semi_private':
        return { label: isFrench ? 'Semi' : 'Semi', color: 'bg-teal-500/20 text-teal-700 dark:text-teal-400' };
      default:
        return { label: type, color: 'bg-gray-500/20 text-gray-700 dark:text-gray-400' };
    }
  };

  // Get child name by registration ID
  const getChildName = (registrationId: string) => {
    return children.find(c => c.registrationId === registrationId)?.playerName || (isFrench ? 'Inconnu' : 'Unknown');
  };

  // Handle day click to open booking modal
  const handleDayClick = (date: Date, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return;
    if (date < new Date(new Date().setHours(0, 0, 0, 0))) return; // Don't allow past dates

    setSelectedDate(date);
    setShowBookModal(true);
  };

  if (profileLoading) {
    return (
      <ProtectedRoute requireProfile={false}>
        <DashboardLayout user={user || ({ email: 'loading...', uid: '' } as any)}>
          <div className="space-y-6">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-96" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requireProfile={false}>
      <DashboardLayout user={user!}>
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{isFrench ? 'Horaire d\'entraînement' : 'Training Schedule'}</h1>
              <p className="text-muted-foreground mt-1">
                {isFrench ? 'Consultez vos séances réservées et planifiez de nouveaux entraînements' : 'View your booked sessions and schedule new training'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Child Filter */}
              <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                <SelectTrigger className="w-[180px]">
                  <User className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={isFrench ? 'Tous les joueurs' : 'All Players'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isFrench ? 'Tous les joueurs' : 'All Players'}</SelectItem>
                  {children.map((child) => (
                    <SelectItem key={child.registrationId} value={child.registrationId}>
                      {child.playerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => setShowBookModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {isFrench ? 'Réserver' : 'Book Session'}
              </Button>
            </div>
          </div>

          {/* No Children Alert */}
          {children.length === 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>{isFrench ? 'Aucun joueur inscrit' : 'No Players Registered'}</AlertTitle>
              <AlertDescription>
                {isFrench ? 'Ajoutez un joueur à votre compte pour commencer à réserver des séances d\'entraînement.' : 'Add a player to your account to start booking training sessions.'}
                <Button
                  variant="link"
                  className="px-1"
                  onClick={() => window.location.href = '/register?mode=add-child'}
                >
                  {isFrench ? 'Ajouter un joueur maintenant' : 'Add a player now'}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Stats Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>{isFrench ? 'Ce mois' : 'This Month'}</CardDescription>
                <CardTitle className="text-3xl">
                  {filteredBookings.filter(b => b.status === 'booked').length}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{isFrench ? 'Séances réservées' : 'Booked Sessions'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>{isFrench ? 'Séances de groupe' : 'Group Sessions'}</CardDescription>
                <CardTitle className="text-3xl">
                  {filteredBookings.filter(b => b.session_type === 'group').length}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{isFrench ? 'Entraînement sur glace synthétique' : 'Synthetic ice training'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>{isFrench ? 'Séances spéciales' : 'Special Sessions'}</CardDescription>
                <CardTitle className="text-3xl">
                  {filteredBookings.filter(b => b.session_type !== 'group').length}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{isFrench ? 'Dimanche, Privé, Semi-privé' : 'Sunday, Private, Semi-Private'}</p>
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
                    {currentMonth.toLocaleDateString(isFrench ? 'fr-CA' : 'en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {isFrench
                      ? `${filteredBookings.length} séance${filteredBookings.length !== 1 ? 's' : ''} ce mois${selectedChildId !== 'all' ? ` pour ${getChildName(selectedChildId)}` : ''}`
                      : `${filteredBookings.length} sessions this month${selectedChildId !== 'all' ? ` for ${getChildName(selectedChildId)}` : ''}`}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={fetchBookings}
                    className="h-8 w-8"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
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
                    {isFrench ? 'Aujourd\'hui' : 'Today'}
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
              {loading ? (
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 42 }).map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-2">
                  {/* Day Headers */}
                  {(isFrench ? ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).map((day) => (
                    <div
                      key={day}
                      className="text-center text-sm font-semibold text-muted-foreground py-2"
                    >
                      {day}
                    </div>
                  ))}

                  {/* Calendar Days */}
                  {calendarDays.map((day, index) => {
                    const isToday = day.dateStr === todayStr;
                    const hasBookings = day.bookings.length > 0;
                    const isPast = day.date < new Date(new Date().setHours(0, 0, 0, 0));
                    const canBook = day.isCurrentMonth && !isPast;

                    return (
                      <div
                        key={index}
                        onClick={() => canBook && handleDayClick(day.date, day.isCurrentMonth)}
                        className={`min-h-[80px] p-2 border rounded-lg transition-colors ${
                          !day.isCurrentMonth
                            ? 'bg-muted/30 text-muted-foreground'
                            : isToday
                            ? 'bg-primary/10 border-primary'
                            : hasBookings
                            ? 'bg-card hover:bg-accent'
                            : canBook
                            ? 'bg-card hover:bg-accent cursor-pointer'
                            : 'bg-card'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-sm font-medium ${
                              isToday ? 'text-primary font-bold' : ''
                            } ${isPast && day.isCurrentMonth ? 'text-muted-foreground' : ''}`}
                          >
                            {day.date.getDate()}
                          </span>
                          {hasBookings && (
                            <Badge variant="secondary" className="h-5 text-xs px-1">
                              {day.bookings.length}
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1">
                          {day.bookings.slice(0, 2).map((booking, idx) => {
                            const typeInfo = getSessionTypeInfo(booking.session_type);
                            return (
                              <div
                                key={idx}
                                className={`text-xs px-1.5 py-0.5 rounded font-medium ${typeInfo.color}`}
                              >
                                <div className="truncate">
                                  {typeInfo.label}
                                  {selectedChildId === 'all' && children.length > 1 && (
                                    <span className="opacity-70"> • {getChildName(booking.registration_id).split(' ')[0]}</span>
                                  )}
                                </div>
                                <div className="text-[10px] opacity-70">{booking.time_slot}</div>
                              </div>
                            );
                          })}
                          {day.bookings.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{day.bookings.length - 2} {isFrench ? 'autres' : 'more'}
                            </div>
                          )}
                        </div>
                        {/* Show "+" indicator for bookable days with no bookings */}
                        {canBook && !hasBookings && day.isCurrentMonth && (
                          <div className="flex items-center justify-center h-8 text-muted-foreground/50 hover:text-muted-foreground">
                            <Plus className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <div className="flex items-center gap-4 text-sm flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-blue-500/20"></div>
                  <span className="text-muted-foreground">{isFrench ? 'Groupe' : 'Group'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-cyan-500/20"></div>
                  <span className="text-muted-foreground">{isFrench ? 'Glace dimanche' : 'Sunday Ice'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-purple-500/20"></div>
                  <span className="text-muted-foreground">{isFrench ? 'Privé' : 'Private'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-teal-500/20"></div>
                  <span className="text-muted-foreground">{isFrench ? 'Semi-privé' : 'Semi-Private'}</span>
                </div>
              </div>
            </CardFooter>
          </Card>

          {/* Location Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                {isFrench ? 'Lieu d\'entraînement' : 'Training Location'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="font-semibold text-lg">SniperZone Hockey Training</p>
                  <p className="text-muted-foreground">7515 Boulevard Henri-Bourassa E</p>
                  <p className="text-muted-foreground">Montréal, Québec H1E 1N9</p>
                </div>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      {isFrench ? 'Heures d\'entraînement' : 'Training Hours'}
                    </p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>{isFrench ? 'Lundi - Samedi: 16h30 - 21h30' : 'Monday - Saturday: 4:30 PM - 9:30 PM'}</li>
                      <li>{isFrench ? 'Dimanche: Séances de pratique sur glace' : 'Sunday: Ice Practice Sessions'}</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-2">{isFrench ? 'Notes importantes' : 'Important Notes'}</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• {isFrench ? 'Arriver 10 minutes à l\'avance' : 'Arrive 10 minutes early'}</li>
                      <li>• {isFrench ? 'Équipement complet requis' : 'Full equipment required'}</li>
                      <li>• {isFrench ? 'Apporter eau et serviette' : 'Bring water and towel'}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Book Session Modal */}
          <BookSessionModal
            open={showBookModal}
            onClose={() => {
              setShowBookModal(false);
              setSelectedDate(null);
            }}
            onSuccess={() => {
              fetchBookings();
              setShowBookModal(false);
              setSelectedDate(null);
            }}
            children={children}
            preSelectedDate={selectedDate}
          />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
};

export default SchedulePage;
