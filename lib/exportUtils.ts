import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportField {
  key: string;
  label: string;
  format?: (value: any) => string;
}

export interface ExportOptions {
  filename: string;
  fields: ExportField[];
  data: any[];
  title?: string;
  dateRange?: { start: string; end: string };
}

// CSV Export
export const exportToCSV = (options: ExportOptions) => {
  const { filename, fields, data } = options;

  // Create header row
  const headers = fields.map(f => f.label).join(',');

  // Create data rows
  const rows = data.map(item => {
    return fields.map(field => {
      let value = item[field.key];

      // Apply formatting if provided
      if (field.format) {
        value = field.format(value);
      }

      // Escape commas and quotes in CSV
      if (value === null || value === undefined) {
        return '';
      }

      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    }).join(',');
  });

  const csv = [headers, ...rows].join('\n');

  // Create and download file
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

// Excel Export
export const exportToExcel = (options: ExportOptions | ExportOptions[]) => {
  try {
    console.log('Starting Excel export...', options);

    const workbook = XLSX.utils.book_new();

    // Support single or multiple sheets
    const sheets = Array.isArray(options) ? options : [options];

    console.log(`Creating ${sheets.length} sheet(s)`);

    sheets.forEach((sheet, index) => {
      const { fields, data, title } = sheet;

      console.log(`Sheet ${index + 1}: ${title || 'Untitled'}, ${data.length} rows, ${fields.length} fields`);

      // Create worksheet data
      const wsData: any[][] = [];

      // Add title if provided
      if (title) {
        wsData.push([title]);
        wsData.push([]); // Empty row
      }

      // Add headers
      wsData.push(fields.map(f => f.label));

      // Add data rows
      data.forEach((item, rowIndex) => {
        try {
          const row = fields.map(field => {
            let value = item[field.key];
            if (field.format) {
              value = field.format(value);
            }
            return value ?? '';
          });
          wsData.push(row);
        } catch (rowError) {
          console.error(`Error processing row ${rowIndex}:`, rowError, item);
        }
      });

      console.log(`Worksheet data prepared: ${wsData.length} rows total`);

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Auto-size columns
      const colWidths = fields.map(field => ({
        wch: Math.max(field.label.length, 15)
      }));
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      const sheetName = title || `Sheet${index + 1}`;
      const safeName = sheetName.slice(0, 31); // Max 31 chars
      console.log(`Adding sheet: ${safeName}`);
      XLSX.utils.book_append_sheet(workbook, ws, safeName);
    });

    // Generate filename
    const filename = Array.isArray(options)
      ? 'SniperZone_Export'
      : options.filename;

    console.log(`Writing file: ${filename}.xlsx`);

    // Write file
    XLSX.writeFile(workbook, `${filename}.xlsx`);

    console.log('Excel export completed successfully!');
  } catch (error) {
    console.error('Excel export failed:', error);
    throw new Error(`Excel export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// PDF Export
export const exportToPDF = (options: ExportOptions & { subtitle?: string }) => {
  const { filename, fields, data, title, subtitle, dateRange } = options;

  const doc = new jsPDF();

  // Add title
  if (title) {
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 20);
  }

  // Add subtitle
  let yPos = title ? 28 : 20;
  if (subtitle) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, 14, yPos);
    yPos += 8;
  }

  // Add date range
  if (dateRange) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${dateRange.start} to ${dateRange.end}`, 14, yPos);
    yPos += 10;
  }

  // Add generation date
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, yPos);
  yPos += 8;

  // Prepare table data
  const tableHeaders = fields.map(f => f.label);
  const tableData = data.map(item => {
    return fields.map(field => {
      let value = item[field.key];
      if (field.format) {
        value = field.format(value);
      }
      return value ?? '';
    });
  });

  // Add table
  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: yPos,
    theme: 'striped',
    headStyles: {
      fillColor: [155, 212, 255], // Ice blue
      textColor: [0, 0, 0],
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 9,
      cellPadding: 3
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    margin: { top: yPos }
  });

  // Save PDF
  doc.save(`${filename}.pdf`);
};

