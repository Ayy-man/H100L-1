import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import ReportBuilder from './ReportBuilder';
import DocumentsViewer from './DocumentsViewer';
import PlayerDocumentsSection from './PlayerDocumentsSection';
import DocumentStatusBadge from './DocumentStatusBadge';
import ScheduleEditModal from './ScheduleEditModal';
import SundayRosterAdmin from './admin/SundayRosterAdmin';
import UnpairedPlayersPanel from './admin/UnpairedPlayersPanel';
import ConfirmPaymentButton from './ConfirmPaymentButton';
import { MedicalFiles, WeekDay, Language } from '../types';

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

interface DailyRegistration {
  date: string;
  count: number;
  paid_count: number;
  pending_count: number;
}

interface ProgramDistribution {
  program_type: string;
  count: number;
  percentage: number;
}

interface RevenueByProgram {
  program_type: string;
  registrations: number;
  paid_registrations: number;
  estimated_monthly_revenue: number;
}

interface AgeCategoryDistribution {
  category: string;
  count: number;
  percentage: number;
}

interface CapacityUtilization {
  time_slot_name: string;
  day_of_week: string;
  capacity: number;
  current_registrations: number;
  utilization_rate: number;
  available_spots: number;
}

interface AnalyticsSummary {
  total_registrations: number;
  paid_registrations: number;
  total_mrr: number;
  avg_registration_value: number;
  fill_rate_percentage: number;
  this_week_registrations: number;
  last_week_registrations: number;
}

interface UnmatchedSemiPrivate {
  id: string;
  created_at: string;
  payment_status: string;
  player_name: string;
  player_category: string;
  parent_email: string;
  parent_phone: string;
  availability: string[];
  time_windows: string[];
  matching_preference: string;
  skill_level: string;
  date_of_birth: string;
}

interface SemiPrivateGroup {
  group_id: string;
  group_name: string;
  status: string;
  created_at: string;
  confirmed_at: string | null;
  scheduled_day: string | null;
  scheduled_time: string | null;
  coach_assigned: string | null;
  notes: string | null;
  member_count: number;
  members: Array<{
    registration_id: string;
    player_name: string;
    player_category: string;
    parent_email: string;
    skill_level: string;
    joined_at: string;
  }>;
}

interface CompatibilityScore {
  player1Id: string;
  player2Id: string;
  score: number;
  reasons: string[];
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

  // Dashboard tab state
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'analytics' | 'matching' | 'reports' | 'sunday'>('overview');

  // Mobile responsiveness
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

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
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [language, setLanguage] = useState<Language>(Language.FR);

