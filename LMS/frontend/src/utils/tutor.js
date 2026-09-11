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
