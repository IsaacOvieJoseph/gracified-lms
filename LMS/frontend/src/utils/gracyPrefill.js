import api from './api';

// ── Gracy → create-form prefill handoff ──────────────────────────────────────
// The AI chat/Assist output can "Open in create form": we stash the prefilled
// shape in a module store, navigate to the page that hosts the create form, and
// the page consumes it on mount (or as soon as it renders its modal).
const pending = { entity: null, data: null };

export const setGracyPrefill = (entity, data) => {
  pending.entity = entity;
  pending.data = data;
};

export const consumeGracyPrefill = (entity) => {
  if (pending.entity === entity) {
    const out = pending.data;
    pending.entity = null;
    pending.data = null;
    return out;
  }
  return null;
};

// Shape an AI generation result into the plain data a create form expects.
export const shapePrefill = (type, result) => {
  switch (type) {
    case 'classroom':
      return {
        name: result?.name,
        description: result?.description,
        learningOutcomes: result?.learningOutcomes,
        subject: result?.subject,
        level: result?.level,
      };
    case 'topic':
      return {
        name: result?.name,
        description: result?.description,
        lessonsOutline: result?.lessonsOutline,
        duration: result?.duration,
      };
    case 'syllabus':
      return { topics: result?.topics || [] };
    case 'assignment':
      return {
        title: result?.title,
        description: result?.description,
        assignmentType: result?.questions?.[0]?.options ? 'mcq' : 'theory',
        questions: result?.questions || [],
      };
    case 'exam':
      return {
        title: result?.title,
        description: result?.description,
        duration: result?.duration,
        questions: result?.questions || [],
      };
    default:
      return {};
  }
};

// URL of the page that hosts the create form for an entity. Pass the classroom
// the item should be added to when known.
export const creatorUrl = (type, classroomId) => {
  switch (type) {
    case 'classroom':
      return '/classrooms';
    case 'topic':
    case 'syllabus':
      return classroomId ? `/classrooms/${classroomId}/manage-topics` : '/classrooms';
    case 'assignment':
      return classroomId ? `/classrooms/${classroomId}` : '/assignments';
    case 'exam':
      return classroomId ? `/classrooms/${classroomId}` : '/exams/create';
    default:
      return '/classrooms';
  }
};

// Entities the AI can pre-populate a create form for (vs. pure Q&A / downloads).
export const PREFILLABLE_MODES = ['classroom', 'topic', 'syllabus', 'assignment', 'exam'];

// Entities that live inside a classroom and therefore need a class picked.
export const CLASS_DEPENDENT_MODES = ['topic', 'syllabus', 'assignment', 'exam'];

// Teacher's classrooms (cached per user) for the "which class?" suggestion step.
let classesCache = null;
let classesCacheKey = null;

export const fetchTeacherClasses = async (userId) => {
  const key = String(userId || 'anon');
  if (!classesCache || classesCacheKey !== key) {
    try {
      const res = await api.get('/classrooms');
      const all = res.data.classrooms || res.data || [];
      classesCache = all.filter((c) => {
        const t = c.teacherId?._id || c.teacherId;
        return !userId || String(t) === String(userId);
      });
    } catch (_) {
      classesCache = [];
    }
    classesCacheKey = key;
  }
  return classesCache;
};

// Signal the Gracy widget to close after it navigates to a create form.
export const announceNavigatedToCreator = () => {
  window.dispatchEvent(new Event('gracy:navigated'));
};