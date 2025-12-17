import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  Search,
  Filter,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  TrendingUp,
  BarChart3,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Ban,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

// Types
interface Booking {
  id: string;
  firebase_uid: string;
  registration_id: string;
  session_type: 'group' | 'sunday' | 'private' | 'semi_private';
  session_date: string;
  time_slot: string;
  credits_used: number;
  amount_paid: number | null;
  status: 'confirmed' | 'attended' | 'cancelled' | 'no_show';
  created_at: string;
  updated_at: string;
  player_name: string;
  player_category: string;
  parent_email: string | null;
  cancellation_reason: string | null;
}

interface BookingsApiResponse {
  bookings: Booking[];
  stats: {
    total: number;
    confirmed: number;
    attended: number;
    cancelled: number;
    no_show: number;
    credits_used: number;
    direct_revenue: number;
    by_type: Record<string, number>;
  };
}

interface DayStats {
  date: string;
  totalBookings: number;
  byType: Record<string, number>;
  bySlot: Record<string, number>;
}

interface SlotCapacity {
  time_slot: string;
  session_type: string;
  booked: number;
  capacity: number;
  percentage: number;
}

// Constants
const SESSION_TYPES = ['group', 'sunday', 'private', 'semi_private'];
const BOOKING_STATUSES = ['confirmed', 'attended', 'cancelled', 'no_show'];
const MAX_CAPACITIES: Record<string, number> = {
  group: 6,
  sunday: 20, // Sunday Ice Practice capacity
  private: 1,
  semi_private: 3,
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  attended: 'bg-green-500/20 text-green-400 border-green-500/50',
  cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
  no_show: 'bg-red-500/20 text-red-400 border-red-500/50',
};

const TYPE_COLORS: Record<string, string> = {
  group: 'bg-purple-500/20 text-purple-400',
  sunday: 'bg-orange-500/20 text-orange-400',
  private: 'bg-cyan-500/20 text-cyan-400',
  semi_private: 'bg-pink-500/20 text-pink-400',
};

