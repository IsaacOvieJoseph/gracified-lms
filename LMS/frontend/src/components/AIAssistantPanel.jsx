import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, Loader2, Wand2, BookOpen, Clock, FileText, Presentation, ChevronDown, ChevronRight, Check, Copy, Download, Zap, Brain, School, HelpCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../utils/api';

// ── Modes ─────────────────────────────────────────────────────────────────────
const MODES = {
  topic: { label: 'Generate Topic', icon: BookOpen, color: 'from-violet-600 to-purple-600', endpoint: '/ai/generate-topic', resultKey: 'topic' },
  assignment: { label: 'Generate Assignment', icon: FileText, color: 'from-blue-600 to-indigo-600', endpoint: '/ai/generate-assignment', resultKey: 'assignment' },
  exam: { label: 'Generate Exam', icon: FileText, color: 'from-rose-600 to-pink-600', endpoint: '/ai/generate-exam', resultKey: 'exam' },
  classroom: { label: 'Generate Class', icon: School, color: 'from-emerald-600 to-teal-600', endpoint: '/ai/generate-classroom', resultKey: 'classroom' },
  powerpoint: { label: 'Generate Slides', icon: Presentation, color: 'from-amber-600 to-orange-600', endpoint: '/ai/generate-powerpoint', resultKey: 'presentation' },
  qna: { label: 'Q&A Assistant', icon: HelpCircle, color: 'from-amber-500 to-orange-500', endpoint: '/ai/qna-assistant', resultKey: 'qna' },
  syllabus: { label: 'Generate Syllabus', icon: BookOpen, color: 'from-indigo-600 to-blue-600', endpoint: '/ai/generate-syllabus', resultKey: 'syllabus' },
};

// ── Field component ───────────────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</label>
    {children}
  </div>
);

const inputCls = "w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl font-medium text-slate-700 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-900 focus:border-violet-400 outline-none transition-all text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600";

// ── Clipboard helper with textarea fallback ───────────────────────────────────
const copyToClipboard = async (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
  } else {
    // Fallback for non-HTTPS or browsers that block clipboard API
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    if (!ok) throw new Error('Copy failed');
  }
};


