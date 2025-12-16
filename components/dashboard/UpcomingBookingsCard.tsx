import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  User,
  X,
  RefreshCw,
  CalendarPlus,
  ChevronRight,
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
import CancelBookingModal from './CancelBookingModal';
import BookSessionModal from './BookSessionModal';
import { useLanguage } from '@/contexts/LanguageContext';
import type { SessionBookingWithDetails } from '@/types/credits';
import type { ChildProfile } from '@/contexts/ProfileContext';
import { CANCELLATION_WINDOW_HOURS } from '@/types/credits';

interface UpcomingBookingsCardProps {
  bookings: SessionBookingWithDetails[];
  loading: boolean;
  onCancelBooking: (bookingId: string) => Promise<void>;
  onRefresh: () => void;
  creditBalance: number;
  children: ChildProfile[];
}

/**
 * UpcomingBookingsCard Component
 *
 * Shows all upcoming bookings across all children:
 * - Session date, time, and type
 * - Player name for each booking
 * - Cancel button (with 24h policy)
 * - Book new session button
 */
const UpcomingBookingsCard: React.FC<UpcomingBookingsCardProps> = ({
  bookings,
  loading,
  onCancelBooking,
  onRefresh,
  creditBalance,
  children,
}) => {
  const { language } = useLanguage();
  const isFrench = language === 'fr';
  const [cancellingBooking, setCancellingBooking] = useState<SessionBookingWithDetails | null>(null);
  const [showBookModal, setShowBookModal] = useState(false);
  const [selectedChild, setSelectedChild] = useState<ChildProfile | null>(null);

  // Sort bookings by date
  const sortedBookings = [...bookings].sort((a, b) =>
    new Date(a.session_date).getTime() - new Date(b.session_date).getTime()
  );

  // Check if booking can be cancelled (24h before)
  const canCancelBooking = (booking: SessionBookingWithDetails) => {
    const sessionDateTime = new Date(`${booking.session_date}T${convertTo24Hour(booking.time_slot)}`);
    const hoursUntilSession = (sessionDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntilSession >= CANCELLATION_WINDOW_HOURS;
  };

  // Convert 12-hour to 24-hour format
  const convertTo24Hour = (time: string): string => {
    const [timePart, period] = time.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // Format session date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.getTime() === today.getTime()) {
      return isFrench ? "Aujourd'hui" : 'Today';
    } else if (date.getTime() === tomorrow.getTime()) {
      return isFrench ? 'Demain' : 'Tomorrow';
    }

    return date.toLocaleDateString(isFrench ? 'fr-CA' : 'en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get session type badge
  const getSessionTypeBadge = (type: string, isRecurring: boolean) => {
    const typeConfig: Record<string, { label: string; labelFr: string; className: string }> = {
      group: { label: 'Group', labelFr: 'Groupe', className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
      sunday: { label: 'Sunday Ice', labelFr: 'Glace dimanche', className: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30' },
      private: { label: 'Private', labelFr: 'Privé', className: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
      semi_private: { label: 'Semi-Private', labelFr: 'Semi-privé', className: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
    };

    const config = typeConfig[type] || { label: type, labelFr: type, className: '' };

    return (
      <div className="flex items-center gap-1">
        <Badge variant="outline" className={config.className}>
          {isFrench ? config.labelFr : config.label}
        </Badge>
        {isRecurring && (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            {isFrench ? 'Récurrent' : 'Recurring'}
          </Badge>
        )}
      </div>
    );
  };

  const handleStartBooking = () => {
    if (children.length === 1) {
      setSelectedChild(children[0]);
    }
    setShowBookModal(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
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
                <Calendar className="h-5 w-5 text-primary" />
                {isFrench ? 'Séances à venir' : 'Upcoming Sessions'}
              </CardTitle>
              <CardDescription>
                {isFrench
                  ? `${sortedBookings.length} réservation${sortedBookings.length !== 1 ? 's' : ''} à venir`
                  : `${sortedBookings.length} upcoming booking${sortedBookings.length !== 1 ? 's' : ''}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                className="h-8 w-8"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleStartBooking}
                disabled={children.length === 0}
              >
                <CalendarPlus className="mr-1 h-4 w-4" />
                {isFrench ? 'Réserver' : 'Book Session'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {sortedBookings.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-2">
                {isFrench ? 'Aucune séance réservée' : 'No upcoming sessions booked'}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {creditBalance > 0
                  ? (isFrench ? `Vous avez ${creditBalance} crédit${creditBalance !== 1 ? 's' : ''} disponible${creditBalance !== 1 ? 's' : ''}` : `You have ${creditBalance} credit${creditBalance !== 1 ? 's' : ''} available`)
                  : (isFrench ? 'Achetez des crédits pour réserver des séances' : 'Buy credits to book training sessions')}
              </p>
              <Button onClick={handleStartBooking} disabled={children.length === 0}>
                {isFrench ? 'Réserver votre première séance' : 'Book Your First Session'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedBookings.slice(0, 5).map((booking) => {
                const canCancel = canCancelBooking(booking);

                return (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-primary/10">
                        <span className="text-xs text-muted-foreground uppercase">
                          {new Date(booking.session_date + 'T00:00:00').toLocaleDateString(isFrench ? 'fr-CA' : 'en-US', { weekday: 'short' })}
                        </span>
                        <span className="text-lg font-bold text-primary">
                          {new Date(booking.session_date + 'T00:00:00').getDate()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">
                            {formatDate(booking.session_date)}
                          </p>
                          {getSessionTypeBadge(booking.session_type, booking.is_recurring)}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {booking.time_slot}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {booking.player_name}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCancellingBooking(booking)}
                      disabled={!canCancel}
                      className={`${canCancel ? 'text-red-500 hover:text-red-600 hover:bg-red-50' : 'text-muted-foreground'}`}
                      title={canCancel ? (isFrench ? 'Annuler la réservation' : 'Cancel booking') : (isFrench ? 'Annulation impossible moins de 24h avant' : 'Cannot cancel within 24 hours')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}

              {sortedBookings.length > 5 && (
                <Button variant="ghost" className="w-full" asChild>
                  <a href="/schedule">
                    {isFrench ? `Voir les ${sortedBookings.length} réservations` : `View All ${sortedBookings.length} Bookings`}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Booking Modal */}
      {cancellingBooking && (
        <CancelBookingModal
          open={!!cancellingBooking}
          onClose={() => setCancellingBooking(null)}
          booking={cancellingBooking}
          onConfirm={async () => {
            await onCancelBooking(cancellingBooking.id);
            setCancellingBooking(null);
          }}
        />
      )}

      {/* Book Session Modal */}
      {showBookModal && (
        <BookSessionModal
          open={showBookModal}
          onClose={() => {
            setShowBookModal(false);
            setSelectedChild(null);
          }}
          child={selectedChild || (children.length > 0 ? children[0] : null) as ChildProfile}
          allChildren={children}
        />
      )}
    </>
  );
};

export default UpcomingBookingsCard;
