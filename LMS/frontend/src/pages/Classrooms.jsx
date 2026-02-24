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
  const [selectedSubject, setSelectedSubject] = useState('All Subjects');

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
    let filtered = [...classrooms];

    if (selectedSubject !== 'All Subjects') {
      filtered = filtered.filter(c => c.subject === selectedSubject);
    }

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.name?.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query) ||
        c.teacherId?.name?.toLowerCase().includes(query) ||
        c.subject?.toLowerCase().includes(query)
      );
    }

    setFilteredClassrooms(filtered);
  }, [searchQuery, selectedSubject, classrooms]);

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
          <div className="w-full md:w-64">
            <Select
              options={[{ value: 'All Subjects', label: 'All Subjects' }, ...subjectOptions]}
              value={{ value: selectedSubject, label: selectedSubject }}
              onChange={(sel) => setSelectedSubject(sel?.value || 'All Subjects')}
              className="modern-select"
              styles={{
                control: (base) => ({
                  ...base,
                  height: '48px',
                  borderRadius: '0.75rem',
                })
              }}
              components={{
                DropdownIndicator: () => <Filter className="w-4 h-4 text-slate-400 mr-4" />,
                IndicatorSeparator: () => null
              }}
            />
          </div>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] w-full max-w-2xl p-8 shadow-2xl animate-slide-up">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-slate-900">New Classroom</h2>
                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-400"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleCreate} className="space-y-8 pb-4">
                {/* Basic Info */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Class Title</label>
                    <input
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Advanced Mathematics Masterclass"
                      className="w-full"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Academic Level</label>
                    <Select
                      options={levelOptions}
                      value={levelOptions.find(opt => opt.value === formData.level)}
                      onChange={sel => setFormData({ ...formData, level: sel?.value })}
                      className="modern-select"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Subject</label>
                    <CreatableSelect
                      options={subjectOptions}
                      value={formData.subject ? { value: formData.subject, label: formData.subject } : null}
                      onChange={sel => setFormData({ ...formData, subject: sel?.value || '' })}
                      className="modern-select"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Tell students what this class is about..."
                      className="w-full min-h-[100px]"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Learning Outcomes</label>
                    <textarea
                      value={formData.learningOutcomes}
                      onChange={e => setFormData({ ...formData, learningOutcomes: e.target.value })}
                      placeholder="List what students will achieve (comma separated)..."
                      className="w-full min-h-[80px]"
                    />
                  </div>
                </div>

                {/* Roles & Visibility */}
                <div className="grid md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  {(user?.role === 'root_admin' || user?.role === 'school_admin') && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Assign Teacher</label>
                      <Select
                        options={teachers.map(t => ({ value: t._id, label: `${t.name} (${t.email})` }))}
                        value={teachers.find(t => t._id === formData.teacherId) ? { value: formData.teacherId, label: teachers.find(t => t._id === formData.teacherId).name } : null}
                        onChange={sel => setFormData({ ...formData, teacherId: sel?.value })}
                        placeholder="Select a teacher..."
                        className="modern-select"
                      />
                    </div>
                  )}

                  {user?.role === 'school_admin' && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Assign to Schools</label>
                      <Select
                        isMulti
                        options={[{ _id: 'ALL', name: 'ALL SCHOOLS' }, ...schools].map(s => ({ value: s._id, label: s.name }))}
                        value={formData.schoolIds?.map(id => {
                          const s = [{ _id: 'ALL', name: 'ALL SCHOOLS' }, ...schools].find(sch => sch._id === id);
                          return { value: id, label: s?.name || id };
                        })}
                        onChange={sels => setFormData({ ...formData, schoolIds: sels ? sels.map(s => s.value) : [] })}
                        className="modern-select"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Max Capacity</label>
                    <input
                      type="number"
                      value={formData.capacity}
                      onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) || 30 })}
                      className="w-full"
                      min="1"
                    />
                  </div>

                  <div className="flex items-center gap-6 pt-4">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div
                        className={`w-10 h-6 rounded-full transition-colors relative ${formData.isPrivate ? 'bg-indigo-600' : 'bg-slate-300'}`}
                        onClick={() => setFormData({ ...formData, isPrivate: !formData.isPrivate })}
                      >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.isPrivate ? 'translate-x-4' : ''}`} />
                      </div>
                      <span className="text-sm font-bold text-slate-700 uppercase">Private</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div
                        className={`w-10 h-6 rounded-full transition-colors relative ${formData.isPaid ? 'bg-indigo-600' : 'bg-slate-300'}`}
                        onClick={() => setFormData({ ...formData, isPaid: !formData.isPaid })}
                      >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.isPaid ? 'translate-x-4' : ''}`} />
                      </div>
                      <span className="text-sm font-bold text-slate-700 uppercase">Paid Class</span>
                    </label>
                  </div>
                </div>

                {/* Pricing details if paid */}
                {formData.isPaid && (
                  <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 animate-slide-up">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-primary uppercase tracking-wider">Billing Cycle</label>
                        <Select
                          options={[
                            { value: 'per_lecture', label: 'Per Lecture' },
                            { value: 'per_topic', label: 'Per Topic' },
                            { value: 'weekly', label: 'Weekly' },
                            { value: 'monthly', label: 'Monthly' }
                          ]}
                          value={{ value: formData.pricing.type, label: formData.pricing.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) }}
                          onChange={sel => setFormData({ ...formData, pricing: { ...formData.pricing, type: sel?.value } })}
                          className="modern-select"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-primary uppercase tracking-wider">Amount (NGN)</label>
                        <input
                          type="number"
                          value={formData.pricing.amount}
                          onChange={e => setFormData({ ...formData, pricing: { ...formData.pricing, amount: parseFloat(e.target.value) || 0 } })}
                          className="w-full border-primary/20 focus:ring-primary/20"
                          placeholder="0.00"
                          required={formData.isPaid}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Schedule Builder */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Weekly Schedule</label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, schedule: [...formData.schedule, { dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00' }] })}
                      className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Session
                    </button>
                  </div>

                  <div className="space-y-3">
                    {formData.schedule.map((s, idx) => (
                      <div key={idx} className="flex flex-wrap md:flex-nowrap items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 animate-slide-up">
                        <select
                          value={s.dayOfWeek}
                          onChange={e => {
                            const newSched = [...formData.schedule];
                            newSched[idx].dayOfWeek = e.target.value;
                            setFormData({ ...formData, schedule: newSched });
                          }}
                          className="flex-1 min-w-[120px] bg-white border-slate-200 rounded-lg text-sm"
                        >
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => <option key={d}>{d}</option>)}
                        </select>
                        <input
                          type="time"
                          value={s.startTime}
                          onChange={e => {
                            const newSched = [...formData.schedule];
                            newSched[idx].startTime = e.target.value;
                            setFormData({ ...formData, schedule: newSched });
                          }}
                          className="w-32 bg-white border-slate-200 rounded-lg text-sm"
                        />
                        <span className="text-slate-400">to</span>
                        <input
                          type="time"
                          value={s.endTime}
                          onChange={e => {
                            const newSched = [...formData.schedule];
                            newSched[idx].endTime = e.target.value;
                            setFormData({ ...formData, schedule: newSched });
                          }}
                          className="w-32 bg-white border-slate-200 rounded-lg text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newSched = formData.schedule.filter((_, i) => i !== idx);
                            setFormData({ ...formData, schedule: newSched });
                          }}
                          className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {formData.schedule.length === 0 && (
                      <p className="text-sm text-slate-400 italic text-center py-4">No sessions scheduled yet.</p>
                    )}
                  </div>
                </div>

                <div className="pt-8 flex gap-4 sticky bottom-0 bg-white pb-2 border-t border-slate-50">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition">Discard</button>
                  <button type="submit" className="btn-premium flex-1">Launch Classroom</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Classrooms;
