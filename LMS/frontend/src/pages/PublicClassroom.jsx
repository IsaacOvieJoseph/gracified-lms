import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  Users, Calendar, Clock, BookOpen, ChevronRight, 
  CheckCircle2, Info, GraduationCap, MapPin, Globe,
  ShieldCheck, ArrowRight, Share2, Star, Building2,
  X, Loader2, ExternalLink, Copy, Radio, Video, Lock, Mail, User,
  QrCode, Link2, Facebook, Twitter, MessageCircle
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

// Set base URL for axios if not already handled by a global config
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const PublicClassroom = () => {
  const { shortCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [publicAccessInfo, setPublicAccessInfo] = useState({
    guestEnabled: false,
    hasActiveLive: false,
    hasRecording: false,
    activeStartedAt: null
  });

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [guestForm, setGuestForm] = useState({ name: '', email: '' });
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [accessResult, setAccessResult] = useState(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const searchParams = new URLSearchParams(location.search);
  const referenceParam = searchParams.get('reference') || searchParams.get('trxref') || searchParams.get('ref');

  useEffect(() => {
    const fetchClassroom = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_URL}/classrooms/public/${shortCode}`);
        const found = response.data.classroom;
        setPublicAccessInfo(response.data.publicAccess || {
          guestEnabled: false,
          hasActiveLive: false,
          hasRecording: false,
          activeStartedAt: null
        });

        // Auto-redirect if user already has access
        if (user && found) {
          const isEnrolled = (user.enrolledClasses || []).some(id => id === found._id || id._id === found._id);
          const isTeacher = user._id === found.teacherId?._id || user._id === found.teacherId;
          const isAdmin = ['root_admin', 'school_admin'].includes(user.role); // Admins can usually view too

          if (isEnrolled || isTeacher || isAdmin) {
             navigate(`/classrooms/${found._id}`);
             return;
          }
        }

        setClassroom(found);
        setError(null);

        // Guest Paystack payment callback: verify and grant access
        if (referenceParam) {
          setShowJoinModal(true);
          setVerifyingPayment(true);
          setJoinError(null);
          try {
            const verifyRes = await axios.get(`${API_URL}/classrooms/public/${shortCode}/paystack/verify?reference=${encodeURIComponent(referenceParam)}`);
            const data = verifyRes.data;
            setAccessResult({
              joinUrl: data.joinUrl,
              accessType: data.accessType,
              instructions: found.publicAccess?.joinInstructions || '',
              message: data.message
            });
          } catch (err) {
            console.error('Error verifying guest payment:', err);
            setJoinError(err.response?.data?.message || 'Payment verification failed. Please try again.');
          } finally {
            setVerifyingPayment(false);
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
      } catch (err) {
        console.error('Error fetching public classroom:', err);
        setError(err.response?.data?.message || 'Classroom not found');
      } finally {
        setLoading(false);
      }
    };

    fetchClassroom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortCode, location.search]);

  const handleEnrollClick = () => {
    if (user) {
      // If already logged in, just go to the class detail page. 
      // The detail page logic will handle enrollment for free classes 
      // or show the payment prompt for paid ones.
      navigate(`/classrooms/${classroom._id}`);
      return;
    }
    if (publicAccessInfo.guestEnabled) {
      // Guest can join without an account
      setShowJoinModal(true);
      setJoinError(null);
      setAccessResult(null);
      setGuestForm({ name: '', email: '' });
      return;
    }
    // Redirect to login with a fallback to return to the PRIVATE classroom view after auth
    navigate(`/login?redirect=/classrooms/${classroom._id}`);
  };

  const handleGuestJoin = async (e) => {
    e.preventDefault();
    const name = guestForm.name.trim();
    const email = guestForm.email.trim();
    if (!name || !email) {
      setJoinError('Please provide your name and email to join.');
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      const isPaid = classroom.isPaid && Number(classroom.pricing?.amount || 0) > 0;
      if (isPaid) {
        const initRes = await axios.post(`${API_URL}/classrooms/public/${shortCode}/paystack/initiate`, {
          name,
          email,
          returnUrl: window.location.href
        });
        if (initRes.data?.authorization_url) {
          window.location.href = initRes.data.authorization_url;
        } else {
          setJoinError('Could not start payment. Please try again.');
        }
        return;
      }

      const joinRes = await axios.post(`${API_URL}/classrooms/public/${shortCode}/join`, { name, email });
      setAccessResult({
        joinUrl: joinRes.data.joinUrl,
        accessType: joinRes.data.accessType,
        instructions: joinRes.data.instructions || '',
        message: joinRes.data.message
      });
    } catch (err) {
      console.error('Guest join error:', err);
      setJoinError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const handleLaunchSession = () => {
    if (!accessResult?.joinUrl) return;
    window.open(accessResult.joinUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = () => {
    if (!accessResult?.joinUrl) return;
    navigator.clipboard.writeText(accessResult.joinUrl);
    toast.success('Join link copied to clipboard!');
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleCopyPublicLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Public link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the link');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="bg-card p-8 rounded-[2.5rem] shadow-xl max-w-md w-full text-center border border-border">
          <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Info className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-foreground mb-2">Oops!</h2>
          <p className="text-muted-foreground mb-8 font-medium leading-relaxed">{error}</p>
          <button 
            onClick={() => navigate('/')}
            className="w-full py-4 btn-premium rounded-2xl font-bold flex items-center justify-center gap-2 group shadow-lg"
          >
            <span>Back to Home</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    );
  }

  const teacher = classroom.teacherId;
  const school = classroom.schoolId?.[0]; // Assuming at least one school association

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

  const shareUrl = `${window.location.origin}/c/${classroom.slug || classroom.shortCode || shortCode}`;
  const shareText = `Join "${classroom.name}" on Gracified LMS!`;

  return (
    <div className="min-h-screen bg-background text-foreground font-inter selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden">
       {/* Global Navigation */}
       <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                   <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-black text-foreground tracking-tighter italic">Gracified<span className="text-primary">LMS</span></span>
             </div>
             <div className="flex items-center gap-4">
                <ThemeToggle />
                <button 
                  onClick={handleShare}
                  className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-muted text-muted-foreground rounded-xl font-black text-[10px] hover:bg-muted/80 transition-all uppercase tracking-widest border border-border"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>
                <button 
                  onClick={handleEnrollClick}
                  className="px-6 py-2.5 bg-primary text-white rounded-xl font-black text-[10px] hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 uppercase tracking-widest"
                >
                  {user ? 'Enroll Now' : publicAccessInfo.guestEnabled ? 'Join Now' : 'Enroll Now'}
                </button>
             </div>
          </div>
       </nav>
      {/* Dynamic Header / Hero Area */}
      <div className="relative overflow-hidden bg-slate-900 text-white pt-24 pb-32">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500 via-transparent to-transparent blur-3xl scale-150"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="flex flex-wrap items-center gap-4 mb-8">
            <span className="px-4 py-1.5 rounded-full bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20">
              Featured Class
            </span>
            {publicAccessInfo.hasActiveLive && (
              <span className="px-4 py-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/20 flex items-center gap-2 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white" />
                Live Now
              </span>
            )}
            {!publicAccessInfo.hasActiveLive && publicAccessInfo.hasRecording && (
              <span className="px-4 py-1.5 rounded-full bg-sky-500 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-sky-500/20 flex items-center gap-2">
                <Video className="w-3 h-3" />
                Recording Available
              </span>
            )}
            {school && (
                <Link 
                  to={`/s/${school.shortCode || school._id}`}
                  className="px-4 py-1.5 rounded-full bg-white/10 text-white/90 text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-md hover:bg-white/20 transition-all flex items-center gap-2 border border-white/10"
                >
                   <Building2 className="w-3 h-3" />
                   <span>{school.name} Portal</span>
                </Link>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.9] animate-slide-up text-white">
                {classroom.name}
              </h1>
              <p className="text-xl text-slate-400 font-medium leading-relaxed max-w-xl animate-slide-up animation-delay-100">
                {classroom.description || "Unlock your potential with expert-led training and comprehensive learning resources tailored for your success."}
              </p>
              
              <div className="flex flex-wrap gap-6 pt-4 animate-slide-up animation-delay-200">
                <div className="flex items-center gap-3 bg-white/5 p-4 rounded-3xl border border-white/10 backdrop-blur-md">
                   <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
                     <Users className="w-5 h-5 text-indigo-400" />
                   </div>
                   <div>
                     <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Students</p>
                     <p className="text-lg font-black">{classroom.students?.length || 0} enrolled</p>
                   </div>
                </div>
                <div className="flex items-center gap-3 bg-white/5 p-4 rounded-3xl border border-white/10 backdrop-blur-md">
                   <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                     <Clock className="w-5 h-5 text-amber-400" />
                   </div>
                   <div>
                     <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Type</p>
                      <p className="text-lg font-black uppercase tracking-tight">{classroom.pricing?.type?.replace('_', ' ') || 'Class'}</p>
                   </div>
                </div>
              </div>
            </div>

            <div className="lg:block animate-fade-in relative">
               <div className="absolute -inset-4 bg-primary/20 blur-3xl rounded-[3rem]"></div>
               <div className="relative bg-card text-foreground rounded-[2.5rem] shadow-2xl p-10 border border-border">
                  <div className="flex items-center justify-between mb-8">
                    <div className="p-3 bg-primary/10 rounded-2xl">
                       <ShieldCheck className="w-6 h-6 text-primary" />
                    </div>
                    <button 
                      onClick={handleShare}
                      className="p-3 bg-muted text-muted-foreground rounded-2xl hover:bg-muted/80 hover:text-foreground transition-all border border-border"
                    >
                       <Share2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-baseline gap-2">
                       <span className="text-4xl font-black text-foreground italic">
                         {classroom.isPaid ? `₦${classroom.pricing?.amount?.toLocaleString() || 0}` : "Free"}
                       </span>
                       {classroom.isPaid && <span className="text-muted-foreground font-black uppercase text-[10px] tracking-widest opacity-60 italic">Access Fee</span>}
                    </div>

                    <div className="space-y-4">
                      {[
                        `Full access to all lectures`,
                        `Interactive Q&A sessions`,
                        `Downloadable course materials`,
                        `Mobile & Tablet friendly`,
                        `Certificate of completion`
                      ].map((feature, i) => (
                        <div key={i} className="flex items-center gap-3 group">
                           <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                             <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                           </div>
                           <span className="text-muted-foreground text-sm font-black uppercase tracking-wide group-hover:text-foreground transition-colors">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-6">
                      <button 
                        onClick={handleEnrollClick}
                        className="w-full py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-primary/90 transition-all transform hover:-translate-y-1 shadow-xl shadow-primary/20 active:scale-95 flex items-center justify-center gap-3 group"
                      >
                         <span>{user ? 'Join Module Now' : publicAccessInfo.guestEnabled ? 'Join Now as Guest' : 'Join Module Now'}</span>
                         <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                      <p className="text-center text-muted-foreground text-[9px] font-black uppercase tracking-[0.2em] mt-6 bg-muted/40 py-3 rounded-xl border border-border italic">
                         Secure Checkout powered by Paystack
                      </p>
                      {publicAccessInfo.guestEnabled && !user && (
                        <p className="mt-2 text-center text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 italic">
                           No account required — join as a guest
                        </p>
                      )}
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Intro Video Section */}
      {embedUrl && (
        <div className="max-w-5xl mx-auto px-6 -mt-16 relative z-10">
          <div className="bg-slate-900 rounded-[3rem] p-2 shadow-2xl shadow-indigo-500/20 border border-white/5 overflow-hidden group">
            <div className="relative aspect-video rounded-[2.5rem] overflow-hidden bg-black">
              <iframe
                src={embedUrl}
                title="Course Preview"
                className="absolute inset-0 w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>
      )}

      {/* Course Content Section */}
      <div className="max-w-7xl mx-auto px-6 py-32">
         <div className="grid lg:grid-cols-3 gap-16">
            <div className="lg:col-span-2 space-y-20">
               {/* About Section */}
                <section className="space-y-8">
                   <div className="flex items-center gap-4">
                      <div className="w-1.5 h-8 bg-primary rounded-full"></div>
                      <h2 className="text-3xl font-black text-foreground tracking-tight uppercase italic">Module Overview</h2>
                   </div>
                  <div className="text-lg text-muted-foreground leading-relaxed font-bold space-y-4">
                    <p>{classroom.description || "Explore this comprehensive course designed to equip you with real-world skills and expert knowledge."}</p>
                    {classroom.learningOutcomes && (
                        <div className="mt-8 p-10 bg-muted/30 rounded-[2.5rem] border border-border space-y-4 italic shadow-inner">
                            <h4 className="font-black text-foreground uppercase tracking-[0.2em] text-[10px]">What you will learn</h4>
                            <p className="text-muted-foreground/80 whitespace-pre-line text-base">{classroom.learningOutcomes}</p>
                        </div>
                    )}
                  </div>
               </section>

                {/* Curriculum Section */}
                <section className="space-y-8">
                   <div className="flex items-center gap-4">
                      <div className="w-1.5 h-8 bg-primary rounded-full"></div>
                      <h2 className="text-3xl font-black text-foreground tracking-tight uppercase italic">Curriculum ({classroom.topics?.length || 0} Modules)</h2>
                   </div>
                  <div className="space-y-3">
                    {classroom.topics?.map((topic, i) => (
                      <div key={topic._id} className="group p-6 bg-card border border-border rounded-3xl hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5 transition-all flex items-center justify-between">
                         <div className="flex items-center gap-5">
                            <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center font-black text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-colors italic">
                               {i + 1}
                            </div>
                            <div>
                               <h4 className="font-black text-foreground group-hover:text-primary transition-colors text-lg italic tracking-tight">{topic.name}</h4>
                               <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-1 opacity-60">Lessons & Materials Included</p>
                            </div>
                         </div>
                         <div className="hidden sm:block">
                            <span className="px-4 py-1.5 bg-muted text-muted-foreground text-[10px] font-black uppercase tracking-widest rounded-xl group-hover:bg-primary/20 group-hover:text-primary border border-border transition-all">Encrypted</span>
                         </div>
                      </div>
                    ))}
                  </div>
               </section>
            </div>

            {/* Sidebar Details */}
            <aside className="space-y-12">
               {/* Teacher Section */}
               <div className="p-10 bg-card text-foreground rounded-[3rem] shadow-2xl relative overflow-hidden border border-border">
                  <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-primary/10 blur-3xl rounded-full"></div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-10 border-b border-border pb-4 italic">Lead Architect</h4>
                  <div className="flex items-center gap-5 mb-8">
                    <div className="w-20 h-20 bg-muted rounded-[2rem] border border-border flex items-center justify-center text-3xl font-black text-primary backdrop-blur-md italic">
                       {teacher?.name?.charAt(0) || <Users className="w-10 h-10" />}
                    </div>
                    <div>
                       <h5 className="text-2xl font-black tracking-tighter italic">{teacher?.name || 'TBA'}</h5>
                       <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mt-1 opacity-80">{teacher?.role?.replace('_', ' ') || 'Instructor'}</p>
                    </div>
                  </div>
                  <div className="space-y-4 pt-4">
                     <div className="flex items-center gap-3 text-sm text-muted-foreground font-medium">
                        <GraduationCap className="w-4 h-4" />
                        <span>Certified Platform Instructor</span>
                     </div>
                     <div className="flex items-center gap-3 text-sm text-muted-foreground font-medium">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span>4.9 Instructor Rating</span>
                     </div>
                  </div>
               </div>

               {/* Schedule Section */}
               <div className="p-10 bg-card border border-border rounded-[3rem] shadow-2xl">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-10 border-b border-border/50 pb-4 italic">Temporal Logistics</h4>
                  <div className="space-y-8">
                     {classroom.schedule?.length > 0 ? classroom.schedule.map((slot, i) => (
                        <div key={i} className="flex flex-col gap-2">
                           <span className="text-sm font-black text-foreground uppercase tracking-wider italic">{slot.dayOfWeek}</span>
                           <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] opacity-70">
                              <Clock className="w-3.5 h-3.5 text-primary" />
                              <span>{slot.startTime} - {slot.endTime}</span>
                           </div>
                        </div>
                     )) : (
                        <p className="text-[10px] text-muted-foreground italic font-black uppercase tracking-widest opacity-40">Asynchronous / Self-Paced</p>
                     )}
                  </div>
               </div>

               {/* Stats / Info */}
               <div className="grid grid-cols-2 gap-4">
                   <div className="p-8 bg-muted/40 rounded-[2rem] border border-border text-center shadow-inner">
                      <p className="text-3xl font-black text-foreground italic">100%</p>
                      <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mt-1 opacity-60">Synchronized</p>
                   </div>
                   <div className="p-8 bg-muted/40 rounded-[2rem] border border-border text-center shadow-inner">
                      <p className="text-3xl font-black text-foreground italic">Elite</p>
                      <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mt-1 opacity-60">Credential</p>
                   </div>
               </div>
            </aside>
         </div>
      </div>

      {/* Call to Action Footer */}
      <footer className="bg-muted py-32 text-center border-t border-border mt-32">
         <div className="max-w-4xl mx-auto px-6 space-y-10">
            <h2 className="text-5xl md:text-7xl font-black text-foreground tracking-tighter uppercase italic">Ready to engage?</h2>
            <p className="text-xl text-muted-foreground font-black uppercase tracking-[0.1em] max-w-2xl mx-auto italic opacity-70">Enroll in this class and start learning today.</p>
            <div className="pt-8">
              <button 
                onClick={handleEnrollClick}
                className="px-16 py-8 bg-primary text-white rounded-[2.5rem] font-black uppercase tracking-widest text-sm hover:bg-primary/90 transition-all transform hover:scale-105 shadow-2xl shadow-primary/30 active:scale-95 flex items-center justify-center gap-6 mx-auto group border border-white/10"
              >
                 <span>{user ? 'Activate Membership' : publicAccessInfo.guestEnabled ? 'Join Now' : 'Activate Membership'}</span>
                 <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
         </div>
      </footer>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-card text-foreground rounded-[2.5rem] shadow-2xl border border-border p-8 animate-fade-in">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 p-2 bg-muted text-muted-foreground rounded-xl hover:bg-muted/80 hover:text-foreground transition-all border border-border"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center border border-primary/20">
                <QrCode className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-widest italic">Share this class</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-70">Invite people to join — no account needed</p>
              </div>
            </div>

            <div className="flex flex-col items-center mb-6">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(shareUrl)}`}
                alt="QR code for this class"
                className="w-44 h-44 rounded-2xl border border-border bg-white p-2"
              />
              <p className="mt-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 text-center">Scan to open the public page</p>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-2xl border border-border mb-5">
              <Link2 className="w-4 h-4 text-primary shrink-0" />
              <span className="flex-1 text-[10px] font-bold text-muted-foreground truncate">{shareUrl}</span>
              <button
                onClick={handleCopyPublicLink}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 p-4 bg-muted/40 rounded-2xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all"
              >
                <MessageCircle className="w-5 h-5 text-emerald-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">WhatsApp</span>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 p-4 bg-muted/40 rounded-2xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all"
              >
                <Facebook className="w-5 h-5 text-blue-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Facebook</span>
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 p-4 bg-muted/40 rounded-2xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all"
              >
                <Twitter className="w-5 h-5 text-sky-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Twitter / X</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Guest Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-card text-foreground rounded-[2.5rem] shadow-2xl border border-border p-8 animate-fade-in">
            <button
              onClick={() => setShowJoinModal(false)}
              className="absolute top-4 right-4 p-2 bg-muted text-muted-foreground rounded-xl hover:bg-muted/80 hover:text-foreground transition-all border border-border"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {verifyingPayment ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-primary/10 rounded-3xl flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-widest italic">Verifying Payment</h3>
                <p className="text-sm text-muted-foreground font-medium">Please wait while we confirm your payment.</p>
              </div>
            ) : accessResult ? (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-widest italic">Access Granted</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-70">
                      {accessResult.accessType === 'live' ? 'Live session is ready' : accessResult.accessType === 'recording' ? 'Recording is ready' : 'Payment confirmed'}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground font-medium leading-relaxed">{accessResult.message}</p>
                {accessResult.instructions && (
                  <div className="p-4 bg-muted/40 rounded-2xl border border-border text-sm text-muted-foreground font-medium leading-relaxed">
                    {accessResult.instructions}
                  </div>
                )}
                {accessResult.joinUrl ? (
                  <div className="space-y-3 pt-2">
                    <button
                      onClick={handleLaunchSession}
                      className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-primary/90 transition-all transform hover:-translate-y-0.5 shadow-xl shadow-primary/20 active:scale-95 flex items-center justify-center gap-3"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {accessResult.accessType === 'live' ? 'Join Live Session' : 'Watch Recording'}
                    </button>
                    <button
                      onClick={handleCopyLink}
                      className="w-full py-3.5 bg-muted text-muted-foreground rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-muted/80 hover:text-foreground transition-all border border-border flex items-center justify-center gap-3"
                    >
                      <Copy className="w-4 h-4" />
                      Copy Link
                    </button>
                  </div>
                ) : (
                  <div className="pt-2">
                    <button
                      onClick={() => setShowJoinModal(false)}
                      className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-primary/90 transition-all transform hover:-translate-y-0.5 shadow-xl shadow-primary/20 active:scale-95 flex items-center justify-center gap-3"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Got it
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center border border-primary/20">
                    {classroom.isPaid ? <Lock className="w-7 h-7" /> : <Radio className="w-7 h-7" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-widest italic">
                      {classroom.isPaid ? 'Pay to Join' : 'Join as a Guest'}
                    </h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-70">
                      No account needed
                    </p>
                  </div>
                </div>

                <div className="flex items-baseline gap-2 bg-muted/30 rounded-2xl px-5 py-4 border border-border">
                  <span className="text-2xl font-black italic text-foreground">
                    {classroom.isPaid ? `₦${Number(classroom.pricing?.amount || 0).toLocaleString()}` : 'Free'}
                  </span>
                  {classroom.isPaid && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Access Fee</span>
                  )}
                </div>

                {!publicAccessInfo.hasActiveLive && !publicAccessInfo.hasRecording && (
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed bg-muted/30 p-3 rounded-xl border border-border">
                    This session is not live yet. Join when it starts, or watch the recording after it ends.
                  </p>
                )}

                <form onSubmit={handleGuestJoin} className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                      <User className="w-3.5 h-3.5" /> Full Name
                    </label>
                    <input
                      type="text"
                      value={guestForm.name}
                      onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })}
                      placeholder="e.g. Ada Obi"
                      className="w-full px-4 py-3.5 bg-muted/40 border border-border rounded-2xl text-sm font-medium text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                      <Mail className="w-3.5 h-3.5" /> Email Address
                    </label>
                    <input
                      type="email"
                      value={guestForm.email}
                      onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
                      placeholder="you@example.com"
                      className="w-full px-4 py-3.5 bg-muted/40 border border-border rounded-2xl text-sm font-medium text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>

                  {joinError && (
                    <p className="text-xs font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 leading-relaxed">{joinError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={joining}
                    className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-primary/90 transition-all transform hover:-translate-y-0.5 shadow-xl shadow-primary/20 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    {joining ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {classroom.isPaid ? 'Contacting Payment Gateway...' : 'Joining...'}
                      </>
                    ) : (
                      <>
                        {classroom.isPaid ? 'Pay & Join Now' : 'Join Now'}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                  <p className="text-center text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 bg-muted/40 py-3 rounded-xl border border-border italic">
                    Secure Checkout powered by Paystack
                  </p>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicClassroom;
