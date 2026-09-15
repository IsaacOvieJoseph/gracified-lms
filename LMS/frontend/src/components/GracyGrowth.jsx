import React, { useState, useEffect } from 'react';
import { TrendingUp, Sparkles, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import api from '../utils/api';


const GracyGrowth = ({ access }) => {
  const [loading, setLoading] = useState(true);
  const [growth, setGrowth] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/ai/tutor/progress');
      setGrowth(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not load your growth report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-sky-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Analyzing your progress...</p>
      </div>
    );
  }

  if (error && !growth) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 gap-4 text-center">
        <AlertCircle className="w-12 h-12 text-slate-300 dark:text-slate-700" />
        <p className="text-sm text-slate-500">{error}</p>
        <button 
          onClick={load}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const m = growth?.metrics || {};
  
  const metricCards = [
    { label: 'Topics studied', value: m.topicsStudied ?? 0 },
    { label: 'Topics completed', value: m.topicsCompleted ?? 0 },
    { label: 'Video completion', value: m.averageVideoCompletion ?? null, suffix: '%' },
    { label: 'Assignments avg', value: m.assignmentAverage ?? null, suffix: '%' },
    { label: 'Exams avg', value: m.examAverage ?? null, suffix: '%' },
    { label: 'AI quizzes avg', value: m.aiQuizAverage ?? null, suffix: '%' },
  ].filter(c => c.value !== null);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-slate-50 dark:bg-slate-900/50 custom-scrollbar">
      {/* Quota Banner */}
      {access && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex justify-between items-center shadow-none">
          <span className="text-xs font-semibold text-slate-500 tracking-wider">Daily Quota</span>
          <span className="text-sm font-semibold text-primary dark:text-primary">
            {access.remaining} <span className="text-slate-400">/ {access.dailyLimit} remaining</span>
          </span>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {metricCards.map((card, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-none flex flex-col justify-center">
            <span className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
              {card.value}{card.suffix || ''}
            </span>
            <span className="text-xs font-medium text-slate-500 mt-1 line-clamp-1" title={card.label}>
              {card.label}
            </span>
          </div>
        ))}
      </div>

      {/* Growth Summary */}
      {growth?.summary && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-none">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
            <TrendingUp className="w-4 h-4 text-sky-500" />
            Your Growth
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {growth.summary}
          </p>
        </div>
      )}

      {/* Next Step */}
      {growth?.nextStep && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 shadow-none">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-400 mb-2">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            Recommended Next Step
          </h4>
          <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium leading-relaxed">
            {growth.nextStep}
          </p>
        </div>
      )}
      
      <div className="pb-4 pt-2 flex justify-center">
        <button 
          onClick={load}
          className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Refresh Data
        </button>
      </div>
    </div>
  );
};

export default GracyGrowth;
