import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Search, Filter, RefreshCw, ChevronDown, ChevronUp, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ScheduleChange {
  id: string;
  registration_id: string;
  change_type: 'one_time' | 'permanent';
  program_type: string;
  original_days: string[];
  original_time: string | null;
  new_days: string[];
  new_time: string | null;
  effective_date: string | null;
  specific_date: string | null;
  status: 'pending' | 'approved' | 'applied' | 'cancelled' | 'rejected';
  reason: string | null;
  admin_notes: string | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  applied_at: string | null;
  // Joined player data
  player_name?: string;
  player_category?: string;
  parent_email?: string;
}

interface ScheduleException {
  id: string;
  registration_id: string;
  exception_date: string;
  exception_type: 'skip' | 'swap';
  replacement_date: string | null;
  replacement_time: string | null;
  replacement_day: string | null;
  status: 'pending' | 'approved' | 'applied' | 'cancelled';
  reason: string | null;
  created_at: string;
  applied_at: string | null;
  // Joined player data
  player_name?: string;
  player_category?: string;
  parent_email?: string;
  program_type?: string;
}

type TabType = 'exceptions' | 'permanent' | 'all';
type StatusFilter = 'all' | 'pending' | 'applied' | 'cancelled';

export const ScheduleChangesPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('exceptions');
  const [scheduleChanges, setScheduleChanges] = useState<ScheduleChange[]>([]);
  const [scheduleExceptions, setScheduleExceptions] = useState<ScheduleException[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Fetch schedule_exceptions with registration data
      const { data: exceptions, error: exceptionsError } = await supabase
        .from('schedule_exceptions')
        .select(`
          *,
          registration:registration_id(form_data)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (exceptions && !exceptionsError) {
        const formattedExceptions = exceptions.map((exc: any) => ({
          ...exc,
          player_name: exc.registration?.form_data?.playerFullName || 'Unknown',
          player_category: exc.registration?.form_data?.playerCategory || 'Unknown',
          parent_email: exc.registration?.form_data?.parentEmail || 'Unknown',
          program_type: exc.registration?.form_data?.programType || 'Unknown',
        }));
        setScheduleExceptions(formattedExceptions);
      }

      // Fetch schedule_changes with registration data
      const { data: changes, error: changesError } = await supabase
        .from('schedule_changes')
        .select(`
          *,
          registration:registration_id(form_data)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (changes && !changesError) {
        const formattedChanges = changes.map((change: any) => ({
          ...change,
          player_name: change.registration?.form_data?.playerFullName || 'Unknown',
          player_category: change.registration?.form_data?.playerCategory || 'Unknown',
          parent_email: change.registration?.form_data?.parentEmail || 'Unknown',
        }));
        setScheduleChanges(formattedChanges);
      }
    } catch (error) {
      console.error('Error loading schedule data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDays = (days: string[] | null) => {
    if (!days || days.length === 0) return 'N/A';
    return days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'applied':
        return <span className="px-2 py-1 bg-[#9BD4FF]/20 text-[#9BD4FF] rounded text-xs font-bold">Applied</span>;
      case 'approved':
        return <span className="px-2 py-1 bg-white/20 text-white rounded text-xs font-bold">Approved</span>;
      case 'pending':
        return <span className="px-2 py-1 bg-white/10 text-gray-400 rounded text-xs font-bold">Pending</span>;
      case 'cancelled':
        return <span className="px-2 py-1 bg-white/5 text-gray-500 rounded text-xs font-bold">Cancelled</span>;
      case 'rejected':
        return <span className="px-2 py-1 bg-white/5 text-gray-500 rounded text-xs font-bold">Rejected</span>;
      default:
        return <span className="px-2 py-1 bg-white/10 text-gray-400 rounded text-xs font-bold">{status}</span>;
    }
  };

  const getProgramBadge = (programType: string) => {
    switch (programType) {
      case 'group':
        return <span className="px-2 py-1 bg-[#9BD4FF]/20 text-[#9BD4FF] rounded text-xs">Group</span>;
      case 'private':
        return <span className="px-2 py-1 bg-white/20 text-white rounded text-xs">Private</span>;
      case 'semi-private':
      case 'semi_private':
        return <span className="px-2 py-1 bg-white/10 text-gray-300 rounded text-xs">Semi-Private</span>;
      default:
        return <span className="px-2 py-1 bg-white/10 text-gray-400 rounded text-xs">{programType}</span>;
    }
  };

  // Filter exceptions
  const filteredExceptions = scheduleExceptions.filter(exc => {
    const matchesSearch = searchQuery === '' ||
      exc.player_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exc.parent_email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || exc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filter permanent changes
  const filteredPermanentChanges = scheduleChanges.filter(change => {
    const matchesSearch = searchQuery === '' ||
      change.player_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      change.parent_email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || change.status === statusFilter;
    return matchesSearch && matchesStatus && change.change_type === 'permanent';
  });

  // All changes combined
  const allChanges = [
    ...filteredExceptions.map(exc => ({ ...exc, type: 'exception' as const })),
    ...scheduleChanges
      .filter(change => {
        const matchesSearch = searchQuery === '' ||
          change.player_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          change.parent_email?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || change.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .map(change => ({ ...change, type: 'change' as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Stats
  const stats = {
    totalExceptions: scheduleExceptions.length,
    appliedExceptions: scheduleExceptions.filter(e => e.status === 'applied').length,
    pendingExceptions: scheduleExceptions.filter(e => e.status === 'pending').length,
    totalPermanent: scheduleChanges.filter(c => c.change_type === 'permanent').length,
    totalOneTime: scheduleChanges.filter(c => c.change_type === 'one_time').length,
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-white/10 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-[#9BD4FF]" />
            Schedule Changes Management
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            View and manage player schedule modifications
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="px-4 py-2 bg-[#9BD4FF] text-black rounded-lg hover:bg-[#7BB4DD] transition-colors disabled:opacity-50 font-bold flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
          <div className="text-2xl font-bold text-[#9BD4FF]">{stats.totalExceptions}</div>
          <div className="text-sm text-gray-400">One-Time Changes</div>
        </div>
        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
          <div className="text-2xl font-bold text-white">{stats.appliedExceptions}</div>
          <div className="text-sm text-gray-400">Applied</div>
        </div>
        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
          <div className="text-2xl font-bold text-gray-400">{stats.pendingExceptions}</div>
          <div className="text-sm text-gray-400">Pending</div>
        </div>
        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
          <div className="text-2xl font-bold text-[#9BD4FF]">{stats.totalPermanent}</div>
          <div className="text-sm text-gray-400">Permanent Changes</div>
        </div>
        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
          <div className="text-2xl font-bold text-white">{stats.totalOneTime}</div>
          <div className="text-sm text-gray-400">Total Logged</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-white/10">
        {[
          { id: 'exceptions', label: 'One-Time Changes', count: filteredExceptions.length },
          { id: 'permanent', label: 'Permanent Changes', count: filteredPermanentChanges.length },
          { id: 'all', label: 'All History', count: allChanges.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-[#9BD4FF] text-[#9BD4FF]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
            <span className="ml-2 px-2 py-0.5 bg-white/10 rounded-full text-xs">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by player name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#9BD4FF]"
          />
        </div>

        <div className="relative">
          <Filter className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#9BD4FF] appearance-none"
          >
            <option value="all">All Statuses</option>
            <option value="applied">Applied</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#9BD4FF]"></div>
        </div>
      ) : (
        <>
          {/* One-Time Changes (Exceptions) Tab */}
          {activeTab === 'exceptions' && (
            <div className="space-y-3">
              {filteredExceptions.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No one-time schedule changes found</p>
                </div>
              ) : (
                filteredExceptions.map(exc => (
                  <div
                    key={exc.id}
                    className="bg-white/5 border border-white/10 rounded-lg overflow-hidden hover:border-[#9BD4FF]/50 transition-colors"
                  >
                    {/* Header Row */}
                    <div
                      className="p-4 flex items-center justify-between cursor-pointer"
                      onClick={() => toggleExpand(exc.id)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex-shrink-0">
                          <User className="w-10 h-10 text-gray-400 bg-white/5 rounded-full p-2" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-bold">{exc.player_name}</span>
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-400 text-sm">{exc.player_category}</span>
                            {getProgramBadge(exc.program_type || 'unknown')}
                          </div>
                          <div className="text-sm text-gray-400 mt-1">
                            <span className="text-gray-400">{formatDate(exc.exception_date)}</span>
                            <span className="mx-2 text-[#9BD4FF]">→</span>
                            <span className="text-white capitalize">
                              {exc.replacement_day || 'Skipped'}
                              {exc.replacement_time && ` at ${exc.replacement_time}`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(exc.status)}
                        {expandedItems.has(exc.id) ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedItems.has(exc.id) && (
                      <div className="px-4 pb-4 border-t border-white/10 pt-3 bg-black/20">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500 block">Type</span>
                            <span className="text-white capitalize">{exc.exception_type}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Original Date</span>
                            <span className="text-white">{formatDate(exc.exception_date)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Replacement Day</span>
                            <span className="text-white capitalize">{exc.replacement_day || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Created</span>
                            <span className="text-white">{new Date(exc.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                        {exc.reason && (
                          <div className="mt-3">
                            <span className="text-gray-500 block text-sm">Reason</span>
                            <span className="text-white text-sm">{exc.reason}</span>
                          </div>
                        )}
                        <div className="mt-3">
                          <span className="text-gray-500 block text-sm">Parent Email</span>
                          <span className="text-white text-sm">{exc.parent_email}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Permanent Changes Tab */}
          {activeTab === 'permanent' && (
            <div className="space-y-3">
              {filteredPermanentChanges.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No permanent schedule changes found</p>
                </div>
              ) : (
                filteredPermanentChanges.map(change => (
                  <div
                    key={change.id}
                    className="bg-white/5 border border-white/10 rounded-lg overflow-hidden hover:border-white/30 transition-colors"
                  >
                    {/* Header Row */}
                    <div
                      className="p-4 flex items-center justify-between cursor-pointer"
                      onClick={() => toggleExpand(change.id)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex-shrink-0">
                          <User className="w-10 h-10 text-white bg-white/10 rounded-full p-2" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-bold">{change.player_name}</span>
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-400 text-sm">{change.player_category}</span>
                            {getProgramBadge(change.program_type)}
                            <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs font-medium">Permanent</span>
                          </div>
                          <div className="text-sm text-gray-400 mt-1">
                            <span className="text-gray-400 line-through">{formatDays(change.original_days)}</span>
                            <span className="mx-2 text-[#9BD4FF]">→</span>
                            <span className="text-white font-medium">{formatDays(change.new_days)}</span>
                            {change.new_time && (
                              <span className="ml-2 text-gray-500">at {change.new_time}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(change.status)}
                        {expandedItems.has(change.id) ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedItems.has(change.id) && (
                      <div className="px-4 pb-4 border-t border-white/10 pt-3 bg-black/20">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500 block">Program</span>
                            <span className="text-white capitalize">{change.program_type?.replace('_', '-')}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Original Time</span>
                            <span className="text-white">{change.original_time || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">New Time</span>
                            <span className="text-white">{change.new_time || 'Same'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Effective Date</span>
                            <span className="text-white">{formatDate(change.effective_date || change.created_at)}</span>
                          </div>
                        </div>
                        {change.reason && (
                          <div className="mt-3">
                            <span className="text-gray-500 block text-sm">Reason</span>
                            <span className="text-white text-sm">{change.reason}</span>
                          </div>
                        )}
                        {change.admin_notes && (
                          <div className="mt-3">
                            <span className="text-gray-500 block text-sm">Admin Notes</span>
                            <span className="text-white text-sm">{change.admin_notes}</span>
                          </div>
                        )}
                        <div className="mt-3">
                          <span className="text-gray-500 block text-sm">Created</span>
                          <span className="text-white text-sm">{new Date(change.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* All History Tab */}
          {activeTab === 'all' && (
            <div className="space-y-3">
              {allChanges.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No schedule changes found</p>
                </div>
              ) : (
                allChanges.map(item => (
                  <div
                    key={item.id}
                    className={`bg-white/5 border rounded-lg overflow-hidden transition-colors ${
                      item.type === 'exception'
                        ? 'border-[#9BD4FF]/30 hover:border-[#9BD4FF]/50'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                  >
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`flex-shrink-0 ${
                          item.type === 'exception' ? 'text-[#9BD4FF]' : 'text-white'
                        }`}>
                          <Clock className="w-8 h-8" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-bold">{item.player_name}</span>
                            <span className="text-gray-400 text-sm">{item.player_category}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              item.type === 'exception'
                                ? 'bg-[#9BD4FF]/20 text-[#9BD4FF]'
                                : 'bg-white/20 text-white'
                            }`}>
                              {item.type === 'exception' ? 'One-Time' : 'Permanent'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(item.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      {getStatusBadge(item.status)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ScheduleChangesPanel;
