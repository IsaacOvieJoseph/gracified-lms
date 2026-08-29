import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Plus, X, Send, Loader2, User, GraduationCap,
  MessageSquare, MessageCircle, CheckCircle2, ArrowLeft, ChevronRight, ShieldCheck
} from 'lucide-react';
import api from '../utils/api';
import Layout from '../components/Layout';
import { toast } from 'react-hot-toast';

const STATUS_META = {
  open: { label: 'Open', badge: 'bg-amber-100 text-amber-700' },
  in_progress: { label: 'In Progress', badge: 'bg-blue-100 text-blue-700' },
  resolved: { label: 'Resolved', badge: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Not Approved', badge: 'bg-red-100 text-red-700' },
};

const URGENCY_OPTIONS = [
  { key: 'low', label: 'Low', cls: 'bg-emerald-100 text-emerald-700' },
  { key: 'medium', label: 'Medium', cls: 'bg-amber-100 text-amber-700' },
  { key: 'high', label: 'Urgent', cls: 'bg-red-100 text-red-700' },
];

const StudentTutorRequests = () => {
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(null);
  const [form, setForm] = useState({ subject: '', description: '', urgency: 'medium', preferredSchedule: '' });

  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    try {
      const [sugRes, reqRes] = await Promise.all([
        api.get('/tutor-requests/suggestions').catch(() => ({ data: { suggestions: [] } })),
        api.get('/tutor-requests/mine'),
      ]);
      setSuggestions(sugRes.data?.suggestions || []);
      setRequests(reqRes.data?.requests || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to load tutor matching.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || form.description.trim().length < 10 || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.post('/tutor-requests', form);
      setForm({ subject: '', description: '', urgency: 'medium', preferredSchedule: '' });
      setShowForm(false);
      toast.success(res.data?.request ? 'Request submitted. Our team has been notified.' : 'Request submitted.');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not submit your request.');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (id) => {
    try {
      const res = await api.get(`/tutor-requests/${id}`);
      setSelected(res.data?.request || null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load request');
    }
  };

  const sendReply = async () => {
    const msg = reply.trim();
    if (!msg || sending || !selected) return;
    setSending(true);
    try {
      const res = await api.post(`/tutor-requests/${selected._id}/messages`, { message: msg });
      setSelected(res.data?.request);
      setReply('');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  const activeCount = requests.filter((r) => ['open', 'in_progress'].includes(r.status)).length;

  const startDirectChat = async (s) => {
    if (starting) return;
    setStarting(String(s.tutorId));
    try {
      const subject = s.reasons[0] || 'General tutoring help';
      const description = `I'd like to begin tutoring with ${s.name}. Topic: ${subject}.`;
      const res = await api.post('/tutor-requests/direct', {
        tutorId: s.tutorId,
        subject,
        description,
      });
      toast.success('Chat started with your tutor!');
      const req = res.data?.request;
      if (req?._id) openDetail(req._id);
      else load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not start a chat with this tutor.');
    } finally {
      setStarting(null);
    }
  };

  const joinClass = (classUrl) => {
    if (classUrl) navigate(classUrl);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Find a Tutor</h2>
            <p className="text-sm text-gray-500">Matched to your classes — or request one and we&apos;ll find you the right fit.</p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 shadow-sm ${showForm ? 'bg-gray-200 text-gray-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Close' : 'Request a Tutor'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={submit} className="bg-white rounded-xl shadow-md p-5 border-t-4 border-indigo-600">
            <h3 className="font-bold text-gray-800 mb-1">Request a Tutor</h3>
            <p className="text-xs text-gray-500 mb-4">Our team will review this and connect you with the right tutor.</p>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Subject *</label>
                <input
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g. Mathematics, Physics"
                  maxLength={120}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Preferred schedule</label>
                <input
                  value={form.preferredSchedule}
                  onChange={(e) => setForm((f) => ({ ...f, preferredSchedule: e.target.value }))}
                  placeholder="e.g. Weekdays after 4pm"
                  maxLength={200}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">Describe what you need help with *</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="e.g. I struggle with quadratic equations and have an exam in 3 weeks..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">Urgency</label>
                <div className="flex gap-2">
                  {URGENCY_OPTIONS.map((u) => (
                    <button
                      key={u.key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, urgency: u.key }))}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold border transition ${form.urgency === u.key ? 'border-indigo-600 text-indigo-700 bg-indigo-50' : 'border-gray-200 text-gray-500'}`}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting || !form.subject.trim() || form.description.trim().length < 10}
              className="mt-4 bg-indigo-600 text-white font-semibold py-2.5 px-6 rounded-lg hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit Request
            </button>
          </form>
        )}

        {selected ? (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
              <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm font-medium">
                <ArrowLeft className="w-4 h-4" /> Back to my requests
              </button>
              <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${STATUS_META[selected.status].badge}`}>
                {STATUS_META[selected.status].label}
              </span>
              {selected.mode === 'direct' && (
                <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-violet-100 text-violet-700 flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" /> Direct
                </span>
              )}
            </div>

            <div className="grid md:grid-cols-3">
              <div className="md:col-span-2 p-5 border-r border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-bold text-gray-800">{selected.subject}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">{selected.description}</p>
                <div className="flex flex-wrap gap-2 mb-4 text-xs text-gray-500">
                  <span className="bg-gray-100 px-2 py-1 rounded">Urgency: {selected.urgency}</span>
                  {selected.preferredSchedule && (
                    <span className="bg-gray-100 px-2 py-1 rounded">Preferred: {selected.preferredSchedule}</span>
                  )}
                  <span className="bg-gray-100 px-2 py-1 rounded">Submitted: {new Date(selected.createdAt).toLocaleDateString()}</span>
                </div>

                {selected.status === 'resolved' && selected.referral?.givenAt && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-emerald-700 text-sm">{selected.mode === 'direct' ? 'Matched with Your Tutor' : 'Your Referral'}</span>
                    </div>
                    <p className="font-bold text-gray-800 text-lg">{selected.referral.tutorName}</p>
                    {selected.referral.classroomName && (
                      <p className="text-xs text-gray-600 mt-1">Class: {selected.referral.classroomName}</p>
                    )}
                    {selected.referral.tutorContact && <p className="text-xs text-gray-600">Contact: {selected.referral.tutorContact}</p>}
                    {selected.referral.notes && <p className="text-xs text-gray-600 mt-1">{selected.referral.notes}</p>}
                    {selected.referral.classroomId && (
                      <button
                        onClick={() => joinClass(selected.referral.classUrl)}
                        className="mt-3 w-full bg-emerald-600 text-white font-semibold py-2.5 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2"
                      >
                        <GraduationCap className="w-4 h-4" /> Join Your New Class
                      </button>
                    )}
                  </div>
                )}

                {selected.status === 'rejected' && !selected.referral?.givenAt && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-red-700">This request was reviewed and could not be approved.</p>
                  </div>
                )}
              </div>

              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span className="font-bold text-gray-800 text-sm">Conversation</span>
                </div>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {selected.messages?.length === 0 ? (
                    <p className="text-xs text-gray-400">Our team has been notified. Replies will appear here.</p>
                  ) : (
                    selected.messages.map((m, i) => (
                      <div key={i} className={`max-w-[85%] rounded-lg p-2.5 text-sm ${m.senderRole === 'student' ? 'bg-indigo-600 text-white ml-auto' : 'bg-gray-100 text-gray-800'}`}>
                        <p className="text-[10px] font-bold opacity-70 mb-0.5">
                          {m.senderRole === 'student' ? 'You' : m.senderRole === 'personal_teacher' ? (m.senderId?.name || selected.referral?.tutorName || 'Your Tutor') : 'Gracified Team'}
                        </p>
                        <p>{m.message}</p>
                      </div>
                    ))
                  )}
                </div>
                {['open', 'in_progress'].includes(selected.status) && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                      placeholder="Type a message..."
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={sendReply}
                      disabled={sending || !reply.trim()}
                      className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-gray-800">Suggested for you</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">Based on your classes and tutors active right now.</p>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
            ) : suggestions.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-3">
                {suggestions.map((s) => (
                  <div key={String(s.tutorId)} className="bg-white rounded-xl shadow-md p-4 flex items-start gap-3 border border-gray-100">
                    <div className="relative w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      {s.profilePicture ? (
                        <img src={s.profilePicture} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-indigo-600" />
                      )}
                      <span className={`absolute w-3 h-3 rounded-full border-2 border-white bottom-0 right-0 ${s.isCurrentlyActive ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 truncate">{s.name}</p>
                      {s.reasons.map((r, i) => (
                        <p key={i} className="text-xs text-gray-500 truncate">• {r}</p>
                      ))}
                      <button
                        onClick={() => startDirectChat(s)}
                        disabled={starting === String(s.tutorId)}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-1.5 disabled:opacity-50"
                      >
                        {starting === String(s.tutorId) ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                        Chat with {s.name.split(' ')[0]}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-400">No tutor matches found yet.</div>
            )}

            <div className="flex items-center gap-2 mt-8">
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-gray-800">My Requests</h3>
              {activeCount > 0 && (
                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full px-2 py-0.5">{activeCount}</span>
              )}
            </div>
            {requests.length > 0 ? (
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                {requests.map((r) => {
                  const meta = STATUS_META[r.status];
                  return (
                    <button
                      key={r._id}
                      onClick={() => openDetail(r._id)}
                      className="w-full text-left p-4 hover:bg-gray-50 transition flex items-center gap-4 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <GraduationCap className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 truncate">{r.subject}</span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${meta.badge}`}>{meta.label}</span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{r.description}</p>
                        <p className="text-[11px] text-gray-400">{new Date(r.createdAt).toLocaleDateString()} • {(r.messages || []).length} messages</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-400">
                <p className="font-semibold text-gray-500 mb-1">No requests yet</p>
                <p className="text-sm">Didn&apos;t find a match above? Request a tutor and our team will find one for you.</p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default StudentTutorRequests;