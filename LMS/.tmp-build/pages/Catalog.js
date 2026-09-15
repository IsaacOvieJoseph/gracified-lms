import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap,
  Radio,
  Users,
  Search,
  ArrowRight,
  Menu,
  X,
  Sparkles,
  Loader2,
  Clock,
  Video,
  CheckCircle2,
  Building2,
  Globe,
  CalendarDays,
  BookOpen,
  DollarSign
} from "lucide-react";
import axios from "axios";
import { toast } from "react-hot-toast";
import ThemeToggle from "../components/ThemeToggle";
import logo from "../assets/logo.jpg";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const formatLabel = (fmt) => fmt === "public_lecture" ? "Public Lecture" : fmt === "public_seminar" ? "Public Seminar" : "Class";
const Catalog = () => {
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("all");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [selectedPrice, setSelectedPrice] = useState("all");
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const response = await axios.get(`${API_URL}/classrooms/catalog?limit=100`);
        setClassrooms(response.data.classrooms || []);
      } catch (err) {
        console.error("Error fetching catalog:", err);
        setError(err.response?.data?.message || "Could not load the class catalog.");
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, []);
  const subjects = useMemo(() => {
    const set = new Set(classrooms.map((c) => c.subject).filter(Boolean));
    return Array.from(set).sort();
  }, [classrooms]);
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return classrooms.filter((c) => {
      if (selectedFormat !== "all" && c.classFormat !== selectedFormat)
        return false;
      if (selectedSubject !== "all" && c.subject !== selectedSubject)
        return false;
      if (selectedPrice === "free" && c.isPaid)
        return false;
      if (selectedPrice === "paid" && !c.isPaid)
        return false;
      if (q && !((c.name || "").toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q) || (c.subject || "").toLowerCase().includes(q) || (c.teacherId?.name || "").toLowerCase().includes(q)))
        return false;
      return true;
    });
  }, [classrooms, searchQuery, selectedFormat, selectedSubject, selectedPrice]);
  const getClassLink = (c) => `/c/${c.slug || c.shortCode || c._id}`;
  const renderClassroomCard = (c) => /* @__PURE__ */ React.createElement(
    Link,
    {
      to: getClassLink(c),
      key: c._id,
      className: "group relative flex flex-col overflow-hidden rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-none hover:shadow-none hover:-translate-y-1"
    },
    /* @__PURE__ */ React.createElement("div", { className: "relative h-36  from-primary/15 via-primary/5 to-transparent flex items-center justify-center overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent  scale-150" }), /* @__PURE__ */ React.createElement("div", { className: "relative flex flex-wrap items-center justify-center gap-2 px-4" }, /* @__PURE__ */ React.createElement("span", { className: "px-3 py-1 rounded-full bg-card text-primary text-xs font-semibold tracking-wide border border-primary/20 shadow-none flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(Radio, { className: "w-3 h-3" }), formatLabel(c.classFormat)), c.isLive && /* @__PURE__ */ React.createElement("span", { className: "px-3 py-1 rounded-full bg-success text-white text-xs font-semibold tracking-wide shadow-none flex items-center gap-1.5 animate-pulse" }, /* @__PURE__ */ React.createElement("span", { className: "w-1.5 h-1.5 rounded-full bg-white" }), "Live Now"), !c.isLive && c.hasRecording && /* @__PURE__ */ React.createElement("span", { className: "px-3 py-1 rounded-full bg-primary text-white text-xs font-semibold tracking-wide flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(Video, { className: "w-3 h-3" }), "Recording"))),
    /* @__PURE__ */ React.createElement("div", { className: "flex flex-col flex-1 p-5 space-y-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { className: "text-lg font-semibold text-foreground tracking-tight group-hover:text-primary transition-colors leading-snug" }, c.name), /* @__PURE__ */ React.createElement("p", { className: "text-xs font-semibold tracking-wide text-muted-foreground/70 mt-1 flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(GraduationCap, { className: "w-3 h-3" }), c.teacherId?.name || "Instructor")), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-muted-foreground font-medium leading-relaxed line-clamp-2 flex-1" }, c.description || "Join this public session \u2014 no account needed."), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2 pt-2 border-t border-border/60" }, c.subject && /* @__PURE__ */ React.createElement("span", { className: "px-2.5 py-1 bg-muted text-muted-foreground text-xs font-semibold tracking-wide rounded-xl border border-border" }, c.subject), c.topicsCount > 0 && /* @__PURE__ */ React.createElement("span", { className: "px-2.5 py-1 bg-muted text-muted-foreground text-xs font-semibold tracking-wide rounded-xl border border-border" }, c.topicsCount, " ", c.topicsCount === 1 ? "Module" : "Modules")), /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between pt-1" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-baseline gap-1.5" }, /* @__PURE__ */ React.createElement("span", { className: `text-xl font-semibold italic ${c.isPaid ? "text-foreground" : "text-emerald-500"}` }, c.isPaid ? `\u20A6${Number(c.pricing?.amount || 0).toLocaleString()}` : "Free"), c.isPaid && /* @__PURE__ */ React.createElement("span", { className: "text-[8px] font-semibold tracking-wide text-muted-foreground/60" }, "Access Fee")), /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-1 text-xs font-semibold tracking-wide text-primary" }, "View ", /* @__PURE__ */ React.createElement(ArrowRight, { className: "w-3 h-3 group-hover:translate-x-0.5 transition-transform" }))))
  );
  return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen bg-background font-inter overflow-x-hidden transition-colors duration-300 text-foreground" }, /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 pointer-events-none" }, /* @__PURE__ */ React.createElement("div", { className: "absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full " }), /* @__PURE__ */ React.createElement("div", { className: "absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full " })), /* @__PURE__ */ React.createElement("nav", { className: "relative z-20 border-b border-border bg-card " }, /* @__PURE__ */ React.createElement("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between h-16 md:h-20 gap-4" }, /* @__PURE__ */ React.createElement(Link, { to: "/", className: "flex items-center gap-2 sm:gap-3 group min-w-0 flex-shrink" }, /* @__PURE__ */ React.createElement("img", { src: logo, alt: "Gracified", className: "w-9 h-9 sm:w-10 sm:h-10 rounded-xl shadow-none flex-shrink-0" }), /* @__PURE__ */ React.createElement("span", { className: "font-serif text-base sm:text-xl font-semibold text-foreground" }, /* @__PURE__ */ React.createElement("span", { className: "hidden sm:inline text-foreground" }, "Gracified Learning Platform"), /* @__PURE__ */ React.createElement("span", { className: "sm:hidden text-foreground" }, "Gracified"))), /* @__PURE__ */ React.createElement("div", { className: "hidden md:flex items-center gap-3 flex-shrink-0" }, /* @__PURE__ */ React.createElement(
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
  )))), /* @__PURE__ */ React.createElement("section", { className: "relative z-10 pt-12 sm:pt-16 md:pt-20 pb-10 px-5 sm:px-6 lg:px-8" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-4xl mx-auto text-center" }, /* @__PURE__ */ React.createElement("div", { className: "inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-semibold mb-6 animate-slide-up" }, /* @__PURE__ */ React.createElement(Sparkles, { className: "w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" }), "Public Lectures & Seminars"), /* @__PURE__ */ React.createElement("h1", { className: "font-serif text-3xl sm:text-5xl md:text-6xl font-semibold text-foreground tracking-tight leading-[0.9] mb-5 animate-slide-up px-1 italic", style: { animationDelay: "0.1s" } }, "Learn from experts.", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("span", { className: "text-primary not-italic" }, "No account needed.")), /* @__PURE__ */ React.createElement("p", { className: "max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground mb-6 animate-slide-up px-1", style: { animationDelay: "0.2s" } }, "Browse open lectures and seminars from independent educators and schools. Join live sessions or watch the recordings \u2014 all you need is your name and email."))), /* @__PURE__ */ React.createElement("section", { className: "relative z-10 pb-10 px-5 sm:px-6 lg:px-8" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-7xl mx-auto" }, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end" }, /* @__PURE__ */ React.createElement("div", { className: "lg:col-span-2" }, /* @__PURE__ */ React.createElement("label", { className: "text-xs font-semibold text-muted-foreground tracking-wide px-1 block mb-1.5 flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(Search, { className: "w-3 h-3" }), " Search Classes"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "text",
      value: searchQuery,
      onChange: (e) => setSearchQuery(e.target.value),
      placeholder: "Search by title, subject, or instructor...",
      className: "w-full bg-card border-2 border-border h-12 px-4 rounded-xl font-semibold italic outline-none focus:border-primary transition-all"
    }
  )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs font-semibold text-muted-foreground tracking-wide px-1 block mb-1.5 flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(Radio, { className: "w-3 h-3" }), " Format"), /* @__PURE__ */ React.createElement(
    "select",
    {
      value: selectedFormat,
      onChange: (e) => setSelectedFormat(e.target.value),
      className: "w-full bg-card border-2 border-border h-12 px-3 rounded-xl font-semibold outline-none focus:border-primary transition-all"
    },
    /* @__PURE__ */ React.createElement("option", { value: "all" }, "All Formats"),
    /* @__PURE__ */ React.createElement("option", { value: "public_lecture" }, "Public Lecture"),
    /* @__PURE__ */ React.createElement("option", { value: "public_seminar" }, "Public Seminar")
  )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs font-semibold text-muted-foreground tracking-wide px-1 block mb-1.5 flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(BookOpen, { className: "w-3 h-3" }), " Subject"), /* @__PURE__ */ React.createElement(
    "select",
    {
      value: selectedSubject,
      onChange: (e) => setSelectedSubject(e.target.value),
      className: "w-full bg-card border-2 border-border h-12 px-3 rounded-xl font-semibold outline-none focus:border-primary transition-all"
    },
    /* @__PURE__ */ React.createElement("option", { value: "all" }, "All Subjects"),
    subjects.map((s) => /* @__PURE__ */ React.createElement("option", { key: s, value: s }, s))
  )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs font-semibold text-muted-foreground tracking-wide px-1 block mb-1.5 flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(DollarSign, { className: "w-3 h-3" }), " Price"), /* @__PURE__ */ React.createElement(
    "select",
    {
      value: selectedPrice,
      onChange: (e) => setSelectedPrice(e.target.value),
      className: "w-full bg-card border-2 border-border h-12 px-3 rounded-xl font-semibold outline-none focus:border-primary transition-all"
    },
    /* @__PURE__ */ React.createElement("option", { value: "all" }, "All Prices"),
    /* @__PURE__ */ React.createElement("option", { value: "free" }, "Free"),
    /* @__PURE__ */ React.createElement("option", { value: "paid" }, "Paid")
  ))))), /* @__PURE__ */ React.createElement("section", { className: "relative z-10 pb-20 px-5 sm:px-6 lg:px-8" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-7xl mx-auto" }, loading ? /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-center justify-center py-32" }, /* @__PURE__ */ React.createElement(Loader2, { className: "w-10 h-10 text-primary animate-spin mb-4" }), /* @__PURE__ */ React.createElement("p", { className: "text-sm font-semibold text-muted-foreground" }, "Loading public classes...")) : error ? /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-center justify-center py-32 text-center" }, /* @__PURE__ */ React.createElement("div", { className: "w-16 h-16 bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center mb-4" }, /* @__PURE__ */ React.createElement(X, { className: "w-8 h-8" })), /* @__PURE__ */ React.createElement("p", { className: "text-lg font-semibold text-foreground" }, error), /* @__PURE__ */ React.createElement(Link, { to: "/", className: "mt-4 text-primary font-semibold text-sm hover:underline" }, "Back to home")) : filtered.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-center justify-center py-32 text-center" }, /* @__PURE__ */ React.createElement("div", { className: "w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4" }, /* @__PURE__ */ React.createElement(Search, { className: "w-8 h-8 text-muted-foreground/40" })), /* @__PURE__ */ React.createElement("h3", { className: "text-xl font-semibold text-foreground" }, "No public classes found"), /* @__PURE__ */ React.createElement("p", { className: "text-muted-foreground mt-2" }, "Try adjusting your filters or check back soon.")) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-6" }, /* @__PURE__ */ React.createElement("p", { className: "text-sm text-muted-foreground font-semibold" }, "Showing ", /* @__PURE__ */ React.createElement("span", { className: "text-foreground font-semibold" }, filtered.length), " of ", classrooms.length, " public classes")), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-slide-up" }, filtered.map(renderClassroomCard))))), /* @__PURE__ */ React.createElement("section", { className: "relative z-10 py-16 px-4 sm:px-6 lg:px-8" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-4xl mx-auto" }, /* @__PURE__ */ React.createElement("div", { className: "rounded-xl sm:rounded-xl  from-primary to-primary/80 p-6 sm:p-8 md:p-12 text-center" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-6" }, /* @__PURE__ */ React.createElement("span", { className: "inline-flex items-center gap-2 text-white/90 text-sm" }, /* @__PURE__ */ React.createElement(CheckCircle2, { className: "w-4 h-4" }), " Join live without an account"), /* @__PURE__ */ React.createElement("span", { className: "inline-flex items-center gap-2 text-white/90 text-sm" }, /* @__PURE__ */ React.createElement(Video, { className: "w-4 h-4" }), " Watch recordings anytime"), /* @__PURE__ */ React.createElement("span", { className: "inline-flex items-center gap-2 text-white/90 text-sm" }, /* @__PURE__ */ React.createElement(Globe, { className: "w-4 h-4" }), " Free & paid sessions")), /* @__PURE__ */ React.createElement("h2", { className: "font-serif text-2xl sm:text-3xl md:text-4xl font-semibold text-white mb-4" }, "Teach the world \u2014 create your own public lecture"), /* @__PURE__ */ React.createElement(
    Link,
    {
      to: "/register",
      className: "inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold bg-white text-primary hover:bg-white/95 transition-colors shadow-none"
    },
    "Start Teaching Free",
    /* @__PURE__ */ React.createElement(ArrowRight, { className: "w-5 h-5" })
  )))), /* @__PURE__ */ React.createElement("footer", { className: "relative z-10 border-t border-border bg-card py-8 sm:py-12 px-4 sm:px-6 lg:px-8" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 justify-center md:justify-start" }, /* @__PURE__ */ React.createElement("img", { src: logo, alt: "Gracified", className: "w-8 h-8 rounded-xl flex-shrink-0" }), /* @__PURE__ */ React.createElement("span", { className: "font-serif font-semibold text-foreground text-sm sm:text-base text-center md:text-left" }, "Gracified Learning Platform")), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-4 sm:gap-6 text-sm text-muted-foreground flex-wrap justify-center md:justify-end" }, /* @__PURE__ */ React.createElement(Link, { to: "/catalog", className: "hover:text-primary font-medium transition-colors" }, "Explore Classes"), /* @__PURE__ */ React.createElement(Link, { to: "/privacy", className: "hover:text-primary font-medium transition-colors" }, "Privacy"), /* @__PURE__ */ React.createElement(Link, { to: "/terms", className: "hover:text-primary font-medium transition-colors" }, "Terms"), /* @__PURE__ */ React.createElement(Link, { to: "/login", className: "hover:text-primary font-medium transition-colors" }, "Sign In"), /* @__PURE__ */ React.createElement(Link, { to: "/register", className: "hover:text-primary font-medium transition-colors" }, "Register"))), /* @__PURE__ */ React.createElement("div", { className: "max-w-7xl mx-auto mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground/60" }, "\xA9 ", (/* @__PURE__ */ new Date()).getFullYear(), " Gracified Learning Platform. All rights reserved.")));
};
var Catalog_default = Catalog;
export {
  Catalog_default as default
};
