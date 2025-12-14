import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, User, Mail, Calendar, TrendingUp, Plus, Minus, Eye } from 'lucide-react';
import CreditAdjustmentModal from './CreditAdjustmentModal';

interface CreditUser {
  firebase_uid: string;
  parent_email: string;
  total_credits: number;
  credits_remaining: number;
  total_purchases: number;
  last_purchase: string | null;
  last_activity: string | null;
  children: Array<{
    name: string;
    category: string;
  }>;
}

interface CreditHistory {
  id: string;
  type: 'purchase' | 'usage' | 'adjustment';
  amount: number;
  description: string;
  created_at: string;
  player_name?: string;
  admin_email?: string;
  reason?: string;
}

const CreditManagementPanel: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CreditUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<CreditUser | null>(null);
  const [creditHistory, setCreditHistory] = useState<CreditHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await fetch(`/api/admin/credit-search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      setSearchResults(data.users || []);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleUserSelect = async (user: CreditUser) => {
    setSelectedUser(user);
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/credit-history?firebase_uid=${user.firebase_uid}`);
      if (!response.ok) throw new Error('Failed to fetch history');
      const data = await response.json();
      setCreditHistory(data.history || []);
    } catch (error) {
      console.error('History error:', error);
      setCreditHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustmentComplete = () => {
    setShowAdjustmentModal(false);
    if (selectedUser) {
      handleUserSelect(selectedUser);
    }
    // Refresh search results
    handleSearch();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount / 100);
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
      >
        <h2 className="text-xl font-semibold mb-4">User Credit Search</h2>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by email or player name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Search Results */}
        <AnimatePresence>
          {searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-4 border-t pt-4"
            >
              <h3 className="font-medium mb-3">Results ({searchResults.length})</h3>
              <div className="space-y-2">
                {searchResults.map((user) => (
                  <motion.div
                    key={user.firebase_uid}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleUserSelect(user)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{user.parent_email}</p>
                        <p className="text-sm text-gray-500">
                          {user.children.length} child{user.children.length !== 1 ? 'ren' : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{user.credits_remaining} credits</p>
                        <p className="text-xs text-gray-500">Last active: {formatDate(user.last_activity)}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* User Details */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">User Details</h2>
              <button
                onClick={() => setShowAdjustmentModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Adjust Credits
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium">{selectedUser.parent_email}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Current Balance</p>
                <p className="font-bold text-blue-600 text-xl">{selectedUser.credits_remaining}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Purchased</p>
                <p className="font-bold text-green-600">{selectedUser.total_credits}</p>
              </div>
            </div>

            {/* Children */}
            {selectedUser.children.length > 0 && (
              <div className="mb-6">
                <h3 className="font-medium mb-2">Children</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {selectedUser.children.map((child, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <User className="w-4 h-4 text-gray-400" />
                      <span>{child.name} - {child.category}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Credit History */}
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Credit History
              </h3>
              {loading ? (
                <div className="animate-pulse space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded"></div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {creditHistory.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No credit history</p>
                  ) : (
                    creditHistory.map((entry) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`p-3 rounded-lg border ${
                          entry.type === 'purchase' ? 'bg-green-50 border-green-200' :
                          entry.type === 'usage' ? 'bg-red-50 border-red-200' :
                          'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{entry.description}</p>
                            {entry.player_name && (
                              <p className="text-sm text-gray-600">Player: {entry.player_name}</p>
                            )}
                            {entry.admin_email && (
                              <p className="text-sm text-gray-600">Admin: {entry.admin_email}</p>
                            )}
                            {entry.reason && (
                              <p className="text-sm text-gray-600">Reason: {entry.reason}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold ${
                              entry.type === 'purchase' ? 'text-green-600' :
                              entry.type === 'usage' ? 'text-red-600' :
                              'text-blue-600'
                            }`}>
                              {entry.type === 'purchase' ? '+' : entry.type === 'usage' ? '-' : ''}
                              {entry.amount} credits
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(entry.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Adjustment Modal */}
      <AnimatePresence>
        {showAdjustmentModal && selectedUser && (
          <CreditAdjustmentModal
            user={selectedUser}
            onClose={() => setShowAdjustmentModal(false)}
            onComplete={handleAdjustmentComplete}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default CreditManagementPanel;