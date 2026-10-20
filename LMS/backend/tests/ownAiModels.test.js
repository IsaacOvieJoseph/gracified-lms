const test = require('node:test');
const assert = require('node:assert');

// `resolveOwnAIModelsAccess` decides whether the "Connect your own provider"
// (BYO Gemini / OpenRouter / MCP) block is offered at all. It reads one field
// from a School, so we stub that model static rather than needing a database.
// These prove the decisions — root always allowed, students never, school staff
// governed by the school flag, personal tutors by their own flag — which is the
// whole contract. A malformed/absent school must fail closed.

const School = require('../models/School');
const { resolveOwnAIModelsAccess } = require('../utils/aiAccess');

// The resolver calls `School.findById(id).select(...).lean()`; the `.select()`
// and `.lean()` apply synchronously to the query object, so the stub returns
// that chain shape directly.
const schoolQuery = (doc) => ({
    select: () => ({ lean: async () => doc }),
});

const withSchool = async (doc, fn) => {
    const original = School.findById;
    School.findById = () => schoolQuery(doc);
    try {
        return await fn();
    } finally {
        School.findById = original;
    }
};

const withSchoolReject = async (fn) => {
    const original = School.findById;
    School.findById = () => {
        throw new Error('boom');
    };
    try {
        return await fn();
    } finally {
        School.findById = original;
    }
};

test('root admin is always allowed BYO access', async () => {
    assert.strictEqual(await resolveOwnAIModelsAccess({ role: 'root_admin' }), true);
});

test('students are never offered BYO access, even inside a school that allows it', async () => {
    await withSchool({ allowOwnAIModels: true }, async () => {
        assert.strictEqual(
            await resolveOwnAIModelsAccess({ role: 'student', schoolId: 'abc123' }),
            false
        );
    });
});

test('school staff follow the school flag', async () => {
    await withSchool({ allowOwnAIModels: true }, async () => {
        assert.strictEqual(
            await resolveOwnAIModelsAccess({ role: 'teacher', schoolId: 'abc123' }),
            true
        );
        assert.strictEqual(
            await resolveOwnAIModelsAccess({ role: 'school_admin', schoolId: ['abc123'] }),
            true
        );
    });

    await withSchool({ allowOwnAIModels: false }, async () => {
        assert.strictEqual(
            await resolveOwnAIModelsAccess({ role: 'teacher', schoolId: 'abc123' }),
            false
        );
    });
});

test('personal tutors (no school) follow their own user flag', async () => {
    assert.strictEqual(
        await resolveOwnAIModelsAccess({ role: 'personal_teacher', allowOwnAIModels: true }),
        true
    );
    assert.strictEqual(
        await resolveOwnAIModelsAccess({ role: 'personal_teacher', allowOwnAIModels: false }),
        false
    );
});

test('a missing school record fails closed', async () => {
    await withSchool(null, async () => {
        assert.strictEqual(
            await resolveOwnAIModelsAccess({ role: 'teacher', schoolId: 'abc123' }),
            false
        );
    });
});

test('a school lookup error fails closed instead of granting access', async () => {
    await withSchoolReject(async () => {
        assert.strictEqual(
            await resolveOwnAIModelsAccess({ role: 'teacher', schoolId: 'abc123' }),
            false
        );
    });
});

test('no user is denied', async () => {
    assert.strictEqual(await resolveOwnAIModelsAccess(null), false);
    assert.strictEqual(await resolveOwnAIModelsAccess(undefined), false);
});
