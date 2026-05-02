import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const SubmitAssignmentModal = ({ assignment, onClose, onSubmit, isSubmitting }) => {
  const [studentAnswers, setStudentAnswers] = useState(() => {
    if (assignment.assignmentType === 'mcq') {
      return Array(assignment.questions.length).fill('');
    } else if (assignment.assignmentType === 'theory') {
      return Array(assignment.questions.length).fill('');
    }
    return [];
  });

  const handleAnswerChange = (qIndex, value) => {
    setStudentAnswers(prevAnswers => {
      const newAnswers = [...prevAnswers];
      newAnswers[qIndex] = value;
      return newAnswers;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const allAnswered = studentAnswers.every(answer => {
      if (assignment.assignmentType === 'mcq') {
        return typeof answer === 'string' && answer.trim() !== '';
      } else if (assignment.assignmentType === 'theory') {
        return typeof answer === 'string' && answer.trim() !== '';
      }
      return false;
    });

    if (!allAnswered) {
      toast.error('Please answer all questions before submitting.');
      return;
    }

    onSubmit(assignment._id, studentAnswers);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl max-w-2xl w-full p-8 space-y-6 animate-slide-up border dark:border-slate-800">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white border-b dark:border-slate-800 pb-4">Submit: {assignment.title}</h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            {assignment.questions.map((question, qIndex) => (
              <div key={qIndex} className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <p className="font-bold text-slate-800 dark:text-slate-200 mb-4 tracking-tight leading-snug text-lg">Question {qIndex + 1}</p>
                <div className="text-slate-600 dark:text-slate-400 mb-4 whitespace-pre-wrap">{question.questionText}</div>

                {assignment.assignmentType === 'mcq' && (
                  <div className="grid grid-cols-1 gap-3">
                    {question.options.map((option, oIndex) => (
                      <label key={oIndex} className={`flex items-center p-4 rounded-2xl cursor-pointer transition-all border-2 ${studentAnswers[qIndex] === option ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-white dark:border-slate-800 hover:border-slate-100 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800 bg-white/50 dark:bg-slate-900/50'}`}>
                        <input
                          type="radio"
                          name={`mcq-question-${qIndex}`}
                          value={option}
                          checked={studentAnswers[qIndex] === option}
                          onChange={() => handleAnswerChange(qIndex, option)}
                          className="w-4 h-4 text-primary focus:ring-primary border-slate-300"
                        />
                        <span className={`ml-3 font-medium ${studentAnswers[qIndex] === option ? 'text-primary font-bold' : 'text-slate-600 dark:text-slate-300'}`}>{option}</span>
                      </label>
                    ))}
                  </div>
                )}
                {assignment.assignmentType === 'theory' && (
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Your Answer</label>
                    <textarea
                      value={studentAnswers[qIndex]}
                      onChange={(e) => handleAnswerChange(qIndex, e.target.value)}
                      placeholder="Enter your detailed response here..."
                      rows="6"
                      required
                    ></textarea>
                  </div>
                )}
              </div>
            ))}

            <div className="flex gap-4 pt-4 sticky bottom-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm -mx-8 -mb-8 p-8 border-t dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-premium flex-1"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Submit Assignment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SubmitAssignmentModal;
