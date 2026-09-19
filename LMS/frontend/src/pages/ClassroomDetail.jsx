import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useParams, useNavigate } from 'react-router-dom';
import { Video, Edit, Plus, Calendar, Users, User, Book, BookOpen, DollarSign, X, UserPlus, FileText, CheckCircle, Send, ChevronDown, ChevronUp, ChevronRight, GripVertical, Trash2, Loader2, Clock, ExternalLink, Globe, Share2, Facebook, Twitter, Linkedin, Copy, Play, Pause, Circle, FastForward, Eye, EyeOff, Megaphone, Flag, CreditCard, School, GraduationCap, Layers, Sparkles, MessageSquare, MoreHorizontal, Building2, LogOut, Pencil, PenSquare } from 'lucide-react';
import { convertLocalToUTC, convertUTCToLocal, formatDisplayDate } from '../utils/timezone';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatAmount } from '../utils/currency';
import FormFieldHelp from '../components/FormFieldHelp';
import AIAssistantPanel from '../components/AIAssistantPanel';
import CreateAssignmentModal from '../components/CreateAssignmentModal';
import GradeAssignmentModal from '../components/GradeAssignmentModal';
import SubmitAssignmentModal from '../components/SubmitAssignmentModal';
import TopicDisplay from '../components/TopicDisplay';
import GoogleMeetAuth from '../components/GoogleMeetAuth';
import PaymentRequiredModal from '../components/PaymentRequiredModal';
import ConfirmationModal from '../components/ConfirmationModal';
import QnABoardManagement from '../components/QnABoardManagement';
import CreateExamModal from '../components/CreateExamModal';
import { consumeGracyPrefill } from '../utils/gracyPrefill';

// subjectOptions converted to dynamic state inside component


const levelOptions = [
  { value: 'Pre-Primary', label: 'Pre-Primary' },
  { value: 'Primary', label: 'Primary' },
  { value: 'High School', label: 'High School' },
  { value: 'Pre-University', label: 'Pre-University' },
  { value: 'Undergraduate', label: 'Undergraduate' },
  { value: 'Postgraduate', label: 'Postgraduate' },
  { value: 'Professional', label: 'Professional' },
  { value: 'Vocational', label: 'Vocational' },
  { value: 'Other', label: 'Other' },
];

const defaultSubjects = [
  'Mathematics', 'English', 'Physics', 'Chemistry', 'Biology',
  'Computer Science', 'History', 'Geography', 'Economics',
  'Literature', 'Art', 'Music', 'Physical Education'
];

const toDatetimeLocal = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

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

