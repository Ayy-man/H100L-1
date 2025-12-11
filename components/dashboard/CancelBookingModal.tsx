import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Clock,
  User,
  Coins,
  Loader2,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { SessionBookingWithDetails } from '@/types/credits';
import { CANCELLATION_WINDOW_HOURS } from '@/types/credits';

interface CancelBookingModalProps {
  open: boolean;
  onClose: () => void;
  booking: SessionBookingWithDetails;
  onConfirm: () => Promise<void>;
}

/**
 * CancelBookingModal Component
 *
 * Confirmation modal for cancelling a booking:
 * - Shows booking details
 * - Explains refund policy (24h+ = credit refund)
 * - Confirms cancellation
 */
const CancelBookingModal: React.FC<CancelBookingModalProps> = ({
  open,
  onClose,
  booking,
  onConfirm,
}) => {
  const [cancelling, setCancelling] = useState(false);

  // Calculate hours until session
  const sessionDateTime = new Date(`${booking.session_date}T${convertTo24Hour(booking.time_slot)}`);
  const hoursUntilSession = Math.max(0, (sessionDateTime.getTime() - Date.now()) / (1000 * 60 * 60));
  const willRefundCredit = hoursUntilSession >= CANCELLATION_WINDOW_HOURS && booking.credits_used > 0;

  // Convert 12-hour to 24-hour format
  function convertTo24Hour(time: string): string {
    const [timePart, period] = time.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  // Format session date
  const formatDate = (dateString: string) => {
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get session type label
  const getSessionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      group: 'Group Training',
      sunday: 'Sunday Ice Practice',
      private: 'Private Training',
      semi_private: 'Semi-Private Training',
    };
    return labels[type] || type;
  };

  const handleConfirm = async () => {
    setCancelling(true);
    try {
      await onConfirm();
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <X className="h-5 w-5" />
            Cancel Booking
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel this session?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Booking Details */}
          <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{formatDate(booking.session_date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{booking.time_slot}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{booking.player_name}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {getSessionTypeLabel(booking.session_type)}
              {booking.is_recurring && ' (Recurring)'}
            </div>
          </div>

          {/* Refund Info */}
          {booking.credits_used > 0 && (
            <Alert className={willRefundCredit ? 'border-green-500/50 bg-green-500/10' : 'border-yellow-500/50 bg-yellow-500/10'}>
              <Coins className={`h-4 w-4 ${willRefundCredit ? 'text-green-600' : 'text-yellow-600'}`} />
              <AlertDescription className={willRefundCredit ? 'text-green-700' : 'text-yellow-700'}>
                {willRefundCredit ? (
                  <>
                    <strong>Credit will be refunded.</strong> You're cancelling more than 24 hours before the session.
                  </>
                ) : (
                  <>
                    <strong>No credit refund.</strong> You're cancelling less than 24 hours before the session.
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Paid Session Warning */}
          {booking.price_paid && booking.price_paid > 0 && (
            <Alert className="border-yellow-500/50 bg-yellow-500/10">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-700">
                <strong>Payment not refundable.</strong> Contact support for refund requests on paid sessions.
              </AlertDescription>
            </Alert>
          )}

          {/* Time Until Session */}
          <div className="text-sm text-center text-muted-foreground">
            {hoursUntilSession < 1 ? (
              <span className="text-red-500 font-medium">
                Session starts in less than 1 hour
              </span>
            ) : hoursUntilSession < 24 ? (
              <span className="text-yellow-600">
                Session starts in {Math.round(hoursUntilSession)} hours
              </span>
            ) : (
              <span>
                Session is in {Math.round(hoursUntilSession)} hours
              </span>
            )}
          </div>

          {/* Cancellation Policy */}
          <div className="text-xs text-muted-foreground border-t pt-3">
            <p className="font-medium mb-1">Cancellation Policy:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Cancel 24+ hours before: Full credit refund</li>
              <li>Cancel within 24 hours: No refund</li>
              <li>Paid sessions: Contact support for refunds</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Keep Booking
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={cancelling}
            className="flex-1"
          >
            {cancelling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              <>
                <X className="mr-2 h-4 w-4" />
                Cancel Booking
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CancelBookingModal;
