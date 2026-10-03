const PRACTICE_INTENT =
  /\b(practice|exercise|drill|quiz(?:z(?:es)?)?|test me|mock|mcq|multiple[- ]choice|assessment|past questions|questions?)\b/i;

const PRACTICE_PHRASE =
  /\b(?:ask me|give me|send me|set me|help me (?:practice|prepare))\s+(?:some|a few|a couple|few)?\s*\d*\s*(?:practice\s*)?questions?\b/i;

const PRACTICE_KEYWORDS_RE =
  /\b(practice questions|practice|exercise|drill|quiz(?:z(?:es)?)?|test me|mock|mcq|multiple[- ]choice|assessment|past questions|questions?)\b/i;

export const isPracticeRequest = (q) => {
  if (/^\s*(what\s+is|what\s+are|define|meaning\s+of|explain)\b/i.test(q)) return false;
  return PRACTICE_INTENT.test(q) || PRACTICE_PHRASE.test(q);
};

export const extractPracticeArea = (q) => {
  const m = q.match(PRACTICE_KEYWORDS_RE);
  if (!m) return '';
  let out = q.slice(m.index + m[0].length);
  for (let i = 0; i < 4; i++) {
    const prev = out;
    out = out.replace(/^\s*(?:on|in|about|for|with|of|at|me|us|some)\s+/i, '');
    if (out === prev) break;
  }
  return out.replace(/[.!?]+$/g, '').trim();
};

const QUANTITY_RE = /(?:^|\s)(\d{1,2})\s*(?:questions?|qs?|mcqs?|items?)?(?:\s|$)/i;

export const extractPracticeQuantity = (q) => {
  const m = q.match(QUANTITY_RE);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (n >= 1 && n <= 20) return n;
  return null;
};

export const isQuantityOnly = (q) => {
  return /^\s*\d{1,2}\s*(?:questions?|qs?|mcqs?|items?)?\s*$/i.test(q) || /^\s*\d{1,2}\s*$/i.test(q);
};

export const extractPracticeQuantityFromMessage = (q) => {
  const direct = extractPracticeQuantity(q);
  if (direct) return direct;
  const fallback = q.match(/\d{1,2}/);
  if (fallback) {
    const n = parseInt(fallback[0], 10);
    if (n >= 1 && n <= 20) return n;
  }
  return null;
};

// ── Assist (generation) intent ──────────────────────────────────────────────
// Turn "create a topic on quadratic equations" into an Assist tab action,
// mirroring how students trigger a quiz straight from chat.

const ASSIST_TYPES = [
  { type: 'classroom', label: 'Class', keywords: ['classroom', 'a class', 'class'] },
  { type: 'topic', label: 'Topic', keywords: ['topic'] },
  { type: 'syllabus', label: 'Syllabus', keywords: ['syllabus', 'curriculum'] },
  { type: 'assignment', label: 'Assignment', keywords: ['assignment'] },
  { type: 'exam', label: 'Exam', keywords: ['exam'] },
  { type: 'slides', label: 'Slides', keywords: ['slides', 'slide deck', 'presentation', 'powerpoint', 'power point', 'ppt'] },
];

const ASSIST_VERBS = ['create', 'generate', 'make', 'build', 'draft', 'prepare', 'write', 'produce', 'design', 'develop'];
const ASSIST_COUNT_RE = /(\d{1,2})\s*(questions?|qs|items|mcqs|slides?|marks?|minutes?|mins?)/i;

