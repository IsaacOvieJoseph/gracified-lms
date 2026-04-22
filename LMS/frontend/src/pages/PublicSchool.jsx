import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  Users, Building2, BookOpen, ChevronRight, 
  ArrowRight, Share2, Star, Globe, Mail, 
  MapPin, ShieldCheck, GraduationCap, LayoutGrid,
  Zap, Award
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const PublicSchool = () => {
  const identifier = useParams().identifier;
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSchool = async () => {
      try {
        const response = await axios.get(`${API_URL}/schools/public/${identifier}`);
        setData(response.data);
      } catch (err) {
        console.error('Error fetching public school:', err);
        setError(err.response?.data?.message || 'School not found');
      } finally {
        setLoading(false);
      }
    };

    fetchSchool();
  }, [identifier]);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success('School portal link copied!');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <Building2 className="absolute inset-0 m-auto w-8 h-8 text-indigo-400 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl max-w-md w-full text-center border border-slate-100">
          <div className="w-24 h-24 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 rotate-12">
            <Building2 className="w-12 h-12" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Portal Not Found</h2>
          <p className="text-slate-500 mb-10 font-medium leading-relaxed">{error}</p>
          <button 
            onClick={() => navigate('/')}
            className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black hover:bg-black transition-all flex items-center justify-center gap-2 group shadow-xl"
          >
            <span>Return Home</span>
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    );
  }

  const { school, classrooms } = data;

  return (
    <div className="min-h-screen bg-slate-50 font-inter selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden">
      {/* Dynamic Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                <GraduationCap className="w-6 h-6 text-white" />
             </div>
             <span className="text-xl font-black text-slate-900 tracking-tighter">Gracified<span className="text-indigo-600">LMS</span></span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleShare}
              className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all uppercase tracking-wider"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Portal</span>
            </button>
            <Link 
              to={`/register/student?redirect=${location.pathname}`}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 uppercase tracking-widest"
            >
              Enroll
            </Link>
          </div>
        </div>
      </nav>

      {/* Modern Hero Section */}
      <section className="relative pt-40 pb-32 bg-slate-900 overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/20 blur-[120px] rounded-full -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-600/10 blur-[100px] rounded-full translate-y-1/2"></div>
        
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full backdrop-blur-md">
                <Zap className="w-4 h-4 text-indigo-400 fill-indigo-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">Verified Institution</span>
              </div>
              
              <div className="space-y-4">
                <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-[0.85]">
                  {school.name}
                </h1>
                <p className="text-xl text-slate-400 font-medium leading-relaxed max-w-xl">
                  Welcome to our digital learning portal. Explore our specialized classrooms, connect with world-class educators, and start your journey towards excellence.
                </p>
              </div>

              <div className="flex flex-wrap gap-4 pt-4">
                 <div className="flex items-center gap-3 px-6 py-4 bg-white/5 border border-white/10 rounded-[2rem] backdrop-blur-md">
                   <Users className="w-6 h-6 text-indigo-400" />
                   <div>
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Community</p>
                     <p className="text-lg font-black text-white">Active Portal</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-3 px-6 py-4 bg-white/5 border border-white/10 rounded-[2rem] backdrop-blur-md">
                   <LayoutGrid className="w-6 h-6 text-purple-400" />
                   <div>
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Resources</p>
                     <p className="text-lg font-black text-white">{classrooms.length} Classrooms</p>
                   </div>
                 </div>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-500 to-purple-500 opacity-20 blur-3xl rounded-[4rem] group-hover:opacity-30 transition-opacity"></div>
              <div className="relative aspect-square sm:aspect-video lg:aspect-square bg-slate-800 rounded-[3.5rem] border border-white/10 overflow-hidden shadow-2xl overflow-hidden">
                {school.logoUrl ? (
                  <img src={school.logoUrl} alt={school.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-6">
                     <Building2 className="w-24 h-24 text-slate-700" />
                     <div className="text-center">
                        <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-xs">Official School Portal</p>
                     </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Classrooms Section */}
      <section className="max-w-7xl mx-auto px-6 py-32">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
          <div className="space-y-4">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">Available Classrooms</h2>
            <p className="text-lg text-slate-500 font-medium max-w-xl leading-relaxed">
              Browse our diverse range of learning environments. Each classroom is equipped with specialized tools for an immersive experience.
            </p>
          </div>
          <div className="hidden md:flex gap-4">
             <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                   <ShieldCheck className="w-6 h-6 text-green-600" />
                </div>
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Quality Assured</p>
                   <p className="text-sm font-bold text-slate-900">Verified Content</p>
                </div>
             </div>
          </div>
        </div>

        {classrooms.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {classrooms.map((cls) => (
              <div key={cls._id} className="group relative bg-white rounded-[2.5rem] border border-slate-200/60 p-8 hover:border-indigo-500 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 h-full flex flex-col">
                <div className="flex items-start justify-between mb-8">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                    <BookOpen className="w-8 h-8 text-slate-400 group-hover:text-indigo-600" />
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${cls.isPaid ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                    {cls.isPaid ? 'Premium' : 'Free Access'}
                  </div>
                </div>

                <div className="space-y-4 flex-grow">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">
                    {cls.name}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-bold uppercase tracking-wider">{cls.subject}</span>
                    <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-bold uppercase tracking-wider">{cls.level}</span>
                  </div>
                  <p className="text-slate-500 font-medium leading-relaxed line-clamp-3">
                    {cls.description || "Join this classroom to explore interactive lessons, participate in discussions, and master your subject with expert guidance."}
                  </p>
                </div>

                <div className="mt-10 pt-8 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Instructor</span>
                    <span className="text-sm font-bold text-slate-900 capitalize">{cls.teacherId?.name || "Expert Educator"}</span>
                  </div>
                  <Link 
                    to={`/c/${cls.shortCode || cls._id}`}
                    className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-600 transition-all transform group-hover:translate-x-2 shadow-lg shadow-slate-900/10"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-32 bg-white rounded-[4rem] border border-dashed border-slate-300">
             <div className="w-20 h-20 bg-slate-50 text-slate-400 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <BookOpen className="w-10 h-10" />
             </div>
             <h3 className="text-2xl font-black text-slate-900 mb-2">No active classrooms</h3>
             <p className="text-slate-500 font-medium">Check back soon for new learning opportunities!</p>
          </div>
        )}
      </section>

      {/* Info Blocks */}
      <section className="bg-white py-32">
        <div className="max-w-7xl mx-auto px-6">
           <div className="grid md:grid-cols-3 gap-12">
              <div className="p-10 bg-slate-50 rounded-[3rem] space-y-6 group hover:bg-indigo-600 transition-all duration-500">
                 <div className="w-14 h-14 bg-white text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    <Award className="w-7 h-7" />
                 </div>
                 <h4 className="text-2xl font-black text-slate-900 group-hover:text-white transition-colors">Quality Assurance</h4>
                 <p className="text-slate-500 font-medium group-hover:text-white/70 transition-colors">All our classes follow professional standards and regular curriculum reviews.</p>
              </div>
              <div className="p-10 bg-slate-50 rounded-[3rem] space-y-6 group hover:bg-indigo-600 transition-all duration-500">
                 <div className="w-14 h-14 bg-white text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    <Globe className="w-7 h-7" />
                 </div>
                 <h4 className="text-2xl font-black text-slate-900 group-hover:text-white transition-colors">Global Access</h4>
                 <p className="text-slate-500 font-medium group-hover:text-white/70 transition-colors">Connect from anywhere in the world and learn at your own comfortable pace.</p>
              </div>
              <div className="p-10 bg-slate-50 rounded-[3rem] space-y-6 group hover:bg-indigo-600 transition-all duration-500">
                 <div className="w-14 h-14 bg-white text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    <ShieldCheck className="w-7 h-7" />
                 </div>
                 <h4 className="text-2xl font-black text-slate-900 group-hover:text-white transition-colors">Secure Platform</h4>
                 <p className="text-slate-500 font-medium group-hover:text-white/70 transition-colors">Your data and learning progress are protected with industry-standard security.</p>
              </div>
           </div>
        </div>
      </section>

      {/* Footer / CTA Area */}
      <footer className="bg-slate-900 py-32 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/5 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
        <div className="max-w-4xl mx-auto px-6 text-center space-y-12 relative">
          <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-[2rem] flex items-center justify-center mx-auto backdrop-blur-md">
            <GraduationCap className="w-10 h-10 text-indigo-400" />
          </div>
          <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter">Ready to join {school.name}?</h2>
          <p className="text-xl text-slate-400 font-medium max-w-2xl mx-auto">
            Take the first step towards your academic and professional goals today. Join our digital community.
          </p>
          <div className="pt-8 flex flex-wrap justify-center gap-6">
             <Link 
              to={`/register/student?redirect=${location.pathname}`}
              className="px-12 py-6 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-sm hover:bg-indigo-700 transition-all transform hover:scale-105 shadow-2xl shadow-indigo-600/30 active:scale-95 flex items-center justify-center gap-4 group"
            >
               <span>Get Started</span>
               <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          
          <div className="pt-24 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-12 text-left">
             <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Administrator</p>
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center font-black text-indigo-400 border border-white/10">
                      {school.adminId?.name?.charAt(0)}
                   </div>
                   <div>
                      <p className="font-bold text-white uppercase tracking-tight">{school.adminId?.name}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                         <Mail className="w-3 h-3" />
                         <span>{school.adminId?.email}</span>
                      </div>
                   </div>
                </div>
             </div>
             <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Portal Info</p>
                <div className="space-y-2">
                   <div className="flex items-center gap-3 text-slate-400 text-sm font-medium">
                      <MapPin className="w-4 h-4 text-indigo-500" />
                      <span>Digital Education Portal</span>
                   </div>
                   <div className="flex items-center gap-3 text-slate-400 text-sm font-medium">
                      <ShieldCheck className="w-4 h-4 text-indigo-500" />
                      <span>Secure Institutional Access</span>
                   </div>
                </div>
             </div>
          </div>
          
          <p className="pt-20 text-slate-500 text-xs font-bold uppercase tracking-widest">
            © 2026 Gracified Learning Management System. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PublicSchool;