  // Translations
  const isFrench = language === Language.FR;
  const t = {
    // Header
    title: isFrench ? 'Tableau de bord administrateur' : 'Admin Dashboard',
    subtitle: isFrench ? 'Gérer les inscriptions SniperZone et suivre les performances' : 'Manage SniperZone registrations and track performance',

    // Tabs
    overview: isFrench ? 'Aperçu' : 'Overview',
    analytics: isFrench ? 'Analytique' : 'Analytics',
    matching: isFrench ? 'Jumelage' : 'Matching',
    reports: isFrench ? 'Rapports' : 'Reports',
    sunday: isFrench ? 'Dimanche' : 'Sunday Practice',

    // Stats
    totalRegistrations: isFrench ? 'Total des inscriptions' : 'Total Registrations',
    paid: isFrench ? 'Payé' : 'Paid',
    pending: isFrench ? 'En attente' : 'Pending',
    todayRegistrations: isFrench ? 'Inscriptions aujourd\'hui' : 'Today\'s Registrations',

    // Capacity
    capacityOverview: isFrench ? 'Aperçu de la capacité' : 'Capacity Overview',
    refresh: isFrench ? 'Actualiser' : 'Refresh',
    tuesdaySessions: isFrench ? 'Séances du mardi' : '{t.tuesdaySessions}',
    fridaySessions: isFrench ? 'Séances du vendredi' : '{t.fridaySessions}',
    clickToView: isFrench ? 'Cliquez pour voir les inscriptions' : '{t.clickToView}',

    // {t.filters}
    filters: isFrench ? 'Filtres' : '{t.filters}',
    searchPlaceholder: isFrench ? 'Rechercher par nom ou courriel...' : 'Search by name or email...',
    allPrograms: isFrench ? 'Tous les programmes' : '{t.allPrograms}',
    allPaymentStatus: isFrench ? 'Tous les statuts de paiement' : '{t.allPaymentStatus}',
    allCategories: isFrench ? 'Toutes les catégories' : '{t.allCategories}',
    showing: isFrench ? 'Affichage' : '{t.showing}',
    of: isFrench ? 'de' : 'of',
    registrations: isFrench ? 'inscriptions' : 'registrations',

    // Table headers
    date: isFrench ? 'Date' : 'Date',
    player: isFrench ? 'Joueur' : 'Player',
    category: isFrench ? 'Catégorie' : 'Category',
    program: isFrench ? 'Programme' : 'Program',
    frequency: isFrench ? 'Fréquence' : 'Frequency',
    parentEmail: isFrench ? 'Courriel parent' : 'Parent Email',
    documents: isFrench ? 'Documents' : 'Documents',
    status: isFrench ? 'Statut' : 'Status',
    actions: isFrench ? 'Actions' : 'Actions',

    // Program types
    group: isFrench ? 'Groupe' : 'Group',
    private: isFrench ? 'Privé' : 'Private',
    semiPrivate: isFrench ? 'Semi-privé' : 'Semi-Private',

    // Payment status
    paidStatus: isFrench ? 'Payé' : 'Paid',
    pendingStatus: isFrench ? 'En attente' : 'Pending',
    failedStatus: isFrench ? 'Échoué' : 'Failed',

    // Actions
    viewDetails: isFrench ? 'Voir les détails' : 'View Details',
    delete: isFrench ? 'Supprimer' : 'Delete',
    previous: isFrench ? 'Précédent' : 'Previous',
    next: isFrench ? 'Suivant' : 'Next',
    close: isFrench ? 'Fermer' : 'Close',

    // Modal tabs
    playerInfo: isFrench ? 'Info joueur' : 'Player Info',
    parentContact: isFrench ? 'Parent/Contact' : 'Parent/Contact',
    programTab: isFrench ? 'Programme' : 'Program',
    healthConsent: isFrench ? 'Santé & Consentement' : 'Health & Consent',
    documentsTab: isFrench ? 'Documents' : 'Documents',
    payment: isFrench ? 'Paiement' : 'Payment',

    // Registration details
    registrationDetails: isFrench ? 'Détails de l\'inscription' : 'Registration Details',
    sendEmail: isFrench ? 'Envoyer un courriel' : 'Send Email',
    exportPDF: isFrench ? 'Exporter en PDF' : 'Export PDF',
    deleteRegistration: isFrench ? 'Supprimer' : 'Delete',

    // Program details
    programDetails: isFrench ? 'Détails du programme' : 'Program Details',
    programType: isFrench ? 'Type de programme' : 'Program Type',
    frequencyLabel: isFrench ? 'Fréquence' : 'Frequency',
    trainingDays: isFrench ? 'Jours d\'entraînement' : 'Training Days',
    monthlySchedule: isFrench ? 'Horaire mensuel' : 'Monthly Schedule',
    sessions: isFrench ? 'séances' : 'sessions',
    sessionsThisMonth: isFrench ? 'séances ce mois-ci' : 'sessions this month',
    editSchedule: isFrench ? 'Modifier l\'horaire d\'entraînement' : 'Edit Training Schedule',
    selectedDayLegacy: isFrench ? 'Jour sélectionné (ancien)' : 'Selected Day (Legacy)',

    // Confirmation
    confirmDelete: isFrench ? 'Êtes-vous sûr de vouloir supprimer cette inscription? Cette action ne peut pas être annulée.' : 'Are you sure you want to delete this registration? This action cannot be undone.',
  };

  // Selected slot for viewing registered players
  const [selectedSlot, setSelectedSlot] = useState<CapacitySlot | null>(null);
  const [slotPlayers, setSlotPlayers] = useState<SlotRegistration[]>([]);
  const [loadingSlotDetails, setLoadingSlotDetails] = useState(false);