// Utility functions
const formatDate = (dateStr: string, isFrench: boolean = false): string => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString(isFrench ? 'fr-CA' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const formatSessionType = (type: string, isFrench: boolean = false): string => {
  const labels: Record<string, { en: string; fr: string }> = {
    group: { en: 'Group', fr: 'Groupe' },
    sunday: { en: 'Sunday Ice', fr: 'Glace dimanche' },
    private: { en: 'Private', fr: 'Privé' },
    semi_private: { en: 'Semi-Private', fr: 'Semi-privé' },
  };
  return labels[type] ? (isFrench ? labels[type].fr : labels[type].en) : type;
};

const getToday = (): string => {
  return new Date().toISOString().split('T')[0];
};

const getWeekDates = (startDate: Date): string[] => {
  const dates: string[] = [];
  const start = new Date(startDate);
  start.setDate(start.getDate() - start.getDay()); // Start from Sunday

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
};

// Sub-components
const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}> = ({ title, value, icon, color, subtitle }) => (
  <div className="bg-black/50 border border-white/10 rounded-lg p-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-gray-400 text-sm">{title}</span>
      <span className={color}>{icon}</span>
    </div>
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
    {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
  </div>
);

const BookingRow: React.FC<{
  booking: Booking;
  onStatusChange: (id: string, status: string) => void;
  onViewDetails: (booking: Booking) => void;
}> = ({ booking, onStatusChange, onViewDetails }) => (
  <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
    <td className="py-3 px-4">
      <div>
        <p className="font-medium text-white">{booking.player_name}</p>
        <p className="text-xs text-gray-500">{booking.player_category}</p>
      </div>
    </td>
    <td className="py-3 px-4">
      <span className={`px-2 py-1 rounded text-xs ${TYPE_COLORS[booking.session_type]}`}>
        {formatSessionType(booking.session_type)}
      </span>
    </td>
    <td className="py-3 px-4 text-gray-300">{formatDate(booking.session_date)}</td>
    <td className="py-3 px-4 text-gray-300">{booking.time_slot}</td>
    <td className="py-3 px-4">
      <span className={`px-2 py-1 rounded border text-xs ${STATUS_COLORS[booking.status]}`}>
        {booking.status}
      </span>
    </td>
    <td className="py-3 px-4 text-gray-400 text-sm">{booking.parent_email || '-'}</td>
    <td className="py-3 px-4">
      <div className="flex gap-2">
        <button
          onClick={() => onViewDetails(booking)}
          className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          title="View Details"
        >
          <Eye className="w-4 h-4" />
        </button>
        {booking.status === 'confirmed' && (
          <>
            <button
              onClick={() => onStatusChange(booking.id, 'attended')}
              className="p-1.5 rounded bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors"
              title="Mark Attended"
            >
              <UserCheck className="w-4 h-4" />
            </button>
            <button
              onClick={() => onStatusChange(booking.id, 'no_show')}
              className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
              title="Mark No-Show"
            >
              <UserX className="w-4 h-4" />
            </button>
            <button
              onClick={() => onStatusChange(booking.id, 'cancelled')}
              className="p-1.5 rounded bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 transition-colors"
              title="Cancel Booking"
            >
              <Ban className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </td>
  </tr>
);

const CapacityBar: React.FC<{ slot: SlotCapacity }> = ({ slot }) => {
  const percentage = Math.min(100, slot.percentage);
  const colorClass = percentage >= 100
    ? 'bg-red-500'
    : percentage >= 80
    ? 'bg-yellow-500'
    : percentage >= 50
    ? 'bg-blue-500'
    : 'bg-green-500';

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-400 w-20">{slot.time_slot}</span>
      <div className="flex-1 bg-white/10 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full ${colorClass} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm text-gray-300 w-16 text-right">
        {slot.booked}/{slot.capacity}
      </span>
    </div>
  );
};

// Main Component
const AdminBookingsPanel: React.FC = () => {
  const { language } = useLanguage();
  const isFrench = language === 'fr';

  // Tab state
  const [activeTab, setActiveTab] = useState<'daily' | 'manage' | 'capacity' | 'revenue'>('daily');

  // Data state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [weekStart, setWeekStart] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRangeStart, setDateRangeStart] = useState(getToday());
  const [dateRangeEnd, setDateRangeEnd] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Modal state
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Fetch bookings from API
  const fetchBookings = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        date_start: dateRangeStart,
        date_end: dateRangeEnd,
      });

      if (typeFilter !== 'all') {
        params.append('session_type', typeFilter);
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`/api/admin-bookings?${params}`);
      const data: BookingsApiResponse = await response.json();

      if (!response.ok) {
        throw new Error((data as any).error || 'Failed to fetch bookings');
      }

      setBookings(data.bookings);
    } catch (err: any) {
      console.error('Error fetching bookings:', err);
      setError(err.message || 'Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [dateRangeStart, dateRangeEnd]);

  // Handle status change via API
  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    try {
      const response = await fetch('/api/admin-bookings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          booking_id: bookingId,
          status: newStatus,
          cancellation_reason: newStatus === 'cancelled' ? 'Admin cancelled' : undefined,
        }),
      });

      // Handle non-JSON responses (e.g., Vercel errors)
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || `Server error (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update booking');
      }

      // Show success message if credits were refunded
      if (data.credits_refunded > 0) {
        alert(`Booking cancelled. ${data.credits_refunded} credit(s) refunded to parent.`);
      }

      // Refresh bookings
      await fetchBookings();
    } catch (err: any) {
      console.error('Error updating booking status:', err);
      alert('Failed to update booking status: ' + err.message);
    }
  };

  // Computed data
  const todayBookings = useMemo(() => {
    return bookings.filter((b) => b.session_date === selectedDate);
  }, [bookings, selectedDate]);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const weekStats = useMemo((): DayStats[] => {
    return weekDates.map((date) => {
      const dayBookings = bookings.filter((b) => b.session_date === date && b.status !== 'cancelled');
      const byType: Record<string, number> = {};
      const bySlot: Record<string, number> = {};

      dayBookings.forEach((b) => {
        byType[b.session_type] = (byType[b.session_type] || 0) + 1;
        bySlot[b.time_slot] = (bySlot[b.time_slot] || 0) + 1;
      });

      return {
        date,
        totalBookings: dayBookings.length,
        byType,
        bySlot,
      };
    });
  }, [bookings, weekDates]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (typeFilter !== 'all' && b.session_type !== typeFilter) return false;
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          b.player_name.toLowerCase().includes(search) ||
          b.parent_email.toLowerCase().includes(search) ||
          b.player_category.toLowerCase().includes(search)
        );
      }
      return true;
    });
  }, [bookings, typeFilter, statusFilter, searchTerm]);

  const capacityByDate = useMemo((): Record<string, SlotCapacity[]> => {
    const result: Record<string, SlotCapacity[]> = {};

    weekDates.forEach((date) => {
      const dayBookings = bookings.filter(
        (b) => b.session_date === date && b.status !== 'cancelled'
      );

      // Group by slot and type
      const slotMap: Record<string, { booked: number; type: string }> = {};
      dayBookings.forEach((b) => {
        const key = `${b.time_slot}-${b.session_type}`;
        if (!slotMap[key]) {
          slotMap[key] = { booked: 0, type: b.session_type };
        }
        slotMap[key].booked++;
      });

      result[date] = Object.entries(slotMap).map(([key, data]) => {
        const [time_slot] = key.split('-');
        const capacity = MAX_CAPACITIES[data.type] || 6;
        return {
          time_slot,
          session_type: data.type,
          booked: data.booked,
          capacity,
          percentage: (data.booked / capacity) * 100,
        };
      }).sort((a, b) => a.time_slot.localeCompare(b.time_slot));
    });

    return result;
  }, [bookings, weekDates]);

  const revenueStats = useMemo(() => {
    const activeBookings = bookings.filter((b) => b.status !== 'cancelled');

    const creditBookings = activeBookings.filter((b) => b.credits_used > 0);
    const paidBookings = activeBookings.filter((b) => b.amount_paid && b.amount_paid > 0);

    const totalCreditsUsed = creditBookings.reduce((sum, b) => sum + b.credits_used, 0);
    const totalRevenue = paidBookings.reduce((sum, b) => sum + (b.amount_paid || 0), 0);

    const byType: Record<string, { count: number; revenue: number; credits: number }> = {};
    activeBookings.forEach((b) => {
      if (!byType[b.session_type]) {
        byType[b.session_type] = { count: 0, revenue: 0, credits: 0 };
      }
      byType[b.session_type].count++;
      byType[b.session_type].revenue += b.amount_paid || 0;
      byType[b.session_type].credits += b.credits_used;
    });

    return {
      totalBookings: activeBookings.length,
      totalCreditsUsed,
      totalRevenue,
      byType,
    };
  }, [bookings]);

  // Navigation
  const prevWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() - 7);
    setWeekStart(newStart);
    setDateRangeStart(newStart.toISOString().split('T')[0]);
    const endDate = new Date(newStart);
    endDate.setDate(endDate.getDate() + 6);
    setDateRangeEnd(endDate.toISOString().split('T')[0]);
  };

  const nextWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + 7);
    setWeekStart(newStart);
    setDateRangeStart(newStart.toISOString().split('T')[0]);
    const endDate = new Date(newStart);
    endDate.setDate(endDate.getDate() + 6);
    setDateRangeEnd(endDate.toISOString().split('T')[0]);
  };

  const goToThisWeek = () => {
    const today = new Date();
    setWeekStart(today);
    setSelectedDate(getToday());
    setDateRangeStart(getToday());
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 6);
    setDateRangeEnd(endDate.toISOString().split('T')[0]);
  };

  // Tab content
  const tabs = [
    { id: 'daily', label: isFrench ? 'Opérations quotidiennes' : 'Daily Operations', icon: <Calendar className="w-4 h-4" /> },
    { id: 'manage', label: isFrench ? 'Gestion des réservations' : 'Booking Management', icon: <Search className="w-4 h-4" /> },
    { id: 'capacity', label: isFrench ? 'Planification capacité' : 'Capacity Planning', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'revenue', label: isFrench ? 'Revenus & rapports' : 'Revenue & Reports', icon: <DollarSign className="w-4 h-4" /> },
  ];

  if (loading && bookings.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-[#9BD4FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h2 className="text-2xl font-bold text-white">{isFrench ? 'Gestion des réservations' : 'Bookings Management'}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={goToThisWeek}
            className="px-3 py-2 bg-[#9BD4FF]/20 text-[#9BD4FF] rounded-lg hover:bg-[#9BD4FF]/30 transition-colors text-sm"
          >
            {isFrench ? 'Cette semaine' : 'This Week'}
          </button>
          <button
            onClick={fetchBookings}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            title={isFrench ? 'Actualiser' : 'Refresh'}
          >
            <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-[#9BD4FF]/20 text-[#9BD4FF]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Daily Operations Tab */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          {/* Week Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={prevWeek}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            </button>
            <span className="text-white font-medium">
              {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
            </span>
            <button
              onClick={nextWeek}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Week Calendar */}
          <div className="grid grid-cols-7 gap-2">
            {weekStats.map((day) => {
              const isToday = day.date === getToday();
              const isSelected = day.date === selectedDate;

              return (
                <button
                  key={day.date}
                  onClick={() => setSelectedDate(day.date)}
                  className={`p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'border-[#9BD4FF] bg-[#9BD4FF]/10'
                      : isToday
                      ? 'border-white/30 bg-white/5'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <p className={`text-xs ${isToday ? 'text-[#9BD4FF]' : 'text-gray-500'}`}>
                    {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <p className="text-lg font-bold text-white">
                    {new Date(day.date + 'T00:00:00').getDate()}
                  </p>
                  <p className={`text-sm ${day.totalBookings > 0 ? 'text-[#9BD4FF]' : 'text-gray-600'}`}>
                    {day.totalBookings} {isFrench ? 'réservations' : 'bookings'}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Selected Day Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title={isFrench ? 'Total séances' : 'Total Sessions'}
              value={todayBookings.filter((b) => b.status !== 'cancelled').length}
              icon={<Calendar className="w-5 h-5" />}
              color="text-[#9BD4FF]"
            />
            <StatCard
              title={isFrench ? 'Présent' : 'Attended'}
              value={todayBookings.filter((b) => b.status === 'attended').length}
              icon={<CheckCircle className="w-5 h-5" />}
              color="text-green-400"
            />
            <StatCard
              title={isFrench ? 'En attente' : 'Pending'}
              value={todayBookings.filter((b) => b.status === 'confirmed').length}
              icon={<Clock className="w-5 h-5" />}
              color="text-yellow-400"
            />
            <StatCard
              title={isFrench ? 'Absences' : 'No-Shows'}
              value={todayBookings.filter((b) => b.status === 'no_show').length}
              icon={<XCircle className="w-5 h-5" />}
              color="text-red-400"
            />
          </div>

          {/* Today's Sessions List */}
          <div className="bg-black/50 border border-white/10 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <h3 className="font-bold text-white">{isFrench ? `Séances du ${formatDate(selectedDate, true)}` : `Sessions for ${formatDate(selectedDate)}`}</h3>
            </div>
            {todayBookings.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {isFrench ? 'Aucune séance prévue ce jour' : 'No sessions scheduled for this day'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">{isFrench ? 'Joueur' : 'Player'}</th>
                      <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">Type</th>
                      <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">Date</th>
                      <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">{isFrench ? 'Heure' : 'Time'}</th>
                      <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">{isFrench ? 'Statut' : 'Status'}</th>
                      <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">{isFrench ? 'Parent' : 'Parent'}</th>
                      <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">{isFrench ? 'Actions' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayBookings.map((booking) => (
                      <BookingRow
                        key={booking.id}
                        booking={booking}
                        onStatusChange={handleStatusChange}
                        onViewDetails={setSelectedBooking}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Booking Management Tab */}
      {activeTab === 'manage' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder={isFrench ? 'Rechercher joueur, courriel, catégorie...' : 'Search player, email, category...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#9BD4FF] focus:outline-none"
                />
              </div>
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#9BD4FF] focus:outline-none"
            >
              <option value="all">{isFrench ? 'Tous les types' : 'All Types'}</option>
              {SESSION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatSessionType(type, isFrench)}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#9BD4FF] focus:outline-none"
            >
              <option value="all">{isFrench ? 'Tous les statuts' : 'All Statuses'}</option>
              {BOOKING_STATUSES.map((status) => {
                const statusLabels: Record<string, { en: string; fr: string }> = {
                  confirmed: { en: 'Confirmed', fr: 'Confirmé' },
                  attended: { en: 'Attended', fr: 'Présent' },
                  cancelled: { en: 'Cancelled', fr: 'Annulé' },
                  no_show: { en: 'No-Show', fr: 'Absent' },
                };
                return (
                  <option key={status} value={status}>
                    {isFrench ? statusLabels[status]?.fr : statusLabels[status]?.en || status}
                  </option>
                );
              })}
            </select>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateRangeStart}
                onChange={(e) => setDateRangeStart(e.target.value)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#9BD4FF] focus:outline-none"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={dateRangeEnd}
                onChange={(e) => setDateRangeEnd(e.target.value)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#9BD4FF] focus:outline-none"
              />
            </div>
          </div>

          {/* Results Count */}
          <p className="text-gray-400 text-sm">
            {isFrench
              ? `Affichage de ${filteredBookings.length} sur ${bookings.length} réservations`
              : `Showing ${filteredBookings.length} of ${bookings.length} bookings`}
          </p>

          {/* Bookings Table */}
          <div className="bg-black/50 border border-white/10 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">{isFrench ? 'Joueur' : 'Player'}</th>
                    <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">Type</th>
                    <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">Date</th>
                    <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">{isFrench ? 'Heure' : 'Time'}</th>
                    <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">{isFrench ? 'Statut' : 'Status'}</th>
                    <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">{isFrench ? 'Parent' : 'Parent'}</th>
                    <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">{isFrench ? 'Actions' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">
                        {isFrench ? 'Aucune réservation ne correspond à vos filtres' : 'No bookings match your filters'}
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map((booking) => (
                      <BookingRow
                        key={booking.id}
                        booking={booking}
                        onStatusChange={handleStatusChange}
                        onViewDetails={setSelectedBooking}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Capacity Planning Tab */}
      {activeTab === 'capacity' && (
        <div className="space-y-6">
          {/* Week Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={prevWeek}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            </button>
            <span className="text-white font-medium">
              {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
            </span>
            <button
              onClick={nextWeek}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Capacity Legend */}
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-green-500" /> {isFrench ? 'Disponible' : 'Available'}
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-blue-500" /> {isFrench ? 'À moitié' : 'Half Full'}
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-yellow-500" /> {isFrench ? 'Presque plein' : 'Almost Full'}
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-red-500" /> {isFrench ? 'Complet' : 'Full'}
            </span>
          </div>

          {/* Daily Capacity Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {weekDates.map((date) => {
              const isToday = date === getToday();
              const slots = capacityByDate[date] || [];

              return (
                <div
                  key={date}
                  className={`bg-black/50 border rounded-lg p-4 ${
                    isToday ? 'border-[#9BD4FF]' : 'border-white/10'
                  }`}
                >
                  <h4 className={`font-bold mb-3 ${isToday ? 'text-[#9BD4FF]' : 'text-white'}`}>
                    {formatDate(date, isFrench)}
                  </h4>
                  {slots.length === 0 ? (
                    <p className="text-gray-500 text-sm">{isFrench ? 'Aucune réservation' : 'No bookings'}</p>
                  ) : (
                    <div className="space-y-2">
                      {slots.map((slot, i) => (
                        <CapacityBar key={i} slot={slot} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Revenue & Reports Tab */}
      {activeTab === 'revenue' && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title={isFrench ? 'Total réservations' : 'Total Bookings'}
              value={revenueStats.totalBookings}
              icon={<Users className="w-5 h-5" />}
              color="text-[#9BD4FF]"
              subtitle={`${dateRangeStart} - ${dateRangeEnd}`}
            />
            <StatCard
              title={isFrench ? 'Crédits utilisés' : 'Credits Used'}
              value={revenueStats.totalCreditsUsed}
              icon={<TrendingUp className="w-5 h-5" />}
              color="text-purple-400"
              subtitle={isFrench ? 'Séances de groupe' : 'Group sessions'}
            />
            <StatCard
              title={isFrench ? 'Revenus directs' : 'Direct Revenue'}
              value={`$${(revenueStats.totalRevenue / 100).toFixed(2)}`}
              icon={<DollarSign className="w-5 h-5" />}
              color="text-green-400"
              subtitle={isFrench ? 'Séances payées' : 'Paid sessions'}
            />
            <StatCard
              title={isFrench ? 'Moy. par jour' : 'Avg Per Day'}
              value={(revenueStats.totalBookings / 7).toFixed(1)}
              icon={<BarChart3 className="w-5 h-5" />}
              color="text-orange-400"
              subtitle={isFrench ? 'Réservations/jour' : 'Bookings/day'}
            />
          </div>

          {/* Breakdown by Type */}
          <div className="bg-black/50 border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4">{isFrench ? 'Répartition par type de séance' : 'Breakdown by Session Type'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {SESSION_TYPES.map((type) => {
                const stats = revenueStats.byType[type] || { count: 0, revenue: 0, credits: 0 };
                return (
                  <div key={type} className="bg-white/5 rounded-lg p-4">
                    <h4 className={`font-medium mb-2 ${TYPE_COLORS[type].split(' ')[1]}`}>
                      {formatSessionType(type, isFrench)}
                    </h4>
                    <p className="text-2xl font-bold text-white">{stats.count}</p>
                    <p className="text-sm text-gray-400">
                      {stats.credits > 0 && `${stats.credits} ${isFrench ? 'crédits' : 'credits'}`}
                      {stats.revenue > 0 && `$${(stats.revenue / 100).toFixed(2)} ${isFrench ? 'revenus' : 'revenue'}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Date Range Selector */}
          <div className="bg-black/50 border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4">{isFrench ? 'Période personnalisée' : 'Custom Report Range'}</h3>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{isFrench ? 'Du' : 'From'}</label>
                <input
                  type="date"
                  value={dateRangeStart}
                  onChange={(e) => setDateRangeStart(e.target.value)}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#9BD4FF] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{isFrench ? 'Au' : 'To'}</label>
                <input
                  type="date"
                  value={dateRangeEnd}
                  onChange={(e) => setDateRangeEnd(e.target.value)}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#9BD4FF] focus:outline-none"
                />
              </div>
              <button
                onClick={fetchBookings}
                className="px-4 py-2 bg-[#9BD4FF] text-black rounded-lg font-medium hover:bg-[#9BD4FF]/80 transition-colors"
              >
                {isFrench ? 'Générer le rapport' : 'Generate Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 border border-white/10 rounded-lg max-w-lg w-full p-6"
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-white">{isFrench ? 'Détails de la réservation' : 'Booking Details'}</h3>
              <button
                onClick={() => setSelectedBooking(null)}
                className="text-gray-400 hover:text-white"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">{isFrench ? 'Joueur' : 'Player'}</p>
                  <p className="text-white font-medium">{selectedBooking.player_name}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">{isFrench ? 'Catégorie' : 'Category'}</p>
                  <p className="text-white">{selectedBooking.player_category}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">{isFrench ? 'Type de séance' : 'Session Type'}</p>
                  <p className="text-white">{formatSessionType(selectedBooking.session_type, isFrench)}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">{isFrench ? 'Statut' : 'Status'}</p>
                  <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[selectedBooking.status]}`}>
                    {isFrench
                      ? (selectedBooking.status === 'confirmed' ? 'Confirmé' : selectedBooking.status === 'attended' ? 'Présent' : selectedBooking.status === 'cancelled' ? 'Annulé' : 'Absent')
                      : selectedBooking.status}
                  </span>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Date</p>
                  <p className="text-white">{formatDate(selectedBooking.session_date, isFrench)}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">{isFrench ? 'Heure' : 'Time'}</p>
                  <p className="text-white">{selectedBooking.time_slot}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">{isFrench ? 'Courriel du parent' : 'Parent Email'}</p>
                  <p className="text-white text-sm">{selectedBooking.parent_email}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">{isFrench ? 'Paiement' : 'Payment'}</p>
                  <p className="text-white">
                    {selectedBooking.credits_used > 0
                      ? `${selectedBooking.credits_used} ${isFrench ? 'crédit(s)' : 'credit(s)'}`
                      : selectedBooking.amount_paid
                      ? `$${(selectedBooking.amount_paid / 100).toFixed(2)}`
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">{isFrench ? 'Annulation' : 'Cancellation'}</p>
                  <p className="text-white">{selectedBooking.cancellation_reason || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">{isFrench ? 'Réservé le' : 'Booked On'}</p>
                  <p className="text-white text-sm">
                    {new Date(selectedBooking.created_at).toLocaleString(isFrench ? 'fr-CA' : 'en-US')}
                  </p>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="text-gray-400 text-sm mb-2">{isFrench ? 'Actions rapides' : 'Quick Actions'}</p>
                <div className="flex gap-2">
                  {selectedBooking.status === 'confirmed' && (
                    <>
                      <button
                        onClick={() => {
                          handleStatusChange(selectedBooking.id, 'attended');
                          setSelectedBooking(null);
                        }}
                        className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                      >
                        {isFrench ? 'Marquer présent' : 'Mark Attended'}
                      </button>
                      <button
                        onClick={() => {
                          handleStatusChange(selectedBooking.id, 'no_show');
                          setSelectedBooking(null);
                        }}
                        className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                      >
                        {isFrench ? 'Marquer absent' : 'Mark No-Show'}
                      </button>
                      <button
                        onClick={() => {
                          handleStatusChange(selectedBooking.id, 'cancelled');
                          setSelectedBooking(null);
                        }}
                        className="px-4 py-2 bg-gray-500/20 text-gray-400 rounded-lg hover:bg-gray-500/30 transition-colors"
                      >
                        {isFrench ? 'Annuler' : 'Cancel'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminBookingsPanel;
