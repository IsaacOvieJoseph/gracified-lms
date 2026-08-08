import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

export const formatPct = (val) => {
  const num = Number(val) || 0;
  if (!Number.isFinite(num)) return '0';
  return Number.isInteger(num) ? num.toString() : num.toFixed(1);
};

export async function exportReportSheetPDF(title, studentName, classData = [], options = {}) {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Export Unavailable', 'File sharing is not supported on this device.');
      return;
    }

    const rowsHtml = classData.map((item) => {
      const className = item.className || item.name || 'Subject';
      const submitted = item.submittedCount ?? item.submitted ?? item.studentCount ?? item.assignmentsSubmitted ?? 0;
      const total = item.totalAssignments ?? item.assignmentCount ?? item.totalAssignmentsCount ?? 0;
      const rawScore = item.averagePercentage ?? item.overallAverage ?? item.avgScore ?? item.score ?? 0;
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

    const metaEntries = [];
    if (options.schoolName) metaEntries.push({ label: 'School', value: options.schoolName });
    if (options.className) metaEntries.push({ label: 'Class', value: options.className });
    if (options.studentName) metaEntries.push({ label: 'Student', value: options.studentName });
    if (options.reportType) metaEntries.push({ label: 'View', value: options.reportType });
    if (metaEntries.length === 0) {
      metaEntries.push({ label: 'Scope', value: studentName || 'General Report' });
    }

    const metaHtml = metaEntries.map((entry) => `
      <div class="meta-item">
        <span class="meta-label">${entry.label}</span>
        <span class="meta-val">${entry.value}</span>
      </div>
    `).join('');

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
            .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px; display: flex; flex-wrap: wrap; gap: 16px; }
            .meta-item { font-size: 13px; flex: 1 1 160px; min-width: 140px; }
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
            ${metaHtml}
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

    const safeStudentName = (studentName || 'student')
      .trim()
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '') || 'student';
    const dateStamp = new Date().toISOString().slice(0, 10);
    const exportDir = `${FileSystem.documentDirectory || FileSystem.cacheDirectory || ''}exports/`;
    const targetFileName = `Gracified_Report_${safeStudentName}_${dateStamp}.pdf`;
    const targetUri = `${exportDir}${targetFileName}`;

    await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });

    const { uri: generatedUri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
      width: 595,
      height: 842,
      margins: {
        left: 10,
        right: 10,
        top: 10,
        bottom: 10,
      },
      printFormatter: (html) => html,
    });

    await FileSystem.copyAsync({ from: generatedUri, to: targetUri });

    const shareOptions = {
      mimeType: 'application/pdf',
      dialogTitle: `Export ${title}`,
      UTI: 'com.adobe.pdf',
    };

    if (Platform.OS !== 'ios') {
      shareOptions.mimeType = 'application/pdf';
    }

    await Sharing.shareAsync(targetUri, shareOptions);
  } catch (err) {
    console.error('Export report error:', err);
    Alert.alert('Export Error', err?.message || 'Failed to generate report file. Please try again.');
  }
}

