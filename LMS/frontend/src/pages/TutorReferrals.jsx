import React, { useEffect, useState } from 'react';
import { Loader2, Send, User, GraduationCap, MessageSquare, ArrowLeft, CheckCircle2 } from 'lucide-react';
import api from '../utils/api';
import Layout from '../components/Layout';
import { toast } from 'react-hot-toast';

const STATUS_META = {
  open: { label: 'Open', badge: 'bg-amber-100 text-amber-700' },
  in_progress: { label: 'In Progress', badge: 'bg-blue-100 text-blue-700' },
  resolved: { label: 'Resolved', badge: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Not Approved', badge: 'bg-red-100 text-red-700' },
};

const TutorReferrals = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/tutor-requests/referred');
      setRequests(res.data?.requests || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load referrals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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

  if (loading) {
    return <Layout><div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Student Referrals</h2>
          <p className="text-sm text-gray-500">Students matched to you by the Gracified team. Connect and start teaching.</p>
        </div>

        {selected ? (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
              <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm font-medium">
                <ArrowLeft className="w-4 h-4" /> Back to referrals
              </button>
              <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${STATUS_META[selected.status].badge}`}>
                {STATUS_META[selected.status].label}
              </span>
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
                  <span className="bg-gray-100 px-2 py-1 rounded">Submitted: {new Date(selected.createdAt).toLocaleDateString()}</span>
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
                    {selected.referral.tutorContact && <p className="text-xs text-gray-600">Contact: {selected.referral.tutorContact}</p>}
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
                    <p className="text-xs text-gray-400">No messages yet. Say hello and agree on your first session.</p>
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
                <GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="font-semibold text-gray-500 mb-1">No referrals yet</p>
                <p className="text-sm">When a student requests a tutor and you're matched, it will appear here.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default TutorReferrals;