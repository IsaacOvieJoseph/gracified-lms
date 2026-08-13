import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
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
  Globe,
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import AuthCarousel from '../components/AuthCarousel';
import logo from '../assets/logo.jpg';

const SPARKLES = [
  { top: '18%', left: '12%', size: 6, delay: '0s' },
  { top: '32%', left: '86%', size: 4, delay: '0.8s' },
  { top: '12%', left: '64%', size: 5, delay: '1.6s' },
  { top: '58%', left: '8%', size: 4, delay: '2.4s' },
  { top: '70%', left: '90%', size: 6, delay: '0.4s' },
  { top: '45%', left: '92%', size: 5, delay: '1.2s' },
  { top: '80%', left: '18%', size: 4, delay: '2s' },
  { top: '25%', left: '40%', size: 5, delay: '2.8s' },
];

const Reveal = ({ children, delay = 0, className = '' }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('reveal-visible');
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal-on-scroll ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
};

const Landing = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: BookOpen,
      title: 'Interactive Classrooms',
      description: 'Engage students with live classes, whiteboards, and real-time collaboration tools.',
    },
    {
      icon: FileCheck,
      title: 'Smart Assignments',
      description: 'Create, distribute, and grade assignments with ease. Track submissions and deadlines.',
    },
    {
      icon: BarChart3,
      title: 'Analytics & Reports',
      description: 'Insights into student performance, attendance, and progress with detailed reports.',
    },
    {
      icon: Video,
      title: 'Video Integration',
      description: 'Seamless Google Meet integration for virtual classes and online learning.',
    },
    {
      icon: Users,
      title: 'Multi-Role Support',
      description: 'Built for schools, teachers, and students. Role-based dashboards and workflows.',
    },
    {
      icon: Zap,
      title: 'Exams & Assessments',
      description: 'Create exams, monitor submissions, and auto-grade with powerful exam center.',
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
    <div className="min-h-screen bg-background font-inter overflow-x-hidden transition-colors duration-300 text-foreground">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px] animate-float-blob" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] animate-float-blob" style={{ animationDelay: '-5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[180px] animate-float-blob" style={{ animationDelay: '-9s' }} />
        {SPARKLES.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-primary/50 blur-[1px]"
            style={{
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              animation: `sparkle-pop 4s ease-in-out ${s.delay} infinite`,
            }}
          />
        ))}
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
            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-3 flex-shrink-0">
              <ThemeToggle />
              <a
                href="#contact"
                className="px-4 py-2 text-muted-foreground font-semibold hover:text-primary transition-colors"
              >
                Contact Us
              </a>
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
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400 font-semibold">Theme</span>
                <ThemeToggle />
              </div>
              <a
                href="#contact"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-3 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Contact Us
              </a>
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
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-4">
        <div className="max-w-7xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-2xl min-h-[540px] sm:min-h-[580px] md:min-h-[620px]">
            <AuthCarousel hideText />

            {/* Extra left gradient for text legibility */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />

            {/* Content overlay */}
            <div className="absolute inset-0 flex items-center">
              <div className="px-6 sm:px-10 md:px-14 max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/15 backdrop-blur border border-white/20 text-white text-xs sm:text-sm font-semibold mb-5 sm:mb-7 animate-slide-up">
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  The future of education management
                </div>
                <h1 className="font-outfit text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tighter leading-[1.05] mb-5 sm:mb-7 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                  Learn Smarter.
                  <br />
                  <span className="text-sky-300 not-italic">Manage Better.</span>
                </h1>
                <p className="max-w-xl text-base sm:text-lg md:text-xl text-white/90 mb-7 sm:mb-9 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                  A complete learning management system for schools and independent educators.
                  Classrooms, assignments, exams, and analytics—all in one platform.
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 animate-slide-up" style={{ animationDelay: '0.3s' }}>
                  <Link
                    to="/register"
                    className="px-7 py-3.5 rounded-xl bg-white text-primary font-semibold flex items-center justify-center gap-2 hover:bg-white/90 hover:scale-105 transition-all shadow-lg"
                  >
                    Start Free Trial
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/catalog"
                    className="px-7 py-3.5 rounded-xl bg-white/10 backdrop-blur border border-white/30 text-white font-semibold flex items-center justify-center gap-2 hover:bg-white/20 transition-all"
                  >
                    <Globe className="w-4 h-4" />
                    Browse Public Lectures
                  </Link>
                </div>
                <p className="mt-5 text-xs sm:text-sm text-white/70 animate-slide-up" style={{ animationDelay: '0.4s' }}>
                  No credit card required · Free trial for schools & teachers
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative z-10 py-8 sm:py-12 border-y border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            {stats.map((stat, i) => (
              <Reveal key={i} delay={i * 120}>
                <div className="text-center px-1">
                  <div className="font-outfit text-xl sm:text-2xl md:text-3xl font-bold text-primary">{stat.value}</div>
                  <div className="text-xs sm:text-sm font-medium text-muted-foreground mt-0.5 sm:mt-1">{stat.label}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 py-16 sm:py-20 md:py-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <h2 className="text-2xl md:text-4xl font-black text-foreground mb-4 italic uppercase tracking-tighter">
                Integrated Digital <span className="text-primary not-italic">Infrastructure</span>
              </h2>
              <p className="max-w-2xl mx-auto text-slate-600 dark:text-slate-400">
                Built for modern education. Manage classrooms, track progress, and engage students effectively.
              </p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <Reveal key={i} delay={(i % 3) * 120}>
                <div
                  className="group relative p-6 rounded-2xl bg-card border border-border shadow-sm hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                >
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/10 to-transparent group-hover:animate-[shimmer-sweep_0.9s_ease]" />
                  <div className="relative inline-flex p-3 rounded-xl bg-primary/10 text-primary mb-4 animate-float-slow" style={{ animationDelay: `${i * 0.4}s` }}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="relative font-outfit text-lg font-bold text-slate-900 dark:text-white mb-2">{feature.title}</h3>
                  <p className="relative text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{feature.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="relative z-10 py-16 sm:py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-white/60 dark:bg-slate-900/60">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <h2 className="text-2xl md:text-4xl font-black text-foreground mb-4 italic uppercase tracking-tighter">
                Designed for Global <span className="text-primary not-italic">Learners</span>
              </h2>
              <p className="max-w-2xl mx-auto text-slate-600 dark:text-slate-400">
                Whether you run a school or teach independently, Gracified adapts to your workflow.
              </p>
            </div>
          </Reveal>
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-2xl min-h-[460px] sm:min-h-[520px]">
              <AuthCarousel showDots showRegister />
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-16 sm:py-20 md:py-28 px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="max-w-4xl mx-auto">
            <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary to-primary/70 p-6 sm:p-8 md:p-12 text-center">
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
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold bg-white text-primary hover:bg-white/95 hover:scale-105 transition-all duration-300 shadow-lg"
                >
                  Get Started Free
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Contact Us */}
      <section id="contact" className="relative z-10 py-16 sm:py-20 md:py-24 px-4 sm:px-6 lg:px-8 bg-card/60 border-t border-border">
        <Reveal>
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex p-3 rounded-2xl bg-primary/10 text-primary mb-6 animate-float-slow">
              <MessageCircle className="w-8 h-8" />
            </div>
            <h2 className="font-outfit text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
              We&apos;d Love to Hear From You
            </h2>
            <p className="text-muted-foreground mb-2">
              Your thoughts, questions, and feedback matter to us. We&apos;re here and eager to help—whether you have an enquiry about our platform, need support, or simply want to share how we can serve you better.
            </p>
            <p className="text-muted-foreground mb-8">
              Reach out anytime. We&apos;re open to your ideas and committed to responding promptly.
            </p>
            <a
              href="mailto:gracifiedlms@gmail.com"
              className="inline-flex items-center gap-2 btn-premium px-6 py-3 rounded-xl text-base font-semibold hover:scale-105 transition-transform"
            >
              <Mail className="w-5 h-5" />
              Send us an email
            </a>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border bg-card/80 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 justify-center md:justify-start">
            <img src={logo} alt="Gracified" className="w-8 h-8 rounded-lg flex-shrink-0" />
            <span className="font-outfit font-bold text-foreground text-sm sm:text-base text-center md:text-left">Gracified Learning Platform</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6 text-sm text-muted-foreground flex-wrap justify-center md:justify-end">
            <a href="#contact" className="hover:text-primary font-medium transition-colors">Contact Us</a>
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

export default Landing;
