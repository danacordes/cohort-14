import Papa from 'papaparse';

const PERIOD_LABELS = {
  TODAY: 'Today',
  LAST_7_DAYS: 'Last 7 Days',
  LAST_30_DAYS: 'Last 30 Days',
  LAST_90_DAYS: 'Last 90 Days',
  CUSTOM: 'Custom',
};

function buildMetadataRows(reportType, filters) {
  const periodLabel =
    filters.dateRangePreset === 'CUSTOM'
      ? `${filters.customDateRange?.startDate ?? ''} – ${filters.customDateRange?.endDate ?? ''}`
      : (PERIOD_LABELS[filters.dateRangePreset] ?? filters.dateRangePreset);

  const metaFields = [
    ['Report', reportType],
    ['Date Range', periodLabel],
  ];
  if (filters.priority) metaFields.push(['Priority', filters.priority]);
  if (filters.category) metaFields.push(['Category', filters.category]);
  if (filters.agentId) metaFields.push(['Agent ID', filters.agentId]);

  return metaFields;
}

function triggerDownload(csvString, filename) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function exportReportToCSV(reportType, data, filters) {
  if (!data || (Array.isArray(data) && data.length === 0)) return;

  const rows = Array.isArray(data) ? data : [data];

  const metaRows = buildMetadataRows(reportType, filters);
  const metaCsv = Papa.unparse(metaRows);
  const dataCsv = Papa.unparse(rows);

  const combined = `${metaCsv}\n\n${dataCsv}`;
  const timestamp = new Date().toISOString().slice(0, 10);
  triggerDownload(combined, `${reportType}-${timestamp}.csv`);
}
