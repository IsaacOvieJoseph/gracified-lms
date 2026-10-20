// ─── Read tools ──────────────────────────────────────────────────────────────
// Read-only access to the caller's own data.
//
// Every query here is anchored to the authenticated user. This is where a
// cross-tenant leak would happen if the anchoring were wrong, so the pattern is
// uniform: resolve the caller's own classroom/topic ids first, then filter
// within them. Nothing takes a caller-supplied school, classroom or owner id at
// face value — an id in the arguments selects *within* what the user may see,
// it never widens it.

const Classroom = require('../../models/Classroom');
const Topic = require('../../models/Topic');
const Assignment = require('../../models/Assignment');
const Exam = require('../../models/Exam');
const TutorSession = require('../../models/TutorSession');
const { register, SCOPES } = require('./registry');
const { isStaff } = require('../../utils/mcpRoles');

const MAX_RESULTS = 50;

const trim = (value, max = 300) =>
    typeof value === 'string' ? value.slice(0, max) : value;

/**
 * Classroom ids the user may act on.
 *
 * Follows the same conventions as the REST routes: a student owns a class by
 * being enrolled in it (`students`), and a member of staff owns one by having
 * created it (`teacherId`) or by belonging to its school.
 *
 * Deliberately narrow for the two roles that could otherwise see everything: a
 * personal teacher only ever reaches their own classrooms, and a root admin has
 * no school so gets nothing beyond what they created themselves. An MCP tool that
 * quietly widened this would hand a connected assistant the whole platform.
 */
const ownClassroomIds = async (user) => {
    if (user.role === 'student') {
        const enrolled = await Classroom.find({ students: user._id }).select('_id').lean();
        return enrolled.map((c) => c._id);
    }

    const clauses = [{ teacherId: user._id }];
    if (Array.isArray(user.schoolId) && user.schoolId.length) {
        clauses.push({ schoolId: { $in: user.schoolId } });
    }

    const owned = await Classroom.find({ $or: clauses }).select('_id').lean();
    return owned.map((c) => c._id);
};

const notFound = (what) => {
    const err = new Error(`${what} was not found in your account.`);
    err.code = 'NOT_FOUND';
    return err;
};

// ─── Students ────────────────────────────────────────────────────────────────

register({
    name: 'list_my_classes',
    description:
        'List the classes you are enrolled in, with subject and teacher. Use this to find out what you can study.',
    effect: 'read',
    requiredScope: SCOPES.READ,
    allowedRoles: ['student'],
    inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
    },
    handler: async ({ user }) => {
        const classrooms = await Classroom.find({ students: user._id })
            .select('name subject description teacherId')
            .limit(MAX_RESULTS)
            .lean();

        return {
            classes: classrooms.map((c) => ({
                id: String(c._id),
                name: c.name,
                subject: c.subject,
                description: trim(c.description),
                // Counted, never named: a student does not need the roster of
                // their classmates, and handing it to an assistant is exactly
                // the kind of disclosure this server should not make.
                classSize: Array.isArray(c.students) ? c.students.length : 0,
            })),
        };
    },
});

register({
    name: 'list_my_topics',
    description: 'List the lesson topics in one of your classes.',
    effect: 'read',
    requiredScope: SCOPES.READ,
    allowedRoles: ['student'],
    inputSchema: {
        type: 'object',
        properties: {
            classroomId: { type: 'string', description: 'The class to list topics for.' },
        },
        required: ['classroomId'],
        additionalProperties: false,
    },
    handler: async ({ user, args }) => {
        // Membership is re-checked rather than trusted from the argument.
        const owns = await Classroom.exists({
            _id: args.classroomId,
            students: user._id,
        });
        if (!owns) throw notFound('That class');

        const topics = await Topic.find({ classroomId: args.classroomId })
            .select('name description order lessonsOutline')
            .sort({ order: 1 })
            .limit(MAX_RESULTS)
            .lean();

        return {
            topics: topics.map((t) => ({
                id: String(t._id),
                name: t.name,
                description: trim(t.description),
            })),
        };
    },
});

