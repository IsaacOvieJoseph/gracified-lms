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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl max-w-md w-full text-center border border-slate-100">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Info className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Oops!</h2>
          <p className="text-slate-500 mb-8 font-medium leading-relaxed">{error}</p>
          <button 
            onClick={() => navigate('/')}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 group shadow-lg"
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
    <div className="min-h-screen bg-white font-inter selection:bg-indigo-100 selection:text-indigo-900">
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
               <div className="absolute -inset-4 bg-indigo-500/20 blur-3xl rounded-[3rem]"></div>
               <div className="relative bg-white text-slate-900 rounded-[2.5rem] shadow-2xl p-8 border border-slate-100">
                  <div className="flex items-center justify-between mb-8">
                    <div className="p-3 bg-indigo-50 rounded-2xl">
                       <ShieldCheck className="w-6 h-6 text-indigo-600" />
                    </div>
                    <button 
                      onClick={handleShare}
                      className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200"
                    >
                       <Share2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-baseline gap-2">
                       <span className="text-4xl font-black text-slate-900">
                         {classroom.isPaid ? `₦${classroom.pricing?.amount?.toLocaleString() || 0}` : "Free"}
                       </span>
                       {classroom.isPaid && <span className="text-slate-400 font-bold text-sm">Access Fee</span>}
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
                           <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                             <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                           </div>
                           <span className="text-slate-600 font-medium group-hover:text-slate-900 transition-colors">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-6">
                      <button 
                        onClick={handleEnrollClick}
                        className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all transform hover:-translate-y-1 shadow-xl shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-3 group"
                      >
                         <span>Join Classroom Now</span>
                         <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                      <p className="text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-6 bg-slate-50 py-3 rounded-xl border border-slate-100">
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
                     <div className="w-1 h-8 bg-indigo-600 rounded-full"></div>
                     <h2 className="text-3xl font-black text-slate-900 tracking-tight">About this Class</h2>
                  </div>
                  <div className="text-lg text-slate-600 leading-relaxed font-medium space-y-4">
                    <p>{classroom.description || "Explore this comprehensive course designed to equip you with real-world skills and expert knowledge."}</p>
                    {classroom.learningOutcomes && (
                        <div className="mt-8 p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-4">
                            <h4 className="font-black text-slate-900 uppercase tracking-widest text-[10px]">What you'll learn</h4>
                            <p className="italic text-slate-500 whitespace-pre-line">{classroom.learningOutcomes}</p>
                        </div>
                    )}
                  </div>
               </section>

               {/* Curriculum Section */}
               <section className="space-y-8">
                  <div className="flex items-center gap-4">
                     <div className="w-1 h-8 bg-indigo-600 rounded-full"></div>
                     <h2 className="text-3xl font-black text-slate-900 tracking-tight">Curriculum ({classroom.topics?.length || 0} Topics)</h2>
                  </div>
                  <div className="space-y-3">
                    {classroom.topics?.map((topic, i) => (
                      <div key={topic._id} className="group p-6 bg-white border border-slate-100 rounded-3xl hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5 transition-all flex items-center justify-between">
                         <div className="flex items-center gap-5">
                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                               {i + 1}
                            </div>
                            <div>
                               <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{topic.name}</h4>
                               <p className="text-xs text-slate-400 font-medium mt-1">Topic overview & materials included</p>
                            </div>
                         </div>
                         <div className="hidden sm:block">
                            <span className="px-3 py-1 bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-widest rounded-lg group-hover:bg-indigo-50 group-hover:text-indigo-600">Locked</span>
                         </div>
                      </div>
                    ))}
                  </div>
               </section>
            </div>

            {/* Sidebar Details */}
            <aside className="space-y-12">
               {/* Teacher Section */}
               <div className="p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-indigo-500/10 blur-3xl rounded-full"></div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-8 border-b border-white/5 pb-4">Instructor</h4>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-white/10 rounded-[1.5rem] flex items-center justify-center text-2xl font-black text-indigo-400 backdrop-blur-md">
                       {teacher?.name?.charAt(0) || <Users className="w-8 h-8" />}
                    </div>
                    <div>
                       <h5 className="text-xl font-black tracking-tight">{teacher?.name || 'TBA'}</h5>
                       <p className="text-sm text-indigo-400 font-bold capitalize">{teacher?.role?.replace('_', ' ') || 'Instructor'}</p>
                    </div>
                  </div>
                  <div className="space-y-4 pt-4">
                     <div className="flex items-center gap-3 text-sm text-slate-400 font-medium">
                        <GraduationCap className="w-4 h-4" />
                        <span>Certified Platform Instructor</span>
                     </div>
                     <div className="flex items-center gap-3 text-sm text-slate-400 font-medium">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span>4.9 Instructor Rating</span>
                     </div>
                  </div>
               </div>

               {/* Schedule Section */}
               <div className="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8 border-b border-slate-50 pb-4">Schedule</h4>
                  <div className="space-y-6">
                     {classroom.schedule?.length > 0 ? classroom.schedule.map((slot, i) => (
                        <div key={i} className="flex flex-col gap-1">
                           <span className="text-sm font-black text-slate-900">{slot.dayOfWeek}</span>
                           <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                              <Clock className="w-3 h-3" />
                              <span>{slot.startTime} - {slot.endTime}</span>
                           </div>
                        </div>
                     )) : (
                        <p className="text-sm text-slate-400 italic">Self-paced learning</p>
                     )}
                  </div>
               </div>

               {/* Stats / Info */}
               <div className="grid grid-cols-2 gap-4">
                   <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-center">
                      <p className="text-2xl font-black text-slate-900">100%</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Online</p>
                   </div>
                   <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-center">
                      <p className="text-2xl font-black text-slate-900">Life</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Access</p>
                   </div>
               </div>
            </aside>
         </div>
      </div>

      {/* Call to Action Footer */}
      <footer className="bg-slate-50 py-32 text-center">
         <div className="max-w-4xl mx-auto px-6 space-y-8">
            <h2 className="text-5xl font-black text-slate-900 tracking-tighter">Ready to start your journey?</h2>
            <p className="text-xl text-slate-500 font-medium max-w-2xl mx-auto">Join thousands of students across our platform and secure your spot today.</p>
            <div className="pt-8">
              <button 
                onClick={handleEnrollClick}
                className="px-12 py-6 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-sm hover:bg-indigo-700 transition-all transform hover:scale-105 shadow-2xl shadow-indigo-600/30 active:scale-95 flex items-center justify-center gap-4 mx-auto group"
              >
                 <span>Enroll Now</span>
                 <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
         </div>
      </footer>
    </div>
  );
};

export default PublicClassroom;