export async function exportExamReportPDF(exam, submissions = []) {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Export Unavailable', 'File sharing is not supported on this device.');
      return;
    }

    if (!exam || !submissions.length) {
      Alert.alert('No Exam Data', 'There are no submissions to export for this exam report.');
      return;
    }

    const totalMaxScore = (exam?.questions || []).reduce((acc, q) => acc + (q.maxScore || 1), 0) || 1;
    const scorePercent = (score, maxScore = totalMaxScore) => Math.round(((score || 0) / (maxScore || 1)) * 100);
    const formatDuration = (start, end) => {
      if (!start || !end) return 'N/A';
      const ms = new Date(end) - new Date(start);
      const mins = Math.floor(ms / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      return `${mins}m ${secs}s`;
    };
    const getObjAndTheoryScores = (submission) => {
      let objScore = 0;
      let theoryScore = 0;
      const examQuestions = exam?.questions || [];
      examQuestions.forEach((q, index) => {
        const ans = submission.answers?.find((a) => a.questionIndex === index) || submission.answers?.[index];
        const questionScore = Number(ans?.score || 0);
        if (q.questionType === 'mcq') {
          objScore += questionScore;
        } else if (q.questionType === 'theory') {
          theoryScore += questionScore;
        }
      });
      return { objScore, theoryScore };
    };

    const rowsHtml = submissions.map((submission) => {
      const { objScore, theoryScore } = getObjAndTheoryScores(submission);
      const candidateName = submission.studentId?.name || submission.candidateName || 'Guest Candidate';
      const email = submission.studentId?.email || submission.candidateEmail || 'N/A';
      const mode = submission.studentId ? 'Registered' : 'Guest';
      const submittedAt = submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : 'N/A';
      const timeSpent = formatDuration(submission.startedAt, submission.submittedAt);
      const percentage = `${scorePercent(submission.totalScore, totalMaxScore)}%`;

      return `
        <tr>
          <td>${candidateName}</td>
          <td>${email}</td>
          <td>${mode}</td>
          <td>${submittedAt}</td>
          <td>${timeSpent}</td>
          <td>${objScore}</td>
          <td>${theoryScore}</td>
          <td>${submission.totalScore || 0}</td>
          <td>${totalMaxScore}</td>
          <td>${percentage}</td>
        </tr>
      `;
    }).join('');

    const gradedSubmissions = submissions.filter((s) => s.status === 'graded' || (!exam?.questions?.some((q) => q.questionType === 'theory') && s.status === 'submitted'));
    const averageScore = gradedSubmissions.length > 0
      ? (gradedSubmissions.reduce((acc, curr) => acc + (curr.totalScore || 0), 0) / gradedSubmissions.length).toFixed(1)
      : '0';

    const examTitle = exam?.title || 'Exam Report';
    const safeExamName = (examTitle || 'exam_report')
      .trim()
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '') || 'exam_report';
    const dateStamp = new Date().toISOString().slice(0, 10);
    const exportDir = `${FileSystem.documentDirectory || FileSystem.cacheDirectory || ''}exports/`;
    const targetFileName = `Gracified_Exam_Report_${safeExamName}_${dateStamp}.pdf`;
    const targetUri = `${exportDir}${targetFileName}`;

    await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Examination Performance Report</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #0f172a; background: #ffffff; }
            .header { border-bottom: 3px solid #4f46e5; padding-bottom: 16px; margin-bottom: 18px; }
            .brand { font-size: 22px; font-weight: 900; color: #4f46e5; letter-spacing: -0.5px; text-transform: uppercase; margin: 0; }
            .title { font-size: 16px; font-weight: 800; color: #475569; margin-top: 6px; text-transform: uppercase; letter-spacing: 1px; }
            .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; margin-bottom: 18px; display: flex; flex-wrap: wrap; gap: 18px; }
            .meta-item { flex: 1 1 180px; min-width: 160px; }
            .meta-label { display: block; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; }
            .meta-value { display: block; font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #4f46e5; color: #ffffff; text-align: left; padding: 10px 8px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
            td { padding: 8px; font-size: 9px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
            tbody tr:nth-child(even) { background: #f8fafc; }
            .footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="brand">Gracified LMS</h1>
            <div class="title">Examination Performance Report</div>
          </div>

          <div class="meta-box">
            <div class="meta-item">
              <span class="meta-label">Exam Title</span>
              <span class="meta-value">${examTitle}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Class</span>
              <span class="meta-value">${exam?.classroomName || 'General'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Participants</span>
              <span class="meta-value">${submissions.length}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Average Score</span>
              <span class="meta-value">${averageScore}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Generated</span>
              <span class="meta-value">${new Date().toLocaleString()}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Candidate Name</th>
                <th>Email</th>
                <th>Mode</th>
                <th>Submitted At</th>
                <th>Time Spent</th>
                <th>OBJ Score</th>
                <th>Theory Score</th>
                <th>Score</th>
                <th>Total Points</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="10" style="text-align:center; padding:20px; color:#94a3b8;">No submissions available</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
            Powered by Gracified LMS
          </div>
        </body>
      </html>
    `;

    const { uri: generatedUri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
      width: 595,
      height: 842,
      margins: {
        left: 10,
        right: 10,
        top: 10,
        bottom: 10,
      },
      printFormatter: (html) => html,
    });

    await FileSystem.copyAsync({ from: generatedUri, to: targetUri });

    await Sharing.shareAsync(targetUri, {
      mimeType: 'application/pdf',
      dialogTitle: `Export ${examTitle}`,
      UTI: 'com.adobe.pdf',
    });
  } catch (err) {
    console.error('Exam export report error:', err);
    Alert.alert('Export Error', err?.message || 'Failed to generate exam report PDF.');
  }
}

