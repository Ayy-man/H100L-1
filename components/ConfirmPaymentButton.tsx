import React, { useState } from 'react';
import { auth } from '@/lib/firebase';
import { toast } from 'sonner';

interface ConfirmPaymentButtonProps {
  registrationId: string;
  currentStatus: string;
  onConfirmed: () => void;
}

/**
 * Confirm Payment Button for Admin Dashboard
 *
 * Allows authorized admin users to manually confirm payments.
 * Shows a confirmation dialog with reason selection.
 */
const ConfirmPaymentButton: React.FC<ConfirmPaymentButtonProps> = ({
  registrationId,
  currentStatus,
  onConfirmed,
}) => {
  const [showDialog, setShowDialog] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    const adminEmail = auth.currentUser?.email;

    if (!adminEmail) {
      toast.error('You must be logged in to confirm payments');
      return;
    }

    if (!reason) {
      toast.error('Please select a reason for confirmation');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin-confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId,
          adminEmail,
          reason,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Payment confirmed successfully!');
        setShowDialog(false);
        onConfirmed();
      } else {
        toast.error(data.error || 'Failed to confirm payment');
      }
    } catch (error) {
      console.error('Confirm payment error:', error);
      toast.error('Failed to confirm payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Don't show button if already succeeded
  if (currentStatus === 'succeeded') {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="text-green-400 hover:text-green-300 transition-colors"
        title="Manually Confirm Payment"
      >
        ✅
      </button>

      {/* Confirmation Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">
              Confirm Payment Manually
            </h3>

            <p className="text-gray-300 mb-4">
              This will mark the registration as paid. Select the reason:
            </p>

            <div className="space-y-2 mb-6">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="reason"
                  value="offline_payment"
                  checked={reason === 'offline_payment'}
                  onChange={(e) => setReason(e.target.value)}
                  className="form-radio text-blue-500"
                />
                <span className="text-gray-200">
                  Offline Payment (cash, e-transfer)
                </span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="reason"
                  value="external_payment"
                  checked={reason === 'external_payment'}
                  onChange={(e) => setReason(e.target.value)}
                  className="form-radio text-blue-500"
                />
                <span className="text-gray-200">
                  Payment made outside dashboard
                </span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="reason"
                  value="stripe_verified"
                  checked={reason === 'stripe_verified'}
                  onChange={(e) => setReason(e.target.value)}
                  className="form-radio text-blue-500"
                />
                <span className="text-gray-200">
                  Verified in Stripe Dashboard
                </span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="reason"
                  value="error_override"
                  checked={reason === 'error_override'}
                  onChange={(e) => setReason(e.target.value)}
                  className="form-radio text-blue-500"
                />
                <span className="text-gray-200">
                  Error Override / Customer Request
                </span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                disabled={isSubmitting || !reason}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded transition-colors"
              >
                {isSubmitting ? 'Confirming...' : 'Confirm Payment'}
              </button>
              <button
                onClick={() => setShowDialog(false)}
                disabled={isSubmitting}
                className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:cursor-not-allowed text-white py-2 px-4 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ConfirmPaymentButton;
