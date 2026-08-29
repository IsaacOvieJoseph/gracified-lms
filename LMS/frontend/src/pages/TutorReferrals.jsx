import React, { useEffect, useState } from 'react';
import {
  Loader2, Send, User, GraduationCap, MessageSquare, ArrowLeft, CheckCircle2,
  Megaphone, Users, X, ChevronDown
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

const APP_STATUS_META = {
  pending: { label: 'Applied', badge: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Matched!', badge: 'bg-emerald-100 text-emerald-700' },
  declined: { label: 'Not Selected', badge: 'bg-gray-100 text-gray-500' },
};

const TutorReferrals = () => {
  const [tab, setTab] = useState('browse');
  const [loading, setLoading] = useState(true);

  // Browse published requests
  const [published, setPublished] = useState([]);
  const [expandedReq, setExpandedReq] = useState(null);
  const [applyFor, setApplyFor] = useState(null);
  const [coverNote, setCoverNote] = useState('');
  const [applying, setApplying] = useState(false);
  const [appReplies, setAppReplies] = useState({});
  const [sendingApp, setSendingApp] = useState(false);

  // My referrals (matched students)
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [showShareClass, setShowShareClass] = useState(false);
  const [myClasses, setMyClasses] = useState([]);
  const [shareClass, setShareClass] = useState('');
  const [sharing, setSharing] = useState(false);

  const loadBrowse = async () => {
    try {
      const res = await api.get('/tutor-requests/published');
      setPublished(res.data?.requests || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load published requests');
    }
  };

  const loadReferrals = async () => {
    try {
      const res = await api.get('/tutor-requests/referred');
      setRequests(res.data?.requests || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load referrals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBrowse(); }, []);
  useEffect(() => {
    if (tab === 'referrals') loadReferrals();
  }, [tab]);

  const apply = async (rid) => {
    if (!applyFor) return;
    setApplying(true);
    try {
      await api.post(`/tutor-requests/${rid}/apply`, { message: coverNote.trim() });
      toast.success('Applied — the team will be in touch');
      setApplyFor(null);
      setCoverNote('');
      loadBrowse();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not apply');
    } finally {
      setApplying(false);
    }
  };

  const appSend = async (rid, appId) => {
    const msg = (appReplies[appId] || '').trim();
    if (!msg || sendingApp) return;
    setSendingApp(true);
    try {
      const res = await api.post(`/tutor-requests/${rid}/applications/${appId}/messages`, { message: msg });
      setAppReplies((m) => ({ ...m, [appId]: '' }));
      loadBrowse();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not send message');
    } finally {
      setSendingApp(false);
    }
  };

  const openDetail = async (id) => {
    try {
      const res = await api.get(`/tutor-requests/${id}`);
      setSelected(res.data?.request || null);
      loadReferrals();
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
      loadReferrals();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  const openShareClass = async () => {
    setShowShareClass(true);
    setShareClass('');
    try {
      const res = await api.get('/classrooms');
      setMyClasses(res.data?.classrooms || []);
    } catch (_) { }
  };

  const submitShareClass = async () => {
    if (!shareClass || !selected || sharing) return;
    setSharing(true);
    try {
      const res = await api.put(`/tutor-requests/${selected._id}/class-link`, { classroomId: shareClass });
      setSelected(res.data?.request);
      setShowShareClass(false);
      toast.success('Class shared — the student can now join');
      loadReferrals();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not share class');
    } finally {
      setSharing(false);
    }
  };

  const canShareClass = selected && ['open', 'in_progress'].includes(selected.status) && !selected.referral?.classroomId;

  if (loading) {
    return <Layout><div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Tutor Center</h2>
            <p className="text-sm text-gray-500">Apply to student requests the Gracified team publishes, and manage your matched students.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setTab('browse'); setSelected(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${tab === 'browse' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
            >
              <Megaphone className="w-4 h-4" /> Browse Requests
            </button>
            <button
              onClick={() => setTab('referrals')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${tab === 'referrals' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
            >
              <Users className="w-4 h-4" /> My Students
            </button>
          </div>
        </div>

        {tab === 'browse' && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Open Requests</h3>
              <p className="text-xs text-gray-500">Requests published by the Gracified team. Apply and chat with them to get matched.</p>
            </div>
            {published.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {published.map((r) => {
                  const app = r.myApplication;
                  const appStatus = app ? APP_STATUS_META[app.status] : null;
                  const isOpen = expandedReq === r._id;
                  return (
                    <div key={r._id} className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                          <GraduationCap className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800 truncate">{r.subject}</span>
                            {appStatus && <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${appStatus.badge}`}>{appStatus.label}</span>}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{r.description}</p>
                          <p className="text-[11px] text-gray-400">
                            {new Date(r.createdAt).toLocaleDateString()} • {r.urgency} • {r.applicationCount} applicant(s)
                            {r.preferredSchedule ? ` • ${r.preferredSchedule}` : ''}
                          </p>
                        </div>
                        <button onClick={() => setExpandedReq(isOpen ? null : r._id)} className="text-gray-400">
                          <ChevronDown className={`w-4 h-4 transition ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>

                      {isOpen && (
                        <div className="mt-3 border-t border-gray-100 pt-3">
                          <p className="text-sm text-gray-600 mb-3 whitespace-pre-line">{r.description}</p>
                          {!r.applied ? (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                value={applyFor === r._id ? coverNote : ''}
                                onChange={(e) => { setApplyFor(r._id); setCoverNote(e.target.value); }}
                                placeholder="Optional note to the Gracified team..."
                                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                              <button
                                onClick={() => apply(r._id)}
                                disabled={applying}
                                className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-40 flex items-center justify-center gap-2"
                              >
                                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Apply
                              </button>
                            </div>
                          ) : app.status === 'pending' ? (
                            <div className="space-y-2">
                              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {(app.messages || []).length === 0 ? (
                                  <p className="text-xs text-gray-400">Your application is in review. The Gracified team can message you here.</p>
                                ) : (
                                  app.messages.map((m, i) => (
                                    <div key={i} className={`max-w-[90%] rounded-lg p-2 text-xs ${m.senderRole === 'personal_teacher' ? 'bg-indigo-600 text-white ml-auto' : 'bg-gray-100 text-gray-800'}`}>
                                      <p className="text-[9px] font-bold opacity-70 mb-0.5">{m.senderRole === 'personal_teacher' ? 'You' : 'Gracified Team'}</p>
                                      <p>{m.message}</p>
                                    </div>
                                  ))
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  value={appReplies[app._id] || ''}
                                  onChange={(e) => setAppReplies((m) => ({ ...m, [app._id]: e.target.value }))}
                                  onKeyDown={(e) => e.key === 'Enter' && appSend(r._id, app._id)}
                                  placeholder="Message the Gracified team..."
                                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button
                                  onClick={() => appSend(r._id, app._id)}
                                  disabled={sendingApp}
                                  className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                                >
                                  {sendingApp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                              </div>
                              {app.status === 'accepted' && (
                                <button onClick={() => { setTab('referrals'); loadReferrals(); }} className="text-sm font-bold text-emerald-600 hover:underline">
                                  You were matched — view the student →
                                </button>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">
                              {app.status === 'accepted' ? 'You were matched with this student.' : 'This application was not selected.'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-10 text-center text-gray-400">
                <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="font-semibold text-gray-500 mb-1">No open requests</p>
                <p className="text-sm">When the Gracified team publishes a student request, it appears here.</p>
              </div>
            )}
          </div>
        )}

        {tab === 'referrals' && (
          selected ? (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm font-medium">
                  <ArrowLeft className="w-4 h-4" /> Back to my students
                </button>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${STATUS_META[selected.status].badge}`}>
                    {STATUS_META[selected.status].label}
                  </span>
                  {canShareClass && (
                    <button onClick={openShareClass} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700">
                      Share Your Class
                    </button>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-3">
                <div className="md:col-span-2 p-5 border-r border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center">
                      {selected.studentId?.profilePicture ? (
                        <img src={selected.studentId.profilePicture} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-indigo-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">{selected.studentId?.name || 'Student'}</p>
                      <p className="text-xs text-gray-500">{selected.studentId?.email}</p>
                    </div>
                  </div>

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
                    {selected.studentId?.email && (
                      <a href={`mailto:${selected.studentId.email}`} className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded hover:bg-emerald-100">Email student</a>
                    )}
                  </div>

                  {selected.status === 'resolved' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="font-bold text-emerald-700 text-sm">Matched</span>
                      </div>
                      <p className="font-bold text-gray-800">{selected.referral.tutorName}</p>
                      {selected.referral.classroomName && <p className="text-xs text-gray-600">Class linked: {selected.referral.classroomName}</p>}
                      {selected.referral.notes && <p className="text-xs text-gray-600 mt-1">{selected.referral.notes}</p>}
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
                      <p className="text-xs text-gray-400">Say hello and agree on your first session.</p>
                    ) : (
                      selected.messages.map((m, i) => (
                        <div key={i} className={`max-w-[85%] rounded-lg p-2.5 text-sm ${m.senderRole === 'personal_teacher' ? 'bg-indigo-600 text-white ml-auto' : 'bg-gray-100 text-gray-800'}`}>
                          <p className="text-[10px] font-bold opacity-70 mb-0.5">
                            {m.senderRole === 'personal_teacher' ? 'You' : m.senderRole === 'root_admin' ? 'Gracified Team' : m.senderId?.name || 'Student'}
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
                        placeholder="Reply to student..."
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
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              {requests.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {requests.map((r) => {
                    const meta = STATUS_META[r.status];
                    const unread = (r.messages || []).filter((m) => m.senderRole === 'student' && !m.readByTutor).length;
                    return (
                      <button
                        key={r._id}
                        onClick={() => openDetail(r._id)}
                        className="w-full text-left p-4 hover:bg-gray-50 transition flex items-center gap-4"
                      >
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                          {r.studentId?.profilePicture ? (
                            <img src={r.studentId.profilePicture} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-indigo-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800 truncate">{r.studentId?.name || 'Student'}</span>
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${meta.badge}`}>{meta.label}</span>
                          </div>
                          <p className="text-xs text-gray-500">{r.subject} • {new Date(r.createdAt).toLocaleDateString()}</p>
                          <p className="text-xs text-gray-500 truncate">{r.description}</p>
                        </div>
                        {unread > 0 && (
                          <span className="bg-indigo-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">{unread}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-10 text-center text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="font-semibold text-gray-500 mb-1">No students matched yet</p>
                  <p className="text-sm">Browse published requests on the other tab, or matched students show up here.</p>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {applyFor && !published.find((p) => p._id === applyFor)?.applied && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800">Apply to help</h3>
              <button onClick={() => setApplyFor(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Note to the Gracified team (optional)</label>
                <textarea
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                  rows={3}
                  placeholder="e.g. I'm an experienced Math tutor and available afternoons..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={() => apply(applyFor)}
                disabled={applying}
                className="w-full bg-indigo-600 text-white font-semibold py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit Application
              </button>
            </div>
          </div>
        </div>
      )}

      {showShareClass && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800">Share Your Class</h3>
              <button onClick={() => setShowShareClass(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Pick a class to share with this student. Sharing it closes this chat.</p>
            {myClasses.length === 0 ? (
              <p className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                You don&apos;t have any classes yet. Create one under Classrooms first.
              </p>
            ) : (
              <select
                value={shareClass}
                onChange={(e) => setShareClass(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
              >
                <option value="">Select a class...</option>
                {myClasses.map((c) => (
                  <option key={c._id} value={c._id}>{c.name} — {c.subject || 'General'}</option>
                ))}
              </select>
            )}
            <button
              onClick={submitShareClass}
              disabled={sharing || !shareClass}
              className="w-full bg-emerald-600 text-white font-semibold py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Share Class & Close Chat
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default TutorReferrals;