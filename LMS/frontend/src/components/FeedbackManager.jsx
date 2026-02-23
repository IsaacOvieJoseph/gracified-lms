import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import { Star, MessageSquare, X, Loader2 } from 'lucide-react';

const FeedbackManager = () => {
    const { user } = useAuth();
    const [feedbackRequests, setFeedbackRequests] = useState([]);
    const [currentRequest, setCurrentRequest] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form State
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (user) {
            fetchPendingFeedback();
        }
    }, [user]);

    const fetchPendingFeedback = async () => {
        try {
            setLoading(true);
            const res = await api.get('/classrooms/feedback/pending', { skipLoader: true });
            if (res.data.feedbackRequests && res.data.feedbackRequests.length > 0) {
                setFeedbackRequests(res.data.feedbackRequests);
                setCurrentRequest(res.data.feedbackRequests[0]);
                setShowModal(true);
            }
        } catch (error) {
            console.error('Error fetching feedback requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRating = (value) => {
        setRating(value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (rating === 0) {
            toast.error('Please select a rating');
            return;
        }

        setIsSubmitting(true);
        try {
            await api.post('/classrooms/feedback', {
                requestId: currentRequest._id,
                rating,
                comment
            }, { skipLoader: true });

            toast.success('Thank you for your feedback!');

            // Remove completed request and show next if any
            const remaining = feedbackRequests.slice(1);
            setFeedbackRequests(remaining);

            if (remaining.length > 0) {
                setCurrentRequest(remaining[0]);
                setRating(0);
                setComment('');
            } else {
                setShowModal(false);
                setCurrentRequest(null);
            }
        } catch (error) {
            toast.error('Error submitting feedback');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!showModal || !currentRequest) return null;

    const isPlatform = currentRequest.type === 'platform';
    const headerColorClass = isPlatform ? 'bg-gradient-to-r from-purple-600 to-indigo-600' : 'bg-indigo-600';

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full overflow-hidden animate-slide-up">
                <div className={`${headerColorClass} p-10 text-center relative overflow-hidden`}>
                    {/* Decorative circles */}
                    <div className="absolute top-0 left-0 w-32 h-32 bg-white opacity-10 rounded-full -translate-x-16 -translate-y-16"></div>
                    <div className="absolute bottom-0 right-0 w-24 h-24 bg-white opacity-10 rounded-full translate-x-8 translate-y-8"></div>

                    {isPlatform ? (
                        <div className="flex justify-center mb-6">
                            <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-md shadow-inner">
                                <img src="/logo.jpg" alt="Logo" className="w-12 h-12 object-contain rounded-2xl" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<svg class="w-12 h-12 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>' }} />
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white/20 w-20 h-20 rounded-[2rem] backdrop-blur-md flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <MessageSquare className="w-10 h-10 text-white" />
                        </div>
                    )}

                    <h3 className="text-3xl font-bold text-white mb-2">
                        {isPlatform ? 'Share Thoughts' : 'Class Ended'}
                    </h3>
                    <p className="text-white/80 text-sm px-6 leading-relaxed">
                        {isPlatform
                            ? (currentRequest.title || 'How is your experience with our platform?')
                            : <span>The classroom <span className="font-bold text-white whitespace-nowrap">{currentRequest.classroomName || currentRequest.classroomId?.name}</span> has ended.</span>
                        }
                    </p>
                </div>

                <div className="p-8">
                    <p className="text-slate-500 text-center mb-8 font-medium">
                        {isPlatform ? 'Rate your overall experience so far.' : 'Please take a moment to rate your learning experience.'}
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="flex justify-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => handleRating(star)}
                                    className={`w-12 h-12 transition-all duration-300 hover:scale-125 active:scale-95 focus:outline-none ${rating >= star ? 'text-amber-400 fill-amber-400 drop-shadow-sm' : 'text-slate-200'
                                        }`}
                                >
                                    <Star className="w-full h-full" />
                                </button>
                            ))}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                                Additional Comments
                            </label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows="3"
                                className="resize-none"
                                placeholder="What did you like? What could be improved?"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="btn-premium w-full flex items-center justify-center py-4"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                'Submit Feedback'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default FeedbackManager;
