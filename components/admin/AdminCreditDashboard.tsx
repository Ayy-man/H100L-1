import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, TrendingUp, AlertTriangle, Users, DollarSign, Clock, Activity, Package, Search } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import CreditManagementPanel from './CreditManagementPanel';

interface CreditSummary {
  overview: {
    totalParents: number;
    totalCredits: number;
    activePurchases: number;
    totalRevenue: number;
    monthlyRevenue: number;
    creditsUsedToday: number;
    creditsUsedThisMonth: number;
  };
  expiry: {
    expiring30Days: number;
    expiring7Days: number;
    expiring1Day: number;
  };
  packageDistribution: Record<string, number>;
  recentActivity: Array<{
    id: string;
    created_at: string;
    adjustment_amount: number;
    reason: string;
    admin_email: string;
    parent_email: string;
  }>;
  recentPurchases: Array<{
    id: string;
    firebase_uid: string;
    package_type: string;
    credits_purchased: number;
    price_paid: number;
    status: string;
    created_at: string;
    stripe_checkout_session_id: string | null;
    parent_email: string;
  }>;
  revenueChart: Array<{
    date: string;
    revenue: number;
  }>;
}

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  change?: number;
  changeLabel?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon: Icon, color, change, changeLabel }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change !== undefined && (
            <p className={`text-sm mt-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change >= 0 ? '+' : ''}{change} {changeLabel}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </motion.div>
  );
};

const AdminCreditDashboard: React.FC = () => {
  const [summary, setSummary] = useState<CreditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'management'>('overview');

  useEffect(() => {
    fetchCreditSummary();
  }, []);

  const fetchCreditSummary = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/credit-summary');
      if (!response.ok) throw new Error('Failed to fetch credit summary');
      const data = await response.json();
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount / 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
        <button
          onClick={fetchCreditSummary}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'overview'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('management')}
          className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'management'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Search className="w-4 h-4" />
          User Management
        </button>
      </div>

      {/* Overview Tab Content */}
      {(activeTab === 'overview' && (
        <>
          {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Parents"
          value={summary.overview.totalParents}
          icon={Users}
          color="bg-blue-500"
        />
        <StatsCard
          title="Total Credits"
          value={summary.overview.totalCredits}
          icon={CreditCard}
          color="bg-purple-500"
          changeLabel="credits used today"
          change={-summary.overview.creditsUsedToday}
        />
        <StatsCard
          title="Active Purchases"
          value={summary.overview.activePurchases}
          icon={Package}
          color="bg-green-500"
        />
        <StatsCard
          title="Total Revenue"
          value={formatCurrency(summary.overview.totalRevenue)}
          icon={DollarSign}
          color="bg-yellow-500"
          changeLabel="this month"
          change={summary.overview.monthlyRevenue / 100}
        />
      </div>

      {/* Expiry Alert Section */}
      {(summary.expiry.expiring1Day > 0 || summary.expiry.expiring7Days > 0 || summary.expiry.expiring30Days > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-orange-50 border border-orange-200 rounded-xl p-4"
        >
          <div className="flex items-center mb-2">
            <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
            <h3 className="text-lg font-semibold text-orange-900">Credits Expiring Soon</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{summary.expiry.expiring1Day}</p>
              <p className="text-sm text-orange-700">Expiring in 1 day</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-500">{summary.expiry.expiring7Days}</p>
              <p className="text-sm text-orange-700">Expiring in 7 days</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-400">{summary.expiry.expiring30Days}</p>
              <p className="text-sm text-orange-700">Expiring in 30 days</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
        >
          <h3 className="text-lg font-semibold mb-4">Revenue (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={summary.revenueChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => `$${value}`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Package Distribution */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
        >
          <h3 className="text-lg font-semibold mb-4">Package Distribution</h3>
          <div className="space-y-3">
            {Object.entries(summary.packageDistribution).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="capitalize text-gray-700">{type}</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium mr-2">{count}</span>
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${summary.overview.activePurchases > 0 ? (count / summary.overview.activePurchases) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Usage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatsCard
          title="Credits Used Today"
          value={summary.overview.creditsUsedToday}
          icon={Activity}
          color="bg-indigo-500"
        />
        <StatsCard
          title="Credits Used This Month"
          value={summary.overview.creditsUsedThisMonth}
          icon={Clock}
          color="bg-pink-500"
        />
      </div>

      {/* Recent Payments */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
      >
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          Recent Payments
        </h3>
        {summary.recentPurchases && summary.recentPurchases.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-3 font-medium">Parent</th>
                  <th className="pb-3 font-medium">Package</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.recentPurchases.map((purchase) => (
                  <tr key={purchase.id} className="text-sm">
                    <td className="py-3">
                      <span className="font-medium text-gray-900">{purchase.parent_email}</span>
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {purchase.package_type === '50_pack' ? '50-Pack' :
                         purchase.package_type === '20_pack' ? '20-Pack' :
                         purchase.package_type === '10_pack' ? '10-Pack' : 'Single'}
                      </span>
                      <span className="text-gray-500 ml-2">({purchase.credits_purchased} credits)</span>
                    </td>
                    <td className="py-3">
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(Number(purchase.price_paid) * 100)}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        purchase.status === 'completed' || purchase.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : purchase.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {purchase.status}
                      </span>
                    </td>
                    <td className="py-3 text-gray-500">
                      {new Date(purchase.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No recent payments</p>
        )}
      </motion.div>

      {/* Recent Activity */}
      {summary.recentActivity.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
        >
          <h3 className="text-lg font-semibold mb-4">Recent Credit Adjustments</h3>
          <div className="space-y-3">
            {summary.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <p className="font-medium text-gray-900">{activity.parent_email}</p>
                  <p className="text-sm text-gray-500">{activity.reason}</p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${activity.adjustment_amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {activity.adjustment_amount >= 0 ? '+' : ''}{activity.adjustment_amount} credits
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(activity.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
      </>))}

      {/* Management Tab Content */}
      {activeTab === 'management' && (
        <CreditManagementPanel />
      )}
    </div>
  );
};

export default AdminCreditDashboard;