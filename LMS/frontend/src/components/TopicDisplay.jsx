import React, { useEffect, useState } from 'react';
import { Book, Clock, CheckCircle, Circle, Calendar, Video, ChevronDown, ChevronUp, X, Play, Pause, Lock } from 'lucide-react';
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

const TopicDisplay = ({ classroomId }) => {
    const [currentTopic, setCurrentTopic] = useState(null);
    const [allTopics, setAllTopics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showPaidTopics, setShowPaidTopics] = useState(false);
    const [topicStatus, setTopicStatus] = useState(null);
    const [paying, setPaying] = useState(false);
    const [activeVideoId, setActiveVideoId] = useState(null);
    const [watchedVideoIds, setWatchedVideoIds] = useState(new Set());
    const [videoOpen, setVideoOpen] = useState(false);
    const { user } = useAuth();


    const saveWatched = async (id) => {
        // Optimistic local update
        setWatchedVideoIds(prev => {
            const next = new Set(prev);
            if (!next.has(id)) {
                next.add(id);
            }
            return next;
        });

        // Backend persistence
        if (currentTopic?._id) {
            try {
                await api.post(`/topics/${currentTopic._id}/progress`, {
                    videoId: id,
                    isLastActive: true
                });
                // Also update localStorage as secondary cache
                localStorage.setItem(`lms_watched_${classroomId}_${currentTopic._id}`, JSON.stringify([...watchedVideoIds, id]));
                localStorage.setItem(`lms_vplay_${classroomId}_${currentTopic._id}`, id);
            } catch (err) {
                console.error("Failed to save progress to DB", err);
            }
        }
    };

    const handleVideoSelect = (id) => {
        setActiveVideoId(id);
        saveWatched(id);
    };

    useEffect(() => {
        if (classroomId) {
            fetchCurrentTopic();
            fetchTopicStatus();
        }
    }, [classroomId]);

    const enrichedCurrentTopic = currentTopic ? (() => {
        const full = allTopics.find(t => t._id === (currentTopic._id || currentTopic));
        const videos = (full ? full.recordedVideos : currentTopic.recordedVideos) || [];
        return { ...currentTopic, recordedVideos: videos };
    })() : null;

    const recordedVideos = enrichedCurrentTopic?.recordedVideos || [];
    const hasCurrentVideos = recordedVideos.length > 0;
    const sortedVideos = [...recordedVideos].sort((a, b) => (a.order || 0) - (b.order || 0));

    // Persist and load active/watched video
    useEffect(() => {
        const loadProgress = async () => {
            if (hasCurrentVideos && currentTopic?._id) {
                try {
                    // 1. Try fetching from DB
                    const { data } = await api.get(`/topics/${currentTopic._id}/progress`);
                    const progress = data.progress;
                    
                    if (progress && progress.watchedVideoIds?.length > 0) {
                        setWatchedVideoIds(new Set(progress.watchedVideoIds));
                        if (progress.lastActiveVideoId) {
                            setActiveVideoId(progress.lastActiveVideoId);
                        } else {
                            setActiveVideoId(sortedVideos[0]._id || 0);
                        }
                        return; // Successfully loaded from DB
                    }
                } catch (err) {
                    console.error("Failed to fetch progress from DB, falling back to local", err);
                }

                // 2. Fallback to LocalStorage if DB is empty or fails
                const storageKey = `lms_vplay_${classroomId}_${currentTopic._id}`;
                const watchedKey = `lms_watched_${classroomId}_${currentTopic._id}`;
                
                const savedId = localStorage.getItem(storageKey);
                const savedWatched = localStorage.getItem(watchedKey);

                if (savedWatched) {
                    try {
                        setWatchedVideoIds(new Set(JSON.parse(savedWatched)));
                    } catch (e) {}
                }
                
                if (savedId && sortedVideos.some(v => (v._id || 0) === savedId)) {
                    setActiveVideoId(savedId);
                } else if (sortedVideos.length > 0) {
                    const firstId = sortedVideos[0]._id || 0;
                    setActiveVideoId(firstId);
                    saveWatched(firstId);
                }
            }
        };
        
        loadProgress();
    }, [hasCurrentVideos, currentTopic?._id, classroomId]);

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

    const handlePayForTopic = async (topicId) => {
        setPaying(true);
        try {
            const topic = topicStatus.allTopics.find(t => t._id === topicId);
            const amount = topic.price;

            const resp = await api.post('/payments/paystack/initiate', {
                amount,
                classroomId,
                topicId,
                type: 'topic_access'
            });

            if (resp.data.reference) {
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
                return 'text-emerald-600 bg-emerald-50 border-emerald-200';
            case 'active':
                return 'text-indigo-600 bg-indigo-50 border-indigo-200';
            default:
                return 'text-slate-600 bg-slate-50 border-slate-200';
        }
    };

    const renderCurrentVideo = (vid, idx) => {
        if (!vid) return null;
        if (vid.videoType === 'url') {
            const embedInfo = getVideoEmbedInfo(vid.url);
            if (embedInfo) {
                if (embedInfo.isDirect) {
                    return (
                        <video
                            src={embedInfo.embedUrl}
                            controls
                            autoPlay={false}
                            className="w-full max-h-[600px] object-contain"
                            preload="metadata"
                            title={vid.label || `Lecture ${idx + 1}`}
                        />
                    );
                }
                return (
                    <div className="aspect-video w-full h-full min-h-[500px]">
                        <iframe
                            className="w-full h-full"
                            src={embedInfo.embedUrl}
                            title={vid.label || `Lecture ${idx + 1}`}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        ></iframe>
                    </div>
                );
            }
            return (
                <div className="p-8 text-center bg-slate-900 border-b border-slate-800 flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                        <Video className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-white text-xs font-bold">External Lecture Video</p>
                    <a
                        href={vid.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 px-6 py-3 bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black border border-slate-700 transition-all flex items-center gap-3 group"
                    >
                        <span>Open Resource</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </a>
                </div>
            );
        }

        return (
            <video
                src={vid.url}
                controls
                autoPlay={false}
                className="w-full max-h-[600px] object-contain"
                preload="metadata"
                title={vid.label || `Lecture ${idx + 1}`}
            />
        );
    }

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-sm p-8 animate-pulse border border-slate-100">
                <div className="flex items-start gap-5 mb-6">
                    <div className="flex-1">
                        <div className="h-2 bg-slate-100 rounded-full w-24 mb-3"></div>
                        <div className="h-8 bg-slate-50 rounded-2xl w-2/3"></div>
                    </div>
                </div>
                <div className="bg-slate-50 rounded-3xl h-[600px] border border-slate-100"></div>
            </div>
        );
    }

    if (!currentTopic) {
        return (
            <div className="bg-white rounded-3xl shadow-sm p-12 border-2 border-dashed border-slate-200 text-center flex flex-col items-center gap-5">
                <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 shadow-sm">
                    <Book className="w-10 h-10 text-slate-200" />
                </div>
                <div>
                   <p className="font-black text-slate-800 text-2xl tracking-tight">Focusing on your Future</p>
                   <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto font-medium">Your instructor is preparing the upcoming lecture topic. Please check back shortly for updates.</p>
                </div>
                <button className="mt-4 px-6 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-black transition-all">
                    View Course Details
                </button>
            </div>
        );
    }

    return (
        <div className={`bg-white rounded-2xl shadow-sm p-8 border-t-4 transition-all ${currentTopic.status === 'active' ? 'border-slate-400' : 'border-slate-200'}`}>
            <div className="flex flex-col gap-6">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center flex-wrap gap-3 mb-3">
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">{currentTopic.name}</h3>
                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-200`}>
                                {currentTopic.status === 'active' ? 'Current Focus' : currentTopic.status}
                            </span>
                            {hasCurrentVideos && (
                                <span className="px-3 py-1 bg-slate-50 text-slate-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-100">
                                    {recordedVideos.length} Chapters
                                </span>
                            )}
                        </div>

                        {currentTopic.description && (
                            <p className="text-slate-500 text-lg leading-relaxed max-w-4xl">{currentTopic.description}</p>
                        )}
                    </div>
                </div>

                {/* THEATER MODE - ALWAYS ON FOR TOPICS WITH VIDEOS */}
                {hasCurrentVideos && (
                    <div className="bg-slate-900 rounded-3xl md:rounded-[2rem] overflow-hidden shadow-xl p-2 md:p-5 border border-slate-800 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex flex-col lg:flex-row gap-4 md:gap-5">
                            {/* Main Cinematic Player - MAX WIDTH ON MOBILE */}
                            <div className="flex-1 bg-black rounded-2xl md:rounded-3xl overflow-hidden shadow-inner relative min-h-[250px] md:min-h-[500px] lg:min-h-[580px] flex items-center justify-center border border-slate-800/50">
                                {activeVideoId !== null ? (
                                    (() => {
                                        const v = sortedVideos.find((vid, i) => (vid._id || i) === activeVideoId);
                                        const idx = sortedVideos.findIndex((vid, i) => (vid._id || i) === activeVideoId);
                                        return renderCurrentVideo(v, idx);
                                    })()
                                ) : (
                                    <div className="p-12 text-center text-slate-600 flex flex-col items-center gap-4">
                                        <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center">
                                            <Play className="w-6 h-6 opacity-20" />
                                        </div>
                                        <p className="text-sm font-medium">Select a chapter below</p>
                                    </div>
                                )}
                            </div>

                            {/* Playlist - CAROUSEL ON MOBILE, SIDEBAR ON DESKTOP */}
                            <div className="lg:w-72 shrink-0 flex flex-row lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto pb-4 lg:pb-0 pr-1 snap-x scrollbar-hide lg:custom-scrollbar">
                                <div className="hidden lg:block px-2 mb-2 border-b border-slate-800/50 pb-2">
                                    <h5 className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-500">Course Materials</h5>
                                </div>
                                
                                {sortedVideos.map((vid, idx) => {
                                    const vId = vid._id || idx;
                                    const isActive = activeVideoId === vId;
                                    const isWatched = watchedVideoIds.has(vId);
                                    return (
                                        <div 
                                            key={vId} 
                                            onClick={() => handleVideoSelect(vId)}
                                            className={`group flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer transition-all duration-200 border-2 snap-start shrink-0 w-[240px] lg:w-full ${
                                                isActive 
                                                    ? 'bg-slate-800 border-slate-700 shadow-lg translate-x-0 lg:translate-x-1' 
                                                    : 'bg-transparent border-transparent hover:bg-slate-800/40 hover:border-slate-800'
                                            }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                                                isActive ? 'bg-white text-slate-900 border-white' : isWatched ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-slate-800 text-slate-500 border-slate-700'
                                            }`}>
                                                {isActive ? <Pause className="w-3 h-3 fill-current" /> : isWatched ? <CheckCircle className="w-4 h-4" /> : <div className="text-[10px] font-bold">{idx + 1}</div>}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-[11px] font-bold truncate leading-tight ${isActive ? 'text-white' : isWatched ? 'text-slate-300' : 'text-slate-400 group-hover:text-slate-200'}`}>
                                                    {vid.label || `Lecture ${idx + 1}`}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-[8px] font-black uppercase tracking-widest ${isActive ? 'text-slate-400' : isWatched ? 'text-emerald-500' : 'text-slate-600'}`}>{isWatched ? 'Watched' : `Part ${idx + 1}`}</span>
                                                    <div className={`w-0.5 h-0.5 rounded-full ${isActive ? 'bg-slate-600' : isWatched ? 'bg-emerald-500/30' : 'bg-slate-800'}`} />
                                                    <span className={`text-[8px] font-bold truncate ${isActive ? 'text-slate-500' : 'text-slate-700'}`}>{vid.videoType === 'url' ? 'Link' : 'File'}</span>
                                                </div>
                                            </div>
                                            {isActive && (
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse mr-1" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    {currentTopic.lessonsOutline && (
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-white rounded-xl border border-slate-100">
                                    <Book className="w-4 h-4 text-slate-500" />
                                </div>
                                <h5 className="font-bold text-slate-800 uppercase tracking-widest text-[9px]">Module Outline</h5>
                            </div>
                            <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed px-1">{currentTopic.lessonsOutline}</p>
                        </div>
                    )}

                    <div className="flex flex-col gap-6">
                        <div className="grid grid-cols-2 gap-4">
                            {getDurationText(currentTopic.duration) && (
                                <div className="p-4 bg-white border border-slate-100 rounded-xl">
                                    <div className="flex items-center gap-2 mb-1.5 px-1">
                                        <Clock className="w-3.5 h-3.5 text-slate-300" />
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Total Duration</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-700 px-1">{getDurationText(currentTopic.duration)}</p>
                                </div>
                            )}

                            {currentTopic.startedAt && (
                                <div className="p-4 bg-white border border-slate-100 rounded-xl">
                                    <div className="flex items-center gap-2 mb-1.5 px-1">
                                        <Calendar className="w-3.5 h-3.5 text-slate-300" />
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Launch Date</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-700 px-1">{formatDisplayDate(currentTopic.startedAt)}</p>
                                </div>
                            )}
                        </div>

                        {currentTopic.expectedEndDate && currentTopic.status === 'active' && (
                            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-3 text-slate-400 mb-2">
                                    <Calendar className="w-4 h-4" />
                                    <span className="text-[9px] font-bold uppercase tracking-widest">Completion Target</span>
                                </div>
                                <p className="text-slate-700 text-lg font-black">{formatDisplayDate(currentTopic.expectedEndDate)}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {user && !['root_admin', 'school_admin', 'personal_teacher', 'teacher'].includes(user.role) && showPaidTopics && topicStatus && (
                <div className="mt-12 pt-8 border-t border-slate-100">
                    <h4 className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2">
                        <CheckCircle className="w-3 h-3" /> Progress Markers
                    </h4>
                    <div className="flex flex-wrap gap-2.5">
                        {topicStatus.allTopics.map(topic => (
                            <div key={topic._id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${topic.isPaid ? 'bg-slate-50 border-slate-100 text-slate-700' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                                <div className={`p-1 rounded-md ${topic.isPaid ? 'bg-slate-200 text-slate-600' : 'bg-slate-200 text-slate-400'}`}>
                                    {topic.isPaid ? <CheckCircle className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                </div>
                                <span className="text-[10px] font-bold">{topic.name}</span>
                                {!topic.isPaid && topic.price > 0 && (
                                    <button
                                        className="ml-2 px-3 py-1 bg-slate-800 text-white rounded-lg text-[9px] font-bold hover:bg-black transition"
                                        disabled={paying}
                                        onClick={() => handlePayForTopic(topic._id)}
                                    >
                                        UNLOCK ₦{topic.price}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    {topicStatus.unpaidTopics.length > 1 && topicStatus.totalUnpaidAmount > 0 && (
                        <button
                            className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-black disabled:opacity-50"
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
