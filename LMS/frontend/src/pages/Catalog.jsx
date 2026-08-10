import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap, Radio, Users, Search, ArrowRight, Menu, X,
  Sparkles, Loader2, Clock, Video, CheckCircle2, Building2, Globe, CalendarDays,
  BookOpen, DollarSign
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import ThemeToggle from '../components/ThemeToggle';
import logo from '../assets/logo.jpg';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const formatLabel = (fmt) =>
  fmt === 'public_lecture' ? 'Public Lecture' : fmt === 'public_seminar' ? 'Public Seminar' : 'Class';

const Catalog = () => {
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedPrice, setSelectedPrice] = useState('all');

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const response = await axios.get(`${API_URL}/classrooms/catalog?limit=100`);
        setClassrooms(response.data.classrooms || []);
      } catch (err) {
        console.error('Error fetching catalog:', err);
        setError(err.response?.data?.message || 'Could not load the class catalog.');
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, []);

  const subjects = useMemo(() => {
    const set = new Set(classrooms.map(c => c.subject).filter(Boolean));
    return Array.from(set).sort();
  }, [classrooms]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return classrooms.filter(c => {
      if (selectedFormat !== 'all' && c.classFormat !== selectedFormat) return false;
      if (selectedSubject !== 'all' && c.subject !== selectedSubject) return false;
      if (selectedPrice === 'free' && c.isPaid) return false;
      if (selectedPrice === 'paid' && !c.isPaid) return false;
      if (q && !(
        (c.name || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q) ||
        (c.subject || '').toLowerCase().includes(q) ||
        (c.teacherId?.name || '').toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [classrooms, searchQuery, selectedFormat, selectedSubject, selectedPrice]);

  const getClassLink = (c) => `/c/${c.slug || c.shortCode || c._id}`;

  const renderClassroomCard = (c) => (
    <Link
      to={getClassLink(c)}
      key={c._id}
      className="group relative flex flex-col overflow-hidden rounded-3xl bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1"
    >
      <div className="relative h-36 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent blur-2xl scale-150" />
        <div className="relative flex flex-wrap items-center justify-center gap-2 px-4">
          <span className="px-3 py-1 rounded-full bg-card/90 text-primary text-[9px] font-black uppercase tracking-widest border border-primary/20 shadow-sm flex items-center gap-1.5">
            <Radio className="w-3 h-3" />
            {formatLabel(c.classFormat)}
          </span>
          {c.isLive && (
            <span className="px-3 py-1 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              Live Now
            </span>
          )}
          {!c.isLive && c.hasRecording && (
            <span className="px-3 py-1 rounded-full bg-sky-500 text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <Video className="w-3 h-3" />
              Recording
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col flex-1 p-5 space-y-3">
        <div>
          <h3 className="text-lg font-black text-foreground tracking-tight group-hover:text-primary transition-colors leading-snug">
            {c.name}
          </h3>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 mt-1 flex items-center gap-1.5">
            <GraduationCap className="w-3 h-3" />
            {c.teacherId?.name || 'Instructor'}
          </p>
        </div>

        <p className="text-sm text-muted-foreground font-medium leading-relaxed line-clamp-2 flex-1">
          {c.description || 'Join this public session — no account needed.'}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
          {c.subject && (
            <span className="px-2.5 py-1 bg-muted text-muted-foreground text-[9px] font-black uppercase tracking-widest rounded-lg border border-border">
              {c.subject}
            </span>
          )}
          {c.topicsCount > 0 && (
            <span className="px-2.5 py-1 bg-muted text-muted-foreground text-[9px] font-black uppercase tracking-widest rounded-lg border border-border">
              {c.topicsCount} {c.topicsCount === 1 ? 'Module' : 'Modules'}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-baseline gap-1.5">
            <span className={`text-xl font-black italic ${c.isPaid ? 'text-foreground' : 'text-emerald-500'}`}>
              {c.isPaid ? `₦${Number(c.pricing?.amount || 0).toLocaleString()}` : 'Free'}
            </span>
            {c.isPaid && (
              <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">Access Fee</span>
            )}
          </div>
          <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-primary">
            View <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </div>
    </Link>
  );

  return (
    <div className="min-h-screen bg-background font-inter overflow-x-hidden transition-colors duration-300 text-foreground">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-400/5 rounded-full blur-[120px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-20 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20 gap-4">
            <Link to="/" className="flex items-center gap-2 sm:gap-3 group min-w-0 flex-shrink">
              <img src={logo} alt="Gracified" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl shadow-lg flex-shrink-0" />
              <span className="font-outfit text-base sm:text-xl font-bold text-foreground">
                <span className="hidden sm:inline text-foreground">Gracified Learning Platform</span>
                <span className="sm:hidden text-foreground">Gracified</span>
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-3 flex-shrink-0">
              <ThemeToggle />
              <Link
                to="/catalog"
                className="px-4 py-2 text-primary font-bold hover:text-primary/80 transition-colors"
              >
                Explore Classes
              </Link>
              <Link
                to="/login"
                className="px-4 py-2 text-muted-foreground font-semibold hover:text-primary transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="btn-premium px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-slate-200/60 flex flex-col gap-2 animate-slide-up">
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400 font-semibold">Theme</span>
                <ThemeToggle />
              </div>
              <Link
                to="/catalog"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-3 text-primary font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Explore Classes
              </Link>
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-3 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="btn-premium px-5 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 pt-12 sm:pt-16 md:pt-20 pb-10 px-5 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-semibold mb-6 animate-slide-up">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            Public Lectures & Seminars
          </div>
          <h1 className="font-outfit text-3xl sm:text-5xl md:text-6xl font-black text-foreground tracking-tighter leading-[0.9] mb-5 animate-slide-up px-1 italic uppercase" style={{ animationDelay: '0.1s' }}>
            Learn from experts.
            <br />
            <span className="text-primary not-italic">No account needed.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground mb-6 animate-slide-up px-1" style={{ animationDelay: '0.2s' }}>
            Browse open lectures and seminars from independent educators and schools. Join live sessions or watch the recordings — all you need is your name and email.
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="relative z-10 pb-10 px-5 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div className="lg:col-span-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1 block mb-1.5 flex items-center gap-1.5">
                <Search className="w-3 h-3" /> Search Classes
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by title, subject, or instructor..."
                className="w-full bg-card border-2 border-border h-12 px-4 rounded-2xl font-bold italic outline-none focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1 block mb-1.5 flex items-center gap-1.5">
                <Radio className="w-3 h-3" /> Format
              </label>
              <select
                value={selectedFormat}
                onChange={e => setSelectedFormat(e.target.value)}
                className="w-full bg-card border-2 border-border h-12 px-3 rounded-2xl font-bold outline-none focus:border-primary transition-all"
              >
                <option value="all">All Formats</option>
                <option value="public_lecture">Public Lecture</option>
                <option value="public_seminar">Public Seminar</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1 block mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3 h-3" /> Subject
              </label>
              <select
                value={selectedSubject}
                onChange={e => setSelectedSubject(e.target.value)}
                className="w-full bg-card border-2 border-border h-12 px-3 rounded-2xl font-bold outline-none focus:border-primary transition-all"
              >
                <option value="all">All Subjects</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1 block mb-1.5 flex items-center gap-1.5">
                <DollarSign className="w-3 h-3" /> Price
              </label>
              <select
                value={selectedPrice}
                onChange={e => setSelectedPrice(e.target.value)}
                className="w-full bg-card border-2 border-border h-12 px-3 rounded-2xl font-bold outline-none focus:border-primary transition-all"
              >
                <option value="all">All Prices</option>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Catalog Grid */}
      <section className="relative z-10 pb-20 px-5 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <p className="text-sm font-semibold text-muted-foreground">Loading public classes...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mb-4">
                <X className="w-8 h-8" />
              </div>
              <p className="text-lg font-black text-foreground">{error}</p>
              <Link to="/" className="mt-4 text-primary font-semibold text-sm hover:underline">Back to home</Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-xl font-black text-foreground">No public classes found</h3>
              <p className="text-muted-foreground mt-2">Try adjusting your filters or check back soon.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-muted-foreground font-semibold">
                  Showing <span className="text-foreground font-black">{filtered.length}</span> of {classrooms.length} public classes
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-slide-up">
                {filtered.map(renderClassroomCard)}
              </div>
            </>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary to-primary/80 p-6 sm:p-8 md:p-12 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-6">
              <span className="inline-flex items-center gap-2 text-white/90 text-sm">
                <CheckCircle2 className="w-4 h-4" /> Join live without an account
              </span>
              <span className="inline-flex items-center gap-2 text-white/90 text-sm">
                <Video className="w-4 h-4" /> Watch recordings anytime
              </span>
              <span className="inline-flex items-center gap-2 text-white/90 text-sm">
                <Globe className="w-4 h-4" /> Free & paid sessions
              </span>
            </div>
            <h2 className="font-outfit text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
              Teach the world — create your own public lecture
            </h2>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold bg-white text-primary hover:bg-white/95 transition-colors shadow-lg"
            >
              Start Teaching Free
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border bg-card/80 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 justify-center md:justify-start">
            <img src={logo} alt="Gracified" className="w-8 h-8 rounded-lg flex-shrink-0" />
            <span className="font-outfit font-bold text-foreground text-sm sm:text-base text-center md:text-left">Gracified Learning Platform</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6 text-sm text-muted-foreground flex-wrap justify-center md:justify-end">
            <Link to="/catalog" className="hover:text-primary font-medium transition-colors">Explore Classes</Link>
            <Link to="/privacy" className="hover:text-primary font-medium transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-primary font-medium transition-colors">Terms</Link>
            <Link to="/login" className="hover:text-primary font-medium transition-colors">Sign In</Link>
            <Link to="/register" className="hover:text-primary font-medium transition-colors">Register</Link>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground/60">
          &copy; {new Date().getFullYear()} Gracified Learning Platform. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Catalog;