// ── Result display ────────────────────────────────────────────────────────────
const ResultViewer = ({ mode, result, onApply, onDownloadPptx, downloadingPptx }) => {
  const [expanded, setExpanded] = useState(true);

  if (mode === 'topic') {
    return (
      <div className="space-y-3 animate-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-violet-600 uppercase tracking-widest">✨ AI Generated Topic</h4>
          <button onClick={() => setExpanded(!expanded)} className="text-slate-400 hover:text-slate-600 transition-colors">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
        {expanded && (
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-200 dark:border-violet-800/50 rounded-2xl p-5 space-y-3">
            <p className="font-black text-slate-900 dark:text-white text-base">{result.name}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{result.description}</p>
            {result.lessonsOutline && (
              <div className="bg-white/70 dark:bg-slate-900/70 rounded-xl p-3 text-sm text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed border border-violet-100 dark:border-violet-800/30">
                {result.lessonsOutline}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-violet-600 font-bold">
              <span>⏱ Suggested: {result.duration?.value || 7} {result.duration?.mode || 'day'}(s)</span>
            </div>
          </div>
        )}
        <button
          onClick={() => onApply(result)}
          className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 dark:shadow-none"
        >
          <Check className="w-4 h-4" /> Apply to Form
        </button>
      </div>
    );
  }

  if (mode === 'syllabus') {
    const topics = result.topics || [];
    return (
      <div className="space-y-4 animate-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest">✨ AI Generated Syllabus</h4>
          <span className="text-[10px] font-bold text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded-full">{topics.length} Topics</span>
        </div>
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {topics.map((t, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-[10px] font-black text-indigo-600">
                  {idx + 1}
                </div>
                <p className="font-bold text-slate-900 dark:text-white text-sm">{t.name}</p>
                <div className="ml-auto flex items-center gap-1 text-[9px] font-black text-indigo-500 uppercase bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded-full">
                  <Clock className="w-2.5 h-2.5" />
                  {t.duration?.value || 7}{t.duration?.mode?.charAt(0) || 'd'}
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">{t.description}</p>
              {t.lessonsOutline && (
                <div className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg italic">
                  Outline: {t.lessonsOutline.substring(0, 100)}...
                </div>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={() => onApply(topics)}
          className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/20 dark:shadow-none"
        >
          <Sparkles className="w-4 h-4" /> Import Syllabus
        </button>
      </div>
    );
  }

  if (mode === 'assignment' || mode === 'exam') {
    const questions = result.questions || [];
    const color = mode === 'exam' ? 'rose' : 'blue';
    return (
      <div className="space-y-3 animate-in slide-in-from-bottom-4">
        <h4 className={`text-xs font-black text-${color}-600 uppercase tracking-widest`}>✨ AI Generated {mode === 'exam' ? 'Exam' : 'Assignment'}</h4>
        <div className={`bg-${color}-50 dark:bg-${color}-950/20 border border-${color}-200 dark:border-${color}-800/50 rounded-2xl p-4 space-y-3`}>
          <p className="font-black text-slate-900 dark:text-white">{result.title}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">{result.description}</p>
          <div className={`text-xs font-bold text-${color}-600 bg-${color}-100 px-3 py-1 rounded-full w-fit`}>
            {questions.length} Questions
          </div>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
          {questions.slice(0, 5).map((q, i) => (
            <div key={i} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Q{i + 1}: {q.questionText}</p>
              {q.options && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Options: {q.options.join(' / ')}</p>}
            </div>
          ))}
          {questions.length > 5 && <p className="text-[10px] text-slate-400 text-center">+{questions.length - 5} more questions</p>}
        </div>
        <button
          onClick={() => onApply(result)}
          className={`w-full py-3 bg-gradient-to-r from-${color}-600 to-${color}-700 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg`}
        >
          <Check className="w-4 h-4" /> Apply to Form
        </button>
      </div>
    );
  }

  if (mode === 'powerpoint') {
    const slides = result.slides || [];
    return (
      <div className="space-y-3 animate-in slide-in-from-bottom-4">
        <h4 className="text-xs font-black text-amber-600 uppercase tracking-widest">✨ AI Generated Presentation</h4>
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 space-y-2">
          <p className="font-black text-slate-900 dark:text-white">{result.presentationTitle}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">{result.subtitle}</p>
          <p className="text-xs font-bold text-amber-600 dark:text-amber-400">{slides.length} Slides</p>
        </div>
        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
          {slides.map((slide, i) => (
            <div key={i} className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded text-[9px] font-black flex items-center justify-center">{slide.slideNumber}</span>
                <p className="text-xs font-black text-slate-800 dark:text-slate-200">{slide.title}</p>
                <span className="ml-auto text-[8px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded">{slide.type}</span>
              </div>
              {slide.bulletPoints?.length > 0 && (
                <ul className="space-y-0.5 ml-7">
                  {slide.bulletPoints.map((bp, j) => (
                    <li key={j} className="text-[10px] text-slate-500 dark:text-slate-400 flex gap-1"><span className="text-amber-400">•</span>{bp}</li>
                  ))}
                </ul>
              )}
              {slide.speakerNotes && (
                <p className="text-[9px] text-slate-400 italic mt-1 ml-7 border-t border-slate-50 dark:border-slate-800 pt-1">📝 {slide.speakerNotes}</p>
              )}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={async () => {
              try {
                const title = result.presentationTitle || 'Presentation';
                const sub = result.subtitle ? `\n${result.subtitle}` : '';
                const text = slides.map(s =>
                  `SLIDE ${s.slideNumber}: ${s.title}\n${s.bulletPoints?.map(b => '• ' + b).join('\n') || ''}\n\nNotes: ${s.speakerNotes || ''}`
                ).join('\n\n---\n\n');
                
                const fullText = `${title}${sub}\n\n${text}`;
                await copyToClipboard(fullText);
                toast.success('Outline copied to clipboard!');
              } catch (err) {
                console.error('Copy failed:', err);
                toast.error('Could not copy. Try selecting and copying the text manually.');
              }
            }}
            className="py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
          >
            <Copy className="w-4 h-4" /> Copy <span className="hidden sm:inline">Outline</span>
          </button>
          <button
            onClick={() => onDownloadPptx(result)}
            disabled={downloadingPptx}
            className="py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
          >
            {downloadingPptx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download <span className="hidden sm:inline">.pptx</span>
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'classroom') {
    return (
      <div className="space-y-3 animate-in slide-in-from-bottom-4">
        <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest">✨ AI Generated Class Details</h4>
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-5 space-y-4">
          <div>
            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Class Name</p>
            <p className="font-black text-slate-900 dark:text-white">{result.name}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Description</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{result.description}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Learning Outcomes</p>
            <ul className="space-y-1">
              {(result.learningOutcomes || '').split(',').map((item, idx) => item.trim() && (
                <li key={idx} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <span>{item.trim()}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <button
          onClick={() => onApply(result)}
          className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg"
        >
          <Check className="w-4 h-4" /> Apply to Form
        </button>
      </div>
    );
  }

  if (mode === 'qna') {
    return (
      <div className="space-y-3 animate-in slide-in-from-bottom-4">
        <h4 className="text-xs font-black text-amber-600 uppercase tracking-widest">✨ AI Assistant Answer</h4>
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-5 space-y-4">
          <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed prose prose-slate dark:prose-invert max-w-none">
            {result.answer.split('\n').map((line, i) => <p key={i} className="mb-2">{line}</p>)}
          </div>
          {result.suggestedFollowUp && result.suggestedFollowUp.length > 0 && (
            <div className="pt-3 border-t border-amber-200 dark:border-amber-800/50">
              <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-2">Suggested Follow-ups</p>
              <div className="flex flex-wrap gap-2">
                {result.suggestedFollowUp.map((f, i) => (
                  <span key={i} className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 px-2 py-1 rounded-lg text-[10px] font-bold text-amber-700 dark:text-amber-400">{f}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={async () => {
            await copyToClipboard(result.answer);
            toast.success('Answer copied to clipboard!');
          }}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg"
        >
          <Copy className="w-4 h-4" /> Copy Answer
        </button>
      </div>
    );
  }

  return null;
};

// ── Main Panel ────────────────────────────────────────────────────────────────
const AIAssistantPanel = ({
  isOpen, onClose,
  allowedModes = ['topic', 'assignment', 'exam', 'powerpoint'],
  defaultMode = 'topic',
  prefill = {},
  onApply,
  onApplyTopic,
  onApplyAssignment,
  onApplyExam,
}) => {
  const [mode, setMode] = useState(defaultMode);
  const [loading, setLoading] = useState(false);
  const [downloadingPptx, setDownloadingPptx] = useState(false);
  const [result, setResult] = useState(null);
  const [provider, setProvider] = useState(null); // 'groq' | 'gemini'
  const [form, setForm] = useState({
    subject: prefill.subject || '',
    className: prefill.className || '',
    level: prefill.level || '',
    topicName: prefill.topicName || '',
    teacherHint: '',
    assignmentType: 'theory',
    examType: 'mcq',
    questionCount: 5,
    slideCount: 8,
    duration: 60,
    qnaQuestion: '',
  });

  const modeConfig = MODES[mode];

  // Fetch active provider once on open
  useEffect(() => {
    if (isOpen && !provider) {
      api.get('/ai/provider').then(r => setProvider(r.data.provider)).catch(() => {});
    }
  }, [isOpen]);

  // Sync form and mode with prefill when panel opens
  useEffect(() => {
    if (isOpen) {
      setMode(defaultMode);
      setForm({
        subject: prefill.subject || '',
        className: prefill.className || '',
        level: prefill.level || '',
        topicName: prefill.topicName || '',
        teacherHint: prefill.teacherHint || '',
        assignmentType: prefill.assignmentType || 'theory',
        examType: prefill.examType || 'mcq',
        questionCount: prefill.questionCount || 5,
        slideCount: prefill.slideCount || 8,
        duration: prefill.duration || 60,
        qnaQuestion: prefill.qnaQuestion || '',
      });
      setResult(null);
    }
  }, [isOpen, defaultMode]); // Sync when opening or when mode changes externally

  const handleDownloadPptx = async (presentationData) => {
    setDownloadingPptx(true);
    try {
      const res = await api.post('/ai/download-powerpoint', { presentation: presentationData }, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${presentationData.presentationTitle || 'Presentation'}.pptx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('PowerPoint downloaded!');
    } catch (err) {
      toast.error('Failed to generate PowerPoint file.');
    } finally {
      setDownloadingPptx(false);
    }
  };

  const handleGenerate = async () => {
    if (!form.subject && !form.topicName) {
      toast.error('Please enter a subject or topic name');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const payload = {
        className: form.className,
        subject: form.subject,
        level: form.level,
        topicName: form.topicName,
        teacherHint: form.teacherHint,
        assignmentType: form.assignmentType,
        examType: form.examType,
        questionCount: form.questionCount,
        slideCount: form.slideCount,
        duration: form.duration,
        question: form.qnaQuestion,
        description: prefill.description, // Added
        outcomes: prefill.outcomes,        // Added
        context: `${form.subject} ${form.topicName}`,
      };
      const res = await api.post(modeConfig.endpoint, payload);
      setResult(res.data[modeConfig.resultKey]);
      toast.success('AI content generated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'AI generation failed. Check GEMINI_API_KEY in server settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (data) => {
    let finalData = Array.isArray(data) ? [...data] : { ...data };
    
    // Ensure learning outcomes are a string if it's a classroom result
    if (mode === 'classroom' && Array.isArray(finalData.learningOutcomes)) {
      finalData.learningOutcomes = finalData.learningOutcomes.join(', ');
    }

    if (onApply) {
      onApply(finalData);
    } else {
      if (mode === 'topic' && onApplyTopic) onApplyTopic(finalData);
      if (mode === 'assignment' && onApplyAssignment) onApplyAssignment(finalData);
      if (mode === 'exam' && onApplyExam) onApplyExam(finalData);
      if (mode === 'classroom' && onApplyTopic) onApplyTopic(finalData);
    }
    toast.success('Applied successfully!');
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop — always covers the full viewport via portal */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" style={{ zIndex: 9998 }} onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-950 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-300 border-l dark:border-slate-800" style={{ zIndex: 9999 }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 p-6 text-white flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black">AI Assistant</h2>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-violet-200 font-bold uppercase tracking-widest">Powered by</p>
                  {provider === 'groq' && (
                    <span className="flex items-center gap-1 text-[10px] font-black text-white bg-violet-500/50 px-2 py-0.5 rounded-full">
                      <Zap className="w-2.5 h-2.5" /> Groq · LLaMA 3.3
                    </span>
                  )}
                  {provider === 'gemini' && (
                    <span className="flex items-center gap-1 text-[10px] font-black text-white bg-blue-500/50 px-2 py-0.5 rounded-full">
                      <Brain className="w-2.5 h-2.5" /> Google Gemini
                    </span>
                  )}
                  {!provider && <span className="text-[10px] text-violet-200 font-bold uppercase tracking-widest">AI</span>}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Tabs */}
          <div className="flex gap-2 flex-wrap">
            {allowedModes.map((m) => {
              const cfg = MODES[m];
              const Icon = cfg.icon;
              return (
                <button
                  key={m}
                  onClick={() => { setMode(m); setResult(null); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${mode === m ? 'bg-white text-violet-700 shadow-md' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                >
                  <Icon className="w-3 h-3" />
                  {cfg.label.replace('Generate ', '')}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Common fields */}
          <Field label="Subject / Topic Area">
            <input className={inputCls} placeholder="e.g. Mathematics, Biology, History..." value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
          </Field>

          {(mode !== 'topic' && mode !== 'classroom' && mode !== 'qna') && (
            <Field label="Topic Name (for context)">
              <input className={inputCls} placeholder="e.g. Photosynthesis, World War II..." value={form.topicName} onChange={e => setForm({ ...form, topicName: e.target.value })} />
            </Field>
          )}

          {(mode === 'qna') && (
            <Field label="Your Question">
              <textarea
                className={`${inputCls} resize-none`}
                rows={3}
                placeholder="Ask anything about the subject..."
                value={form.qnaQuestion}
                onChange={e => setForm({ ...form, qnaQuestion: e.target.value })}
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Class Name">
              <input className={inputCls} placeholder="e.g. JSS 2, Grade 10..." value={form.className} onChange={e => setForm({ ...form, className: e.target.value })} />
            </Field>
            <Field label="Level">
              <input className={inputCls} placeholder="e.g. Beginner, Advanced..." value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} />
            </Field>
          </div>

          {/* Mode-specific fields */}
          {(mode === 'assignment') && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select className={inputCls} value={form.assignmentType} onChange={e => setForm({ ...form, assignmentType: e.target.value })}>
                  <option value="theory">Theory</option>
                  <option value="mcq">MCQ</option>
                </select>
              </Field>
              <Field label="Questions">
                <input className={inputCls} type="number" min="1" max="20" value={form.questionCount} onChange={e => setForm({ ...form, questionCount: parseInt(e.target.value) || 5 })} />
              </Field>
            </div>
          )}

          {(mode === 'exam') && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <select className={inputCls} value={form.examType} onChange={e => setForm({ ...form, examType: e.target.value })}>
                    <option value="mcq">MCQ</option>
                    <option value="theory">Theory</option>
                  </select>
                </Field>
                <Field label="Questions">
                  <input className={inputCls} type="number" min="1" max="30" value={form.questionCount} onChange={e => setForm({ ...form, questionCount: parseInt(e.target.value) || 10 })} />
                </Field>
              </div>
              <Field label="Duration (mins)">
                <input className={inputCls} type="number" min="10" value={form.duration} onChange={e => setForm({ ...form, duration: parseInt(e.target.value) || 60 })} />
              </Field>
            </>
          )}

          {(mode === 'powerpoint') && (
            <Field label="Number of Slides">
              <input className={inputCls} type="number" min="3" max="20" value={form.slideCount} onChange={e => setForm({ ...form, slideCount: parseInt(e.target.value) || 8 })} />
            </Field>
          )}

          <Field label="Additional Notes (optional)">
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              placeholder="Any specific requirements, focus areas, or teaching style preferences..."
              value={form.teacherHint}
              onChange={e => setForm({ ...form, teacherHint: e.target.value })}
            />
          </Field>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:opacity-90 transition-all shadow-lg shadow-violet-500/20 dark:shadow-none flex items-center justify-center gap-3 disabled:opacity-60"
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</>
            ) : (
              <><Wand2 className="w-5 h-5" /> Generate with AI</>
            )}
          </button>

          {/* Result */}
          {result && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <ResultViewer mode={mode} result={result} onApply={handleApply} onDownloadPptx={handleDownloadPptx} downloadingPptx={downloadingPptx} />
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

export default AIAssistantPanel;
