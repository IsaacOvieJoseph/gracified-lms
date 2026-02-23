import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, ChevronDown, ChevronUp, Plus, Loader2 } from 'lucide-react';
import api from '../utils/api';
import Layout from '../components/Layout';
import { formatDisplayDate } from '../utils/timezone';
import { toast } from 'react-hot-toast';

const Feedbacks = () => {
    const [feedbacks, setFeedbacks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openFeedbackId, setOpenFeedbackId] = useState(null);

    // Request Feedback State
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestTarget, setRequestTarget] = useState('all');
    const [requestMessage, setRequestMessage] = useState('');
    const [isRequesting, setIsRequesting] = useState(false);

    useEffect(() => {
        const fetchFeedbacks = async () => {
            try {
                const res = await api.get('/classrooms/feedback/all');
                setFeedbacks(res.data.feedbacks);
            } catch (error) {
                console.error('Error fetching feedbacks:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchFeedbacks();
    }, []);

    const toggleFeedback = (id) => {
        setOpenFeedbackId(openFeedbackId === id ? null : id);
    };

    const handleRequestFeedback = async (e) => {
        e.preventDefault();
        setIsRequesting(true);
        try {
            const res = await api.post('/classrooms/feedback/request', {
                targetRole: requestTarget,
                message: requestMessage
            });
            toast.success(res.data.message);
            setShowRequestModal(false);
            setRequestMessage('');
            setRequestTarget('all');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error requesting feedback');
        } finally {
            setIsRequesting(false);
        }
    };

    const renderStars = (count) => {
        return [...Array(5)].map((_, i) => (
            <Star
                key={i}
                className={`w-4 h-4 ${i < count ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
            />
        ));
    };

    if (loading) {
        return <Layout><div className="text-center py-8">Loading feedbacks...</div></Layout>;
    }

    return (
        <Layout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-800">Feedback Management</h2>
                    <div className="flex items-center gap-3">
                        <div className="bg-white px-4 py-2 rounded-lg shadow-sm">
                            <span className="text-gray-500 text-sm">Total:</span>
                            <span className="ml-2 font-bold text-indigo-600">{feedbacks.length}</span>
                        </div>
                        <button
                            onClick={() => setShowRequestModal(true)}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center space-x-2 shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Request Feedback</span>
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                    {feedbacks.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                            {feedbacks.map((fb) => (
                                <div key={fb._id} className="border-b last:border-b-0">
                                    <div
                                        onClick={() => toggleFeedback(fb._id)}
                                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-gray-900">
                                                    {fb.type === 'platform' ? 'Platform Feedback' : (fb.classroomName || 'Classroom Feedback')}
                                                </h3>
                                                <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-bold ${fb.type === 'platform' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {fb.type || 'Classroom'}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-500 mt-1">
                                                From: <span className="font-medium">{fb.studentId?.name || 'Deleted User'}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center space-x-1">
                                                {renderStars(fb.rating)}
                                            </div>
                                            {openFeedbackId === fb._id ? (
                                                <ChevronUp className="w-5 h-5 text-gray-400" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Accordion Content */}
                                    {openFeedbackId === fb._id && (
                                        <div className="px-4 pb-4 bg-gray-50/50">
                                            <div className="pt-2 border-t border-gray-100">
                                                <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 mb-3 mt-2">
                                                    <div>
                                                        Submitted: {formatDisplayDate(fb.submittedAt)}
                                                    </div>
                                                    {fb.teacherId && (
                                                        <div>
                                                            Teacher: {fb.teacherId.name}
                                                        </div>
                                                    )}
                                                </div>
                                                {fb.title && <div className="text-sm font-medium text-gray-700 mb-2">Prompt: "{fb.title}"</div>}
                                                {fb.comment ? (
                                                    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                                        <p className="text-gray-700 text-sm leading-relaxed">"{fb.comment}"</p>
                                                    </div>
                                                ) : (
                                                    <p className="text-gray-400 text-sm italic">No written comment provided.</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center text-gray-500">
                            <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                            <p>No feedback received yet.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Request Feedback Modal */}
            {showRequestModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full p-8 animate-slide-up">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-bold text-slate-900">Request Feedback</h3>
                            <button onClick={() => setShowRequestModal(false)} className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleRequestFeedback} className="space-y-6">
                            <div>
                                <label>Target Audience</label>
                                <select
                                    value={requestTarget}
                                    onChange={(e) => setRequestTarget(e.target.value)}
                                    required
                                >
                                    <option value="all">All Users</option>
                                    <option value="student">Students Only</option>
                                    <option value="teacher">Teachers Only</option>
                                    <option value="school_admin">School Admins Only</option>
                                </select>
                            </div>

                            <div>
                                <label>Message / Question</label>
                                <textarea
                                    value={requestMessage}
                                    onChange={(e) => setRequestMessage(e.target.value)}
                                    rows="4"
                                    placeholder="e.g. How can we improve your learning experience?"
                                    required
                                />
                                <p className="text-[10px] text-slate-400 mt-2">This will be sent as a notification to the selected users.</p>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowRequestModal(false)}
                                    className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition"
                                    disabled={isRequesting}
                                >
                                    Discard
                                </button>
                                <button
                                    type="submit"
                                    disabled={isRequesting}
                                    className="btn-premium flex-1"
                                >
                                    {isRequesting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Send Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default Feedbacks;
