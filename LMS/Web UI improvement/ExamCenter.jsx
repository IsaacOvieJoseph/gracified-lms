import { useState } from "react";
import {
  Plus,
  Search,
  BookOpen,
  TrendingUp,
  Globe,
  Share2,
  Pencil,
  Trash2,
  BarChart2,
  Clock,
  Link2,
} from "lucide-react";

const INK = "#14202E";
const NAVY = "#1D3557";
const SLATE = "#5B6B7C";
const HAIRLINE = "#DDE3E9";
const PAPER = "#FFFFFF";
const PANEL = "#F7F8FA";
const GOLD = "#A9791F";
const FOREST = "#2F6E4E";

const exams = [
  {
    id: 1,
    title: "Formal MCQ Examination in Physics for 500L Mechanical Engineering",
    description: "This examination consists of 5 multiple-choice questions on the topic of motion in physics.",
    duration: "45 minutes",
    status: "Active",
  },
  {
    id: 2,
    title: "Formal MCQ Examination for 200L Mechanical Engineering",
    description: "This examination covers the topic of motion in physics at a general level. Candidates are expected to answer within the time limit.",
    duration: "30 minutes",
    status: "Draft",
  },
  {
    id: 3,
    title: "My Exam",
    description: "Test",
    duration: "20 minutes",
    status: "Draft",
  },
  {
    id: 4,
    title: "2025/2026 \u2013 Third Quarter Review",
    description: "Kindly attempt all questions. God bless you.",
    duration: "20 minutes",
    status: "Active",
  },
  {
    id: 5,
    title: "2025/2026 \u2013 Second Quarter Review",
    description: "Kindly attempt all questions. God bless you.",
    duration: "25 minutes",
    status: "Active",
  },
];

function StatCard({ icon: Icon, iconBg, iconColor, label, value }) {
  return (
    <div
      className="flex items-center justify-between px-5 py-4 flex-1 min-w-[220px]"
      style={{ backgroundColor: PAPER, border: `1px solid ${HAIRLINE}` }}
    >
      <div>
        <div className="text-xs" style={{ color: SLATE }}>{label}</div>
        <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: "24px", fontWeight: 600, color: INK }}>
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

function IconAction({ icon: Icon, color, borderColor }) {
  return (
    <button
      className="flex items-center justify-center w-8 h-8"
      style={{ border: `1px solid ${borderColor || HAIRLINE}`, borderRadius: "2px" }}
    >
      <Icon size={14} style={{ color }} />
    </button>
  );
}

function StatusBadge({ status }) {
  const active = status === "Active";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1"
      style={{
        color: active ? FOREST : SLATE,
        backgroundColor: active ? "#F2F8F4" : PANEL,
        border: `1px solid ${active ? "#CFE3D6" : HAIRLINE}`,
        borderRadius: "2px",
      }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: active ? FOREST : SLATE }}
      />
      {status}
    </span>
  );
}

function ExamRow({ exam, isLast }) {
  return (
    <div
      className="grid items-center px-6 py-4 gap-4"
      style={{
        gridTemplateColumns: "minmax(0,1fr) 150px 130px 160px",
        borderBottom: isLast ? "none" : `1px solid ${HAIRLINE}`,
      }}
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold" style={{ color: INK, fontFamily: "'Source Serif 4', serif" }}>
          {exam.title}
        </div>
        <div className="text-xs mt-1 truncate" style={{ color: SLATE }}>
          {exam.description}
        </div>
      </div>

      <div>
        <span
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1"
          style={{ color: FOREST, backgroundColor: "#F2F8F4", border: "1px solid #CFE3D6", borderRadius: "2px" }}
        >
          <Link2 size={12} />
          Public link
        </span>
        <div className="flex items-center gap-1.5 mt-2 text-xs" style={{ color: SLATE }}>
          <Clock size={12} />
          {exam.duration}
        </div>
      </div>

      <div>
        <StatusBadge status={exam.status} />
      </div>

      <div className="flex items-center gap-2">
        <IconAction icon={Share2} color={NAVY} />
        <IconAction icon={Pencil} color={GOLD} />
        <IconAction icon={Trash2} color="#A23B2E" borderColor="#EBD3CE" />
        <IconAction icon={BarChart2} color={SLATE} />
      </div>
    </div>
  );
}

export default function ExamCenter() {
  const [query, setQuery] = useState("");
  const activeCount = exams.filter((e) => e.status === "Active").length;

  return (
    <div
      className="w-full max-w-6xl mx-auto"
      style={{ fontFamily: "'Inter', sans-serif", color: INK, backgroundColor: PANEL, padding: "32px 20px" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&family=Inter:wght@400;500;600;700&display=swap');
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 style={{ fontFamily: "'Source Serif 4', serif", fontSize: "26px", fontWeight: 600, margin: 0, color: INK }}>
            Exam center
          </h1>
          <p className="text-sm mt-1" style={{ color: SLATE }}>
            Create and manage standardized exams and secure share links.
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
          style={{ backgroundColor: NAVY, color: PAPER, borderRadius: "2px" }}
        >
          <Plus size={16} />
          New exam
        </button>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <StatCard icon={BookOpen} iconBg="#E8EEF5" iconColor={NAVY} label="Total exams" value={exams.length} />
        <StatCard icon={TrendingUp} iconBg="#F2F8F4" iconColor={FOREST} label="Active exams" value={activeCount} />
        <StatCard icon={Globe} iconBg="#EEF1F4" iconColor={NAVY} label="Global access" value="Active" />
      </div>

      <div
        className="flex items-center gap-3 px-4 py-3 mb-6"
        style={{ border: `1px solid ${HAIRLINE}`, backgroundColor: PAPER, borderRadius: "2px" }}
      >
        <Search size={15} style={{ color: SLATE }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter exams by title"
          className="text-sm w-full outline-none bg-transparent"
          style={{ color: INK }}
        />
      </div>

      <div style={{ backgroundColor: PAPER, border: `1px solid ${HAIRLINE}` }}>
        <div
          className="grid px-6 py-3 text-xs font-semibold gap-4"
          style={{
            gridTemplateColumns: "minmax(0,1fr) 150px 130px 160px",
            backgroundColor: PANEL,
            borderBottom: `1px solid ${HAIRLINE}`,
            color: SLATE,
          }}
        >
          <span>Exam title</span>
          <span>Access mode</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {exams
          .filter((e) => e.title.toLowerCase().includes(query.toLowerCase()))
          .map((exam, i, arr) => (
            <ExamRow key={exam.id} exam={exam} isLast={i === arr.length - 1} />
          ))}
      </div>
    </div>
  );
}
