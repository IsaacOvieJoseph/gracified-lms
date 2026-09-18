import React, { useState, useEffect, useRef } from 'react';
import { Wand2, Loader2, Copy, Download, Clock, School, BookOpen, ClipboardList, FileText, Presentation, HelpCircle, Send, ChevronDown, Sparkles } from 'lucide-react';
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

// ── Conversational Assist flow (shared by the Assist tab + the chat tab) ─────
// Step order per task. Every non-Q&A task asks for the subject first, then an
// (optional, skippable) topic. Assignment / exam / slides end with one extras
// question. Users may also paste ALL details in one message — the parser
// extracts counts/types/duration, and Gracy only asks for what's missing.
const ASSIST_FEED = {
  classroom: ['subject', 'topicName'],
  topic: ['subject', 'topicName'],
  syllabus: ['subject', 'topicName'],
  assignment: ['subject', 'topicName', 'extra'],
  exam: ['subject', 'topicName', 'extra'],
  slides: ['subject', 'topicName', 'extra'],
  qna: ['question'],
};

const flowStepFilled = (step, c) => {
  switch (step) {
    case 'subject': return !!(c.subject && String(c.subject).trim());
    case 'topicName': return !!c.topicName || c.topicSkipped === true;
    case 'extra': return c.extrasDone === true || !!(c.questionCount || c.slideCount || c.duration || c.assignmentType || c.examType || c.teacherHint);
    case 'question': return !!(c.question && String(c.question).trim());
    default: return true;
  }
};

const flowQuestion = (type, step, collected) => {
  const meta = MODES.find((m) => m.key === type);
  const label = meta?.label || type;
  switch (step) {
    case 'subject':
      if (collected.topicName) {
        return { text: `Great start — **${collected.topicName}**. Which **subject** does that fall under? _(e.g. Biology)_`, chips: ['Mathematics', 'English', 'Biology', 'Physics'] };
      }
      return { text: `First — which **subject** is this **${label}** for?`, chips: ['Mathematics', 'English', 'Biology', 'Physics'] };
    case 'topicName':
      return { text: `Nice — **${collected.subject}**! Any specific **topic** to focus on? *(reply \`skip\` and I'll pick something suitable)*`, chips: ['Skip — pick for me'] };
    case 'extra':
      if (type === 'slides') return { text: 'Almost there — how many **slides** should I make? *(reply `go` for my default of 8)*', chips: ['10 slides', '8', 'go'] };
      if (type === 'assignment') return { text: 'Almost there — any preferences on **questions** or **MCQ vs theory**? *(reply `go` for my default: 5 theory questions)*', chips: ['10 questions', 'MCQ', 'theory', 'go'] };
      return { text: 'Almost there — any preferences on **questions**, **MCQ vs theory**, or a **time limit**? *(reply `go` for my default: 10 MCQs, 60 mins)*', chips: ['10 questions', 'MCQ', 'theory', 'go'] };
    case 'question':
      return { text: "Of course — what's your **question**? I'll explain it thoroughly.", chips: [] };
    default:
      return { text: '', chips: [] };
  }
};

