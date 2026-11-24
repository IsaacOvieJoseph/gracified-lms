const PDFDocument = require('pdfkit');

const formatPdfText = (value, fallback = 'No response') => {
    if (value === null || value === undefined || value === '') return fallback;
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/[–—]/g, '-')
        .replace(/…/g, '...')
        .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?');
};

const buildExamResultPdf = ({ exam, submission, candidateName }) => new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const maxScore = exam.questions.reduce((total, question) => total + (question.maxScore || 1), 0);
    const percentage = maxScore > 0 ? Math.round((submission.totalScore / maxScore) * 100) : 0;

    doc.font('Helvetica-Bold').fontSize(20).fillColor('#1D3557').text('Exam Result and Feedback');
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(11).fillColor('#14202E')
        .text(`Exam: ${formatPdfText(exam.title)}`)
        .text(`Candidate: ${formatPdfText(candidateName)}`)
        .text(`Submitted: ${submission.submittedAt ? new Date(submission.submittedAt).toLocaleString('en-GB') : 'N/A'}`)
        .text(`Final score: ${submission.totalScore} / ${maxScore} (${percentage}%)`);
    doc.moveDown();

    exam.questions.forEach((question, index) => {
        const answer = submission.answers.find(item => item.questionIndex === index);
        const answerText = formatPdfText(answer?.answer);

        doc.font('Helvetica-Bold').fontSize(12).fillColor('#1D3557')
            .text(`Question ${index + 1} (${answer?.score || 0} / ${question.maxScore || 1})`);
        doc.moveDown(0.2);
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#14202E').text('Question');
        doc.font('Helvetica')        .text(formatPdfText(question.questionText, 'Question unavailable'));
        doc.moveDown(0.25);
        doc.font('Helvetica-Bold').text('Candidate response');
        doc.font('Helvetica').text(answerText);
        doc.moveDown(0.25);
        doc.font('Helvetica-Bold').text('Examiner feedback');
        doc.font('Helvetica')        .text(formatPdfText(answer?.feedback, 'No feedback provided'));
        doc.moveDown(0.8);
    });

    doc.font('Helvetica-Bold').fontSize(12).fillColor('#1D3557').text('Overall examiner comment');
    doc.moveDown(0.25);
    doc.font('Helvetica').fontSize(10).fillColor('#14202E')
        .text(formatPdfText(submission.overallFeedback, 'No overall feedback provided'));
    doc.end();
});

module.exports = { buildExamResultPdf };
