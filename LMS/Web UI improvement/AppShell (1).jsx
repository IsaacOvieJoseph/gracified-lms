import { useState, useRef, useEffect } from "react";
import {
  LayoutGrid,
  BookOpen,
  Radio,
  CreditCard,
  GraduationCap,
  Users,
  BarChart3,
  Landmark,
  LogOut,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Bell,
  Sun,
  Search,
  SlidersHorizontal,
  Layers,
  Coins,
  Plus,
  User,
  Calendar,
  Eye,
  Trash2,
  ArrowRight,
  Share2,
  Pencil,
  Flag,
  Video,
  PenSquare,
  FileText,
  MessageSquare,
  Sparkles,
  MoreHorizontal,
} from "lucide-react";

const INK = "#14202E";
const NAVY = "#1D3557";
const SLATE = "#5B6B7C";
const HAIRLINE = "#DDE3E9";
const PAPER = "#FFFFFF";
const PANEL = "#F7F8FA";
const GOLD = "#A9791F";
const FOREST = "#2F6E4E";

const navItems = [
  { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { key: "classrooms", label: "Classrooms", icon: BookOpen },
  { key: "public", label: "Public classes", icon: Radio },
  { key: "payments", label: "Payments", icon: CreditCard },
  { key: "exams", label: "Exams", icon: GraduationCap },
  { key: "users", label: "Users", icon: Users },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "schools", label: "Schools", icon: Landmark },
];

const classes = [
  { id: 1, name: "Test Class", teacher: "Isaac Joseph", level: "Primary", schedule: "Mon, Tue \u00b7 09:00", enrolled: 1, price: "\u20A6200", unit: "per lecture", description: "test class", host: "Sunday School" },
  { id: 2, name: "Piano Class", teacher: "Isaac Joseph", level: "Vocational", schedule: "Sat 13:15 (GMT+01:00)", enrolled: 3, price: "Free", description: "Learn the basics of music and play gospel piano style", host: "Sunday School" },
  { id: 3, name: "Sunday School", teacher: "Sunday School Teacher", level: "Other", schedule: "Sun, 09:00 (GMT+01:00)", enrolled: 4, price: "Free", description: "Learn at HIS feet", host: "Sunday School" },
  { id: 4, name: "Future of AI Education", teacher: "\u2014", level: "\u2014", schedule: "No schedule", enrolled: 2, price: "Free", description: "Description", host: "Sunday School +2" },
];


/* ---------- Shell chrome ---------- */

function Sidebar({ active, onNavigate }) {
  return (
    <aside
      className="hidden md:flex flex-col shrink-0 h-full"
      style={{ width: "248px", backgroundColor: PAPER, borderRight: `1px solid ${HAIRLINE}` }}
    >
      <div className="flex items-center gap-2.5 px-6 shrink-0" style={{ height: "73px", borderBottom: `1px solid ${HAIRLINE}` }}>
        <div
          className="flex items-center justify-center w-8 h-8 text-sm font-bold"
          style={{ backgroundColor: NAVY, color: PAPER, borderRadius: "2px" }}
        >
          G
        </div>
        <span style={{ fontFamily: "'Source Serif 4', serif", fontSize: "18px", fontWeight: 600, color: INK }}>
          Gracified
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === active;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm mb-0.5 text-left"
              style={{
                color: isActive ? NAVY : SLATE,
                fontWeight: isActive ? 600 : 500,
                backgroundColor: isActive ? PANEL : "transparent",
                borderLeft: isActive ? `2px solid ${NAVY}` : "2px solid transparent",
              }}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-4" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
        <div className="flex items-center gap-3 px-2 py-2">
          <div
            className="flex items-center justify-center w-9 h-9 text-xs font-semibold shrink-0"
            style={{ backgroundColor: PANEL, color: NAVY, border: `1px solid ${HAIRLINE}`, borderRadius: "2px" }}
          >
            RC
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: INK }}>
              RCCG CAA YP4
            </div>
            <div className="text-xs" style={{ color: SLATE }}>
              School admin
            </div>
          </div>
        </div>
        <button
          className="flex items-center gap-2 w-full px-2 py-2.5 mt-1 text-sm font-medium"
          style={{ color: "#A23B2E" }}
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function Header({ crumbs, onBack }) {
  return (
    <header
      className="flex items-center justify-between gap-4 px-6 shrink-0"
      style={{ height: "73px", backgroundColor: PAPER, borderBottom: `1px solid ${HAIRLINE}` }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-8 h-8 shrink-0"
          style={{ border: `1px solid ${HAIRLINE}`, borderRadius: "2px" }}
          aria-label="Go back"
        >
          <ArrowLeft size={15} style={{ color: INK }} />
        </button>
        <div className="flex items-center gap-1.5 text-sm min-w-0 overflow-hidden">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5 whitespace-nowrap">
              {i > 0 && <ChevronRight size={13} style={{ color: SLATE }} />}
              <span
                style={{
                  color: i === crumbs.length - 1 ? INK : NAVY,
                  fontWeight: i === crumbs.length - 1 ? 600 : 500,
                }}
              >
                {c}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          className="hidden sm:flex items-center justify-center w-9 h-9"
          style={{ backgroundColor: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: "2px" }}
          aria-label="Toggle theme"
        >
          <Sun size={15} style={{ color: SLATE }} />
        </button>

        <div className="hidden lg:flex items-center gap-2 text-sm">
          <span style={{ color: SLATE }}>School:</span>
          <div
            className="flex items-center gap-2 px-3 py-1.5"
            style={{ border: `1px solid ${HAIRLINE}`, borderRadius: "2px" }}
          >
            <span className="font-medium" style={{ color: INK }}>
              Sunday School
            </span>
            <ChevronDown size={14} style={{ color: SLATE }} />
          </div>
        </div>

        <button
          className="relative flex items-center justify-center w-9 h-9"
          style={{ border: `1px solid ${HAIRLINE}`, borderRadius: "2px" }}
          aria-label="Notifications"
        >
          <Bell size={15} style={{ color: SLATE }} />
          <span
            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "#A23B2E" }}
          />
        </button>

        <div
          className="flex items-center justify-center w-9 h-9 text-xs font-semibold"
          style={{ backgroundColor: NAVY, color: PAPER, borderRadius: "2px" }}
        >
          IJ
        </div>
      </div>
    </header>
  );
}

