import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
  Plus, Calendar, Users, User, Book, Video, Edit, Eye,
  EyeOff, Search, Trash2, Loader2, ChevronDown,
  ChevronRight, Clock, School, ArrowRight, Layers,
  Filter, Sparkles, X, DollarSign
} from 'lucide-react';
import { convertLocalToUTC, convertUTCToLocal } from '../utils/timezone';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatAmount } from '../utils/currency';
import FormFieldHelp from '../components/FormFieldHelp';

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
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <span className="text-[10px] font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-full uppercase tracking-widest">{count} Total</span>
    </div>
    <div className="h-px flex-1 bg-border mx-6 hidden md:block" />
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
  const [selectedLevel, setSelectedLevel] = useState('All Levels');
  const [selectedPrice, setSelectedPrice] = useState('All Prices');

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
      filtered = filtered.filter(c => (c.subject?.name || c.subject) === selectedSubject);
    }

    if (selectedLevel !== 'All Levels') {
      filtered = filtered.filter(c => c.level === selectedLevel);
    }

    if (selectedPrice === 'Free') {
      filtered = filtered.filter(c => !c.isPaid);
    } else if (selectedPrice === 'Paid') {
      filtered = filtered.filter(c => c.isPaid);
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
  }, [searchQuery, selectedSubject, selectedLevel, selectedPrice, classrooms]);

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
      <div key={classroom._id} className="card-premium flex flex-col group overflow-hidden bg-card border border-border shadow-lg transition-all duration-300 hover:shadow-2xl hover:border-primary/20">
        <div className="relative h-2 bg-gradient-to-r from-primary/40 to-primary/5" />
        <div className="p-6 flex flex-col h-full">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-black italic text-foreground tracking-tight truncate group-hover:text-primary transition-colors pr-2 pb-1">{classroom.name}</h3>
                {isNew && <span className="bg-amber-500/10 text-amber-500 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest border border-amber-500/20">New</span>}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-black uppercase tracking-widest italic">
                <User className="w-3 h-3 text-primary" />
                <span>{classroom.teacherId?.name || 'TBA'}</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {classroom.isPaid ? (
                <div className="text-right">
                  <div className="text-sm font-black text-foreground italic">{formatAmount(classroom.pricing?.amount || 0, classroom.pricing?.currency || 'NGN')}</div>
                  <div className="text-[9px] font-black text-primary uppercase tracking-widest opacity-70">{(classroom.pricing?.type || 'Lecture').replace('_', ' ')}</div>
                </div>
              ) : (
                <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">Free</span>
              )}
            </div>
          </div>

          <div className="space-y-3 mb-6 flex-1">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              <Layers className="w-4 h-4 text-primary/40" />
              <span>Level:</span>
              <span className="text-foreground">{classroom.level || 'Other'}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              <Calendar className="w-4 h-4 text-primary/40" />
              <span>Schedule:</span>
              <span className="text-foreground truncate italic">{classroom.schedule?.[0]?.dayOfWeek || 'TBA'} {classroom.schedule?.[0]?.startTime || ''}</span>
            </div>
            {isAdmin && (
              <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <Users className="w-3.5 h-3.5 text-primary" /> {classroom.students?.length || 0} Enrolled
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handlePublishToggle(classroom._id, classroom.published)} className={`p-1.5 rounded-lg transition ${classroom.published ? 'text-emerald-500 bg-emerald-500/10' : 'text-muted-foreground bg-muted'}`}>
                    {publishingClassId === classroom._id ? <Loader2 className="w-4 h-4 animate-spin" /> : (classroom.published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />)}
                  </button>
                  {(user?.role === 'root_admin' || user?.role === 'school_admin' || user?._id === classroom.teacherId?._id) && (
                    <button onClick={(e) => handleDeleteClick(classroom._id, e)} className="p-1.5 rounded-lg text-rose-500 bg-rose-500/10 hover:bg-rose-500 hover:text-white transition-all">
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

  if (loading) return <Layout><div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div></Layout>;

  return (
    <Layout>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 card-premium p-6 shadow-sm">
          <div>
            <h1 className="text-3xl font-black italic text-foreground tracking-tight flex items-center gap-3">
              Explore Academies <Sparkles className="w-6 h-6 text-amber-500" />
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground mt-1">Discover and manage elite educational modules.</p>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
          <div className="relative group w-full lg:col-span-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Filter by title, subject, teacher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 bg-card border-2 border-border h-12 shadow-sm focus:shadow-lg focus:border-primary transition-all outline-none rounded-2xl font-bold italic"
            />
          </div>
          
          <div className="w-full">
            <Select
              options={[{ value: 'All Subjects', label: 'All Subjects' }, ...subjectOptions]}
              value={{ value: selectedSubject, label: selectedSubject }}
              onChange={(sel) => setSelectedSubject(sel?.value || 'All Subjects')}
              className="modern-select"
              classNamePrefix="react-select"
              styles={{ 
                control: (base) => ({ 
                  ...base, 
                  height: '48px', 
                  borderRadius: '1rem', 
                  backgroundColor: 'var(--bg-card)', 
                  borderColor: 'var(--border-border)', 
                  borderWidth: '2px',
                  fontWeight: '700',
                  '&:hover': { borderColor: 'var(--primary)' }
                }),
                menu: (base) => ({ ...base, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-border)' }),
                option: (base, state) => ({ 
                  ...base, 
                  backgroundColor: state.isFocused ? 'var(--bg-muted)' : 'var(--bg-card)',
                  color: 'var(--text-foreground)',
                  fontWeight: '700'
                }),
                singleValue: (base) => ({ ...base, color: 'var(--text-foreground)' })
              }}
              components={{ DropdownIndicator: () => <Filter className="w-4 h-4 text-muted-foreground mr-4" />, IndicatorSeparator: () => null }}
            />
          </div>

          <div className="w-full">
            <Select
              options={[{ value: 'All Levels', label: 'All Levels' }, ...levelOptions]}
              value={{ value: selectedLevel, label: selectedLevel }}
              onChange={(sel) => setSelectedLevel(sel?.value || 'All Levels')}
              className="modern-select"
              classNamePrefix="react-select"
              styles={{ 
                control: (base) => ({ 
                  ...base, 
                  height: '48px', 
                  borderRadius: '1rem', 
                  backgroundColor: 'var(--bg-card)', 
                  borderColor: 'var(--border-border)', 
                  borderWidth: '2px',
                  fontWeight: '700',
                  '&:hover': { borderColor: 'var(--primary)' }
                }),
                menu: (base) => ({ ...base, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-border)' }),
                option: (base, state) => ({ 
                  ...base, 
                  backgroundColor: state.isFocused ? 'var(--bg-muted)' : 'var(--bg-card)',
                  color: 'var(--text-foreground)',
                  fontWeight: '700'
                }),
                singleValue: (base) => ({ ...base, color: 'var(--text-foreground)' })
              }}
              components={{ DropdownIndicator: () => <Layers className="w-4 h-4 text-muted-foreground mr-4" />, IndicatorSeparator: () => null }}
            />
          </div>

          <div className="w-full">
            <Select
              options={[
                { value: 'All Prices', label: 'All Prices' },
                { value: 'Free', label: 'Free Classes' },
                { value: 'Paid', label: 'Paid Classes' }
              ]}
              value={{ value: selectedPrice, label: selectedPrice }}
              onChange={(sel) => setSelectedPrice(sel?.value || 'All Prices')}
              className="modern-select"
              classNamePrefix="react-select"
              styles={{ 
                control: (base) => ({ 
                  ...base, 
                  height: '48px', 
                  borderRadius: '1rem', 
                  backgroundColor: 'var(--bg-card)', 
                  borderColor: 'var(--border-border)', 
                  borderWidth: '2px',
                  fontWeight: '700',
                  '&:hover': { borderColor: 'var(--primary)' }
                }),
                menu: (base) => ({ ...base, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-border)' }),
                option: (base, state) => ({ 
                  ...base, 
                  backgroundColor: state.isFocused ? 'var(--bg-muted)' : 'var(--bg-card)',
                  color: 'var(--text-foreground)',
                  fontWeight: '700'
                }),
                singleValue: (base) => ({ ...base, color: 'var(--text-foreground)' })
              }}
              components={{ DropdownIndicator: () => <DollarSign className="w-4 h-4 text-muted-foreground mr-4" />, IndicatorSeparator: () => null }}
            />
          </div>
        </div>

        <div className="space-y-10">
          {user?.role === 'student' && user?.schoolId?.length > 0 ? (
            <>
              <SectionHeader title="Your Facilities" count={classrooms.filter(isMySchoolClass).length} icon={School} />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up">
                {classrooms.filter(isMySchoolClass).map(renderClassroomCard)}
              </div>

              {classrooms.filter(c => !isMySchoolClass(c)).length > 0 && (
                <>
                  <div className="pt-12 mb-8 border-t border-border/10">
                    <SectionHeader title="Global Classrooms" count={classrooms.filter(c => !isMySchoolClass(c)).length} icon={Sparkles} />
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
            <div className="flex flex-col items-center justify-center py-20 text-center card-premium border-dashed">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
                <Search className="w-10 h-10 text-muted-foreground/30" />
              </div>
              <h3 className="text-xl font-bold text-foreground">No classes matches your search</h3>
              <p className="text-muted-foreground mt-2">Try adjusting your filters or search keywords.</p>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xl z-[100] overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-6">
            <div className="bg-card border border-border rounded-[3rem] w-full max-w-2xl p-10 shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black italic tracking-tighter text-foreground uppercase">Create <span className="text-primary not-italic">Classroom</span></h2>
                <button onClick={() => setShowCreateModal(false)} className="p-3 hover:bg-muted rounded-2xl transition text-muted-foreground/60"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleCreate} className="space-y-8 pb-4">
                {/* Basic Info */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Class Title</label>
                    <input
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Advanced Quantum Mechanics"
                      className="w-full bg-muted/50 border-2 border-border p-4 rounded-2xl font-bold text-foreground focus:border-primary transition-all outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1 flex items-center">
                      Grade Level
                      <FormFieldHelp content="The grade or difficulty level of this class." />
                    </label>
                    <Select
                      options={levelOptions}
                      value={levelOptions.find(opt => opt.value === formData.level)}
                      onChange={sel => setFormData({ ...formData, level: sel?.value })}
                      classNamePrefix="react-select"
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
                        menu: base => ({ ...base, backgroundColor: 'var(--bg-card)', zIndex: 9999 })
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1 flex items-center">
                      Subject Matter
                      <FormFieldHelp content="Categorize your class for better discoverability in the marketplace." />
                    </label>
                    <CreatableSelect
                      options={subjectOptions}
                      value={formData.subject ? { value: formData.subject, label: formData.subject } : null}
                      onChange={sel => setFormData({ ...formData, subject: sel?.value || '' })}
                      classNamePrefix="react-select"
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
                         menu: base => ({ ...base, backgroundColor: 'var(--bg-card)', zIndex: 9999 })
                      }}
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Tell students what this class is about..."
                      className="w-full min-h-[100px] bg-muted/50 border-2 border-border p-4 rounded-2xl font-medium text-foreground focus:border-primary transition-all outline-none italic"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Learning Outcomes</label>
                    <textarea
                      value={formData.learningOutcomes}
                      onChange={e => setFormData({ ...formData, learningOutcomes: e.target.value })}
                      placeholder="What will students learn? (comma separated)..."
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
                        options={teachers.map(t => ({ value: t._id, label: `${t.name} (${t.email})` }))}
                        value={teachers.find(t => t._id === formData.teacherId) ? { value: formData.teacherId, label: teachers.find(t => t._id === formData.teacherId).name } : null}
                        onChange={sel => setFormData({ ...formData, teacherId: sel?.value })}
                        placeholder="Select a teacher..."
                        classNamePrefix="react-select"
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
                          menu: base => ({ ...base, backgroundColor: 'var(--bg-card)', zIndex: 9999 })
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
                        value={formData.schoolIds?.map(id => {
                          const s = [{ _id: 'ALL', name: 'ALL SCHOOLS' }, ...schools].find(sch => sch._id === id);
                          return { value: id, label: s?.name || id };
                        })}
                        onChange={sels => setFormData({ ...formData, schoolIds: sels ? sels.map(s => s.value) : [] })}
                        classNamePrefix="react-select"
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
                          multiValue: (base) => ({ ...base, backgroundColor: 'var(--bg-muted)' }),
                          multiValueLabel: (base) => ({ ...base, color: 'var(--text-foreground)' }),
                          menu: base => ({ ...base, backgroundColor: 'var(--bg-card)', zIndex: 9999 })
                        }}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 md:col-span-2">
                    {/* Max Capacity */}
                    <div className="space-y-2">
                       <div className="flex items-center gap-1">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Billet Limit</span>
                        <FormFieldHelp content="The maximum number of students allowed to enroll in this class." />
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          value={formData.capacity}
                          onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) || 30 })}
                          onWheel={(e) => e.target.blur()}
                          className="w-full pl-4 pr-4 py-3 bg-card border-2 border-border rounded-2xl focus:border-primary transition-all outline-none font-bold text-foreground"
                          min="1"
                          placeholder="30"
                        />
                      </div>
                    </div>

                    {/* Private Toggle */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none">Access Channel</span>
                        <FormFieldHelp content="Private classes won't appear in the global marketplace. Only students with a direct link can enroll." />
                      </div>
                      <label 
                        onClick={() => setFormData({ ...formData, isPrivate: !formData.isPrivate })}
                        className={`flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all cursor-pointer group min-h-[64px] ${formData.isPrivate ? 'border-primary bg-primary/5' : 'border-border bg-card/50 hover:border-border/80'}`}
                      >
                        <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${formData.isPrivate ? 'text-primary' : 'text-muted-foreground'}`}>Private</span>
                        <div className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${formData.isPrivate ? 'bg-primary' : 'bg-muted'}`}>
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.isPrivate ? 'translate-x-4' : ''}`} />
                        </div>
                      </label>
                    </div>

                    {/* Paid Toggle */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none">Monetization</span>
                        <FormFieldHelp content="If enabled, students must pay the specified fee to access content or join lectures." />
                      </div>
                      <label 
                        onClick={() => setFormData({ ...formData, isPaid: !formData.isPaid })}
                        className={`flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all cursor-pointer group min-h-[64px] ${formData.isPaid ? 'border-primary bg-primary/5' : 'border-border bg-card/50 hover:border-border/80'}`}
                      >
                        <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${formData.isPaid ? 'text-primary' : 'text-muted-foreground'}`}>Premium</span>
                        <div className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${formData.isPaid ? 'bg-primary' : 'bg-muted'}`}>
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.isPaid ? 'translate-x-4' : ''}`} />
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Pricing details if paid */}
                 {formData.isPaid && (
                   <div className="p-6 rounded-[2rem] bg-primary/10 border border-primary/20 animate-in fade-in duration-300">
                     <div className="grid md:grid-cols-2 gap-6">
                       <div className="space-y-1.5">
                         <label className="text-[10px] font-black uppercase text-primary tracking-widest px-1 flex items-center">
                           Billing Protocol
                           <FormFieldHelp content="Defines when students are charged: Weekly (every 7 days), Per Lecture (on join), or One Time (enrolment only)." />
                         </label>
                         <Select
                           options={[
                             { value: 'per_lecture', label: 'Per Lecture' },
                             { value: 'per_topic', label: 'Per Topic' },
                             { value: 'weekly', label: 'Weekly' },
                             { value: 'monthly', label: 'Monthly' },
                             { value: 'one_time', label: 'One Time Purchase' }
                           ]}
                           value={{ value: formData.pricing.type, label: formData.pricing.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) }}
                           onChange={sel => setFormData({ ...formData, pricing: { ...formData.pricing, type: sel?.value } })}
                           menuPortalTarget={document.body}
                           styles={{
                             control: (base) => ({
                               ...base,
                               minHeight: '60px',
                               borderRadius: '1rem',
                               borderWidth: '2px',
                               borderColor: 'var(--border-border)',
                               backgroundColor: 'var(--bg-muted)',
                               fontWeight: '700',
                               opacity: 0.8,
                               '&:hover': { borderColor: 'var(--primary)' }
                             }),
                             singleValue: (base) => ({ ...base, color: 'var(--text-foreground)' }),
                             menuPortal: base => ({ ...base, zIndex: 9999 })
                           }}
                         />
                       </div>
                       <div className="space-y-1.5">
                         <label className="text-[10px] font-black uppercase text-primary tracking-widest px-1 flex items-center">
                           Value ({import.meta.env.VITE_CURRENCY || 'NGN'})
                           <FormFieldHelp content="The fee students will pay based on the selected billing cycle." />
                         </label>
                         <input
                           type="number"
                           value={formData.pricing.amount}
                           onChange={e => setFormData({ ...formData, pricing: { ...formData.pricing, amount: parseFloat(e.target.value) || 0 } })}
                           onWheel={(e) => e.target.blur()}
                           className="w-full h-[60px] bg-muted/50 border-2 border-border rounded-2xl focus:border-primary focus:bg-card transition-all outline-none px-4 font-black text-foreground italic"
                           min="0"
                           placeholder="e.g. 5000"
                           required={formData.isPaid}
                         />
                       </div>
                     </div>
                   </div>
                 )}

                {/* Schedule Builder */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Temporal Logistics</label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, schedule: [...formData.schedule, { dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00' }] })}
                      className="text-[9px] font-black text-primary flex items-center gap-1 hover:bg-primary/10 px-2 py-1 rounded-lg transition-all uppercase tracking-widest border border-primary/20"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Schedule Slot
                    </button>
                  </div>

                  <div className="space-y-3">
                    {formData.schedule.map((s, idx) => (
                      <div key={idx} className="flex flex-wrap md:flex-nowrap items-center gap-3 p-4 bg-muted/30 rounded-2xl border border-border animate-in slide-in-from-right duration-300">
                        <select
                          value={s.dayOfWeek}
                          onChange={e => {
                            const newSched = [...formData.schedule];
                            newSched[idx].dayOfWeek = e.target.value;
                            setFormData({ ...formData, schedule: newSched });
                          }}
                          className="flex-1 min-w-[120px] bg-card border-none rounded-xl text-xs font-black uppercase tracking-widest focus:ring-0"
                        >
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => <option key={d} className="bg-card">{d}</option>)}
                        </select>
                        <input
                          type="time"
                          value={s.startTime}
                          onChange={e => {
                            const newSched = [...formData.schedule];
                            newSched[idx].startTime = e.target.value;
                            setFormData({ ...formData, schedule: newSched });
                          }}
                          className="w-32 bg-card border-none rounded-xl text-xs font-black uppercase tracking-widest focus:ring-0"
                        />
                        <span className="text-muted-foreground">to</span>
                        <input
                          type="time"
                          value={s.endTime}
                          onChange={e => {
                            const newSched = [...formData.schedule];
                            newSched[idx].endTime = e.target.value;
                            setFormData({ ...formData, schedule: newSched });
                          }}
                          className="w-32 bg-card border-none rounded-xl text-xs font-black uppercase tracking-widest focus:ring-0"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newSched = formData.schedule.filter((_, i) => i !== idx);
                            setFormData({ ...formData, schedule: newSched });
                          }}
                          className="p-2.5 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all border border-border/50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {formData.schedule.length === 0 && (
                      <p className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.2em] italic text-center py-8 bg-muted/20 rounded-2xl border border-dashed border-border/30">No operational windows scheduled yet.</p>
                    )}
                  </div>
                </div>

                <div className="pt-8 flex gap-4 sticky bottom-0 bg-card/90 backdrop-blur-md pb-2 border-t border-border mt-4">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 px-6 py-4 rounded-2xl border border-border font-black text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-muted transition">ABORT</button>
                  <button type="submit" className="btn-premium flex-1">ACTIVATE ACADEMY</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95 duration-300 text-center">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black italic text-foreground mb-2 uppercase tracking-tight">Decommission Module?</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-8">This action is irreversible. All data and active enrollments will be removed from the platform.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-6 py-4 rounded-2xl border border-border font-black text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-muted transition"
              >
                ABORT
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 px-6 py-4 rounded-2xl bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition"
              >
                PURGE
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Classrooms;