export const extractAssistIntent = (text) => {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();

  // A message can mention several assets ("create a topic for my JSS1 class").
  // Find EVERY verb-led keyword match, then pick the actual object of the
  // request instead of returning the first hit (classroom used to win on the
  // trailing "... class" destination phrase).
  const matches = [];
  for (const { type, label, keywords } of ASSIST_TYPES) {
    const kw = keywords.find((k) => lower.includes(k));
    if (!kw) continue;
    const kwIndex = lower.indexOf(kw);
    const before = lower.slice(0, kwIndex);
    const verb = ASSIST_VERBS.find((v) => before.includes(v));
    if (!verb) continue;
    matches.push({ type, label, kw, kwIndex, verb });
  }
  if (!matches.length) return null;

  // "class"/"a class" after "for/in/into my … class" is the DESTINATION, not
  // the asset being created — "create a topic for my JSS1 class" is a topic.
  // Prefer the content asset over a generic container mention; when both a
  // real "classroom" and an asset are requested, the earliest keyword wins.
  const assets = matches.filter((m) => m.type !== 'classroom');
  const container = matches.find((m) => m.type === 'classroom' && m.kw !== 'classroom');
  const exactRoom = matches.find((m) => m.type === 'classroom' && m.kw === 'classroom');
  let best;
  if (assets.length) {
    best = assets.reduce((a, b) => (b.kwIndex < a.kwIndex ? b : a));
    if (exactRoom && exactRoom.kwIndex < best.kwIndex) best = exactRoom;
  } else {
    best = container || exactRoom;
  }

  let area = lower.slice(best.kwIndex + best.kw.length);
  // Content assets: drop a trailing destination clause ("… for my JSS1 class",
  // "… for SS2") BEFORE loosening prepositions so the subject survives intact.
  if (best.type !== 'classroom') {
    area = area.replace(/\s+(?:for|into|to|in|under)\s+(?:(?:my|our|their|the|a|an)\s+)?(?:[a-z0-9'’ -]*\s?(?:class(?:room)?\b.*|\b(?:jss\d*|ss\d+|sss\d+|js\d+|basic\s?\d+|primary\s?\d+|junior\ssec|senior\ssec|nursery|kindergarten|kg|creche)\b[^,.;]*))$/i, '');
  }
  for (let i = 0; i < 6; i++) {
    const prev = area;
    area = area.replace(/^\s+(?:on|about|for|of|covering|with|in|around|me|us|an?|the|some|my|a|that)\s+/i, '');
    if (area === prev) break;
  }
  area = area
    .replace(/[\s,]*(with|using|covering|that has|that includes|that is about)\b.*$/i, '')
    .replace(/[?!.,;:]+$/g, '')
    .trim();

  const countMatch = lower.match(ASSIST_COUNT_RE);
  const count = countMatch ? Math.min(parseInt(countMatch[1], 10), 30) : null;

  return { type: best.type, label: best.label, verb: best.verb, area, count };
};

export const isAssistRequest = (text) => !!extractAssistIntent(text);

// ── AI intent classifier guard ────────────────────────────────────────────────
// Gracy's chat tab ALSO asks the backend AI to classify a message when word
// mapping finds nothing — a "second opinion" for clearly-worded messages the
// keyword rules miss. This guard short-circuits that AI call for obviously
// conversational turns (greetings, short replies, question-lead messages) so
// normal staff Q&A doesn't pay a pointless extra round-trip. It only skips
// blatant chat; anything else still goes to the classifier.
const CONVERSATIONAL_RE =
  /^(hi|hello|hey|yo|thanks|thank you|ok|okay|good\s+(?:morning|afternoon|evening)|bye|see you|gr8|great)\b/i;

const QNA_LEAD_RE =
  /\b(explain|define|meaning\s+of|what\s+is|what\s+are|what'?s|who|when|where|why\s+(?:is|do|did|can|would)|how\s+(?:do|does|can|is|are|would)|difference\s+between|describe|tell\s+me\s+about|summar[iy]se|give\s+me\s+the\s+answer)\b/i;

export const shouldUseAIIntentClassifier = (text) => {
  const q = String(text || '').trim();
  if (!q) return false;
  if (q.split(/\s+/).length < 3) return false;
  if (CONVERSATIONAL_RE.test(q)) return false;
  if (QNA_LEAD_RE.test(q)) return false;
  return true;
};
