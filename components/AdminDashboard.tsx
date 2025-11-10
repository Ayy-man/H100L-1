import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface Registration {
  id: string;
  created_at: string;
  form_data: any;
  payment_status: string;
  payment_method_id?: string;
}

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}

interface CapacitySlot {
  id: string;
  time_slot_name: string;
  day_of_week: string;
  applicable_categories: string[];
  capacity: number;
  current_registrations: number;
  is_active: boolean;
  status: 'FULL' | 'ALMOST_FULL' | 'HALF_FULL' | 'AVAILABLE';
  fill_percentage: number;
  spots_remaining: number;
}

interface SlotRegistration {
  id: string;
  player_name: string;
  player_category: string;
  parent_email: string;
  created_at: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-black border border-white/10 rounded-lg p-6 hover:border-[#9BD4FF]/50 transition-all duration-300"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-gray-400 text-sm uppercase tracking-wider">{title}</p>
        <p className={`text-3xl font-bold mt-2 ${color}`}>{value}</p>
      </div>
      <div className="text-4xl">{icon}</div>
    </div>
  </motion.div>
);

const AdminDashboard: React.FC = () => {
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [capacitySlots, setCapacitySlots] = useState<CapacitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selected registration for detail view
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [activeTab, setActiveTab] = useState<string>('player');

  // Selected slot for viewing registered players
  const [selectedSlot, setSelectedSlot] = useState<CapacitySlot | null>(null);
  const [slotPlayers, setSlotPlayers] = useState<SlotRegistration[]>([]);
  const [loadingSlotDetails, setLoadingSlotDetails] = useState(false);

  useEffect(() => {
    const password = prompt('Enter admin password:');
    if (password === 'sniperzone2025') {
      setAuthenticated(true);
    } else {
      alert('Incorrect password.');
      window.location.href = '/';
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();

      // Set up real-time subscription for capacity updates
      const channel = supabase
        .channel('capacity_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => {
          fetchCapacityData();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchRegistrations(), fetchCapacityData()]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistrations = async () => {
    const { data: regData, error: regError } = await supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (regError) throw regError;

    const parsedData = regData.map((reg: any) => ({
      ...reg,
      form_data: typeof reg.form_data === 'string'
        ? JSON.parse(reg.form_data)
        : reg.form_data
    }));

    setRegistrations(parsedData);
  };

  const fetchCapacityData = async () => {
    const { data: capacityData, error: capacityError } = await supabase
      .from('capacity_overview')
      .select('*');

    if (!capacityError && capacityData) {
      setCapacitySlots(capacityData);
    }
  };

  const fetchSlotDetails = async (slot: CapacitySlot) => {
    setSelectedSlot(slot);
    setLoadingSlotDetails(true);

    try {
      // Get registrations for this slot
      const players = registrations
        .filter(reg => {
          const formData = reg.form_data || {};
          const programType = formData.programType;
          const playerCategory = formData.playerCategory;

          // Check if player's category matches slot's applicable categories
          if (!slot.applicable_categories.includes(playerCategory)) {
            return false;
          }

          // For group training
          if (programType === 'group') {
            const frequency = formData.groupFrequency;
            const selectedDay = formData.groupDay;

            // 1x per week - must match the day
            if (frequency === '1x' && selectedDay === slot.day_of_week.toLowerCase()) {
              return true;
            }

            // 2x per week - matches both days
            if (frequency === '2x') {
              return true;
            }
          }

          return false;
        })
        .map(reg => ({
          id: reg.id,
          player_name: reg.form_data?.playerFullName || 'N/A',
          player_category: reg.form_data?.playerCategory || 'N/A',
          parent_email: reg.form_data?.parentEmail || 'N/A',
          created_at: reg.created_at
        }));

      setSlotPlayers(players);
    } finally {
      setLoadingSlotDetails(false);
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const total = registrations.length;
    const paid = registrations.filter(r => r.payment_status === 'paid').length;
    const pending = total - paid;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = registrations.filter(r => {
      const regDate = new Date(r.created_at);
      regDate.setHours(0, 0, 0, 0);
      return regDate.getTime() === today.getTime();
    }).length;

    return { total, paid, pending, todayCount };
  }, [registrations]);

  // Filtered registrations
  const filteredRegistrations = useMemo(() => {
    return registrations.filter(reg => {
      const formData = reg.form_data || {};
      const playerName = (formData.playerFullName || '').toLowerCase();
      const parentEmail = (formData.parentEmail || '').toLowerCase();
      const search = searchTerm.toLowerCase();

      const matchesSearch = playerName.includes(search) || parentEmail.includes(search);
      const matchesProgram = programFilter === 'all' || formData.programType === programFilter;
      const matchesPayment = paymentFilter === 'all' || reg.payment_status === paymentFilter;
      const matchesCategory = categoryFilter === 'all' || formData.playerCategory === categoryFilter;

      return matchesSearch && matchesProgram && matchesPayment && matchesCategory;
    });
  }, [registrations, searchTerm, programFilter, paymentFilter, categoryFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredRegistrations.length / itemsPerPage);
  const paginatedRegistrations = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRegistrations.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRegistrations, currentPage]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    registrations.forEach(reg => {
      if (reg.form_data?.playerCategory) {
        cats.add(reg.form_data.playerCategory);
      }
    });
    return Array.from(cats).sort();
  }, [registrations]);

  // Group capacity slots by day
  const slotsByDay = useMemo(() => {
    const tuesday = capacitySlots.filter(s => s.day_of_week === 'Tuesday');
    const friday = capacitySlots.filter(s => s.day_of_week === 'Friday');
    return { tuesday, friday };
  }, [capacitySlots]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this registration?')) return;

    try {
      const { error } = await supabase
        .from('registrations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setRegistrations(prev => prev.filter(r => r.id !== id));
      alert('Registration deleted successfully');

      // Refresh capacity data
      fetchCapacityData();
    } catch (err: any) {
      alert(`Error deleting registration: ${err.message}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'pending': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'failed': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getCapacityColor = (status: string) => {
    switch (status) {
      case 'FULL': return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50', bar: 'bg-red-500' };
      case 'ALMOST_FULL': return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50', bar: 'bg-yellow-500' };
      case 'HALF_FULL': return { bg: 'bg-blue-500/20', text: 'text-[#9BD4FF]', border: 'border-[#9BD4FF]/50', bar: 'bg-[#9BD4FF]' };
      default: return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50', bar: 'bg-green-400' };
    }
  };

  const CapacitySlotCard: React.FC<{ slot: CapacitySlot }> = ({ slot }) => {
    const colors = getCapacityColor(slot.status);
    const isFull = slot.status === 'FULL';
    const needsWarning = slot.status === 'ALMOST_FULL' || slot.status === 'FULL';

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.02 }}
        onClick={() => fetchSlotDetails(slot)}
        className={`relative bg-black border ${colors.border} rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${colors.bg}`}
      >
        {/* Full Overlay */}
        {isFull && (
          <div className="absolute inset-0 bg-red-500/10 rounded-lg flex items-center justify-center backdrop-blur-[1px]">
            <span className="text-red-400 font-black text-2xl uppercase tracking-wider rotate-[-15deg] border-4 border-red-500 px-6 py-2 rounded-lg">
              FULL
            </span>
          </div>
        )}

        {/* Warning Badge */}
        {needsWarning && !isFull && (
          <div className="absolute top-2 right-2">
            <span className="bg-yellow-500/20 text-yellow-400 text-xs font-bold px-2 py-1 rounded-full border border-yellow-500/50">
              ⚠️ {slot.spots_remaining} left
            </span>
          </div>
        )}

        {/* Time Slot */}
        <p className="text-white font-bold text-lg mb-2">
          {slot.time_slot_name.replace(slot.day_of_week + ' ', '')}
        </p>

        {/* Applicable Categories */}
        <div className="flex gap-1 mb-3 flex-wrap">
          {slot.applicable_categories.map(cat => (
            <span key={cat} className="bg-white/10 text-gray-300 text-xs px-2 py-1 rounded">
              {cat}
            </span>
          ))}
        </div>

        {/* Capacity Info */}
        <div className="flex items-center justify-between mb-2">
          <span className={`${colors.text} font-bold text-lg`}>
            {slot.current_registrations}/{slot.capacity}
          </span>
          <span className={`text-sm ${colors.text}`}>
            {slot.fill_percentage}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(slot.fill_percentage, 100)}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`h-3 rounded-full ${colors.bar}`}
          />
        </div>

        {/* Click hint */}
        <p className="text-gray-500 text-xs mt-2 text-center">
          Click to view registrations
        </p>
      </motion.div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="bg-gray-900 min-h-screen flex items-center justify-center">
        <p className="text-white">Authentication required.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gray-900 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#9BD4FF] mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-5xl uppercase font-black tracking-wider text-white mb-2">
            Admin Dashboard
          </h1>
          <p className="text-gray-400">Manage SniperZone registrations and track performance</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Registrations"
            value={stats.total}
            icon="📊"
            color="text-[#9BD4FF]"
          />
          <StatsCard
            title="Paid"
            value={stats.paid}
            icon="✅"
            color="text-green-400"
          />
          <StatsCard
            title="Pending"
            value={stats.pending}
            icon="⏳"
            color="text-yellow-400"
          />
          <StatsCard
            title="Today's Registrations"
            value={stats.todayCount}
            icon="🆕"
            color="text-[#9BD4FF]"
          />
        </div>

        {/* ENHANCED CAPACITY OVERVIEW */}
        {capacitySlots.length > 0 && (
          <div className="bg-black border border-white/10 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white uppercase tracking-wider">
                🏒 Capacity Overview
              </h2>
              <button
                onClick={() => fetchCapacityData()}
                className="text-[#9BD4FF] hover:text-[#7db4d9] transition-colors text-sm flex items-center gap-2"
              >
                🔄 Refresh
              </button>
            </div>

            {/* Tuesday Slots */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-[#9BD4FF] mb-4 uppercase tracking-wider">
                Tuesday Sessions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {slotsByDay.tuesday.map(slot => (
                  <CapacitySlotCard key={slot.id} slot={slot} />
                ))}
              </div>
            </div>

            {/* Friday Slots */}
            <div>
              <h3 className="text-xl font-bold text-[#9BD4FF] mb-4 uppercase tracking-wider">
                Friday Sessions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {slotsByDay.friday.map(slot => (
                  <CapacitySlotCard key={slot.id} slot={slot} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-black border border-white/10 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-wider">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#9BD4FF] transition-colors"
            />

            {/* Program Type Filter */}
            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#9BD4FF] transition-colors"
            >
              <option value="all">All Programs</option>
              <option value="group">Group Training</option>
              <option value="private">Private Training</option>
              <option value="semi-private">Semi-Private</option>
            </select>

            {/* Payment Status Filter */}
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#9BD4FF] transition-colors"
            >
              <option value="all">All Payment Status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#9BD4FF] transition-colors"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Active Filters Summary */}
          {(searchTerm || programFilter !== 'all' || paymentFilter !== 'all' || categoryFilter !== 'all') && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className="text-gray-400 text-sm">Active filters:</span>
              {searchTerm && (
                <span className="bg-[#9BD4FF]/20 text-[#9BD4FF] px-3 py-1 rounded-full text-sm">
                  Search: "{searchTerm}"
                </span>
              )}
              {programFilter !== 'all' && (
                <span className="bg-[#9BD4FF]/20 text-[#9BD4FF] px-3 py-1 rounded-full text-sm capitalize">
                  {programFilter}
                </span>
              )}
              {paymentFilter !== 'all' && (
                <span className="bg-[#9BD4FF]/20 text-[#9BD4FF] px-3 py-1 rounded-full text-sm capitalize">
                  {paymentFilter}
                </span>
              )}
              {categoryFilter !== 'all' && (
                <span className="bg-[#9BD4FF]/20 text-[#9BD4FF] px-3 py-1 rounded-full text-sm">
                  {categoryFilter}
                </span>
              )}
              <button
                onClick={() => {
                  setSearchTerm('');
                  setProgramFilter('all');
                  setPaymentFilter('all');
                  setCategoryFilter('all');
                }}
                className="text-red-400 hover:text-red-300 text-sm underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-4">
          <p className="text-gray-400">
            Showing {paginatedRegistrations.length} of {filteredRegistrations.length} registrations
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-8">
            <p className="text-red-400">Error: {error}</p>
          </div>
        )}

        {/* Table */}
        <div className="bg-black border border-white/10 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-[#9BD4FF]/10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#9BD4FF] uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#9BD4FF] uppercase tracking-wider">Player</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#9BD4FF] uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#9BD4FF] uppercase tracking-wider">Program</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#9BD4FF] uppercase tracking-wider">Frequency</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#9BD4FF] uppercase tracking-wider">Parent Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#9BD4FF] uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#9BD4FF] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {paginatedRegistrations.length > 0 ? (
                  paginatedRegistrations.map((reg) => (
                    <motion.tr
                      key={reg.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {new Date(reg.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {reg.form_data?.playerFullName || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {reg.form_data?.playerCategory || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 capitalize">
                        {reg.form_data?.programType || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {reg.form_data?.groupFrequency || reg.form_data?.privateFrequency || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {reg.form_data?.parentEmail || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusColor(reg.payment_status)}`}>
                          {reg.payment_status || 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedRegistration(reg)}
                            className="text-[#9BD4FF] hover:text-[#7db4d9] transition-colors"
                            title="View Details"
                          >
                            👁️
                          </button>
                          <button
                            onClick={() => handleDelete(reg.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                      No registrations found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white/5 px-6 py-4 flex items-center justify-between border-t border-white/10">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      currentPage === page
                        ? 'bg-[#9BD4FF] text-black font-bold'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Slot Details Modal */}
      <AnimatePresence>
        {selectedSlot && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedSlot(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 border border-white/10 rounded-xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white uppercase tracking-wider">
                    {selectedSlot.time_slot_name}
                  </h2>
                  <div className="flex gap-2 mt-2">
                    {selectedSlot.applicable_categories.map(cat => (
                      <span key={cat} className="bg-[#9BD4FF]/20 text-[#9BD4FF] text-xs px-3 py-1 rounded-full">
                        {cat}
                      </span>
                    ))}
                  </div>
                  <p className="text-gray-400 mt-2">
                    Capacity: {selectedSlot.current_registrations}/{selectedSlot.capacity} ({selectedSlot.fill_percentage}% full)
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSlot(null)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              {loadingSlotDetails ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#9BD4FF] mx-auto"></div>
                  <p className="text-gray-400 mt-4">Loading registrations...</p>
                </div>
              ) : slotPlayers.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-[#9BD4FF] uppercase tracking-wider mb-4">
                    Registered Players ({slotPlayers.length})
                  </h3>
                  {slotPlayers.map((player, idx) => (
                    <div
                      key={player.id}
                      className="bg-black border border-white/10 rounded-lg p-4 hover:border-[#9BD4FF]/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-bold">{idx + 1}. {player.player_name}</p>
                          <p className="text-gray-400 text-sm">{player.player_category} • {player.parent_email}</p>
                        </div>
                        <p className="text-gray-500 text-xs">
                          {new Date(player.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-lg">No registrations for this slot yet.</p>
                </div>
              )}

              <button
                onClick={() => setSelectedSlot(null)}
                className="mt-6 w-full bg-[#9BD4FF] text-black font-bold py-3 rounded-lg hover:shadow-[0_0_15px_#9BD4FF] transition-all"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Enhanced Registration Detail Modal with Tabs */}
      <AnimatePresence>
        {selectedRegistration && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => {
              setSelectedRegistration(null);
              setActiveTab('player');
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex justify-between items-start p-6 border-b border-white/10">
                <div>
                  <h2 className="text-2xl font-bold text-white uppercase tracking-wider">
                    Registration Details
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">
                    {selectedRegistration.form_data?.playerFullName || 'Unknown Player'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedRegistration(null);
                    setActiveTab('player');
                  }}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-white/10 overflow-x-auto">
                {[
                  { id: 'player', label: '👤 Player Info', icon: '👤' },
                  { id: 'parent', label: '👨‍👩‍👦 Parent/Contact', icon: '👨‍👩‍👦' },
                  { id: 'program', label: '🏒 Program', icon: '🏒' },
                  { id: 'health', label: '🏥 Health & Consent', icon: '🏥' },
                  { id: 'payment', label: '💳 Payment', icon: '💳' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'text-[#9BD4FF] border-b-2 border-[#9BD4FF] bg-[#9BD4FF]/10'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Player Info Tab */}
                    {activeTab === 'player' && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-bold text-[#9BD4FF] uppercase tracking-wider mb-4">
                          Player Information
                        </h3>
                        {[
                          { label: 'Full Name', value: selectedRegistration.form_data?.playerFullName },
                          { label: 'Date of Birth', value: selectedRegistration.form_data?.dateOfBirth },
                          { label: 'Category', value: selectedRegistration.form_data?.playerCategory },
                          { label: 'Position', value: selectedRegistration.form_data?.position },
                          { label: 'Dominant Hand', value: selectedRegistration.form_data?.dominantHand },
                          { label: 'Current Level', value: selectedRegistration.form_data?.currentLevel },
                          { label: 'Jersey Size', value: selectedRegistration.form_data?.jerseySize },
                          { label: 'Primary Objective', value: selectedRegistration.form_data?.primaryObjective }
                        ].map(field => (
                          <div key={field.label} className="border-b border-white/10 pb-3">
                            <p className="text-gray-400 text-sm uppercase tracking-wider">{field.label}</p>
                            <p className="text-white mt-1 text-lg">{field.value || 'N/A'}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Parent/Contact Tab */}
                    {activeTab === 'parent' && (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-lg font-bold text-[#9BD4FF] uppercase tracking-wider mb-4">
                            Parent/Guardian Information
                          </h3>
                          {[
                            { label: 'Full Name', value: selectedRegistration.form_data?.parentFullName },
                            { label: 'Email', value: selectedRegistration.form_data?.parentEmail },
                            { label: 'Phone', value: selectedRegistration.form_data?.parentPhone },
                            { label: 'City', value: selectedRegistration.form_data?.parentCity },
                            { label: 'Postal Code', value: selectedRegistration.form_data?.parentPostalCode },
                            { label: 'Language', value: selectedRegistration.form_data?.communicationLanguage }
                          ].map(field => (
                            <div key={field.label} className="border-b border-white/10 pb-3 mb-4">
                              <p className="text-gray-400 text-sm uppercase tracking-wider">{field.label}</p>
                              <p className="text-white mt-1 text-lg">{field.value || 'N/A'}</p>
                            </div>
                          ))}
                        </div>

                        <div>
                          <h3 className="text-lg font-bold text-[#9BD4FF] uppercase tracking-wider mb-4">
                            Emergency Contact
                          </h3>
                          {[
                            { label: 'Name', value: selectedRegistration.form_data?.emergencyContactName },
                            { label: 'Phone', value: selectedRegistration.form_data?.emergencyContactPhone },
                            { label: 'Relationship', value: selectedRegistration.form_data?.emergencyRelationship }
                          ].map(field => (
                            <div key={field.label} className="border-b border-white/10 pb-3 mb-4">
                              <p className="text-gray-400 text-sm uppercase tracking-wider">{field.label}</p>
                              <p className="text-white mt-1 text-lg">{field.value || 'N/A'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Program Tab */}
                    {activeTab === 'program' && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-bold text-[#9BD4FF] uppercase tracking-wider mb-4">
                          Program Details
                        </h3>
                        <div className="border-b border-white/10 pb-3">
                          <p className="text-gray-400 text-sm uppercase tracking-wider">Program Type</p>
                          <p className="text-white mt-1 text-lg capitalize">
                            {selectedRegistration.form_data?.programType || 'N/A'}
                          </p>
                        </div>

                        {selectedRegistration.form_data?.programType === 'group' && (
                          <>
                            <div className="border-b border-white/10 pb-3">
                              <p className="text-gray-400 text-sm uppercase tracking-wider">Frequency</p>
                              <p className="text-white mt-1 text-lg">
                                {selectedRegistration.form_data?.groupFrequency || 'N/A'}
                              </p>
                            </div>
                            <div className="border-b border-white/10 pb-3">
                              <p className="text-gray-400 text-sm uppercase tracking-wider">Selected Day</p>
                              <p className="text-white mt-1 text-lg capitalize">
                                {selectedRegistration.form_data?.groupDay || 'N/A'}
                              </p>
                            </div>
                            <div className="border-b border-white/10 pb-3">
                              <p className="text-gray-400 text-sm uppercase tracking-wider">Sunday Practice</p>
                              <p className="text-white mt-1 text-lg">
                                {selectedRegistration.form_data?.sundayPractice ? 'Yes' : 'No'}
                              </p>
                            </div>
                          </>
                        )}

                        {selectedRegistration.form_data?.programType === 'private' && (
                          <>
                            <div className="border-b border-white/10 pb-3">
                              <p className="text-gray-400 text-sm uppercase tracking-wider">Frequency</p>
                              <p className="text-white mt-1 text-lg">
                                {selectedRegistration.form_data?.privateFrequency || 'N/A'}
                              </p>
                            </div>
                            <div className="border-b border-white/10 pb-3">
                              <p className="text-gray-400 text-sm uppercase tracking-wider">Time Slot</p>
                              <p className="text-white mt-1 text-lg">
                                {selectedRegistration.form_data?.privateTimeSlot || 'N/A'}
                              </p>
                            </div>
                            <div className="border-b border-white/10 pb-3">
                              <p className="text-gray-400 text-sm uppercase tracking-wider">Selected Days</p>
                              <p className="text-white mt-1 text-lg">
                                {selectedRegistration.form_data?.privateSelectedDays?.join(', ') || 'N/A'}
                              </p>
                            </div>
                          </>
                        )}

                        {selectedRegistration.form_data?.programType === 'semi-private' && (
                          <>
                            <div className="border-b border-white/10 pb-3">
                              <p className="text-gray-400 text-sm uppercase tracking-wider">Availability</p>
                              <p className="text-white mt-1 text-lg">
                                {selectedRegistration.form_data?.semiPrivateAvailability?.join(', ') || 'N/A'}
                              </p>
                            </div>
                            <div className="border-b border-white/10 pb-3">
                              <p className="text-gray-400 text-sm uppercase tracking-wider">Time Windows</p>
                              <p className="text-white mt-1 text-lg">
                                {selectedRegistration.form_data?.semiPrivateTimeWindows?.join(', ') || 'N/A'}
                              </p>
                            </div>
                            <div className="border-b border-white/10 pb-3">
                              <p className="text-gray-400 text-sm uppercase tracking-wider">Matching Preference</p>
                              <p className="text-white mt-1 text-lg capitalize">
                                {selectedRegistration.form_data?.semiPrivateMatchingPreference || 'N/A'}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Health & Consent Tab */}
                    {activeTab === 'health' && (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-lg font-bold text-[#9BD4FF] uppercase tracking-wider mb-4">
                            Health Information
                          </h3>
                          <div className="border-b border-white/10 pb-3 mb-4">
                            <p className="text-gray-400 text-sm uppercase tracking-wider">Has Allergies</p>
                            <p className="text-white mt-1 text-lg">
                              {selectedRegistration.form_data?.hasAllergies ? '⚠️ Yes' : '✅ No'}
                            </p>
                            {selectedRegistration.form_data?.hasAllergies && (
                              <p className="text-gray-300 mt-2 bg-yellow-500/10 p-3 rounded border border-yellow-500/20">
                                {selectedRegistration.form_data?.allergiesDetails || 'No details provided'}
                              </p>
                            )}
                          </div>

                          <div className="border-b border-white/10 pb-3 mb-4">
                            <p className="text-gray-400 text-sm uppercase tracking-wider">Has Medical Conditions</p>
                            <p className="text-white mt-1 text-lg">
                              {selectedRegistration.form_data?.hasMedicalConditions ? '⚠️ Yes' : '✅ No'}
                            </p>
                            {selectedRegistration.form_data?.hasMedicalConditions && (
                              <p className="text-gray-300 mt-2 bg-yellow-500/10 p-3 rounded border border-yellow-500/20">
                                {selectedRegistration.form_data?.medicalConditionsDetails || 'No details provided'}
                              </p>
                            )}
                          </div>

                          <div className="border-b border-white/10 pb-3 mb-4">
                            <p className="text-gray-400 text-sm uppercase tracking-wider">Carries Medication</p>
                            <p className="text-white mt-1 text-lg">
                              {selectedRegistration.form_data?.carriesMedication ? '⚠️ Yes' : '✅ No'}
                            </p>
                            {selectedRegistration.form_data?.carriesMedication && (
                              <p className="text-gray-300 mt-2 bg-yellow-500/10 p-3 rounded border border-yellow-500/20">
                                {selectedRegistration.form_data?.medicationDetails || 'No details provided'}
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-lg font-bold text-[#9BD4FF] uppercase tracking-wider mb-4">
                            Consents
                          </h3>
                          <div className="border-b border-white/10 pb-3 mb-4">
                            <p className="text-gray-400 text-sm uppercase tracking-wider">Photo/Video Consent</p>
                            <p className="text-white mt-1 text-lg">
                              {selectedRegistration.form_data?.photoVideoConsent ? '✅ Granted' : '❌ Not Granted'}
                            </p>
                          </div>
                          <div className="border-b border-white/10 pb-3 mb-4">
                            <p className="text-gray-400 text-sm uppercase tracking-wider">Policy Acceptance</p>
                            <p className="text-white mt-1 text-lg">
                              {selectedRegistration.form_data?.policyAcceptance ? '✅ Accepted' : '❌ Not Accepted'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Payment Tab */}
                    {activeTab === 'payment' && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-bold text-[#9BD4FF] uppercase tracking-wider mb-4">
                          Payment Information
                        </h3>
                        <div className="border-b border-white/10 pb-3">
                          <p className="text-gray-400 text-sm uppercase tracking-wider">Payment Status</p>
                          <span className={`inline-flex px-4 py-2 rounded-full text-sm font-bold mt-2 ${getStatusColor(selectedRegistration.payment_status)}`}>
                            {selectedRegistration.payment_status?.toUpperCase() || 'PENDING'}
                          </span>
                        </div>

                        <div className="border-b border-white/10 pb-3">
                          <p className="text-gray-400 text-sm uppercase tracking-wider">Registration ID</p>
                          <p className="text-white mt-1 font-mono text-sm">{selectedRegistration.id}</p>
                        </div>

                        <div className="border-b border-white/10 pb-3">
                          <p className="text-gray-400 text-sm uppercase tracking-wider">Payment Method ID</p>
                          <p className="text-white mt-1 font-mono text-sm">
                            {selectedRegistration.payment_method_id || 'N/A'}
                          </p>
                        </div>

                        <div className="border-b border-white/10 pb-3">
                          <p className="text-gray-400 text-sm uppercase tracking-wider">Stripe Customer ID</p>
                          <p className="text-white mt-1 font-mono text-sm">
                            {selectedRegistration.form_data?.stripe_customer_id || 'N/A'}
                          </p>
                        </div>

                        <div className="border-b border-white/10 pb-3">
                          <p className="text-gray-400 text-sm uppercase tracking-wider">Stripe Subscription ID</p>
                          <p className="text-white mt-1 font-mono text-sm">
                            {selectedRegistration.form_data?.stripe_subscription_id || 'N/A'}
                          </p>
                        </div>

                        <div className="border-b border-white/10 pb-3">
                          <p className="text-gray-400 text-sm uppercase tracking-wider">Created At</p>
                          <p className="text-white mt-1">
                            {new Date(selectedRegistration.created_at).toLocaleString()}
                          </p>
                        </div>

                        <div className="border-b border-white/10 pb-3">
                          <p className="text-gray-400 text-sm uppercase tracking-wider">Last Updated</p>
                          <p className="text-white mt-1">
                            {selectedRegistration.form_data?.updated_at
                              ? new Date(selectedRegistration.form_data.updated_at).toLocaleString()
                              : 'N/A'}
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Action Buttons */}
              <div className="p-6 border-t border-white/10 bg-black/50">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => window.open(`mailto:${selectedRegistration.form_data?.parentEmail}?subject=SniperZone Registration - ${selectedRegistration.form_data?.playerFullName}`)}
                    className="flex-1 min-w-[150px] bg-[#9BD4FF] text-black font-bold py-3 px-4 rounded-lg hover:shadow-[0_0_15px_#9BD4FF] transition-all flex items-center justify-center gap-2"
                  >
                    📧 Send Email
                  </button>

                  <button
                    onClick={() => alert('Export to PDF feature coming soon!')}
                    className="flex-1 min-w-[150px] bg-white/10 text-white font-bold py-3 px-4 rounded-lg hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                  >
                    📄 Export PDF
                  </button>

                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this registration? This action cannot be undone.')) {
                        handleDelete(selectedRegistration.id);
                        setSelectedRegistration(null);
                      }
                    }}
                    className="flex-1 min-w-[150px] bg-red-500/20 text-red-400 font-bold py-3 px-4 rounded-lg hover:bg-red-500/30 border border-red-500/50 transition-all flex items-center justify-center gap-2"
                  >
                    🗑️ Delete
                  </button>

                  <button
                    onClick={() => {
                      setSelectedRegistration(null);
                      setActiveTab('player');
                    }}
                    className="flex-1 min-w-[150px] bg-gray-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-600 transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
