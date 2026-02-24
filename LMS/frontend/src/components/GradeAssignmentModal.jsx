import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { CheckCircle, X, Award, FileText, Send, User } from 'lucide-react';
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-slide-up max-h-[95vh]">
          {/* Header */}
          <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 leading-tight">Grade Submission</h3>
                <div className="flex items-center gap-2 mt-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-sm text-slate-500 font-medium">Student: <span className="text-indigo-600 font-bold">{submissionToGrade.studentId?.name || 'N/A'}</span></p>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-95"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scrollbar-thin scrollbar-thumb-slate-200">
            {selectedAssignment.assignmentType === 'mcq' && submissionToGrade.answers && Array.isArray(submissionToGrade.answers) && (
              <div className="p-8 bg-slate-50/50 rounded-[2rem] border border-slate-100/50">
                <div className="flex items-center gap-2 mb-6 text-slate-400 font-black text-xs uppercase tracking-[0.2em]">
                  <FileText className="w-4 h-4" />
                  <span>Submission Review</span>
                </div>
                <div className="space-y-4">
                  {selectedAssignment.questions.map((q, qIndex) => (
                    <div key={qIndex} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-indigo-100">
                      <p className="text-sm font-bold text-slate-900 mb-3 leading-relaxed">
                        <span className="text-indigo-200 mr-2">#{qIndex + 1}</span>
                        {q.questionText}
                      </p>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50/50 rounded-lg border border-indigo-100 w-fit">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Response:</span>
                        <span className="text-sm font-black text-indigo-600">{submissionToGrade.answers[qIndex]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Display marking preference for theory assignments */}
            {selectedAssignment.assignmentType === 'theory' && selectedAssignment.questions[0]?.markingPreference && (
              <div className="flex items-center gap-3 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-0.5">Assessment Method</p>
                  <p className="text-sm font-bold text-slate-700">
                    {selectedAssignment.questions[0].markingPreference === 'ai' ? 'Advanced AI Optimized Grading' : 'Standard Manual Grading'}
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleGradeSubmission} className="space-y-8">
              {selectedAssignment.assignmentType === 'theory' && (
                <div className="space-y-6">
                  {selectedAssignment.questions.map((question, qIndex) => {
                    const studentAnswer = Array.isArray(submissionToGrade.answers) ? submissionToGrade.answers[qIndex] : '';
                    const currentQuestionGrade = questionGrades.find(qg => qg.questionIndex === qIndex) || { score: 0, feedback: '' };

                    return (
                      <div key={qIndex} className="p-8 rounded-[2.5rem] bg-white border-2 border-slate-50 shadow-sm transition-all hover:shadow-md">
                        <div className="flex items-start gap-4 mb-8">
                          <span className="w-10 h-10 shrink-0 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-indigo-100">
                            {qIndex + 1}
                          </span>
                          <p className="font-bold text-slate-900 text-lg leading-tight mt-1.5">{question.questionText}</p>
                        </div>

                        <div className="mb-8 p-6 bg-slate-900 rounded-[2rem] border border-slate-800 relative group overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-10">
                            <FileText className="w-12 h-12 text-white" />
                          </div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Student Response</p>
                          <p className="text-slate-200 whitespace-pre-wrap leading-relaxed font-medium">{studentAnswer || 'No response provided'}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Score (Max: {question.maxScore})</label>
                            <div className="relative">
                              <input
                                type="number"
                                value={currentQuestionGrade.score}
                                onChange={(e) => handleQuestionGradeChange(qIndex, 'score', parseInt(e.target.value) || 0)}
                                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl font-black text-xl text-primary focus:bg-white focus:border-primary transition-all pr-12"
                                min="0"
                                max={question.maxScore}
                                required
                              />
                              <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-slate-300">pts</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Feedback (Optional)</label>
                            <textarea
                              placeholder="Great work! Consider explaining..."
                              value={currentQuestionGrade.feedback}
                              onChange={(e) => handleQuestionGradeChange(qIndex, 'feedback', e.target.value)}
                              className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl font-bold text-slate-600 focus:bg-white focus:border-primary transition-all"
                              rows="2"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedAssignment.assignmentType === 'mcq' && (
                <div className="space-y-8">
                  <div className="p-6 bg-indigo-50/50 rounded-[2rem] border border-indigo-100 flex items-start gap-4">
                    <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shrink-0">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-indigo-900 text-lg">Auto-Graded System</h4>
                      <p className="text-sm text-indigo-600 font-medium leading-relaxed mt-1">
                        MCQ assignments are automatically evaluated based on perfect answers. Scores shown below are locked for review purposes.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Final Score</label>
                      <div className="px-5 py-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100 flex items-center justify-between">
                        <span className="text-4xl font-black text-primary">{submissionToGrade.score}</span>
                        <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px] bg-white px-3 py-1 rounded-full shadow-sm">Verified</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Overall Feedback</label>
                      <div className="px-5 py-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100 min-h-[100px]">
                        <p className="text-slate-600 font-bold leading-relaxed">{submissionToGrade.feedback || 'No automated feedback generated'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Footer */}
          <div className="p-8 bg-white border-t border-slate-50 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 rounded-2xl border-2 border-slate-100 font-black text-slate-400 hover:bg-slate-50 hover:text-slate-600 hover:border-slate-200 transition-all uppercase tracking-widest text-xs"
            >
              Discard Changes
            </button>
            {selectedAssignment.assignmentType === 'theory' && (
              <button
                onClick={handleGradeSubmission}
                className="flex-[2] btn-premium py-4 flex items-center justify-center gap-3 group shadow-xl shadow-primary/20"
              >
                <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                <span className="text-lg">Publish Final Grades</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GradeAssignmentModal;
