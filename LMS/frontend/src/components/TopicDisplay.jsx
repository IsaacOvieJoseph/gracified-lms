import React, { useEffect, useState } from 'react';
import { Book, Clock, CheckCircle, Circle, Calendar, Video, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../utils/api';
import { formatDisplayDate } from '../utils/timezone';
import { useAuth } from '../context/AuthContext';


const getVideoEmbedInfo = (url) => {
    if (!url) return null;

    // 1. Direct Video Files (Native Player)
    const isDirectFile = /\.(mp4|webm|ogg|m4v|ogv)$/i.test(url.split('?')[0]);
    const isMonosnapDirect = url.includes('monosnap.ai/direct/');
    if (isDirectFile || isMonosnapDirect) {
        return { type: 'direct', embedUrl: url, isDirect: true };
    }

    // 2. YouTube
    const ytRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const ytMatch = url.match(ytRegExp);
    if (ytMatch && ytMatch[2].length === 11) {
        return { type: 'youtube', id: ytMatch[2], embedUrl: `https://www.youtube.com/embed/${ytMatch[2]}` };
    }

    // 3. Vimeo
    const vimeoRegExp = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/;
    const vimeoMatch = url.match(vimeoRegExp);
    if (vimeoMatch) {
        return { type: 'vimeo', id: vimeoMatch[1], embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
    }

    // 4. Google Drive
    const driveRegExp = /drive\.google\.com\/file\/d\/([^\/\?]+)/;
    const driveMatch = url.match(driveRegExp);
    if (driveMatch) {
        return { type: 'drive', id: driveMatch[1], embedUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview` };
    }

    // 5. Dailymotion
    const dailyRegExp = /(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/;
    const dailyMatch = url.match(dailyRegExp);
    if (dailyMatch) {
        return { type: 'dailymotion', id: dailyMatch[1], embedUrl: `https://www.dailymotion.com/embed/video/${dailyMatch[1]}` };
    }

    // 6. Loom
    const loomRegExp = /loom\.com\/(?:share|embed)\/([a-f0-9]+)/;
    const loomMatch = url.match(loomRegExp);
    if (loomMatch) {
        return { type: 'loom', id: loomMatch[1], embedUrl: `https://www.loom.com/embed/${loomMatch[1]}` };
    }

    // 7. Wistia
    const wistiaRegExp = /(?:wistia\.com\/medias\/|fast\.wistia\.net\/embed\/iframe\/)([a-zA-Z0-9]+)/;
    const wistiaMatch = url.match(wistiaRegExp);
    if (wistiaMatch) {
        return { type: 'wistia', id: wistiaMatch[1], embedUrl: `https://fast.wistia.net/embed/iframe/${wistiaMatch[1]}` };
    }

    // 8. Twitch
    const twitchRegExp = /twitch\.tv\/videos\/([0-9]+)/;
    const twitchMatch = url.match(twitchRegExp);
    if (twitchMatch) {
        const domain = window.location.hostname;
        return { type: 'twitch', id: twitchMatch[1], embedUrl: `https://player.twitch.tv/?video=${twitchMatch[1]}&parent=${domain}&autoplay=false` };
    }

    // 9. Dropbox (Transform to direct streamable link)
    const dropboxRegExp = /dropbox\.com\/s\/([a-zA-Z0-9]+)\/([^\?]+)/;
    const dropboxMatch = url.match(dropboxRegExp);
    if (dropboxMatch) {
        const directUrl = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace(/\?dl=[01]/, '') + (url.includes('?') ? '&raw=1' : '?raw=1');
        return { type: 'dropbox', embedUrl: directUrl, isDirect: true };
    }

    return null;
};

const VideoPlayer = ({ lecture, expanded, onToggle }) => {
    const renderVideo = () => {
        if (lecture.videoType === 'url') {
            const embedInfo = getVideoEmbedInfo(lecture.url);
            if (embedInfo) {
                if (embedInfo.isDirect) {
                    return (
                        <video
                            src={embedInfo.embedUrl}
                            controls
                            autoPlay={false}
                            className="w-full max-h-[480px] object-contain"
                            preload="metadata"
                            title={lecture.label}
                        />
                    );
                }
                return (
                    <div className="aspect-video w-full">
                        <iframe
                            className="w-full h-full"
                            src={embedInfo.embedUrl}
                            title={lecture.label}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        ></iframe>
                    </div>
                );
            }
            return (
                <div className="p-12 text-center bg-slate-900 flex flex-col items-center justify-center gap-4">
                    <Video className="w-12 h-12 text-purple-500/50" />
                    <div className="space-y-1">
                        <p className="text-white font-bold">External Lecture Video</p>
                        <p className="text-slate-400 text-sm">This video is hosted on an external platform.</p>
                    </div>
                    <a 
                        href={lecture.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-2 px-8 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition shadow-lg shadow-purple-500/20 active:scale-95"
                    >
                        Open Video Link
                    </a>
                </div>
            );
        }

        return (
            <video
                src={lecture.url}
                controls
                autoPlay={false}
                className="w-full max-h-[480px] object-contain"
                preload="metadata"
                title={lecture.label}
            />
        );
    };

    return (
        <div className="mt-4">
            <button
                onClick={onToggle}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-all shadow-md shadow-purple-200 active:scale-[0.98]"
            >
                <Video className="w-4 h-4" />
                {expanded ? `Hide ${lecture.label || 'Lecture'}` : `Watch ${lecture.label || 'Lecture'}`}
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {expanded && (
                <div className="mt-3 rounded-2xl overflow-hidden bg-black shadow-xl animate-in fade-in zoom-in-95 duration-300">
                    {renderVideo()}
                    <div className="px-4 py-3 bg-slate-900 text-slate-400 text-xs flex flex-col gap-1 border-t border-slate-800">
                        <div className="flex items-center gap-2">
                            <Video className="w-3.5 h-3.5 text-purple-400" />
                            <span className="font-bold text-slate-200">{lecture.label}</span>
                        </div>
                        <div className="flex items-center gap-3 ml-5 opacity-75">
                            <span className="truncate">{lecture.originalName || (lecture.videoType === 'url' ? 'External Link' : '')}</span>
                            {lecture.uploadedAt && <span>• Uploaded {new Date(lecture.uploadedAt).toLocaleDateString()}</span>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


const TopicDisplay = ({ classroomId }) => {
    const [currentTopic, setCurrentTopic] = useState(null);
    const [allTopics, setAllTopics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showPaidTopics, setShowPaidTopics] = useState(false);
    const [topicStatus, setTopicStatus] = useState(null); // { paidTopics, unpaidTopics, totalUnpaidAmount, allTopics }
    const [paying, setPaying] = useState(false);
    const [activeVideoId, setActiveVideoId] = useState(null);
    const { user } = useAuth();


    useEffect(() => {
        if (classroomId) {
            fetchCurrentTopic();
            fetchTopicStatus();
        }
    }, [classroomId]);

    // Fetch paid/unpaid topics and total
    const fetchTopicStatus = async () => {
        try {
            const resp = await api.get(`/payments/topic-status/${classroomId}`);
            setTopicStatus(resp.data);
        } catch (err) {
            setTopicStatus(null);
        }
    };

    const loadPaystackScript = () => {
        return new Promise((resolve, reject) => {
            if (window.PaystackPop) return resolve();
            const script = document.createElement('script');
            script.src = 'https://js.paystack.co/v1/inline.js';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Paystack script'));
            document.body.appendChild(script);
        });
    };

    const handlePaymentSuccess = async (reference) => {
        try {
            await api.get(`/payments/paystack/verify?reference=${encodeURIComponent(reference)}`);
            import('react-hot-toast').then(({ toast }) => toast.success('Payment successful! Access granted.'));
            fetchTopicStatus();
        } catch (err) {
            console.error('Verification failed', err);
            import('react-hot-toast').then(({ toast }) => toast.error('Payment verification failed. Please contact support.'));
        } finally {
            setPaying(false);
        }
    };

    // Payment handlers
    const handlePayForTopic = async (topicId) => {
        setPaying(true);
        try {
            const topic = topicStatus.allTopics.find(t => t._id === topicId);
            const amount = topic.price;

            // 1. Initialize on server to get reference
            const resp = await api.post('/payments/paystack/initiate', {
                amount,
                classroomId,
                topicId,
                type: 'topic_access'
            });

            if (resp.data.reference) {
                // 2. Load and open Paystack Inline
                await loadPaystackScript();

                const pubKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
                const payAmount = (import.meta.env.VITE_PAYSTACK_CURRENCY || 'NGN').toLowerCase() === 'ngn' ? Math.round(amount * 100) : Math.round(amount * 100);

                if (!user || !user.email) {
                    throw new Error('User email not available. Please log in before paying.');
                }

                const handleCallback = (response) => {
                    handlePaymentSuccess(response.reference);
                };

                const handler = window.PaystackPop.setup({
                    key: pubKey,
                    email: user.email,
                    amount: payAmount,
                    ref: resp.data.reference,
                    callback: handleCallback,
                    onClose: () => setPaying(false)
                });

                if (handler && typeof handler.openIframe === 'function') {
                    handler.openIframe();
                } else if (handler && typeof handler.open === 'function') {
                    handler.open();
                } else {
                    throw new Error('Could not open Paystack payment window.');
                }
            }
        } catch (err) {
            console.error('Payment initialization failed', err);
            const errMsg = err.response?.data?.message || err.message || 'Could not start payment.';
            import('react-hot-toast').then(({ toast }) => toast.error(errMsg));
            setPaying(false);
        }
    };

    const handlePayForAllTopics = async () => {
        setPaying(true);
        try {
            const unpaidTopicIds = topicStatus.unpaidTopics.map(t => t._id);
            const resp = await api.post('/payments/paystack/initiate', {
                amount: topicStatus.totalUnpaidAmount,
                classroomId,
                topicIds: unpaidTopicIds,
                type: 'topic_access'
            });

            if (resp.data.reference) {
                await loadPaystackScript();

                const pubKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
                const payAmount = (import.meta.env.VITE_PAYSTACK_CURRENCY || 'NGN').toLowerCase() === 'ngn' ? Math.round(topicStatus.totalUnpaidAmount * 100) : Math.round(topicStatus.totalUnpaidAmount * 100);

                if (!user || !user.email) {
                    throw new Error('User email not available. Please log in before paying.');
                }

                const handleCallback = (response) => {
                    handlePaymentSuccess(response.reference);
                };

                const handler = window.PaystackPop.setup({
                    key: pubKey,
                    email: user.email,
                    amount: payAmount,
                    ref: resp.data.reference,
                    callback: handleCallback,
                    onClose: () => setPaying(false)
                });

                if (handler && typeof handler.openIframe === 'function') {
                    handler.openIframe();
                } else if (handler && typeof handler.open === 'function') {
                    handler.open();
                } else {
                    throw new Error('Could not open Paystack payment window.');
                }
            }
        } catch (err) {
            console.error('Payment initialization failed', err);
            const errMsg = err.response?.data?.message || err.message || 'Could not start payment.';
            import('react-hot-toast').then(({ toast }) => toast.error(errMsg));
            setPaying(false);
        }
    };

    const fetchCurrentTopic = async () => {
        try {
            const response = await api.get(`/topics/classroom/${classroomId}/current`);
            setCurrentTopic(response.data.currentTopic);
            // Fetch paid topic visibility + full topic list (to get recordedVideo data)
            const topicsResp = await api.get(`/topics/classroom/${classroomId}`);
            setShowPaidTopics(topicsResp.data.showPaidTopics);
            setAllTopics(topicsResp.data.topics || []);
        } catch (error) {
            console.error('Error fetching current topic:', error);
        } finally {
            setLoading(false);
        }
    };

    const getDurationText = (duration) => {
        if (!duration || duration.mode === 'not_sure') return null;
        return `${duration.value} ${duration.mode}${duration.value > 1 ? 's' : ''}`;
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed':
                return 'text-green-600 bg-green-50 border-green-200';
            case 'active':
                return 'text-blue-600 bg-blue-50 border-blue-200';
            default:
                return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="w-5 h-5" />;
            case 'active':
                return <Clock className="w-5 h-5 animate-pulse" />;
            default:
                return <Circle className="w-5 h-5" />;
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            </div>
        );
    }

    if (!currentTopic) {
        return (
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg shadow-md p-6 border-2 border-dashed border-gray-300">
                <div className="flex items-center space-x-3 text-gray-500">
                    <Book className="w-6 h-6" />
                    <div>
                        <p className="font-medium">No Active Topic</p>
                        <p className="text-sm">Topics will appear here when activated</p>
                    </div>
                </div>
            </div>
        );
    }

    // Merge recordedVideos data from full topic list (the /current endpoint may not include it)
    const enrichedCurrentTopic = (() => {
        const full = allTopics.find(t => t._id === currentTopic._id);
        const videos = (full ? full.recordedVideos : currentTopic.recordedVideos) || [];
        return { ...currentTopic, recordedVideos: videos };
    })();

    const recordedVideos = enrichedCurrentTopic.recordedVideos || [];
    const hasCurrentVideos = recordedVideos.length > 0;

    return (
        <div className={`bg-white rounded-lg shadow-md p-6 border-2 ${getStatusColor(currentTopic.status)}`}>
            <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                    <div className={`mt-1 ${getStatusColor(currentTopic.status)}`}>
                        {getStatusIcon(currentTopic.status)}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center flex-wrap gap-2 mb-1">
                            <h3 className="text-lg font-bold text-gray-800">{currentTopic.name}</h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(currentTopic.status)}`}>
                                {currentTopic.status === 'active' ? 'Current Topic' : currentTopic.status}
                            </span>
                            {hasCurrentVideos && (
                                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold flex items-center gap-1">
                                    <Video className="w-3 h-3" /> {recordedVideos.length} Lecture{recordedVideos.length !== 1 ? 's' : ''} available
                                </span>
                            )}
                        </div>

                        {currentTopic.description && (
                            <p className="text-gray-600 mb-3">{currentTopic.description}</p>
                        )}

                        {currentTopic.lessonsOutline && (
                            <div className="mb-3 p-3 bg-indigo-50 border border-indigo-100 rounded-md">
                                <h5 className="text-sm font-semibold text-indigo-900 mb-1">Lesson Outline</h5>
                                <p className="text-gray-700 text-sm whitespace-pre-wrap">{currentTopic.lessonsOutline}</p>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                            {getDurationText(currentTopic.duration) && (
                                <div className="flex items-center space-x-1">
                                    <Clock className="w-4 h-4" />
                                    <span>Duration: {getDurationText(currentTopic.duration)}</span>
                                </div>
                            )}

                            {currentTopic.startedAt && (
                                <div className="flex items-center space-x-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>Started: {formatDisplayDate(currentTopic.startedAt)}</span>
                                </div>
                            )}

                            {currentTopic.expectedEndDate && currentTopic.status === 'active' && (
                                <div className="flex items-center space-x-1">
                                    <Calendar className="w-4 h-4" />
                                    <span className="font-medium text-indigo-600">
                                        Expected End: {formatDisplayDate(currentTopic.expectedEndDate)}
                                    </span>
                                </div>
                            )}

                            {/* Only show paid topic price if allowed */}
                            {showPaidTopics && currentTopic.isPaid && currentTopic.price > 0 && (
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                                    ₦{currentTopic.price}
                                </span>
                            )}
                        </div>

                        {/* ── Recorded Lecture Video for Current Topic ── */}
                        {/* Video Players */}
                        {hasCurrentVideos && (
                            <div className="space-y-4 mt-4">
                                {[...recordedVideos].sort((a,b) => (a.order || 0) - (b.order || 0)).map((lecture, idx) => (
                                    <VideoPlayer 
                                        key={lecture._id || idx} 
                                        lecture={lecture} 
                                        expanded={activeVideoId === (lecture._id || idx)}
                                        onToggle={() => setActiveVideoId(activeVideoId === (lecture._id || idx) ? null : (lecture._id || idx))}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Paid/Unpaid Topics and Payment Options */}
            {user && !['root_admin', 'school_admin', 'personal_teacher', 'teacher'].includes(user.role) && showPaidTopics && topicStatus && (
                <div className="mt-6">
                    <h4 className="font-semibold mb-2">Your Topic Access</h4>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {topicStatus.allTopics.map(topic => (
                            <span key={topic._id} className={`px-2 py-1 rounded-full text-xs font-semibold ${topic.isPaid ? 'bg-green-200 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                {topic.name} {topic.isPaid ? '✓' : `₦${topic.price}`}
                                {!topic.isPaid && topic.price > 0 && (
                                    <button
                                        className="ml-2 px-2 py-0.5 bg-purple-600 text-white rounded text-xs"
                                        disabled={paying}
                                        onClick={() => handlePayForTopic(topic._id)}
                                    >
                                        Pay
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>
                    {topicStatus.unpaidTopics.length > 1 && topicStatus.totalUnpaidAmount > 0 && (
                        <button
                            className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
                            disabled={paying}
                            onClick={handlePayForAllTopics}
                        >
                            Pay for all unpaid topics (₦{topicStatus.totalUnpaidAmount})
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default TopicDisplay;
