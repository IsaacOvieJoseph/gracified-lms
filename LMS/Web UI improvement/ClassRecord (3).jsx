import { useState, useRef, useEffect } from "react";
import {
  Eye,
  Share2,
  Pencil,
  Flag,
  Trash2,
  User,
  Building2,
  Calendar,
  Video,
  PenSquare,
  BookOpen,
  GraduationCap,
  FileText,
  MessageSquare,
  Users,
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

const tabs = [
  { key: "topics", label: "Topics", icon: BookOpen },
  { key: "assignments", label: "Assignments", icon: FileText },
  { key: "exams", label: "Exams", icon: GraduationCap, count: 2 },
  { key: "qa", label: "Q&A boards", icon: MessageSquare },
  { key: "students", label: "Students", icon: Users },
];

function ActionButton({ icon: Icon, label, tone = "default", onClick }) {
  const tones = {
    default: { color: INK, border: HAIRLINE, bg: PAPER },
    danger: { color: "#A23B2E", border: "#EBD3CE", bg: "#FCF5F3" },
    solid: { color: PAPER, border: INK, bg: INK },
  };
  const t = tones[tone];
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors"
      style={{
        color: t.color,
        backgroundColor: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: "2px",
      }}
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
        <div
          className="absolute right-0 mt-1 z-10"
          style={{
            backgroundColor: PAPER,
            border: `1px solid ${HAIRLINE}`,
            borderRadius: "2px",
            minWidth: "160px",
            boxShadow: "0 2px 6px rgba(20,32,46,0.08)",
          }}
        >
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-left"
                style={{
                  color: item.color,
                  borderBottom: i < items.length - 1 ? `1px solid ${HAIRLINE}` : "none",
                }}
              >
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
    <div
      className="flex items-start gap-3 px-5 py-4"
      style={borderRight ? { borderRight: `1px solid ${HAIRLINE}` } : undefined}
    >
      <Icon size={17} strokeWidth={1.75} style={{ color: SLATE, marginTop: 2 }} />
      <div>
        <div className="text-xs" style={{ color: SLATE }}>
          {label}
        </div>
        <div className="text-sm font-semibold mt-0.5" style={{ color: INK }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function ClassRecord() {
  const [activeTab, setActiveTab] = useState("topics");

  return (
    <div
      className="w-full max-w-4xl mx-auto"
      style={{
        fontFamily: "'Inter', sans-serif",
        color: INK,
        backgroundColor: PANEL,
        padding: "32px 20px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&family=Inter:wght@400;500;600;700&display=swap');
      `}</style>

      <div style={{ backgroundColor: PAPER, border: `1px solid ${HAIRLINE}` }}>
        {/* Header */}
        <div
          className="flex flex-wrap items-center justify-between gap-4 px-6 py-5"
          style={{ borderBottom: `1px solid ${HAIRLINE}` }}
        >
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: FOREST }}
              />
              <span className="text-xs font-semibold" style={{ color: FOREST, letterSpacing: "0.02em" }}>
                Published
              </span>
            </div>
            <h1
              style={{
                fontFamily: "'Source Serif 4', serif",
                fontSize: "28px",
                fontWeight: 600,
                lineHeight: 1.15,
                margin: 0,
              }}
            >
              Test Class
            </h1>
            <p className="text-sm mt-1" style={{ color: SLATE }}>
              Chemistry &middot; Primary level
            </p>
          </div>

          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <ActionButton icon={Eye} label="Publish" />
              <ActionButton icon={Share2} label="Share" />
              <OverflowMenu />
            </div>

            <div style={{ width: "1px", alignSelf: "stretch", backgroundColor: HAIRLINE }} />

            <div className="text-right">
              <div
                className="text-2xl font-semibold"
                style={{ color: GOLD, fontFamily: "'Source Serif 4', serif" }}
              >
                &#8358;200
              </div>
              <div className="text-xs" style={{ color: SLATE }}>
                per lecture
              </div>
            </div>
          </div>
        </div>

        {/* Record grid */}
        <div
          className="grid grid-cols-1 sm:grid-cols-3"
          style={{ borderBottom: `1px solid ${HAIRLINE}` }}
        >
          <RecordField icon={User} label="Teacher" borderRight>
            Isaac Joseph
          </RecordField>
          <RecordField icon={Building2} label="Academic host" borderRight>
            Sunday School
          </RecordField>
          <RecordField icon={Calendar} label="Schedule">
            Mon, Tue &middot; 09:00–10:00
          </RecordField>
        </div>

        {/* Primary actions */}
        <div className="flex flex-wrap gap-3 px-6 py-5">
          <button
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
            style={{ backgroundColor: NAVY, color: PAPER, borderRadius: "2px" }}
          >
            <Video size={16} />
            Start lecture
          </button>
          <button
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
            style={{
              backgroundColor: PAPER,
              color: INK,
              border: `1px solid ${HAIRLINE}`,
              borderRadius: "2px",
            }}
          >
            <PenSquare size={16} />
            Open whiteboard
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex flex-wrap mt-6"
        style={{ borderBottom: `1px solid ${HAIRLINE}`, backgroundColor: PAPER }}
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-5 py-3 text-sm font-medium"
              style={{
                color: active ? NAVY : SLATE,
                borderBottom: active ? `2px solid ${NAVY}` : "2px solid transparent",
                marginBottom: "-1px",
              }}
            >
              <Icon size={15} />
              {tab.label}
              {tab.count != null && (
                <span
                  className="text-xs font-semibold px-1.5 rounded-full"
                  style={{
                    backgroundColor: active ? NAVY : HAIRLINE,
                    color: active ? PAPER : SLATE,
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div
        className="flex items-center justify-between px-6 py-6"
        style={{ backgroundColor: PAPER, border: `1px solid ${HAIRLINE}`, borderTop: "none" }}
      >
        <div>
          <div
            className="text-sm font-semibold"
            style={{ color: NAVY, fontFamily: "'Source Serif 4', serif" }}
          >
            Topics
          </div>
          <div className="text-sm mt-1" style={{ color: SLATE }}>
            2 modules in syllabus
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: NAVY, color: PAPER, borderRadius: "2px" }}
          >
            <Sparkles size={15} />
            Generate topics
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold"
            style={{
              backgroundColor: PAPER,
              color: INK,
              border: `1px solid ${HAIRLINE}`,
              borderRadius: "2px",
            }}
          >
            <BookOpen size={15} />
            Manage topics
          </button>
        </div>
      </div>
    </div>
  );
}
