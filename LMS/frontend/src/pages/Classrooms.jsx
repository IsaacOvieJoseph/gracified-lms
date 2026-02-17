import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
  Plus, Calendar, Users, User, Book, Video, Edit, Eye,
  EyeOff, Search, Trash2, Loader2, ChevronDown,
  ChevronRight, Clock, School, ArrowRight, Layers,
  Filter, Sparkles, X
} from 'lucide-react';
import { convertLocalToUTC, convertUTCToLocal } from '../utils/timezone';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatAmount } from '../utils/currency';

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

const SectionHeader = ({ title, count, icon: Icon }) => (
  <div className="flex items-center justify-between mb-6">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-primary/10 rounded-lg text-primary">
        <Icon className="w-5 h-5" />
      </div>
      <h2 className="text-xl font-bold text-slate-800">{title}</h2>
      <span className="text-[10px] font-bold bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full uppercase tracking-widest">{count} Total</span>
    </div>
    <div className="h-px flex-1 bg-slate-100 mx-6 hidden md:block" />
  </div>
);

const Classrooms = () => {
  const { user } = useAuth();
  const [classrooms, setClassrooms] = useState([]);
  const [filteredClassrooms, setFilteredClassrooms] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [subjectOptions, setSubjectOptions] = useState(defaultSubjects.map(s => ({ value: s, label: s })));
  const [formData, setFormData] = useState({
    name: '', description: '', learningOutcomes: '', subject: '',
    level: 'Other', schedule: [], capacity: 30,
    pricing: { type: user?.defaultPricingType || 'monthly', amount: 0 },
    isPaid: false, teacherId: '', schoolIds: [], published: false, isPrivate: false
  });

  const [openMySchool, setOpenMySchool] = useState(true);
  const [openOthers, setOpenOthers] = useState(true);
  const [selectedSchools, setSelectedSchools] = useState(() => {
    try { return JSON.parse(localStorage.getItem('selectedSchools')) || []; } catch { return []; }
  });

  const canCreate = ['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await api.get('/settings');
        if (res.data && res.data.subjects) {
          const uniqueSubjects = Array.from(new Set([...defaultSubjects, ...res.data.subjects]));
          uniqueSubjects.sort();
          setSubjectOptions(uniqueSubjects.map(s => ({ value: s, label: s })));
        }
      } catch (err) { }
    };
    fetchSubjects();
  }, []);

  useEffect(() => {
    fetchClassrooms();
    if (['root_admin', 'school_admin'].includes(user?.role)) fetchTeachers();

    const handler = () => {
      try { setSelectedSchools(JSON.parse(localStorage.getItem('selectedSchools')) || []); } catch { }
      fetchClassrooms();
      if (['root_admin', 'school_admin'].includes(user?.role)) fetchTeachers();
    };
    window.addEventListener('schoolSelectionChanged', handler);
    return () => window.removeEventListener('schoolSelectionChanged', handler);
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredClassrooms(classrooms);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredClassrooms(classrooms.filter(c =>
        c.name?.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query) ||
        c.teacherId?.name?.toLowerCase().includes(query)
      ));
    }
  }, [searchQuery, classrooms]);

  const fetchClassrooms = async () => {
    if (classrooms.length === 0) setLoading(true);
    try {
      const response = await api.get('/classrooms');
      let filtered = response.data.classrooms;
      if (user?.role === 'student' || user?.role === 'teacher') filtered = filtered.filter(c => c.published);
      if (user?.role === 'school_admin' && selectedSchools.length > 0) {
        filtered = filtered.filter(c => {
          const cids = Array.isArray(c.schoolId) ? c.schoolId.map(sid => (sid?._id || sid).toString()) : [c.schoolId?._id?.toString() || c.schoolId?.toString()];
          return selectedSchools.some(sel => cids.includes((sel?._id || sel).toString()));
        });
      }
      setClassrooms(filtered);
      setFilteredClassrooms(filtered);
    } catch (error) { } finally { setLoading(false); }
  };

  const fetchTeachers = async () => {
    try {
      const response = await api.get('/users?role=teacher,personal_teacher');
      setTeachers(response.data.users.filter(u => ['teacher', 'personal_teacher'].includes(u.role)));
    } catch (error) { }
  };

  const [publishingClassId, setPublishingClassId] = useState(null);
  const handlePublishToggle = async (id, status) => {
    setPublishingClassId(id);
    try {
      await api.put(`/classrooms/${id}/publish`, { published: !status });
      fetchClassrooms();
    } catch (error) { toast.error('Error updating status'); }
    finally { setPublishingClassId(null); }
  };

  const [schools, setSchools] = useState([]);
  useEffect(() => {
    if (user?.role === 'school_admin') {
      api.get('/schools?adminId=' + user._id).then(res => setSchools(res.data.schools || []));
    }
  }, [user]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        isPaid: formData.isPaid && formData.pricing?.amount > 0,
        schedule: formData.schedule.map(s => {
          const utc = convertLocalToUTC(s.dayOfWeek, s.startTime);
          const utcEnd = convertLocalToUTC(s.dayOfWeek, s.endTime);
          return { dayOfWeek: utc.dayOfWeek, startTime: utc.time, endTime: utcEnd.time };
        })
      };
      if (user?.role === 'school_admin') {
        const sel = formData.schoolIds?.includes('ALL') ? schools.map(s => s._id) : formData.schoolIds;
        if (!sel || sel.length === 0) return toast.error('Select at least one school');
        submitData.schoolId = sel;
        delete submitData.schoolIds;
      }
      if (user?.role === 'teacher' || user?.role === 'personal_teacher') delete submitData.teacherId;
      await api.post('/classrooms', submitData);
      setShowCreateModal(false);
      fetchClassrooms();
      toast.success('Classroom created');
    } catch (error) { toast.error('Error creating classroom'); }
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [classToDelete, setClassToDelete] = useState(null);
  const handleDeleteClick = (id, e) => { e.preventDefault(); setClassToDelete(id); setShowDeleteModal(true); };

  const confirmDelete = async () => {
    try {
      await api.delete(`/classrooms/${classToDelete}`);
      toast.success('Deleted');
      fetchClassrooms();
      setShowDeleteModal(false);
    } catch (error) { toast.error('Error deleting'); }
  };

  const isMySchoolClass = (classroom) => {
    if (!user?.schoolId || user.schoolId.length === 0) return false;
    const usids = user.schoolId.map(s => (s?._id || s).toString());
    const cids = Array.isArray(classroom.schoolId) ? classroom.schoolId.map(sid => (sid?._id || sid).toString()) : [(classroom.schoolId?._id || classroom.schoolId)?.toString()];
    return cids.some(cid => usids.includes(cid));
  };

  const renderClassroomCard = (classroom) => {
    const isEnrolled = user?.enrolledClasses?.includes(classroom._id) || classroom.students?.some(s => s._id === user?._id);
    const isNew = new Date(classroom.createdAt) > new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const isAdmin = ['root_admin', 'school_admin', 'personal_teacher'].includes(user?.role);

    return (
      <div key={classroom._id} className="card-premium flex flex-col group overflow-hidden bg-white">
        <div className="relative h-2 bg-gradient-to-r from-primary/40 to-primary/10" />
        <div className="p-6 flex flex-col h-full">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-bold text-slate-900 truncate group-hover:text-primary transition-colors">{classroom.name}</h3>
                {isNew && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">New</span>}
              </div>
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                <User className="w-3 h-3" />
                <span>{classroom.teacherId?.name || 'TBA'}</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {classroom.isPaid ? (
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900">{formatAmount(classroom.pricing?.amount || 0, classroom.pricing?.currency || 'NGN')}</div>
                  <div className="text-[9px] font-bold text-primary uppercase tracking-tighter opacity-70">{(classroom.pricing?.type || 'Lecture').replace('_', ' ')}</div>
                </div>
              ) : (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Free</span>
              )}
            </div>
          </div>

          <div className="space-y-3 mb-6 flex-1">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Layers className="w-4 h-4 text-slate-300" />
              <span className="font-medium text-slate-400">Level:</span>
              <span className="text-slate-700">{classroom.level || 'Other'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar className="w-4 h-4 text-slate-300" />
              <span className="font-medium text-slate-400">Schedule:</span>
              <span className="text-slate-700 truncate">{classroom.schedule?.[0]?.dayOfWeek || 'TBA'} {classroom.schedule?.[0]?.startTime || ''}</span>
            </div>
            {isAdmin && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                  <Users className="w-3.5 h-3.5" /> {classroom.students?.length || 0} Enrolled
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handlePublishToggle(classroom._id, classroom.published)} className={`p-1.5 rounded-lg transition ${classroom.published ? 'text-emerald-500 bg-emerald-50' : 'text-slate-400 bg-slate-50'}`}>
                    {publishingClassId === classroom._id ? <Loader2 className="w-4 h-4 animate-spin" /> : (classroom.published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />)}
                  </button>
                  {(user?.role === 'root_admin' || user?.role === 'school_admin' || user?._id === classroom.teacherId?._id) && (
                    <button onClick={(e) => handleDeleteClick(classroom._id, e)} className="p-1.5 rounded-lg text-red-400 bg-red-50 hover:bg-red-100 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <Link to={`/classrooms/${classroom._id}`} className="btn-premium w-full group/btn">
            <span>View Classroom</span>
            <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    );
  };

  if (loading) return <Layout><div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" /></div></Layout>;

  return (
    <Layout>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              Explore Classrooms <Sparkles className="w-6 h-6 text-amber-500" />
            </h1>
            <p className="text-slate-400 font-medium mt-1">Discover and manage educational content with ease.</p>
          </div>
          {canCreate && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-premium whitespace-nowrap"
            >
              <Plus className="w-5 h-5" /> Create New Class
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Filter by name, teacher or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 bg-white border-slate-200 h-12 shadow-sm focus:shadow-md"
            />
          </div>
          <button className="flex items-center gap-2 h-12 px-6 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold hover:bg-slate-50 transition w-full md:w-auto justify-center">
            <Filter className="w-4 h-4" /> All Subjects
          </button>
        </div>

        <div className="space-y-10">
          {user?.role === 'student' && user?.schoolId?.length > 0 ? (
            <>
              <SectionHeader title="Your Schools" count={classrooms.filter(isMySchoolClass).length} icon={School} />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up">
                {classrooms.filter(isMySchoolClass).map(renderClassroomCard)}
              </div>

              {classrooms.filter(c => !isMySchoolClass(c)).length > 0 && (
                <>
                  <div className="pt-8 mb-6 border-t border-slate-100">
                    <SectionHeader title="Global Marketplace" count={classrooms.filter(c => !isMySchoolClass(c)).length} icon={Sparkles} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up">
                    {classrooms.filter(c => !isMySchoolClass(c)).map(renderClassroomCard)}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up">
              {filteredClassrooms.map(renderClassroomCard)}
            </div>
          )}

          {filteredClassrooms.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-slate-100 border-dashed">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <Search className="w-10 h-10 text-slate-200" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">No classes matches your search</h3>
              <p className="text-slate-400 mt-2">Try adjusting your filters or search keywords.</p>
            </div>
          )}
        </div>
      </div>

      {/* Simplified Create Modal Styling */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 shadow-2xl animate-slide-up">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900">New Classroom</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-400"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-6">
              {/* Reuse logic but with modernized UI components below */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label>Class Name</label>
                  <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Mastering UI Design..." required />
                </div>
                <div className="space-y-1.5">
                  <label>Subject</label>
                  <CreatableSelect
                    options={subjectOptions}
                    value={formData.subject ? { value: formData.subject, label: formData.subject } : null}
                    onChange={sel => setFormData({ ...formData, subject: sel?.value || '' })}
                    className="modern-select"
                  />
                </div>
              </div>
              {/* ... More fields can follow similar pattern ... */}
              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition">Discard</button>
                <button type="submit" className="btn-premium flex-1">Launch Class</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Classrooms;
