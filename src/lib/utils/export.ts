/**
 * Helper utility to convert JSON array to CSV and trigger browser download
 */
export function exportToCSV<T extends object>(
  filename: string,
  data: T[],
  columns: { key: keyof T; label: string }[]
) {
  if (!data || data.length === 0) return;

  const headers = columns.map((c) => `"${c.label}"`).join(',');
  const rows = data.map((item) =>
    columns
      .map((c) => {
        const val = item[c.key];
        const formatted =
          val === null || val === undefined
            ? ''
            : typeof val === 'object'
            ? JSON.stringify(val).replace(/"/g, '""')
            : String(val).replace(/"/g, '""');
        return `"${formatted}"`;
      })
      .join(',')
  );

  const csvContent = [headers, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
