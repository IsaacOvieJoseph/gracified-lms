// Helpers to keep answer keys (correctOption) out of student-facing payloads.
// Rule: correctOption must NEVER appear in a response payload for students unless
// the exam/assignment has already been graded (and the student will see the
// correct answer in the UI). Non-student users (teachers/admins) always see it.

const NON_STUDENT_ROLES = ['root_admin', 'school_admin', 'teacher', 'personal_teacher'];

const isNonStudent = (user) => user && NON_STUDENT_ROLES.includes(user.role);

const toPlain = (doc) => (doc && typeof doc.toObject === 'function' ? doc.toObject() : doc);

// Strip correctOption from an array of question docs/objects (returns new array).
const stripCorrectOption = (questions) =>
  (questions || []).map((q) => {
    if (!q) return q;
    const obj = toPlain(q);
    if (obj.correctOption === undefined) return obj;
    const { correctOption, ...rest } = obj;
    return rest;
  });

// Whether a student may see the correctOption for an assignment (own graded
// submission AND results are viewable, i.e. the UI will show the answer key).
const studentCanSeeAssignmentKey = (assignment, studentId) => {
  if (!assignment || !studentId) return false;
  const sid = studentId.toString();
  const submission = (assignment.submissions || []).find(
    (s) => ((s.studentId && s.studentId._id) || s.studentId)?.toString() === sid
  );
  if (!submission || submission.status !== 'graded') return false;
  if (assignment.assignmentType === 'theory') return true;
  // MCQ: results must be published (or no publish gate set)
  return !assignment.publishResultsAt || new Date() >= new Date(assignment.publishResultsAt);
};

// Sanitize an assignment (or plain assignment object) for the requesting user.
// Non-students get the full object back.
const sanitizeAssignment = (assignment, user) => {
  const obj = toPlain(assignment);
  if (!obj) return obj;
  if (!user || isNonStudent(user)) return obj;

  const reveal = studentCanSeeAssignmentKey(assignment, user._id);
  if (reveal) return obj;

  obj.questions = stripCorrectOption(obj.questions);
  return obj;
};

// Sanitize an exam object for a student (list/overview contexts). The taking and
// review flows use their own gating, so the answer key is always stripped here.
const sanitizeExam = (exam) => {
  const obj = toPlain(exam);
  if (!obj) return obj;
  obj.questions = stripCorrectOption(obj.questions);
  return obj;
};

module.exports = { isNonStudent, stripCorrectOption, studentCanSeeAssignmentKey, sanitizeAssignment, sanitizeExam };