// ─── Inline topic card with collapsible video player ────────────────────────
const TopicCardWithVideo = ({ topic, isCurrent, isDone, isNext, isPending }) => {
  const { classroomId } = useParams();
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [watchedVideoIds, setWatchedVideoIds] = useState(new Set());
  const recordedVideos = topic.recordedVideos || [];
  const hasVideos = recordedVideos.length > 0;

  const saveWatched = async (id) => {
    // Optimistic UI update
    setWatchedVideoIds(prev => {
        const next = new Set(prev);
        if (!next.has(id)) {
            next.add(id);
        }
        return next;
    });

    // DB Persistence
    if (topic?._id) {
        try {
            await api.post(`/topics/${topic._id}/progress`, {
                videoId: id,
                isLastActive: true
            });
            // Update local cache as secondary
            localStorage.setItem(`lms_watched_${classroomId}_${topic._id}`, JSON.stringify([...watchedVideoIds, id]));
            localStorage.setItem(`lms_vplay_${classroomId}_${topic._id}`, id);
        } catch (err) {
            console.error("Failed to sync progress to DB", err);
        }
    }
  };

  const handleVideoSelect = (id) => {
    setActiveVideoId(id);
    saveWatched(id);
  };

  // Load and persist watched/active state
  useEffect(() => {
    const fetchProgress = async () => {
        if (hasVideos && topic?._id) {
            // 1. Primary: Fetch from server
            try {
                const { data } = await api.get(`/topics/${topic._id}/progress`);
                const progress = data.progress;
                if (progress && progress.watchedVideoIds?.length > 0) {
                    setWatchedVideoIds(new Set(progress.watchedVideoIds));
                    if (progress.lastActiveVideoId) {
                        setActiveVideoId(progress.lastActiveVideoId);
                    } else {
                        const firstVid = [...recordedVideos].sort((a,b) => (a.order||0)-(b.order||0))[0];
                        setActiveVideoId(firstVid._id || 0);
                    }
                    return; // Successfully synced with cloud
                }
            } catch (err) {
                console.error("Cloud progress fetch failed, using local fallback", err);
            }

            // 2. Secondary: Fallback to LocalStorage
            const storageKey = `lms_vplay_${classroomId}_${topic._id}`;
            const watchedKey = `lms_watched_${classroomId}_${topic._id}`;
            
            const savedId = localStorage.getItem(storageKey);
            const savedWatched = localStorage.getItem(watchedKey);

            if (savedWatched) {
                try {
                    setWatchedVideoIds(new Set(JSON.parse(savedWatched)));
                } catch (e) {}
            }

            if (savedId && recordedVideos.some((v, idx) => (v._id || idx) === savedId)) {
                setActiveVideoId(savedId);
            } else if (recordedVideos.length > 0) {
                const firstVid = [...recordedVideos].sort((a,b) => (a.order||0)-(b.order||0))[0];
                const firstId = firstVid._id || 0;
                setActiveVideoId(firstId);
                saveWatched(firstId);
            }
        }
    };
    
    fetchProgress();
  }, [hasVideos, topic?._id, classroomId]);

  const renderVideo = (vid, idx) => {
    const embedInfo = vid.videoType === 'url' ? getVideoEmbedInfo(vid.url) : null;

    if (vid.videoType === 'url') {
      if (embedInfo) {
        if (embedInfo.isDirect) {
          return (
            <video
              src={embedInfo.embedUrl}
              controls
              autoPlay={false}
              className="w-full max-h-[380px] object-contain"
              preload="metadata"
              title={vid.label || `Lecture ${idx + 1}`}
            />
          );
        }
        return (
          <div className="aspect-video w-full">
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
        <div className="p-12 text-center bg-slate-950 h-full w-full flex flex-col items-center justify-center gap-4">
          <div className="w-20 h-20 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-none">
             <Video className="w-8 h-8 text-slate-500" />
          </div>
          <div className="space-y-1">
              <p className="text-white text-lg font-semibold tracking-tight">External Stream</p>
              <p className="text-slate-500 text-sm max-w-xs mx-auto">This content is hosted on a secure 3rd-party platform.</p>
          </div>
          <a
              href={vid.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 px-6 py-3 bg-slate-800 text-white rounded-xl text-xs font-semibold tracking-wide hover:bg-black border border-slate-700 transition-all flex items-center gap-3 group shadow-none"
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
        className="w-full max-h-[380px] object-contain"
        preload="metadata"
        title={vid.label || `Lecture ${idx + 1}`}
      />
    );
  };

  return (
    <div
      className={`border-2 rounded-xl p-4 transition ${
        isCurrent ? 'border-primary/40 bg-primary/10 shadow-none' :
        isDone ? 'border-emerald-500/20 bg-emerald-500/5 opacity-80' :
        isNext ? 'border-primary/40 bg-primary/10 shadow-none' :
        'border-border bg-card hover:border-border/80'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1 flex-shrink-0">
          {isDone ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : isCurrent ? (
            <Clock className="w-5 h-5 text-blue-600 animate-pulse" />
          ) : isNext ? (
            <Play className="w-5 h-5 text-primary" />
          ) : (
            <Circle className="w-5 h-5 text-gray-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <h4 className="font-semibold text-foreground">{topic.name}</h4>
            {isCurrent && (
              <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-semibold tracking-wider border border-primary/20">Current</span>
            )}
            {isDone && (
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-full text-xs font-semibold tracking-wider border border-emerald-500/20">Done</span>
            )}
            {isNext && (
              <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-semibold tracking-wider border border-primary/30">Next</span>
            )}
            {isPending && (
              <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs font-semibold tracking-wider border border-border">Pending</span>
            )}
            {hasVideos && (
              <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded-full text-xs font-semibold tracking-wider border border-purple-500/20 flex items-center gap-1">
                <Video className="w-3 h-3" /> {recordedVideos.length} Lecture{recordedVideos.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {topic.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{topic.description}</p>
          )}
          {topic.lessonsOutline && (
            <div className="mt-2 p-2 bg-muted rounded text-[11px] text-muted-foreground border border-border/50">
              <p className="font-semibold text-foreground/70 mb-1 tracking-wide text-xs">Lesson Outline:</p>
              <p className="line-clamp-3 whitespace-pre-wrap">{topic.lessonsOutline}</p>
            </div>
          )}

          {/* Persistent Theater Mode - ALWAYS ON FOR TOPICS WITH VIDEOS */}
          {hasVideos && (
            <div className="mt-4">
              <div className="mt-4 flex flex-col lg:flex-row gap-4 md:gap-5 bg-slate-900 rounded-xl md:rounded-xl overflow-hidden shadow-none p-2 md:p-5 border border-slate-800 animate-in fade-in zoom-in duration-300">
                {/* Main Player Section - MAX WIDTH ON MOBILE */}
                <div className="flex-1 bg-black rounded-xl md:rounded-xl overflow-hidden flex items-center justify-center min-h-[250px] md:min-h-[500px] lg:min-h-[600px] shadow-none relative border border-slate-800/50">
                  {activeVideoId !== null ? (
                    (() => {
                      const sorted = [...recordedVideos].sort((a, b) => (a.order || 0) - (b.order || 0));
                      const activeVid = sorted.find((v, idx) => (v._id || idx) === activeVideoId);
                      const activeIdx = sorted.findIndex((v, idx) => (v._id || idx) === activeVideoId);
                      return activeVid ? renderVideo(activeVid, activeIdx) : (
                        <div className="text-slate-500">Video not found</div>
                      );
                    })()
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-slate-500 p-8">
                      <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center">
                        <Play className="w-6 h-6 opacity-20" />
                      </div>
                      <p className="font-semibold text-sm">Select a chapter from the list</p>
                    </div>
                  )}
                </div>

                {/* Vertical Video List Sidebar - CAROUSEL ON MOBILE */}
                <div className="w-full lg:w-72 shrink-0 flex flex-row lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto pb-4 lg:pb-0 pr-1 snap-x scrollbar-hide lg:custom-scrollbar">
                  <div className="hidden lg:flex items-center justify-between mb-3 px-1 border-b border-slate-800 pb-2">
                      <h5 className="text-xs font-semibold tracking-wide text-slate-500">Course Materials</h5>
                      <span className="text-xs font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">{recordedVideos.length} Parts</span>
                  </div>
                  
                  {[...recordedVideos].sort((a, b) => (a.order || 0) - (b.order || 0)).map((vid, idx) => {
                    const vId = vid._id || idx;
                    const isActive = activeVideoId === vId;
                    const isWatched = watchedVideoIds.has(vId);
                    return (
                      <div 
                        key={vId} 
                        onClick={() => handleVideoSelect(vId)}
                        className={`group flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition-all duration-200 border-2 snap-start shrink-0 w-[240px] lg:w-full ${
                          isActive 
                            ? 'bg-slate-800 border-slate-700 shadow-none translate-x-0 lg:translate-x-1' 
                            : 'bg-transparent border-transparent hover:bg-slate-800/40 hover:border-slate-800'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                          isActive ? 'bg-white text-slate-900 border-white' : isWatched ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-slate-800 text-slate-500 border-slate-700'
                        }`}>
                          {isActive ? <Pause className="w-3 h-3 fill-current" /> : isWatched ? <CheckCircle className="w-4 h-4" /> : <div className="text-xs font-semibold">{idx + 1}</div>}
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <p className={`text-[11px] font-semibold truncate leading-tight ${isActive ? 'text-white' : isWatched ? 'text-slate-300' : 'text-slate-400 group-hover:text-slate-200'}`}>
                            {vid.label || `Lecture ${idx + 1}`}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[11px] font-semibold tracking-wide ${isActive ? 'text-slate-400' : isWatched ? 'text-emerald-500' : 'text-slate-600'}`}>{isWatched ? 'Watched' : `Part ${idx + 1}`}</span>
                              <div className={`w-0.5 h-0.5 rounded-full ${isActive ? 'bg-slate-500' : isWatched ? 'bg-emerald-500/30' : 'bg-slate-700'}`} />
                              <span className={`text-[11px] font-semibold ${isActive ? 'text-slate-500' : 'text-slate-700'}`}>{vid.videoType === 'url' ? 'Link' : 'File'}</span>
                          </div>
                        </div>

                        {isActive && (
                          <div className="w-1 h-1 rounded-full bg-primary animate-pulse mr-1" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};



// ─── Flat record card primitives (ClassRecord design language) ──────────────
const INK = '#14202E';
const NAVY = '#1D3557';
const SLATE = '#5B6B7C';
const HAIRLINE = '#DDE3E9';
const PAPER = '#FFFFFF';
const PANEL = '#F7F8FA';
const GOLD = '#A9791F';
const FOREST = '#2F6E4E';
const ROSE = '#A23B2E';

const primaryActionStyle = { backgroundColor: NAVY, color: PAPER, borderRadius: '2px' };
const outlineActionStyle = { backgroundColor: PAPER, color: INK, border: `1px solid ${HAIRLINE}`, borderRadius: '2px' };

function ActionButton({ icon: Icon, label, tone = 'default', onClick, disabled, loading }) {
  const tones = {
    default: { color: INK, border: HAIRLINE, bg: PAPER },
    danger: { color: ROSE, border: '#EBD3CE', bg: '#FCF5F3' },
    solid: { color: PAPER, border: INK, bg: INK },
  };
  const t = tones[tone];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60"
      style={{
        color: t.color,
        backgroundColor: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: '2px',
      }}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} strokeWidth={2} />}
      {label}
    </button>
  );
}

function OverflowMenu({ onEdit, onEnd, onDelete, showDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const items = [
    { icon: Pencil, label: 'Edit', color: INK, action: onEdit },
    { icon: Flag, label: 'End class', color: INK, action: onEnd },
    ...(showDelete ? [{ icon: Trash2, label: 'Delete', color: ROSE, action: onDelete }] : []),
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-center w-9 h-9"
        style={{ border: `1px solid ${HAIRLINE}`, backgroundColor: PAPER, borderRadius: '2px' }}
        aria-label="More actions"
      >
        <MoreHorizontal size={16} style={{ color: INK }} />
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 z-[60]"
          style={{
            backgroundColor: PAPER,
            border: `1px solid ${HAIRLINE}`,
            borderRadius: '2px',
            minWidth: '160px',
            boxShadow: '0 2px 6px rgba(20,32,46,0.08)',
          }}
        >
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => { setOpen(false); item.action && item.action(); }}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-left"
                style={{
                  color: item.color,
                  borderBottom: i < items.length - 1 ? `1px solid ${HAIRLINE}` : 'none',
                }}
              >
                <Icon size={15} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RecordField({ icon: Icon, label, children, borderRight }) {
  return (
    <div className={`flex items-start gap-3 px-5 py-4 min-w-0 ${borderRight ? 'sm:border-r sm:border-border' : ''}`}>
      <Icon size={17} strokeWidth={1.75} style={{ color: SLATE, marginTop: 2 }} />
      <div className="min-w-0">
        <div className="text-xs" style={{ color: SLATE }}>{label}</div>
        <div className="text-sm font-semibold mt-0.5 break-words" style={{ color: INK }}>{children}</div>
      </div>
    </div>
  );
}

const ClassroomDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: userLoading } = useAuth();
  const [classroom, setClassroom] = useState(null);
  const [whiteboardInfo, setWhiteboardInfo] = useState(null);
  const [currentCall, setCurrentCall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiMode, setAiMode] = useState('classroom');
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [subjectOptions, setSubjectOptions] = useState(defaultSubjects.map(s => ({ value: s, label: s }))); // Dynamic subjects
  const [editForm, setEditForm] = useState({ name: '', description: '', learningOutcomes: '', subject: '', level: 'Other', capacity: 30, pricingType: 'per_lecture', pricingAmount: 0, schedule: [], isPrivate: false, isPaid: false, teacherId: '', schoolIds: [], classFormat: 'classroom', publicAccess: { allowGuestAccess: false, durationValue: 1, durationUnit: 'days', startsAt: '', recordingUrl: '', joinInstructions: '' } });
  const [schools, setSchools] = useState([]);
  useEffect(() => {
    if (user?.role === 'school_admin') {
      api.get('/schools?adminId=' + user._id).then(res => setSchools(res.data.schools || []));
    }
  }, [user]);
  const [showGoogleAuth, setShowGoogleAuth] = useState(false);

  useEffect(() => {
    // Fetch dynamic subjects
    const fetchSubjects = async () => {
      try {
        const res = await api.get('/settings');
        if (res.data && res.data.subjects) {
          // Merge default subjects with fetched subjects and remove duplicates
          const uniqueSubjects = Array.from(new Set([...defaultSubjects, ...res.data.subjects]));
          // Sort alphabetically
          uniqueSubjects.sort();
          setSubjectOptions(uniqueSubjects.map(s => ({ value: s, label: s })));
        }
      } catch (err) {
        console.error('Error fetching subjects:', err);
      }
    };
    fetchSubjects();
  }, []);

  // Open edit modal and prefill form
  const handleOpenEdit = () => {
    setEditForm({
      name: classroom.name || '',
      description: classroom.description || '',
      learningOutcomes: classroom.learningOutcomes || '',
      subject: classroom.subject || '',
      level: classroom.level || 'Other',
      capacity: classroom.capacity || 30,
      pricingType: classroom.pricing?.type || 'per_lecture',
      pricingAmount: classroom.pricing?.amount || 0,
      isPaid: classroom.isPaid || false,
      schedule: (classroom.schedule || []).map(s => {
        const local = convertUTCToLocal(s.dayOfWeek, s.startTime);
        const localEnd = convertUTCToLocal(s.dayOfWeek, s.endTime);
        return {
          dayOfWeek: local.dayOfWeek,
          startTime: local.hhmm,
          endTime: localEnd.hhmm
        };
      }),
      teacherId: classroom.teacherId?._id || '',
      schoolIds: Array.isArray(classroom.schoolId) ? classroom.schoolId.map(s => s._id || s) : [classroom.schoolId?._id || classroom.schoolId].filter(Boolean),
      isPrivate: classroom.isPrivate || false,
      introVideo: classroom.introVideo || '',
      classFormat: classroom.classFormat || 'classroom',
      publicAccess: {
        allowGuestAccess: !!classroom.publicAccess?.allowGuestAccess,
        durationValue: classroom.publicAccess?.durationValue || 1,
        durationUnit: classroom.publicAccess?.durationUnit || 'days',
        startsAt: toDatetimeLocal(classroom.publicAccess?.startsAt),
        recordingUrl: classroom.publicAccess?.recordingUrl || '',
        joinInstructions: classroom.publicAccess?.joinInstructions || ''
      }
    });
    if (['root_admin', 'school_admin'].includes(user?.role)) {
      fetchAvailableTeachers();
    }
    setShowEditModal(true);
  };

  // Handle edit form submit
  const handleEditClassroom = async (e) => {
    e.preventDefault();
    setIsEditing(true);
    try {
      const updateData = {
        name: editForm.name,
        description: editForm.description,
        learningOutcomes: editForm.learningOutcomes,
        subject: editForm.subject,
        level: editForm.level,
        capacity: editForm.capacity,
        pricing: { type: editForm.pricingType, amount: editForm.pricingAmount },
        isPaid: editForm.isPaid,
        isPrivate: editForm.isPrivate,
        introVideo: editForm.introVideo,
        classFormat: editForm.classFormat,
        publicAccess: {
          ...editForm.publicAccess,
          allowGuestAccess: editForm.classFormat !== 'classroom' && editForm.publicAccess.allowGuestAccess,
          endsAt: editForm.publicAccess.startsAt
            ? new Date(new Date(editForm.publicAccess.startsAt).getTime() + Number(editForm.publicAccess.durationValue || 1) * (editForm.publicAccess.durationUnit === 'weeks' ? 7 : 1) * 24 * 60 * 60 * 1000).toISOString()
            : null
        },
        schedule: editForm.schedule.map(s => {
          const utc = convertLocalToUTC(s.dayOfWeek, s.startTime);
          const utcEnd = convertLocalToUTC(s.dayOfWeek, s.endTime);
          return {
            dayOfWeek: utc.dayOfWeek,
            startTime: utc.time,
            endTime: utcEnd.time
          };
        })
      };

      if (user?.role === 'school_admin') {
        const sel = editForm.schoolIds?.includes('ALL') ? schools.map(s => s._id) : editForm.schoolIds;
        updateData.schoolId = sel;
      }

      // Only allow teacher change if permitted
      if (['root_admin', 'school_admin'].includes(user?.role) && editForm.teacherId) {
        updateData.teacherId = editForm.teacherId;
      }

      await api.put(`/classrooms/${id}`, updateData, { skipLoader: true });
      setShowEditModal(false);
      toast.success('Classroom updated successfully');
      fetchClassroom();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error updating classroom');
    } finally {
      setIsEditing(false);
    }
  };

  const handleApplySyllabus = async (topics) => {
    setLoadingTopics(true);
    try {
      await api.post(`/topics/bulk-create/${id}`, { topics });
      toast.success(`${topics.length} topics added to syllabus!`);
      fetchClassroom();
      setShowAIPanel(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to apply syllabus');
    } finally {
      setLoadingTopics(false);
    }
  };
  const [isEditing, setIsEditing] = useState(false); // Added loading state
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showChangeTeacherModal, setShowChangeTeacherModal] = useState(false);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [availableTeachers, setAvailableTeachers] = useState([]);
  const [topicForm, setTopicForm] = useState({ name: '', description: '' });
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  // New states for Assignment Management
  const [showCreateAssignmentModal, setShowCreateAssignmentModal] = useState(false);
  const [availableTopicsForAssignment, setAvailableTopicsForAssignment] = useState([]); // For topic dropdown in create assignment modal
  const [showSubmitAssignmentModal, setShowSubmitAssignmentModal] = useState(false); // New state for submit modal
  const [assignmentToSubmit, setAssignmentToSubmit] = useState(null); // New state for assignment to submit
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [showDeleteTopicModal, setShowDeleteTopicModal] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState(null);
  const [showLeaveClassModal, setShowLeaveClassModal] = useState(false);
  const [selectedAssignmentForGrading, setSelectedAssignmentForGrading] = useState(null);
  const [submissionToGrade, setSubmissionToGrade] = useState(null);
  const [expandedSubmissions, setExpandedSubmissions] = useState(new Set()); // Track which submissions are expanded
  const [expandedAssignments, setExpandedAssignments] = useState(new Set()); // Track which assignments are expanded
  const [showDeleteAssignmentModal, setShowDeleteAssignmentModal] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [isDeletingAssignment, setIsDeletingAssignment] = useState(false);
  const [assignmentToEdit, setAssignmentToEdit] = useState(null);
  const [assignmentAiPrefill, setAssignmentAiPrefill] = useState(null);
  const [showCreateExamModal, setShowCreateExamModal] = useState(false);
  const [examToEdit, setExamToEdit] = useState(null);
  const [examAiPrefill, setExamAiPrefill] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [notifyingAssignmentId, setNotifyingAssignmentId] = useState(null);
  const [showRemoveStudentModal, setShowRemoveStudentModal] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState(null);
  const [isRemovingStudent, setIsRemovingStudent] = useState(false);

  // Payment Check Logic
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [blockedTopic, setBlockedTopic] = useState(null);
  const [paidTopicIds, setPaidTopicIds] = useState(new Set()); // IDs of topics user has paid for
  const [exams, setExams] = useState([]);
  const [activeTab, setActiveTab] = useState('topics'); // Default tab
  const [weeklyPaymentRequired, setWeeklyPaymentRequired] = useState(false);

  useEffect(() => {
    fetchClassroom();
    fetchWhiteboardState();
    if (user?.role === 'student') {
      fetchTopicStatus();
    }
    // Listen for school selection changes
    const handler = () => fetchClassroom();
    window.addEventListener('schoolSelectionChanged', handler);
    const wbInterval = setInterval(() => fetchWhiteboardState(), 5000);
    return () => { window.removeEventListener('schoolSelectionChanged', handler); clearInterval(wbInterval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Gracy → create-form handoff: seed + open the assignment/exam modals.
  useEffect(() => {
    const assignmentPrefill = consumeGracyPrefill('assignment');
    if (assignmentPrefill) {
      setAssignmentAiPrefill(assignmentPrefill);
      setShowCreateAssignmentModal(true);
    }
    const examPrefill = consumeGracyPrefill('exam');
    if (examPrefill) {
      setExamAiPrefill(examPrefill);
      setShowCreateExamModal(true);
    }
  }, []);

  const fetchTopicStatus = async () => {
    try {
      const resp = await api.get(`/payments/topic-status/${id}`);
      if (resp.data.paidTopics) {
        const paidIds = new Set(resp.data.paidTopics.map(t => t._id));
        setPaidTopicIds(paidIds);
      }
    } catch (err) {
      console.error('Error fetching topic status', err);
    }
  };

  const handlePublishToggle = async () => {
    setPublishing(true);
    try {
      await api.put(`/classrooms/${id}/publish`, { published: !classroom.published });
      fetchClassroom();
      toast.success(classroom.published ? 'Classroom unpublished' : 'Classroom published');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error updating publish status');
    } finally {
      setPublishing(false);
    }
  };

  const handleNotifyStudents = async (assignmentId) => {
    setNotifyingAssignmentId(assignmentId);
    try {
      await api.post(`/assignments/${assignmentId}/notify`);
      toast.success('Students notified successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error notifying students');
    } finally {
      setNotifyingAssignmentId(null);
    }
  };

  const [publishingAssignmentId, setPublishingAssignmentId] = useState(null);
  const handleAssignmentPublishToggle = async (assignment) => {
    setPublishingAssignmentId(assignment._id);
    try {
      const newStatus = !assignment.published;
      await api.put(`/assignments/${assignment._id}/publish`, { published: newStatus });
      fetchClassroom();
      toast.success(newStatus ? 'Assignment published' : 'Assignment unpublished');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error updating assignment publish status');
    } finally {
      setPublishingAssignmentId(null);
    }
  };

  const [showEndClassModal, setShowEndClassModal] = useState(false);
  const [isEndingClass, setIsEndingClass] = useState(false);

  const confirmEndClassroom = async () => {
    setIsEndingClass(true);
    try {
      await api.post(`/classrooms/${id}/end`, {});
      toast.success('Classroom ended successfully');
      setShowEndClassModal(false);
      navigate('/classrooms'); // proper redirect
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error ending classroom');
    } finally {
      setIsEndingClass(false);
    }
  };

  // Check if user has access to the current topic (or specific topic)
  const checkTopicAccess = (targetTopicId = null) => {
    // Only apply to students
    if (user?.role !== 'student') return true;

    // Only apply if pricing type is per_topic
    if (classroom?.pricing?.type !== 'per_topic') return true;

    if (!classroom || !classroom.topics) return true;

    // Determine effective topic ID (prefer explicit target, then current topic field, then status fallback)
    let topicToProtect = targetTopicId || classroom.currentTopicId;
    if (!topicToProtect) {
      const activeTopic = classroom.topics.find(t => t.status === 'active');
      if (activeTopic) topicToProtect = activeTopic._id;
    }

    if (!topicToProtect) return true;

    const topicIdStr = (typeof topicToProtect === 'object' ? topicToProtect._id : topicToProtect).toString();

    // Find the topic object in classroom.topics to get its latest price/isPaid status
    const topic = classroom.topics.find(t => t._id === topicIdStr);
    if (!topic) return true;

    // Check if topic is paid (teacher might have made it free)
    if (topic.isPaid && topic.price > 0) {
      // Check if user paid (we use the set of paid IDs)
      if (!paidTopicIds.has(topicIdStr)) {
        setBlockedTopic(topic);
        setShowPaymentModal(true);
        return false;
      }
    }
    return true;
  };

  // fetch whiteboard availability/session info
  const fetchWhiteboardState = async () => {
    try {
      const resp = await api.get(`/whiteboard/${id}`);
      setWhiteboardInfo(resp.data || null);
    } catch (err) {
      // ignore errors silently
      setWhiteboardInfo(null);
    }
  };

  useEffect(() => {
    if (classroom) {
      if (['root_admin', 'school_admin', 'personal_teacher'].includes(user?.role)) {
        fetchAvailableStudents();
      }
      if (user?.role === 'root_admin') {
        fetchAvailableTeachers();
      }
      // Fetch topics for assignment creation if creating assignments in this classroom
      if (['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role)) {
        fetchTopicsForAssignmentCreation(classroom._id);
      }
    }
  }, [classroom, user]);

  // Fetch latest call info (if user can view/start)
  useEffect(() => {
    const fetchCall = async () => {
      if (!classroom || !user) return;

      // determine basic starter permission (teacher owner, personal teacher owner, school_admin of class, root_admin)
      const teacherIdStr = classroom.teacherId?._id ? classroom.teacherId._id.toString() : (classroom.teacherId ? classroom.teacherId.toString() : null);
      const isTeacherOwner = teacherIdStr && user._id.toString() === teacherIdStr;
      const isRoot = user.role === 'root_admin';
      const classroomSchoolIds = (Array.isArray(classroom.schoolId) ? classroom.schoolId : [classroom.schoolId]).filter(Boolean);
      const isSchoolAdminOfClass = user.role === 'school_admin' && classroomSchoolIds.some(s => {
        const adminId = s?.adminId?._id || s?.adminId;
        return adminId?.toString() === user?._id?.toString();
      });

      const canViewCall = isTeacherOwner || isRoot || isSchoolAdminOfClass || (classroom.students || []).some(s => (s._id ? s._id.toString() : s.toString()) === user._id.toString()) || (user.enrolledClasses || []).some(cid => cid.toString() === classroom._id.toString());
      if (!canViewCall) {
        setCurrentCall(null);
        return;
      }

      try {
        const resp = await api.get(`/classrooms/${classroom._id}/call`);
        setCurrentCall(resp.data || null);
      } catch (err) {
        // 404 -> no call yet, 403 -> not allowed, treat as no call for labeling
        setCurrentCall(null);
      }
    };
    fetchCall();
  }, [classroom, user]);

  const fetchClassroom = async () => {
    try {
      if (!classroom) setLoading(true); // Only show global loader on initial fetch
      // Also populate assignments to display them
      const response = await api.get(`/classrooms/${id}`);
      setClassroom(response.data.classroom);
      if (response.data.classroom?.name) {
        localStorage.setItem(`bc_${id}`, response.data.classroom.name);
      }
      setWeeklyPaymentRequired(false);
      fetchExams(); // Fetch exams after classroom is loaded
    } catch (error) {
      if (error.response?.status === 403 && error.response?.data?.paymentRequired) {
        setWeeklyPaymentRequired(true);
        // We might want to fetch a public version of the classroom for name/styling
        try {
          const publicResp = await api.get(`/classrooms/${id}/public`);
          setClassroom(publicResp.data.classroom);
        } catch (e) {}
      }
      console.error('Error fetching classroom:', error);
    } finally {
      if (!classroom) setLoading(false);
    }
  };

  const fetchExams = async () => {
    try {
      const response = await api.get(`/exams/class/${id}`);
      setExams(response.data);
    } catch (error) {
      console.error('Error fetching exams:', error);
    }
  };

  const fetchTopicsForAssignmentCreation = async (classroomId) => {
    try {
      const response = await api.get(`/classrooms/${classroomId}`); // Assuming topics are populated in classroom detail
      setAvailableTopicsForAssignment(response.data.classroom.topics || []);
    } catch (error) {
      console.error('Error fetching topics for assignment creation:', error);
      setAvailableTopicsForAssignment([]);
    }
  };

  // Payment Logic for Enrollment
  const [showEnrollmentPaymentModal, setShowEnrollmentPaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

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

  const handleEnrollmentPayment = async () => {
    setIsProcessingPayment(true);
    try {
      const amount = classroom.pricing?.amount || 0;
      // 1. Initialize logic
      const resp = await api.post('/payments/paystack/initiate', {
        amount,
        classroomId: id,
        type: 'class_enrollment',
        returnUrl: window.location.href // Fallback
      });

      if (resp.data.reference) {
        await loadPaystackScript();
        const pubKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
        // Paystack expects amount in kobo if currency is NGN
        const payAmount = (import.meta.env.VITE_PAYSTACK_CURRENCY || 'NGN').toLowerCase() === 'ngn'
          ? Math.round(amount * 100)
          : Math.round(amount * 100);

        if (!user || !user.email) {
          throw new Error('User email not available.');
        }

        const handleCallback = (response) => {
          (async () => {
            try {
              await api.get(`/payments/paystack/verify?reference=${encodeURIComponent(response.reference)}`);
              toast.success('Payment successful! You are now enrolled.');
              setShowEnrollmentPaymentModal(false);
              fetchClassroom(); // Refresh to update enrollment status
            } catch (err) {
              toast.error(err.response?.data?.message || 'Payment verification failed');
            } finally {
              setIsProcessingPayment(false);
            }
          })();
        };

        const handler = window.PaystackPop.setup({
          key: pubKey,
          email: user.email,
          amount: payAmount,
          ref: resp.data.reference,
          callback: handleCallback,
          onClose: () => setIsProcessingPayment(false)
        });

        if (handler && typeof handler.openIframe === 'function') {
          handler.openIframe();
        } else if (handler && typeof handler.open === 'function') {
          handler.open();
        } else {
          throw new Error('Paystack handler not available');
        }
      } else {
        throw new Error('Failed to initiate payment');
      }
    } catch (error) {
      console.error('Enrollment payment error:', error);
      toast.error(error.response?.data?.message || 'Error processing payment');
      setIsProcessingPayment(false);
    }
  };

  const handleEnroll = async () => {
    try {
      if (classroom.isPaid && classroom.pricing?.amount > 0) {
        // Show local payment modal instead of navigating
        setShowEnrollmentPaymentModal(true);
      } else {
        await api.post(`/classrooms/${id}/enroll`);
        toast.success('Enrolled successfully!');
        fetchClassroom();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error enrolling');
    }
  };

  const [isCreatingTopic, setIsCreatingTopic] = useState(false);
  const handleCreateTopic = async (e) => {
    e.preventDefault();
    setIsCreatingTopic(true);
    try {
      await api.post('/topics', {
        ...topicForm,
        classroomId: id
      }, { skipLoader: true });
      toast.success('Topic created successfully');
      setShowTopicModal(false);
      setTopicForm({ name: '', description: '' });
      fetchClassroom();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error creating topic');
    } finally {
      setIsCreatingTopic(false);
    }
  };

  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDrop = async (e, dropIndex) => {
    const dragIndex = Number(e.dataTransfer.getData('text/plain'));
    if (dragIndex === dropIndex) return;

    const newTopics = [...classroom.topics];
    const [draggedItem] = newTopics.splice(dragIndex, 1);
    newTopics.splice(dropIndex, 0, draggedItem);

    // Update local state immediately
    const updatedClassroom = { ...classroom, topics: newTopics };
    setClassroom(updatedClassroom);

    // Update backend
    try {
      const orderedIds = newTopics.map(t => t._id);
      await api.put('/topics/reorder', { orderedIds });
      toast.success('Topics reordered');
    } catch (error) {
      toast.error('Failed to save topic order');
      fetchClassroom(); // Revert on error
    }
  };

  const handleDeleteTopic = (topicId) => {
    setTopicToDelete(topicId);
    setShowDeleteTopicModal(true);
  };

  const confirmDeleteTopic = async () => {
    if (!topicToDelete) return;
    try {
      await api.delete(`/topics/${topicToDelete}`);
      toast.success('Topic deleted successfully');
      setShowDeleteTopicModal(false);
      setTopicToDelete(null);
      fetchClassroom();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error deleting topic');
    }
  };

  const handleLeaveClass = async () => {
    try {
      await api.post(`/classrooms/${id}/leave`);
      toast.success('Successfully left the class');
      setShowLeaveClassModal(false);
      navigate('/classrooms');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error leaving class');
    }
  };

  const handleCreateAssignment = async () => {
    setShowCreateAssignmentModal(false);
    fetchClassroom();
  };

  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);

  const handleSubmitAssignment = async (assignmentId, answers) => {
    setIsSubmittingAssignment(true);
    try {
      await api.post(`/assignments/${assignmentId}/submit`, { answers }, { skipLoader: true });
      setShowSubmitAssignmentModal(false);
      setAssignmentToSubmit(null);
      toast.success('Assignment submitted successfully');
      fetchClassroom();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error submitting assignment');
    } finally {
      setIsSubmittingAssignment(false);
    }
  };

  const handleGradeSubmission = async () => {
    // This function will now simply close the modal and refresh assignments,
    // as the API call is handled within GradeAssignmentModal
    setShowGradeModal(false);
    fetchClassroom(); // Refresh classroom to update grades
  };

  const handleDeleteAssignment = (assignmentId) => {
    setAssignmentToDelete(assignmentId);
    setShowDeleteAssignmentModal(true);
  };

  const confirmDeleteAssignment = async () => {
    if (!assignmentToDelete) return;
    setIsDeletingAssignment(true);
    try {
      await api.delete(`/assignments/${assignmentToDelete}`);
      toast.success('Assignment deleted successfully');
      setShowDeleteAssignmentModal(false);
      setAssignmentToDelete(null);
      fetchClassroom();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error deleting assignment');
    } finally {
      setIsDeletingAssignment(false);
    }
  };

  const handleOpenEditAssignment = (assignment) => {
    setAssignmentToEdit(assignment);
    setShowCreateAssignmentModal(true);
  };

  const handleStartZoom = async () => {
    try {
      const response = await api.post(`/classrooms/${id}/call/start`, {
        isPaid: classroom.isPaid,
        amount: classroom.pricing?.amount || 0
      });
      const link = response.data.link;
      if (link) {
        const w = window.open(link, '_blank');
        if (w) w.opener = null;
      } else {
        toast.error('Could not create lecture link');
      }
    } catch (error) {
      if (error.response?.data?.googleAuthRequired) {
        // Redirect user to backend Google consent flow using full backend URL
        const apiBase = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || '';
        window.location.href = `${apiBase}/api/google-auth/start-consent?userId=${user?._id}&classroomId=${id}`;
      } else {
        toast.error(error.response?.data?.message || 'Error starting lecture');
      }
    }
  };

  const handleJoinCall = async () => {
    if (!checkTopicAccess()) return;

    try {
      const resp = await api.get(`/classrooms/${id}/call`);
      const { link, isPaid, amount, callId, hasPaid } = resp.data;

      if (!link) {
        return toast.error('No active lecture found');
      }

      if (isPaid && !hasPaid && user?.role === 'student') {
        // Initiate payment for lecture
        if (window.confirm(`This is a paid lecture. Pay ₦${amount} to join?`)) {
          initiateLecturePayment(callId, amount);
        }
        return;
      }

      // Mark attendance silently
      try {
        if (user?.role === 'student') {
          await api.post(`/classrooms/${id}/call/attend`, {}, { skipLoader: true });
        }
      } catch (attendErr) {
        console.error('Failed to mark attendance:', attendErr);
      }

      const w = window.open(link, '_blank');
      if (w) w.opener = null;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error joining lecture');
    }
  };

  const initiateLecturePayment = async (callId, amount) => {
    try {
      setIsProcessingPayment(true);
      const resp = await api.post('/payments/paystack/initiate', {
        amount,
        classroomId: id,
        callSessionId: callId,
        type: 'lecture_access'
      });

      if (resp.data.authorization_url) {
        // For web, we usually want to use PaystackPop if available
        const pubKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
        if (!pubKey || !window.PaystackPop) {
          window.location.href = resp.data.authorization_url;
          return;
        }

        const handleCallback = (response) => {
          (async () => {
            try {
              await api.get(`/payments/paystack/verify?reference=${encodeURIComponent(response.reference)}`);
              toast.success('Payment successful! You can now join the lecture.');
              handleJoinCall(); // Try joining again
            } catch (err) {
              toast.error(err.response?.data?.message || 'Payment verification failed');
            } finally {
              setIsProcessingPayment(false);
            }
          })();
        };

        const handler = window.PaystackPop.setup({
          key: pubKey,
          email: user.email,
          amount: Math.round(amount * 100),
          ref: resp.data.reference,
          callback: handleCallback,
          onClose: () => setIsProcessingPayment(false)
        });
        handler.open();
      }
    } catch (err) {
      toast.error('Failed to initiate payment');
      setIsProcessingPayment(false);
    }
  };

  const handleOpenWhiteboard = async () => {
    if (!checkTopicAccess()) return;

    try {
      // if server provided a published whiteboard URL, open that first
      if (whiteboardInfo && whiteboardInfo.whiteboardUrl) {
        const w = window.open(whiteboardInfo.whiteboardUrl, '_blank');
        if (w) w.opener = null;
        return;
      }
      // otherwise open the built-in whiteboard route for this class in a new tab
      const url = `${window.location.origin}/classrooms/${id}/whiteboard`;
      const w = window.open(url, '_blank');
      if (w) w.opener = null; // security: prevent access to opener
    } catch (err) {
      console.error('Error opening whiteboard', err);
    }
  };

  const fetchAvailableStudents = async () => {
    try {
      // Backend already filters students by schoolId for school admins
      const response = await api.get('/users');
      // Filter to get only students (backend may have already filtered by schoolId for school admins)
      let students = response.data.users.filter(u => u.role === 'student');

      // Filter out already enrolled students
      if (classroom) {
        const enrolledIds = classroom.students?.map(s => (typeof s === 'object' ? s._id?.toString() : s?.toString())) || [];
        const available = students.filter(s => !enrolledIds.includes(s._id?.toString()));
        setAvailableStudents(available);
      } else {
        setAvailableStudents(students);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchAvailableTeachers = async () => {
    try {
      const response = await api.get('/users');
      const teachers = response.data.users.filter(u =>
        ['teacher', 'personal_teacher'].includes(u.role)
      );
      setAvailableTeachers(teachers);
    } catch (error) {
      console.error('Error fetching teachers:', error);
    }
  };

  const [isAddingStudent, setIsAddingStudent] = useState(false);

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setIsAddingStudent(true);
    try {
      await api.post(`/classrooms/${id}/students`, { studentId: selectedStudentId }, { skipLoader: true });
      toast.success('Student added successfully!');
      setShowAddStudentModal(false);
      setSelectedStudentId(''); // Reset selected student ID
      fetchClassroom();
      fetchAvailableStudents();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error adding student');
    } finally {
      setIsAddingStudent(false);
    }
  };

  const handleRemoveStudent = (studentId) => {
    setStudentToRemove(studentId);
    setShowRemoveStudentModal(true);
  };

  const confirmRemoveStudent = async () => {
    if (!studentToRemove) return;
    setIsRemovingStudent(true);
    try {
      await api.delete(`/classrooms/${id}/students/${studentToRemove}`);
      toast.success('Student removed successfully!');
      setShowRemoveStudentModal(false);
      setStudentToRemove(null);
      fetchClassroom();
      fetchAvailableStudents();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error removing student');
    } finally {
      setIsRemovingStudent(false);
    }
  };

  const [isChangingTeacher, setIsChangingTeacher] = useState(false);

  const handleChangeTeacher = async (e) => {
    e.preventDefault();
    setIsChangingTeacher(true);
    try {
      await api.put(`/classrooms/${id}/teacher`, { teacherId: selectedTeacherId }, { skipLoader: true });
      toast.success('Teacher updated successfully!');
      setShowChangeTeacherModal(false);
      setSelectedTeacherId('');
      fetchClassroom();
      toast.error(error.response?.data?.message || 'Error changing teacher');
    } finally {
      setIsChangingTeacher(false);
    }
  };

  const [showDeleteClassModal, setShowDeleteClassModal] = useState(false);
  const [isDeletingClass, setIsDeletingClass] = useState(false);

  const handleDeleteClassroomClick = () => {
    setShowDeleteClassModal(true);
  };

  const confirmDeleteClassroom = async () => {
    setIsDeletingClass(true);
    try {
      await api.delete(`/classrooms/${id}`);
      toast.success('Classroom deleted successfully');
      navigate('/classrooms');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error deleting classroom');
      setIsDeletingClass(false);
    }
  };

  const isEnrolled = (classroom?.students || []).some(s => (s._id || s).toString() === user?._id?.toString()) || 
                      (user?.enrolledClasses || []).some(cid => cid?.toString() === classroom?._id?.toString());

  // Can manage school access
  const classroomSchoolIds = (Array.isArray(classroom?.schoolId) ? classroom.schoolId : [classroom?.schoolId]).filter(Boolean);
  const isSchoolAdminOfClass = user?.role === 'school_admin' && classroomSchoolIds.some(s => {
    const adminId = s?.adminId?._id || s?.adminId;
    return adminId?.toString() === user?._id?.toString();
  });

  // Unpublished classes can be edited by teacher, personal teacher, school admin, and root admin
  // Published classes can only be edited by their teacher or admins
  const canEdit =
    user?.role === 'root_admin' ||
    isSchoolAdminOfClass ||
    (user?.role === 'teacher' && classroom?.teacherId?._id === user?._id) ||
    (user?.role === 'personal_teacher' && classroom?.teacherId?._id === user?._id) ||
    (!classroom?.published && (user?.role === 'root_admin' || isSchoolAdminOfClass || (classroom?.teacherId?._id === user?._id)));

  const canManageStudents =
    user?.role === 'root_admin' ||
    isSchoolAdminOfClass ||
    (user?.role === 'personal_teacher' && classroom?.teacherId?._id === user?._id);

  // Can change teacher (root admin only, for non-personal teacher classes)
  const canChangeTeacher =
    user?.role === 'root_admin' &&
    classroom?.schoolId &&
    classroom?.teacherId?.role !== 'personal_teacher';

  // Can view students (teachers can see their students)
  const canViewStudents =
    user?.role === 'teacher' && classroom?.teacherId?._id === user?._id ||
    user?.role === 'personal_teacher' && classroom?.teacherId?._id === user?._id ||
    canManageStudents ||
    user?.role === 'root_admin';

  // Can create assignments (same as canEdit for now)
  const canCreateAssignment = canEdit;
  // Can grade assignments (same as canEdit for now)
  const canGradeAssignment = canEdit;

  if (loading || userLoading) {
    return <Layout><div className="flex flex-col items-center justify-center min-h-[400px] gap-4"><div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" /><p className="text-xs font-semibold tracking-wide text-muted-foreground opacity-50">Loading...</p></div></Layout>;
  }
  if (!user || !user._id) {
    return <Layout><div className="text-center py-8 text-red-600">User session invalid. Please log in again.</div></Layout>;
  }

  if (!classroom) {
    return <Layout><div className="text-center py-8">Classroom not found</div></Layout>;
  }

  const isTeacher = user?._id === (classroom.teacherId?._id || classroom.teacherId);
  const isAdminForThisClass = ['root_admin', 'school_admin'].includes(user?.role);
  const showIntroVideo = classroom.introVideo && !isEnrolled && !isTeacher && !isAdminForThisClass;

  const getEmbedUrl = (url) => {
    if (!url) return null;
    let videoId = '';
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      videoId = url.includes('v=') ? url.split('v=')[1].split('&')[0] : url.split('/').pop();
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes('vimeo.com')) {
      videoId = url.split('/').pop();
      return `https://player.vimeo.com/video/${videoId}`;
    }
    return url;
  };

  const embedUrl = getEmbedUrl(classroom.introVideo);

  return (
    <Layout>
      <div className="space-y-6 min-w-0 w-full">
        <div className="bg-card border border-border rounded-sm shadow-none min-w-0">
          {/* Header Row: Title, Actions, Price */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: classroom.published ? FOREST : SLATE }} />
                <span className="text-xs font-semibold" style={{ color: classroom.published ? FOREST : SLATE, letterSpacing: '0.02em' }}>
                  {classroom.published ? 'Published' : 'Draft'}
                </span>
              </div>
              <h1 className="font-serif text-[28px] font-semibold leading-snug truncate">{classroom.name}</h1>
              <p className="text-sm mt-1" style={{ color: SLATE }}>
                {classroom.subject || 'Subject'} &middot; {classroom.level ? `${classroom.level} level` : 'Level'}
              </p>
            </div>

            <div className="flex items-center gap-5 shrink-0 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {canEdit && (
                  <ActionButton
                    icon={classroom.published ? EyeOff : Eye}
                    label={classroom.published ? 'Unpublish' : 'Publish'}
                    onClick={handlePublishToggle}
                    loading={publishing}
                  />
                )}
                {(canEdit || user?.role === 'teacher' || user?.role === 'personal_teacher') && (
                  <ActionButton
                    icon={Share2}
                    label="Share"
                    onClick={() => {
                      const shareLink = `${window.location.origin}/c/${classroom.slug || classroom.shortCode || classroom._id}`;
                      navigator.clipboard.writeText(shareLink);
                      toast.success('Link copied!');
                    }}
                  />
                )}
                <OverflowMenu
                  onEdit={handleOpenEdit}
                  onEnd={() => setShowEndClassModal(true)}
                  onDelete={handleDeleteClassroomClick}
                  showDelete={user?.role === 'root_admin' || isSchoolAdminOfClass || (user?.role === 'personal_teacher' && user?._id === classroom.teacherId?._id)}
                />
              </div>

              <div style={{ width: '1px', alignSelf: 'stretch' }} className="bg-border" />

              <div className="text-right">
                <div className="font-serif text-2xl font-semibold" style={{ color: classroom.isPaid && classroom.pricing?.amount > 0 ? GOLD : FOREST }}>
                  {classroom.isPaid && classroom.pricing?.amount > 0
                    ? formatAmount(classroom.pricing?.amount || 0, classroom.pricing?.currency || 'NGN')
                    : 'Free'}
                </div>
                <div className="text-xs mt-1" style={{ color: SLATE }}>
                  {classroom.isPaid && classroom.pricing?.amount > 0
                    ? (classroom.pricing?.type === 'per_lecture' ? 'per lecture' : (classroom.pricing?.type || 'paid').replace('_', ' '))
                    : 'no charge'}
                </div>
              </div>
            </div>
          </div>
          {/* Edit Classroom Modal */}
          {showEditModal && (
            <div className="fixed inset-0 bg-slate-900/60  z-[100] overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <div className="bg-card border border-border rounded-xl w-full max-w-2xl p-10 shadow-none animate-in zoom-in-95 duration-300">
                  <div className="flex justify-between items-center mb-10">
                    <h2 className="text-3xl font-semibold tracking-tight text-foreground">Edit <span className="text-primary not-italic">Classroom</span></h2>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowAIPanel(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold tracking-wider hover:opacity-90 transition-all shadow-none  dark:shadow-none active:scale-95"
                      >
                        <Sparkles className="w-4 h-4" />
                        Magic Generate
                      </button>
                      <button onClick={() => setShowEditModal(false)} className="p-3 hover:bg-muted rounded-xl transition text-muted-foreground/60"><X className="w-6 h-6" /></button>
                    </div>
                  </div>
                  <form onSubmit={handleEditClassroom} className="space-y-8 pb-4">
                    {/* Basic Info */}
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-semibold text-muted-foreground tracking-wide px-1">Class Title</label>
                        <input
                          value={editForm.name}
                          onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                          placeholder="e.g. Advanced Mathematics Masterclass"
                          className="w-full bg-muted border-2 border-border p-4 rounded-xl font-semibold text-foreground focus:border-primary transition-all outline-none"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground tracking-wide px-1 flex items-center">
                          Academic Level
                          <FormFieldHelp content="The grade or education level this class is designed for." />
                        </label>
                        <Select
                          options={levelOptions}
                          value={levelOptions.find(opt => opt.value === editForm.level)}
                          onChange={sel => setEditForm({ ...editForm, level: sel?.value })}
                          classNamePrefix="react-select"
                          menuPortalTarget={document.body}
                          styles={{ 
                            control: (base) => ({ 
                              ...base, 
                              minHeight: '60px', 
                              borderRadius: '1rem', 
                              backgroundColor: 'hsl(var(--muted))', 
                              borderColor: 'hsl(var(--border))', 
                              borderWidth: '2px',
                              fontWeight: '700'
                            }),
                            placeholder: (base) => ({ ...base, color: 'hsl(var(--muted-foreground))' }),
                            input: (base) => ({ ...base, color: 'hsl(var(--foreground))' }),
                            singleValue: (base) => ({ ...base, color: 'hsl(var(--foreground))' }),
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                            menu: (base) => ({
                              ...base,
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '1rem',
                              overflow: 'hidden',
                              boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
                            }),
                            menuList: (base) => ({ ...base, backgroundColor: 'hsl(var(--card))', padding: 6 }),
                            option: (base, state) => ({
                              ...base,
                              backgroundColor: state.isSelected
                                ? 'hsl(var(--primary))'
                                : state.isFocused
                                  ? 'hsl(var(--primary) / 0.12)'
                                  : 'transparent',
                              color: state.isSelected ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              letterSpacing: '0.12em',
                              fontSize: 10,
                              padding: '10px 12px',
                            }),
                            indicatorSeparator: (base) => ({ ...base, backgroundColor: 'hsl(var(--border))' }),
                            dropdownIndicator: (base) => ({ ...base, color: 'hsl(var(--muted-foreground))' }),
                          }}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground tracking-wide px-1 flex items-center">
                          Subject
                          <FormFieldHelp content="Helps students find your class in the search results." />
                        </label>
                        <CreatableSelect
                          options={subjectOptions}
                          value={editForm.subject ? { value: editForm.subject, label: editForm.subject } : null}
                          onChange={sel => setEditForm({ ...editForm, subject: sel?.value || '' })}
                          classNamePrefix="react-select"
                          menuPortalTarget={document.body}
                          styles={{ 
                            control: (base) => ({ 
                              ...base, 
                              minHeight: '60px', 
                              borderRadius: '1rem', 
                              backgroundColor: 'hsl(var(--muted))', 
                              borderColor: 'hsl(var(--border))', 
                              borderWidth: '2px',
                              fontWeight: '700'
                            }),
                            placeholder: (base) => ({ ...base, color: 'hsl(var(--muted-foreground))' }),
                            input: (base) => ({ ...base, color: 'hsl(var(--foreground))' }),
                            singleValue: (base) => ({ ...base, color: 'hsl(var(--foreground))' }),
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                            menu: (base) => ({
                              ...base,
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '1rem',
                              overflow: 'hidden',
                              boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
                            }),
                            menuList: (base) => ({ ...base, backgroundColor: 'hsl(var(--card))', padding: 6 }),
                            option: (base, state) => ({
                              ...base,
                              backgroundColor: state.isSelected
                                ? 'hsl(var(--primary))'
                                : state.isFocused
                                  ? 'hsl(var(--primary) / 0.12)'
                                  : 'transparent',
                              color: state.isSelected ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              letterSpacing: '0.12em',
                              fontSize: 10,
                              padding: '10px 12px',
                            }),
                            indicatorSeparator: (base) => ({ ...base, backgroundColor: 'hsl(var(--border))' }),
                            dropdownIndicator: (base) => ({ ...base, color: 'hsl(var(--muted-foreground))' }),
                          }}
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-semibold text-muted-foreground tracking-wide px-1">Description</label>
                        <textarea
                          value={editForm.description}
                          onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                          placeholder="Tell students what this class is about..."
                          className="w-full min-h-[100px] bg-muted border-2 border-border p-4 rounded-xl font-medium text-foreground focus:border-primary transition-all outline-none"
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-semibold text-muted-foreground tracking-wide px-1 flex items-center">
                          Intro Video URL
                          <FormFieldHelp content="Paste a YouTube or Vimeo link to show a preview on the public page. (e.g. https://www.youtube.com/watch?v=...)" />
                        </label>
                        <input
                          type="url"
                          value={editForm.introVideo}
                          onChange={e => setEditForm({ ...editForm, introVideo: e.target.value })}
                          placeholder="https://www.youtube.com/watch?v=..."
                          className="w-full bg-muted border-2 border-border p-4 rounded-xl font-semibold text-foreground focus:border-primary transition-all outline-none"
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-semibold text-muted-foreground tracking-wide px-1">Learning Outcomes</label>
                        <textarea
                          value={editForm.learningOutcomes}
                          onChange={e => setEditForm({ ...editForm, learningOutcomes: e.target.value })}
                          placeholder="List what students will achieve (comma separated)..."
                          className="w-full min-h-[80px] bg-muted border-2 border-border p-4 rounded-xl font-medium text-foreground focus:border-primary transition-all outline-none"
                        />
                      </div>
                    </div>

                    {/* Roles & Visibility */}
                    <div className="grid md:grid-cols-2 gap-6 bg-muted p-6 rounded-xl border border-border">
                      {(user?.role === 'root_admin' || user?.role === 'school_admin') && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground tracking-wide px-1">Assign Teacher</label>
                          <Select
                            options={availableTeachers.map(t => ({ value: t._id, label: `${t.name} (${t.email})` }))}
                            value={availableTeachers.find(t => t._id === editForm.teacherId) ? { value: editForm.teacherId, label: availableTeachers.find(t => t._id === editForm.teacherId).name } : null}
                            onChange={sel => setEditForm({ ...editForm, teacherId: sel?.value })}
                            placeholder="Select a teacher..."
                            classNamePrefix="react-select"
                            menuPortalTarget={document.body}
                            styles={{ 
                              control: (base) => ({ 
                                ...base, 
                                minHeight: '60px', 
                                borderRadius: '1rem', 
                                backgroundColor: 'var(--bg-card)', 
                                borderColor: 'var(--border-border)', 
                                borderWidth: '2px',
                                fontWeight: '700'
                              }),
                              singleValue: (base) => ({ ...base, color: 'var(--text-foreground)' }),
                              menuPortal: base => ({ ...base, zIndex: 9999, backgroundColor: 'var(--bg-card)' }) 
                            }}
                          />
                        </div>
                      )}

                      {user?.role === 'school_admin' && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground tracking-wide px-1">Assign to Schools</label>
                          <Select
                            isMulti
                            options={[{ _id: 'ALL', name: 'ALL SCHOOLS' }, ...schools].map(s => ({ value: s._id, label: s.name }))}
                            value={editForm.schoolIds?.map(id => {
                              const s = [{ _id: 'ALL', name: 'ALL SCHOOLS' }, ...schools].find(sch => sch._id === id);
                              return { value: id, label: s?.name || id };
                            })}
                            onChange={sels => setEditForm({ ...editForm, schoolIds: sels ? sels.map(s => s.value) : [] })}
                            classNamePrefix="react-select"
                            menuPortalTarget={document.body}
                            styles={{ 
                              control: (base) => ({ 
                                ...base, 
                                minHeight: '60px', 
                                borderRadius: '1rem', 
                                backgroundColor: 'var(--bg-card)', 
                                borderColor: 'var(--border-border)', 
                                borderWidth: '2px',
                                fontWeight: '700'
                              }),
                              singleValue: (base) => ({ ...base, color: 'var(--text-foreground)' }),
                              menuPortal: base => ({ ...base, zIndex: 9999, backgroundColor: 'var(--bg-card)' }) 
                            }}
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 md:col-span-2">
                        {/* Max Capacity */}
                        <div className="space-y-2">
                           <div className="flex items-center gap-1">
                            <span className="text-xs font-semibold text-slate-400 tracking-wide">Enrollment Limit</span>
                            <FormFieldHelp content="The maximum number of students allowed to enroll in this class." />
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              value={editForm.capacity}
                              onChange={e => setEditForm({ ...editForm, capacity: parseInt(e.target.value) || 30 })}
                              onWheel={(e) => e.target.blur()}
                              className="w-full pl-4 pr-4 py-3 bg-muted border-2 border-border rounded-xl focus:border-primary focus:bg-muted transition-all outline-none font-semibold text-foreground"
                              min="1"
                              placeholder="30"
                            />
                          </div>
                        </div>

                        {/* Private Toggle */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-semibold text-slate-400 tracking-wide leading-none">Visibility</span>
                            <FormFieldHelp content="Private classes are not visible to the public. You must share direct links with students." />
                          </div>
                          <label 
                            onClick={() => setEditForm({ ...editForm, isPrivate: !editForm.isPrivate })}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all cursor-pointer group min-h-[64px] ${editForm.isPrivate ? 'border-primary bg-primary/10' : 'border-border bg-muted hover:border-border/80'}`}
                          >
                            <span className={`text-xs font-semibold tracking-wide transition-colors ${editForm.isPrivate ? 'text-primary' : 'text-muted-foreground'}`}>Private Class</span>
                            <div className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${editForm.isPrivate ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${editForm.isPrivate ? 'translate-x-4' : ''}`} />
                            </div>
                          </label>
                        </div>

                        {/* Paid Toggle */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-semibold text-slate-400 tracking-wide leading-none">Monetization</span>
                            <FormFieldHelp content="When enabled, you can set a price and billing cycle for this classroom." />
                          </div>
                          <label 
                            onClick={() => setEditForm({ ...editForm, isPaid: !editForm.isPaid })}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all cursor-pointer group min-h-[64px] ${editForm.isPaid ? 'border-primary bg-primary/10' : 'border-border bg-muted hover:border-border/80'}`}
                          >
                            <span className={`text-xs font-semibold tracking-wide transition-colors ${editForm.isPaid ? 'text-primary' : 'text-muted-foreground'}`}>Paid Class</span>
                            <div className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${editForm.isPaid ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${editForm.isPaid ? 'translate-x-4' : ''}`} />
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Pricing details if paid */}
                    {editForm.isPaid && (
                      <div className="p-6 rounded-xl bg-primary/5 border border-primary/10 animate-slide-up">
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-primary tracking-wide px-1 flex items-center">
                              Billing Cycle
                              <FormFieldHelp content="Determines payment intervals: Monthly/Weekly (subscription), Per Topic/Lecture (gated), or One Time (access forever)." />
                            </label>
                            <Select
                              options={[
                                { value: 'per_lecture', label: 'Per Lecture' },
                                { value: 'per_topic', label: 'Per Topic' },
                                { value: 'weekly', label: 'Weekly' },
                                { value: 'monthly', label: 'Monthly' },
                                { value: 'one_time', label: 'One Time Payment' }
                              ]}
                              value={{ value: editForm.pricingType, label: editForm.pricingType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) }}
                              onChange={sel => setEditForm({ ...editForm, pricingType: sel?.value })}
                              classNamePrefix="react-select"
                              menuPortalTarget={document.body}
                              styles={{
                                control: (base) => ({
                                  ...base,
                                  minHeight: '60px',
                                  borderRadius: '1rem',
                                  borderWidth: '2px',
                                  borderColor: 'var(--border-border)',
                                  backgroundColor: 'var(--bg-muted)',
                                  opacity: 0.5,
                                  fontWeight: '700',
                                  '&:hover': { borderColor: 'var(--border-border)' }
                                }),
                                singleValue: (base) => ({ ...base, color: 'var(--text-foreground)' }),
                                menuPortal: base => ({ ...base, zIndex: 9999, backgroundColor: 'var(--bg-card)' })
                              }}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-primary tracking-wide px-1 flex items-center">
                              Amount ({import.meta.env.VITE_CURRENCY || 'NGN'})
                              <FormFieldHelp content="The price students will pay based on the selected billing cycle." />
                            </label>
                            <input
                              type="number"
                              value={editForm.pricingAmount}
                              onChange={e => setEditForm({ ...editForm, pricingAmount: parseFloat(e.target.value) || 0 })}
                              onWheel={(e) => e.target.blur()}
                              className="w-full h-[60px] bg-muted border-2 border-border rounded-xl focus:border-primary focus:bg-muted transition-all outline-none px-4 font-semibold text-foreground"
                              placeholder="0.00"
                              required={editForm.isPaid}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Class Format & Public Access */}
                    <div className="p-6 rounded-xl bg-muted border border-border">
                      <div className="flex items-center gap-2 mb-4 px-1">
                        <Globe className="w-4 h-4 text-primary" />
                        <label className="text-xs font-semibold text-muted-foreground tracking-wide">Delivery Format</label>
                        <FormFieldHelp content="Classroom is a private course. Public Lecture / Public Seminar are open to guests who can join live or watch the recording — no account needed." />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { value: 'classroom', label: 'Classroom', desc: 'Private course for enrolled students', icon: Book },
                          { value: 'public_lecture', label: 'Public Lecture', desc: 'Guests join live or watch the recording', icon: Globe },
                          { value: 'public_seminar', label: 'Public Seminar', desc: 'Open multi-session guest seminar', icon: Users }
                        ].map(opt => (
                          <button
                            type="button"
                            key={opt.value}
                            onClick={() => setEditForm(prev => ({
                              ...prev,
                              classFormat: opt.value,
                              publicAccess: { ...prev.publicAccess, allowGuestAccess: opt.value !== 'classroom' }
                            }))}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${editForm.classFormat === opt.value ? 'border-primary bg-primary/10 shadow-none ' : 'border-border bg-muted hover:border-border/80'}`}
                          >
                            <opt.icon className={`w-5 h-5 mb-3 ${editForm.classFormat === opt.value ? 'text-primary' : 'text-muted-foreground'}`} />
                            <p className={`text-xs font-semibold tracking-wide ${editForm.classFormat === opt.value ? 'text-primary' : 'text-foreground'}`}>{opt.label}</p>
                            <p className="text-xs text-muted-foreground font-medium mt-1 leading-relaxed">{opt.desc}</p>
                          </button>
                        ))}
                      </div>

                      {editForm.classFormat !== 'classroom' && (
                        <div className="mt-6 pt-6 border-t border-border space-y-5 animate-slide-up">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-primary" />
                            <label className="text-xs font-semibold text-primary tracking-wide">Public Access</label>
                            <FormFieldHelp content="Controls how guests access this public lecture or seminar. Guests use the public page link." />
                          </div>

                          <label
                            onClick={() => setEditForm(prev => ({ ...prev, publicAccess: { ...prev.publicAccess, allowGuestAccess: !prev.publicAccess.allowGuestAccess } }))}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all cursor-pointer group min-h-[64px] ${editForm.publicAccess.allowGuestAccess ? 'border-primary bg-primary/10' : 'border-border bg-muted hover:border-border/80'}`}
                          >
                            <span className="text-xs font-semibold tracking-wide text-muted-foreground">
                              Allow Guest Access
                              <span className="block text-[11px] font-medium normal-case tracking-normal opacity-60 mt-0.5">People can join live or watch the recording without an account</span>
                            </span>
                            <div className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${editForm.publicAccess.allowGuestAccess ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${editForm.publicAccess.allowGuestAccess ? 'translate-x-4' : ''}`} />
                            </div>
                          </label>

                          <div className="grid md:grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-muted-foreground tracking-wide px-1 flex items-center">
                                Starts At
                                <FormFieldHelp content="When the public access window opens. Guests can join live sessions from this time onward." />
                              </label>
                              <input
                                type="datetime-local"
                                value={editForm.publicAccess.startsAt}
                                onChange={e => setEditForm(prev => ({ ...prev, publicAccess: { ...prev.publicAccess, startsAt: e.target.value } }))}
                                className="w-full bg-muted border-2 border-border p-4 rounded-xl font-semibold text-foreground focus:border-primary focus:bg-muted transition-all outline-none"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-muted-foreground tracking-wide px-1 flex items-center">
                                Access Duration
                                <FormFieldHelp content="How long the public access window stays open (days or weeks). The end date is computed automatically." />
                              </label>
                              <div className="flex gap-3">
                                <input
                                  type="number"
                                  min="1"
                                  value={editForm.publicAccess.durationValue}
                                  onChange={e => setEditForm(prev => ({ ...prev, publicAccess: { ...prev.publicAccess, durationValue: parseInt(e.target.value) || 1 } }))}
                                  className="w-24 bg-muted border-2 border-border p-4 rounded-xl font-semibold text-foreground focus:border-primary focus:bg-muted transition-all outline-none"
                                />
                                <select
                                  value={editForm.publicAccess.durationUnit}
                                  onChange={e => setEditForm(prev => ({ ...prev, publicAccess: { ...prev.publicAccess, durationUnit: e.target.value } }))}
                                  className="flex-1 bg-muted border-2 border-border p-4 rounded-xl font-semibold text-foreground focus:border-primary focus:bg-muted transition-all outline-none"
                                >
                                  <option value="days">Days</option>
                                  <option value="weeks">Weeks</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground tracking-wide px-1 flex items-center">
                              Recording URL (Optional)
                              <FormFieldHelp content="Paste a YouTube/Vimeo link to the recorded session so guests can watch it after the live event." />
                            </label>
                            <input
                              type="url"
                              value={editForm.publicAccess.recordingUrl}
                              onChange={e => setEditForm(prev => ({ ...prev, publicAccess: { ...prev.publicAccess, recordingUrl: e.target.value } }))}
                              placeholder="https://www.youtube.com/watch?v=..."
                              className="w-full bg-muted border-2 border-border p-4 rounded-xl font-semibold text-foreground focus:border-primary focus:bg-muted transition-all outline-none"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground tracking-wide px-1">Join Instructions (Optional)</label>
                            <textarea
                              value={editForm.publicAccess.joinInstructions}
                              onChange={e => setEditForm(prev => ({ ...prev, publicAccess: { ...prev.publicAccess, joinInstructions: e.target.value } }))}
                              placeholder="e.g. Have your laptop ready and join 5 minutes early."
                              className="w-full min-h-[80px] bg-muted border-2 border-border p-4 rounded-xl font-medium text-foreground focus:border-primary focus:bg-muted transition-all outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Schedule Builder */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-muted-foreground tracking-wide px-1">Weekly Schedule</label>
                        <button
                          type="button"
                          onClick={() => setEditForm({ ...editForm, schedule: [...editForm.schedule, { dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00' }] })}
                          className="text-xs font-semibold text-primary flex items-center gap-1 hover:underline"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Session
                        </button>
                      </div>

                      <div className="space-y-3">
                        {editForm.schedule.map((s, idx) => (
                          <div key={idx} className="flex flex-wrap md:flex-nowrap items-center gap-3 p-4 bg-muted rounded-xl border border-border animate-slide-up">
                            <select
                              value={s.dayOfWeek}
                              onChange={e => {
                                const newSched = [...editForm.schedule];
                                newSched[idx].dayOfWeek = e.target.value;
                                setEditForm({ ...editForm, schedule: newSched });
                              }}
                              className="flex-1 min-w-[120px] bg-muted border-none rounded-xl text-xs font-semibold tracking-wide p-3 text-foreground outline-none"
                            >
                              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => <option key={d}>{d}</option>)}
                            </select>
                            <input
                              type="time"
                              value={s.startTime}
                              onChange={e => {
                                const newSched = [...editForm.schedule];
                                newSched[idx].startTime = e.target.value;
                                setEditForm({ ...editForm, schedule: newSched });
                              }}
                              className="w-32 bg-muted border-none rounded-xl text-xs font-semibold p-3 text-foreground outline-none"
                            />
                            <span className="text-muted-foreground/60 font-semibold text-xs">to</span>
                            <input
                              type="time"
                              value={s.endTime}
                              onChange={e => {
                                const newSched = [...editForm.schedule];
                                newSched[idx].endTime = e.target.value;
                                setEditForm({ ...editForm, schedule: newSched });
                              }}
                              className="w-32 bg-muted border-none rounded-xl text-xs font-semibold p-3 text-foreground outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newSched = editForm.schedule.filter((_, i) => i !== idx);
                                setEditForm({ ...editForm, schedule: newSched });
                              }}
                              className="p-3 text-rose-500 hover:bg-danger/10 rounded-xl transition"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        ))}
                        {editForm.schedule.length === 0 && (
                          <p className="text-xs text-muted-foreground/60 font-semibold tracking-wide text-center py-4">No sessions scheduled yet.</p>
                        )}
                      </div>
                    </div>

                    <div className="pt-8 flex gap-4 sticky bottom-0 bg-card pb-2 border-t border-border mt-8">
                      <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 px-6 py-3 rounded-xl border border-border font-semibold text-xs tracking-wide text-muted-foreground hover:bg-muted transition">Discard</button>
                      <button type="submit" disabled={isEditing} className="btn-premium flex-1">
                        {isEditing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 border-b border-border">
            <RecordField icon={User} label="Teacher" borderRight>
              {classroom.teacherId?.name || 'Unknown Teacher'}
            </RecordField>
            <RecordField icon={Building2} label="Academic host" borderRight>
              {(() => {
                const schoolName = (Array.isArray(classroom.schoolId) ? (classroom.schoolId[0]?.name || classroom.schoolId[0]) : classroom.schoolId?.name) || classroom.teacherId?.tutorialId?.name || 'Tutorial';
                const extra = Array.isArray(classroom.schoolId) && classroom.schoolId.length > 1 ? ` +${classroom.schoolId.length - 1}` : '';
                return `${schoolName}${extra}`;
              })()}
            </RecordField>
            <RecordField icon={Calendar} label="Schedule">
              {(() => {
                if (!classroom.schedule || classroom.schedule.length === 0) return 'No schedule set';
                return classroom.schedule.map((session, index) => {
                  const local = convertUTCToLocal(session.dayOfWeek, session.startTime);
                  const localEnd = convertUTCToLocal(session.dayOfWeek, session.endTime);
                  return `${local.dayOfWeek ? local.dayOfWeek.substring(0, 3) : 'N/A'} ${local.hhmm}\u2013${localEnd.hhmm}`;
                }).join(' \u00b7 ');
              })()}
            </RecordField>
          </div>

          {showIntroVideo && embedUrl && (
            <div className="bg-slate-900 rounded-xl p-2 shadow-none border border-white/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 mb-8">
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
                <iframe
                  src={embedUrl}
                  title="Course Preview"
                  className="absolute inset-0 w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              <div className="p-4 px-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Video className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">Course Preview</p>
                      <p className="text-slate-500 text-xs font-semibold tracking-wide">Watch before you join</p>
                    </div>
                </div>
                <button 
                  onClick={() => {
                    if (classroom.isPaid) setShowEnrollmentPaymentModal(true);
                    else handleEnroll();
                  }}
                  className="px-6 py-2 bg-primary text-white rounded-xl font-semibold text-xs tracking-wide hover:bg-primary/90 transition"
                >
                  Join Now
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 px-6 py-5">
            {!isEnrolled && user?.role === 'student' && classroom.published && (
              <button
                onClick={handleEnroll}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
                style={primaryActionStyle}
              >
                {classroom.isPaid && classroom.pricing?.amount > 0 ? `Enroll \u00b7 ${formatAmount(classroom.pricing?.amount || 0, classroom.pricing?.currency || 'NGN')}` : 'Enroll (Free)'}
              </button>
            )}
            {!isEnrolled && user?.role === 'student' && !classroom.published && (
              <span className="px-5 py-2.5 text-sm font-semibold" style={{ backgroundColor: PANEL, color: SLATE, border: `1px solid ${HAIRLINE}`, borderRadius: '2px' }}>
                Not Available for Enrollment
              </span>
            )}
            {isEnrolled && user?.role === 'student' && (
              <ActionButton tone="danger" icon={LogOut} label="Leave Class" onClick={() => setShowLeaveClassModal(true)} />
            )}
            {(isEnrolled || canEdit) && (
              <>
                {/* Determine starter permission clearly */}
                {(() => {
                  const teacherIdStr = classroom.teacherId?._id ? classroom.teacherId._id.toString() : (classroom.teacherId ? classroom.teacherId.toString() : null);
                  const isTeacherOwner = teacherIdStr && user._id.toString() === teacherIdStr;
                  const isRoot = user.role === 'root_admin';
                  const classroomSchoolIdsForMeeting = (Array.isArray(classroom.schoolId) ? classroom.schoolId : [classroom.schoolId]).filter(Boolean);
                  const isSchoolAdminOfClass = user.role === 'school_admin' && classroomSchoolIdsForMeeting.some(s => {
                    const adminId = s?.adminId?._id || s?.adminId;
                    return adminId?.toString() === user?._id?.toString();
                  });
                  const canStartCall = isTeacherOwner || isRoot || isSchoolAdminOfClass;

                  if (canStartCall) {
                    // For starters show a single CTA: 'Start Lecture' when no current call exists, otherwise 'Attend Lecture'
                    const label = currentCall && currentCall.link ? 'Attend Lecture' : 'Start Lecture';
                    return (
                      <button
                        onClick={handleStartZoom}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
                        style={primaryActionStyle}
                      >
                        <Video size={16} />
                        <span>{label}</span>
                      </button>
                    );
                  }

                  // Not a starter: fall back to attend button for enrolled students
                  if (isEnrolled) {
                    return (
                      <button
                        onClick={handleJoinCall}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
                        style={primaryActionStyle}
                      >
                        <Video size={16} />
                        <span>Attend Lecture</span>
                      </button>
                    );
                  }

                  return null;
                })()}

                {
                  (() => {
                    const isTeacherUser = (user?.role === 'teacher' || user?.role === 'personal_teacher') && classroom?.teacherId?._id === user?._id;
                    const isAdmin = user?.role === 'root_admin' || user?.role === 'school_admin';
                    const wbAvailable = whiteboardInfo && (whiteboardInfo.sessionId || whiteboardInfo.whiteboardUrl);
                    const enabled = isTeacherUser || isAdmin || !!wbAvailable;
                    return (
                      <button
                        onClick={handleOpenWhiteboard}
                        disabled={!enabled}
                        title={!enabled ? 'Whiteboard not launched yet by the teacher' : 'Open whiteboard'}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        style={outlineActionStyle}
                      >
                        <PenSquare size={16} />
                        <span>Open whiteboard</span>
                      </button>
                    );
                  })()
                }
              </>
            )}
          </div>

          {/* Description & outcomes */}
          {(classroom.description || classroom.learningOutcomes || classroom.subject || classroom.level) && (
            <div className="px-6 py-5 border-t border-border space-y-5">
              {classroom.description && (
                <p className="text-muted-foreground text-sm leading-relaxed max-w-4xl">{classroom.description}</p>
              )}
              {classroom.learningOutcomes && (
                <div>
                  <div className="text-xs font-semibold tracking-wide mb-3" style={{ color: SLATE, letterSpacing: '0.04em' }}>Expected Learning Outcomes</div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-2.5 gap-x-8">
                    {classroom.learningOutcomes.split(',').map((outcome, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-muted-foreground text-sm">
                        <span className="inline-block h-1.5 w-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: GOLD }} />
                        <span>{outcome.trim()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap gap-6">
                {classroom.subject && (
                  <div className="flex items-center">
                    <Book size={15} style={{ color: SLATE, marginRight: 8 }} />
                    <span className="text-xs font-semibold tracking-wide" style={{ color: SLATE }}>
                      Subject: <span style={{ color: INK }}>{classroom.subject}</span>
                    </span>
                  </div>
                )}
                {classroom.level && (
                  <div className="flex items-center">
                    <GraduationCap size={15} style={{ color: SLATE, marginRight: 8 }} />
                    <span className="text-xs font-semibold tracking-wide" style={{ color: SLATE }}>
                      Level: <span style={{ color: INK }}>{classroom.level}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {weeklyPaymentRequired && user?.role === 'student' && (
          <div className="mt-8 p-10 bg-primary/10 border-2 border-primary/20 rounded-xl text-center animate-in fade-in zoom-in slide-in-from-bottom-4 duration-500">
            <div className="w-20 h-20 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-6">
              <CreditCard className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-3xl font-semibold text-slate-900 mb-4 tracking-tight">Weekly Subscription Expired</h3>
            <p className="text-slate-600 mb-8 max-w-md mx-auto font-medium">
              This classroom requires a sustaining fee of <span className="text-primary font-semibold">{formatAmount(classroom?.pricing?.amount || 0)}</span> every 7 days. Please pay to continue accessing your course materials.
            </p>
            <button
              onClick={handleEnrollmentPayment}
              disabled={isProcessingPayment}
              className="btn-premium px-12 py-4 rounded-xl shadow-none "
            >
              {isProcessingPayment ? <Loader2 className="w-6 h-6 animate-spin" /> : `Pay Weekly Fee - ${formatAmount(classroom?.pricing?.amount || 0)}`}
            </button>
          </div>
        )}

        {!weeklyPaymentRequired && (
          <>
            {/* Tab Navigation */}
            <div className="flex flex-wrap border-b border-border bg-card rounded-sm overflow-x-auto mt-6 no-scrollbar">
              {[
                { id: 'topics', label: 'Topics', icon: Book },
                ...((isEnrolled || canEdit) ? [
                  { id: 'assignments', label: 'Assignments', icon: FileText },
                  { id: 'exams', label: 'Exams', icon: GraduationCap },
                  { id: 'qna', label: 'Q&A Boards', icon: MessageSquare }
                ] : []),
                ...(canViewStudents ? [{ id: 'students', label: 'Students', icon: Users }] : [])
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab.id
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                >
                  <tab.icon size={15} strokeWidth={2} />
                  <span>{tab.label}</span>
                  {tab.id === 'exams' && exams.length > 0 && (
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'bg-border text-muted-foreground'}`}>{exams.length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'topics' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Current Topic Display */}
                {
                  (isEnrolled || canEdit) && classroom.currentTopicId && (
                    <TopicDisplay classroomId={id} />
                  )
                }

                {/* Topic Management Section */}
                {
                  (isEnrolled || canEdit || (!isEnrolled && user?.role === 'student')) && (
                    <div className="bg-card border border-border border-t-0 rounded-sm shadow-none p-6">
                      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                        <div>
                          <div className="font-serif text-sm font-semibold" style={{ color: NAVY }}>Topics</div>
                          <p className="text-xs font-semibold mt-1" style={{ color: SLATE }}>
                            {classroom.topics?.length || 0} module{classroom.topics?.length !== 1 ? 's' : ''} in syllabus
                          </p>
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setAiMode('syllabus');
                                setShowAIPanel(true);
                              }}
                              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"
                              style={primaryActionStyle}
                            >
                              <Sparkles size={15} />
                              <span className="hidden sm:inline">Generate topics</span>
                              <span className="sm:hidden">AI</span>
                            </button>
                            <button
                              onClick={() => navigate(`/classrooms/${id}/manage-topics`)}
                              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"
                              style={outlineActionStyle}
                            >
                              <BookOpen size={15} />
                              <span>Manage topics</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        {classroom.topics && classroom.topics.length > 0 ? (
                          (() => {
                            const sortedTopics = [...classroom.topics].sort((a, b) => (a.order || 0) - (b.order || 0));
                            const activeIndex = sortedTopics.findIndex(t => t.status === 'active');
                            let nextId = null;
                            if (activeIndex !== -1) {
                              const nextTopic = sortedTopics.find((t, i) => i > activeIndex && t.status === 'pending');
                              if (nextTopic) nextId = nextTopic._id;
                            } else {
                              const firstPending = sortedTopics.find(t => t.status === 'pending');
                              if (firstPending) nextId = firstPending._id;
                            }

                            return sortedTopics.map((topic, index) => {
                              const isNext = topic._id === nextId;
                              const isCurrent = topic.status === 'active';
                              const isDone = topic.status === 'completed';
                              const isPending = topic.status === 'pending' && !isNext;

                              return (
                                <TopicCardWithVideo
                                  key={topic._id}
                                  topic={topic}
                                  isCurrent={isCurrent}
                                  isDone={isDone}
                                  isNext={isNext}
                                  isPending={isPending}
                                />
                              );
                            });

                          })()
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <Book className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p>No topics added yet</p>
                            {canEdit && (
                              <p className="text-sm mt-1">Click "Manage Topics" to create your first topic</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }
              </div>
            )}
          </>
        )}

        {activeTab === 'qna' && (
          <QnABoardManagement
            classroomId={id}
            classroom={classroom}
            user={user}
            canEdit={canEdit}
          />
        )}

        {activeTab === 'assignments' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Assignment Management Section */}
            {
              (isEnrolled || canEdit) && (
                <div className="bg-card border border-border border-t-0 rounded-sm shadow-none p-6">
                  <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                    <h3 className="font-serif text-[15px] font-semibold" style={{ color: NAVY }}>Assignments</h3>
                    {canCreateAssignment && (
                      <button
                        onClick={() => setShowCreateAssignmentModal(true)}
                        className="flex items-center gap-2 px-3.5 h-9 bg-primary text-white rounded-sm hover:opacity-90 transition font-semibold text-xs tracking-wide shadow-none dark:shadow-none"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="hidden md:inline">Create Assignment</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {classroom.assignments && classroom.assignments.length > 0 ? (
                      classroom.assignments.map((assignment) => {
                        const submission = assignment.submissions?.find(
                          s => s.studentId?._id === user?._id
                        );
                        const isSubmitted = !!submission;
                        const isGraded = submission?.status === 'graded';

                        const isAssignmentExpanded = expandedAssignments.has(assignment._id);
                        const toggleAssignmentExpanded = () => {
                          setExpandedAssignments(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(assignment._id)) {
                              newSet.delete(assignment._id);
                            } else {
                              newSet.add(assignment._id);
                            }
                            return newSet;
                          });
                        };

                        return (
                          <div key={assignment._id} className="bg-card border border-border rounded-xl shadow-none overflow-hidden group">
                            <div
                              className="flex flex-col md:flex-row justify-between items-start p-6 cursor-pointer hover:bg-muted transition border-b border-transparent hover:border-border"
                              onClick={toggleAssignmentExpanded}
                            >
                              <div className="flex items-start space-x-3 flex-1 mb-4 md:mb-0">
                                {isAssignmentExpanded ? (
                                  <ChevronUp className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-muted-foreground mt-1 flex-shrink-0" />
                                )}
                                <div className="flex-1">
                                  <h4 className="font-semibold text-foreground tracking-tight">
                                    {assignment.title}
                                    {assignment.topicId?.name && (
                                      <span className="ml-2 text-xs font-semibold tracking-wide text-primary/60">
                                        [{assignment.topicId.name}]
                                      </span>
                                    )}
                                  </h4>
                                  {!isAssignmentExpanded && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1 font-medium">{assignment.description}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 items-center md:justify-end flex-shrink-0 w-full md:w-auto ml-8 md:ml-0 font-semibold">
                                {assignment.dueDate ? (
                                  <span className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-xs tracking-wide border border-border">
                                    DUE: {formatDisplayDate(assignment.dueDate)}
                                  </span>
                                ) : (
                                  <span className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-xs tracking-wide border border-border">
                                    OPEN ENDED
                                  </span>
                                )}
                                
                                {isGraded && (assignment.assignmentType === 'theory' || (assignment.assignmentType === 'mcq' && (!assignment.publishResultsAt || new Date() >= new Date(assignment.publishResultsAt)))) && (
                                  <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-xs tracking-wide border border-emerald-500/20">
                                    GRADED
                                  </span>
                                )}
                                {isSubmitted && !isGraded && (
                                  <span className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-xs tracking-wide border border-amber-500/20">
                                    SUBMITTED
                                  </span>
                                )}
                                {canEdit && (
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAssignmentPublishToggle(assignment);
                                      }}
                                      disabled={publishingAssignmentId === assignment._id}
                                      className={`p-1 transition-colors ${assignment.published !== false ? 'text-green-500 hover:text-green-700' : 'text-gray-400 hover:text-gray-600'
                                        }`}
                                      title={assignment.published !== false ? 'Published - Click to unpublish' : 'Unpublished - Click to publish'}
                                    >
                                      {publishingAssignmentId === assignment._id ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                      ) : assignment.published !== false ? (
                                        <Eye className="w-5 h-5" />
                                      ) : (
                                        <EyeOff className="w-5 h-5" />
                                      )}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleNotifyStudents(assignment._id);
                                      }}
                                      disabled={notifyingAssignmentId === assignment._id}
                                      className="text-blue-500 hover:text-blue-700 p-1 disabled:opacity-50"
                                      title="Notify students (re-publish)"
                                    >
                                      {notifyingAssignmentId === assignment._id ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                      ) : (
                                        <Megaphone className="w-5 h-5 transition-colors" />
                                      )}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenEditAssignment(assignment);
                                      }}
                                      className="text-yellow-500 hover:text-yellow-700 p-1"
                                      title="Edit assignment"
                                    >
                                      <Edit className="w-5 h-5 transition-colors" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteAssignment(assignment._id);
                                      }}
                                      className="text-red-500 hover:text-red-700 p-1"
                                      title="Delete assignment"
                                    >
                                      <X className="w-5 h-5 transition-colors" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {isAssignmentExpanded && (
                               <div className="px-6 pb-6 border-t border-border animate-in fade-in duration-300">
                                <div className="pt-4">
                                  <p className="text-sm text-muted-foreground mb-4 font-medium leading-relaxed">{assignment.description}</p>
                                </div>

                                {user?.role === 'student' && isGraded && submission && (assignment.assignmentType === 'theory' || (assignment.assignmentType === 'mcq' && (!assignment.publishResultsAt || new Date() >= new Date(assignment.publishResultsAt)))) && (
                                  <div className="bg-gray-50 rounded-xl p-4 mb-4">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <CheckCircle className="w-5 h-5 text-green-600" />
                                      <span className="font-semibold">
                                        Score: {submission.score}/{assignment.maxScore}
                                      </span>
                                    </div>
                                    {submission.feedback && (
                                      <p className="text-gray-700 mt-2">Feedback: {submission.feedback}</p>
                                    )}
                                    <div className="mt-4 border-t pt-4">
                                      <h5 className="font-semibold text-gray-700 mb-2">Your Submission:</h5>
                                      {assignment.assignmentType === 'theory' && submission.answers && Array.isArray(submission.answers) && (
                                        <ul className="list-disc list-inside text-gray-700">
                                          {assignment.questions.map((q, qIndex) => {
                                            const questionGrade = submission.questionScores?.find(qs => qs.questionIndex === qIndex);
                                            return (
                                              <li key={qIndex}>
                                                <strong>Q{qIndex + 1}:</strong> {q.questionText}<br />
                                                Your Answer: <span className="whitespace-pre-wrap">{submission.answers[qIndex]}</span><br />
                                                {questionGrade && (
                                                  <span className="ml-2 text-sm font-medium text-green-600">
                                                    Score: {questionGrade.score}/{q.maxScore}
                                                    {questionGrade.feedback && ` - Feedback: ${questionGrade.feedback}`}
                                                  </span>
                                                )}
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      )}
                                      {assignment.assignmentType === 'mcq' && submission.answers && Array.isArray(submission.answers) && (
                                        <ul className="list-disc list-inside text-gray-700">
                                          {assignment.questions.map((q, qIndex) => (
                                            <li key={qIndex}>
                                              <strong>Q{qIndex + 1}:</strong> {q.questionText}<br />
                                              Your Answer: {submission.answers[qIndex]}
                                              {q.correctOption && (
                                                <span className={`ml-2 text-sm font-medium ${submission.answers[qIndex] === q.correctOption ? 'text-green-600' : 'text-red-600'}`}>
                                                  ({submission.answers[qIndex] === q.correctOption ? 'Correct' : `Incorrect, Correct: ${q.correctOption}`})
                                                </span>
                                              )}
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Student View: Submitted but not graded, or MCQ graded but results not published yet */}
                                {user?.role === 'student' && isSubmitted && (!isGraded || (assignment.assignmentType === 'mcq' && assignment.publishResultsAt && new Date() < new Date(assignment.publishResultsAt))) && (
                                  <div className="bg-gray-50 rounded-xl p-4 mb-4">
                                    <p className="font-semibold text-blue-600">
                                      {isGraded && assignment.assignmentType === 'mcq' && assignment.publishResultsAt && new Date() < new Date(assignment.publishResultsAt)
                                        ? `Results for this MCQ assignment will be published on ${new Date(assignment.publishResultsAt).toLocaleString()}.`
                                        : 'Your assignment has been submitted and is awaiting grading.'
                                      }
                                    </p>
                                    <div className="mt-4 border-t pt-4">
                                      <h5 className="font-semibold text-gray-700 mb-2">Your Submission:</h5>
                                      {assignment.assignmentType === 'theory' && submission.answers && Array.isArray(submission.answers) && (
                                        <ul className="list-disc list-inside text-gray-700">
                                          {assignment.questions.map((q, qIndex) => (
                                            <li key={qIndex}>
                                              <strong>Q{qIndex + 1}:</strong> {q.questionText}<br />
                                              Your Answer: <span className="whitespace-pre-wrap">{submission.answers[qIndex]}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                      {assignment.assignmentType === 'theory' && submission.answers && !Array.isArray(submission.answers) && (
                                        <p className="text-gray-700">{submission.answers}</p>
                                      )}
                                      {assignment.assignmentType === 'mcq' && submission.answers && Array.isArray(submission.answers) && (
                                        <ul className="list-disc list-inside text-gray-700">
                                          {assignment.questions.map((q, qIndex) => (
                                            <li key={qIndex}>
                                              <strong>Q{qIndex + 1}:</strong> {q.questionText}<br />
                                              Your Answer: {submission.answers[qIndex]}
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {user?.role === 'student' && !isSubmitted && (
                                  (() => {
                                    const isPastDue = assignment.dueDate && new Date() > new Date(assignment.dueDate);
                                    return (
                                      <button
                                        onClick={(e) => {
                                          if (isPastDue) return;
                                          e.stopPropagation();

                                          // Check topic access before opening submit modal
                                          // assignment.topicId might be populated or just ID
                                          const topicId = assignment.topicId?._id || assignment.topicId;
                                          if (!checkTopicAccess(topicId)) return;

                                          setAssignmentToSubmit(assignment);
                                          setShowSubmitAssignmentModal(true);
                                        }}
                                        disabled={isPastDue}
                                        className={`px-4 py-2 rounded-xl transition ${isPastDue
                                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                          : 'bg-primary text-white hover:bg-primary/90'
                                          }`}
                                      >
                                        {isPastDue ? 'Deadline Passed' : 'Submit Assignment'}
                                      </button>
                                    );
                                  })()
                                )}

                                {/* Teacher/Admin: View and Grade Submissions */}
                                {canGradeAssignment && (user?.role === 'teacher' || user?.role === 'personal_teacher' ? classroom.teacherId?._id === user?._id : true) && (
                                  <div className="mt-4 border-t border-border pt-4">
                                    <h4 className="text-xs font-semibold tracking-wide text-muted-foreground mb-3">Submissions ({assignment.submissions?.length || 0})</h4>
                                    {assignment.submissions && assignment.submissions.length > 0 ? (
                                      assignment.submissions.map(sub => {
                                        const isExpanded = expandedSubmissions.has(sub._id);
                                        const toggleExpanded = () => {
                                          setExpandedSubmissions(prev => {
                                            const newSet = new Set(prev);
                                            if (newSet.has(sub._id)) {
                                              newSet.delete(sub._id);
                                            } else {
                                              newSet.add(sub._id);
                                            }
                                            return newSet;
                                          });
                                        };

                                        return (
                                          <div key={sub._id} className="border border-border rounded-xl mb-2 bg-muted overflow-hidden">
                                            <div
                                              className="flex justify-between items-center p-3 cursor-pointer hover:bg-muted transition"
                                              onClick={toggleExpanded}
                                            >
                                              <div className="flex items-center space-x-2 flex-1">
                                                {isExpanded ? (
                                                  <ChevronUp className="w-4 h-4 text-primary" />
                                                ) : (
                                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                                )}
                                                <div className="flex-1">
                                                  <p className="text-xs font-semibold tracking-wide text-foreground">{sub.studentId?.name || 'Unknown Student'}</p>
                                                  <p className="text-xs font-semibold text-muted-foreground tracking-wide mt-0.5">Status: <span className="text-primary">{sub.status}</span></p>
                                                  {sub.status === 'graded' && (
                                                    <p className="text-xs font-semibold text-emerald-500 tracking-wide">Score: {sub.score}/{assignment.maxScore}</p>
                                                  )}
                                                </div>
                                              </div>
                                              {sub.status !== 'graded' ? (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedAssignmentForGrading(assignment);
                                                    setSubmissionToGrade(sub);
                                                    setShowGradeModal(true);
                                                  }}
                                                  className="px-4 py-1.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition text-xs font-semibold tracking-wide"
                                                >
                                                  Grade
                                                </button>
                                              ) : (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedAssignmentForGrading(assignment);
                                                    setSubmissionToGrade(sub);
                                                    setShowGradeModal(true);
                                                  }}
                                                  className="px-4 py-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl hover:bg-amber-500/20 transition text-xs font-semibold tracking-wide"
                                                >
                                                  Edit Grade
                                                </button>
                                              )}
                                            </div>
                                            {isExpanded && (
                                              <div className="px-3 pb-3 pt-3 border-t border-border bg-card">
                                                {/* Display answers based on type */}
                                                {assignment.assignmentType === 'theory' && sub.answers && (
                                                  <div className="p-3 bg-muted rounded-xl border border-border/50">
                                                    <p className="text-xs font-semibold text-muted-foreground tracking-wide mb-2">Student Response:</p>
                                                    <p className="text-sm text-foreground whitespace-pre-wrap font-medium">{Array.isArray(sub.answers) ? sub.answers.join('\n') : sub.answers}</p>
                                                  </div>
                                                )}
                                                {assignment.assignmentType === 'mcq' && sub.answers && Array.isArray(sub.answers) && (
                                                  <div className="p-3 bg-muted rounded-xl border border-border/50">
                                                    <p className="text-xs font-semibold text-muted-foreground tracking-wide mb-2">Selected Options:</p>
                                                    <ul className="space-y-1">
                                                      {sub.answers.map((ans, ansIdx) => (
                                                        <li key={ansIdx} className="text-xs font-semibold flex items-center gap-2">
                                                          <span className="text-muted-foreground">Q{ansIdx+1}:</span>
                                                          <span className="text-foreground">{ans}</span>
                                                          {assignment.questions[ansIdx]?.correctOption && (
                                                            <span className={`px-2 py-0.5 rounded-full text-xs tracking-wide ${ans === assignment.questions[ansIdx].correctOption ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                              {ans === assignment.questions[ansIdx].correctOption ? 'Correct' : `Wrong (Key: ${assignment.questions[ansIdx].correctOption})`}
                                                            </span>
                                                          )}
                                                        </li>
                                                      ))}
                                                    </ul>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <p className="text-muted-foreground text-center py-4 font-semibold text-xs tracking-wide">No intellectual payloads delivered yet.</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-gray-500 text-center py-4">No assignments for this classroom yet</p>
                    )}
                  </div>
                </div>
              )}
          </div>
        )}

        {activeTab === 'exams' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-card border border-border border-t-0 rounded-sm shadow-none p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-serif text-[15px] font-semibold" style={{ color: NAVY }}>Class Examinations</h3>
                  <p className="text-xs font-semibold text-muted-foreground tracking-wide">Access scheduled assessments and final exams.</p>
                </div>
                {canEdit && (
                  <button
                    onClick={() => {
                      setExamToEdit(null);
                      setShowCreateExamModal(true);
                    }}
                    className="flex items-center justify-center gap-2 px-3.5 h-9 bg-primary text-white rounded-sm hover:bg-primary/90 transition font-semibold text-xs tracking-wide shadow-none dark:shadow-none"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Exam</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                {exams.length > 0 ? (
                  exams.map(exam => {
                    const isPastDue = exam.dueDate && new Date() > new Date(exam.dueDate);
                    return (
                      <div key={exam._id} className="group bg-muted hover:bg-muted rounded-xl p-6 border border-border hover:border-primary/30 hover:shadow-none transition-all duration-300">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex items-start space-x-4">
                            <div className={`p-4 rounded-xl shadow-none ${isPastDue ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                              <GraduationCap className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="text-lg font-semibold text-foreground leading-tight mb-1 group-hover:text-primary transition-colors tracking-tight">{exam.title}</h4>
                              <p className="text-xs text-muted-foreground font-medium line-clamp-1">{exam.description || 'No detailed briefing provided.'}</p>

                              <div className="flex flex-wrap gap-4 mt-3">
                                <div className="flex items-center text-xs font-semibold tracking-wide text-muted-foreground">
                                  <Clock className="w-3.5 h-3.5 mr-1.5 text-primary" />
                                  {exam.duration} Minutes
                                </div>
                                {exam.dueDate && (
                                  <div className={`flex items-center text-xs font-semibold tracking-wide ${isPastDue ? 'text-rose-500' : 'text-muted-foreground'}`}>
                                    <Calendar className="w-3.5 h-3.5 mr-1.5" />
                                    DEADLINE: {new Date(exam.dueDate).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3 self-end md:self-center">
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => navigate(`/exams/${exam._id}/submissions`)}
                                  className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-50 transition"
                                >
                                  Submissions
                                </button>
                                <button
                                  onClick={() => {
                                    setExamToEdit(exam);
                                    setShowCreateExamModal(true);
                                  }}
                                  className="p-2.5 bg-yellow-50 text-yellow-600 border border-yellow-100 rounded-xl hover:bg-yellow-100 transition"
                                  title="Edit Exam"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              </>
                            )}

                            {user?.role === 'student' && (
                              <button
                                onClick={() => navigate(`/exam-center/${exam.linkToken}`)}
                                disabled={isPastDue || !exam.isPublished}
                                className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${isPastDue || !exam.isPublished
                                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-primary text-white hover:bg-primary/90 shadow-none  dark:shadow-none'
                                  }`}
                              >
                                {isPastDue ? 'Expired' : !exam.isPublished ? 'Unpublished' : (
                                  <>
                                    <span>Take Exam</span>
                                    <Play className="w-4 h-4 fill-current" />
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-16 bg-muted/10 rounded-xl border-2 border-dashed border-border/50">
                    <GraduationCap className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                    <h5 className="text-xs font-semibold text-muted-foreground tracking-wide mb-1">No Exams Scheduled</h5>
                    <p className="text-xs font-semibold text-muted-foreground/60 tracking-wide">There are currently no examinations assigned to this class.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'students' && canViewStudents && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-card border border-border border-t-0 rounded-sm shadow-none p-6">
              <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                <div>
                   <h3 className="font-serif text-[15px] font-semibold" style={{ color: NAVY }}>Enrolled Students</h3>
                   <p className="text-xs font-semibold text-muted-foreground tracking-wide">{classroom.students?.length || 0} / {classroom.capacity} SEATS FILLED</p>
                </div>
                {canManageStudents && (
                  <button
                    onClick={() => {
                      setSelectedStudentId('');
                      fetchAvailableStudents();
                      setShowAddStudentModal(true);
                    }}
                    className="flex items-center gap-2 px-3.5 h-9 bg-primary text-primary-foreground rounded-sm hover:opacity-90 transition font-semibold text-xs tracking-wide shadow-none dark:shadow-none"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span className="hidden md:inline">Add Student</span>
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {classroom.students && classroom.students.length > 0 ? (
                  classroom.students.map((student) => (
                    <div key={student._id || student} className="flex items-center justify-between p-4 bg-muted border border-border rounded-xl hover:bg-muted/40 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-semibold text-xs">
                          {typeof student === 'object' ? student.name?.charAt(0) : '?'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground tracking-tight">{typeof student === 'object' ? student.name : 'Securing Data...'}</p>
                          <p className="text-xs font-semibold text-muted-foreground tracking-wide">{typeof student === 'object' ? student.email : ''}</p>
                        </div>
                      </div>
                      {canManageStudents && (
                        <button
                          onClick={() => handleRemoveStudent(student._id || student)}
                          className="w-10 h-10 flex items-center justify-center bg-rose-500/10 text-rose-500 rounded-xl hover:bg-danger/90 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                          title="Revoke Access"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 bg-muted/10 rounded-xl border-2 border-dashed border-border/50">
                    <Users className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-xs font-semibold text-muted-foreground tracking-wide">No students found in this class.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {user?.role === 'root_admin' && classroom?.schoolId && (
          <div className="bg-card border border-border rounded-sm shadow-none p-6 mt-6">
            {/* Teacher Management (Root Admin only - Always visible regardless of tab) */}
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <div>
                <h3 className="font-serif text-[15px] font-semibold" style={{ color: NAVY }}>Administrative Console</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted border border-border rounded-xl font-semibold">
                    <p className="text-xs text-muted-foreground tracking-wide mb-1">COMMANDING TEACHER</p>
                    <p className="text-sm text-foreground">{classroom.teacherId?.name} ({classroom.teacherId?.email})</p>
                  </div>
                  {classroom.schoolId?.adminId && (
                    <div className="p-4 bg-muted border border-border rounded-xl font-semibold">
                      <p className="text-xs text-muted-foreground tracking-wide mb-1">SCHOOL ADJUTANT</p>
                      <p className="text-sm text-foreground">{classroom.schoolId.adminId.name} ({classroom.schoolId.adminId.email})</p>
                    </div>
                  )}
                </div>
              </div>
              {canChangeTeacher && (
                <button
                  onClick={() => {
                    fetchAvailableTeachers();
                    setShowChangeTeacherModal(true);
                  }}
                  className="px-3.5 h-9 bg-primary text-primary-foreground rounded-sm hover:opacity-90 transition font-semibold text-xs tracking-wide shadow-none shrink-0 self-start"
                >
                  Change Teacher
                </button>
              )}
            </div>
          </div>
        )}


        {/* Create Assignment Modal */}
        {
          showCreateAssignmentModal && (
            <CreateAssignmentModal
              show={showCreateAssignmentModal}
              onClose={() => {
                setShowCreateAssignmentModal(false);
                setAssignmentToEdit(null);
                setAssignmentAiPrefill(null);
              }}
              onSubmitSuccess={handleCreateAssignment} // Pass the success callback
              classroomId={id} // Pass the current classroom ID
              availableTopics={availableTopicsForAssignment}
              editAssignment={assignmentToEdit}
              aiPrefill={assignmentAiPrefill}
            />
          )
        }

        {/* Grade Assignment Modal */}
        {
          showGradeModal && (
            <GradeAssignmentModal
              show={showGradeModal}
              onClose={() => setShowGradeModal(false)}
              onSubmitSuccess={handleGradeSubmission}
              selectedAssignment={selectedAssignmentForGrading}
              submissionToGrade={submissionToGrade}
            />
          )
        }

        {/* Submit Assignment Modal */}
        {
          showSubmitAssignmentModal && assignmentToSubmit && (
            <SubmitAssignmentModal
              assignment={assignmentToSubmit}
              onClose={() => setShowSubmitAssignmentModal(false)}
              onSubmit={handleSubmitAssignment}
              isSubmitting={isSubmittingAssignment}
            />
          )
        }

        {/* Create Exam Modal */}
        {showCreateExamModal && (
          <CreateExamModal
            show={showCreateExamModal}
            onClose={() => {
              setShowCreateExamModal(false);
              setExamToEdit(null);
              setExamAiPrefill(null);
            }}
            onSubmitSuccess={fetchExams}
            classroomId={id}
            editExam={examToEdit}
            aiPrefill={examAiPrefill}
          />
        )}

        {/* Add Student Modal */}
        {showAddStudentModal && (
          <div className="fixed inset-0 bg-slate-950/80  z-[100] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="bg-card border border-border rounded-xl w-full max-w-md p-8 shadow-none animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-semibold tracking-tight text-foreground">Deploy Candidates</h3>
                  <button onClick={() => setShowAddStudentModal(false)} className="p-2 hover:bg-muted rounded-xl transition text-muted-foreground"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleAddStudent} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground tracking-wide px-1">Select Candidate Profile</label>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="w-full bg-muted border-2 border-border p-4 rounded-xl font-semibold text-foreground outline-none focus:border-primary transition-all appearance-none"
                    >
                      <option value="" disabled className="bg-card">Awaiting Selection...</option>
                      {availableStudents.map(student => (
                        <option key={student._id} value={student._id} className="bg-card">{student.name} ({student.email})</option>
                      ))}
                    </select>
                    {availableStudents.length === 0 && (
                      <div className="mt-4 p-4 bg-muted rounded-xl border border-dashed border-border text-center">
                        <p className="text-xs font-semibold text-muted-foreground tracking-wide">No unassigned candidates found.</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowAddStudentModal(false)}
                      className="flex-1 px-6 py-3 rounded-xl border border-border font-semibold text-xs tracking-wide text-muted-foreground hover:bg-muted transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!selectedStudentId || availableStudents.length === 0 || isAddingStudent}
                      className="btn-premium flex-1"
                    >
                      {isAddingStudent ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'CONFIRM ENROLLMENT'}
                    </button>
                  </div>
                </form>
              </div>
            </div >
          </div>
        )}

        {/* Assign Teacher Modal */}
        {
          showChangeTeacherModal && (
            <div className="fixed inset-0 bg-slate-950/80  z-[100] overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <div className="bg-card border border-border rounded-xl w-full max-w-md p-8 shadow-none animate-in zoom-in-95 duration-300">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-semibold tracking-tight text-foreground">Assign Command</h3>
                    <button onClick={() => setShowChangeTeacherModal(false)} className="p-2 hover:bg-muted rounded-xl transition text-muted-foreground">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground tracking-wide px-1">Select New Commander</label>
                      <select
                        value={selectedTeacherId}
                        onChange={(e) => setSelectedTeacherId(e.target.value)}
                        className="w-full bg-muted border-2 border-border p-4 rounded-xl font-semibold text-foreground outline-none focus:border-primary transition-all appearance-none"
                      >
                        <option value="" disabled className="bg-card">Awaiting Signal...</option>
                        {availableTeachers.map(teacher => (
                          <option key={teacher._id} value={teacher._id} className="bg-card">{teacher.name} ({teacher.email})</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-4 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowChangeTeacherModal(false)}
                        className="flex-1 px-6 py-3 rounded-xl border border-border font-semibold text-xs tracking-wide text-muted-foreground hover:bg-muted transition"
                      >
                        CANCEL
                      </button>
                      <button
                        type="button"
                        disabled={!selectedTeacherId || isChangingTeacher}
                        onClick={handleChangeTeacher}
                        className="btn-premium flex-1"
                      >
                        {isChangingTeacher ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'REASSIGN COMMAND'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* Payment Required Modal */}
        <PaymentRequiredModal
          show={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          topic={blockedTopic}
          classroomId={id}
          onSuccess={fetchTopicStatus}
        />

        {/* Enrollment Payment Modal */}
        {showEnrollmentPaymentModal && (
          <div className="fixed inset-0 bg-slate-950/80  z-[100] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="bg-card border border-border rounded-xl shadow-none max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8 pb-0 flex justify-between items-center">
                  <div className="bg-primary/10 p-3 rounded-xl border border-primary/20">
                    <CreditCard className="w-6 h-6 text-primary" />
                  </div>
                  <button
                    onClick={() => setShowEnrollmentPaymentModal(false)}
                    className="p-2 hover:bg-muted rounded-xl transition text-muted-foreground"
                    disabled={isProcessingPayment}
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="p-8 pt-6 text-center">
                  <h3 className="text-xl font-semibold tracking-tight text-foreground mb-2">Initialize Enrollment</h3>
                  <p className="text-xs font-semibold text-muted-foreground tracking-wide mb-8 px-4 leading-relaxed">System authorization required to grant access to <span className="text-primary font-semibold">"{classroom.name}"</span>.</p>

                  <div className="bg-muted rounded-xl p-8 mb-8 border border-border shadow-none">
                    <div className="text-xs font-semibold text-muted-foreground tracking-wide mb-2">ACCESS FEE</div>
                    <div className="text-4xl font-semibold text-foreground tracking-tight">
                      {formatAmount(classroom.pricing?.amount || 0, classroom.pricing?.currency || 'NGN')}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => setShowEnrollmentPaymentModal(false)}
                      disabled={isProcessingPayment}
                      className="flex-1 px-6 py-3 rounded-xl border border-border font-semibold text-xs tracking-wide text-muted-foreground hover:bg-muted transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEnrollmentPayment}
                      disabled={isProcessingPayment}
                      className="btn-premium flex-1"
                    >
                      {isProcessingPayment ? (
                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                      ) : (
                        'INITIATE PROTOCOL'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Delete Topic Confirmation Modal */}
        <ConfirmationModal
          show={showDeleteTopicModal}
          onClose={() => {
            setShowDeleteTopicModal(false);
            setTopicToDelete(null);
          }}
          onConfirm={confirmDeleteTopic}
          title="Delete Topic?"
          message="Are you sure you want to delete this topic? This action cannot be undone."
          confirmText="Delete"
        />

        {/* Leave Class Confirmation Modal */}
        <ConfirmationModal
          show={showLeaveClassModal}
          onClose={() => setShowLeaveClassModal(false)}
          onConfirm={handleLeaveClass}
          title="Leave Class"
          message="Are you sure you want to leave this class? You will need to enroll again to rejoin."
          confirmText="Leave"
        />
        {/* Delete Assignment Modal */}
        <ConfirmationModal
          show={showDeleteAssignmentModal}
          onClose={() => setShowDeleteAssignmentModal(false)}
          onConfirm={confirmDeleteAssignment}
          title="Delete Assignment?"
          message="Are you sure you want to delete this assignment? All student submissions and grades will be permanently removed. This action cannot be undone."
          confirmText="Delete"
          isLoading={isDeletingAssignment}
        />

        {/* Delete Classroom Modal */}
        <ConfirmationModal
          show={showDeleteClassModal}
          onClose={() => setShowDeleteClassModal(false)}
          onConfirm={confirmDeleteClassroom}
          title="Delete Classroom?"
          message="Are you sure you want to delete this classroom? This action cannot be undone."
          confirmText="Delete"
          isLoading={isDeletingClass}
        />

        {/* End Classroom Confirmation Modal */}
        <ConfirmationModal
          show={showEndClassModal}
          onClose={() => setShowEndClassModal(false)}
          onConfirm={confirmEndClassroom}
          title="End Classroom?"
          message={
            <div>
              <p className="text-gray-500 text-center mb-4 text-sm">
                Are you sure? This action will:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-500 mb-2 space-y-1 text-left">
                <li>Remove all students</li>
                <li>Unpublish assignments & clear deadlines</li>
                <li>Reset all topic progress</li>
                <li>Notify students and request feedback</li>
              </ul>
            </div>
          }
          confirmText="End Class"
          confirmButtonColor="bg-primary hover:bg-primary/90"
          icon={Flag}
          iconBg="bg-indigo-100"
          iconColor="text-primary"
          isLoading={isEndingClass}
        />


        {
          showGoogleAuth && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: '#fff', padding: 24, borderRadius: 8, minWidth: 320, maxWidth: 400 }}>
                <GoogleMeetAuth userId={user?._id} />
                <button style={{ marginTop: 16 }} onClick={() => setShowGoogleAuth(false)}>Cancel</button>
              </div>
            </div>
          )
        }

        <ConfirmationModal
          show={showRemoveStudentModal}
          onClose={() => setShowRemoveStudentModal(false)}
          onConfirm={confirmRemoveStudent}
          title="Remove Student"
          message="Are you sure you want to remove this student from the classroom? They will lose access to all course materials."
          confirmText="Remove"
          isLoading={isRemovingStudent}
        />

        <AIAssistantPanel
          isOpen={showAIPanel}
          onClose={() => setShowAIPanel(false)}
          allowedModes={aiMode === 'syllabus' ? ['syllabus'] : ['classroom']}
          defaultMode={aiMode}
          prefill={{
            subject: classroom?.subject || editForm.subject,
            className: classroom?.name || editForm.name,
            level: classroom?.level || editForm.level,
            description: classroom?.description || editForm.description,
            outcomes: classroom?.learningOutcomes || editForm.learningOutcomes,
            teacherHint: classroom?.description || editForm.description || ''
          }}
          onApply={(data) => {
            if (aiMode === 'syllabus') {
              handleApplySyllabus(data);
            } else {
              setEditForm(prev => ({
                ...prev,
                name: data.name || prev.name,
                description: data.description || prev.description,
                learningOutcomes: data.learningOutcomes || prev.learningOutcomes
              }));
              setShowAIPanel(false);
            }
          }}
        />
      </div >
    </Layout >
  );
};

export default ClassroomDetail;
