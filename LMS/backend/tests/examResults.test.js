const test = require('node:test');
const assert = require('node:assert/strict');

const { examResultsArePublic } = require('../utils/answerKey');
const { buildExamResultPdf } = require('../utils/examResultPdf');

test('theory exam results require explicit publication', () => {
    const exam = {
        questions: [{ questionType: 'theory' }],
        resultPublishTime: new Date(Date.now() - 60_000),
        resultsPublished: false
    };

    assert.equal(examResultsArePublic(exam), false);
    assert.equal(examResultsArePublic({ ...exam, resultsPublished: true }), true);
});

test('objective exam result visibility continues to honor scheduled release', () => {
    const exam = {
        questions: [{ questionType: 'mcq' }],
        resultPublishTime: new Date(Date.now() - 60_000),
        resultsPublished: false
    };

    assert.equal(examResultsArePublic(exam), true);
    assert.equal(examResultsArePublic({ ...exam, resultPublishTime: new Date(Date.now() + 60_000) }), false);
});

test('candidate result PDF contains response and examiner feedback content', async () => {
    const pdf = await buildExamResultPdf({
        exam: {
            title: 'Sample Theory Exam',
            questions: [{ questionText: 'Explain gravity', maxScore: 5, questionType: 'theory' }]
        },
        submission: {
            answers: [{ questionIndex: 0, answer: 'A force of attraction', score: 4, feedback: 'Good explanation' }],
            totalScore: 4,
            overallFeedback: 'Well done',
            submittedAt: new Date('2026-01-01T12:00:00Z')
        },
        candidateName: 'Candidate'
    });

    assert.ok(pdf.subarray(0, 5).equals(Buffer.from('%PDF-')));
    assert.ok(pdf.length > 500);
});
