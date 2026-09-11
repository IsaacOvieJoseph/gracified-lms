import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Send, Loader2, MessageSquare, Bot, TrendingUp,
  ClipboardList, ChevronDown, Plus, Minus
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../utils/api';
import Markdown from './Markdown';
import { useLocation } from 'react-router-dom';
import GracyQuizModal from './GracyQuizModal';
import GracyGrowth from './GracyGrowth';
import {
  isPracticeRequest,
  extractPracticeArea,
  extractPracticeQuantityFromMessage,
  isQuantityOnly,
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
        <div className="absolute z-50 top-full left-0 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto custom-scrollbar">
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
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Quiz Mode</p>
          <div className="flex gap-2">
            {[
              { key: 'custom', label: '🎯 Custom' },
              { key: 'general', label: '🌐 General' },
            ].map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`flex-1 py-2 px-3 text-sm font-bold rounded-xl border transition-all ${
                  mode === m.key
                    ? 'bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-500/20'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-sky-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {mode === 'general'
              ? 'Gracy picks from all your enrolled topics for a mixed practice.'
              : 'Choose specific subjects, difficulty levels, and topics.'}
          </p>
        </div>

        {/* Custom Mode Options */}
        {mode === 'custom' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
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
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
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
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
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
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
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
              <span className="text-2xl font-black text-slate-800 dark:text-slate-200">{questionCount}</span>
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
          className="w-full py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl font-bold shadow-lg shadow-sky-500/20 hover:from-sky-600 hover:to-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
        >
          <ClipboardList className="w-5 h-5" />
          Start Practice Quiz
        </button>
      </div>
    </div>
  );
};

// ── Chat Panel ──────────────────────────────────────────────────────────────
const ChatPanel = ({ messages, isLoading, onSend, inputValue, setInputValue, messagesEndRef }) => (
  <>
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50 custom-scrollbar">
      {messages.map((msg, idx) => (
        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[85%] rounded-2xl p-3 ${
              msg.role === 'user'
                ? 'bg-blue-500 text-white rounded-br-none'
                : msg.isError
                ? 'bg-red-50 dark:bg-red-950/30 text-red-600 border border-red-200 dark:border-red-800 rounded-bl-none'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none shadow-sm'
            }`}
          >
            <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none">
              {msg.role === 'user' ? msg.content : <Markdown>{msg.content}</Markdown>}
            </div>

            {msg.suggestedFollowUp && msg.suggestedFollowUp.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {msg.suggestedFollowUp.map((followUp, i) => (
                  <button
                    key={i}
                    onClick={() => onSend(null, followUp)}
                    className="text-xs bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800/50 px-2 py-1.5 rounded-lg hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors text-left"
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
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-none p-4 shadow-sm flex items-center gap-2 text-sky-500">
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
        className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 pr-2 focus-within:ring-2 ring-sky-400 transition-shadow"
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask a question or 'quiz me on...'..."
          className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || isLoading}
          className="w-8 h-8 flex items-center justify-center bg-sky-500 text-white rounded-lg disabled:opacity-50 disabled:bg-slate-300 hover:bg-sky-600 transition-colors"
        >
          <Send className="w-4 h-4 ml-0.5" />
        </button>
      </form>
    </div>
  </>
);

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

  // Pending practice (NLP: waiting for question count)
  const pendingPractice = useRef(null);

  // Dragging state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0, hasMoved: false });
  const fabRef = useRef(null);
  const messagesEndRef = useRef(null);
  const location = useLocation();

  // ── Session Storage persistence ──
  useEffect(() => {
    const savedState = sessionStorage.getItem('gracy_chat_state');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setMessages(parsed.messages || []);
        setSessionId(parsed.sessionId || null);
        if (parsed.isOpen) setIsOpen(parsed.isOpen);
        if (parsed.activeTab) setActiveTab(parsed.activeTab);
      } catch (_) {}
    } else {
      setMessages([{ role: 'assistant', content: "Hi! I'm **Gracy**, your AI study partner. 👋\n\nI can:\n- **Answer questions** about any topic\n- **Quiz you** — just say *\"quiz me on photosynthesis\"*\n- **Track your progress** in the Growth tab\n\nWhat shall we work on today?" }]);
    }
    checkAccess();
  }, []);

  useEffect(() => {
    if (!access.loading && access.enabled) {
      sessionStorage.setItem('gracy_chat_state', JSON.stringify({ messages, sessionId, isOpen, activeTab }));
    }
  }, [messages, sessionId, isOpen, activeTab, access.loading, access.enabled]);

  useEffect(() => {
    if (isOpen && activeTab === 'chat' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, activeTab]);

  const checkAccess = async () => {
    try {
      const res = await api.get('/ai/tutor/access');
      setAccess({ ...res.data, loading: false });
    } catch (_) {
      setAccess({ enabled: false, loading: false });
    }
  };

  // ── Message sending with NLP quiz detection ──
  const handleSendMessage = useCallback(async (e, text = null) => {
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

    // Normal chat
    try {
      const res = await api.post('/ai/tutor/chat', {
        question: messageText,
        sessionId,
        context: `Student is currently on page: ${location.pathname}`,
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
  }, [inputValue, isLoading, sessionId, location.pathname]);

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
      let newX = prev.x - deltaX;
      let newY = prev.y - deltaY;
      if (newX < -(window.innerWidth - fabSize)) newX = -(window.innerWidth - fabSize);
      if (newX > 0) newX = 0;
      if (newY < -(window.innerHeight - fabSize)) newY = -(window.innerHeight - fabSize);
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

  const tabs = [
    { key: 'chat', label: 'Chat', icon: <MessageSquare className="w-4 h-4" /> },
    { key: 'practice', label: 'Practice', icon: <ClipboardList className="w-4 h-4" /> },
    { key: 'growth', label: 'Growth', icon: <TrendingUp className="w-4 h-4" /> },
  ];

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
          <div className="absolute bottom-20 right-0 w-[360px] sm:w-[400px] h-[540px] max-h-[82vh] bg-white dark:bg-slate-950 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden pointer-events-auto">

            {/* Header */}
            <div className="bg-gradient-to-r from-sky-400 to-blue-500 p-4 flex items-center justify-between text-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">Gracy</h3>
                  <p className="text-xs text-sky-100 font-medium">
                    AI Study Partner
                    {access.remaining !== undefined && (
                      <span className="ml-2 opacity-80">· {access.remaining}/{access.dailyLimit} left today</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
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
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-colors border-b-2 ${
                    activeTab === tab.key
                      ? 'border-sky-500 text-sky-600 dark:text-sky-400 bg-white dark:bg-slate-950'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            {activeTab === 'chat' && (
              <ChatPanel
                messages={messages}
                isLoading={isLoading}
                onSend={handleSendMessage}
                inputValue={inputValue}
                setInputValue={setInputValue}
                messagesEndRef={messagesEndRef}
              />
            )}

            {activeTab === 'practice' && (
              <PracticeSetup
                onStartQuiz={(config) => {
                  setIsOpen(false);
                  setQuizModal({ quizConfig: config });
                }}
              />
            )}

            {activeTab === 'growth' && (
              <GracyGrowth access={access} />
            )}
          </div>
        )}

        {/* Floating Action Button */}
        <button
          ref={fabRef}
          onPointerDown={handlePointerDown}
          onClick={() => {
            if (!dragStartPos.current.hasMoved) setIsOpen((o) => !o);
          }}
          className={`absolute bottom-0 right-0 w-14 h-14 rounded-full bg-gradient-to-tr from-sky-500 to-blue-500 text-white shadow-xl shadow-sky-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform pointer-events-auto cursor-grab active:cursor-grabbing z-50 ${
            isOpen ? 'ring-4 ring-sky-300/40' : ''
          }`}
          title="Chat with Gracy"
        >
          {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        </button>
      </div>
    </>
  );
};

// Role guard wrapper to keep hooks from running for non-students
const GracyChat = ({ user }) => {
  if (!user || user.role !== 'student') return null;
  return createPortal(<GracyChatInner user={user} />, document.body);
};

export default GracyChat;