// Generate print-friendly view
export const openPrintView = (options: ExportOptions & { subtitle?: string }) => {
  const { fields, data, title, subtitle, dateRange } = options;

  // Create HTML content
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title || 'SniperZone Report'}</title>
      <style>
        @media print {
          @page { margin: 1cm; }
          body { margin: 0; }
        }
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          color: #333;
        }
        h1 {
          color: #000;
          margin-bottom: 5px;
        }
        .subtitle {
          color: #666;
          font-size: 14px;
          margin-bottom: 10px;
        }
        .meta {
          color: #999;
          font-size: 12px;
          margin-bottom: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th {
          background-color: #9BD4FF;
          color: #000;
          padding: 10px;
          text-align: left;
          font-weight: bold;
          border: 1px solid #ddd;
        }
        td {
          padding: 8px;
          border: 1px solid #ddd;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .no-print {
          margin: 20px 0;
        }
        @media print {
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      ${title ? `<h1>${title}</h1>` : ''}
      ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
      <div class="meta">
        ${dateRange ? `Period: ${dateRange.start} to ${dateRange.end}<br>` : ''}
        Generated: ${new Date().toLocaleString()}
      </div>
      <div class="no-print">
        <button onclick="window.print()">Print</button>
        <button onclick="window.close()">Close</button>
      </div>
      <table>
        <thead>
          <tr>
            ${fields.map(f => `<th>${f.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map(item => `
            <tr>
              ${fields.map(field => {
                let value = item[field.key];
                if (field.format) {
                  value = field.format(value);
                }
                return `<td>${value ?? ''}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  // Open in new window
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
};

// Predefined report templates
export const reportTemplates = {
  registrations: {
    name: 'All Registrations',
    fields: [
      { key: 'created_at', label: 'Date', format: (v: string) => new Date(v).toLocaleDateString() },
      { key: 'playerFullName', label: 'Player Name' },
      { key: 'playerCategory', label: 'Category' },
      { key: 'programType', label: 'Program', format: (v: string) => v?.toUpperCase() },
      { key: 'groupFrequency', label: 'Frequency' },
      { key: 'parentEmail', label: 'Parent Email' },
      { key: 'parentPhone', label: 'Phone' },
      { key: 'payment_status', label: 'Payment Status', format: (v: string) => v?.toUpperCase() }
    ]
  },
  financial: {
    name: 'Financial Report',
    fields: [
      { key: 'created_at', label: 'Date', format: (v: string) => new Date(v).toLocaleDateString() },
      { key: 'playerFullName', label: 'Player Name' },
      { key: 'programType', label: 'Program', format: (v: string) => v?.toUpperCase() },
      { key: 'payment_status', label: 'Status', format: (v: string) => v?.toUpperCase() },
      { key: 'payment_method_id', label: 'Payment Method' },
      { key: 'stripe_customer_id', label: 'Customer ID' },
      { key: 'stripe_subscription_id', label: 'Subscription ID' }
    ]
  },
  capacity: {
    name: 'Capacity Report',
    fields: [
      { key: 'time_slot_name', label: 'Time Slot' },
      { key: 'day_of_week', label: 'Day' },
      { key: 'capacity', label: 'Capacity' },
      { key: 'current_registrations', label: 'Current' },
      { key: 'utilization_rate', label: 'Utilization %' },
      { key: 'available_spots', label: 'Available' }
    ]
  },
  semiPrivateGroups: {
    name: 'Semi-Private Groups',
    fields: [
      { key: 'group_name', label: 'Group Name' },
      { key: 'status', label: 'Status', format: (v: string) => v?.toUpperCase() },
      { key: 'member_count', label: 'Members' },
      { key: 'scheduled_day', label: 'Day' },
      { key: 'scheduled_time', label: 'Time' },
      { key: 'created_at', label: 'Created', format: (v: string) => new Date(v).toLocaleDateString() }
    ]
  }
};
