import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Send, Loader2, MessageSquare, Bot, TrendingUp,
  ClipboardList, ChevronDown, Plus, Minus, Wand2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../utils/api';
import Markdown from './Markdown';
import { useLocation } from 'react-router-dom';
import GracyQuizModal from './GracyQuizModal';
import GracyGrowth from './GracyGrowth';
import GracyAssistTab, {
  MODES, ResultViewer, TaskCards,
  ASSIST_FEED, flowStepFilled, flowQuestion, parseAssistInfo, buildAssistPayload, advanceFlowStep, applyStepAnswer,
} from './GracyAssistTab';
import { fetchTeacherClasses } from '../utils/gracyPrefill';
import {
  isPracticeRequest,
  extractPracticeArea,
  extractPracticeQuantityFromMessage,
  isQuantityOnly,
  extractAssistIntent,
} from '../utils/tutor';

// ── Multi-Select Dropdown ────────────────────────────────────────────────────
const MultiSelect = ({ options, value, onChange, placeholder, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (opt) => {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-700 dark:text-slate-300 hover:border-sky-400 transition-colors disabled:opacity-50"
      >
        <span className="truncate text-left">
          {value.length === 0
            ? <span className="text-slate-400">{placeholder}</span>
            : value.join(', ')}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && options.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-none max-h-48 overflow-y-auto custom-scrollbar">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <input
                type="checkbox"
                checked={value.includes(opt)}
                onChange={() => toggle(opt)}
                className="w-4 h-4 accent-sky-500 rounded"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Practice Setup Panel ──────────────────────────────────────────────────────
const PracticeSetup = ({ onStartQuiz }) => {
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [options, setOptions] = useState({ subjects: [], levels: [], topics: [] });
  const [mode, setMode] = useState('custom'); // 'custom' | 'general'
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [selectedLevels, setSelectedLevels] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [questionCount, setQuestionCount] = useState(5);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [classRes, topicsRes] = await Promise.all([
          api.get('/classrooms'),
          api.get('/topics/user/all').catch(() => ({ data: [] })),
        ]);
        const classrooms = classRes.data.classrooms || classRes.data || [];
        const topics = Array.isArray(topicsRes.data) ? topicsRes.data : [];
        setOptions({
          subjects: [...new Set(classrooms.map((c) => c.subject).filter(Boolean))],
          levels: [...new Set(classrooms.map((c) => c.level).filter(Boolean))],
          topics: [...new Set(topics.map((t) => t.name).filter(Boolean))],
        });
      } catch (_) {}
      finally { setLoadingOptions(false); }
    };
    fetchOptions();
  }, []);

  const handleStart = () => {
    const quizConfig = {
      general: mode === 'general',
      subjects: selectedSubjects,
      levels: selectedLevels,
      topics: selectedTopics,
      questionCount,
    };
    onStartQuiz(quizConfig);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
      <div className="space-y-4">
        {/* Mode Toggle */}
        <div>
          <p className="text-xs font-semibold text-slate-500 tracking-wider mb-2">Quiz Mode</p>
          <div className="flex gap-2">
            {[
              { key: 'custom', label: '🎯 Custom' },
              { key: 'general', label: '🌐 General' },
            ].map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`flex-1 py-2 px-3 text-sm font-semibold rounded-xl border transition-all ${
                  mode === m.key
                    ? 'bg-primary text-white border-sky-500 shadow-none'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary/40'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {mode === 'general'
              ? 'Gracy picks broadly for a mixed practice.'
              : 'Choose specific subjects, difficulty levels, and topics.'}
          </p>
        </div>

        {/* Custom Mode Options */}
        {mode === 'custom' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 tracking-wider block mb-1.5">
                Subjects
              </label>
              {loadingOptions ? (
                <div className="h-10 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
              ) : (
                <MultiSelect
                  options={options.subjects}
                  value={selectedSubjects}
                  onChange={setSelectedSubjects}
                  placeholder="All subjects"
                />
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 tracking-wider block mb-1.5">
                Difficulty / Level
              </label>
              {loadingOptions ? (
                <div className="h-10 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
              ) : (
                <MultiSelect
                  options={options.levels}
                  value={selectedLevels}
                  onChange={setSelectedLevels}
                  placeholder="All levels"
                />
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 tracking-wider block mb-1.5">
                Topics
              </label>
              {loadingOptions ? (
                <div className="h-10 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
              ) : (
                <MultiSelect
                  options={options.topics}
                  value={selectedTopics}
                  onChange={setSelectedTopics}
                  placeholder="All topics"
                />
              )}
            </div>
          </div>
        )}

        {/* Question Count */}
        <div>
          <label className="text-xs font-semibold text-slate-500 tracking-wider block mb-2">
            Number of Questions
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuestionCount((c) => Math.max(1, c - 1))}
              className="w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-sky-400 transition-colors"
            >
              <Minus className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
            <div className="flex-1 text-center">
              <span className="text-2xl font-semibold text-slate-800 dark:text-slate-200">{questionCount}</span>
              <span className="text-xs text-slate-400 ml-1">questions</span>
            </div>
            <button
              onClick={() => setQuestionCount((c) => Math.min(20, c + 1))}
              className="w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-sky-400 transition-colors"
            >
              <Plus className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStart}
          className="w-full py-3 bg-primary text-white rounded-xl font-semibold shadow-none hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
        >
          <ClipboardList className="w-5 h-5" />
          Start Practice Quiz
        </button>
      </div>
    </div>
  );
};

// ── Chat Panel ──────────────────────────────────────────────────────────────
const ChatPanel = ({ messages, isLoading, onSend, inputValue, setInputValue, messagesEndRef, isStudent, onPickTask }) => {
  const inputRef = useRef(null);

  // Auto-grow the textarea as long input wraps to multiple lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [inputValue]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() && !isLoading) onSend();
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50 custom-scrollbar">
        {!isStudent && (
          <div className="space-y-4">
            <TaskCards onPick={onPickTask} />
          </div>
        )}
        {messages.map((msg, idx) => (
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

              {msg.assistResult && msg.assistResult.result && (
                <div className="mt-3">
                  <ResultViewer mode={msg.assistResult.type} result={msg.assistResult.result} prefillMeta={msg.assistMeta} />
                </div>
              )}

              {msg.suggestedFollowUp && msg.suggestedFollowUp.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {msg.suggestedFollowUp.map((followUp, i) => (
                    <button
                      key={i}
                      onClick={() => onSend(null, followUp)}
                      className="text-xs bg-primary/10 dark:bg-sky-900/30 text-primary dark:text-primary border border-primary/20 dark:border-primary/30 px-2 py-1.5 rounded-xl hover:bg-primary/20 dark:hover:bg-sky-900/50 transition-colors text-left"
                    >
                      {followUp}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl rounded-bl-none p-4 shadow-none flex items-center gap-2 text-sky-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs font-medium">Gracy is typing...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
        <form
          onSubmit={onSend}
          className="flex items-end gap-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 pr-2 focus-within:ring-2 ring-sky-400 transition-shadow-none"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question or 'quiz me on...'..."
            className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400 resize-none overflow-y-auto max-h-[120px] leading-relaxed"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="w-8 h-8 flex items-center justify-center bg-primary text-white rounded-xl disabled:opacity-50 disabled:bg-slate-300 hover:bg-primary/90 transition-colors shrink-0"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
      </div>
    </>
  );
};

// ── Role-aware copy helpers ───────────────────────────────────────────────────
const isStudent = (user) => user?.role === 'student';
const gracyLabel = (user) => (isStudent(user) ? 'AI Study Partner' : 'AI Assistant');

const getIntroMessage = (user) => {
  if (isStudent(user)) {
    return "Hi! I'm **Gracy**, your AI study partner. 👋\n\nI can:\n- **Answer questions** about any topic\n- **Quiz you** — just say *\"quiz me on photosynthesis\"*\n- **Track your progress** in the Growth tab\n\nWhat shall we work on today?";
  }
  return "Hi! I'm **Gracy**, your AI assistant. 👋\n\nPick a **task card** above, or just ask me in chat — for example:\n- *\"Create an assignment on fractions for SS1\"*\n- *\"Write an exam on cell division\"*\n- *\"Make slides for the water cycle\"*\n\nI'll ask you a couple of quick questions and generate it right here. What can I help you with today?";
};

// ── Main GracyChat Component ─────────────────────────────────────────────────
const GracyChatInner = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [access, setAccess] = useState({ enabled: true, loading: true, remaining: 0, dailyLimit: 20 });
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  // Quiz Modal state
  const [quizModal, setQuizModal] = useState(null); // { quizConfig } | null

  // Conversational Assist flow (non-student chat → in-chat info gathering)
  // { type, collected: {}, stepIndex } | null
  const assistFlow = useRef(null);

  // Pending practice (NLP: waiting for question count)
  const pendingPractice = useRef(null);

  // Dragging state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0, hasMoved: false });
  const fabRef = useRef(null);
  const messagesEndRef = useRef(null);
  const location = useLocation();

  // ── Per-user session storage ──
  // Keyed by the logged-in user so that someone else logging in on the same
  // browser/device never sees (or inherits) this user's chat history.
  const storageKey = `gracy_chat_state_${user?._id || user?.id || user?.email || 'anonymous'}`;

  useEffect(() => {
    const savedState = sessionStorage.getItem(storageKey);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setMessages(parsed.messages || []);
        setSessionId(parsed.sessionId || null);
        if (parsed.isOpen) setIsOpen(parsed.isOpen);
        if (parsed.activeTab) setActiveTab(parsed.activeTab);
      } catch (_) {}
    } else {
      setMessages([{ role: 'assistant', content: getIntroMessage(user) }]);
    }
    checkAccess();
  }, []);

  useEffect(() => {
    if (!access.loading && access.enabled) {
      sessionStorage.setItem(storageKey, JSON.stringify({ messages, sessionId, isOpen, activeTab }));
    }
  }, [messages, sessionId, isOpen, activeTab, access.loading, access.enabled]);

  useEffect(() => {
    if (isOpen && activeTab === 'chat' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, activeTab]);

  // Close the widget when Gracy navigates the teacher to a create form.
  useEffect(() => {
    const onNavigated = () => setIsOpen(false);
    window.addEventListener('gracy:navigated', onNavigated);
    return () => window.removeEventListener('gracy:navigated', onNavigated);
  }, []);

  const checkAccess = async () => {
    try {
      const res = await api.get('/ai/tutor/access');
      setAccess({ ...res.data, loading: false });
    } catch (_) {
      setAccess({ enabled: false, loading: false });
    }
  };

  // ── Conversational Assist flow (in-chat info gathering) ──
  const startAssistFlow = (type, initialArea = null) => {
    const flow = { type, collected: {}, stepIndex: 0 };
    if (initialArea) {
      // A request typed in chat may already carry most details ("10 mcq on
      // photosynthesis for SS2") — seed them so Gracy only asks what's missing.
      const parsed = parseAssistInfo(initialArea);
      if (parsed.questionCount) flow.collected.questionCount = parsed.questionCount;
      if (parsed.slideCount) flow.collected.slideCount = parsed.slideCount;
      if (parsed.duration) flow.collected.duration = parsed.duration;
      if (parsed.type) {
        flow.collected.assignmentType = parsed.type;
        flow.collected.examType = parsed.type;
      }
      if (parsed.className) flow.collected.className = parsed.className;
      if (parsed.topicPhrase) {
        flow.collected.topicName = parsed.topicPhrase;
      } else {
        flow.collected.subject = String(initialArea).replace(/[?!.,]+$/g, '').trim().slice(0, 60);
      }
    }
    assistFlow.current = flow;

    const meta = MODES.find((m) => m.key === type);
    const q = flowQuestion(type, flow.stepIndex, flow.collected);
    setIsLoading(false);
    setMessages((prev) => [...prev, {
      role: 'assistant',
      content: `Happy to help! Let's craft a **${meta?.label || type}** ✨\n\nYou can answer question by question, or **paste in everything at once** — like \`10 MCQ questions on quadratic equations for SS2\` — and I'll take it from there.\n\n${q.text}`,
      suggestedFollowUp: q.chips,
    }]);
  };

  const generateFromFlow = async (flow) => {
    setIsLoading(true);
    try {
      const meta = MODES.find((m) => m.key === flow.type);
      const payload = buildAssistPayload(flow);
      const res = await api.post(meta.endpoint, payload);
      const result = res.data?.[meta.resultKey] || res.data;
      const { subject, topicName, question, classroomId, classroomName } = flow.collected;
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: flow.type === 'qna'
          ? `Here's your answer to **"${question || 'that'}"**:`
          : `Done — here's your **${meta.label}**${subject ? ` for **${subject}**` : ''}${topicName ? ` · *${topicName}*` : ''}:`,
        assistResult: { type: flow.type, result },
        assistMeta: classroomId ? { classroomId, classroomName } : null,
      }]);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Sorry, the AI could not generate that. Please try again.';
      setMessages((prev) => [...prev, { role: 'assistant', content: errMsg, isError: true }]);
      toast.error(errMsg);
    } finally {
      assistFlow.current = null;
      setIsLoading(false);
    }
  };

  const processAssistReply = async (flow, text) => {
    const feed = ASSIST_FEED[flow.type] || [];
    const idx = flow.stepIndex;
    if (idx >= feed.length) {
      await generateFromFlow(flow);
      return;
    }
    const step = feed[idx];
    const parsed = parseAssistInfo(text);

    // Merge anything concrete we can auto-detect from the whole reply.
    if (parsed.questionCount) flow.collected.questionCount = parsed.questionCount;
    if (parsed.slideCount) flow.collected.slideCount = parsed.slideCount;
    if (parsed.duration) flow.collected.duration = parsed.duration;
    if (parsed.type) {
      flow.collected.assignmentType = parsed.type;
      flow.collected.examType = parsed.type;
    }
    if (parsed.className) flow.collected.className = parsed.className;

    let ctx = {};
    if (step === 'pickClass') ctx = { classes: await fetchTeacherClasses(user?._id) };

    applyStepAnswer(flow, step, text, parsed, ctx);

    // Topic/syllabus MUST land in a class — if the teacher skipped it, re-ask.
    if (
      step === 'pickClass'
      && !flow.collected.classroomId
      && (flow.type === 'topic' || flow.type === 'syllabus')
      && ctx.classes.length > 0
    ) {
      const again = flowQuestion(flow.type, step, flow.collected, ctx);
      setIsLoading(false);
      setMessages((prev) => [...prev, { role: 'assistant', content: "A **topic** needs a class to be saved into. Pick one of the classes below, or type its name.", suggestedFollowUp: again.chips }]);
      return;
    }

    flow.stepIndex += 1;

    const next = advanceFlowStep(flow);
    if (next === -1) {
      await generateFromFlow(flow);
      return;
    }
    flow.stepIndex = next;
    if (feed[next] === 'pickClass') ctx = { classes: await fetchTeacherClasses(user?._id) };
    const q = flowQuestion(flow.type, feed[next], flow.collected, ctx);
    setIsLoading(false);
    setMessages((prev) => [...prev, { role: 'assistant', content: q.text, suggestedFollowUp: q.chips }]);
  };

  // ── Message sending with NLP quiz + conversational assist detection ──
  const handleSendMessage = async (e, text = null) => {
    if (e) e.preventDefault();
    const messageText = text || inputValue;
    if (!messageText.trim() || isLoading) return;

    setInputValue('');
    setMessages((prev) => [...prev, { role: 'user', content: messageText }]);
    setIsLoading(true);

    // Check for pending practice (awaiting question count)
    if (pendingPractice.current) {
      const qty = extractPracticeQuantityFromMessage(messageText);
      if (qty || isQuantityOnly(messageText)) {
        const count = qty || parseInt(messageText, 10) || 5;
        const area = pendingPractice.current.area;
        pendingPractice.current = null;
        setIsLoading(false);
        setQuizModal({ quizConfig: { general: !area, topics: area ? [area] : [], subjects: [], levels: [], questionCount: count } });
        return;
      }
      pendingPractice.current = null;
    }

    // Conversational Assist reply (Gracy asked a question; this is the answer).
    if (assistFlow.current) {
      const flow = assistFlow.current;
      if (/^(cancel|stop|never mind|start over)\b/i.test(messageText)) {
        assistFlow.current = null;
        setIsLoading(false);
        setMessages((prev) => [...prev, { role: 'assistant', content: 'No problem — what else can I help you with?' }]);
        return;
      }
      await processAssistReply(flow, messageText);
      return;
    }

    // Check for practice request via NLP
    if (isPracticeRequest(messageText)) {
      const area = extractPracticeArea(messageText);
      const qty = extractPracticeQuantityFromMessage(messageText);
      if (qty) {
        setIsLoading(false);
        setQuizModal({ quizConfig: { general: !area, topics: area ? [area] : [], subjects: [], levels: [], questionCount: qty } });
        return;
      }
      // Ask for how many questions
      pendingPractice.current = { area };
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: area
          ? `Great! How many questions would you like for your **${area}** practice quiz? *(1–20)*`
          : 'Sure! How many questions would you like? *(1–20)*',
        suggestedFollowUp: ['5 questions', '10 questions', '15 questions'],
      }]);
      setIsLoading(false);
      return;
    }

    // Conversational assist request (staff): gather missing info in chat.
    if (!isStudent(user)) {
      const assist = extractAssistIntent(messageText);
      if (assist) {
        startAssistFlow(assist.type, assist.area || null);
        return;
      }
    }

    // Normal chat
    try {
      const res = await api.post('/ai/tutor/chat', {
        question: messageText,
        sessionId,
        context: `${isStudent(user) ? 'Student' : 'User'} is currently on page: ${location.pathname}`,
      });
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: res.data.answer,
        suggestedFollowUp: res.data.suggestedFollowUp,
      }]);
      if (res.data.sessionId && !sessionId) setSessionId(res.data.sessionId);
      // Update remaining quota
      setAccess((prev) => ({ ...prev, remaining: Math.max(0, (prev.remaining || 1) - 1) }));
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Sorry, I encountered an error. Please try again.';
      setMessages((prev) => [...prev, { role: 'assistant', content: errMsg, isError: true }]);
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Drag handlers ──
  const handlePointerMove = useCallback((e) => {
    if (!isDragging.current) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    const deltaX = clientX - dragStartPos.current.x;
    const deltaY = clientY - dragStartPos.current.y;

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) dragStartPos.current.hasMoved = true;
    dragStartPos.current.x = clientX;
    dragStartPos.current.y = clientY;

    setPosition((prev) => {
      const fabSize = 64;
      let newX = prev.x + deltaX;
      let newY = prev.y + deltaY;
      const minX = -(window.innerWidth - fabSize - 24);
      const minY = -(window.innerHeight - fabSize - 24);
      if (newX < minX) newX = minX;
      if (newX > 0) newX = 0;
      if (newY < minY) newY = minY;
      if (newY > 0) newY = 0;
      return { x: newX, y: newY };
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
  }, [handlePointerMove]);

  const handlePointerDown = useCallback((e) => {
    if (e.button !== undefined && e.button !== 0) return;
    isDragging.current = true;
    dragStartPos.current = { x: e.clientX, y: e.clientY, hasMoved: false };
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [handlePointerMove, handlePointerUp]);

  if (access.loading) return null;
  if (!access.enabled) return null;

  const tabs = isStudent(user)
    ? [
        { key: 'chat', label: 'Chat', icon: <MessageSquare className="w-4 h-4" /> },
        { key: 'practice', label: 'Practice', icon: <ClipboardList className="w-4 h-4" /> },
        { key: 'growth', label: 'Growth', icon: <TrendingUp className="w-4 h-4" /> },
      ]
    : [
        { key: 'chat', label: 'Chat', icon: <MessageSquare className="w-4 h-4" /> },
        { key: 'assist', label: 'Assist', icon: <Wand2 className="w-4 h-4" /> },
      ];

  // Non-students have no Growth tab; fall back to Chat if state references it.
  const effectiveTab = tabs.some((t) => t.key === activeTab) ? activeTab : 'chat';

  // Smart window positioning relative to anchor position
  const isTopHalf = position.y < -(window.innerHeight / 2 - 60);
  const isLeftHalf = position.x < -(window.innerWidth / 2 - 60);
  const verticalClass = isTopHalf ? 'top-0' : 'bottom-0';
  const horizontalClass = isLeftHalf ? 'left-0' : 'right-0';

  return (
    <>
      {/* Quiz Modal (rendered outside the chat bubble) */}
      {quizModal && (
        <GracyQuizModal
          quizConfig={quizModal.quizConfig}
          onClose={() => setQuizModal(null)}
          onNewQuiz={() => {
            setQuizModal(null);
            setActiveTab('practice');
            setIsOpen(true);
          }}
        />
      )}

      <div
        className="fixed z-50 pointer-events-none"
        style={{
          bottom: '24px',
          right: '24px',
          transform: `translate(${position.x}px, ${position.y}px)`,
        }}
      >
        {/* Chat Window */}
        {isOpen && (
          <div className={`absolute ${verticalClass} ${horizontalClass} w-[360px] sm:w-[400px] h-[580px] max-h-[85vh] bg-white dark:bg-slate-950 rounded-xl shadow-none border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden pointer-events-auto`}>

            {/* Header */}
            <div
              onPointerDown={handlePointerDown}
              className="bg-primary p-4 flex items-center justify-between text-white flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg leading-tight" style={{ color: '#eeee94' }}>Gracy</h3>
                  <p className="text-xs text-sky-100 font-medium">
                    {gracyLabel(user)}
                    {access.remaining !== undefined && (
                      <span className="ml-2 opacity-80">· {access.remaining}/{access.dailyLimit} left today</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors cursor-pointer"
                title="Close chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Bar */}
            <div className="flex bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
                    effectiveTab === tab.key
                      ? 'border-sky-500 text-primary dark:text-primary bg-white dark:bg-slate-950'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            {effectiveTab === 'chat' && (
              <ChatPanel
                messages={messages}
                isLoading={isLoading}
                onSend={handleSendMessage}
                inputValue={inputValue}
                setInputValue={setInputValue}
                messagesEndRef={messagesEndRef}
                isStudent={isStudent(user)}
                onPickTask={(type) => startAssistFlow(type)}
              />
            )}

            {effectiveTab === 'practice' && (
              <PracticeSetup
                onStartQuiz={(config) => {
                  setIsOpen(false);
                  setQuizModal({ quizConfig: config });
                }}
              />
            )}

            {effectiveTab === 'assist' && (
              <GracyAssistTab />
            )}

            {effectiveTab === 'growth' && (
              <GracyGrowth access={access} />
            )}
          </div>
        )}

        {/* Floating Action Button (Only visible when chat window is closed) */}
        {!isOpen && (
          <button
            ref={fabRef}
            onPointerDown={handlePointerDown}
            onClick={() => {
              if (!dragStartPos.current.hasMoved) setIsOpen(true);
            }}
            className="absolute bottom-0 right-0 w-14 h-14 rounded-full bg-primary text-white shadow-none flex items-center justify-center hover:scale-105 hover:bg-primary/90 active:scale-95 transition-transform pointer-events-auto cursor-grab active:cursor-grabbing z-50"
            title="Chat with Gracy"
          >
            <MessageSquare className="w-6 h-6" />
          </button>
        )}
      </div>
    </>
  );
};

// Role-agnostic wrapper: Gracy is available to every logged-in platform user
// (AI Study Partner for students, AI Assistant for staff roles).
const GracyChat = ({ user }) => {
  if (!user) return null;
  return createPortal(<GracyChatInner user={user} />, document.body);
};

export default GracyChat;
