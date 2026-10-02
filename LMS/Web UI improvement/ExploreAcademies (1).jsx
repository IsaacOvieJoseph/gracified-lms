import { useState } from "react";
import {
  Search,
  SlidersHorizontal,
  Layers,
  Coins,
  Plus,
  User,
  Calendar,
  Users,
  Eye,
  Trash2,
  ArrowRight,
} from "lucide-react";

const INK = "#14202E";
const NAVY = "#1D3557";
const SLATE = "#5B6B7C";
const HAIRLINE = "#DDE3E9";
const PAPER = "#FFFFFF";
const PANEL = "#F7F8FA";
const GOLD = "#A9791F";
const FOREST = "#2F6E4E";

const classes = [
  {
    id: 1,
    name: "Test Class",
    teacher: "Isaac Joseph",
    level: "Primary",
    schedule: "Monday, 08:00",
    enrolled: 1,
    price: "\u20A6200",
    unit: "per lecture",
  },
  {
    id: 2,
    name: "Piano Class",
    teacher: "Isaac Joseph",
    level: "Vocational",
    schedule: "Saturday, 12:15",
    enrolled: 3,
    price: "Free",
  },
  {
    id: 3,
    name: "Sunday School",
    teacher: "Sunday School Teacher",
    level: "Other",
    schedule: "Sunday, 07:00",
    enrolled: 1,
    price: "Free",
  },
  {
    id: 4,
    name: "Basic Algebra",
    teacher: "Grace Nwosu",
    level: "Secondary",
    schedule: "Wednesday, 10:00",
    enrolled: 5,
    price: "\u20A6350",
    unit: "per lecture",
  },
  {
    id: 5,
    name: "French Conversation",
    teacher: "Amara Chukwu",
    level: "Adult",
    schedule: "Thursday, 17:00",
    enrolled: 2,
    price: "\u20A6500",
    unit: "per lecture",
  },
  {
    id: 6,
    name: "Digital Art Studio",
    teacher: "Kunle Adeyemi",
    level: "Vocational",
    schedule: "Friday, 14:30",
    enrolled: 4,
    price: "Free",
  },
  {
    id: 7,
    name: "Robotics Club",
    teacher: "Isaac Joseph",
    level: "Secondary",
    schedule: "Tuesday, 15:00",
    enrolled: 6,
    price: "\u20A6600",
    unit: "per lecture",
  },
  {
    id: 8,
    name: "Bible Study",
    teacher: "Sunday School Teacher",
    level: "Other",
    schedule: "Sunday, 09:00",
    enrolled: 2,
    price: "Free",
  },
  {
    id: 9,
    name: "Guitar for Beginners",
    teacher: "Isaac Joseph",
    level: "Vocational",
    schedule: "Saturday, 10:00",
    enrolled: 3,
    price: "\u20A6300",
    unit: "per lecture",
  },
];

function FilterField({ icon: Icon, placeholder, value }) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3 flex-1 min-w-[180px]"
      style={{ border: `1px solid ${HAIRLINE}`, backgroundColor: PAPER, borderRadius: "2px" }}
    >
      <span className="text-sm font-medium" style={{ color: value ? INK : SLATE }}>
        {value || placeholder}
      </span>
      <Icon size={15} style={{ color: SLATE }} />
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon size={14} style={{ color: SLATE }} />
      <span style={{ color: SLATE }}>{label}</span>
      <span className="font-semibold" style={{ color: INK }}>
        {value}
      </span>
    </div>
  );
}

function ClassCard({ item }) {
  return (
    <div
      className="flex flex-col"
      style={{ backgroundColor: PAPER, border: `1px solid ${HAIRLINE}` }}
    >
      <div style={{ height: "3px", backgroundColor: NAVY }} />

      <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
        <div className="flex items-start justify-between gap-3">
          <h3
            style={{
              fontFamily: "'Source Serif 4', serif",
              fontSize: "19px",
              fontWeight: 600,
              margin: 0,
              color: INK,
            }}
          >
            {item.name}
          </h3>
          {item.price === "Free" ? (
            <span
              className="text-xs font-semibold px-2 py-1"
              style={{ color: FOREST, border: `1px solid #CFE3D6`, backgroundColor: "#F2F8F4", borderRadius: "2px" }}
            >
              Free
            </span>
          ) : (
            <div className="text-right">
              <div
                className="text-lg font-semibold leading-none"
                style={{ color: GOLD, fontFamily: "'Source Serif 4', serif" }}
              >
                {item.price}
              </div>
              <div className="text-xs mt-1" style={{ color: SLATE }}>
                {item.unit}
              </div>
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
          <button
            className="flex items-center justify-center w-8 h-8"
            style={{ border: `1px solid ${HAIRLINE}`, borderRadius: "2px" }}
            aria-label="Preview class"
          >
            <Eye size={14} style={{ color: INK }} />
          </button>
          <button
            className="flex items-center justify-center w-8 h-8"
            style={{ border: `1px solid #EBD3CE`, borderRadius: "2px" }}
            aria-label="Delete class"
          >
            <Trash2 size={14} style={{ color: "#A23B2E" }} />
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        <button
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

export default function ExploreAcademies() {
  const [query, setQuery] = useState("");

  return (
    <div
      className="w-full max-w-6xl mx-auto"
      style={{ fontFamily: "'Inter', sans-serif", color: INK, backgroundColor: PANEL, padding: "32px 20px" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&family=Inter:wght@400;500;600;700&display=swap');
      `}</style>

      {/* Page header */}
      <div
        className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 mb-6"
        style={{ backgroundColor: PAPER, border: `1px solid ${HAIRLINE}` }}
      >
        <div>
          <h1
            style={{
              fontFamily: "'Source Serif 4', serif",
              fontSize: "26px",
              fontWeight: 600,
              margin: 0,
              color: INK,
            }}
          >
            Explore academies
          </h1>
          <p className="text-sm mt-1" style={{ color: SLATE }}>
            Browse and manage the classes you teach or oversee.
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
          style={{ backgroundColor: NAVY, color: PAPER, borderRadius: "2px" }}
        >
          <Plus size={16} />
          Create new class
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div
          className="flex items-center gap-3 px-4 py-3 flex-[2] min-w-[220px]"
          style={{ border: `1px solid ${HAIRLINE}`, backgroundColor: PAPER, borderRadius: "2px" }}
        >
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

      {/* Class grid */}
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}
      >
        {classes.map((item) => (
          <ClassCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