register({
    name: 'get_topic',
    description:
        'Get the full lesson content of one topic, including its outline. Use this when you need to explain or quiz a student on specific material.',
    effect: 'read',
    requiredScope: SCOPES.READ,
    inputSchema: {
        type: 'object',
        properties: {
            topicId: { type: 'string', description: 'The topic to read.' },
        },
        required: ['topicId'],
        additionalProperties: false,
    },
    handler: async ({ user, args }) => {
        const topic = await Topic.findById(args.topicId).lean();
        if (!topic) throw notFound('That topic');

        // Membership is resolved through the same ownership helper the other
        // tools use, so a personal teacher (who reaches their classrooms through
        // teacherId rather than a school) is treated the same way here as
        // everywhere else.
        const owned = await ownClassroomIds(user);
        if (!owned.some((id) => String(id) === String(topic.classroomId))) {
            throw notFound('That topic');
        }

        return {
            id: String(topic._id),
            name: topic.name,
            description: trim(topic.description),
            lessonsOutline: trim(topic.lessonsOutline, 2000),
            classroomId: String(topic.classroomId),
        };
    },
});

register({
    name: 'get_my_progress',
    description:
        "The signed-in student's study progress: which classes and topics they have worked on, and their recent quiz scores.",
    effect: 'read',
    requiredScope: SCOPES.READ,
    allowedRoles: ['student'],
    inputSchema: {
        type: 'object',
        properties: {
            classroomId: { type: 'string', description: 'Optional: restrict to one class.' },
        },
        additionalProperties: false,
    },
    handler: async ({ user, args }) => {
        const filter = { userId: user._id };
        if (args.classroomId) filter.classroomId = args.classroomId;

        const sessions = await TutorSession.find(filter)
            .select('classroomId topicId subject updatedAt quizzes')
            .sort({ updatedAt: -1 })
            .limit(20)
            .lean();

        const quizScores = sessions.flatMap((s) =>
            (s.quizzes || []).flatMap((q) =>
                (q.attempts || []).map((a) => ({
                    topicId: s.topicId ? String(s.topicId) : null,
                    score: a.score,
                    total: a.total,
                    submittedAt: a.submittedAt,
                }))
            )
        );

        return {
            classesStudied: [...new Set(sessions.map((s) => String(s.classroomId)))],
            recentQuizzes: quizScores.slice(0, 20),
        };
    },
});

// ─── Staff ───────────────────────────────────────────────────────────────────