  // Analytics data
  const [dailyRegistrations, setDailyRegistrations] = useState<DailyRegistration[]>([]);
  const [programDistribution, setProgramDistribution] = useState<ProgramDistribution[]>([]);
  const [revenueByProgram, setRevenueByProgram] = useState<RevenueByProgram[]>([]);
  const [ageDistribution, setAgeDistribution] = useState<AgeCategoryDistribution[]>([]);
  const [capacityUtilization, setCapacityUtilization] = useState<CapacityUtilization[]>([]);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);

  // Semi-private matching data
  const [unmatchedPlayers, setUnmatchedPlayers] = useState<UnmatchedSemiPrivate[]>([]);
  const [semiPrivateGroups, setSemiPrivateGroups] = useState<SemiPrivateGroup[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [compatibilityScores, setCompatibilityScores] = useState<CompatibilityScore[]>([]);
  const [draggedPlayer, setDraggedPlayer] = useState<string | null>(null);

  useEffect(() => {
    const password = prompt('Enter admin password:');
    if (password === 'sniperzone2025') {
      setAuthenticated(true);
    } else {
      alert('Incorrect password.');
      window.location.href = '/';
    }
  }, []);

  // Mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

  // Fetch analytics data when switching to analytics tab
  useEffect(() => {
    if (isAuthenticated && dashboardTab === 'analytics') {
      fetchAnalyticsData();
    }
  }, [isAuthenticated, dashboardTab]);

  // Fetch matching data when switching to matching tab
  useEffect(() => {
    if (isAuthenticated && dashboardTab === 'matching') {
      fetchMatchingData();
    }
  }, [isAuthenticated, dashboardTab]);

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

  const fetchAnalyticsData = async () => {
    try {
      // Fetch all analytics views in parallel
      const [
        dailyRegsRes,
        programDistRes,
        revenueRes,
        ageDistRes,
        capacityUtilRes,
        summaryRes
      ] = await Promise.all([
        supabase.from('daily_registration_counts').select('*'),
        supabase.from('program_distribution').select('*'),
        supabase.from('revenue_by_program').select('*'),
        supabase.from('age_category_distribution').select('*'),
        supabase.from('capacity_utilization').select('*'),
        supabase.from('analytics_summary').select('*').single()
      ]);

      if (dailyRegsRes.data) setDailyRegistrations(dailyRegsRes.data);
      if (programDistRes.data) setProgramDistribution(programDistRes.data);
      if (revenueRes.data) setRevenueByProgram(revenueRes.data);
      if (ageDistRes.data) setAgeDistribution(ageDistRes.data);
      if (capacityUtilRes.data) setCapacityUtilization(capacityUtilRes.data);
      if (summaryRes.data) setAnalyticsSummary(summaryRes.data);
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
    }
  };

  const fetchMatchingData = async () => {
    try {
      const [unmatchedRes, groupsRes] = await Promise.all([
        supabase.from('unmatched_semi_private').select('*'),
        supabase.from('semi_private_groups_detail').select('*')
      ]);

      if (unmatchedRes.data) {
        // Parse JSON strings back to arrays
        const parsedData = unmatchedRes.data.map((player: any) => ({
          ...player,
          availability: typeof player.availability === 'string' ? JSON.parse(player.availability) : player.availability,
          time_windows: typeof player.time_windows === 'string' ? JSON.parse(player.time_windows) : player.time_windows
        }));
        setUnmatchedPlayers(parsedData);

        // Calculate compatibility scores
        calculateCompatibility(parsedData);
      }

      if (groupsRes.data) setSemiPrivateGroups(groupsRes.data);
    } catch (err: any) {
      console.error('Error fetching matching data:', err);
    }
  };

  // Calculate compatibility scores between players
  const calculateCompatibility = (players: UnmatchedSemiPrivate[]) => {
    const scores: CompatibilityScore[] = [];

    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const player1 = players[i];
        const player2 = players[j];
        let score = 0;
        const reasons: string[] = [];

        // Same age category (30 points)
        if (player1.player_category === player2.player_category) {
          score += 30;
          reasons.push(`Same category (${player1.player_category})`);
        }

        // Overlapping availability (40 points max)
        const availability1 = player1.availability || [];
        const availability2 = player2.availability || [];
        const commonDays = availability1.filter(day => availability2.includes(day));
        if (commonDays.length > 0) {
          const availabilityScore = Math.min(40, commonDays.length * 13);
          score += availabilityScore;
          reasons.push(`${commonDays.length} matching day(s): ${commonDays.join(', ')}`);
        }

        // Overlapping time windows (20 points max)
        const timeWindows1 = player1.time_windows || [];
        const timeWindows2 = player2.time_windows || [];
        const commonTimes = timeWindows1.filter(time => timeWindows2.includes(time));
        if (commonTimes.length > 0) {
          const timeScore = Math.min(20, commonTimes.length * 10);
          score += timeScore;
          reasons.push(`${commonTimes.length} matching time window(s)`);
        }

        // Matching preferences (10 points)
        if (player1.matching_preference === player2.matching_preference) {
          score += 10;
          reasons.push(`Same preference (${player1.matching_preference})`);
        }

        // Only store if there's some compatibility
        if (score > 0) {
          scores.push({
            player1Id: player1.id,
            player2Id: player2.id,
            score,
            reasons
          });
        }
      }
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    setCompatibilityScores(scores);
  };

  const getCompatibilityColor = (score: number) => {
    if (score >= 70) return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' };
    if (score >= 50) return { bg: 'bg-[#9BD4FF]/20', text: 'text-[#9BD4FF]', border: 'border-[#9BD4FF]/50' };
    if (score >= 30) return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' };
    return { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/50' };
  };

  const createSemiPrivateGroup = async (playerIds: string[]) => {
    if (playerIds.length < 2 || playerIds.length > 3) {
      alert('Semi-private groups must have 2-3 players');
      return;
    }

    try {
      const groupName = `Group ${new Date().toISOString().slice(0, 10)}`;

      const { data, error } = await supabase.rpc('create_semi_private_group', {
        p_group_name: groupName,
        p_registration_ids: playerIds
      });

      if (error) throw error;

      alert('Group created successfully!');
      setSelectedPlayers([]);
      fetchMatchingData();
    } catch (err: any) {
      alert(`Error creating group: ${err.message}`);
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
      // Handle legacy 'paid' status as 'succeeded' for filtering
      const matchesPayment = paymentFilter === 'all' ||
        reg.payment_status === paymentFilter ||
        (paymentFilter === 'succeeded' && reg.payment_status === 'paid');
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
    if (!confirm(t.confirmDelete)) return;

    try {
      const { data, error } = await supabase
        .from('registrations')
        .delete()
        .eq('id', id)
        .select();

      console.log('Delete response:', { data, error });

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }

      // Check if anything was actually deleted
      if (!data || data.length === 0) {
        throw new Error('No rows were deleted. This might be a permissions issue.');
      }

      setRegistrations(prev => prev.filter(r => r.id !== id));
      alert(isFrench ? 'Inscription supprimée avec succès' : 'Registration deleted successfully');

      // Refresh capacity data
      fetchCapacityData();
    } catch (err: any) {
      console.error('Delete failed:', err);
      alert(`${isFrench ? 'Erreur lors de la suppression' : 'Error deleting registration'}: ${err.message}`);
    }
  };

  const handleScheduleUpdate = async (newDays: WeekDay[], newMonthlyDates: string[]) => {
    if (!selectedRegistration) return;

    try {
      const updatedFormData = {
        ...selectedRegistration.form_data,
        groupSelectedDays: newDays,
        groupMonthlyDates: newMonthlyDates,
      };

      const { error } = await supabase
        .from('registrations')
        .update({ form_data: updatedFormData })
        .eq('id', selectedRegistration.id);

      if (error) throw error;

      // Update local state
      setSelectedRegistration({
        ...selectedRegistration,
        form_data: updatedFormData,
      });

      setRegistrations(prev =>
        prev.map(reg =>
          reg.id === selectedRegistration.id
            ? { ...reg, form_data: updatedFormData }
            : reg
        )
      );

      alert('Schedule updated successfully!');
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'; // Admin verified - highest level
      case 'succeeded': return 'bg-green-500/10 text-green-400 border-green-500/20'; // Stripe payment
      case 'paid': return 'bg-green-500/10 text-green-400 border-green-500/20'; // Legacy
      case 'pending': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'canceled': return 'bg-red-500/10 text-red-400 border-red-500/20'; // Canceled subscription
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

  // Mobile Registration Card Component
  const MobileRegistrationCard: React.FC<{ registration: Registration }> = ({ registration }) => {
    const formData = registration.form_data || {};

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-black border border-white/10 rounded-lg p-4 mb-3 hover:border-[#9BD4FF]/50 transition-all"
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3 className="text-white font-bold text-lg">{formData.playerFullName || 'N/A'}</h3>
            <p className="text-gray-400 text-sm">{formData.parentEmail || 'N/A'}</p>
          </div>
          <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(registration.payment_status)}`}>
            {registration.payment_status || 'Pending'}
          </span>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
          <div>
            <p className="text-gray-500 text-xs uppercase">Category</p>
            <p className="text-white">{formData.playerCategory || 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase">Program</p>
            <p className="text-white capitalize">{formData.programType || 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase">Frequency</p>
            <p className="text-white">{formData.groupFrequency || formData.privateFrequency || 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase">Date</p>
            <p className="text-white">{new Date(registration.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-3 border-t border-white/10">
          <button
            onClick={() => setSelectedRegistration(registration)}
            className="flex-1 bg-[#9BD4FF] text-black font-bold py-2 px-4 rounded-lg hover:shadow-[0_0_15px_#9BD4FF] transition-all text-sm"
          >
            {t.viewDetails}
          </button>
          <button
            onClick={() => handleDelete(registration.id)}
            className="bg-red-500/20 text-red-400 font-bold py-2 px-4 rounded-lg hover:bg-red-500/30 border border-red-500/50 transition-all text-sm"
          >
            {t.delete}
          </button>
        </div>
      </motion.div>
    );
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
          {t.clickToView}
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
    <div className="bg-gray-900 min-h-screen pb-20 md:pb-8">
      <div className="container mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-4 md:mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-5xl uppercase font-black tracking-wider text-white mb-1 md:mb-2">
              {t.title}
            </h1>
            <p className="text-gray-400 text-sm md:text-base">{t.subtitle}</p>
          </div>

          {/* Language Toggle */}
          <div className="flex gap-2 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setLanguage(Language.FR)}
              className={`px-3 py-2 rounded-md text-sm font-bold transition-all ${
                language === Language.FR
                  ? 'bg-[#9BD4FF] text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              FR
            </button>
            <button
              onClick={() => setLanguage(Language.EN)}
              className={`px-3 py-2 rounded-md text-sm font-bold transition-all ${
                language === Language.EN
                  ? 'bg-[#9BD4FF] text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              EN
            </button>
          </div>
        </div>

        {/* Desktop/Tablet Tabs - Hidden on Mobile */}
        <div className="hidden md:flex gap-4 mb-8 border-b border-white/10">
          <button
            onClick={() => setDashboardTab('overview')}
            className={`px-6 py-3 font-bold uppercase tracking-wider transition-all ${
              dashboardTab === 'overview'
                ? 'text-[#9BD4FF] border-b-2 border-[#9BD4FF]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            📊 {t.overview}
          </button>
          <button
            onClick={() => setDashboardTab('analytics')}
            className={`px-6 py-3 font-bold uppercase tracking-wider transition-all ${
              dashboardTab === 'analytics'
                ? 'text-[#9BD4FF] border-b-2 border-[#9BD4FF]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            📈 {t.analytics}
          </button>
          <button
            onClick={() => setDashboardTab('matching')}
            className={`px-6 py-3 font-bold uppercase tracking-wider transition-all ${
              dashboardTab === 'matching'
                ? 'text-[#9BD4FF] border-b-2 border-[#9BD4FF]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🤝 {t.matching}
          </button>
          <button
            onClick={() => setDashboardTab('reports')}
            className={`px-6 py-3 font-bold uppercase tracking-wider transition-all ${
              dashboardTab === 'reports'
                ? 'text-[#9BD4FF] border-b-2 border-[#9BD4FF]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            📄 {t.reports}
          </button>
          <button
            onClick={() => setDashboardTab('sunday')}
            className={`px-6 py-3 font-bold uppercase tracking-wider transition-all ${
              dashboardTab === 'sunday'
                ? 'text-[#9BD4FF] border-b-2 border-[#9BD4FF]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🏒 {t.sunday}
          </button>
        </div>

        {/* OVERVIEW TAB */}
        {dashboardTab === 'overview' && (
          <>
            {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title={t.totalRegistrations}
            value={stats.total}
            icon="📊"
            color="text-[#9BD4FF]"
          />
          <StatsCard
            title={t.paid}
            value={stats.paid}
            icon="✅"
            color="text-green-400"
          />
          <StatsCard
            title={t.pending}
            value={stats.pending}
            icon="⏳"
            color="text-yellow-400"
          />
          <StatsCard
            title={t.todayRegistrations}
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
                🏒 {t.capacityOverview}
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
                {t.tuesdaySessions}
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
                {t.fridaySessions}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {slotsByDay.friday.map(slot => (
                  <CapacitySlotCard key={slot.id} slot={slot} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* {t.filters} */}
        <div className="bg-black border border-white/10 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-wider">{t.filters}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#9BD4FF] transition-colors min-h-[48px]"
            />

            {/* Program Type Filter */}
            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#9BD4FF] transition-colors min-h-[48px]"
            >
              <option value="all">{t.allPrograms}</option>
              <option value="group">Group Training</option>
              <option value="private">Private Training</option>
              <option value="semi-private">Semi-Private</option>
            </select>

            {/* Payment Status Filter */}
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#9BD4FF] transition-colors min-h-[48px]"
            >
              <option value="all">{t.allPaymentStatus}</option>
              <option value="verified">Verified (Admin Confirmed)</option>
              <option value="succeeded">Succeeded (Stripe Paid)</option>
              <option value="pending">Pending</option>
              <option value="canceled">Canceled</option>
              <option value="failed">Failed</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#9BD4FF] transition-colors min-h-[48px]"
            >
              <option value="all">{t.allCategories}</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Active {t.filters} Summary */}
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
            {t.showing} {paginatedRegistrations.length} {t.of} {filteredRegistrations.length} registrations
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-8">
            <p className="text-red-400">Error: {error}</p>
          </div>
        )}

        {/* Mobile Card View (< 768px) */}
        {isMobile ? (
          <div className="space-y-3">
            {paginatedRegistrations.length > 0 ? (
              paginatedRegistrations.map((reg) => (
                <MobileRegistrationCard key={reg.id} registration={reg} />
              ))
            ) : (
              <div className="bg-black border border-white/10 rounded-lg p-8 text-center">
                <p className="text-gray-500">No registrations found matching your filters.</p>
              </div>
            )}
          </div>
        ) : (
          /* Desktop/Tablet Table View (>= 768px) */
          <div className="bg-black border border-white/10 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-[#9BD4FF]/10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#9BD4FF] uppercase tracking-wider">{t.date}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#9BD4FF] uppercase tracking-wider">{t.player}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#9BD4FF] uppercase tracking-wider">{t.category}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#9BD4FF] uppercase tracking-wider">{t.program}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#9BD4FF] uppercase tracking-wider">{t.frequency}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#9BD4FF] uppercase tracking-wider">{t.parentEmail}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#9BD4FF] uppercase tracking-wider">{t.documents}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#9BD4FF] uppercase tracking-wider">{t.status}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#9BD4FF] uppercase tracking-wider">{t.actions}</th>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <DocumentStatusBadge
                            medicalFiles={reg.form_data?.medicalFiles}
                            hasMedicalConditions={reg.form_data?.hasMedicalConditions}
                            compact={true}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusColor(reg.payment_status)}`}>
                            {reg.payment_status || 'Pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <ConfirmPaymentButton
                              registrationId={reg.id}
                              currentStatus={reg.payment_status}
                              onConfirmed={fetchRegistrations}
                            />
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
                      <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                        No registrations found matching your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination for Desktop/Tablet */}
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
        )}

        {/* Mobile Pagination */}
        {isMobile && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold min-h-[48px]"
            >
              ← Previous
            </button>
            <span className="text-white font-bold">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold min-h-[48px]"
            >
              Next →
            </button>
          </div>
        )}
          </>
        )}

        {/* ANALYTICS TAB */}
        {dashboardTab === 'analytics' && (
          <div className="space-y-8">
            {/* Key Metrics Cards */}
            {analyticsSummary && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                  title="Total MRR"
                  value={`$${analyticsSummary.total_mrr.toLocaleString()}`}
                  icon="💰"
                  color="text-green-400"
                />
                <StatsCard
                  title="Avg Registration Value"
                  value={`$${Math.round(analyticsSummary.avg_registration_value)}`}
                  icon="📊"
                  color="text-[#9BD4FF]"
                />
                <StatsCard
                  title="Fill Rate"
                  value={`${analyticsSummary.fill_rate_percentage}%`}
                  icon="📈"
                  color="text-yellow-400"
                />
                <StatsCard
                  title="Week-over-Week Growth"
                  value={`${analyticsSummary.this_week_registrations > analyticsSummary.last_week_registrations ? '+' : ''}${analyticsSummary.this_week_registrations - analyticsSummary.last_week_registrations}`}
                  icon={analyticsSummary.this_week_registrations >= analyticsSummary.last_week_registrations ? '📈' : '📉'}
                  color={analyticsSummary.this_week_registrations >= analyticsSummary.last_week_registrations ? 'text-green-400' : 'text-red-400'}
                />
              </div>
            )}

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Registration Trends - Line Chart */}
              <div className="bg-black border border-white/10 rounded-lg p-6">
                <h3 className="text-xl font-bold text-[#9BD4FF] uppercase tracking-wider mb-4">
                  📈 Registration Trends (30 Days)
                </h3>
                {dailyRegistrations.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dailyRegistrations.reverse()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis
                        dataKey="date"
                        stroke="#9BD4FF"
                        tick={{ fill: '#9BD4FF' }}
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis stroke="#9BD4FF" tick={{ fill: '#9BD4FF' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111', border: '1px solid #9BD4FF', borderRadius: '8px' }}
                        labelStyle={{ color: '#9BD4FF' }}
                      />
                      <Legend wrapperStyle={{ color: '#9BD4FF' }} />
                      <Line type="monotone" dataKey="count" stroke="#9BD4FF" strokeWidth={2} name="Total" />
                      <Line type="monotone" dataKey="paid_count" stroke="#22c55e" strokeWidth={2} name={t.paid} />
                      <Line type="monotone" dataKey="pending_count" stroke="#eab308" strokeWidth={2} name={t.pending} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-12">No data available</p>
                )}
              </div>

              {/* Program Distribution - Pie Chart */}
              <div className="bg-black border border-white/10 rounded-lg p-6">
                <h3 className="text-xl font-bold text-[#9BD4FF] uppercase tracking-wider mb-4">
                  🥧 Program Distribution
                </h3>
                {programDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={programDistribution}
                        dataKey="count"
                        nameKey="program_type"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={(entry) => `${entry.program_type}: ${entry.percentage}%`}
                      >
                        {programDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#9BD4FF', '#22c55e', '#eab308', '#ef4444'][index % 4]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111', border: '1px solid #9BD4FF', borderRadius: '8px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-12">No data available</p>
                )}
              </div>

              {/* Revenue by Program - Bar Chart */}
              <div className="bg-black border border-white/10 rounded-lg p-6">
                <h3 className="text-xl font-bold text-[#9BD4FF] uppercase tracking-wider mb-4">
                  💵 Revenue by Program
                </h3>
                {revenueByProgram.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={revenueByProgram}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis
                        dataKey="program_type"
                        stroke="#9BD4FF"
                        tick={{ fill: '#9BD4FF' }}
                      />
                      <YAxis stroke="#9BD4FF" tick={{ fill: '#9BD4FF' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111', border: '1px solid #9BD4FF', borderRadius: '8px' }}
                        labelStyle={{ color: '#9BD4FF' }}
                      />
                      <Legend wrapperStyle={{ color: '#9BD4FF' }} />
                      <Bar dataKey="estimated_monthly_revenue" fill="#22c55e" name="Est. Monthly Revenue ($)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-12">No data available</p>
                )}
              </div>

              {/* Age Category Distribution - Pie Chart */}
              <div className="bg-black border border-white/10 rounded-lg p-6">
                <h3 className="text-xl font-bold text-[#9BD4FF] uppercase tracking-wider mb-4">
                  👶 Age Category Distribution
                </h3>
                {ageDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={ageDistribution}
                        dataKey="count"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        label={(entry) => `${entry.category}: ${entry.percentage}%`}
                      >
                        {ageDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#9BD4FF', '#22c55e', '#eab308', '#ef4444', '#a855f7', '#ec4899'][index % 6]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111', border: '1px solid #9BD4FF', borderRadius: '8px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-12">No data available</p>
                )}
              </div>
            </div>

            {/* Capacity Heat Map */}
            <div className="bg-black border border-white/10 rounded-lg p-6">
              <h3 className="text-xl font-bold text-[#9BD4FF] uppercase tracking-wider mb-4">
                🔥 Capacity Heat Map
              </h3>
              {capacityUtilization.length > 0 ? (
                <div className="space-y-4">
                  {capacityUtilization.map((slot, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-white font-medium">{slot.time_slot_name}</span>
                        <span className="text-gray-400 text-sm">
                          {slot.current_registrations}/{slot.capacity} ({slot.utilization_rate}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${slot.utilization_rate}%` }}
                          transition={{ duration: 0.5 }}
                          className={`h-4 rounded-full ${
                            slot.utilization_rate >= 100 ? 'bg-red-500' :
                            slot.utilization_rate >= 75 ? 'bg-yellow-500' :
                            slot.utilization_rate >= 50 ? 'bg-[#9BD4FF]' :
                            'bg-green-400'
                          }`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No capacity data available</p>
              )}
            </div>
          </div>
        )}

        {/* MATCHING TAB */}
        {dashboardTab === 'matching' && (
          <UnpairedPlayersPanel />
        )}

        {/* REPORTS TAB */}
        {dashboardTab === 'reports' && (
          <ReportBuilder
            registrations={registrations}
            capacityData={capacitySlots}
            semiPrivateGroups={semiPrivateGroups}
          />
        )}

        {/* SUNDAY PRACTICE TAB */}
        {dashboardTab === 'sunday' && (
          <SundayRosterAdmin />
        )}
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
                {t.close}
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
                  { id: 'player', label: `👤 ${t.playerInfo}`, icon: '👤' },
                  { id: 'parent', label: `👨‍👩‍👦 ${t.parentContact}`, icon: '👨‍👩‍👦' },
                  { id: 'program', label: `🏒 ${t.programTab}`, icon: '🏒' },
                  { id: 'health', label: `🏥 ${t.healthConsent}`, icon: '🏥' },
                  { id: 'documents', label: `📄 ${t.documentsTab}`, icon: '📄' },
                  { id: 'payment', label: `💳 ${t.payment}`, icon: '💳' }
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
                          { label: 'Date {t.of} Birth', value: selectedRegistration.form_data?.dateOfBirth },
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
                          {t.programDetails}
                        </h3>
                        <div className="border-b border-white/10 pb-3">
                          <p className="text-gray-400 text-sm uppercase tracking-wider">{t.programType}</p>
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
                            {selectedRegistration.form_data?.groupSelectedDays && selectedRegistration.form_data?.groupSelectedDays.length > 0 ? (
                              <>
                                <div className="border-b border-white/10 pb-3">
                                  <p className="text-gray-400 text-sm uppercase tracking-wider">Training Days</p>
                                  <p className="text-white mt-1 text-lg">
                                    {selectedRegistration.form_data.groupSelectedDays.map((day: string) =>
                                      day.charAt(0).toUpperCase() + day.slice(1)
                                    ).join(', ')}
                                  </p>
                                </div>
                                {selectedRegistration.form_data?.groupMonthlyDates && selectedRegistration.form_data?.groupMonthlyDates.length > 0 && (
                                  <div className="border-b border-white/10 pb-3">
                                    <p className="text-gray-400 text-sm uppercase tracking-wider mb-2">Monthly Schedule</p>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                      {selectedRegistration.form_data.groupMonthlyDates.slice(0, 12).map((date: string) => {
                                        const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric'
                                        });
                                        return (
                                          <span key={date} className="px-2 py-1 bg-[#9BD4FF]/10 text-[#9BD4FF] rounded text-xs text-center">
                                            {formattedDate}
                                          </span>
                                        );
                                      })}
                                    </div>
                                    {selectedRegistration.form_data.groupMonthlyDates.length > 12 && (
                                      <p className="text-xs text-gray-400 mt-2">
                                        +{selectedRegistration.form_data.groupMonthlyDates.length - 12} more sessions
                                      </p>
                                    )}
                                    <p className="text-xs text-gray-400 mt-2">
                                      Total: {selectedRegistration.form_data.groupMonthlyDates.length} sessions this month
                                    </p>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="border-b border-white/10 pb-3">
                                <p className="text-gray-400 text-sm uppercase tracking-wider">Selected Day (Legacy)</p>
                                <p className="text-white mt-1 text-lg capitalize">
                                  {selectedRegistration.form_data?.groupDay || 'N/A'}
                                </p>
                              </div>
                            )}

                            {/* Edit Schedule Button - Now appears for ALL group registrations */}
                            <div className="pt-4">
                              <button
                                onClick={() => setIsEditingSchedule(true)}
                                className="w-full bg-[#9BD4FF]/10 border border-[#9BD4FF]/30 text-[#9BD4FF] font-bold py-3 px-4 rounded-lg hover:bg-[#9BD4FF]/20 transition-all flex items-center justify-center gap-2"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                {t.editSchedule}
                              </button>
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

                    {/* Documents Tab */}
                    {activeTab === 'documents' && (
                      <div className="space-y-6">
                        <PlayerDocumentsSection
                          medicalFiles={selectedRegistration.form_data?.medicalFiles}
                          hasMedicalConditions={selectedRegistration.form_data?.hasMedicalConditions}
                          parentEmail={selectedRegistration.form_data?.parentEmail}
                          playerName={selectedRegistration.form_data?.playerFullName}
                          language={language}
                          registrationId={selectedRegistration.id}
                          onUploadComplete={async (newFiles) => {
                            // Update the registration with new files
                            const updatedFormData = {
                              ...selectedRegistration.form_data,
                              medicalFiles: {
                                ...selectedRegistration.form_data?.medicalFiles,
                                ...newFiles
                              }
                            };

                            // Update in database
                            const { error } = await supabase
                              .from('registrations')
                              .update({ form_data: updatedFormData })
                              .eq('id', selectedRegistration.id);

                            if (!error) {
                              // Refresh local state
                              setSelectedRegistration({
                                ...selectedRegistration,
                                form_data: updatedFormData
                              });

                              // Refresh registrations list
                              fetchRegistrations();
                            }
                          }}
                        />
                        <DocumentsViewer medicalFiles={selectedRegistration.form_data?.medicalFiles} />
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
                    📧 {t.sendEmail}
                  </button>

                  <button
                    onClick={() => alert(isFrench ? 'Fonctionnalité d\'export PDF à venir !' : 'Export to PDF feature coming soon!')}
                    className="flex-1 min-w-[150px] bg-white/10 text-white font-bold py-3 px-4 rounded-lg hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                  >
                    📄 {t.exportPDF}
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(t.confirmDelete)) {
                        handleDelete(selectedRegistration.id);
                        setSelectedRegistration(null);
                      }
                    }}
                    className="flex-1 min-w-[150px] bg-red-500/20 text-red-400 font-bold py-3 px-4 rounded-lg hover:bg-red-500/30 border border-red-500/50 transition-all flex items-center justify-center gap-2"
                  >
                    🗑️ {t.deleteRegistration}
                  </button>

                  <button
                    onClick={() => {
                      setSelectedRegistration(null);
                      setActiveTab('player');
                    }}
                    className="flex-1 min-w-[150px] bg-gray-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-600 transition-all"
                  >
                    {t.close}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation Bar */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-white/10 px-1 py-3 flex justify-around items-center z-40">
          <button
            onClick={() => setDashboardTab('overview')}
            className={`flex flex-col items-center justify-center min-w-[60px] min-h-[48px] py-2 px-1 rounded-lg transition-all ${
              dashboardTab === 'overview'
                ? 'text-[#9BD4FF] bg-[#9BD4FF]/10'
                : 'text-gray-400'
            }`}
          >
            <span className="text-lg mb-1">📊</span>
            <span className="text-[9px] font-bold uppercase tracking-wider">Overview</span>
          </button>
          <button
            onClick={() => setDashboardTab('analytics')}
            className={`flex flex-col items-center justify-center min-w-[60px] min-h-[48px] py-2 px-1 rounded-lg transition-all ${
              dashboardTab === 'analytics'
                ? 'text-[#9BD4FF] bg-[#9BD4FF]/10'
                : 'text-gray-400'
            }`}
          >
            <span className="text-lg mb-1">📈</span>
            <span className="text-[9px] font-bold uppercase tracking-wider">Analytics</span>
          </button>
          <button
            onClick={() => setDashboardTab('matching')}
            className={`flex flex-col items-center justify-center min-w-[60px] min-h-[48px] py-2 px-1 rounded-lg transition-all ${
              dashboardTab === 'matching'
                ? 'text-[#9BD4FF] bg-[#9BD4FF]/10'
                : 'text-gray-400'
            }`}
          >
            <span className="text-lg mb-1">🤝</span>
            <span className="text-[9px] font-bold uppercase tracking-wider">Match</span>
          </button>
          <button
            onClick={() => setDashboardTab('reports')}
            className={`flex flex-col items-center justify-center min-w-[60px] min-h-[48px] py-2 px-1 rounded-lg transition-all ${
              dashboardTab === 'reports'
                ? 'text-[#9BD4FF] bg-[#9BD4FF]/10'
                : 'text-gray-400'
            }`}
          >
            <span className="text-lg mb-1">📄</span>
            <span className="text-[9px] font-bold uppercase tracking-wider">Reports</span>
          </button>
          <button
            onClick={() => setDashboardTab('sunday')}
            className={`flex flex-col items-center justify-center min-w-[60px] min-h-[48px] py-2 px-1 rounded-lg transition-all ${
              dashboardTab === 'sunday'
                ? 'text-[#9BD4FF] bg-[#9BD4FF]/10'
                : 'text-gray-400'
            }`}
          >
            <span className="text-lg mb-1">🏒</span>
            <span className="text-[9px] font-bold uppercase tracking-wider">Sunday</span>
          </button>
        </div>
      )}

      {/* Schedule Edit Modal */}
      {selectedRegistration && selectedRegistration.form_data?.programType === 'group' && (() => {
        // Convert legacy groupDay to new groupSelectedDays format
        let currentDays = selectedRegistration.form_data?.groupSelectedDays || [];
        if (currentDays.length === 0 && selectedRegistration.form_data?.groupDay) {
          currentDays = [selectedRegistration.form_data.groupDay as WeekDay];
        }

        return (
          <ScheduleEditModal
            isOpen={isEditingSchedule}
            onClose={() => setIsEditingSchedule(false)}
            registrationId={selectedRegistration.id}
            playerName={selectedRegistration.form_data?.playerFullName || 'Unknown Player'}
            currentDays={currentDays}
            frequency={selectedRegistration.form_data?.groupFrequency || '1x'}
            onSave={handleScheduleUpdate}
          />
        );
      })()}
    </div>
  );
};

export default AdminDashboard;
