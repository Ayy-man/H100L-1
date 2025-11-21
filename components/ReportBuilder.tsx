import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import {
  exportToCSV,
  exportToExcel,
  exportToPDF,
  openPrintView,
  reportTemplates,
  ExportField,
  ExportOptions
} from '../lib/exportUtils';

interface ReportBuilderProps {
  registrations: any[];
  capacityData: any[];
  semiPrivateGroups: any[];
}

interface SavedTemplate {
  id: string;
  name: string;
  description: string;
  report_type: string;
  fields: any[];
  filters: any;
  is_favorite: boolean;
}

const ReportBuilder: React.FC<ReportBuilderProps> = ({
  registrations,
  capacityData,
  semiPrivateGroups
}) => {
  const [reportType, setReportType] = useState<'registrations' | 'financial' | 'capacity' | 'semiPrivateGroups'>('registrations');
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf' | 'excel' | 'print'>('csv');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [reportName, setReportName] = useState('');

  // Available fields for each report type
  const availableFields: Record<string, ExportField[]> = {
    registrations: reportTemplates.registrations.fields,
    financial: reportTemplates.financial.fields,
    capacity: reportTemplates.capacity.fields,
    semiPrivateGroups: reportTemplates.semiPrivateGroups.fields
  };

  useEffect(() => {
    // Set default selected fields when report type changes
    const defaultFields = availableFields[reportType].map(f => f.key);
    setSelectedFields(defaultFields);
    loadSavedTemplates();
  }, [reportType]);

  const loadSavedTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('report_templates')
        .select('*')
        .eq('report_type', reportType)
        .order('is_favorite', { ascending: false })
        .order('created_at', { ascending: false });

      if (data) setSavedTemplates(data);
    } catch (err) {
      console.error('Error loading templates:', err);
    }
  };

  const getFilteredData = () => {
    let data: any[] = [];

    switch (reportType) {
      case 'registrations':
      case 'financial':
        data = registrations.map(reg => ({
          ...reg.form_data,
          created_at: reg.created_at,
          payment_status: reg.payment_status,
          payment_method_id: reg.payment_method_id,
          stripe_customer_id: reg.stripe_customer_id,
          stripe_subscription_id: reg.stripe_subscription_id,
          id: reg.id
        }));
        break;
      case 'capacity':
        data = capacityData;
        break;
      case 'semiPrivateGroups':
        data = semiPrivateGroups;
        break;
    }

    // Apply date range filter
    if (dateRange.start && dateRange.end) {
      data = data.filter(item => {
        const itemDate = new Date(item.created_at);
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        return itemDate >= startDate && itemDate <= endDate;
      });
    }

    return data;
  };

  const handleExport = async () => {
    console.log('🚀 handleExport called');
    console.log('📊 Report Type:', reportType);
    console.log('📋 Export Format:', exportFormat);

    const data = getFilteredData();
    console.log('📦 Filtered Data:', data.length, 'records', data);

    if (data.length === 0) {
      alert('No data to export with current filters');
      return;
    }

    const fields = availableFields[reportType].filter(f =>
      selectedFields.includes(f.key)
    );
    console.log('🔖 Selected Fields:', fields.length, 'fields', fields);

    const filename = reportName || `SniperZone_${reportType}_${new Date().toISOString().split('T')[0]}`;
    console.log('📁 Filename:', filename);

    const exportOptions: ExportOptions = {
      filename,
      fields,
      data,
      title: reportTemplates[reportType]?.name || reportType,
      dateRange: dateRange.start && dateRange.end ? dateRange : undefined
    };
    console.log('⚙️ Export Options:', exportOptions);

    try {
      console.log(`🎯 Executing ${exportFormat} export...`);
      switch (exportFormat) {
        case 'csv':
          console.log('📄 Calling exportToCSV...');
          exportToCSV(exportOptions);
          break;
        case 'pdf':
          console.log('📕 Calling exportToPDF...');
          exportToPDF({
            ...exportOptions,
            subtitle: `${data.length} records`
          });
          break;
        case 'excel':
          console.log('📊 Calling exportToExcel...');
          exportToExcel(exportOptions);
          console.log('✅ exportToExcel completed');
          break;
        case 'print':
          console.log('🖨️ Calling openPrintView...');
          openPrintView({
            ...exportOptions,
            subtitle: `${data.length} records`
          });
          break;
      }

      // Log export to history
      await logExport(data.length);
      console.log('✅ Export logged to history');
      alert(`Report exported successfully! (${data.length} records)`);
    } catch (err: any) {
      console.error('❌ Export error:', err);
      alert(`Export failed: ${err.message}`);
    }
  };

  const handleExportAll = async () => {
    console.log('🚀 handleExportAll called');
    console.log('📊 Registrations:', registrations.length);
    console.log('📊 Capacity Data:', capacityData.length);
    console.log('📊 Semi-Private Groups:', semiPrivateGroups.length);

    const regData = registrations.map(reg => ({
      ...reg.form_data,
      created_at: reg.created_at,
      payment_status: reg.payment_status,
      payment_method_id: reg.payment_method_id,
      stripe_customer_id: reg.stripe_customer_id,
      stripe_subscription_id: reg.stripe_subscription_id,
      id: reg.id
    }));
    console.log('📦 Prepared regData:', regData.length, 'records');

    const sheets = [
      {
        filename: 'Complete_Export',
        title: 'Registrations',
        fields: reportTemplates.registrations.fields,
        data: regData
      },
      {
        filename: 'Complete_Export',
        title: 'Capacity',
        fields: reportTemplates.capacity.fields,
        data: capacityData
      },
      {
        filename: 'Complete_Export',
        title: 'Groups',
        fields: reportTemplates.semiPrivateGroups.fields,
        data: semiPrivateGroups
      }
    ];
    console.log('📋 Prepared sheets:', sheets.length, 'sheets');
    console.log('📋 Sheet details:', sheets);

    try {
      console.log('📊 Calling exportToExcel with multiple sheets...');
      exportToExcel(sheets);
      console.log('✅ exportToExcel completed');
      alert('Complete export generated with multiple sheets!');
    } catch (err: any) {
      console.error('❌ Export All error:', err);
      alert(`Export failed: ${err.message}`);
    }
  };

  const logExport = async (recordCount: number) => {
    try {
      await supabase.from('report_history').insert({
        report_type: reportType,
        format: exportFormat,
        record_count: recordCount,
        date_range_start: dateRange.start || null,
        date_range_end: dateRange.end || null
      });
    } catch (err) {
      console.error('Error logging export:', err);
    }
  };

  const saveAsTemplate = async () => {
    if (!reportName) {
      alert('Please enter a template name');
      return;
    }

    try {
      const { error } = await supabase.from('report_templates').insert({
        name: reportName,
        description: `Custom ${reportType} report`,
        report_type: reportType,
        fields: selectedFields.map(key => {
          const field = availableFields[reportType].find(f => f.key === key);
          return {
            key: field?.key,
            label: field?.label,
            type: 'text'
          };
        }),
        filters: dateRange.start ? { dateRange } : null
      });

      if (error) throw error;

      alert('Template saved successfully!');
      setReportName('');
      loadSavedTemplates();
    } catch (err: any) {
      alert(`Failed to save template: ${err.message}`);
    }
  };

  const loadTemplate = (templateId: string) => {
    const template = savedTemplates.find(t => t.id === templateId);
    if (template) {
      setSelectedFields(template.fields.map(f => f.key));
      if (template.filters?.dateRange) {
        setDateRange(template.filters.dateRange);
      }
    }
  };

  const toggleField = (fieldKey: string) => {
    setSelectedFields(prev =>
      prev.includes(fieldKey)
        ? prev.filter(k => k !== fieldKey)
        : [...prev, fieldKey]
    );
  };

  const previewCount = getFilteredData().length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white uppercase tracking-wider">
            📊 Report Builder
          </h2>
          <p className="text-gray-400 mt-1">
            Create custom reports and export data
          </p>
        </div>
        <button
          onClick={handleExportAll}
          className="bg-green-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-600 transition-all"
        >
          📥 Export All (Excel)
        </button>
      </div>

      {/* Report Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Report Type Selection */}
          <div className="bg-black border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-bold text-[#9BD4FF] uppercase tracking-wider mb-4">
              1. Select Report Type
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['registrations', 'financial', 'capacity', 'semiPrivateGroups'].map(type => (
                <button
                  key={type}
                  onClick={() => setReportType(type as any)}
                  className={`py-3 px-4 rounded-lg font-bold transition-all ${
                    reportType === type
                      ? 'bg-[#9BD4FF] text-black'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {type === 'semiPrivateGroups' ? 'Groups' : type}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="bg-black border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-bold text-[#9BD4FF] uppercase tracking-wider mb-4">
              2. Date Range (Optional)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Start Date</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#9BD4FF]"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-2 block">End Date</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#9BD4FF]"
                />
              </div>
            </div>
          </div>

          {/* Field Selection */}
          <div className="bg-black border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-bold text-[#9BD4FF] uppercase tracking-wider mb-4">
              3. Select Fields
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {availableFields[reportType].map(field => (
                <label
                  key={field.key}
                  className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all ${
                    selectedFields.includes(field.key)
                      ? 'bg-[#9BD4FF]/20 border border-[#9BD4FF]/50'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(field.key)}
                    onChange={() => toggleField(field.key)}
                    className="w-4 h-4"
                  />
                  <span className="text-white text-sm">{field.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setSelectedFields(availableFields[reportType].map(f => f.key))}
                className="text-[#9BD4FF] text-sm hover:underline"
              >
                Select All
              </button>
              <button
                onClick={() => setSelectedFields([])}
                className="text-red-400 text-sm hover:underline"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Export Format */}
          <div className="bg-black border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-bold text-[#9BD4FF] uppercase tracking-wider mb-4">
              4. Export Format
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: 'csv', label: 'CSV', icon: '📄' },
                { value: 'excel', label: 'Excel', icon: '📊' },
                { value: 'pdf', label: 'PDF', icon: '📕' },
                { value: 'print', label: 'Print', icon: '🖨️' }
              ].map(format => (
                <button
                  key={format.value}
                  onClick={() => setExportFormat(format.value as any)}
                  className={`py-3 px-4 rounded-lg font-bold transition-all ${
                    exportFormat === format.value
                      ? 'bg-[#9BD4FF] text-black'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {format.icon} {format.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Actions & Preview */}
        <div className="space-y-6">
          {/* Preview */}
          <div className="bg-black border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-bold text-[#9BD4FF] uppercase tracking-wider mb-4">
              Preview
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Report Type:</span>
                <span className="text-white font-bold capitalize">{reportType}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Records:</span>
                <span className="text-[#9BD4FF] font-bold">{previewCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Fields:</span>
                <span className="text-white font-bold">{selectedFields.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Format:</span>
                <span className="text-white font-bold uppercase">{exportFormat}</span>
              </div>
            </div>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={selectedFields.length === 0 || previewCount === 0}
            className="w-full bg-[#9BD4FF] text-black font-bold py-4 rounded-lg hover:shadow-[0_0_15px_#9BD4FF] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg"
          >
            Generate Report
          </button>

          {/* Save Template */}
          <div className="bg-black border border-white/10 rounded-lg p-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
              Save Template
            </h3>
            <input
              type="text"
              placeholder="Template name..."
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#9BD4FF] mb-3"
            />
            <button
              onClick={saveAsTemplate}
              disabled={!reportName}
              className="w-full bg-white/10 text-white font-bold py-2 rounded-lg hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              💾 Save Template
            </button>
          </div>

          {/* Saved Templates */}
          {savedTemplates.length > 0 && (
            <div className="bg-black border border-white/10 rounded-lg p-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                Saved Templates
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {savedTemplates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => {
                      setSelectedTemplate(template.id);
                      loadTemplate(template.id);
                    }}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      selectedTemplate === template.id
                        ? 'bg-[#9BD4FF]/20 border border-[#9BD4FF]/50'
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-white font-bold text-sm">{template.name}</p>
                        <p className="text-gray-500 text-xs mt-1">{template.description}</p>
                      </div>
                      {template.is_favorite && (
                        <span className="text-yellow-400">⭐</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportBuilder;
