import React, { useState, useEffect } from 'react';
import { Users, Search, Filter, UserPlus, Mail, Calendar, Clock, TrendingUp, History } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface UnpairedPlayer {
  id: string;
  registration_id: string;
  player_name: string;
  player_category: string;
  age_category: string;
  preferred_days: string[];
  preferred_time_slots: string[];
  status: string;
  unpaired_since_date: string;
  parent_email: string;
  parent_name: string;
}

interface ActivePairing {
  id: string;
  player_1_name: string;
  player_2_name: string;
  scheduled_day: string;
  scheduled_time: string;
  paired_date: string;
  player_1_category: string;
  player_2_category: string;
}

interface DissolvedPairing {
  id: string;
  player_1_name: string;
  player_2_name: string;
  scheduled_day: string;
  scheduled_time: string;
  paired_date: string;
  dissolved_date: string;
  dissolved_reason: string;
  dissolved_by: string;
  player_1_category: string;
  player_2_category: string;
}

interface PairingOpportunity {
  player1: UnpairedPlayer;
  player2: UnpairedPlayer;
  commonDays: string[];
  commonTimes: string[];
  matchScore: number;
}

type TabType = 'unpaired' | 'opportunities' | 'active' | 'history';

export const UnpairedPlayersPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('unpaired');
  const [unpairedPlayers, setUnpairedPlayers] = useState<UnpairedPlayer[]>([]);
  const [activePairings, setActivePairings] = useState<ActivePairing[]>([]);
  const [dissolvedPairings, setDissolvedPairings] = useState<DissolvedPairing[]>([]);
  const [pairingOpportunities, setPairingOpportunities] = useState<PairingOpportunity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterDay, setFilterDay] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (unpairedPlayers.length >= 2) {
      calculatePairingOpportunities();
    }
  }, [unpairedPlayers]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load unpaired players
      const { data: unpaired, error: unpairedError } = await supabase
        .from('unpaired_semi_private')
        .select('*')
        .eq('status', 'waiting')
        .order('unpaired_since_date', { ascending: false });

      if (unpaired && !unpairedError) {
        setUnpairedPlayers(unpaired);
      }

      // Load active pairings
      const { data: pairings, error: pairingsError } = await supabase
        .from('semi_private_pairings')
        .select(`
          id,
          scheduled_day,
          scheduled_time,
          paired_date,
          player_1:player_1_registration_id(form_data),
          player_2:player_2_registration_id(form_data)
        `)
        .eq('status', 'active')
        .order('paired_date', { ascending: false });

      if (pairings && !pairingsError) {
        const formattedPairings = pairings.map((p: any) => ({
          id: p.id,
          player_1_name: p.player_1?.form_data?.playerFullName || 'Unknown',
          player_2_name: p.player_2?.form_data?.playerFullName || 'Unknown',
          player_1_category: p.player_1?.form_data?.playerCategory || 'Unknown',
          player_2_category: p.player_2?.form_data?.playerCategory || 'Unknown',
          scheduled_day: p.scheduled_day,
          scheduled_time: p.scheduled_time,
          paired_date: p.paired_date
        }));
        setActivePairings(formattedPairings);
      }

      // Load dissolved pairings (history)
      const { data: dissolved, error: dissolvedError } = await supabase
        .from('semi_private_pairings')
        .select(`
          id,
          scheduled_day,
          scheduled_time,
          paired_date,
          dissolved_date,
          dissolved_reason,
          dissolved_by,
          player_1:player_1_registration_id(form_data),
          player_2:player_2_registration_id(form_data)
        `)
        .eq('status', 'dissolved')
        .order('dissolved_date', { ascending: false })
        .limit(50);

      if (dissolved && !dissolvedError) {
        const formattedDissolved = dissolved.map((p: any) => ({
          id: p.id,
          player_1_name: p.player_1?.form_data?.playerFullName || 'Unknown',
          player_2_name: p.player_2?.form_data?.playerFullName || 'Unknown',
          player_1_category: p.player_1?.form_data?.playerCategory || 'Unknown',
          player_2_category: p.player_2?.form_data?.playerCategory || 'Unknown',
          scheduled_day: p.scheduled_day,
          scheduled_time: p.scheduled_time,
          paired_date: p.paired_date,
          dissolved_date: p.dissolved_date,
          dissolved_reason: p.dissolved_reason || 'No reason provided',
          dissolved_by: p.dissolved_by || 'Unknown'
        }));
        setDissolvedPairings(formattedDissolved);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculatePairingOpportunities = () => {
    const opportunities: PairingOpportunity[] = [];

    for (let i = 0; i < unpairedPlayers.length; i++) {
      for (let j = i + 1; j < unpairedPlayers.length; j++) {
        const player1 = unpairedPlayers[i];
        const player2 = unpairedPlayers[j];

        // Same age category check
        if (player1.age_category !== player2.age_category) continue;

        // Find common days
        const commonDays = player1.preferred_days.filter(day =>
          player2.preferred_days.includes(day)
        );

        // Find common times
        const commonTimes = player1.preferred_time_slots.filter(time =>
          player2.preferred_time_slots.includes(time)
        );

        if (commonDays.length > 0 && commonTimes.length > 0) {
          // Calculate match score
          const dayOverlap = commonDays.length * 20;
          const timeOverlap = commonTimes.length * 20;
          const categoryMatch = player1.age_category === player2.age_category ? 30 : 0;
          const matchScore = dayOverlap + timeOverlap + categoryMatch;

          opportunities.push({
            player1,
            player2,
            commonDays,
            commonTimes,
            matchScore
          });
        }
      }
    }

    // Sort by match score
    opportunities.sort((a, b) => b.matchScore - a.matchScore);
    setPairingOpportunities(opportunities);
  };

  const handleCreatePairing = async (opp: PairingOpportunity, selectedDay: string, selectedTime: string) => {
    try {
      const { error } = await supabase
        .from('semi_private_pairings')
        .insert({
          player_1_registration_id: opp.player1.registration_id,
          player_2_registration_id: opp.player2.registration_id,
          scheduled_day: selectedDay,
          scheduled_time: selectedTime,
          status: 'active'
        });

      if (!error) {
        // Update unpaired status
        await supabase
          .from('unpaired_semi_private')
          .update({ status: 'paired', paired_date: new Date().toISOString().split('T')[0] })
          .in('registration_id', [opp.player1.registration_id, opp.player2.registration_id]);

        // Reload data
        await loadData();
        alert('Pairing created successfully!');
      } else {
        alert('Failed to create pairing: ' + error.message);
      }
    } catch (error) {
      console.error('Error creating pairing:', error);
      alert('Failed to create pairing');
    }
  };

  const handleDissolvePairing = async (pairingId: string) => {
    if (!confirm('Are you sure you want to dissolve this pairing?')) return;

    try {
      const { error } = await supabase
        .from('semi_private_pairings')
        .update({
          status: 'dissolved',
          dissolved_date: new Date().toISOString().split('T')[0],
          dissolved_reason: 'Admin dissolved',
          dissolved_by: 'admin'
        })
        .eq('id', pairingId);

      if (!error) {
        await loadData();
        alert('Pairing dissolved successfully');
      } else {
        alert('Failed to dissolve pairing: ' + error.message);
      }
    } catch (error) {
      console.error('Error dissolving pairing:', error);
      alert('Failed to dissolve pairing');
    }
  };

  const getDaysAgo = (date: string) => {
    const diff = Math.floor((new Date().getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const filteredPlayers = unpairedPlayers.filter(player => {
    if (filterCategory !== 'all' && player.age_category !== filterCategory) return false;
    if (filterDay !== 'all' && !player.preferred_days.includes(filterDay)) return false;
    if (searchQuery && !player.player_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const categories = ['M7', 'M9', 'M11', 'M13', 'M15'];
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <div className="bg-gray-900 rounded-xl border border-white/10 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-[#9BD4FF]" />
            Semi-Private Pairing Management
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Manage unpaired players and create pairings
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="px-4 py-2 bg-[#9BD4FF] text-black rounded-lg hover:bg-[#7BB4DD] transition-colors disabled:opacity-50 font-bold"
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
          <div className="text-2xl font-bold text-[#9BD4FF]">{unpairedPlayers.length}</div>
          <div className="text-sm text-gray-400">Unpaired Players</div>
        </div>
        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
          <div className="text-2xl font-bold text-white">{pairingOpportunities.length}</div>
          <div className="text-sm text-gray-400">Potential Matches</div>
        </div>
        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
          <div className="text-2xl font-bold text-[#9BD4FF]">{activePairings.length}</div>
          <div className="text-sm text-gray-400">Active Pairs</div>
        </div>
        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
          <div className="text-2xl font-bold text-white">
            {pairingOpportunities.length > 0 ? Math.round(pairingOpportunities[0].matchScore) : 0}
          </div>
          <div className="text-sm text-gray-400">Best Match Score</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-white/10 overflow-x-auto">
        {[
          { id: 'unpaired', label: 'Unpaired Players', count: unpairedPlayers.length },
          { id: 'opportunities', label: 'Pairing Opportunities', count: pairingOpportunities.length },
          { id: 'active', label: 'Active Pairs', count: activePairings.length },
          { id: 'history', label: 'Pairing History', count: dissolvedPairings.length }
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
            {tab.count !== null && (
              <span className="ml-2 px-2 py-0.5 bg-white/10 rounded-full text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'unpaired' && (
        <div>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by player name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#9BD4FF]"
              />
            </div>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#9BD4FF]"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              value={filterDay}
              onChange={(e) => setFilterDay(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#9BD4FF]"
            >
              <option value="all">All Days</option>
              {days.map(day => (
                <option key={day} value={day}>
                  {day.charAt(0).toUpperCase() + day.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Player</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Category</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Preferred Days</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Preferred Times</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Unpaired Since</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Parent</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredPlayers.map(player => {
                  const daysAgo = getDaysAgo(player.unpaired_since_date);
                  return (
                    <tr key={player.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-sm text-white">{player.player_name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 bg-[#9BD4FF]/20 text-[#9BD4FF] rounded text-xs font-medium">
                          {player.age_category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {player.preferred_days.map(d => d.slice(0, 3)).join(', ')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {player.preferred_time_slots.slice(0, 2).join(', ')}
                        {player.preferred_time_slots.length > 2 && ` +${player.preferred_time_slots.length - 2}`}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          daysAgo > 14
                            ? 'bg-white/20 text-white'
                            : daysAgo > 7
                            ? 'bg-white/10 text-gray-300'
                            : 'bg-[#9BD4FF]/20 text-[#9BD4FF]'
                        }`}>
                          {daysAgo} days
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        <div className="truncate max-w-[150px]" title={player.parent_email}>
                          {player.parent_email}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <a
                          href={`mailto:${player.parent_email}`}
                          className="text-[#9BD4FF] hover:text-[#7BB4DD] transition-colors"
                          title="Contact parent"
                        >
                          <Mail className="w-4 h-4" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredPlayers.length === 0 && (
              <div className="p-12 text-center text-gray-400">
                No unpaired players found
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'opportunities' && (
        <div className="space-y-4">
          {pairingOpportunities.map((opp, index) => (
            <div key={index} className="bg-[#9BD4FF]/5 border border-[#9BD4FF]/30 p-6 rounded-lg">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-white">
                      {opp.player1.player_name} + {opp.player2.player_name}
                    </h3>
                    <span className="px-3 py-1 bg-[#9BD4FF]/20 text-[#9BD4FF] rounded-full text-sm font-medium">
                      {opp.player1.age_category}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-300">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Common days: {opp.commonDays.map(d => d.slice(0, 3)).join(', ')}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Common times: {opp.commonTimes.join(', ')}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-[#9BD4FF]">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-2xl font-bold">{Math.round(opp.matchScore)}</span>
                  </div>
                  <div className="text-xs text-gray-400">Match Score</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <select
                  id={`day-${index}`}
                  className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                >
                  {opp.commonDays.map(day => (
                    <option key={day} value={day}>
                      {day.charAt(0).toUpperCase() + day.slice(1)}
                    </option>
                  ))}
                </select>

                <select
                  id={`time-${index}`}
                  className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                >
                  {opp.commonTimes.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    const daySelect = document.getElementById(`day-${index}`) as HTMLSelectElement;
                    const timeSelect = document.getElementById(`time-${index}`) as HTMLSelectElement;
                    handleCreatePairing(opp, daySelect.value, timeSelect.value);
                  }}
                  className="px-6 py-2 bg-[#9BD4FF] text-black rounded-lg hover:bg-[#7BB4DD] transition-colors font-bold flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Create Pairing
                </button>
              </div>
            </div>
          ))}

          {pairingOpportunities.length === 0 && (
            <div className="p-12 text-center text-gray-400">
              No pairing opportunities found. Players need overlapping availability.
            </div>
          )}
        </div>
      )}

      {activeTab === 'active' && (
        <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Player 1</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Player 2</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Categories</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Schedule</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Paired Since</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {activePairings.map(pairing => (
                <tr key={pairing.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-sm text-white">{pairing.player_1_name}</td>
                  <td className="px-4 py-3 text-sm text-white">{pairing.player_2_name}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-1 bg-[#9BD4FF]/20 text-[#9BD4FF] rounded text-xs font-medium">
                      {pairing.player_1_category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {pairing.scheduled_day} at {pairing.scheduled_time}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">{pairing.paired_date}</td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => handleDissolvePairing(pairing.id)}
                      className="text-gray-400 hover:text-white transition-colors text-xs underline"
                    >
                      Dissolve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {activePairings.length === 0 && (
            <div className="p-12 text-center text-gray-400">
              No active pairings
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center gap-2">
            <History className="w-5 h-5 text-[#9BD4FF]" />
            <span className="text-white font-medium">Dissolved Pairings History</span>
            <span className="text-gray-400 text-sm">(Last 50)</span>
          </div>
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Players</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Category</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Schedule</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Paired</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Dissolved</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Reason</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {dissolvedPairings.map(pairing => (
                <tr key={pairing.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-sm">
                    <div className="text-white">{pairing.player_1_name}</div>
                    <div className="text-gray-400 text-xs">+ {pairing.player_2_name}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-1 bg-white/10 text-gray-300 rounded text-xs font-medium">
                      {pairing.player_1_category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {pairing.scheduled_day} at {pairing.scheduled_time}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {pairing.paired_date}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {pairing.dissolved_date}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="text-gray-400 max-w-[150px] truncate block" title={pairing.dissolved_reason}>
                      {pairing.dissolved_reason}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {pairing.dissolved_by}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {dissolvedPairings.length === 0 && (
            <div className="p-12 text-center text-gray-400">
              <History className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No dissolved pairings found</p>
              <p className="text-sm mt-2">Dissolved pairs will appear here</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UnpairedPlayersPanel;
