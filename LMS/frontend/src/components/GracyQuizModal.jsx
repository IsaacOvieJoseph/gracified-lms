import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import api from '../utils/api';
import Markdown from './Markdown';
import MathText from './MathText';

const GracyQuizModal = ({ quizConfig, onClose, onNewQuiz }) => {
  const [generating, setGenerating] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const generate = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await api.post('/ai/tutor/quiz', {
        subject: quizConfig.subjects?.join(', ') || '',
        level: quizConfig.levels?.join(', ') || '',
        area: quizConfig.topics?.join(', ') || '',
        general: quizConfig.general,
        questionCount: quizConfig.questionCount
      });
      setQuiz({
        sessionId: res.data.sessionId,
        quizIndex: res.data.quizIndex,
        title: res.data.title,
        questions: res.data.questions,
        pickedTopics: res.data.pickedTopics || []
      });
      setAnswers(new Array(res.data.questions.length).fill(''));
      setResult(null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not generate a quiz. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    generate();
  }, []);

  const submit = async () => {
    const unanswered = answers.filter((a) => !a).length;
    if (unanswered > 0) {
      if (!window.confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`)) {
        return;
      }
    }
    
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/ai/tutor/quiz/submit', {
        sessionId: quiz.sessionId,
        quizIndex: quiz.quizIndex,
        answers,
      });
      setResult(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not submit the quiz. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60  flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-950 rounded-xl shadow-none w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Practice with Gracy</h2>
            {quiz && (
              <p className="text-sm text-slate-500 mt-1">
                {quiz.title} {quizConfig.general ? '(General)' : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!result && !generating && (
              <button 
                onClick={generate}
                disabled={submitting}
                className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
                title="Regenerate Quiz"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar">
          {generating ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-sky-500">
              <Loader2 className="w-10 h-10 animate-spin" />
              <p className="font-medium text-slate-600 dark:text-slate-400">Preparing your quiz...</p>
            </div>
          ) : error && !quiz ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <p className="text-red-500 text-center">{error}</p>
              <button 
                onClick={generate}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : quiz ? (
            <div className="max-w-2xl mx-auto space-y-8">
              
              {/* Results Card */}
              {result && (
                <div className="bg-primary/10 dark:bg-sky-900/20 border border-primary/20 dark:border-sky-800 rounded-xl p-6 text-center animate-in slide-in-from-top-4">
                  <div className="text-4xl font-semibold text-primary dark:text-primary mb-2">
                    {result.score} <span className="text-xl text-primary/50">/ {result.total}</span>
                  </div>
                  <p className="font-semibold text-primary dark:text-sky-300 mb-4">
                    {Math.round((result.score / result.total) * 100)}% correct
                  </p>
                  {result.summaryFeedback && (
                    <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed max-w-lg mx-auto">
                      {result.summaryFeedback}
                    </p>
                  )}
                  <div className="mt-6">
                    <button 
                      onClick={onNewQuiz}
                      className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold shadow-none transition-all active:scale-95"
                    >
                      New Quiz
                    </button>
                  </div>
                </div>
              )}

              {/* Questions */}
              <div className="space-y-6">
                {quiz.questions.map((q, qIndex) => {
                  const review = result?.perQuestion?.[qIndex];
                  const isReviewed = !!review;
                  const isCorrect = review?.isCorrect;

                  return (
                    <div key={qIndex} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-none">
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex gap-3">
                        <span className="text-slate-400 select-none">{qIndex + 1}.</span>
                        <span><MathText text={q.questionText} /></span>
                      </h3>
                      
                      <div className="space-y-3 pl-7">
                        {q.options.map((option, oIndex) => {
                          const selected = answers[qIndex] === option;
                          
                          let optClass = "flex items-start gap-3 p-3 rounded-xl border transition-all text-left w-full ";
                          let icon = null;

                          if (isReviewed) {
                            if (option === review.correct) {
                              optClass += "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 font-medium";
                              icon = <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />;
                            } else if (selected) {
                              optClass += "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200";
                              icon = <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />;
                            } else {
                              optClass += "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 opacity-60";
                              icon = <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0 mt-0.5" />;
                            }
                          } else {
                            if (selected) {
                              optClass += "bg-primary/10 dark:bg-sky-900/20 border-primary/40 dark:border-primary/50 text-primary dark:text-sky-200 font-medium ring-1 ring-sky-500";
                              icon = <div className="w-5 h-5 rounded-full border-4 border-sky-500 shrink-0 mt-0.5" />;
                            } else {
                              optClass += "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary/40 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer";
                              icon = <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0 mt-0.5" />;
                            }
                          }

                          return (
                            <button
                              key={oIndex}
                              disabled={isReviewed}
                              onClick={() => {
                                const newAnswers = [...answers];
                                newAnswers[qIndex] = option;
                                setAnswers(newAnswers);
                              }}
                              className={optClass}
                            >
                              {icon}
                              <span className="leading-relaxed"><MathText text={option} /></span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      {isReviewed && review.explanation && (
                        <div className={`mt-5 p-4 rounded-xl ml-7 border ${
                          isCorrect 
                            ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900' 
                            : 'bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900'
                        }`}>
                          <h4 className={`text-xs font-semibold mb-1 ${
                            isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            Explanation
                          </h4>
                          <div className="text-sm text-slate-700 dark:text-slate-300 prose prose-sm dark:prose-invert">
                            <Markdown>{review.explanation}</Markdown>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Error & Submit */}
              {!result && (
                <div className="pt-4 pb-8 flex flex-col items-center">
                  {error && <p className="text-red-500 mb-4">{error}</p>}
                  <button
                    onClick={submit}
                    disabled={submitting}
                    className="w-full max-w-sm py-3.5   hover:from-sky-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-none transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
                    ) : (
                      'Submit Quiz'
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default GracyQuizModal;
