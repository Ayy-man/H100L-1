import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Registration {
  id: string;
  created_at: string;
  form_data: {
    playerFullName: string;
    programType: string;
    parentEmail: string;
  };
}

const AdminDashboard: React.FC = () => {
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {registrations.length > 0 ? (
                  registrations.map((reg) => (
                    <tr key={reg.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{new Date(reg.created_at).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{reg.form_data?.playerFullName || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 capitalize">{reg.form_data?.programType || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{reg.form_data?.parentEmail || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-400">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-500/10 text-green-400">
                          Confirmed
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">No registrations found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
