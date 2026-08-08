import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

export const formatPct = (val) => {
  const num = Number(val) || 0;
  return Number.isInteger(num) ? num.toString() : num.toFixed(1);
};

export async function exportReportSheetPDF(title, studentName, classData = []) {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Export Unavailable', 'File sharing is not supported on this device.');
      return;
    }

    const rowsHtml = classData.map((item) => {
      const className = item.className || item.name || 'Subject';
      const submitted = item.submittedCount ?? item.submitted ?? item.studentCount ?? 0;
      const total = item.totalAssignments ?? item.assignmentCount ?? 0;
      const rawScore = item.averagePercentage ?? item.overallAverage ?? item.avgScore ?? 0;
      const scoreFormatted = formatPct(rawScore);

      let badgeClass = 'badge-red';
      let badgeLabel = 'Needs Improvement';
      if (rawScore >= 80) {
        badgeClass = 'badge-green';
        badgeLabel = 'Excellent';
      } else if (rawScore >= 60) {
        badgeClass = 'badge-amber';
        badgeLabel = 'Good';
      }

      return `
        <tr>
          <td style="font-weight: 700;">${className}</td>
          <td>${submitted} ${total > 0 ? `/ ${total}` : ''}</td>
          <td style="font-weight: 700; color: #0f172a;">${scoreFormatted}%</td>
          <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title} - ${studentName}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px; color: #0f172a; background: #ffffff; line-height: 1.5; }
            .header { text-align: center; border-bottom: 3px solid #6366f1; padding-bottom: 20px; margin-bottom: 24px; }
            .brand { font-size: 22px; font-weight: 900; color: #4f46e5; letter-spacing: -0.5px; text-transform: uppercase; margin: 0; }
            .doc-title { font-size: 15px; font-weight: 700; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
            .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; }
            .meta-item { font-size: 13px; }
            .meta-label { color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; display: block; }
            .meta-val { font-size: 14px; font-weight: 800; color: #0f172a; }
            .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .table th { background: #4f46e5; color: #ffffff; text-align: left; padding: 12px 14px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
            .table td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
            .table tr:nth-child(even) { background: #f8fafc; }
            .badge { padding: 4px 10px; border-radius: 12px; font-weight: 800; font-size: 11px; text-transform: uppercase; display: inline-block; }
            .badge-green { background: #d1fae5; color: #047857; }
            .badge-amber { background: #fef3c7; color: #b45309; }
            .badge-red { background: #fee2e2; color: #b91c1c; }
            .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="brand">Gracified LMS</h1>
            <div class="doc-title">${title}</div>
          </div>

          <div class="meta-box">
            <div class="meta-item">
              <span class="meta-label">Name / Subject</span>
              <span class="meta-val">${studentName}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Date Generated</span>
              <span class="meta-val">${new Date().toLocaleDateString()}</span>
            </div>
          </div>

          <table class="table">
            <thead>
              <tr>
                <th>Classroom / Subject</th>
                <th>Tasks Completed</th>
                <th>Average Score</th>
                <th>Performance Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml.length > 0 ? rowsHtml : '<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">No academic records found</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
            <p>Generated automatically via Gracified LMS Mobile App • Official Digital Report</p>
          </div>
        </body>
      </html>
    `;

    const sanitizeName = (studentName || 'Academic').replace(/[^a-z0-9]/gi, '_');
    const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    const fileUri = `${baseDir}${sanitizeName}_Academic_Report.html`;

    await FileSystem.writeAsStringAsync(fileUri, htmlContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const shareOptions = {
      mimeType: 'text/html',
      dialogTitle: `Export ${title}`,
    };

    if (Platform.OS === 'ios') {
      shareOptions.UTI = 'public.html';
    }

    await Sharing.shareAsync(fileUri, shareOptions);
  } catch (err) {
    console.error('Export report error:', err);
    Alert.alert('Export Error', err?.message || 'Failed to generate report file. Please try again.');
  }
}
