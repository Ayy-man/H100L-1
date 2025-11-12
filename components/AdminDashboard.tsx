import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import DocumentsViewer from './DocumentsViewer';
import PlayerDocumentsSection from './PlayerDocumentsSection';
import DocumentStatusBadge from './DocumentStatusBadge';
import { MedicalFiles } from '../types';

interface Registration {
  id: string;
  created_at: string;
  form_data: {
    playerFullName: string;
    programType: string;
    parentEmail: string;
    parentPhone?: string;
    dateOfBirth?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyRelationship?: string;
    groupFrequency?: string;
    groupDay?: string; // Legacy
    groupSelectedDays?: string[]; // New: Selected days of the week
    groupMonthlyDates?: string[]; // New: Generated monthly dates
    jerseySize?: string;
    position?: string;
    dominantHand?: string;
    currentLevel?: string;
    hasAllergies?: boolean;
    allergiesDetails?: string;
    hasMedicalConditions?: boolean;
    medicalConditionsDetails?: string;
    medicalFiles?: MedicalFiles;
  };
}

const AdminDashboard: React.FC = () => {
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'documents'>('details');

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
      const fetchRegistrations = async () => {
        try {
          setLoading(true);
          const { data, error } = await supabase
            .from('registrations')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) {
            throw error;
          }
          setRegistrations(data as Registration[]);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchRegistrations();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="bg-gray-900 min-h-screen flex items-center justify-center">
        <p className="text-white">Authentication required.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto">
        <h1 className="text-3xl md:text-5xl uppercase font-black tracking-wider text-white mb-8">
          Admin Dashboard
        </h1>

        {loading && <p className="text-gray-400">Loading registrations...</p>}
        {error && <p className="text-red-500">Error: {error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto bg-black border border-white/10 rounded-lg">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Player Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Program Type</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Parent Email</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Documents</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {registrations.length > 0 ? (
                  registrations.map((reg) => (
                    <tr
                      key={reg.id}
                      onClick={() => {
                        setSelectedRegistration(reg);
                        setActiveTab('details');
                      }}
                      className="hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{new Date(reg.created_at).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{reg.form_data?.playerFullName || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 capitalize">{reg.form_data?.programType || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{reg.form_data?.parentEmail || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <DocumentStatusBadge
                          medicalFiles={reg.form_data?.medicalFiles}
                          hasMedicalConditions={reg.form_data?.hasMedicalConditions}
                          compact={true}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-400">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-500/10 text-green-400">
                          Confirmed
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">No registrations found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Registration Details Modal */}
        {selectedRegistration && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="relative bg-black border border-white/10 rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <h2 className="text-2xl uppercase font-bold tracking-wider text-white">
                  Registration Details
                </h2>
                <button
                  onClick={() => setSelectedRegistration(null)}
                  className="text-gray-400 hover:text-white text-3xl leading-none"
                >
                  &times;
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-white/10 px-6">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`px-6 py-3 text-sm font-semibold uppercase tracking-wider transition-colors ${
                    activeTab === 'details'
                      ? 'text-[#9BD4FF] border-b-2 border-[#9BD4FF]'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Details
                </button>
                <button
                  onClick={() => setActiveTab('documents')}
                  className={`px-6 py-3 text-sm font-semibold uppercase tracking-wider transition-colors ${
                    activeTab === 'documents'
                      ? 'text-[#9BD4FF] border-b-2 border-[#9BD4FF]'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Documents
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto flex-grow">
                {activeTab === 'details' && (
                  <div className="space-y-6">
                    {/* Player Documents Section - Collapsible with Quick Actions */}
                    <PlayerDocumentsSection
                      medicalFiles={selectedRegistration.form_data.medicalFiles}
                      hasMedicalConditions={selectedRegistration.form_data.hasMedicalConditions}
                      parentEmail={selectedRegistration.form_data.parentEmail}
                      playerName={selectedRegistration.form_data.playerFullName}
                    />

                    {/* Player Information */}
                    <div className="bg-white/5 p-4 rounded-lg">
                      <h3 className="text-lg font-bold text-white mb-4 uppercase tracking-wider">Player Information</h3>
                      <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <dt className="text-sm text-gray-400">Player Name</dt>
                          <dd className="text-white font-semibold">{selectedRegistration.form_data.playerFullName || 'N/A'}</dd>
                        </div>
                        <div>
                          <dt className="text-sm text-gray-400">Date of Birth</dt>
                          <dd className="text-white font-semibold">{selectedRegistration.form_data.dateOfBirth || 'N/A'}</dd>
                        </div>
                        <div>
                          <dt className="text-sm text-gray-400">Position</dt>
                          <dd className="text-white font-semibold">{selectedRegistration.form_data.position || 'N/A'}</dd>
                        </div>
                        <div>
                          <dt className="text-sm text-gray-400">Dominant Hand</dt>
                          <dd className="text-white font-semibold">{selectedRegistration.form_data.dominantHand || 'N/A'}</dd>
                        </div>
                        <div>
                          <dt className="text-sm text-gray-400">Current Level</dt>
                          <dd className="text-white font-semibold">{selectedRegistration.form_data.currentLevel || 'N/A'}</dd>
                        </div>
                        <div>
                          <dt className="text-sm text-gray-400">Jersey Size</dt>
                          <dd className="text-white font-semibold">{selectedRegistration.form_data.jerseySize || 'N/A'}</dd>
                        </div>
                      </dl>
                    </div>

                    {/* Parent Information */}
                    <div className="bg-white/5 p-4 rounded-lg">
                      <h3 className="text-lg font-bold text-white mb-4 uppercase tracking-wider">Parent Information</h3>
                      <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <dt className="text-sm text-gray-400">Email</dt>
                          <dd className="text-white font-semibold">{selectedRegistration.form_data.parentEmail || 'N/A'}</dd>
                        </div>
                        <div>
                          <dt className="text-sm text-gray-400">Phone</dt>
                          <dd className="text-white font-semibold">{selectedRegistration.form_data.parentPhone || 'N/A'}</dd>
                        </div>
                      </dl>
                    </div>

                    {/* Emergency Contact */}
                    <div className="bg-white/5 p-4 rounded-lg">
                      <h3 className="text-lg font-bold text-white mb-4 uppercase tracking-wider">Emergency Contact</h3>
                      <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <dt className="text-sm text-gray-400">Name</dt>
                          <dd className="text-white font-semibold">{selectedRegistration.form_data.emergencyContactName || 'N/A'}</dd>
                        </div>
                        <div>
                          <dt className="text-sm text-gray-400">Phone</dt>
                          <dd className="text-white font-semibold">{selectedRegistration.form_data.emergencyContactPhone || 'N/A'}</dd>
                        </div>
                        <div>
                          <dt className="text-sm text-gray-400">Relationship</dt>
                          <dd className="text-white font-semibold">{selectedRegistration.form_data.emergencyRelationship || 'N/A'}</dd>
                        </div>
                      </dl>
                    </div>

                    {/* Program Details */}
                    <div className="bg-white/5 p-4 rounded-lg">
                      <h3 className="text-lg font-bold text-white mb-4 uppercase tracking-wider">Program Details</h3>
                      <dl className="space-y-3">
                        <div>
                          <dt className="text-sm text-gray-400">Program Type</dt>
                          <dd className="text-white font-semibold capitalize">{selectedRegistration.form_data.programType || 'N/A'}</dd>
                        </div>
                        {selectedRegistration.form_data.groupFrequency && (
                          <div>
                            <dt className="text-sm text-gray-400">Frequency</dt>
                            <dd className="text-white font-semibold">{selectedRegistration.form_data.groupFrequency} per week</dd>
                          </div>
                        )}
                        {selectedRegistration.form_data.groupSelectedDays && selectedRegistration.form_data.groupSelectedDays.length > 0 && (
                          <div>
                            <dt className="text-sm text-gray-400">Training Days</dt>
                            <dd className="text-white font-semibold">
                              {selectedRegistration.form_data.groupSelectedDays.map(day =>
                                day.charAt(0).toUpperCase() + day.slice(1)
                              ).join(', ')}
                            </dd>
                          </div>
                        )}
                        {selectedRegistration.form_data.groupMonthlyDates && selectedRegistration.form_data.groupMonthlyDates.length > 0 && (
                          <div>
                            <dt className="text-sm text-gray-400 mb-2">Monthly Schedule</dt>
                            <dd className="text-white">
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {selectedRegistration.form_data.groupMonthlyDates.slice(0, 12).map((date) => {
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
                            </dd>
                          </div>
                        )}
                        {/* Legacy support for old registrations */}
                        {selectedRegistration.form_data.groupDay && !selectedRegistration.form_data.groupSelectedDays && (
                          <div>
                            <dt className="text-sm text-gray-400">Day (Legacy)</dt>
                            <dd className="text-white font-semibold capitalize">{selectedRegistration.form_data.groupDay}</dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    {/* Health Information */}
                    <div className="bg-white/5 p-4 rounded-lg">
                      <h3 className="text-lg font-bold text-white mb-4 uppercase tracking-wider">Health Information</h3>
                      <dl className="space-y-3">
                        <div>
                          <dt className="text-sm text-gray-400">Allergies</dt>
                          <dd className="text-white font-semibold">
                            {selectedRegistration.form_data.hasAllergies
                              ? selectedRegistration.form_data.allergiesDetails || 'Yes (no details provided)'
                              : 'None'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm text-gray-400">Medical Conditions</dt>
                          <dd className="text-white font-semibold">
                            {selectedRegistration.form_data.hasMedicalConditions
                              ? selectedRegistration.form_data.medicalConditionsDetails || 'Yes (no details provided)'
                              : 'None'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                )}

                {activeTab === 'documents' && (
                  <DocumentsViewer medicalFiles={selectedRegistration.form_data.medicalFiles} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
