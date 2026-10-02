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

  for (const { type, label, keywords } of ASSIST_TYPES) {
    const kw = keywords.find((k) => lower.includes(k));
    if (!kw) continue;

    const kwIndex = lower.indexOf(kw);
    const before = lower.slice(0, kwIndex);
    const verb = ASSIST_VERBS.find((v) => before.includes(v));
    if (!verb) continue;

    let area = lower.slice(kwIndex + kw.length);
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

    return { type, label, verb, area, count };
  }
  return null;
};

export const isAssistRequest = (text) => !!extractAssistIntent(text);