register({
    name: 'list_classes',
    description:
        'List the classes you teach, with enrolment counts. Use this to find a classroom before reading or changing anything in it.',
    effect: 'read',
    requiredScope: SCOPES.READ,
    allowedRoles: ['teacher', 'personal_teacher', 'school_admin', 'root_admin'],
    inputSchema: {
        type: 'object',
        properties: {
            search: { type: 'string', description: 'Optional: match part of the class name or subject.' },
        },
        additionalProperties: false,
    },
    handler: async ({ user, args }) => {
        const ids = await ownClassroomIds(user);
        if (!ids.length) return { classes: [] };

        const filter = { _id: { $in: ids } };
        if (args.search) {
            const safe = String(args.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = [{ name: new RegExp(safe, 'i') }, { subject: new RegExp(safe, 'i') }];
        }

        const classrooms = await Classroom.find(filter)
            .select('name subject description teacherId students')
            .limit(MAX_RESULTS)
            .lean();

        return {
            classes: classrooms.map((c) => ({
                id: String(c._id),
                name: c.name,
                subject: c.subject,
                description: trim(c.description),
                enrolled: Array.isArray(c.students) ? c.students.length : 0,
            })),
        };
    },
});

register({
    name: 'list_assignments',
    description: 'List assignments in one of your classes.',
    effect: 'read',
    requiredScope: SCOPES.READ,
    allowedRoles: ['teacher', 'personal_teacher', 'school_admin', 'root_admin'],
    inputSchema: {
        type: 'object',
        properties: {
            classroomId: { type: 'string' },
        },
        required: ['classroomId'],
        additionalProperties: false,
    },
    handler: async ({ user, args }) => {
        const ids = await ownClassroomIds(user);
        if (!ids.some((id) => String(id) === String(args.classroomId))) {
            throw notFound('That class');
        }

        const assignments = await Assignment.find({ classroomId: args.classroomId })
            .select('title description dueDate createdAt')
            .sort({ createdAt: -1 })
            .limit(MAX_RESULTS)
            .lean();

        return {
            assignments: assignments.map((a) => ({
                id: String(a._id),
                title: a.title,
                description: trim(a.description),
                dueDate: a.dueDate || null,
            })),
        };
    },
});

register({
    name: 'list_exams',
    description: 'List exams in one of your classes.',
    effect: 'read',
    requiredScope: SCOPES.READ,
    allowedRoles: ['teacher', 'personal_teacher', 'school_admin', 'root_admin'],
    inputSchema: {
        type: 'object',
        properties: {
            classroomId: { type: 'string' },
        },
        required: ['classroomId'],
        additionalProperties: false,
    },
    handler: async ({ user, args }) => {
        const ids = await ownClassroomIds(user);
        if (!ids.some((id) => String(id) === String(args.classroomId))) {
            throw notFound('That class');
        }

        const exams = await Exam.find({ classroomId: args.classroomId })
            .select('title description totalMarks duration createdAt')
            .sort({ createdAt: -1 })
            .limit(MAX_RESULTS)
            .lean();

        return {
            exams: exams.map((e) => ({
                id: String(e._id),
                title: e.title,
                description: trim(e.description),
                totalMarks: e.totalMarks,
                durationMinutes: e.duration,
            })),
        };
    },
});

register({
    name: 'search_my_content',
    description:
        'Search the names and descriptions of topics, assignments and exams across your classes. Use this to find where something is taught or assessed.',
    effect: 'read',
    requiredScope: SCOPES.READ,
    allowedRoles: ['teacher', 'personal_teacher', 'school_admin', 'root_admin'],
    inputSchema: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Text to search for.' },
        },
        required: ['query'],
        additionalProperties: false,
    },
    handler: async ({ user, args }) => {
        const ids = await ownClassroomIds(user);
        if (!ids.length) return { topics: [], assignments: [], exams: [] };

        // Escape the query so user text can never act as a pattern. A raw RegExp
        // here would let ".*" or a catastrophic backtracking pattern run against
        // the database.
        const safe = String(args.query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rx = new RegExp(safe, 'i');
        const per = 10;

        const [topics, assignments, exams] = await Promise.all([
            Topic.find({ classroomId: { $in: ids }, $or: [{ name: rx }, { description: rx }] })
                .select('name classroomId')
                .limit(per)
                .lean(),
            Assignment.find({ classroomId: { $in: ids }, $or: [{ title: rx }, { description: rx }] })
                .select('title classroomId')
                .limit(per)
                .lean(),
            Exam.find({ classroomId: { $in: ids }, $or: [{ title: rx }, { description: rx }] })
                .select('title classroomId')
                .limit(per)
                .lean(),
        ]);

        return {
            topics: topics.map((t) => ({ id: String(t._id), name: t.name, classroomId: String(t.classroomId) })),
            assignments: assignments.map((a) => ({ id: String(a._id), title: a.title, classroomId: String(a.classroomId) })),
            exams: exams.map((e) => ({ id: String(e._id), title: e.title, classroomId: String(e.classroomId) })),
        };
    },
});

module.exports = { ownClassroomIds, trim };
