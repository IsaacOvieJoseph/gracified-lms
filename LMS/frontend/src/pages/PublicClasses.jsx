import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
  Plus, Radio, Users, Globe, Search, Trash2, Loader2, ArrowRight,
  X, DollarSign, Check, Video,
  Eye, EyeOff, Link2, Clock, CalendarDays, ShieldCheck
} from 'lucide-react';
import { convertLocalToUTC } from '../utils/timezone';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatAmount } from '../utils/currency';
import FormFieldHelp from '../components/FormFieldHelp';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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

const formatLabel = (fmt) =>
  fmt === 'public_lecture' ? 'Public Lecture' : fmt === 'public_seminar' ? 'Public Seminar' : 'Class';

const PublicClasses = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [subjectOptions, setSubjectOptions] = useState(defaultSubjects.map(s => ({ value: s, label: s })));
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [selectedPrice, setSelectedPrice] = useState('all');
  const [liveMap, setLiveMap] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [schools, setSchools] = useState([]);
  const [publishingClassId, setPublishingClassId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [classToDelete, setClassToDelete] = useState(null);

  const [formData, setFormData] = useState({
    name: '', description: '', learningOutcomes: '', subject: '',
    level: 'Other', schedule: [], capacity: 100,
    pricing: { type: 'per_lecture', amount: 0 },
    isPaid: false, teacherId: '', schoolIds: [], published: true,
    isPrivate: false, classFormat: 'public_lecture',
    publicAccess: {
      allowGuestAccess: true,
      durationValue: 1,
      durationUnit: 'days',
      startsAt: '',
      recordingUrl: '',
      joinInstructions: ''
    }
  });
  const [selectedSchools, setSelectedSchools] = useState(() => {
    try { return JSON.parse(localStorage.getItem('selectedSchools')) || []; } catch { return []; }
  });

  const canCreate = ['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role);

  const customSelectStyles = {
    control: (base) => ({
      ...base,
      minHeight: '60px',
      borderRadius: '1rem',
      backgroundColor: 'hsl(var(--card))',
      borderColor: 'hsl(var(--border))',
      borderWidth: '2px',
      fontWeight: '700',
      boxShadow: 'none',
      '&:hover': { borderColor: 'hsl(var(--primary))' }
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? 'hsl(var(--primary))'
        : state.isFocused
        ? 'hsl(var(--primary) / 0.15)'
        : 'hsl(var(--card))',
      color: state.isSelected ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
      fontWeight: '700',
      cursor: 'pointer',
      ':active': { backgroundColor: 'hsl(var(--primary) / 0.2)' }
    }),
    singleValue: (base) => ({ ...base, color: 'hsl(var(--foreground))' }),
    menu: (base) => ({
      ...base,
      backgroundColor: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border))',
      borderRadius: '1rem',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      zIndex: 9999
    }),
    multiValue: (base) => ({ ...base, backgroundColor: 'hsl(var(--muted))' }),
    multiValueLabel: (base) => ({ ...base, color: 'hsl(var(--foreground))', fontWeight: '600' }),
    multiValueRemove: (base) => ({
      ...base,
      color: 'hsl(var(--muted-foreground))',
      ':hover': { backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }
    }),
    menuPortal: (base) => ({ ...base, zIndex: 99999 })
  };

  const filterSelectStyles = {
    ...customSelectStyles,
    control: (base) => ({ ...customSelectStyles.control(base), minHeight: '48px', height: '48px' })
  };

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
    fetchPublicClasses();
    if (['root_admin', 'school_admin'].includes(user?.role)) fetchTeachers();

    const handler = () => {
      try { setSelectedSchools(JSON.parse(localStorage.getItem('selectedSchools')) || []); } catch { }
      fetchPublicClasses();
    };
    window.addEventListener('schoolSelectionChanged', handler);
    return () => window.removeEventListener('schoolSelectionChanged', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchLiveMap = async () => {
    try {
      const response = await fetch(`${API_URL}/classrooms/catalog?limit=100`);
      const data = await response.json();
      const map = {};
      (data.classrooms || []).forEach(c => {
        if (c.isLive) map[c._id] = true;
      });
      setLiveMap(map);
    } catch (err) { /* live status is best-effort */ }
  };

  const fetchPublicClasses = async () => {
    if (classes.length === 0) setLoading(true);
    try {
      const response = await api.get('/classrooms');
      let list = response.data.classrooms || [];
      list = list.filter(c => ['public_lecture', 'public_seminar'].includes(c.classFormat));
      if (user?.role === 'student') list = list.filter(c => c.published);
      setClasses(list);
      setFiltered(list);
      fetchLiveMap();
    } catch (error) {
      console.error('Error fetching public classes:', error);
      toast.error(error?.response?.data?.message || error?.message || 'Failed to load public classes');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const response = await api.get('/users?role=teacher,personal_teacher');
      setTeachers(response.data.users.filter(u => ['teacher', 'personal_teacher'].includes(u.role)));
    } catch (error) { }
  };

  useEffect(() => {
    if (user?.role === 'school_admin') {
      api.get('/schools?adminId=' + user._id).then(res => setSchools(res.data.schools || []));
    } else if (user?.role === 'root_admin') {
      api.get('/schools').then(res => setSchools(res.data.schools || []));
    }
  }, [user]);

  useEffect(() => {
    let list = [...classes];
    if (selectedFormat !== 'all') list = list.filter(c => c.classFormat === selectedFormat);
    if (selectedPrice === 'free') list = list.filter(c => !c.isPaid);
    else if (selectedPrice === 'paid') list = list.filter(c => c.isPaid);
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.subject?.toLowerCase().includes(q) ||
        c.teacherId?.name?.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [searchQuery, selectedFormat, selectedPrice, classes]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      if (['root_admin', 'school_admin'].includes(user?.role) && !formData.teacherId) {
        setIsCreating(false);
        return toast.error('Please assign a teacher to the public class.');
      }

      const submitData = {
        ...formData,
        isPrivate: false,
        isPaid: formData.isPaid && formData.pricing?.amount > 0,
        publicAccess: {
          ...formData.publicAccess,
          allowGuestAccess: true,
          endsAt: formData.publicAccess.startsAt
            ? new Date(new Date(formData.publicAccess.startsAt).getTime() + Number(formData.publicAccess.durationValue || 1) * (formData.publicAccess.durationUnit === 'weeks' ? 7 : 1) * 24 * 60 * 60 * 1000).toISOString()
            : null
        },
        schedule: formData.schedule.map(s => {
          const utc = convertLocalToUTC(s.dayOfWeek, s.startTime);
          const utcEnd = convertLocalToUTC(s.dayOfWeek, s.endTime);
          return { dayOfWeek: utc.dayOfWeek, startTime: utc.time, endTime: utcEnd.time };
        })
      };

      if (['school_admin', 'root_admin'].includes(user?.role)) {
        const sel = formData.schoolIds?.includes('ALL') ? schools.map(s => s._id) : formData.schoolIds;
        if (user?.role === 'school_admin' && (!sel || sel.length === 0)) {
          setIsCreating(false);
          return toast.error('Select at least one school');
        }
        submitData.schoolId = sel || [];
        delete submitData.schoolIds;
      } else {
        delete submitData.schoolIds;
      }

      if (user?.role === 'teacher' || user?.role === 'personal_teacher') delete submitData.teacherId;

      await api.post('/classrooms', submitData);
      setShowCreateModal(false);
      fetchPublicClasses();
      toast.success(formData.classFormat === 'public_lecture' ? 'Public lecture created' : 'Public seminar created');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error creating public class');
    } finally {
      setIsCreating(false);
    }
  };

  const handlePublishToggle = async (id, status) => {
    setPublishingClassId(id);
    try {
      await api.put(`/classrooms/${id}/publish`, { published: !status });
      fetchPublicClasses();
    } catch (error) {
      toast.error('Error updating status');
    } finally {
      setPublishingClassId(null);
    }
  };

  const handleDeleteClick = (id, e) => { e.preventDefault(); setClassToDelete(id); setShowDeleteModal(true); };

  const confirmDelete = async () => {
    try {
      await api.delete(`/classrooms/${classToDelete}`);
      toast.success('Deleted');
      fetchPublicClasses();
      setShowDeleteModal(false);
    } catch (error) { toast.error('Error deleting'); }
  };

  const getGuestLink = (c) => {
    const base = window.location.origin;
    return `${base}/c/${c.slug || c.shortCode || c._id}`;
  };

  const copyGuestLink = async (c) => {
    const link = getGuestLink(c);
    try {
      await navigator.clipboard.writeText(link);
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedId(c._id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Public link copied');
  };

  const isWithinAccessWindow = (c) => {
    const startsAt = c.publicAccess?.startsAt ? new Date(c.publicAccess.startsAt) : null;
    const endsAt = c.publicAccess?.endsAt ? new Date(c.publicAccess.endsAt) : null;
    if (startsAt && endsAt) {
      const now = new Date();
      return now >= startsAt && now <= endsAt;
    }
    return null;
  };

  const formatDate = (val) => {
    if (!val) return '—';
    try {
      return new Date(val).toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
      });
    } catch { return '—'; }
  };

  const renderCard = (c) => {
    const isLive = !!liveMap[c._id];
    const inWindow = isWithinAccessWindow(c);
    const hasRecording = !!c.publicAccess?.recordingUrl;
    const link = getGuestLink(c);

    return (
      <div key={c._id} className="card-premium flex flex-col group overflow-hidden bg-card border border-border shadow-lg transition-all duration-300 hover:shadow-2xl hover:border-primary/20">
        <div className="relative h-2 bg-gradient-to-r from-primary/40 to-primary/5" />
        <div className="p-6 flex flex-col h-full">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-xl font-black italic text-foreground tracking-tight truncate group-hover:text-primary transition-colors">{c.name}</h3>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest border border-primary/20 flex items-center gap-1">
                  <Radio className="w-3 h-3" /> {formatLabel(c.classFormat)}
                </span>
                {isLive && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" /> Live Now
                  </span>
                )}
                {!isLive && hasRecording && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-500 text-[9px] font-black uppercase tracking-widest border border-sky-500/20 flex items-center gap-1">
                    <Video className="w-3 h-3" /> Recording
                  </span>
                )}
                {inWindow === false && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-500 text-[9px] font-black uppercase tracking-widest border border-amber-500/20 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Window Closed
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-black uppercase tracking-widest italic">
                <Users className="w-3 h-3 text-primary" />
                <span>{c.teacherId?.name || 'TBA'}</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {c.isPaid ? (
                <div className="text-right">
                  <div className="text-sm font-black text-foreground italic">{formatAmount(c.pricing?.amount || 0, c.pricing?.currency || 'NGN')}</div>
                  <div className="text-[9px] font-black text-primary uppercase tracking-widest opacity-70">Access Fee</div>
                </div>
              ) : (
                <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">Free</span>
              )}
            </div>
          </div>

          <p className="text-[11px] font-medium text-muted-foreground leading-relaxed mb-4 line-clamp-2">
            {c.description || 'Join this public session — no account needed.'}
          </p>

          <div className="space-y-2.5 mb-5 flex-1">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5 text-primary/40" />
              <span>Access Window:</span>
              <span className="text-foreground normal-case font-bold">{formatDate(c.publicAccess?.startsAt)} → {formatDate(c.publicAccess?.endsAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <Link2 className="w-3.5 h-3.5 text-primary/40" />
              <span>Guest Access:</span>
              <span className={c.publicAccess?.allowGuestAccess ? 'text-emerald-500 font-black' : 'text-rose-500 font-black'}>
                {c.publicAccess?.allowGuestAccess ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            {!c.published && (
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Not published — public link is inactive</span>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2">
              <button
                onClick={() => copyGuestLink(c)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 transition-all"
              >
                {copiedId === c._id ? <Check className="w-4 h-4 text-emerald-500" /> : <Link2 className="w-4 h-4" />}
                {copiedId === c._id ? 'Copied!' : 'Copy Public Link'}
              </button>
              <button
                onClick={() => handlePublishToggle(c._id, c.published)}
                className={`p-2.5 rounded-xl transition border ${c.published ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-muted-foreground bg-muted border-border'}`}
                title={c.published ? 'Unpublish' : 'Publish'}
              >
                {publishingClassId === c._id ? <Loader2 className="w-4 h-4 animate-spin" /> : (c.published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />)}
              </button>
              <button
                onClick={(e) => handleDeleteClick(c._id, e)}
                className="p-2.5 rounded-xl text-rose-500 bg-rose-500/10 hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <Link to={`/classrooms/${c._id}`} className="btn-premium w-full group/btn">
              <span>Manage Class</span>
              <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </Link>
            <p className="text-center text-[9px] text-muted-foreground/50 font-medium break-all px-1">{link}</p>
          </div>
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
              Public Classes <Radio className="w-6 h-6 text-primary" />
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground mt-1">
              Public lectures & seminars open to guests — no account needed to join.
            </p>
          </div>
          {canCreate && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-premium whitespace-nowrap"
            >
              <Plus className="w-5 h-5" /> Create Public Class
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
          <div className="relative group w-full lg:col-span-2">
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
              options={[
                { value: 'all', label: 'All Formats' },
                { value: 'public_lecture', label: 'Public Lecture' },
                { value: 'public_seminar', label: 'Public Seminar' }
              ]}
              value={{ value: selectedFormat, label: selectedFormat === 'all' ? 'All Formats' : formatLabel(selectedFormat) }}
              onChange={(sel) => setSelectedFormat(sel?.value || 'all')}
              className="modern-select"
              classNamePrefix="react-select"
              menuPortalTarget={document.body}
              styles={filterSelectStyles}
              components={{ DropdownIndicator: () => <Radio className="w-4 h-4 text-muted-foreground mr-4" />, IndicatorSeparator: () => null }}
            />
          </div>

          <div className="w-full">
            <Select
              options={[
                { value: 'all', label: 'All Prices' },
                { value: 'free', label: 'Free Classes' },
                { value: 'paid', label: 'Paid Classes' }
              ]}
              value={{ value: selectedPrice, label: selectedPrice === 'all' ? 'All Prices' : selectedPrice === 'free' ? 'Free Classes' : 'Paid Classes' }}
              onChange={(sel) => setSelectedPrice(sel?.value || 'all')}
              className="modern-select"
              classNamePrefix="react-select"
              menuPortalTarget={document.body}
              styles={filterSelectStyles}
              components={{ DropdownIndicator: () => <DollarSign className="w-4 h-4 text-muted-foreground mr-4" />, IndicatorSeparator: () => null }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up">
          {filtered.map(renderCard)}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center card-premium border-dashed">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
              <Radio className="w-10 h-10 text-muted-foreground/30" />
            </div>
            <h3 className="text-xl font-bold text-foreground">No public classes yet</h3>
            <p className="text-muted-foreground mt-2">Create a public lecture or seminar and share its link — anyone can join as a guest.</p>
            {canCreate && (
              <button onClick={() => setShowCreateModal(true)} className="btn-premium mt-6">
                <Plus className="w-5 h-5" /> Create Public Class
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create Public Class Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xl z-[100] overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-6">
            <div className="bg-card border border-border rounded-[3rem] w-full max-w-2xl p-10 shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black italic tracking-tighter text-foreground uppercase">
                  Create <span className="text-primary not-italic">Public Class</span>
                </h2>
                <button onClick={() => setShowCreateModal(false)} className="p-3 hover:bg-muted rounded-2xl transition text-muted-foreground/60">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-8 pb-4">
                {/* Format */}
                <div className="p-6 rounded-[2rem] bg-muted/30 border border-border">
                  <div className="flex items-center gap-2 mb-4 px-1">
                    <Globe className="w-4 h-4 text-primary" />
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Delivery Format</label>
                    <FormFieldHelp content="Both formats are open to guests. Public Lectures are single-session talks; Public Seminars are open multi-session programs." />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { value: 'public_lecture', label: 'Public Lecture', desc: 'Guests join live or watch the recording', icon: Radio },
                      { value: 'public_seminar', label: 'Public Seminar', desc: 'Open multi-session guest seminar', icon: Users }
                    ].map(opt => (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => setFormData(prev => ({ ...prev, classFormat: opt.value }))}
                        className={`p-4 rounded-2xl border-2 text-left transition-all ${formData.classFormat === opt.value ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10' : 'border-border bg-card/50 hover:border-border/80'}`}
                      >
                        <opt.icon className={`w-5 h-5 mb-3 ${formData.classFormat === opt.value ? 'text-primary' : 'text-muted-foreground'}`} />
                        <p className={`text-[10px] font-black uppercase tracking-widest ${formData.classFormat === opt.value ? 'text-primary' : 'text-foreground'}`}>{opt.label}</p>
                        <p className="text-[9px] text-muted-foreground font-medium mt-1 leading-relaxed">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Basic Info */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Class Title</label>
                    <input
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. The Future of AI in Education"
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
                      className="modern-select"
                      classNamePrefix="react-select"
                      menuPortalTarget={document.body}
                      styles={customSelectStyles}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1 flex items-center">
                      Subject Matter
                      <FormFieldHelp content="Categorize your class for better discoverability in the public catalog." />
                    </label>
                    <CreatableSelect
                      options={subjectOptions}
                      value={formData.subject ? { value: formData.subject, label: formData.subject } : null}
                      onChange={sel => setFormData({ ...formData, subject: sel?.value || '' })}
                      className="modern-select"
                      classNamePrefix="react-select"
                      menuPortalTarget={document.body}
                      styles={customSelectStyles}
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Tell guests what this public class is about..."
                      className="w-full min-h-[100px] bg-muted/50 border-2 border-border p-4 rounded-2xl font-medium text-foreground focus:border-primary transition-all outline-none italic"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Learning Outcomes</label>
                    <textarea
                      value={formData.learningOutcomes}
                      onChange={e => setFormData({ ...formData, learningOutcomes: e.target.value })}
                      placeholder="What will attendees learn? (comma separated)..."
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
                        className="modern-select"
                        classNamePrefix="react-select"
                        menuPortalTarget={document.body}
                        styles={customSelectStyles}
                      />
                    </div>
                  )}

                  {['school_admin', 'root_admin'].includes(user?.role) && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">
                        Assign to Schools {user?.role === 'root_admin' && '(Optional - leave blank for none)'}
                      </label>
                      <Select
                        isMulti
                        options={[{ _id: 'ALL', name: 'ALL SCHOOLS' }, ...schools].map(s => ({ value: s._id, label: s.name }))}
                        value={formData.schoolIds?.map(id => {
                          const s = [{ _id: 'ALL', name: 'ALL SCHOOLS' }, ...schools].find(sch => sch._id === id);
                          return { value: id, label: s?.name || id };
                        })}
                        onChange={sels => setFormData({ ...formData, schoolIds: sels ? sels.map(s => s.value) : [] })}
                        className="modern-select"
                        classNamePrefix="react-select"
                        menuPortalTarget={document.body}
                        styles={customSelectStyles}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 md:col-span-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Billet Limit</span>
                        <FormFieldHelp content="The maximum number of attendees allowed to join this public class." />
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          value={formData.capacity}
                          onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) || 100 })}
                          onWheel={(e) => e.target.blur()}
                          className="w-full pl-4 pr-4 py-3 bg-card border-2 border-border rounded-2xl focus:border-primary transition-all outline-none font-bold text-foreground"
                          min="1"
                          placeholder="100"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none">Visibility</span>
                        <FormFieldHelp content="Public classes are always visible via their public link and the catalog. This shows the publishing state." />
                      </div>
                      <div className="flex items-center justify-between px-4 py-3 rounded-2xl border-2 border-primary/30 bg-primary/5 min-h-[64px]">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Public</span>
                        <div className="w-10 h-6 rounded-full bg-primary relative shrink-0">
                          <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full translate-x-4" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none">Monetization</span>
                        <FormFieldHelp content="If enabled, guests must pay the specified fee to join the live session or watch the recording." />
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

                {/* Public Access */}
                <div className="p-6 rounded-[2rem] bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2 mb-4 px-1">
                    <Globe className="w-4 h-4 text-primary" />
                    <label className="text-[10px] font-black uppercase text-primary tracking-widest">Public Access</label>
                    <FormFieldHelp content="A public link is generated automatically when you save. Anyone with the link can join live or watch the recording — no account needed." />
                  </div>

                  <div className="flex items-center gap-2 px-4 py-3 rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 mb-5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500">
                      Guest access is always enabled for public classes
                      <span className="block text-[8px] font-medium normal-case tracking-normal opacity-60 mt-0.5">Visitors join with just a name and email — no account required</span>
                    </span>
                  </div>

                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1 flex items-center">
                        Starts At
                        <FormFieldHelp content="When the public access window opens. Guests can join live sessions from this time onward." />
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.publicAccess.startsAt}
                        onChange={e => setFormData(prev => ({ ...prev, publicAccess: { ...prev.publicAccess, startsAt: e.target.value } }))}
                        className="w-full bg-muted/50 border-2 border-border p-4 rounded-2xl font-bold text-foreground focus:border-primary transition-all outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1 flex items-center">
                        Access Duration
                        <FormFieldHelp content="How long the public access window stays open (days or weeks). The end date is computed automatically." />
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="number"
                          min="1"
                          value={formData.publicAccess.durationValue}
                          onChange={e => setFormData(prev => ({ ...prev, publicAccess: { ...prev.publicAccess, durationValue: parseInt(e.target.value) || 1 } }))}
                          className="w-24 bg-muted/50 border-2 border-border p-4 rounded-2xl font-bold text-foreground focus:border-primary transition-all outline-none"
                        />
                        <select
                          value={formData.publicAccess.durationUnit}
                          onChange={e => setFormData(prev => ({ ...prev, publicAccess: { ...prev.publicAccess, durationUnit: e.target.value } }))}
                          className="flex-1 bg-muted/50 border-2 border-border p-4 rounded-2xl font-bold text-foreground focus:border-primary transition-all outline-none"
                        >
                          <option value="days">Days</option>
                          <option value="weeks">Weeks</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 mt-5">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1 flex items-center">
                      Recording URL (Optional)
                      <FormFieldHelp content="Paste a YouTube/Vimeo link to the recorded session so guests can watch it after the live event." />
                    </label>
                    <input
                      type="url"
                      value={formData.publicAccess.recordingUrl}
                      onChange={e => setFormData(prev => ({ ...prev, publicAccess: { ...prev.publicAccess, recordingUrl: e.target.value } }))}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full bg-muted/50 border-2 border-border p-4 rounded-2xl font-bold text-foreground focus:border-primary transition-all outline-none"
                    />
                  </div>

                  <div className="space-y-1.5 mt-5">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Join Instructions (Optional)</label>
                    <textarea
                      value={formData.publicAccess.joinInstructions}
                      onChange={e => setFormData(prev => ({ ...prev, publicAccess: { ...prev.publicAccess, joinInstructions: e.target.value } }))}
                      placeholder="e.g. Have your laptop ready and join 5 minutes early."
                      className="w-full min-h-[80px] bg-muted/50 border-2 border-border p-4 rounded-2xl font-medium text-foreground focus:border-primary transition-all outline-none italic"
                    />
                  </div>
                </div>

                {/* Pricing details if paid */}
                {formData.isPaid && (
                  <div className="p-6 rounded-[2rem] bg-primary/10 border border-primary/20 animate-in fade-in duration-300">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-primary tracking-widest px-1 flex items-center">
                          Billing Protocol
                          <FormFieldHelp content="For public classes, guests are charged Per Lecture (on join) or One Time (full access)." />
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
                          <FormFieldHelp content="The fee guests will pay to access this public class." />
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
                          onClick={(e) => e.target.showPicker && e.target.showPicker()}
                          onChange={e => {
                            const newSched = [...formData.schedule];
                            newSched[idx].startTime = e.target.value;
                            setFormData({ ...formData, schedule: newSched });
                          }}
                          className="w-32 bg-card border-none rounded-xl text-xs font-black uppercase tracking-widest focus:ring-0 cursor-pointer"
                        />
                        <span className="text-muted-foreground">to</span>
                        <input
                          type="time"
                          value={s.endTime}
                          onClick={(e) => e.target.showPicker && e.target.showPicker()}
                          onChange={e => {
                            const newSched = [...formData.schedule];
                            newSched[idx].endTime = e.target.value;
                            setFormData({ ...formData, schedule: newSched });
                          }}
                          className="w-32 bg-card border-none rounded-xl text-xs font-black uppercase tracking-widest focus:ring-0 cursor-pointer"
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
                  <button type="submit" disabled={isCreating} className="btn-premium flex-1">
                    {isCreating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'CREATE PUBLIC CLASS'}
                  </button>
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
            <h3 className="text-xl font-black italic text-foreground mb-2 uppercase tracking-tight">Decommission Public Class?</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-8">This action is irreversible. All data and active attendees will be removed from the platform.</p>
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

export default PublicClasses;
