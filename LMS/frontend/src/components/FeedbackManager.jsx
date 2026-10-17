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
    const headerColorClass = isPlatform ? 'bg-muted/40 border-b border-border' : 'bg-primary text-primary-foreground';

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] overflow-y-auto p-4 flex justify-center items-center">
            <div className="relative my-auto bg-card text-foreground rounded-2xl border border-border shadow-2xl max-w-md w-full overflow-hidden animate-slide-up">
                {/* Dismiss / Close button */}
                <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className={`absolute top-4 right-4 p-2 rounded-xl transition z-20 ${
                        isPlatform 
                            ? 'text-muted-foreground hover:text-foreground hover:bg-muted' 
                            : 'text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10'
                    }`}
                    title="Close"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className={`${headerColorClass} p-6 sm:p-7 text-center relative overflow-hidden`}>
                    {/* Decorative circles */}
                    <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-16 -translate-y-16 pointer-events-none"></div>
                    <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-8 translate-y-8 pointer-events-none"></div>

                    {isPlatform ? (
                        <div className="flex justify-center mb-3">
                            <div className="bg-primary/10 p-3 rounded-xl border border-primary/20">
                                <img 
                                    src="/logo.jpg" 
                                    alt="Logo" 
                                    className="w-10 h-10 object-contain rounded-lg" 
                                    onError={(e) => { 
                                        e.target.style.display = 'none'; 
                                        e.target.parentElement.innerHTML = '<svg class="w-10 h-10 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>'; 
                                    }} 
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white/20 w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3">
                            <MessageSquare className="w-7 h-7 text-primary-foreground" />
                        </div>
                    )}

                    <h3 className={`text-2xl font-semibold mb-1 ${isPlatform ? 'text-foreground' : 'text-primary-foreground'}`}>
                        {isPlatform ? "Share Your Thought" : 'Class Ended'}
                    </h3>
                    <p className={`text-sm px-4 leading-relaxed ${isPlatform ? 'text-muted-foreground' : 'text-primary-foreground/85'}`}>
                        {isPlatform
                            ? (currentRequest.title || 'How is your experience with our platform?')
                            : <span>The classroom <span className="font-semibold underline whitespace-nowrap">{currentRequest.classroomName || currentRequest.classroomId?.name}</span> has ended.</span>
                        }
                    </p>
                </div>

                <div className="p-6">
                    <p className="text-muted-foreground text-center mb-5 font-medium text-sm">
                        {isPlatform ? 'Rate your overall experience so far.' : 'Please take a moment to rate your learning experience.'}
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="flex justify-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => handleRating(star)}
                                    className={`w-10 h-10 transition-all duration-300 hover:scale-125 active:scale-95 focus:outline-none ${
                                        rating >= star ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30 hover:text-amber-300'
                                    }`}
                                >
                                    <Star className="w-full h-full" />
                                </button>
                            ))}
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-muted-foreground tracking-wide mb-1.5 block">
                                Additional Comments
                            </label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows="3"
                                className="w-full resize-none"
                                placeholder="What did you like? What could be improved?"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="btn-premium w-full flex items-center justify-center py-3 font-semibold"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
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