// Pull concrete details (counts, type, duration, class level, topic phrase) out
// of a free-form reply so a user can type everything in one go.
const parseAssistInfo = (text) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  const info = {};
  const countMatch = t.match(/\b(\d{1,2})\s*(questions?|q|qs|slides?)\b/i);
  if (countMatch) {
    const n = Math.min(30, Math.max(1, parseInt(countMatch[1], 10)));
    if (/slide/i.test(countMatch[2])) info.slideCount = n;
    else info.questionCount = n;
  }
  const durMatch = t.match(/\b(\d{1,3})\s*(minutes?|mins?|min|hours?|hrs?)\b/i);
  if (durMatch) {
    info.duration = Math.min(300, Math.max(5, parseInt(durMatch[1], 10))) * (/h/i.test(durMatch[2]) ? 60 : 1);
  }
  const typeMatch = t.match(/\b(mcq|multiple[ -]?choice|objective|theory|essay)\b/i);
  if (typeMatch) info.type = /mcq|multiple|objective/i.test(typeMatch[1]) ? 'mcq' : 'theory';
  const classMatch = t.match(/\b(?:for|class|level)\s+([A-Za-z0-9]{1,4}(?:\s?[A-Za-z0-9]+)?)\b(?=\s*(?:questions?|mcq|theory|$))/i);
  if (classMatch) info.className = classMatch[1].trim();
  const topicPhrase = t.match(/\b(?:on|about)\s+([a-zA-Z0-9'’][a-zA-Z0-9'’ -]{0,60}?)(?=\s+(?:questions?|mcq|theory|for|with|and|,)|$)/i);
  info.topicPhrase = topicPhrase ? topicPhrase[1].trim() : null;
  const cleaned = t
    .replace(/\b(\d{1,2})\s*(questions?|q|qs|slides?)\b/gi, ' ')
    .replace(/\b(\d{1,3})\s*(minutes?|mins?|min|hours?|hrs?)\b/gi, ' ')
    .replace(/\b(mcq|multiple[ -]?choice|objective|theory|essay)\b/gi, ' ')
    .replace(/\b(create|generate|make|build|draft|prepare|write|produce|design|develop|please|could you|can you|for me|me a|me an|i'd like|i want|give me)\b/gi, ' ')
    .replace(/\b(on|about|for|with|and|a|an|the|of|to)\b/gi, ' ')
    .replace(/[?!.,;:"'()]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
  info.clean = cleaned;
  return info;
};

const buildAssistPayload = (flow) => {
  const c = flow.collected;
  const type = flow.type;
  return {
    className: c.className || '',
    subject: c.subject || '',
    level: c.level || '',
    topicName: c.topicName || '',
    teacherHint: c.teacherHint || '',
    assignmentType: c.assignmentType || 'theory',
    examType: c.examType || 'mcq',
    questionCount: c.questionCount || (type === 'assignment' ? 5 : 10),
    slideCount: c.slideCount || 8,
    duration: c.duration || 60,
    question: c.question || '',
    context: [c.subject, c.topicName, c.className].filter(Boolean).join(' ').trim(),
  };
};

const advanceFlowStep = (flow) => {
  const feed = ASSIST_FEED[flow.type] || [];
  let i = flow.stepIndex;
  while (i < feed.length) {
    if (!flowStepFilled(feed[i], flow.collected)) return i;
    i += 1;
  }
  return -1;
};

const applyStepAnswer = (flow, step, text, parsed) => {
  const c = flow.collected;
  const trimmed = String(text || '').trim();
  switch (step) {
    case 'question':
      c.question = trimmed.replace(/[?!.,]+$/g, '').trim();
      break;
    case 'subject': {
      const isDismiss = /^(skip|go|pass|next|no)\b/i.test(trimmed);
      if (parsed.topicPhrase) {
        c.topicName = parsed.topicPhrase;
      } else if (!isDismiss && parsed.clean) {
        c.subject = parsed.clean.replace(/[?!.,]+$/g, '').trim().slice(0, 60);
      }
      if (!c.subject && !parsed.topicPhrase && !isDismiss) {
        const raw = trimmed.replace(/[?!.,]+$/g, '').trim();
        if (raw) c.subject = raw.slice(0, 60);
      }
      break;
    }
    case 'topicName':
      if (/^(skip|go|no|none|any)\b/i.test(trimmed)) {
        c.topicSkipped = true;
      } else if (parsed.topicPhrase) {
        c.topicName = parsed.topicPhrase;
      } else if (parsed.clean) {
        c.topicName = parsed.clean.slice(0, 60);
      } else {
        c.topicSkipped = true;
      }
      break;
    case 'extra':
      if (!/^(go|ok|done|yes|skip|no|that's it|thats it)\b/i.test(trimmed)) {
        c.teacherHint = [c.teacherHint, parsed.clean || parsed.topicPhrase || ''].filter(Boolean).join(' ');
      }
      c.extrasDone = true;
      break;
    default:
      break;
  }
};

// ── Task cards (bigger, tappable) — shared by the chat tab ────────────────────
const TASK_TONES = {
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300',
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300',
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const ASSIST_TASKS = [
  { key: 'classroom', title: 'Create a Class', blurb: 'Overview, outcomes & structure', tone: 'emerald' },
  { key: 'topic', title: 'Break Down a Topic', blurb: 'Description + lesson outline', tone: 'violet' },
  { key: 'syllabus', title: 'Map a Syllabus', blurb: 'Term & weekly topic plan', tone: 'sky' },
  { key: 'assignment', title: 'Draft an Assignment', blurb: 'Questions + marking guide', tone: 'blue' },
  { key: 'exam', title: 'Build an Exam', blurb: 'Full exam + answer key', tone: 'rose' },
  { key: 'slides', title: 'Design Slides', blurb: 'Editable .pptx deck', tone: 'amber' },
  { key: 'qna', title: 'Ask a Question', blurb: 'Clear, explained answer', tone: 'slate' },
];

const TaskCards = ({ onPick }) => {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? ASSIST_TASKS : ASSIST_TASKS.slice(0, 4);
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2 shadow-none">
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">What should I create for you?</p>
        <Wand2 className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {visible.map((task) => {
          const meta = MODES.find((m) => m.key === task.key);
          const Icon = meta?.icon || Sparkles;
          return (
            <button
              key={task.key}
              onClick={() => onPick(task.key)}
              className="flex items-center gap-2.5 text-left rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-2.5 hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-[0.98]"
            >
              <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${TASK_TONES[task.tone]}`}>
                <Icon className="w-4 h-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight">{task.title}</span>
                <span className="block text-[10px] text-slate-400 dark:text-slate-500 leading-tight truncate mt-0.5">{task.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>
      {ASSIST_TASKS.length > 4 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-0.5 px-0.5"
        >
          {showAll ? 'Show fewer tasks' : `+${ASSIST_TASKS.length - 4} more tasks`}
          <ChevronDown className={`w-3 h-3 transition-transform ${showAll ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
};

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

const CopyButton = ({ text, label }) => (
  <button
    onClick={() => copyToClipboard(text).then(() => toast.success('Copied to clipboard!')).catch(() => toast.error('Could not copy. Try selecting the text manually.'))}
    className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-[11px] transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5 flex-1"
  >
    <Copy className="w-3.5 h-3.5" /> {label}
  </button>
);

// ── Result rendering (shared by the Assist tab + the chat tab) ───────────────
const ResultViewer = ({ mode, result }) => {
  const [downloadingPptx, setDownloadingPptx] = useState(false);

  const downloadPptx = async () => {
    const slides = result?.slides || [];
    if (!slides.length || downloadingPptx) return;
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
            onClick={downloadPptx}
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
        </div>
        {questions.length > 5 && <p className="text-[11px] text-slate-400 text-center">+{questions.length - 5} more questions</p>}
        <CopyButton text={`${result.title}\n\n${result.description || ''}\n\n${questions.map((q, i) => `Q${i + 1}. ${q.questionText}${q.options?.length ? ` (${q.options.join(' / ')})` : ''}`).join('\n')}`} label="Copy Content" />
      </div>
    );
  }

  return null;
};

// ── Main Assist component (conversational, matching the chat flow) ───────────
const GracyAssistTab = ({ prefill }) => {
  // { type, collected: {}, stepIndex } | null
  const [flow, setFlow] = useState(null);
  // [{ role: 'user' | 'assistant', content?, type?, result?, chips?, isError? }]
  const [convo, setConvo] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const threadRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [convo, loading]);

  // Chat → Assist handoff: start a flow from a prefilled config (legacy).
  useEffect(() => {
    if (!prefill) return;
    const { mode: m, subject, topicName, questionCount, slideCount, question, autoGenerate } = prefill;
    const seed = {};
    if (subject) seed.subject = subject;
    if (topicName) seed.topicName = topicName;
    if (questionCount) seed.questionCount = questionCount;
    if (slideCount) seed.slideCount = slideCount;
    if (question) seed.question = question;
    const f = { type: m, collected: { ...seed }, stepIndex: 0 };
    setFlow(f);
    setConvo([{
      role: 'assistant',
      content: `Happy to help! Let's craft a **${MODES.find((x) => x.key === m)?.label || m}** ✨`,
    }]);
    if (autoGenerate) generateFromFlow(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  const beginFlow = (type) => {
    const seed = {};
    const f = { type, collected: seed, stepIndex: 0 };
    setFlow(f);
    setConvo([]);
    const meta = MODES.find((m) => m.key === type);
    const q = flowQuestion(type, 0, seed);
    setConvo([{
      role: 'assistant',
      content: `Happy to help! Let's craft a **${meta?.label || type}** ✨\n\nYou can answer question by question, or **paste in everything at once** — like \`10 MCQ questions on quadratic equations for SS2\` — and I'll take it from there.\n\n${q.text}`,
      chips: q.chips,
    }]);
    if (inputRef.current) inputRef.current.focus();
  };

  const generateFromFlow = async (f) => {
    setLoading(true);
    try {
      const meta = MODES.find((m) => m.key === f.type);
      const payload = buildAssistPayload(f);
      const res = await api.post(meta.endpoint, payload);
      const result = res.data?.[meta.resultKey] || res.data;
      const { subject, topicName, question } = f.collected;
      setConvo((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: f.type === 'qna'
            ? `Here's your answer to **"${question || 'that'}"**:`
            : `Done — here's your **${meta.label}**${subject ? ` for **${subject}**` : ''}${topicName ? ` · *${topicName}*` : ''}:`,
          type: f.type,
          result,
        },
        { role: 'assistant', content: 'Nice one! Pick another task above any time, or keep chatting. ✨' },
      ]);
      setFlow(null);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Sorry, the AI could not generate that. Please try again.';
      toast.error(errMsg);
      setConvo((prev) => [...prev, { role: 'assistant', content: errMsg, isError: true }]);
    } finally {
      setLoading(false);
    }
  };

  const processFlowReply = async (f, text) => {
    const feed = ASSIST_FEED[f.type] || [];
    const idx = f.stepIndex;
    if (idx >= feed.length) {
      await generateFromFlow(f);
      return;
    }
    const step = feed[idx];
    const parsed = parseAssistInfo(text);

    // Merge anything concrete we can auto-detect from the whole reply.
    if (parsed.questionCount) f.collected.questionCount = parsed.questionCount;
    if (parsed.slideCount) f.collected.slideCount = parsed.slideCount;
    if (parsed.duration) f.collected.duration = parsed.duration;
    if (parsed.type) {
      f.collected.assignmentType = parsed.type;
      f.collected.examType = parsed.type;
    }
    if (parsed.className) f.collected.className = parsed.className;

    applyStepAnswer(f, step, text, parsed);
    f.stepIndex += 1;

    const next = advanceFlowStep(f);
    if (next === -1) {
      await generateFromFlow(f);
      return;
    }
    f.stepIndex = next;
    const q = flowQuestion(f.type, feed[next], f.collected);
    setFlow({ ...f });
    setConvo((prev) => [...prev, { role: 'assistant', content: q.text, chips: q.chips }]);
  };

  const handleSend = async (e, text = null) => {
    if (e) e.preventDefault();
    const value = (text || input).trim();
    if (!value || loading) return;
    setInput('');
    if (!flow) {
      toast('Pick a task above to begin.');
      return;
    }
    if (/^(cancel|stop|never mind|start over)\b/i.test(value)) {
      setFlow(null);
      setConvo((prev) => [...prev, { role: 'assistant', content: 'No problem — pick another task above whenever you\'re ready.' }]);
      return;
    }
    setConvo((prev) => [...prev, { role: 'user', content: value }]);
    await processFlowReply(flow, value);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header when a flow is active */}
      {flow && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 bg-white dark:bg-slate-950">
          <p className="text-[11px] font-semibold text-primary flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5" /> Creating: {MODES.find((m) => m.key === flow.type)?.label || flow.type}
          </p>
          <button
            onClick={() => { setFlow(null); setConvo([]); }}
            className="text-[10px] font-semibold text-slate-400 hover:text-primary transition-colors"
          >
            New task
          </button>
        </div>
      )}

      {/* Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50 custom-scrollbar" ref={threadRef}>
        {!flow && (
          <div className="space-y-4">
            <TaskCards onPick={beginFlow} />
            {convo.length > 0 && (
              <button
                onClick={() => setConvo([])}
                className="w-full text-[10px] font-semibold text-slate-400 hover:text-primary transition-colors"
              >
                Clear conversation
              </button>
            )}
          </div>
        )}

        {convo.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl p-3 ${
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-br-none'
                  : msg.isError
                  ? 'bg-red-50 dark:bg-red-950/30 text-red-600 border border-red-200 dark:border-red-800 rounded-bl-none'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none shadow-none'
              }`}
            >
              <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                {msg.role === 'user' ? msg.content : <Markdown>{msg.content}</Markdown>}
              </div>

              {msg.result && (
                <div className="mt-3">
                  <ResultViewer mode={msg.type} result={msg.result} />
                </div>
              )}

              {msg.chips && msg.chips.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {msg.chips.map((chip, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(null, chip)}
                      disabled={loading}
                      className="text-xs bg-primary/10 dark:bg-sky-900/30 text-primary dark:text-primary border border-primary/20 dark:border-primary/30 px-2 py-1.5 rounded-xl hover:bg-primary/20 dark:hover:bg-sky-900/50 transition-colors text-left disabled:opacity-50"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <form onSubmit={handleSend} className="flex items-center gap-2 p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex-shrink-0">
        <input
          ref={inputRef}
          className="flex-1 px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 disabled:opacity-50"
          placeholder={flow ? 'Your answer… (or paste everything at once)' : 'Pick a task above to begin'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(e); } }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="w-9 h-9 bg-primary text-white rounded-xl flex items-center justify-center transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
};

export default GracyAssistTab;
// Shared pieces used by the Gracy chat (task cards + conversational flow)
export { MODES, ResultViewer, copyToClipboard, TaskCards, ASSIST_TASKS, TASK_TONES, ASSIST_FEED, flowStepFilled, flowQuestion, parseAssistInfo, buildAssistPayload, advanceFlowStep, applyStepAnswer };