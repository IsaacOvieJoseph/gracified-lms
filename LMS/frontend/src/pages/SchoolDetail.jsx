import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from '../utils/api';
import Layout from "../components/Layout";
import { 
  Building2, Users, GraduationCap, 
  Trash2, Pencil, Calendar, ShieldCheck, 
  Share2, ChevronRight, Copy, ExternalLink,
  Award, ArrowLeft
} from "lucide-react";
import { toast } from "react-hot-toast";

export default function SchoolDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      // Fixed the double /api prefix
      const res = await api.get(`/schools/${id}`);
      setSchool(res.data);
    } catch (err) {
      console.error("Error loading school:", err);
      toast.error("Failed to load school details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/s/${school.shortCode || school._id}`;
    navigator.clipboard.writeText(url);
    toast.success('Portal link copied to clipboard!');
  };

  const openPortal = () => {
    window.open(`/s/${school.shortCode || school._id}`, '_blank');
  };

  if (loading)
    return (
      <Layout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Fetching school details...</p>
        </div>
      </Layout>
    );

  if (!school)
    return (
      <Layout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center">
             <Building2 className="w-10 h-10" />
          </div>
          <div className="text-center">
            <h3 className="text-2xl font-black text-slate-900">School Not Found</h3>
            <p className="text-slate-500 font-medium mt-2">The school you are looking for does not exist or you don't have access.</p>
          </div>
          <button 
            onClick={() => navigate('/schools')}
            className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-black transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Schools</span>
          </button>
        </div>
      </Layout>
    );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8 pb-20">
        {/* Breadcrumbs / Back button */}
        <button 
          onClick={() => navigate('/schools')}
          className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold text-sm transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Schools</span>
        </button>

        {/* Hero Header */}
        <div className="relative overflow-hidden bg-slate-900 rounded-[3rem] p-10 md:p-16 text-white shadow-2xl">
           <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/10 blur-[100px] rounded-full"></div>
           <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-60 h-60 bg-purple-500/10 blur-[80px] rounded-full"></div>
           
           <div className="relative flex flex-col md:flex-row items-center gap-10">
              <div className="w-32 h-32 md:w-44 md:h-44 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center justify-center backdrop-blur-md overflow-hidden">
                 {school.logoUrl ? (
                   <img src={school.logoUrl} alt={school.name} className="w-full h-full object-cover" />
                 ) : (
                   <Building2 className="w-16 h-16 md:w-20 md:h-20 text-indigo-400" />
                 )}
              </div>
              
              <div className="text-center md:text-left space-y-4">
                 <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/20 border border-indigo-500/30 rounded-full">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Official Institution</span>
                 </div>
                 <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none">{school.name}</h1>
                 <div className="flex flex-wrap justify-center md:justify-start gap-6 text-slate-400 font-bold text-sm">
                    <div className="flex items-center gap-2">
                       <Users className="w-4 h-4 text-indigo-500" />
                       <span>Admin: {school.admin?.name || 'Unassigned'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <Calendar className="w-4 h-4 text-purple-500" />
                       <span>Established: {new Date(school.createdAt).toLocaleDateString()}</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
           {/* Main Column */}
           <div className="lg:col-span-2 space-y-8">
              {/* Share Card - The Wowy Part */}
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden group">
                 <div className="p-8 space-y-6">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                             <Share2 className="w-6 h-6 text-indigo-600" />
                          </div>
                          <div>
                             <h3 className="text-xl font-black text-slate-900">Shareable Portal Link</h3>
                             <p className="text-sm text-slate-500 font-medium">Use this link to let students browse your school's classrooms.</p>
                          </div>
                       </div>
                    </div>
                    
                    <div className="relative group/link">
                       <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-20 group-hover/link:opacity-40 transition-opacity"></div>
                       <div className="relative bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between gap-4">
                          <code className="text-slate-600 font-bold truncate text-sm">
                             {window.location.origin}/s/{school.shortCode || school._id}
                          </code>
                          <div className="flex items-center gap-2 shrink-0">
                             <button 
                               onClick={handleCopyLink}
                               className="p-2 bg-white border border-slate-200 text-slate-400 rounded-lg hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
                               title="Copy Link"
                             >
                                <Copy className="w-4 h-4" />
                             </button>
                             <button 
                               onClick={openPortal}
                               className="p-2 bg-slate-900 text-white rounded-lg hover:bg-black transition-all shadow-md"
                               title="Open Portal"
                             >
                                <ExternalLink className="w-4 h-4" />
                             </button>
                          </div>
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                             <ShieldCheck className="w-4 h-4 text-green-600" />
                          </div>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">SSL Secured</span>
                       </div>
                       <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                             <Award className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Brand Verified</span>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Stats Grid */}
              <div className="grid sm:grid-cols-2 gap-6">
                 <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                       <GraduationCap className="w-8 h-8" />
                    </div>
                    <div>
                       <p className="text-4xl font-black text-slate-900 tracking-tighter">{school.teacherCount || 0}</p>
                       <p className="text-sm font-black text-slate-400 uppercase tracking-widest mt-1">Verified Teachers</p>
                    </div>
                 </div>
                 <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
                    <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
                       <Users className="w-8 h-8" />
                    </div>
                    <div>
                       <p className="text-4xl font-black text-slate-900 tracking-tighter">{school.studentCount || 0}</p>
                       <p className="text-sm font-black text-slate-400 uppercase tracking-widest mt-1">Enrolled Students</p>
                    </div>
                 </div>
              </div>
           </div>

           {/* Sidebar Column */}
           <div className="space-y-8">
              {/* Subscription Status Card */}
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8 space-y-8">
                 <div className="flex items-center gap-3 border-b border-slate-50 pb-6">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                       <Award className="w-6 h-6 text-amber-600" />
                    </div>
                    <h4 className="font-black text-slate-900 uppercase tracking-widest text-[10px]">Membership Plan</h4>
                 </div>
                 
                 <div className="space-y-6">
                    <div className="flex items-center justify-between">
                       <span className="text-slate-500 font-bold">Status</span>
                       <span className={`px-4 py-1 rounded-full font-black text-[10px] uppercase tracking-widest ${school.subscriptionStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {school.subscriptionStatus || 'N/A'}
                       </span>
                    </div>
                    {school.subscriptionExpiry && (
                       <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-bold">Expires</span>
                          <span className="text-slate-900 font-black text-sm">{new Date(school.subscriptionExpiry).toLocaleDateString()}</span>
                       </div>
                    )}
                    <button className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                       Manage Subscription
                    </button>
                 </div>
              </div>

              {/* Actions Card */}
              <div className="bg-slate-50 rounded-[2.5rem] border border-slate-200 p-8 space-y-6">
                 <h4 className="font-black text-slate-400 uppercase tracking-widest text-[10px] text-center">Quick Actions</h4>
                 <div className="space-y-3">
                    <button className="w-full p-4 bg-white border border-slate-200 rounded-2xl flex items-center gap-3 font-bold text-slate-700 hover:border-indigo-200 hover:text-indigo-600 transition-all group shadow-sm">
                       <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600">
                          <Pencil className="w-4 h-4" />
                       </div>
                       <span>Edit Profile</span>
                    </button>
                    <button className="w-full p-4 bg-white border border-slate-200 rounded-2xl flex items-center gap-3 font-bold text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all group shadow-sm">
                       <div className="w-8 h-8 bg-rose-50 rounded-lg flex items-center justify-center text-rose-400 group-hover:text-rose-600">
                          <Trash2 className="w-4 h-4" />
                       </div>
                       <span>Delete Institution</span>
                    </button>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </Layout>
  );
}
