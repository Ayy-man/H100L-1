import React, { useState } from 'react';
import { toast } from 'sonner';

interface ConfirmPaymentButtonProps {
  registrationId: string;
  currentStatus: string;
  onConfirmed: () => void;
  adminEmail?: string;
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
  adminEmail = 'admin@sniperzone.ca',
}) => {
  const [showDialog, setShowDialog] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
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

  // Don't show button if already verified
  if (currentStatus === 'verified') {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="text-[#9BD4FF] hover:text-[#7BB4DD] transition-colors"
        title="Manually Confirm Payment"
      >
        ✅
      </button>

      {/* Confirmation Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">
              Manually Verify Payment
            </h3>

            <p className="text-gray-300 mb-4 break-words">
              {currentStatus === 'pending'
                ? 'This will mark the registration as VERIFIED (for offline/cash payments).'
                : 'This will upgrade the status to VERIFIED (admin double-check on top of Stripe payment).'}
            </p>

            <p className="text-gray-300 mb-4 font-semibold">
              Select reason for verification:
            </p>

            <div className="space-y-2 mb-6">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="reason"
                  value="offline_payment"
                  checked={reason === 'offline_payment'}
                  onChange={(e) => setReason(e.target.value)}
                  className="form-radio text-[#9BD4FF]"
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
                  className="form-radio text-[#9BD4FF]"
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
                  className="form-radio text-[#9BD4FF]"
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
                  className="form-radio text-[#9BD4FF]"
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
                className="flex-1 bg-[#9BD4FF] hover:bg-[#7BB4DD] disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold py-2 px-4 rounded transition-colors"
              >
                {isSubmitting ? 'Verifying...' : 'Verify Payment'}
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
