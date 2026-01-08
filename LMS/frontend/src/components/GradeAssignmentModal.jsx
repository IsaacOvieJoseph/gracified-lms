import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

const GradeAssignmentModal = ({ show, onClose, onSubmitSuccess, selectedAssignment, submissionToGrade }) => {
  const [questionGrades, setQuestionGrades] = useState([]); // Array of { questionIndex, score, feedback }

  useEffect(() => {
    if (submissionToGrade && selectedAssignment) {
      const initialQuestionGrades = selectedAssignment.questions.map((q, qIndex) => {
        const existingGrade = submissionToGrade.questionScores?.find(qs => qs.questionIndex === qIndex);
        return {
          questionIndex: qIndex,
          score: existingGrade?.score || 0,
          feedback: existingGrade?.feedback || '',
        };
      });
      setQuestionGrades(initialQuestionGrades);
    }
  }, [submissionToGrade, selectedAssignment]);

  if (!show || !selectedAssignment || !submissionToGrade || questionGrades.length === 0) {
    return null;
  }

  const handleQuestionGradeChange = (qIndex, field, value) => {
    setQuestionGrades(prevGrades =>
      prevGrades.map((item, index) =>
        index === qIndex ? { ...item, [field]: value } : item
      )
    );
  };

  const handleGradeSubmission = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        studentId: submissionToGrade.studentId._id,
        questionScores: questionGrades.map(qg => ({
          questionIndex: qg.questionIndex,
          score: qg.score,
          feedback: qg.feedback,
        })),
      };

      // Client-side validation for scores (backend also validates)
      for (const qg of questionGrades) {
        const assignmentQuestion = selectedAssignment.questions[qg.questionIndex];
        if (qg.score < 0 || qg.score > assignmentQuestion.maxScore) {
          toast.error(`Score for question ${qg.questionIndex + 1} must be between 0 and ${assignmentQuestion.maxScore}.`);
          return;
        }
      }

      await api.put(`/assignments/${selectedAssignment._id}/grade-theory`, payload);

      toast.success('Theory assignment graded successfully!');
      onClose();
      onSubmitSuccess();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error grading assignment');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-6 overflow-y-auto max-h-[90vh]">
        <h3 className="text-xl font-bold mb-4">Grade Submission for "{selectedAssignment.title}"</h3>
        <p className="mb-4">Student: {submissionToGrade.studentId?.name || 'N/A'}</p>

        {selectedAssignment.assignmentType === 'mcq' && submissionToGrade.answers && Array.isArray(submissionToGrade.answers) && (
          <div className="mb-4 p-3 bg-gray-100 rounded-lg">
            <p className="font-medium text-gray-700 mb-2">Submitted Options:</p>
            <ul className="list-disc list-inside text-gray-800">
              {selectedAssignment.questions.map((q, qIndex) => (
                <li key={qIndex}>
                  <strong>Q{qIndex + 1}:</strong> {q.questionText} - Your Choice: {submissionToGrade.answers[qIndex]}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Display marking preference for theory assignments */}
        {selectedAssignment.assignmentType === 'theory' && selectedAssignment.questions[0]?.markingPreference && (
          <p className="mb-4 text-sm text-gray-600">
            Overall Marking Preference: <span className="font-semibold">{selectedAssignment.questions[0].markingPreference === 'ai' ? 'AI Marking (per question)' : 'Manual (per question)'}</span>
          </p>
        )}

        {/* Add display for files if available in submissionToGrade.files */}

        <form onSubmit={handleGradeSubmission} className="space-y-4">
          {selectedAssignment.assignmentType === 'theory' && (
            <div className="space-y-4">
              {selectedAssignment.questions.map((question, qIndex) => {
                const studentAnswer = Array.isArray(submissionToGrade.answers) ? submissionToGrade.answers[qIndex] : '';
                const currentQuestionGrade = questionGrades.find(qg => qg.questionIndex === qIndex) || { score: 0, feedback: '' };

                return (
                  <div key={qIndex} className="border p-4 rounded-lg bg-gray-50">
                    <p className="font-medium text-gray-800 mb-2">Q{qIndex + 1}: {question.questionText}</p>
                    <div className="mb-3 p-3 bg-white rounded-lg border">
                      <p className="font-medium text-gray-700 mb-1">Student's Answer:</p>
                      <p className="text-gray-800 whitespace-pre-wrap">{studentAnswer}</p>
                    </div>

                    {/* Score Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Score (Max: {question.maxScore})</label>
                      <input
                        type="number"
                        value={currentQuestionGrade.score}
                        onChange={(e) => handleQuestionGradeChange(qIndex, 'score', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border rounded-lg"
                        min="0"
                        max={question.maxScore}
                        required
                      />
                    </div>

                    {/* Feedback Input */}
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Feedback (Optional)</label>
                      <textarea
                        value={currentQuestionGrade.feedback}
                        onChange={(e) => handleQuestionGradeChange(qIndex, 'feedback', e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg"
                        rows="2"
                      ></textarea>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedAssignment.assignmentType === 'mcq' && (
            <div>
              <p className="text-sm text-blue-600 mb-4">MCQ assignments are auto-graded. You can review the submission but cannot manually change scores here.</p>
              {/* Optional: Display current overall score and feedback for MCQ if any */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Overall Score</label>
                <input
                  type="number"
                  value={submissionToGrade.score}
                  className="w-full px-4 py-2 border rounded-lg bg-gray-100 cursor-not-allowed"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Overall Feedback</label>
                <textarea
                  value={submissionToGrade.feedback || 'N/A'}
                  className="w-full px-4 py-2 border rounded-lg bg-gray-100 cursor-not-allowed"
                  rows="3"
                  readOnly
                ></textarea>
              </div>
            </div>
          )}

          <div className="flex space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            {(selectedAssignment.assignmentType === 'theory') && (
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Save Grades
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default GradeAssignmentModal;
