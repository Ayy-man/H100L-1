import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
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

interface TimeSlot {
  time_slot_name: string;
  capacity: number;
  current_registrations: number;
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
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
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
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch registrations
      const { data: regData, error: regError } = await supabase
        .from('registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (regError) throw regError;

      // Parse form_data if it's a string
      const parsedData = regData.map((reg: any) => ({
        ...reg,
        form_data: typeof reg.form_data === 'string'
          ? JSON.parse(reg.form_data)
          : reg.form_data
      }));

      setRegistrations(parsedData);

      // Fetch time slots for capacity info
      const { data: slotsData, error: slotsError } = await supabase
        .from('time_slots')
        .select('time_slot_name, capacity, current_registrations');

      if (!slotsError && slotsData) {
        setTimeSlots(slotsData);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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

        {/* Capacity Status */}
        {timeSlots.length > 0 && (
          <div className="bg-black border border-white/10 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-wider">
              Capacity Status
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {timeSlots.map((slot, idx) => {
                const percentage = (slot.current_registrations / slot.capacity) * 100;
                const isFull = percentage >= 100;
                return (
                  <div key={idx} className="bg-white/5 rounded-lg p-4">
                    <p className="text-gray-300 text-sm mb-2">{slot.time_slot_name}</p>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-bold">{slot.current_registrations}/{slot.capacity}</span>
                      <span className={`text-sm ${isFull ? 'text-red-400' : 'text-green-400'}`}>
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          isFull ? 'bg-red-500' : 'bg-[#9BD4FF]'
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
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

      {/* Detail Modal */}
      {selectedRegistration && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setSelectedRegistration(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 border border-white/10 rounded-xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-white uppercase tracking-wider">Registration Details</h2>
              <button
                onClick={() => setSelectedRegistration(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {Object.entries(selectedRegistration.form_data || {}).map(([key, value]) => (
                <div key={key} className="border-b border-white/10 pb-2">
                  <p className="text-gray-400 text-sm uppercase tracking-wider">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="text-white mt-1">
                    {typeof value === 'boolean' ? (value ? 'Yes' : 'No') :
                     Array.isArray(value) ? value.join(', ') :
                     value?.toString() || 'N/A'}
                  </p>
                </div>
              ))}

              <div className="border-b border-white/10 pb-2">
                <p className="text-gray-400 text-sm uppercase tracking-wider">Registration ID</p>
                <p className="text-white mt-1 font-mono text-xs">{selectedRegistration.id}</p>
              </div>

              <div className="border-b border-white/10 pb-2">
                <p className="text-gray-400 text-sm uppercase tracking-wider">Created At</p>
                <p className="text-white mt-1">{new Date(selectedRegistration.created_at).toLocaleString()}</p>
              </div>

              <div className="border-b border-white/10 pb-2">
                <p className="text-gray-400 text-sm uppercase tracking-wider">Payment Status</p>
                <p className="text-white mt-1 capitalize">{selectedRegistration.payment_status || 'Pending'}</p>
              </div>
            </div>

            <button
              onClick={() => setSelectedRegistration(null)}
              className="mt-6 w-full bg-[#9BD4FF] text-black font-bold py-3 rounded-lg hover:shadow-[0_0_15px_#9BD4FF] transition-all"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