/* ---------- Listing view ---------- */

function FilterField({ icon: Icon, placeholder }) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3 flex-1 min-w-[160px]"
      style={{ border: `1px solid ${HAIRLINE}`, backgroundColor: PAPER, borderRadius: "2px" }}
    >
      <span className="text-sm font-medium" style={{ color: SLATE }}>{placeholder}</span>
      <Icon size={15} style={{ color: SLATE }} />
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon size={14} style={{ color: SLATE }} />
      <span style={{ color: SLATE }}>{label}</span>
      <span className="font-semibold" style={{ color: INK }}>{value}</span>
    </div>
  );
}

function ClassCard({ item, onView }) {
  return (
    <div className="flex flex-col" style={{ backgroundColor: PAPER, border: `1px solid ${HAIRLINE}` }}>
      <div style={{ height: "3px", backgroundColor: NAVY }} />
      <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
        <div className="flex items-start justify-between gap-3">
          <h3 style={{ fontFamily: "'Source Serif 4', serif", fontSize: "19px", fontWeight: 600, margin: 0, color: INK }}>
            {item.name}
          </h3>
          {item.price === "Free" ? (
            <span className="text-xs font-semibold px-2 py-1" style={{ color: FOREST, border: `1px solid #CFE3D6`, backgroundColor: "#F2F8F4", borderRadius: "2px" }}>
              Free
            </span>
          ) : (
            <div className="text-right">
              <div className="text-lg font-semibold leading-none" style={{ color: GOLD, fontFamily: "'Source Serif 4', serif" }}>
                {item.price}
              </div>
              <div className="text-xs mt-1" style={{ color: SLATE }}>{item.unit}</div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2 text-sm" style={{ color: SLATE }}>
          <User size={14} />
          {item.teacher}
        </div>
      </div>
      <div className="px-5 py-3 flex flex-col gap-2" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
        <DetailRow icon={Layers} label="Level:" value={item.level} />
        <DetailRow icon={Calendar} label="Schedule:" value={item.schedule} />
      </div>
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
        <div className="flex items-center gap-2 text-sm" style={{ color: SLATE }}>
          <Users size={14} />
          {item.enrolled} enrolled
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center justify-center w-8 h-8" style={{ border: `1px solid ${HAIRLINE}`, borderRadius: "2px" }} aria-label="Preview class">
            <Eye size={14} style={{ color: INK }} />
          </button>
          <button className="flex items-center justify-center w-8 h-8" style={{ border: `1px solid #EBD3CE`, borderRadius: "2px" }} aria-label="Delete class">
            <Trash2 size={14} style={{ color: "#A23B2E" }} />
          </button>
        </div>
      </div>
      <div className="px-5 py-4">
        <button
          onClick={onView}
          className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-semibold"
          style={{ backgroundColor: NAVY, color: PAPER, borderRadius: "2px" }}
        >
          View classroom
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}

function ExploreAcademies({ onSelectClass }) {
  const [query, setQuery] = useState("");
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 mb-6" style={{ backgroundColor: PAPER, border: `1px solid ${HAIRLINE}` }}>
        <div>
          <h1 style={{ fontFamily: "'Source Serif 4', serif", fontSize: "26px", fontWeight: 600, margin: 0, color: INK }}>
            Explore academies
          </h1>
          <p className="text-sm mt-1" style={{ color: SLATE }}>Browse and manage the classes you teach or oversee.</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold" style={{ backgroundColor: NAVY, color: PAPER, borderRadius: "2px" }}>
          <Plus size={16} />
          Create new class
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3 px-4 py-3 flex-[2] min-w-[220px]" style={{ border: `1px solid ${HAIRLINE}`, backgroundColor: PAPER, borderRadius: "2px" }}>
          <Search size={15} style={{ color: SLATE }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by title, subject, or teacher"
            className="text-sm w-full outline-none bg-transparent"
            style={{ color: INK }}
          />
        </div>
        <FilterField icon={SlidersHorizontal} placeholder="All subjects" />
        <FilterField icon={Layers} placeholder="All levels" />
        <FilterField icon={Coins} placeholder="All prices" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
        {classes.map((item) => (
          <ClassCard key={item.id} item={item} onView={() => onSelectClass(item)} />
        ))}
      </div>
    </div>
  );
}

/* ---------- Detail view ---------- */

function ActionButton({ icon: Icon, label }) {
  return (
    <button
      className="flex items-center gap-2 px-3 py-2 text-sm font-medium"
      style={{ color: INK, backgroundColor: PAPER, border: `1px solid ${HAIRLINE}`, borderRadius: "2px" }}
    >
      <Icon size={15} strokeWidth={2} />
      {label}
    </button>
  );
}

function OverflowMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
  const items = [
    { icon: Pencil, label: "Edit", color: INK },
    { icon: Flag, label: "End class", color: INK },
    { icon: Trash2, label: "Delete", color: "#A23B2E" },
  ];
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center w-9 h-9"
        style={{ border: `1px solid ${HAIRLINE}`, backgroundColor: PAPER, borderRadius: "2px" }}
        aria-label="More actions"
      >
        <MoreHorizontal size={16} style={{ color: INK }} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-10" style={{ backgroundColor: PAPER, border: `1px solid ${HAIRLINE}`, borderRadius: "2px", minWidth: "160px", boxShadow: "0 2px 6px rgba(20,32,46,0.08)" }}>
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <button key={item.label} onClick={() => setOpen(false)} className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-left" style={{ color: item.color, borderBottom: i < items.length - 1 ? `1px solid ${HAIRLINE}` : "none" }}>
                <Icon size={15} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RecordField({ icon: Icon, label, children, borderRight }) {
  return (
    <div className="flex items-start gap-3 px-5 py-4" style={borderRight ? { borderRight: `1px solid ${HAIRLINE}` } : undefined}>
      <Icon size={17} strokeWidth={1.75} style={{ color: SLATE, marginTop: 2 }} />
      <div>
        <div className="text-xs" style={{ color: SLATE }}>{label}</div>
        <div className="text-sm font-semibold mt-0.5" style={{ color: INK }}>{children}</div>
      </div>
    </div>
  );
}

const tabs = [
  { key: "topics", label: "Topics", icon: BookOpen },
  { key: "assignments", label: "Assignments", icon: FileText },
  { key: "exams", label: "Exams", icon: GraduationCap, count: 2 },
  { key: "qa", label: "Q&A boards", icon: MessageSquare },
  { key: "students", label: "Students", icon: Users },
];

function ClassRecord({ item }) {
  const [activeTab, setActiveTab] = useState("topics");
  return (
    <div>
      <div style={{ backgroundColor: PAPER, border: `1px solid ${HAIRLINE}` }}>
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: FOREST }} />
              <span className="text-xs font-semibold" style={{ color: FOREST, letterSpacing: "0.02em" }}>Published</span>
            </div>
            <h1 style={{ fontFamily: "'Source Serif 4', serif", fontSize: "28px", fontWeight: 600, lineHeight: 1.15, margin: 0 }}>
              {item.name}
            </h1>
            <p className="text-sm mt-1" style={{ color: SLATE }}>Chemistry &middot; {item.level} level</p>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <ActionButton icon={Eye} label="Publish" />
              <ActionButton icon={Share2} label="Share" />
              <OverflowMenu />
            </div>
            <div style={{ width: "1px", alignSelf: "stretch", backgroundColor: HAIRLINE }} />
            <div className="text-right">
              <div className="text-2xl font-semibold" style={{ color: item.price === "Free" ? FOREST : GOLD, fontFamily: "'Source Serif 4', serif" }}>
                {item.price}
              </div>
              <div className="text-xs" style={{ color: SLATE }}>{item.unit || "no charge"}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
          <RecordField icon={User} label="Teacher" borderRight>{item.teacher}</RecordField>
          <RecordField icon={Landmark} label="Academic host" borderRight>{item.host}</RecordField>
          <RecordField icon={Calendar} label="Schedule">{item.schedule}</RecordField>
        </div>

        <div className="flex flex-wrap gap-3 px-6 py-5">
          <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold" style={{ backgroundColor: NAVY, color: PAPER, borderRadius: "2px" }}>
            <Video size={16} />
            Start lecture
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold" style={{ backgroundColor: PAPER, color: INK, border: `1px solid ${HAIRLINE}`, borderRadius: "2px" }}>
            <PenSquare size={16} />
            Open whiteboard
          </button>
        </div>
      </div>

      <div className="flex flex-wrap mt-6" style={{ borderBottom: `1px solid ${HAIRLINE}`, backgroundColor: PAPER }}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="flex items-center gap-2 px-5 py-3 text-sm font-medium" style={{ color: active ? NAVY : SLATE, borderBottom: active ? `2px solid ${NAVY}` : "2px solid transparent", marginBottom: "-1px" }}>
              <Icon size={15} />
              {tab.label}
              {tab.count != null && (
                <span className="text-xs font-semibold px-1.5 rounded-full" style={{ backgroundColor: active ? NAVY : HAIRLINE, color: active ? PAPER : SLATE }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-6 py-6" style={{ backgroundColor: PAPER, border: `1px solid ${HAIRLINE}`, borderTop: "none" }}>
        <div>
          <div className="text-sm font-semibold" style={{ color: NAVY, fontFamily: "'Source Serif 4', serif" }}>Topics</div>
          <div className="text-sm mt-1" style={{ color: SLATE }}>2 modules in syllabus</div>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold" style={{ backgroundColor: NAVY, color: PAPER, borderRadius: "2px" }}>
            <Sparkles size={15} />
            Generate topics
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold" style={{ backgroundColor: PAPER, color: INK, border: `1px solid ${HAIRLINE}`, borderRadius: "2px" }}>
            <BookOpen size={15} />
            Manage topics
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Dashboard view ---------- */

function StatCard({ icon: Icon, iconBg, iconColor, label, value }) {
  return (
    <div
      className="flex items-center justify-between px-5 py-4 flex-1 min-w-[220px]"
      style={{ backgroundColor: PAPER, border: `1px solid ${HAIRLINE}` }}
    >
      <div>
        <div className="text-xs" style={{ color: SLATE }}>{label}</div>
        <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: "26px", fontWeight: 600, color: INK }}>
          {value}
        </div>
      </div>
      <div
        className="flex items-center justify-center w-10 h-10 shrink-0"
        style={{ backgroundColor: iconBg, borderRadius: "2px" }}
      >
        <Icon size={18} style={{ color: iconColor }} />
      </div>
    </div>
  );
}

function CollapsibleSection({ title, subtitle, right, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ backgroundColor: PAPER, border: `1px solid ${HAIRLINE}` }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-5 py-4 text-left"
        style={open ? { borderBottom: `1px solid ${HAIRLINE}` } : undefined}
      >
        <div>
          <div className="text-sm font-semibold" style={{ color: INK }}>{title}</div>
          {subtitle && <div className="text-xs mt-0.5" style={{ color: SLATE }}>{subtitle}</div>}
        </div>
        <div className="flex items-center gap-3">
          {right}
          {open ? <ChevronUp size={16} style={{ color: SLATE }} /> : <ChevronDown size={16} style={{ color: SLATE }} />}
        </div>
      </button>
      {open && children}
    </div>
  );
}

function ClassListRow({ item, onView, isLast }) {
  return (
    <div
      className="flex items-center justify-between gap-4 px-5 py-4"
      style={{ borderBottom: isLast ? "none" : `1px solid ${HAIRLINE}` }}
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold" style={{ color: INK, fontFamily: "'Source Serif 4', serif" }}>
          {item.name}
        </div>
        <div className="text-xs mt-0.5" style={{ color: SLATE }}>{item.description}</div>
        <div className="flex flex-wrap items-center gap-4 mt-2 text-xs" style={{ color: SLATE }}>
          <span className="flex items-center gap-1.5">
            <Landmark size={12} />
            {item.host}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar size={12} />
            {item.schedule}
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={12} />
            {item.enrolled} students
          </span>
        </div>
      </div>
      <button
        onClick={onView}
        className="flex items-center gap-1.5 text-sm font-semibold shrink-0"
        style={{ color: NAVY }}
      >
        View class
        <ArrowRight size={14} />
      </button>
    </div>
  );
}

function Dashboard({ onSelectClass }) {
  const todaysSession = classes.find((c) => c.id === 1);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-xs font-semibold" style={{ color: SLATE }}>School overview</div>
        <h1 style={{ fontFamily: "'Source Serif 4', serif", fontSize: "28px", fontWeight: 600, margin: "4px 0 0" }}>
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: SLATE }}>
          Good afternoon, RCCG &middot; Tuesday, September 15, 2026
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <StatCard icon={BookOpen} iconBg="#E8EEF5" iconColor={NAVY} label="Total classes" value={classes.length} />
        <StatCard icon={Users} iconBg="#F2F8F4" iconColor={FOREST} label="Students enrolled" value={7} />
      </div>

      <CollapsibleSection
        title="Schedule"
        subtitle="Upcoming class sessions"
        right={
          <div className="flex items-center" style={{ border: `1px solid ${HAIRLINE}`, borderRadius: "2px" }}>
            <span className="px-3 py-1.5 text-xs font-semibold" style={{ backgroundColor: PANEL, color: INK }}>
              Today
            </span>
            <span className="px-3 py-1.5 text-xs font-medium" style={{ color: SLATE }}>
              Weekly
            </span>
          </div>
        }
      >
        <div className="px-5 py-4">
          <div
            className="flex items-center justify-between gap-4 px-4 py-3"
            style={{ border: `1px solid ${HAIRLINE}`, borderRadius: "2px" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex flex-col items-center justify-center px-3 py-1.5"
                style={{ backgroundColor: "#E8EEF5", borderRadius: "2px" }}
              >
                <span className="text-sm font-semibold" style={{ color: NAVY }}>09:00</span>
                <span className="text-[10px]" style={{ color: SLATE }}>GMT+01:00</span>
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: INK }}>{todaysSession.name}</div>
                <div className="text-xs" style={{ color: SLATE }}>Chemistry</div>
              </div>
            </div>
            <button
              onClick={() => onSelectClass(todaysSession)}
              className="text-sm font-semibold"
              style={{ color: NAVY }}
            >
              Open class
            </button>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Recent activity">
        <div className="flex items-center justify-center px-5 py-10 text-sm" style={{ color: SLATE }}>
          No recent activity yet.
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="All classes">
        <div>
          {classes.map((item, i) => (
            <ClassListRow
              key={item.id}
              item={item}
              onView={() => onSelectClass(item)}
              isLast={i === classes.length - 1}
            />
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}

/* ---------- App shell ---------- */

export default function AppShell() {
  const [page, setPage] = useState("dashboard");
  const [selected, setSelected] = useState(null);

  function goToClass(item) {
    setSelected(item);
    setPage("classrooms");
  }

  function navigate(key) {
    setSelected(null);
    setPage(key);
  }

  const crumbs =
    page === "dashboard"
      ? ["LMS", "Dashboard"]
      : selected
      ? ["LMS", "Classrooms", selected.name]
      : ["LMS", "Classrooms"];

  return (
    <div className="flex w-full" style={{ fontFamily: "'Inter', sans-serif", color: INK, height: "100vh", backgroundColor: PANEL, overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&family=Inter:wght@400;500;600;700&display=swap');
      `}</style>

      <Sidebar active={page} onNavigate={navigate} />

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header crumbs={crumbs} onBack={() => setSelected(null)} />
        <main className="flex-1 px-6 py-6 overflow-y-auto">
          {page === "dashboard" && <Dashboard onSelectClass={goToClass} />}
          {page === "classrooms" &&
            (selected ? (
              <ClassRecord item={selected} />
            ) : (
              <ExploreAcademies onSelectClass={goToClass} />
            ))}
        </main>
      </div>
    </div>
  );
}
