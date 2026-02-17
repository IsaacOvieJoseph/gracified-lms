import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  School,
  BookOpen,
  FileCheck,
  BarChart3,
  Users,
  Video,
  Zap,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Menu,
  X,
  Mail,
  MessageCircle,
} from 'lucide-react';
import logo from '../assets/logo.jpg';

const Landing = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: BookOpen,
      title: 'Interactive Classrooms',
      description: 'Engage students with live classes, whiteboards, and real-time collaboration tools.',
      color: 'from-primary/20 to-primary/5',
      iconBg: 'bg-primary/10 text-primary',
    },
    {
      icon: FileCheck,
      title: 'Smart Assignments',
      description: 'Create, distribute, and grade assignments with ease. Track submissions and deadlines.',
      color: 'from-emerald-500/20 to-emerald-500/5',
      iconBg: 'bg-emerald-500/10 text-emerald-600',
    },
    {
      icon: BarChart3,
      title: 'Analytics & Reports',
      description: 'Insights into student performance, attendance, and progress with detailed reports.',
      color: 'from-amber-500/20 to-amber-500/5',
      iconBg: 'bg-amber-500/10 text-amber-600',
    },
    {
      icon: Video,
      title: 'Video Integration',
      description: 'Seamless Google Meet integration for virtual classes and online learning.',
      color: 'from-violet-500/20 to-violet-500/5',
      iconBg: 'bg-violet-500/10 text-violet-600',
    },
    {
      icon: Users,
      title: 'Multi-Role Support',
      description: 'Built for schools, teachers, and students. Role-based dashboards and workflows.',
      color: 'from-rose-500/20 to-rose-500/5',
      iconBg: 'bg-rose-500/10 text-rose-600',
    },
    {
      icon: Zap,
      title: 'Exams & Assessments',
      description: 'Create exams, monitor submissions, and auto-grade with powerful exam center.',
      color: 'from-cyan-500/20 to-cyan-500/5',
      iconBg: 'bg-cyan-500/10 text-cyan-600',
    },
  ];

  const stats = [
    { value: '10,000+', label: 'Active Students' },
    { value: '99.9%', label: 'Platform Uptime' },
    { value: '500+', label: 'Schools & Tutors' },
    { value: '24/7', label: 'Support Available' },
  ];

  const benefits = [
    'Classroom & whiteboard management',
    'Assignment & exam creation',
    'Payment & subscription handling',
    'Detailed analytics & reports',
    'Student & teacher dashboards',
    'Secure, scalable infrastructure',
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-inter overflow-x-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-400/5 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-200/5 rounded-full blur-[180px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-20 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20 gap-4">
            <Link to="/" className="flex items-center gap-2 sm:gap-3 group min-w-0 flex-shrink">
              <img src={logo} alt="Gracified" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl shadow-lg flex-shrink-0" />
              <span className="font-outfit text-base sm:text-xl font-bold text-slate-900">
                <span className="hidden sm:inline">Gracified Learning Platform</span>
                <span className="sm:hidden">Gracified</span>
              </span>
            </Link>
            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-3 flex-shrink-0">
              <a
                href="#contact"
                className="px-4 py-2 text-slate-600 font-semibold hover:text-primary transition-colors"
              >
                Contact Us
              </a>
              <Link
                to="/login"
                className="px-4 py-2 text-slate-600 font-semibold hover:text-primary transition-colors"
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
            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
          {/* Mobile menu dropdown */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-slate-200/60 flex flex-col gap-2 animate-slide-up">
              <a
                href="#contact"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-3 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl transition-colors"
              >
                Contact Us
              </a>
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-3 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl transition-colors"
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
      <section className="relative z-10 pt-12 sm:pt-16 md:pt-24 pb-16 sm:pb-20 md:pb-32 px-5 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-semibold mb-6 sm:mb-8 animate-slide-up">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            The future of education management
          </div>
          <h1 className="font-outfit text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 tracking-tight mb-4 sm:mb-6 animate-slide-up px-1" style={{ animationDelay: '0.1s' }}>
            Learn Smarter.
            <br />
            <span className="text-primary italic">Manage Better.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-base sm:text-lg md:text-xl text-slate-600 mb-8 sm:mb-10 animate-slide-up px-1" style={{ animationDelay: '0.2s' }}>
            A complete learning management system for schools and independent educators.
            Classrooms, assignments, exams, and analytics—all in one platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <Link
              to="/register"
              className="btn-premium px-8 py-4 rounded-xl text-base font-semibold flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/login"
              className="btn-secondary px-8 py-4 rounded-xl text-base font-semibold w-full sm:w-auto justify-center"
            >
              Sign In
            </Link>
          </div>
          <p className="mt-6 text-xs sm:text-sm text-slate-500 animate-slide-up px-2" style={{ animationDelay: '0.4s' }}>
            No credit card required · Free trial for schools & teachers
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="relative z-10 py-8 sm:py-12 border-y border-slate-200/60 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center px-1">
                <div className="font-outfit text-xl sm:text-2xl md:text-3xl font-bold text-primary">{stat.value}</div>
                <div className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5 sm:mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 py-16 sm:py-20 md:py-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-outfit text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Everything you need to teach and learn
            </h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              Built for modern education. Manage classrooms, track progress, and engage students effectively.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className={`group relative p-6 rounded-2xl bg-gradient-to-br ${feature.color} border border-slate-200/60 hover:border-primary/20 transition-all duration-300 hover:shadow-xl hover:-translate-y-1`}
              >
                <div className={`inline-flex p-3 rounded-xl ${feature.iconBg} mb-4`}>
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="font-outfit text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="relative z-10 py-16 sm:py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-white/60">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-outfit text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Built for everyone in education
            </h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              Whether you run a school or teach independently, Gracified adapts to your workflow.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            <div className="p-6 sm:p-8 rounded-2xl bg-slate-50 border border-slate-200/60 text-center">
              <div className="inline-flex p-4 rounded-2xl bg-primary/10 text-primary mb-6">
                <School className="w-10 h-10" />
              </div>
              <h3 className="font-outfit text-xl font-bold text-slate-900 mb-2">School Admins</h3>
              <p className="text-slate-600 text-sm mb-6">
                Manage multiple schools, classrooms, teachers, and students from a single dashboard.
              </p>
              <Link to="/register/school-admin" className="text-primary font-semibold text-sm hover:underline flex items-center justify-center gap-1">
                Register as School Admin <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="p-6 sm:p-8 rounded-2xl bg-slate-50 border border-slate-200/60 text-center">
              <div className="inline-flex p-4 rounded-2xl bg-violet-500/10 text-violet-600 mb-6">
                <GraduationCap className="w-10 h-10" />
              </div>
              <h3 className="font-outfit text-xl font-bold text-slate-900 mb-2">Personal Teachers</h3>
              <p className="text-slate-600 text-sm mb-6">
                Create your own tutorial center. Courses, assignments, and payments—all under your brand.
              </p>
              <Link to="/register/personal-teacher" className="text-violet-600 font-semibold text-sm hover:underline flex items-center justify-center gap-1">
                Register as Teacher <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="p-6 sm:p-8 rounded-2xl bg-slate-50 border border-slate-200/60 text-center">
              <div className="inline-flex p-4 rounded-2xl bg-emerald-500/10 text-emerald-600 mb-6">
                <BookOpen className="w-10 h-10" />
              </div>
              <h3 className="font-outfit text-xl font-bold text-slate-900 mb-2">Students</h3>
              <p className="text-slate-600 text-sm mb-6">
                Access classes, submit assignments, take exams, and track your progress.
              </p>
              <Link to="/register/student" className="text-emerald-600 font-semibold text-sm hover:underline flex items-center justify-center gap-1">
                Register as Student <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-16 sm:py-20 md:py-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary to-primary/80 p-6 sm:p-8 md:p-12 text-center">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
            <div className="relative z-10">
              <h2 className="font-outfit text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4">
                Ready to transform your learning experience?
              </h2>
              <p className="text-white/90 mb-8 max-w-xl mx-auto">
                Join thousands of educators and students already using Gracified.
              </p>
              <div className="flex flex-col sm:flex-row sm:flex-wrap justify-center gap-2 sm:gap-3 mb-10 sm:text-left">
                {benefits.slice(0, 4).map((b, i) => (
                  <span key={i} className="inline-flex items-center gap-2 text-white/90 text-sm justify-center sm:justify-start">
                    <CheckCircle2 className="w-4 h-4 text-white/90 flex-shrink-0" />
                    {b}
                  </span>
                ))}
              </div>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold bg-white text-primary hover:bg-white/95 transition-colors shadow-lg"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Us */}
      <section id="contact" className="relative z-10 py-16 sm:py-20 md:py-24 px-4 sm:px-6 lg:px-8 bg-white/60 border-t border-slate-200/60">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex p-3 rounded-2xl bg-primary/10 text-primary mb-6">
            <MessageCircle className="w-8 h-8" />
          </div>
          <h2 className="font-outfit text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            We&apos;d Love to Hear From You
          </h2>
          <p className="text-slate-600 mb-2">
            Your thoughts, questions, and feedback matter to us. We&apos;re here and eager to help—whether you have an enquiry about our platform, need support, or simply want to share how we can serve you better.
          </p>
          <p className="text-slate-600 mb-8">
            Reach out anytime. We&apos;re open to your ideas and committed to responding promptly.
          </p>
          <a
            href="mailto:gracifiedlms@gmail.com"
            className="inline-flex items-center gap-2 btn-premium px-6 py-3 rounded-xl text-base font-semibold"
          >
            <Mail className="w-5 h-5" />
            Send us an email
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200/60 bg-white/80 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 justify-center md:justify-start">
            <img src={logo} alt="Gracified" className="w-8 h-8 rounded-lg flex-shrink-0" />
            <span className="font-outfit font-bold text-slate-900 text-sm sm:text-base text-center md:text-left">Gracified Learning Platform</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6 text-sm text-slate-600 flex-wrap justify-center md:justify-end">
            <a href="#contact" className="hover:text-primary font-medium transition-colors">Contact Us</a>
            <Link to="/login" className="hover:text-primary font-medium transition-colors">Sign In</Link>
            <Link to="/register" className="hover:text-primary font-medium transition-colors">Register</Link>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-slate-200/60 text-center text-sm text-slate-500">
          &copy; {new Date().getFullYear()} Gracified Learning Platform. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Landing;
