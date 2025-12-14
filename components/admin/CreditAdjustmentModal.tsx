import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, AlertTriangle } from 'lucide-react';

interface CreditUser {
  firebase_uid: string;
  parent_email: string;
  credits_remaining: number;
  children: Array<{
    name: string;
    category: string;
  }>;
}

interface CreditAdjustmentModalProps {
  user: CreditUser;
  onClose: () => void;
  onComplete: () => void;
}

const CreditAdjustmentModal: React.FC<CreditAdjustmentModalProps> = ({
  user,
  onClose,
  onComplete
}) => {
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasons = [
    'Customer service',
    'System error',
    'Promotional credit',
    'Refund',
    'Coaching credit',
    'Schedule change',
    'Other'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const creditAmount = parseInt(amount);
    if (!creditAmount || creditAmount <= 0) {
      setError('Please enter a valid credit amount');
      return;
    }

    if (!reason) {
      setError('Please select a reason for the adjustment');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/admin-adjust-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firebase_uid: user.firebase_uid,
          adjustment_amount: adjustmentType === 'add' ? creditAmount : -creditAmount,
          reason: reason,
          admin_notes: notes,
          admin_email: 'admin@sniperzone.ca' // TODO: Get from auth context
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to adjust credits');
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const newBalance = adjustmentType === 'add'
    ? user.credits_remaining + parseInt(amount || '0')
    : user.credits_remaining - parseInt(amount || '0');

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={handleBackdropClick}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-xl shadow-xl max-w-md w-full"
        >
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-semibold">Adjust Credits</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            {/* User Info */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">User</p>
              <p className="font-medium">{user.parent_email}</p>
              <p className="text-sm text-gray-600 mt-1">
                Current balance: <span className="font-semibold">{user.credits_remaining} credits</span>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Adjustment Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adjustment Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('add')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      adjustmentType === 'add'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Plus className="w-5 h-5 mx-auto mb-1" />
                    Add Credits
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('remove')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      adjustmentType === 'remove'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Minus className="w-5 h-5 mx-auto mb-1" />
                    Remove Credits
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Credits
                </label>
                <input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter amount"
                  required
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select a reason</option>
                  {reasons.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Admin Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Additional notes about this adjustment"
                />
              </div>

              {/* Warning for removing credits */}
              {adjustmentType === 'remove' && newBalance < 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">
                      Warning: This will result in a negative credit balance
                    </p>
                    <p className="text-sm text-red-700">
                      The user will have {newBalance} credits after this adjustment.
                    </p>
                  </div>
                </div>
              )}

              {/* Preview */}
              {amount && !isNaN(parseInt(amount)) && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800">
                    New balance will be: {newBalance} credits
                  </p>
                  <p className="text-sm text-blue-700">
                    {adjustmentType === 'add' ? 'Adding' : 'Removing'} {amount} credits
                  </p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !amount || !reason}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Processing...' : 'Confirm Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CreditAdjustmentModal;