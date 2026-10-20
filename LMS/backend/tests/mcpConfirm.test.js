const test = require('node:test');
const assert = require('node:assert');

// The fingerprint is the whole point of the two-phase write gate: it binds a
// user's approval to the exact change they were shown. These tests focus on the
// cases where a naive implementation silently binds nothing.
const { fingerprint, canonical, splitConfirmation } = require('../utils/mcpConfirm');

test('canonical serialises nested content rather than dropping it', () => {
    // Regression: `JSON.stringify(args, Object.keys(args).sort())` uses the array
    // as a *key filter* applied at every level, so questions collapsed to [{}]
    // and two different papers hashed the same.
    const a = { classroomId: 'c1', title: 'T', questions: [{ question: 'Q1', marks: 5, modelAnswer: 'A1' }] };
    const b = { classroomId: 'c1', title: 'T', questions: [{ question: 'SOMETHING ELSE', marks: 99, modelAnswer: 'Z' }] };

    assert.notStrictEqual(canonical(a), canonical(b));
    assert.notStrictEqual(fingerprint('create_assignment', a), fingerprint('create_assignment', b));
});

test('changing any nested value changes the fingerprint', () => {
    const base = { title: 'T', questions: [{ question: 'Q', marks: 5 }] };

    const mutations = [
        { ...base, title: 'T2' },
        { ...base, questions: [{ question: 'Q2', marks: 5 }] },
        { ...base, questions: [{ question: 'Q', marks: 6 }] },
        { ...base, questions: [] },
        { ...base, questions: [{ question: 'Q', marks: 5 }, { question: 'extra', marks: 5 }] },
    ];

    for (const mutated of mutations) {
        assert.notStrictEqual(
            fingerprint('create_exam', base),
            fingerprint('create_exam', mutated),
            'a mutated payload must not reuse the original approval'
        );
    }
});

test('key order does not change the fingerprint', () => {
    const a = { classroomId: 'c1', title: 'T', questions: [{ question: 'Q', marks: 5 }] };
    const b = { questions: [{ marks: 5, question: 'Q' }], title: 'T', classroomId: 'c1' };

    assert.strictEqual(fingerprint('create_assignment', a), fingerprint('create_assignment', b));
});

test('the tool name is part of the fingerprint', () => {
    const args = { topicId: 't1', name: 'Same change' };
    // Otherwise an approval for one tool could be presented to another.
    assert.notStrictEqual(fingerprint('update_topic', args), fingerprint('create_topic', args));
});

test('arrays are order sensitive', () => {
    const a = { steps: ['first', 'second'] };
    const b = { steps: ['second', 'first'] };
    assert.notStrictEqual(fingerprint('draft_lesson_plan', a), fingerprint('draft_lesson_plan', b));
});

test('dangerous keys are handled as data, not as structure', () => {
    // Guards against a prototype-pollution style payload being silently
    // serialised into something that means a different thing later.
    const payload = JSON.parse('{"name":"x","__proto__":{"admin":true}}');
    assert.doesNotThrow(() => fingerprint('create_topic', payload));
    assert.strictEqual({}.admin, undefined);
});

test('undefined and null normalise to the same value', () => {
    assert.strictEqual(fingerprint('t', { a: undefined }), fingerprint('t', { a: null }));
});

// ─── Confirmation-id splitting ───────────────────────────────────────────────
// A client may echo the confirmation id back inside `arguments` rather than as a
// top-level field. It must be removed from the arguments before they are hashed,
// or phase 2 fingerprints differently from phase 1 and no approval can ever be
// consumed — the write fails, but in a way that looks like a race rather than a
// bug the client could fix.

const PHASE_1_ARGS = { title: 'Exam 1', classroomId: 'c1', questions: [{ question: 'Q', marks: 5 }] };

test('a confirmation id read from params is returned and the arguments stay intact', () => {
    const { confirmId, args } = splitConfirmation({ confirmId: 'tok' }, PHASE_1_ARGS);
    assert.strictEqual(confirmId, 'tok');
    assert.deepStrictEqual(args, PHASE_1_ARGS);
});

test('confirmationId (the spelling the response advertises) is accepted too', () => {
    const { confirmId } = splitConfirmation({ confirmationId: 'tok' }, PHASE_1_ARGS);
    assert.strictEqual(confirmId, 'tok');
});

test('a confirmation id nested in arguments is removed before hashing', () => {
    const phase2 = { ...PHASE_1_ARGS, confirmId: 'tok' };

    const { confirmId, args } = splitConfirmation({}, phase2);
    assert.strictEqual(confirmId, 'tok');
    assert.deepStrictEqual(args, PHASE_1_ARGS, 'the marker must not survive into the arguments');
    // The regression this exists for: the fingerprint must be identical to phase 1.
    assert.strictEqual(fingerprint('create_exam', args), fingerprint('create_exam', PHASE_1_ARGS));
});

test('the confirmationId spelling works inside arguments as well', () => {
    const { confirmId, args } = splitConfirmation({}, { ...PHASE_1_ARGS, confirmationId: 'tok' });
    assert.strictEqual(confirmId, 'tok');
    assert.deepStrictEqual(args, PHASE_1_ARGS);
});

test('params take priority over the same id nested in arguments', () => {
    // Usually the two agree; when they do not, the top-level value is the one the
    // transport documented and is what should win.
    const { confirmId } = splitConfirmation({ confirmId: 'outer' }, { ...PHASE_1_ARGS, confirmId: 'inner' });
    assert.strictEqual(confirmId, 'outer');
});

test('neither a confirm id nor valid arguments means null and empty args', () => {
    assert.deepStrictEqual(splitConfirmation({}, undefined), { confirmId: null, args: {} });
    assert.deepStrictEqual(splitConfirmation({}, 'not-an-object'), { confirmId: null, args: {} });
    assert.deepStrictEqual(splitConfirmation({}, {}) , { confirmId: null, args: {} });
});

test('a mutated argument payload still produces a different fingerprint', () => {
    // Splitting must not flatten the change: the exam list is part of the hash.
    const phase2 = { ...PHASE_1_ARGS, questions: [{ question: 'DIFFERENT', marks: 5 }] };
    const { args } = splitConfirmation({ confirmId: 'tok' }, phase2);
    assert.notStrictEqual(fingerprint('create_exam', args), fingerprint('create_exam', PHASE_1_ARGS));
});
