import React, { useState, useEffect } from 'react';
import { Wand2, Loader2, Copy, Download, Clock, School, BookOpen, ClipboardList, FileText, Presentation, HelpCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../utils/api';
import Markdown from './Markdown';
import MathText from './MathText';

// ── Modes (guide: mobile AI Assistant screen) ─────────────────────────────────
const MODES = [
  { key: 'classroom', label: 'Class', icon: School, endpoint: '/ai/generate-classroom', resultKey: 'classroom' },
  { key: 'topic', label: 'Topic', icon: BookOpen, endpoint: '/ai/generate-topic', resultKey: 'topic' },
  { key: 'syllabus', label: 'Syllabus', icon: ClipboardList, endpoint: '/ai/generate-syllabus', resultKey: 'syllabus' },
  { key: 'assignment', label: 'Assignment', icon: FileText, endpoint: '/ai/generate-assignment', resultKey: 'assignment' },
  { key: 'exam', label: 'Exam', icon: FileText, endpoint: '/ai/generate-exam', resultKey: 'exam' },
  { key: 'slides', label: 'Slides', icon: Presentation, endpoint: '/ai/generate-powerpoint', resultKey: 'presentation' },
  { key: 'qna', label: 'Q&A', icon: HelpCircle, endpoint: '/ai/qna-assistant', resultKey: 'qna' },
];

const inputCls = "w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-sky-400 transition-all text-xs placeholder:text-slate-400 dark:placeholder:text-slate-600";

const copyToClipboard = async (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
  } else {
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

const GracyAssistTab = ({ prefill }) => {
  const [mode, setMode] = useState('classroom');
  const [loading, setLoading] = useState(false);
  const [downloadingPptx, setDownloadingPptx] = useState(false);
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({
    subject: '', topicName: '', className: '', level: '', teacherHint: '',
    assignmentType: 'theory', examType: 'mcq',
    questionCount: 5, slideCount: 8, duration: 60,
    question: '',
  });

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const switchMode = (key) => { setMode(key); setResult(null); };

  // Chat → Assist handoff: load a prefilled config and optionally run it.
  useEffect(() => {
    if (!prefill) return;
    const { mode: m, subject, topicName, questionCount, slideCount, question, autoGenerate } = prefill;
    setMode(m);
    setForm((prev) => ({
      ...prev,
      subject: subject || '',
      topicName: topicName || '',
      questionCount: questionCount || prev.questionCount,
      slideCount: slideCount || prev.slideCount,
      question: question || '',
    }));
    setResult(null);
    if (autoGenerate) {
      generate({
        mode: m,
        subject: subject || '',
        topicName: topicName || '',
        questionCount: questionCount || 5,
        slideCount: slideCount || 8,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  const generate = async (overrides = null) => {
    const values = overrides ? { ...form, ...overrides } : form;
    const activeKey = (overrides && overrides.mode) ? overrides.mode : mode;
    const cfg = MODES.find((m) => m.key === activeKey);

    if (activeKey === 'qna' && !String(values.question || '').trim()) {
      toast.error('Enter a question first.');
      return;
    }
    if (activeKey !== 'qna' && !String(values.subject || '').trim() && !String(values.topicName || '').trim()) {
      toast.error('Enter a subject or topic first.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const payload = {
        className: values.className,
        subject: values.subject,
        level: values.level,
        topicName: values.topicName,
        teacherHint: values.teacherHint,
        assignmentType: values.assignmentType,
        examType: values.examType,
        questionCount: Number(values.questionCount) || 5,
        slideCount: Number(values.slideCount) || 8,
        duration: Number(values.duration) || 60,
        question: values.question,
        context: `${values.subject} ${values.topicName}`.trim(),
      };
      const res = await api.post(cfg.endpoint, payload);
      setResult(res.data?.[cfg.resultKey] || res.data);
      toast.success('AI content generated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'AI generation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const downloadPptx = async () => {
    if (!result?.slides?.length || downloadingPptx) return;
    setDownloadingPptx(true);
    try {
      const res = await api.post('/ai/download-powerpoint', { presentation: result }, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.presentationTitle || 'Presentation'}.pptx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('PowerPoint downloaded!');
    } catch (err) {
      toast.error('Failed to generate the PowerPoint file.');
    } finally {
      setDownloadingPptx(false);
    }
  };

  const copyText = async (text) => {
    try {
      await copyToClipboard(text);
      toast.success('Copied to clipboard!');
    } catch (err) {
      toast.error('Could not copy. Try selecting the text manually.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50 custom-scrollbar">
      {/* Mode chips */}
      <div className="flex gap-1.5 flex-wrap">
        {MODES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => switchMode(key)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold tracking-wide transition-all border-2 ${
              mode === key
                ? 'bg-primary text-white border-primary'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Fields */}
      {mode === 'qna' ? (
        <Field label="Your question">
          <textarea
            className={`${inputCls} resize-none`}
            rows={3}
            placeholder="Ask an academic question..."
            value={form.question}
            onChange={(e) => setField('question', e.target.value)}
          />
        </Field>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Subject">
              <input className={inputCls} placeholder="e.g. Mathematics" value={form.subject} onChange={(e) => setField('subject', e.target.value)} />
            </Field>
            <Field label="Topic / focus">
              <input className={inputCls} placeholder="e.g. Quadratic equations" value={form.topicName} onChange={(e) => setField('topicName', e.target.value)} />
            </Field>
            <Field label="Class">
              <input className={inputCls} placeholder="e.g. Senior Secondary 2" value={form.className} onChange={(e) => setField('className', e.target.value)} />
            </Field>
            <Field label="Level">
              <input className={inputCls} placeholder="e.g. Beginner, Advanced" value={form.level} onChange={(e) => setField('level', e.target.value)} />
            </Field>
          </div>

          {(mode === 'assignment' || mode === 'exam') && (
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Type">
                <select
                  className={inputCls}
                  value={mode === 'assignment' ? form.assignmentType : form.examType}
                  onChange={(e) => setField(mode === 'assignment' ? 'assignmentType' : 'examType', e.target.value)}
                >
                  <option value="theory">Theory</option>
                  <option value="mcq">MCQ</option>
                </select>
              </Field>
              <Field label={mode === 'slides' ? 'Slides' : 'Questions'}>
                <input
                  className={inputCls}
                  type="number"
                  min="1"
                  max="30"
                  value={mode === 'slides' ? form.slideCount : form.questionCount}
                  onChange={(e) => setField(mode === 'slides' ? 'slideCount' : 'questionCount', e.target.value.replace(/[^0-9]/g, ''))}
                />
              </Field>
            </div>
          )}

          {mode === 'slides' && (
            <Field label="Number of slides">
              <input className={inputCls} type="number" min="3" max="20" value={form.slideCount} onChange={(e) => setField('slideCount', e.target.value.replace(/[^0-9]/g, ''))} />
            </Field>
          )}

          {mode === 'exam' && (
            <Field label="Duration (mins)">
              <input className={inputCls} type="number" min="10" value={form.duration} onChange={(e) => setField('duration', e.target.value.replace(/[^0-9]/g, ''))} />
            </Field>
          )}

          <Field label="Extra instructions (optional)">
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              placeholder="Learning goals, tone, or constraints"
              value={form.teacherHint}
              onChange={(e) => setField('teacherHint', e.target.value)}
            />
          </Field>
        </>
      )}

      {/* Generate button */}
      <button
        onClick={generate}
        disabled={loading}
        className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-xs tracking-wide hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-none disabled:opacity-60"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
        ) : (
          <><Wand2 className="w-4 h-4" /> Generate with AI</>
        )}
      </button>

      {/* Result */}
      {result && <ResultViewer mode={mode} result={result} onCopy={copyText} onDownloadPptx={downloadPptx} downloadingPptx={downloadingPptx} />}
    </div>
  );
};

const Field = ({ label, children }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">{label}</label>
    {children}
  </div>
);

const CopyButton = ({ text, label }) => (
  <button
    onClick={() => copyToClipboard(text).then(() => toast.success('Copied to clipboard!')).catch(() => toast.error('Could not copy. Try selecting the text manually.'))}
    className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-[11px] transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5 flex-1"
  >
    <Copy className="w-3.5 h-3.5" /> {label}
  </button>
);

const ResultViewer = ({ mode, result, onDownloadPptx, downloadingPptx }) => {
  if (mode === 'qna') {
    return (
      <div className="space-y-3 animate-in slide-in-from-bottom-4">
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
          <Markdown>{result.answer}</Markdown>
        </div>
        <CopyButton text={result.answer} label="Copy Answer" />
      </div>
    );
  }

  if (mode === 'slides') {
    const slides = result.slides || [];
    return (
      <div className="space-y-3 animate-in slide-in-from-bottom-4">
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4">
          <p className="font-semibold text-slate-900 dark:text-white text-sm">{result.presentationTitle}</p>
          {result.subtitle && <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{result.subtitle}</p>}
          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mt-2">{slides.length} Slides</p>
        </div>
        <div className="max-h-44 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {slides.map((slide, i) => (
            <div key={i} className="bg-white dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded text-[10px] font-semibold flex items-center justify-center shrink-0">{slide.slideNumber}</span>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">{slide.title}</p>
              </div>
              {slide.bulletPoints?.length > 0 && (
                <ul className="space-y-0.5 mt-1.5 pl-7">
                  {slide.bulletPoints.map((bp, j) => (
                    <li key={j} className="text-[11px] text-slate-500 dark:text-slate-400 flex gap-1"><span className="text-amber-400">•</span>{bp}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <CopyButton
            text={`${result.presentationTitle || 'Presentation'}${result.subtitle ? `\n${result.subtitle}` : ''}\n\n${slides.map((s) => `SLIDE ${s.slideNumber}: ${s.title}\n${s.bulletPoints?.map((b) => `• ${b}`).join('\n') || ''}${s.speakerNotes ? `\nNotes: ${s.speakerNotes}` : ''}`).join('\n\n---\n\n')}`}
            label="Copy Outline"
          />
          <button
            onClick={onDownloadPptx}
            disabled={downloadingPptx}
            className="px-3 py-2.5 bg-primary text-white rounded-xl font-semibold text-[11px] transition-all hover:opacity-90 flex items-center justify-center gap-1.5 flex-1 disabled:opacity-60"
          >
            {downloadingPptx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            .pptx
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'classroom') {
    return (
      <div className="space-y-3 animate-in slide-in-from-bottom-4">
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 space-y-2.5">
          <p className="font-semibold text-slate-900 dark:text-white text-sm">{result.name}</p>
          {result.description && <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{result.description}</p>}
          {(result.learningOutcomes || '').split(',').filter(Boolean).length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 tracking-wide mb-1 uppercase">Learning Outcomes</p>
              <ul className="space-y-1">
                {(result.learningOutcomes || '').split(',').map((item, idx) => item.trim() && (
                  <li key={idx} className="text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    {item.trim()}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <CopyButton text={`${result.name}\n\n${result.description || ''}\n\nLearning outcomes: ${result.learningOutcomes || ''}`} label="Copy Details" />
      </div>
    );
  }

  if (mode === 'syllabus') {
    const topics = result.topics || [];
    return (
      <div className="space-y-3 animate-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-primary tracking-wide">AI Generated Syllabus</p>
          <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{topics.length} Topics</span>
        </div>
        <div className="space-y-2 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
          {topics.map((t, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 bg-primary/10 text-primary rounded text-[10px] font-semibold flex items-center justify-center shrink-0">{idx + 1}</span>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{t.name}</p>
                {t.duration && <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full"><Clock className="w-2.5 h-2.5" />{t.duration.value || 7}{t.duration.mode?.charAt(0) || 'd'}</span>}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">{t.description}</p>
            </div>
          ))}
        </div>
        <CopyButton text={topics.map((t, i) => `${i + 1}. ${t.name} — ${t.description}${t.duration ? ` (${t.duration.value} ${t.duration.mode}(s))` : ''}`).join('\n')} label="Copy Syllabus" />
      </div>
    );
  }

  if (mode === 'topic') {
    return (
      <div className="space-y-3 animate-in slide-in-from-bottom-4">
        <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800/50 rounded-xl p-4 space-y-2.5">
          <p className="font-semibold text-slate-900 dark:text-white text-sm">{result.name}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{result.description}</p>
          {result.lessonsOutline && (
            <div className="bg-white/70 dark:bg-slate-900/70 rounded-xl p-3 text-[11px] text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed border border-violet-100 dark:border-violet-800/30">
              {result.lessonsOutline}
            </div>
          )}
          <p className="text-[11px] font-semibold text-primary flex items-center gap-1">
            <Clock className="w-3 h-3" /> Suggested: {result.duration?.value || 7} {result.duration?.mode || 'day'}(s)
          </p>
        </div>
        <CopyButton text={`${result.name}\n\n${result.description || ''}\n\nLesson outline:\n${result.lessonsOutline || ''}`} label="Copy Topic" />
      </div>
    );
  }

  if (mode === 'assignment' || mode === 'exam') {
    const questions = result.questions || [];
    const isExam = mode === 'exam';
    return (
      <div className="space-y-3 animate-in slide-in-from-bottom-4">
        <div className={`${isExam ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/50' : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/50'} border rounded-xl p-4 space-y-2`}>
          <p className="font-semibold text-slate-900 dark:text-white text-sm">{result.title}</p>
          {result.description && <p className="text-xs text-slate-600 dark:text-slate-400">{result.description}</p>}
          <div className="flex gap-2">
            <span className={`${isExam ? 'text-rose-600 bg-rose-100' : 'text-blue-600 bg-blue-100'} text-[10px] font-semibold px-2 py-0.5 rounded-full`}>{questions.length} Questions</span>
            {result.duration && (
              <span className={`${isExam ? 'text-rose-600 bg-rose-100' : 'text-blue-600 bg-blue-100'} text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1`}>
                <Clock className="w-2.5 h-2.5" /> {result.duration} Mins
              </span>
            )}
          </div>
        </div>
        <div className="max-h-44 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {questions.slice(0, 5).map((q, i) => (
            <div key={i} className="bg-white dark:bg-slate-800/70 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Q{i + 1}: <MathText text={q.questionText} /></p>
              {q.options?.length > 0 && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Options: {q.options.map((opt, idx) => <span key={idx}>{idx > 0 && ' / '}<MathText text={opt} /></span>)}</p>}
            </div>
          ))}
          {questions.length > 5 && <p className="text-[11px] text-slate-400 text-center">+{questions.length - 5} more questions</p>}
        </div>
        <CopyButton text={`${result.title}\n\n${result.description || ''}\n\n${questions.map((q, i) => `Q${i + 1}. ${q.questionText}${q.options?.length ? ` (${q.options.join(' / ')})` : ''}`).join('\n')}`} label="Copy Content" />
      </div>
    );
  }

  return null;
};

export default GracyAssistTab;