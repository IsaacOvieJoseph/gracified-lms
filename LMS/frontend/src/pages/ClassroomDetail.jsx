import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useParams, useNavigate } from 'react-router-dom';
import { Video, Edit, Plus, Calendar, Users, User, Book, DollarSign, X, UserPlus, FileText, CheckCircle, Send, ChevronDown, ChevronUp, ChevronRight, GripVertical, Trash2, Loader2, Clock, ExternalLink, Globe, Share2, Facebook, Twitter, Linkedin, Copy, Play, Pause, Circle, FastForward, Eye, EyeOff, Megaphone, Flag, CreditCard, School, GraduationCap, Layers, Sparkles, MessageSquare, MoreHorizontal } from 'lucide-react';
import { convertLocalToUTC, convertUTCToLocal, formatDisplayDate } from '../utils/timezone';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatAmount } from '../utils/currency';
import FormFieldHelp from '../components/FormFieldHelp';
import CreateAssignmentModal from '../components/CreateAssignmentModal';
import GradeAssignmentModal from '../components/GradeAssignmentModal';
import SubmitAssignmentModal from '../components/SubmitAssignmentModal';
import TopicDisplay from '../components/TopicDisplay';
import GoogleMeetAuth from '../components/GoogleMeetAuth';
import PaymentRequiredModal from '../components/PaymentRequiredModal';
import ConfirmationModal from '../components/ConfirmationModal';
import QnABoardManagement from '../components/QnABoardManagement';

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
          <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-2xl">
             <Video className="w-8 h-8 text-slate-500" />
          </div>
          <div className="space-y-1">
              <p className="text-white text-lg font-black tracking-tight">External Stream</p>
              <p className="text-slate-500 text-sm max-w-xs mx-auto">This content is hosted on a secure 3rd-party platform.</p>
          </div>
          <a
              href={vid.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 px-6 py-3 bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black border border-slate-700 transition-all flex items-center gap-3 group shadow-lg"
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
      className={`border-2 rounded-lg p-4 transition ${
        isCurrent ? 'border-primary/40 bg-primary/10 shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]' :
        isDone ? 'border-emerald-500/20 bg-emerald-500/5 opacity-80' :
        isNext ? 'border-indigo-500/30 bg-indigo-500/10 shadow-sm' :
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
            <Play className="w-5 h-5 text-indigo-600" />
          ) : (
            <Circle className="w-5 h-5 text-gray-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <h4 className="font-bold text-foreground">{topic.name}</h4>
            {isCurrent && (
              <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-wider border border-primary/20">Current</span>
            )}
            {isDone && (
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-500/20">Done</span>
            )}
            {isNext && (
              <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-500 rounded-full text-[10px] font-black uppercase tracking-wider border border-indigo-500/20">Next</span>
            )}
            {isPending && (
              <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-[10px] font-black uppercase tracking-wider border border-border">Pending</span>
            )}
            {hasVideos && (
              <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded-full text-[10px] font-black uppercase tracking-wider border border-purple-500/20 flex items-center gap-1">
                <Video className="w-3 h-3" /> {recordedVideos.length} Lecture{recordedVideos.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {topic.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{topic.description}</p>
          )}
          {topic.lessonsOutline && (
            <div className="mt-2 p-2 bg-muted/30 rounded text-[11px] text-muted-foreground border border-border/50">
              <p className="font-bold text-foreground/70 mb-1 uppercase tracking-widest text-[9px]">Lesson Outline:</p>
              <p className="line-clamp-3 whitespace-pre-wrap">{topic.lessonsOutline}</p>
            </div>
          )}

          {/* Persistent Theater Mode - ALWAYS ON FOR TOPICS WITH VIDEOS */}
          {hasVideos && (
            <div className="mt-4">
              <div className="mt-4 flex flex-col lg:flex-row gap-4 md:gap-5 bg-slate-900 rounded-3xl md:rounded-[2rem] overflow-hidden shadow-xl p-2 md:p-5 border border-slate-800 animate-in fade-in zoom-in duration-300">
                {/* Main Player Section - MAX WIDTH ON MOBILE */}
                <div className="flex-1 bg-black rounded-2xl md:rounded-3xl overflow-hidden flex items-center justify-center min-h-[250px] md:min-h-[500px] lg:min-h-[600px] shadow-inner relative border border-slate-800/50">
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
                      <p className="font-bold text-sm">Select a chapter from the list</p>
                    </div>
                  )}
                </div>

                {/* Vertical Video List Sidebar - CAROUSEL ON MOBILE */}
                <div className="w-full lg:w-72 shrink-0 flex flex-row lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto pb-4 lg:pb-0 pr-1 snap-x scrollbar-hide lg:custom-scrollbar">
                  <div className="hidden lg:flex items-center justify-between mb-3 px-1 border-b border-slate-800 pb-2">
                      <h5 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Course Materials</h5>
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">{recordedVideos.length} Parts</span>
                  </div>
                  
                  {[...recordedVideos].sort((a, b) => (a.order || 0) - (b.order || 0)).map((vid, idx) => {
                    const vId = vid._id || idx;
                    const isActive = activeVideoId === vId;
                    const isWatched = watchedVideoIds.has(vId);
                    return (
                      <div 
                        key={vId} 
                        onClick={() => handleVideoSelect(vId)}
                        className={`group flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer transition-all duration-200 border-2 snap-start shrink-0 w-[240px] lg:w-full ${
                          isActive 
                            ? 'bg-slate-800 border-slate-700 shadow-md translate-x-0 lg:translate-x-1' 
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
                              <div className={`w-0.5 h-0.5 rounded-full ${isActive ? 'bg-slate-500' : isWatched ? 'bg-emerald-500/30' : 'bg-slate-700'}`} />
                              <span className={`text-[8px] font-bold ${isActive ? 'text-slate-500' : 'text-slate-700'}`}>{vid.videoType === 'url' ? 'Link' : 'File'}</span>
                          </div>
                        </div>

                        {isActive && (
                          <div className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse mr-1" />
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



const ClassroomDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: userLoading } = useAuth();
  const [classroom, setClassroom] = useState(null);
  const [whiteboardInfo, setWhiteboardInfo] = useState(null);
  const [currentCall, setCurrentCall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [subjectOptions, setSubjectOptions] = useState(defaultSubjects.map(s => ({ value: s, label: s }))); // Dynamic subjects
  const [editForm, setEditForm] = useState({ name: '', description: '', learningOutcomes: '', subject: '', level: 'Other', capacity: 30, pricingType: 'per_lecture', pricingAmount: 0, schedule: [], isPrivate: false, isPaid: false, teacherId: '', schoolIds: [] });
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
      introVideo: classroom.introVideo || ''
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
    // If pricing is per_lecture, ask teacher if this session should be paid
    let isPaidLecture = false;
    let lecturePrice = 0;

    if (classroom.pricing?.type === 'per_lecture') {
      const confirmPaid = window.confirm("Is this a paid lecture? Students will need to pay to join.");
      if (confirmPaid) {
        isPaidLecture = true;
        const price = window.prompt("Enter price for this lecture (NGN):", classroom.pricing.amount || 0);
        if (price === null) return; // cancelled
        lecturePrice = parseFloat(price);
      }
    }

    try {
      const response = await api.post(`/classrooms/${id}/call/start`, {
        isPaid: isPaidLecture,
        amount: lecturePrice
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
    return <Layout><div className="flex flex-col items-center justify-center min-h-[400px] gap-4"><div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" /><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Loading...</p></div></Layout>;
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
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-2xl shadow-xl p-6">
          {/* Header Row: Title, Tags, Edit Button */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between lg:justify-start gap-3 mb-2">
              <div className="flex items-center gap-3 min-w-0">
                  <h2 className="text-2xl md:text-3xl font-black italic text-foreground tracking-tight truncate pr-2 pb-1">{classroom.name}</h2>
                  
                  {/* Mobile-only Action Menu aligned with title */}
                  {canEdit && (
                    <div className="relative md:hidden group shrink-0">
                      <button className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-all active:scale-90">
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                      
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 py-3 z-[100] opacity-0 translate-y-2 pointer-events-none group-focus-within:opacity-100 group-focus-within:translate-y-0 group-focus-within:pointer-events-auto transition-all duration-300 transform origin-top-right">
                        <div className="px-5 py-2 mb-2">
                           <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Class Actions</p>
                        </div>

                        <button
                          onClick={handlePublishToggle}
                          disabled={publishing}
                          className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 text-slate-700 font-bold text-sm transition-colors text-left"
                        >
                          {classroom.published ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-emerald-500" />}
                          <span>{classroom.published ? 'Unpublish Class' : 'Publish Class'}</span>
                        </button>

                        {(canEdit || user?.role === 'teacher' || user?.role === 'personal_teacher') && (
                          <button
                            onClick={() => {
                              const shareLink = `${window.location.origin}/c/${classroom.shortCode || classroom._id}`;
                              navigator.clipboard.writeText(shareLink);
                              toast.success('Link copied!');
                            }}
                            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 text-slate-700 font-bold text-sm transition-colors text-left"
                          >
                            <Share2 className="w-4 h-4 text-indigo-500" />
                            <span>Share Class</span>
                          </button>
                        )}

                        <button
                          onClick={handleOpenEdit}
                          className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 text-slate-700 font-bold text-sm transition-colors text-left"
                        >
                          <Edit className="w-4 h-4 text-amber-500" />
                          <span>Edit Details</span>
                        </button>

                        <button
                          onClick={() => setShowEndClassModal(true)}
                          className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 text-slate-700 font-bold text-sm transition-colors text-left"
                        >
                          <Flag className="w-4 h-4 text-indigo-600" />
                          <span>End Class</span>
                        </button>

                        {(user?.role === 'root_admin' || isSchoolAdminOfClass || (user?.role === 'personal_teacher' && user?._id === classroom.teacherId?._id)) && (
                          <div className="mt-2 pt-2 border-t border-slate-50">
                            <button
                              onClick={handleDeleteClassroomClick}
                              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-rose-50 text-rose-500 font-black text-sm transition-colors text-left"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Delete Classroom</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {classroom.isPaid && classroom.pricing?.amount > 0 ? (
                  <div className="flex flex-col">
                    <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                      {formatAmount(classroom.pricing?.amount || 0, classroom.pricing?.currency || 'NGN')}
                    </span>
                    {classroom.pricing?.type && classroom.pricing.type !== 'free' && (
                      <span className="text-[9px] text-muted-foreground font-black uppercase mt-1 text-center tracking-widest">
                        {classroom.pricing.type.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20">
                    Free
                  </span>
                )}
              </div>
              {classroom.description && (
                <p className="text-muted-foreground text-sm md:text-base font-medium">{classroom.description}</p>
              )}
              {classroom.learningOutcomes && (
                <div className="mt-4 p-4 bg-primary/5 border border-primary/10 rounded-xl">
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">Expected Learning Outcomes</h4>
                  <p className="text-muted-foreground text-sm md:text-base whitespace-pre-wrap font-medium">{classroom.learningOutcomes}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-4 mt-2">
                {classroom.subject && (
                  <div className="flex items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <Book className="w-3.5 h-3.5 mr-2 text-primary" />
                    <span>Subject:</span> <span className="ml-1 text-foreground">{classroom.subject}</span>
                  </div>
                )}
                {classroom.level && (
                  <div className="flex items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <GraduationCap className="w-3.5 h-3.5 mr-2 text-primary" />
                    <span>Level:</span> <span className="ml-1 text-foreground">{classroom.level}</span>
                  </div>
                )}
              </div>
            </div>

            {canEdit && (
              <div className="flex items-center gap-2 mt-2 lg:mt-0">
                {/* Desktop Buttons: Refined Professional Palette */}
                <div className="hidden md:flex items-center gap-2.5">
                  <button
                    onClick={handlePublishToggle}
                    disabled={publishing}
                    className={`h-11 flex items-center gap-2.5 px-5 rounded-xl font-bold text-xs transition-all transform hover:-translate-y-0.5 active:scale-95 border ${
                      classroom.published
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100/80 shadow-sm shadow-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 dark:hover:bg-emerald-500/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-700 shadow-sm shadow-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 dark:shadow-none'
                    }`}
                  >
                    {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : classroom.published ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 opacity-50" />}
                    <span>{classroom.published ? 'Published' : 'Draft'}</span>
                  </button>

                  {(canEdit || user?.role === 'teacher' || user?.role === 'personal_teacher') && (
                    <button
                      onClick={() => {
                        const shareLink = `${window.location.origin}/c/${classroom.shortCode || classroom._id}`;
                        navigator.clipboard.writeText(shareLink);
                        toast.success('Link copied!');
                      }}
                      className="h-11 flex items-center gap-2.5 px-5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl font-bold text-xs hover:bg-indigo-600 hover:text-white transition-all transform hover:-translate-y-0.5 active:scale-95 shadow-sm shadow-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 dark:hover:bg-indigo-600 dark:hover:text-white group"
                    >
                      <Share2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                      <span>Share</span>
                    </button>
                  )}

                  <button
                    onClick={handleOpenEdit}
                    className="h-11 flex items-center gap-2.5 px-5 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all transform hover:-translate-y-0.5 active:scale-95 shadow-sm dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700"
                  >
                    <Edit className="w-3.5 h-3.5 text-slate-400" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => setShowEndClassModal(true)}
                    className="h-11 flex items-center gap-2.5 px-5 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all transform hover:-translate-y-0.5 active:scale-95 shadow-lg shadow-slate-900/10 dark:bg-slate-800 dark:hover:bg-slate-700 border dark:border-slate-700 hover:text-rose-500 hover:border-rose-500/30 dark:hover:text-rose-400"
                  >
                    <Flag className="w-3.5 h-3.5 text-slate-400" />
                    <span>End Class</span>
                  </button>

                  {(user?.role === 'root_admin' || isSchoolAdminOfClass || (user?.role === 'personal_teacher' && user?._id === classroom.teacherId?._id)) && (
                    <button
                      onClick={handleDeleteClassroomClick}
                      className="h-11 flex items-center justify-center w-11 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all transform hover:-translate-y-0.5 active:scale-95 border border-rose-100 hover:border-rose-500 shadow-sm dark:bg-rose-500/10 dark:border-rose-500/20 dark:hover:bg-rose-500 dark:hover:text-white"
                      title="Delete Classroom"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Edit Classroom Modal */}
          {showEditModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <div className="bg-card border border-border rounded-[3rem] w-full max-w-2xl p-10 shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300">
                  <div className="flex justify-between items-center mb-10">
                    <h2 className="text-3xl font-black italic tracking-tighter text-foreground uppercase">Edit <span className="text-primary not-italic">Classroom</span></h2>
                    <button onClick={() => setShowEditModal(false)} className="p-3 hover:bg-muted rounded-2xl transition text-muted-foreground/60"><X className="w-6 h-6" /></button>
                  </div>
                  <form onSubmit={handleEditClassroom} className="space-y-8 pb-4">
                    {/* Basic Info */}
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Class Title</label>
                        <input
                          value={editForm.name}
                          onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                          placeholder="e.g. Advanced Mathematics Masterclass"
                          className="w-full bg-muted/50 border-2 border-border p-4 rounded-2xl font-bold text-foreground focus:border-primary transition-all outline-none"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1 flex items-center">
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
                              backgroundColor: 'var(--bg-muted)', 
                              opacity: 0.5,
                              borderColor: 'var(--border-border)', 
                              borderWidth: '2px',
                              fontWeight: '700'
                            }),
                            singleValue: (base) => ({ ...base, color: 'var(--text-foreground)' }),
                            menuPortal: base => ({ ...base, zIndex: 9999, backgroundColor: 'var(--bg-card)' }) 
                          }}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1 flex items-center">
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
                              backgroundColor: 'var(--bg-muted)', 
                              opacity: 0.5,
                              borderColor: 'var(--border-border)', 
                              borderWidth: '2px',
                              fontWeight: '700'
                            }),
                            singleValue: (base) => ({ ...base, color: 'var(--text-foreground)' }),
                            menuPortal: base => ({ ...base, zIndex: 9999, backgroundColor: 'var(--bg-card)' }) 
                          }}
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Description</label>
                        <textarea
                          value={editForm.description}
                          onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                          placeholder="Tell students what this class is about..."
                          className="w-full min-h-[100px] bg-muted/50 border-2 border-border p-4 rounded-2xl font-medium text-foreground focus:border-primary transition-all outline-none italic"
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1 flex items-center">
                          Intro Video URL
                          <FormFieldHelp content="Paste a YouTube or Vimeo link to show a preview on the public page. (e.g. https://www.youtube.com/watch?v=...)" />
                        </label>
                        <input
                          type="url"
                          value={editForm.introVideo}
                          onChange={e => setEditForm({ ...editForm, introVideo: e.target.value })}
                          placeholder="https://www.youtube.com/watch?v=..."
                          className="w-full bg-muted/50 border-2 border-border p-4 rounded-2xl font-bold text-foreground focus:border-primary transition-all outline-none"
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Learning Outcomes</label>
                        <textarea
                          value={editForm.learningOutcomes}
                          onChange={e => setEditForm({ ...editForm, learningOutcomes: e.target.value })}
                          placeholder="List what students will achieve (comma separated)..."
                          className="w-full min-h-[80px] bg-muted/50 border-2 border-border p-4 rounded-2xl font-medium text-foreground focus:border-primary transition-all outline-none italic"
                        />
                      </div>
                    </div>

                    {/* Roles & Visibility */}
                    <div className="grid md:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-[2rem] border border-border">
                      {(user?.role === 'root_admin' || user?.role === 'school_admin') && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Assign Teacher</label>
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
                          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Assign to Schools</label>
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
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Enrollment Limit</span>
                            <FormFieldHelp content="The maximum number of students allowed to enroll in this class." />
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              value={editForm.capacity}
                              onChange={e => setEditForm({ ...editForm, capacity: parseInt(e.target.value) || 30 })}
                              onWheel={(e) => e.target.blur()}
                              className="w-full pl-4 pr-4 py-3 bg-muted/50 border-2 border-border rounded-2xl focus:border-primary focus:bg-muted transition-all outline-none font-bold text-foreground"
                              min="1"
                              placeholder="30"
                            />
                          </div>
                        </div>

                        {/* Private Toggle */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Visibility</span>
                            <FormFieldHelp content="Private classes are not visible to the public. You must share direct links with students." />
                          </div>
                          <label 
                            onClick={() => setEditForm({ ...editForm, isPrivate: !editForm.isPrivate })}
                            className={`flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all cursor-pointer group min-h-[64px] ${editForm.isPrivate ? 'border-primary bg-primary/10' : 'border-border bg-muted/50 hover:border-border/80'}`}
                          >
                            <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${editForm.isPrivate ? 'text-primary' : 'text-muted-foreground'}`}>Private Class</span>
                            <div className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${editForm.isPrivate ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${editForm.isPrivate ? 'translate-x-4' : ''}`} />
                            </div>
                          </label>
                        </div>

                        {/* Paid Toggle */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Monetization</span>
                            <FormFieldHelp content="When enabled, you can set a price and billing cycle for this classroom." />
                          </div>
                          <label 
                            onClick={() => setEditForm({ ...editForm, isPaid: !editForm.isPaid })}
                            className={`flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all cursor-pointer group min-h-[64px] ${editForm.isPaid ? 'border-primary bg-primary/10' : 'border-border bg-muted/50 hover:border-border/80'}`}
                          >
                            <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${editForm.isPaid ? 'text-primary' : 'text-muted-foreground'}`}>Paid Class</span>
                            <div className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${editForm.isPaid ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${editForm.isPaid ? 'translate-x-4' : ''}`} />
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Pricing details if paid */}
                    {editForm.isPaid && (
                      <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 animate-slide-up">
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-primary tracking-widest px-1 flex items-center">
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
                            <label className="text-[10px] font-black uppercase text-primary tracking-widest px-1 flex items-center">
                              Amount ({import.meta.env.VITE_CURRENCY || 'NGN'})
                              <FormFieldHelp content="The price students will pay based on the selected billing cycle." />
                            </label>
                            <input
                              type="number"
                              value={editForm.pricingAmount}
                              onChange={e => setEditForm({ ...editForm, pricingAmount: parseFloat(e.target.value) || 0 })}
                              onWheel={(e) => e.target.blur()}
                              className="w-full h-[60px] bg-muted/50 border-2 border-border rounded-2xl focus:border-primary focus:bg-muted transition-all outline-none px-4 font-bold text-foreground"
                              placeholder="0.00"
                              required={editForm.isPaid}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Schedule Builder */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Weekly Schedule</label>
                        <button
                          type="button"
                          onClick={() => setEditForm({ ...editForm, schedule: [...editForm.schedule, { dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00' }] })}
                          className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Session
                        </button>
                      </div>

                      <div className="space-y-3">
                        {editForm.schedule.map((s, idx) => (
                          <div key={idx} className="flex flex-wrap md:flex-nowrap items-center gap-3 p-4 bg-muted/30 rounded-[1.5rem] border border-border animate-slide-up">
                            <select
                              value={s.dayOfWeek}
                              onChange={e => {
                                const newSched = [...editForm.schedule];
                                newSched[idx].dayOfWeek = e.target.value;
                                setEditForm({ ...editForm, schedule: newSched });
                              }}
                              className="flex-1 min-w-[120px] bg-muted/50 border-none rounded-xl text-xs font-black uppercase tracking-widest p-3 text-foreground outline-none"
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
                              className="w-32 bg-muted/50 border-none rounded-xl text-xs font-black p-3 text-foreground outline-none"
                            />
                            <span className="text-muted-foreground/60 font-black italic text-[10px] uppercase">to</span>
                            <input
                              type="time"
                              value={s.endTime}
                              onChange={e => {
                                const newSched = [...editForm.schedule];
                                newSched[idx].endTime = e.target.value;
                                setEditForm({ ...editForm, schedule: newSched });
                              }}
                              className="w-32 bg-muted/50 border-none rounded-xl text-xs font-black p-3 text-foreground outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newSched = editForm.schedule.filter((_, i) => i !== idx);
                                setEditForm({ ...editForm, schedule: newSched });
                              }}
                              className="p-3 text-rose-500 hover:bg-rose-500/10 rounded-xl transition"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        ))}
                        {editForm.schedule.length === 0 && (
                          <p className="text-[10px] text-muted-foreground/60 font-black uppercase tracking-widest text-center py-4">No sessions scheduled yet.</p>
                        )}
                      </div>
                    </div>

                    <div className="pt-8 flex gap-4 sticky bottom-0 bg-card pb-2 border-t border-border mt-8">
                      <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 px-6 py-3 rounded-2xl border border-border font-black text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-muted transition">Discard</button>
                      <button type="submit" disabled={isEditing} className="btn-premium flex-1">
                        {isEditing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-4 border-y border-border/50 mb-6 font-bold">
            <div className="flex items-center space-x-3 text-muted-foreground">
              <User className="w-5 h-5 text-primary shrink-0" />
              <div className="text-[10px] uppercase tracking-widest">
                <span className="block text-foreground/50 mb-0.5">Teacher</span>
                <span className="text-foreground">{classroom.teacherId?.name || 'Unknown Teacher'}</span>
              </div>
            </div>
            <div className="flex items-center space-x-3 text-muted-foreground">
              <School className="w-5 h-5 text-primary shrink-0" />
              <div className="text-[10px] uppercase tracking-widest">
                <span className="block text-foreground/50 mb-0.5">Academic Host</span>
                <span className="truncate max-w-[200px] block text-foreground" title={(Array.isArray(classroom.schoolId) ? classroom.schoolId.map(s => s?.name || s).join(', ') : classroom.schoolId?.name) || classroom.teacherId?.tutorialId?.name || 'Tutorial'}>
                  {(Array.isArray(classroom.schoolId) ? (classroom.schoolId[0]?.name || classroom.schoolId[0]) : classroom.schoolId?.name) || classroom.teacherId?.tutorialId?.name || 'Tutorial'}
                  {Array.isArray(classroom.schoolId) && classroom.schoolId.length > 1 && ` +${classroom.schoolId.length - 1}`}
                </span>
              </div>
            </div>
            <div className="flex items-start space-x-3 text-muted-foreground">
              <Calendar className="w-5 h-5 mt-0.5 text-primary shrink-0" />
              <div className="text-[10px] uppercase tracking-widest">
                {classroom.schedule && classroom.schedule.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {classroom.schedule.map((session, index) => {
                      const local = convertUTCToLocal(session.dayOfWeek, session.startTime);
                      const localEnd = convertUTCToLocal(session.dayOfWeek, session.endTime);
                      return (
                        <span key={index} className="bg-muted px-2 py-0.5 rounded text-[9px] border border-border">
                          {local.dayOfWeek ? local.dayOfWeek.substring(0, 3) : 'N/A'} {local.hhmm}-{localEnd.hhmm}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-muted-foreground/30">No schedule set</span>
                )}
              </div>
            </div>
          </div>

          {showIntroVideo && embedUrl && (
            <div className="bg-slate-900 rounded-[2.5rem] p-2 shadow-xl border border-white/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 mb-8">
              <div className="relative aspect-video rounded-[2rem] overflow-hidden bg-black">
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
                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
                      <Video className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">Course Preview</p>
                      <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Watch before you join</p>
                    </div>
                </div>
                <button 
                  onClick={() => {
                    if (classroom.isPaid) setShowEnrollmentPaymentModal(true);
                    else handleEnroll();
                  }}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition"
                >
                  Join Now
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!isEnrolled && user?.role === 'student' && classroom.published && (
              <button
                onClick={handleEnroll}
                className="btn-premium"
              >
                {classroom.isPaid && classroom.pricing?.amount > 0 ? `Enroll - ${formatAmount(classroom.pricing?.amount || 0, classroom.pricing?.currency || 'NGN')}` : 'Enroll (Free)'}
              </button>
            )}
            {!isEnrolled && user?.role === 'student' && !classroom.published && (
              <span className="px-6 py-2 bg-gray-300 text-gray-600 rounded-lg font-semibold">
                Not Available for Enrollment
              </span>
            )}
            {isEnrolled && user?.role === 'student' && (
              <button
                onClick={() => setShowLeaveClassModal(true)}
                className="btn-danger"
              >
                Leave Class
              </button>
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
                        className="btn-premium flex-1 sm:flex-none shadow-indigo-200"
                      >
                        <Video className="w-5 h-5" />
                        <span>{label}</span>
                      </button>
                    );
                  }

                  // Not a starter: fall back to attend button for enrolled students
                  if (isEnrolled) {
                    return (
                      <button
                        onClick={handleJoinCall}
                        className="btn-premium flex-1 sm:flex-none shadow-indigo-200"
                      >
                        <Video className="w-5 h-5" />
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
                        className={`flex-1 sm:flex-none ${enabled ? 'btn-success' : 'btn-secondary opacity-50 cursor-not-allowed'}`}
                      >
                        <Edit className="w-5 h-5" />
                        <span>Whiteboard</span>
                      </button>
                    );
                  })()
                }
              </>
            )}
          </div>
        </div>

        {weeklyPaymentRequired && user?.role === 'student' && (
          <div className="mt-8 p-10 bg-indigo-50 border-2 border-indigo-100 rounded-[2.5rem] text-center animate-in fade-in zoom-in slide-in-from-bottom-4 duration-500">
            <div className="w-20 h-20 bg-indigo-600/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <CreditCard className="w-10 h-10 text-indigo-600" />
            </div>
            <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Weekly Subscription Expired</h3>
            <p className="text-slate-600 mb-8 max-w-md mx-auto font-medium">
              This classroom requires a sustaining fee of <span className="text-indigo-600 font-bold">{formatAmount(classroom?.pricing?.amount || 0)}</span> every 7 days. Please pay to continue accessing your course materials.
            </p>
            <button
              onClick={handleEnrollmentPayment}
              disabled={isProcessingPayment}
              className="btn-premium px-12 py-4 rounded-2xl shadow-xl shadow-indigo-200"
            >
              {isProcessingPayment ? <Loader2 className="w-6 h-6 animate-spin" /> : `Pay Weekly Fee - ${formatAmount(classroom?.pricing?.amount || 0)}`}
            </button>
          </div>
        )}

        {!weeklyPaymentRequired && (
          <>
            {/* Tab Navigation */}
            <div className="flex border-b border-border bg-card rounded-t-2xl overflow-x-auto mt-6 no-scrollbar">
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
                  className={`flex items-center space-x-2 px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-all ${activeTab === tab.id
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.id === 'exams' && exams.length > 0 && (
                    <span className="ml-2 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold">{exams.length}</span>
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
                    <div className="bg-card border border-border border-t-0 rounded-b-2xl shadow-lg p-6">
                      <div className="flex justify-between items-center mb-6">
                        <div>
                          <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary mb-1">Topics</h3>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            {classroom.topics?.length || 0} MODULE{classroom.topics?.length !== 1 ? 'S' : ''} IN SYLLABUS
                          </p>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => navigate(`/classrooms/${id}/manage-topics`)}
                            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition shadow-md"
                          >
                            <Book className="w-4 h-4" />
                            <span>Manage Topics</span>
                          </button>
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
                <div className="bg-card border border-border border-t-0 rounded-b-2xl shadow-lg p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary">Assignments</h3>
                    {canCreateAssignment && (
                      <button
                        onClick={() => setShowCreateAssignmentModal(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
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
                          <div key={assignment._id} className="bg-card border border-border rounded-2xl shadow-lg overflow-hidden group">
                            <div
                              className="flex flex-col md:flex-row justify-between items-start p-6 cursor-pointer hover:bg-muted/50 transition border-b border-transparent hover:border-border"
                              onClick={toggleAssignmentExpanded}
                            >
                              <div className="flex items-start space-x-3 flex-1 mb-4 md:mb-0">
                                {isAssignmentExpanded ? (
                                  <ChevronUp className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-muted-foreground mt-1 flex-shrink-0" />
                                )}
                                <div className="flex-1">
                                  <h4 className="font-black text-foreground italic tracking-tight">
                                    {assignment.title}
                                    {assignment.topicId?.name && (
                                      <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-primary/60">
                                        [{assignment.topicId.name}]
                                      </span>
                                    )}
                                  </h4>
                                  {!isAssignmentExpanded && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1 font-medium">{assignment.description}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 items-center md:justify-end flex-shrink-0 w-full md:w-auto ml-8 md:ml-0 font-black">
                                {assignment.dueDate ? (
                                  <span className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-[10px] uppercase tracking-widest border border-border">
                                    DUE: {formatDisplayDate(assignment.dueDate)}
                                  </span>
                                ) : (
                                  <span className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-[10px] uppercase tracking-widest border border-border">
                                    OPEN ENDED
                                  </span>
                                )}
                                
                                {isGraded && (assignment.assignmentType === 'theory' || (assignment.assignmentType === 'mcq' && (!assignment.publishResultsAt || new Date() >= new Date(assignment.publishResultsAt)))) && (
                                  <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest border border-emerald-500/20">
                                    GRADED
                                  </span>
                                )}
                                {isSubmitted && !isGraded && (
                                  <span className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest border border-amber-500/20">
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
                                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
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
                                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
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
                                        className={`px-4 py-2 rounded-lg transition ${isPastDue
                                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                          : 'bg-blue-600 text-white hover:bg-blue-700'
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
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Submissions ({assignment.submissions?.length || 0})</h4>
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
                                          <div key={sub._id} className="border border-border rounded-xl mb-2 bg-muted/30 overflow-hidden">
                                            <div
                                              className="flex justify-between items-center p-3 cursor-pointer hover:bg-muted/50 transition"
                                              onClick={toggleExpanded}
                                            >
                                              <div className="flex items-center space-x-2 flex-1">
                                                {isExpanded ? (
                                                  <ChevronUp className="w-4 h-4 text-primary" />
                                                ) : (
                                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                                )}
                                                <div className="flex-1">
                                                  <p className="text-xs font-black uppercase tracking-widest text-foreground">{sub.studentId?.name || 'Unknown Student'}</p>
                                                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Status: <span className="text-primary">{sub.status}</span></p>
                                                  {sub.status === 'graded' && (
                                                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Score: {sub.score}/{assignment.maxScore}</p>
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
                                                  className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition text-[10px] font-black uppercase tracking-widest"
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
                                                  className="px-4 py-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition text-[10px] font-black uppercase tracking-widest"
                                                >
                                                  Edit Grade
                                                </button>
                                              )}
                                            </div>
                                            {isExpanded && (
                                              <div className="px-3 pb-3 pt-3 border-t border-border bg-card">
                                                {/* Display answers based on type */}
                                                {assignment.assignmentType === 'theory' && sub.answers && (
                                                  <div className="p-3 bg-muted/50 rounded-xl border border-border/50">
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">Student Response:</p>
                                                    <p className="text-sm text-foreground whitespace-pre-wrap font-medium">{Array.isArray(sub.answers) ? sub.answers.join('\n') : sub.answers}</p>
                                                  </div>
                                                )}
                                                {assignment.assignmentType === 'mcq' && sub.answers && Array.isArray(sub.answers) && (
                                                  <div className="p-3 bg-muted/50 rounded-xl border border-border/50">
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">Selected Options:</p>
                                                    <ul className="space-y-1">
                                                      {sub.answers.map((ans, ansIdx) => (
                                                        <li key={ansIdx} className="text-xs font-bold flex items-center gap-2">
                                                          <span className="text-muted-foreground">Q{ansIdx+1}:</span>
                                                          <span className="text-foreground">{ans}</span>
                                                          {assignment.questions[ansIdx]?.correctOption && (
                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest ${ans === assignment.questions[ansIdx].correctOption ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
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
                                      <p className="text-muted-foreground text-center py-4 font-bold text-[10px] uppercase tracking-widest">No intellectual payloads delivered yet.</p>
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
            <div className="bg-card border border-border border-t-0 rounded-b-2xl shadow-lg p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary mb-1">Class Examinations</h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Access scheduled assessments and final exams.</p>
                </div>
                {canEdit && (
                  <button
                    onClick={() => navigate(`/exams/create?classId=${id}`)}
                    className="flex items-center justify-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 font-bold"
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
                      <div key={exam._id} className="group bg-muted/30 hover:bg-muted/50 rounded-2xl p-6 border border-border hover:border-primary/30 hover:shadow-2xl transition-all duration-300">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex items-start space-x-4">
                            <div className={`p-4 rounded-xl shadow-lg ${isPastDue ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                              <GraduationCap className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="text-lg font-black italic text-foreground leading-tight mb-1 group-hover:text-primary transition-colors tracking-tight">{exam.title}</h4>
                              <p className="text-xs text-muted-foreground font-medium line-clamp-1 italic">{exam.description || 'No detailed briefing provided.'}</p>

                              <div className="flex flex-wrap gap-4 mt-3">
                                <div className="flex items-center text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                                  <Clock className="w-3.5 h-3.5 mr-1.5 text-primary" />
                                  {exam.duration} Minutes
                                </div>
                                {exam.dueDate && (
                                  <div className={`flex items-center text-[9px] font-black uppercase tracking-[0.2em] ${isPastDue ? 'text-rose-500' : 'text-muted-foreground'}`}>
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
                                  className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl text-sm font-bold hover:bg-gray-50 transition"
                                >
                                  Submissions
                                </button>
                                <button
                                  onClick={() => navigate(`/exams/edit/${exam._id}`)}
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
                                className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${isPastDue || !exam.isPublished
                                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'
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
                  <div className="text-center py-16 bg-muted/10 rounded-[2rem] border-2 border-dashed border-border/50">
                    <GraduationCap className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                    <h5 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">No Exams Scheduled</h5>
                    <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">There are currently no examinations assigned to this class.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'students' && canViewStudents && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-card border border-border border-t-0 rounded-b-2xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                   <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary mb-1">Enrolled Students</h3>
                   <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{classroom.students?.length || 0} / {classroom.capacity} SEATS FILLED</p>
                </div>
                {canManageStudents && (
                  <button
                    onClick={() => {
                      setSelectedStudentId('');
                      fetchAvailableStudents();
                      setShowAddStudentModal(true);
                    }}
                    className="flex items-center space-x-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-2xl hover:opacity-90 transition font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span className="hidden md:inline">Add Student</span>
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {classroom.students && classroom.students.length > 0 ? (
                  classroom.students.map((student) => (
                    <div key={student._id || student} className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-2xl hover:bg-muted/40 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-xs uppercase">
                          {typeof student === 'object' ? student.name?.charAt(0) : '?'}
                        </div>
                        <div>
                          <p className="text-sm font-black text-foreground italic uppercase tracking-tight">{typeof student === 'object' ? student.name : 'Securing Data...'}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{typeof student === 'object' ? student.email : ''}</p>
                        </div>
                      </div>
                      {canManageStudents && (
                        <button
                          onClick={() => handleRemoveStudent(student._id || student)}
                          className="w-10 h-10 flex items-center justify-center bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                          title="Revoke Access"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 bg-muted/10 rounded-3xl border-2 border-dashed border-border/50">
                    <Users className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">No students found in this class.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {user?.role === 'root_admin' && classroom?.schoolId && (
          <div className="bg-card border border-border rounded-2xl shadow-xl p-6 mt-6">
            {/* Teacher Management (Root Admin only - Always visible regardless of tab) */}
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary mb-4">Administrative Console</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/20 border border-border rounded-2xl font-bold">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">COMMANDING TEACHER</p>
                    <p className="text-sm text-foreground italic">{classroom.teacherId?.name} ({classroom.teacherId?.email})</p>
                  </div>
                  {classroom.schoolId?.adminId && (
                    <div className="p-4 bg-muted/20 border border-border rounded-2xl font-bold">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">SCHOOL ADJUTANT</p>
                      <p className="text-sm text-foreground italic">{classroom.schoolId.adminId.name} ({classroom.schoolId.adminId.email})</p>
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
                  className="px-6 py-2.5 bg-primary text-primary-foreground rounded-2xl hover:opacity-90 transition font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 shrink-0 self-start"
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
              }}
              onSubmitSuccess={handleCreateAssignment} // Pass the success callback
              classroomId={id} // Pass the current classroom ID
              availableTopics={availableTopicsForAssignment}
              editAssignment={assignmentToEdit}
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

        {/* Add Student Modal */}
        {showAddStudentModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="bg-card border border-border rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-black italic tracking-tight text-foreground uppercase">Deploy Candidates</h3>
                  <button onClick={() => setShowAddStudentModal(false)} className="p-2 hover:bg-muted rounded-xl transition text-muted-foreground"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleAddStudent} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] px-1">Select Candidate Profile</label>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="w-full bg-muted/50 border-2 border-border p-4 rounded-2xl font-bold text-foreground outline-none focus:border-primary transition-all appearance-none"
                    >
                      <option value="" disabled className="bg-card">Awaiting Selection...</option>
                      {availableStudents.map(student => (
                        <option key={student._id} value={student._id} className="bg-card">{student.name} ({student.email})</option>
                      ))}
                    </select>
                    {availableStudents.length === 0 && (
                      <div className="mt-4 p-4 bg-muted/20 rounded-2xl border border-dashed border-border text-center">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No unassigned candidates found.</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowAddStudentModal(false)}
                      className="flex-1 px-6 py-3 rounded-2xl border border-border font-black text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-muted transition"
                    >
                      ABORT
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
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <div className="bg-card border border-border rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-black italic tracking-tight text-foreground uppercase">Assign Command</h3>
                    <button onClick={() => setShowChangeTeacherModal(false)} className="p-2 hover:bg-muted rounded-xl transition text-muted-foreground">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] px-1">Select New Commander</label>
                      <select
                        value={selectedTeacherId}
                        onChange={(e) => setSelectedTeacherId(e.target.value)}
                        className="w-full bg-muted/50 border-2 border-border p-4 rounded-2xl font-bold text-foreground outline-none focus:border-primary transition-all appearance-none"
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
                        className="flex-1 px-6 py-3 rounded-2xl border border-border font-black text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-muted transition"
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
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="bg-card border border-border rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8 pb-0 flex justify-between items-center">
                  <div className="bg-primary/10 p-3 rounded-2xl border border-primary/20">
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
                  <h3 className="text-xl font-black italic tracking-tight text-foreground uppercase mb-2">Initialize Enrollment</h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-8 px-4 leading-relaxed">System authorization required to grant access to <span className="text-primary font-black italic">"{classroom.name}"</span>.</p>

                  <div className="bg-muted/50 rounded-[2.5rem] p-8 mb-8 border border-border shadow-inner">
                    <div className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">ACCESS FEE</div>
                    <div className="text-4xl font-black italic text-foreground tracking-tight">
                      {formatAmount(classroom.pricing?.amount || 0, classroom.pricing?.currency || 'NGN')}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => setShowEnrollmentPaymentModal(false)}
                      disabled={isProcessingPayment}
                      className="flex-1 px-6 py-3 rounded-2xl border border-border font-black text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-muted transition"
                    >
                      ABORT
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
          confirmButtonColor="bg-indigo-600 hover:bg-indigo-700"
          icon={Flag}
          iconBg="bg-indigo-100"
          iconColor="text-indigo-600"
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
      </div >
    </Layout >
  );
};

export default ClassroomDetail;
