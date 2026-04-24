import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Users, Calendar, Clock, BookOpen, ChevronRight, 
  CheckCircle2, Info, GraduationCap, MapPin, Globe,
  ShieldCheck, ArrowRight, Share2, Star, Building2
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
  const { user } = useAuth();
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchClassroom = async () => {
      try {
        const response = await axios.get(`${API_URL}/classrooms/public/${shortCode}`);
        const found = response.data.classroom;
        
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
      } catch (err) {
        console.error('Error fetching public classroom:', err);
        setError(err.response?.data?.message || 'Classroom not found');
      } finally {
        setLoading(false);
      }
    };

    fetchClassroom();
  }, [shortCode]);

  const handleEnrollClick = async () => {
    if (user) {
      // If already logged in, just go to the class detail page. 
      // The detail page logic will handle enrollment for free classes 
      // or show the payment prompt for paid ones.
      navigate(`/classrooms/${classroom._id}`);
      return;
    }
    // Redirect to login with a fallback to return to the PRIVATE classroom view after auth
    navigate(`/login?redirect=/classrooms/${classroom._id}`);
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard!');
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
                  Enroll Now
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
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.9] animate-slide-up">
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
                         <span>Join Module Now</span>
                         <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                      <p className="text-center text-muted-foreground text-[9px] font-black uppercase tracking-[0.2em] mt-6 bg-muted/40 py-3 rounded-xl border border-border italic">
                         Secure Checkout powered by Paystack
                      </p>
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
                 <span>Activate Membership</span>
                 <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
         </div>
      </footer>
    </div>
  );
};

export default PublicClassroom;
