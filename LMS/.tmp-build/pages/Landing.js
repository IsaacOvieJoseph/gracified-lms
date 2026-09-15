import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
  Globe
} from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import AuthCarousel from "../components/AuthCarousel";
import logo from "../assets/logo.jpg";
const SPARKLES = [
  { top: "18%", left: "12%", size: 6, delay: "0s" },
  { top: "32%", left: "86%", size: 4, delay: "0.8s" },
  { top: "12%", left: "64%", size: 5, delay: "1.6s" },
  { top: "58%", left: "8%", size: 4, delay: "2.4s" },
  { top: "70%", left: "90%", size: 6, delay: "0.4s" },
  { top: "45%", left: "92%", size: 5, delay: "1.2s" },
  { top: "80%", left: "18%", size: 4, delay: "2s" },
  { top: "25%", left: "40%", size: 5, delay: "2.8s" }
];
const Reveal = ({ children, delay = 0, className = "" }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el)
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("reveal-visible");
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return /* @__PURE__ */ React.createElement("div", { ref, className: `reveal-on-scroll ${className}`, style: { transitionDelay: `${delay}ms` } }, children);
};
const Landing = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const features = [
    {
      icon: BookOpen,
      title: "Interactive Classrooms",
      description: "Engage students with live classes, whiteboards, and real-time collaboration tools."
    },
    {
      icon: FileCheck,
      title: "Smart Assignments",
      description: "Create, distribute, and grade assignments with ease. Track submissions and deadlines."
    },
    {
      icon: BarChart3,
      title: "Analytics & Reports",
      description: "Insights into student performance, attendance, and progress with detailed reports."
    },
    {
      icon: Video,
      title: "Video Integration",
      description: "Seamless Google Meet integration for virtual classes and online learning."
    },
    {
      icon: Users,
      title: "Multi-Role Support",
      description: "Built for schools, teachers, and students. Role-based dashboards and workflows."
    },
    {
      icon: Zap,
      title: "Exams & Assessments",
      description: "Create exams, monitor submissions, and auto-grade with powerful exam center."
    }
  ];
  const stats = [
    { value: "10,000+", label: "Active Students" },
    { value: "99.9%", label: "Platform Uptime" },
    { value: "500+", label: "Schools & Tutors" },
    { value: "24/7", label: "Support Available" }
  ];
  const benefits = [
    "Classroom & whiteboard management",
    "Assignment & exam creation",
    "Payment & subscription handling",
    "Detailed analytics & reports",
    "Student & teacher dashboards",
    "Secure, scalable infrastructure"
  ];
  return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen bg-background font-inter overflow-x-hidden transition-colors duration-300 text-foreground" }, /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 pointer-events-none" }, /* @__PURE__ */ React.createElement("div", { className: "absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/10 rounded-full  animate-float-blob" }), /* @__PURE__ */ React.createElement("div", { className: "absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full  animate-float-blob", style: { animationDelay: "-5s" } }), /* @__PURE__ */ React.createElement("div", { className: "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full  animate-float-blob", style: { animationDelay: "-9s" } }), SPARKLES.map((s, i) => /* @__PURE__ */ React.createElement(
    "span",
    {
      key: i,
      className: "absolute rounded-full bg-primary/50 ",
      style: {
        top: s.top,
        left: s.left,
        width: s.size,
        height: s.size,
        animation: `sparkle-pop 4s ease-in-out ${s.delay} infinite`
      }
    }
  ))), /* @__PURE__ */ React.createElement("nav", { className: "relative z-20 border-b border-border bg-card " }, /* @__PURE__ */ React.createElement("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between h-16 md:h-20 gap-4" }, /* @__PURE__ */ React.createElement(Link, { to: "/", className: "flex items-center gap-2 sm:gap-3 group min-w-0 flex-shrink" }, /* @__PURE__ */ React.createElement("img", { src: logo, alt: "Gracified", className: "w-9 h-9 sm:w-10 sm:h-10 rounded-xl shadow-none flex-shrink-0" }), /* @__PURE__ */ React.createElement("span", { className: "font-serif text-base sm:text-xl font-semibold text-foreground" }, /* @__PURE__ */ React.createElement("span", { className: "hidden sm:inline text-foreground" }, "Gracified Learning Platform"), /* @__PURE__ */ React.createElement("span", { className: "sm:hidden text-foreground" }, "Gracified"))), /* @__PURE__ */ React.createElement("div", { className: "hidden md:flex items-center gap-3 flex-shrink-0" }, /* @__PURE__ */ React.createElement(
    "a",
    {
      href: "#contact",
      className: "px-4 py-2 text-muted-foreground font-semibold hover:text-primary transition-colors"
    },
    "Contact Us"
  ), /* @__PURE__ */ React.createElement(
    Link,
    {
      to: "/catalog",
      className: "px-4 py-2 text-primary font-semibold hover:text-primary/80 transition-colors"
    },
    "Explore Classes"
  ), /* @__PURE__ */ React.createElement(
    Link,
    {
      to: "/login",
      className: "px-4 py-2 text-muted-foreground font-semibold hover:text-primary transition-colors"
    },
    "Sign In"
  ), /* @__PURE__ */ React.createElement(
    Link,
    {
      to: "/register",
      className: "btn-premium px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
    },
    "Get Started",
    /* @__PURE__ */ React.createElement(ArrowRight, { className: "w-4 h-4" })
  )), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => setMobileMenuOpen(!mobileMenuOpen),
      className: "md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0",
      "aria-label": "Toggle menu"
    },
    mobileMenuOpen ? /* @__PURE__ */ React.createElement(X, { className: "w-6 h-6" }) : /* @__PURE__ */ React.createElement(Menu, { className: "w-6 h-6" })
  )), mobileMenuOpen && /* @__PURE__ */ React.createElement("div", { className: "md:hidden py-4 border-t border-slate-200/60 flex flex-col gap-2 animate-slide-up" }, /* @__PURE__ */ React.createElement("div", { className: "px-4 py-3 flex items-center justify-between" }, /* @__PURE__ */ React.createElement("span", { className: "text-slate-600 dark:text-slate-400 font-semibold" }, "Theme")), /* @__PURE__ */ React.createElement(
    "a",
    {
      href: "#contact",
      onClick: () => setMobileMenuOpen(false),
      className: "px-4 py-3 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
    },
    "Contact Us"
  ), /* @__PURE__ */ React.createElement(
    Link,
    {
      to: "/catalog",
      onClick: () => setMobileMenuOpen(false),
      className: "px-4 py-3 text-primary font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
    },
    "Explore Classes"
  ), /* @__PURE__ */ React.createElement(
    Link,
    {
      to: "/login",
      onClick: () => setMobileMenuOpen(false),
      className: "px-4 py-3 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
    },
    "Sign In"
  ), /* @__PURE__ */ React.createElement(
    Link,
    {
      to: "/register",
      onClick: () => setMobileMenuOpen(false),
      className: "btn-premium px-5 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
    },
    "Get Started",
    /* @__PURE__ */ React.createElement(ArrowRight, { className: "w-4 h-4" })
  )))), /* @__PURE__ */ React.createElement("section", { className: "relative z-10 px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-4" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-7xl mx-auto" }, /* @__PURE__ */ React.createElement("div", { className: "relative overflow-hidden rounded-xl sm:rounded-xl shadow-none min-h-[540px] sm:min-h-[580px] md:min-h-[620px]" }, /* @__PURE__ */ React.createElement(AuthCarousel, { hideText: true }), /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0  from-black/70 via-black/35 to-transparent" }), /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 flex items-center" }, /* @__PURE__ */ React.createElement("div", { className: "px-6 sm:px-10 md:px-14 max-w-3xl" }, /* @__PURE__ */ React.createElement("div", { className: "inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/15 backdrop-blur border border-white/20 text-white text-xs sm:text-sm font-semibold mb-5 sm:mb-7 animate-slide-up" }, /* @__PURE__ */ React.createElement(Sparkles, { className: "w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" }), "The future of education management"), /* @__PURE__ */ React.createElement("h1", { className: "font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold text-white tracking-tight leading-[1.05] mb-5 sm:mb-7 animate-slide-up", style: { animationDelay: "0.1s" } }, "Learn Smarter.", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("span", { className: "text-sky-300 not-italic" }, "Manage Better.")), /* @__PURE__ */ React.createElement("p", { className: "max-w-xl text-base sm:text-lg md:text-xl text-white/90 mb-7 sm:mb-9 animate-slide-up", style: { animationDelay: "0.2s" } }, "A complete learning management system for schools and independent educators. Classrooms, assignments, exams, and analytics\u2014all in one platform."), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:flex-row items-stretch sm:items-center gap-3 animate-slide-up", style: { animationDelay: "0.3s" } }, /* @__PURE__ */ React.createElement(
    Link,
    {
      to: "/register",
      className: "px-7 py-3.5 rounded-xl bg-white text-primary font-semibold flex items-center justify-center gap-2 hover:bg-white/90 hover:scale-105 transition-all shadow-none"
    },
    "Start Free Trial",
    /* @__PURE__ */ React.createElement(ArrowRight, { className: "w-4 h-4" })
  ), /* @__PURE__ */ React.createElement(
    Link,
    {
      to: "/catalog",
      className: "px-7 py-3.5 rounded-xl bg-white/10 backdrop-blur border border-white/30 text-white font-semibold flex items-center justify-center gap-2 hover:bg-white/20 transition-all"
    },
    /* @__PURE__ */ React.createElement(Globe, { className: "w-4 h-4" }),
    "Browse Public Lectures"
  )), /* @__PURE__ */ React.createElement("p", { className: "mt-5 text-xs sm:text-sm text-white/70 animate-slide-up", style: { animationDelay: "0.4s" } }, "No credit card required \xB7 Free trial for schools & teachers")))))), /* @__PURE__ */ React.createElement("section", { className: "relative z-10 py-8 sm:py-12 border-y border-border bg-card " }, /* @__PURE__ */ React.createElement("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" }, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8" }, stats.map((stat, i) => /* @__PURE__ */ React.createElement(Reveal, { key: i, delay: i * 120 }, /* @__PURE__ */ React.createElement("div", { className: "text-center px-1" }, /* @__PURE__ */ React.createElement("div", { className: "font-serif text-xl sm:text-2xl md:text-3xl font-semibold text-primary" }, stat.value), /* @__PURE__ */ React.createElement("div", { className: "text-xs sm:text-sm font-medium text-muted-foreground mt-0.5 sm:mt-1" }, stat.label))))))), /* @__PURE__ */ React.createElement("section", { className: "relative z-10 py-16 sm:py-20 md:py-28 px-4 sm:px-6 lg:px-8" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-7xl mx-auto" }, /* @__PURE__ */ React.createElement(Reveal, null, /* @__PURE__ */ React.createElement("div", { className: "text-center mb-16" }, /* @__PURE__ */ React.createElement("h2", { className: "text-2xl md:text-4xl font-semibold text-foreground mb-4 italic tracking-tight" }, "Integrated Digital ", /* @__PURE__ */ React.createElement("span", { className: "text-primary not-italic" }, "Infrastructure")), /* @__PURE__ */ React.createElement("p", { className: "max-w-2xl mx-auto text-slate-600 dark:text-slate-400" }, "Built for modern education. Manage classrooms, track progress, and engage students effectively."))), /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-2 lg:grid-cols-3 gap-6" }, features.map((feature, i) => /* @__PURE__ */ React.createElement(Reveal, { key: i, delay: i % 3 * 120 }, /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "group relative p-6 rounded-xl bg-card border border-border shadow-none hover:border-primary/30 hover:shadow-none hover:-translate-y-1 transition-all duration-300 overflow-hidden"
    },
    /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 -translate-x-full  from-transparent via-primary/10 to-transparent group-hover:animate-[shimmer-sweep_0.9s_ease]" }),
    /* @__PURE__ */ React.createElement("div", { className: "relative inline-flex p-3 rounded-xl bg-primary/10 text-primary mb-4 animate-float-slow", style: { animationDelay: `${i * 0.4}s` } }, /* @__PURE__ */ React.createElement(feature.icon, { className: "w-6 h-6" })),
    /* @__PURE__ */ React.createElement("h3", { className: "relative font-serif text-lg font-semibold text-slate-900 dark:text-white mb-2" }, feature.title),
    /* @__PURE__ */ React.createElement("p", { className: "relative text-slate-600 dark:text-slate-400 text-sm leading-relaxed" }, feature.description)
  )))))), /* @__PURE__ */ React.createElement("section", { className: "relative z-10 py-16 sm:py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-white/60 dark:bg-slate-900/60" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-7xl mx-auto" }, /* @__PURE__ */ React.createElement(Reveal, null, /* @__PURE__ */ React.createElement("div", { className: "text-center mb-16" }, /* @__PURE__ */ React.createElement("h2", { className: "text-2xl md:text-4xl font-semibold text-foreground mb-4 italic tracking-tight" }, "Designed for Global ", /* @__PURE__ */ React.createElement("span", { className: "text-primary not-italic" }, "Learners")), /* @__PURE__ */ React.createElement("p", { className: "max-w-2xl mx-auto text-slate-600 dark:text-slate-400" }, "Whether you run a school or teach independently, Gracified adapts to your workflow."))), /* @__PURE__ */ React.createElement(Reveal, null, /* @__PURE__ */ React.createElement("div", { className: "relative overflow-hidden rounded-xl sm:rounded-xl shadow-none min-h-[560px] sm:min-h-[640px]" }, /* @__PURE__ */ React.createElement(AuthCarousel, { showDots: true, showRegister: true }))))), /* @__PURE__ */ React.createElement("section", { className: "relative z-10 py-16 sm:py-20 md:py-28 px-4 sm:px-6 lg:px-8" }, /* @__PURE__ */ React.createElement(Reveal, null, /* @__PURE__ */ React.createElement("div", { className: "max-w-4xl mx-auto" }, /* @__PURE__ */ React.createElement("div", { className: "relative overflow-hidden rounded-xl sm:rounded-xl  from-primary to-primary/70 p-6 sm:p-8 md:p-12 text-center" }, /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\\'60\\' height=\\'60\\' viewBox=\\'0 0 60 60\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cg fill=\\'none\\' fill-rule=\\'evenodd\\'%3E%3Cg fill=\\'%23ffffff\\' fill-opacity=\\'0.05\\'%3E%3Cpath d=\\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" }), /* @__PURE__ */ React.createElement("div", { className: "relative z-10" }, /* @__PURE__ */ React.createElement("h2", { className: "font-serif text-2xl sm:text-3xl md:text-4xl font-semibold text-white mb-3 sm:mb-4" }, "Ready to transform your learning experience?"), /* @__PURE__ */ React.createElement("p", { className: "text-white/90 mb-8 max-w-xl mx-auto" }, "Join thousands of educators and students already using Gracified."), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:flex-row sm:flex-wrap justify-center gap-2 sm:gap-3 mb-10 sm:text-left" }, benefits.slice(0, 4).map((b, i) => /* @__PURE__ */ React.createElement("span", { key: i, className: "inline-flex items-center gap-2 text-white/90 text-sm justify-center sm:justify-start" }, /* @__PURE__ */ React.createElement(CheckCircle2, { className: "w-4 h-4 text-white/90 flex-shrink-0" }), b))), /* @__PURE__ */ React.createElement(
    Link,
    {
      to: "/register",
      className: "inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold bg-white text-primary hover:bg-white/95 hover:scale-105 transition-all duration-300 shadow-none"
    },
    "Get Started Free",
    /* @__PURE__ */ React.createElement(ArrowRight, { className: "w-5 h-5" })
  )))))), /* @__PURE__ */ React.createElement("section", { id: "contact", className: "relative z-10 py-16 sm:py-20 md:py-24 px-4 sm:px-6 lg:px-8 bg-card border-t border-border" }, /* @__PURE__ */ React.createElement(Reveal, null, /* @__PURE__ */ React.createElement("div", { className: "max-w-3xl mx-auto text-center" }, /* @__PURE__ */ React.createElement("div", { className: "inline-flex p-3 rounded-xl bg-primary/10 text-primary mb-6 animate-float-slow" }, /* @__PURE__ */ React.createElement(MessageCircle, { className: "w-8 h-8" })), /* @__PURE__ */ React.createElement("h2", { className: "font-serif text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground mb-4" }, "We'd Love to Hear From You"), /* @__PURE__ */ React.createElement("p", { className: "text-muted-foreground mb-2" }, "Your thoughts, questions, and feedback matter to us. We're here and eager to help\u2014whether you have an enquiry about our platform, need support, or simply want to share how we can serve you better."), /* @__PURE__ */ React.createElement("p", { className: "text-muted-foreground mb-8" }, "Reach out anytime. We're open to your ideas and committed to responding promptly."), /* @__PURE__ */ React.createElement(
    "a",
    {
      href: "mailto:gracifiedlms@gmail.com",
      className: "inline-flex items-center gap-2 btn-premium px-6 py-3 rounded-xl text-base font-semibold hover:scale-105 transition-transform"
    },
    /* @__PURE__ */ React.createElement(Mail, { className: "w-5 h-5" }),
    "Send us an email"
  )))), /* @__PURE__ */ React.createElement("footer", { className: "relative z-10 border-t border-border bg-card py-8 sm:py-12 px-4 sm:px-6 lg:px-8" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 justify-center md:justify-start" }, /* @__PURE__ */ React.createElement("img", { src: logo, alt: "Gracified", className: "w-8 h-8 rounded-xl flex-shrink-0" }), /* @__PURE__ */ React.createElement("span", { className: "font-serif font-semibold text-foreground text-sm sm:text-base text-center md:text-left" }, "Gracified Learning Platform")), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-4 sm:gap-6 text-sm text-muted-foreground flex-wrap justify-center md:justify-end" }, /* @__PURE__ */ React.createElement("a", { href: "#contact", className: "hover:text-primary font-medium transition-colors" }, "Contact Us"), /* @__PURE__ */ React.createElement(Link, { to: "/catalog", className: "hover:text-primary font-medium transition-colors" }, "Explore Classes"), /* @__PURE__ */ React.createElement(Link, { to: "/privacy", className: "hover:text-primary font-medium transition-colors" }, "Privacy"), /* @__PURE__ */ React.createElement(Link, { to: "/terms", className: "hover:text-primary font-medium transition-colors" }, "Terms"), /* @__PURE__ */ React.createElement(Link, { to: "/login", className: "hover:text-primary font-medium transition-colors" }, "Sign In"), /* @__PURE__ */ React.createElement(Link, { to: "/register", className: "hover:text-primary font-medium transition-colors" }, "Register"))), /* @__PURE__ */ React.createElement("div", { className: "max-w-7xl mx-auto mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground/60" }, "\xA9 ", (/* @__PURE__ */ new Date()).getFullYear(), " Gracified Learning Platform. All rights reserved.")));
};
var Landing_default = Landing;
export {
  Landing_default as default
};
