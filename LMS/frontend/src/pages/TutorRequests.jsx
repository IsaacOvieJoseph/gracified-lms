import React, { useEffect, useState } from 'react';
import { Loader2, Send, CheckCircle2, X, User, GraduationCap, MessageSquare, ArrowLeft, Users, ChevronDown } from 'lucide-react';
import api from '../utils/api';
import Layout from '../components/Layout';
import { toast } from 'react-hot-toast';

const STATUS_META = {
  open: { label: 'Open', badge: 'bg-amber-100 text-amber-700' },
  in_progress: { label: 'In Progress', badge: 'bg-blue-100 text-blue-700' },
  resolved: { label: 'Resolved', badge: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Not Approved', badge: 'bg-red-100 text-red-700' },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'rejected', label: 'Not Approved' },
];

const TutorRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [tutors, setTutors] = useState([]);
  const [showReferral, setShowReferral] = useState(false);
  const [refForm, setRefForm] = useState({ tutorId: '', tutorName: '', tutorContact: '', notes: '' });
  const [referring, setReferring] = useState(false);
  const [expandedApp, setExpandedApp] = useState(null);
  const [appReplies, setAppReplies] = useState({});
  const [sendingApp, setSendingApp] = useState(false);
  const [changingApp, setChangingApp] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [classPicker, setClassPicker] = useState({ appId: null, tutorName: '', classes: [], selected: '' });
  const [accepting, setAccepting] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/tutor-requests', { params: { status: filter === 'all' ? undefined : filter } });
      setRequests(res.data?.requests || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load tutor requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const openDetail = async (id) => {
    try {
      const res = await api.get(`/tutor-requests/${id}`);
      setSelected(res.data?.request || null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load request');
    }
  };

  const openReferral = async () => {
    setShowReferral(true);
    if (!tutors.length) {
      try {
        const res = await api.get('/users', { params: { role: 'personal_teacher' } });
        setTutors(res.data?.users || []);
      } catch (_) { }
    }
  };

  const sendReply = async () => {
    const msg = reply.trim();
    if (!msg || sending) return;
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

  const updateStatus = async (status) => {
    setChangingStatus(true);
    try {
      const res = await api.put(`/tutor-requests/${selected._id}/status`, { status });
      setSelected(res.data?.request);
      toast.success(`Request marked as ${status.replace('_', ' ')}`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not update status');
    } finally {
      setChangingStatus(false);
    }
  };

  const submitReferral = async (e) => {
    e.preventDefault();
    setReferring(true);
    try {
      const res = await api.put(`/tutor-requests/${selected._id}/referral`, refForm);
      setSelected(res.data?.request);
      setShowReferral(false);
      setRefForm({ tutorId: '', tutorName: '', tutorContact: '', notes: '' });
      toast.success('Referral sent — request resolved');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not save referral');
    } finally {
      setReferring(false);
    }
  };

  const togglePublish = async () => {
    try {
      const res = await api.put(`/tutor-requests/${selected._id}/publish`, { published: !selected.published });
      setSelected(res.data?.request);
      toast.success(selected.published ? 'Request unpublished' : 'Request published — tutors can now apply');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not update publishing');
    }
  };

  const appSend = async (appId) => {
    const msg = (appReplies[appId] || '').trim();
    if (!msg || sendingApp) return;
    setSendingApp(true);
    try {
      const res = await api.post(`/tutor-requests/${selected._id}/applications/${appId}/messages`, { message: msg });
      setSelected(res.data?.request);
      setAppReplies((m) => ({ ...m, [appId]: '' }));
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not send message');
    } finally {
      setSendingApp(false);
    }
  };

  const declineApp = async (appId) => {
    setChangingApp(true);
    try {
      const res = await api.put(`/tutor-requests/${selected._id}/applications/${appId}/status`, { status: 'declined' });
      setSelected(res.data?.request);
      toast.success('Application declined');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not decline application');
    } finally {
      setChangingApp(false);
    }
  };

  const openClassPicker = async (app) => {
    setShowClassPicker(true);
    setClassPicker({ appId: app._id, tutorName: app.tutorId?.name || 'Tutor', classes: [], selected: '' });
    try {
      const res = await api.get(`/tutor-requests/${selected._id}/applications/${app._id}/tutor-classes`);
      const classes = res.data?.classrooms || [];
      setClassPicker((c) => ({ ...c, classes, selected: classes[0]?._id || '' }));
    } catch (_) { }
  };

  const confirmAccept = async () => {
    if (!classPicker.appId) return;
    setAccepting(true);
    try {
      const res = await api.put(`/tutor-requests/${selected._id}/applications/${classPicker.appId}/status`, {
        status: 'accepted',
        classroomId: classPicker.selected || undefined,
      });
      setSelected(res.data?.request);
      setShowClassPicker(false);
      setExpandedApp(null);
      toast.success('Tutor matched — class link shared with the student');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not accept application');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return <Layout><div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-800">Tutor Requests</h2>
          <div className="flex items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filter === f.key ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {selected ? (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
              <button onClick={() => { setSelected(null); setShowReferral(false); }} className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm font-medium">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${STATUS_META[selected.status].badge}`}>
                  {STATUS_META[selected.status].label}
                </span>
                {selected.mode === 'admin' && ['open', 'in_progress'].includes(selected.status) && (
                  <button
                    onClick={togglePublish}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${selected.published ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-violet-600 text-white hover:bg-violet-700'}`}
                  >
                    {selected.published ? 'Unpublish' : 'Publish to Tutors'}
                  </button>
                )}
                {selected.status === 'open' && (
                  <button
                    onClick={() => updateStatus('in_progress')}
                    disabled={changingStatus}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {changingStatus ? '...' : 'Mark In Progress'}
                  </button>
                )}
                {['open', 'in_progress'].includes(selected.status) && (
                  <button
                    onClick={() => updateStatus('rejected')}
                    disabled={changingStatus}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {changingStatus ? '...' : 'Reject'}
                  </button>
                )}
                {selected.status !== 'resolved' && (
                  <button
                    onClick={openReferral}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />Give Referral
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
                </div>

                {selected.status === 'resolved' && selected.referral?.givenAt && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-emerald-700 text-sm">Referral Given</span>
                    </div>
                    <p className="font-bold text-gray-800">{selected.referral.tutorName}</p>
                    {selected.referral.tutorContact && <p className="text-xs text-gray-600">Contact: {selected.referral.tutorContact}</p>}
                    {selected.referral.notes && <p className="text-xs text-gray-600 mt-1">{selected.referral.notes}</p>}
                  </div>
                )}

                {selected.mode === 'admin' && selected.applications?.length > 0 && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-indigo-600" />
                      <h3 className="font-bold text-gray-800 text-sm">Tutor Applicants ({selected.applications.length})</h3>
                    </div>
                    <div className="space-y-3">
                      {selected.applications.map((app) => {
                        const isAccepted = app.status === 'accepted';
                        const isDeclined = app.status === 'declined';
                        const isOpen = expandedApp === app._id;
                        const unread = (app.messages || []).filter((m) => m.senderRole === 'personal_teacher' && !m.readByAdmin).length;
                        return (
                          <div key={app._id} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                {app.tutorId?.profilePicture
                                  ? <img src={app.tutorId.profilePicture} alt="" className="w-full h-full rounded-full object-cover" />
                                  : <User className="w-4 h-4 text-indigo-600" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-gray-800 text-sm truncate">{app.tutorId?.name || 'Tutor'}</p>
                                {app.message && <p className="text-xs text-gray-500 line-clamp-2">{app.message}</p>}
                                <p className="text-[10px] text-gray-400">
                                  Applied {new Date(app.appliedAt).toLocaleDateString()} • {(app.messages || []).length} msgs
                                  {unread > 0 ? ` • ${unread} new` : ''}
                                </p>
                              </div>
                              {isAccepted && (
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Matched</span>
                              )}
                              {isDeclined && (
                                <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Declined</span>
                              )}
                              <button onClick={() => setExpandedApp(isOpen ? null : app._id)} className="text-gray-400">
                                <ChevronDown className={`w-4 h-4 transition ${isOpen ? 'rotate-180' : ''}`} />
                              </button>
                            </div>
                            {isOpen && app.status === 'pending' && (
                              <div className="mt-3 border-t border-gray-100 pt-3">
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 mb-2">
                                  {(app.messages || []).length === 0 ? (
                                    <p className="text-xs text-gray-400">Chat privately with this tutor about their application.</p>
                                  ) : (
                                    app.messages.map((m, i) => (
                                      <div key={i} className={`max-w-[90%] rounded-lg p-2 text-xs ${m.senderRole === 'root_admin' ? 'bg-indigo-600 text-white ml-auto' : 'bg-gray-100 text-gray-800'}`}>
                                        <p className="text-[9px] font-bold opacity-70 mb-0.5">{m.senderRole === 'root_admin' ? 'You' : app.tutorId?.name || 'Tutor'}</p>
                                        <p>{m.message}</p>
                                      </div>
                                    ))
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    value={appReplies[app._id] || ''}
                                    onChange={(e) => setAppReplies((m) => ({ ...m, [app._id]: e.target.value }))}
                                    onKeyDown={(e) => e.key === 'Enter' && appSend(app._id)}
                                    placeholder="Message this tutor..."
                                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                  <button onClick={() => appSend(app._id)} disabled={sendingApp} className="bg-indigo-600 text-white p-1.5 rounded-lg disabled:opacity-40">
                                    {sendingApp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                  </button>
                                  <button onClick={() => openClassPicker(app)} disabled={changingApp} className="bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40">
                                    Match
                                  </button>
                                  <button onClick={() => declineApp(app._id)} disabled={changingApp} className="bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40">
                                    Decline
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
                    <p className="text-xs text-gray-400">No messages yet. The student has been notified.</p>
                  ) : (
                    selected.messages.map((m, i) => (
                      <div key={i} className={`max-w-[85%] rounded-lg p-2.5 text-sm ${m.senderRole === 'root_admin' ? 'bg-indigo-600 text-white ml-auto' : 'bg-gray-100 text-gray-800'}`}>
                        <p className="text-[10px] font-bold opacity-70 mb-0.5">{m.senderRole === 'root_admin' ? 'You' : m.senderId?.name || 'Student'}</p>
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
                  const unread = (r.messages || []).filter((m) => m.senderRole && m.senderRole !== 'root_admin' && !m.readByAdmin).length;
                  return (
                    <button
                      key={r._id}
                      onClick={() => openDetail(r._id)}
                      className="w-full text-left p-4 hover:bg-gray-50 transition flex items-center gap-4"
                    >
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <GraduationCap className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 truncate">{r.subject}</span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${meta.badge}`}>{meta.label}</span>
                        </div>
                        <p className="text-xs text-gray-500">{r.studentId?.name} • {new Date(r.createdAt).toLocaleDateString()}</p>
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
              <div className="p-10 text-center text-gray-400">No tutor requests in this view.</div>
            )}
          </div>
        )}
      </div>

      {showClassPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Match with {classPicker.tutorName}</h3>
              <button onClick={() => setShowClassPicker(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Pick the tutor&apos;s class to link. The student receives the class link immediately.</p>
            {classPicker.classes.length === 0 ? (
              <p className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                This tutor has no classes yet. They&apos;ll be matched without a class link and can share one later.
              </p>
            ) : (
              <select
                value={classPicker.selected}
                onChange={(e) => setClassPicker((c) => ({ ...c, selected: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
              >
                {classPicker.classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} — {c.subject || 'General'}{c.isPaid ? ' (Paid)' : ' (Free)'}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={confirmAccept}
              disabled={accepting}
              className="w-full bg-emerald-600 text-white font-semibold py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Accept & Match Tutor
            </button>
          </div>
        </div>
      )}

      {showReferral && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Give Referral — {selected.subject}</h3>
              <button onClick={() => setShowReferral(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={submitReferral} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Platform Tutor (optional)</label>
                <select
                  value={refForm.tutorId}
                  onChange={(e) => setRefForm((f) => ({ ...f, tutorId: e.target.value, tutorName: '' }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a personal teacher...</option>
                  {(tutors.length ? tutors : []).map((t) => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
              </div>
              {!refForm.tutorId && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">External Tutor Name (optional)</label>
                    <input
                      value={refForm.tutorName}
                      onChange={(e) => setRefForm((f) => ({ ...f, tutorName: e.target.value }))}
                      placeholder="e.g. Mr. Adebayo Okafor"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Tutor Contact (optional)</label>
                    <input
                      value={refForm.tutorContact}
                      onChange={(e) => setRefForm((f) => ({ ...f, tutorContact: e.target.value }))}
                      placeholder="e.g. phone or email"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Notes</label>
                <textarea
                  value={refForm.notes}
                  onChange={(e) => setRefForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="e.g. Recommended due to their expertise in this subject..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={referring || (!refForm.tutorId && !refForm.tutorName.trim())}
                className="w-full bg-emerald-600 text-white font-semibold py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {referring ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Resolve & Send Referral
              </button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default TutorRequests;