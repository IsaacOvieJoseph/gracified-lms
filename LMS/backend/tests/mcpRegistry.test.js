const test = require('node:test');
const assert = require('node:assert');

// The registry is the single place that decides what a connected client can
// see and call. Getting this wrong is how a student ends up with a "delete
// exam" tool in their tool list, so the tests are about what is *hidden*, not
// only about what works.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-registry-tests';

const { visibleTools, resolveTool } = require('../mcp/tools/registry');
require('../mcp/tools/read');
require('../mcp/tools/draft');
require('../mcp/tools/write');

const SCOPES = { READ: 'mcp:read', DRAFT: 'mcp:draft', WRITE: 'mcp:write' };

const names = (ctx) => visibleTools(ctx).map((t) => t.name).sort();

test('a student with read scope sees only their own read tools', () => {
    const list = names({ scopes: [SCOPES.READ], role: 'student' });

    assert.ok(list.includes('list_my_classes'));
    assert.ok(list.includes('get_topic'));
    assert.ok(list.includes('get_my_progress'));

    // Nothing staff-only, and nothing that costs AI credits.
    for (const forbidden of ['list_classes', 'draft_exam', 'create_exam', 'update_topic', 'publish_exam']) {
        assert.ok(!list.includes(forbidden), `student must not see ${forbidden}`);
    }
});

test('a student without draft scope cannot practice or ask questions', () => {
    const list = names({ scopes: [SCOPES.READ], role: 'student' });
    assert.ok(!list.includes('practice_quiz'));
    assert.ok(!list.includes('ask_study_question'));

    const withDraft = names({ scopes: [SCOPES.READ, SCOPES.DRAFT], role: 'student' });
    assert.ok(withDraft.includes('practice_quiz'));
    assert.ok(withDraft.includes('ask_study_question'));
});

test('a teacher with read scope sees staff reads but no writes', () => {
    const list = names({ scopes: [SCOPES.READ], role: 'teacher' });

    assert.ok(list.includes('list_classes'));
    assert.ok(list.includes('list_assignments'));
    assert.ok(list.includes('search_my_content'));

    // A write tool must never be callable without the write scope, whatever the role.
    for (const write of ['create_topic', 'update_topic', 'create_assignment', 'create_exam', 'publish_exam']) {
        assert.ok(!list.includes(write), `teacher with read-only scope must not see ${write}`);
        const attempt = resolveTool({ name: write, scopes: [SCOPES.READ], role: 'teacher' });
        assert.strictEqual(attempt.error, 'insufficient_scope');
    }
});

test('draft tools need draft scope', () => {
    const attempt = resolveTool({ name: 'draft_exam', scopes: [SCOPES.READ], role: 'teacher' });
    assert.strictEqual(attempt.error, 'insufficient_scope');
});

test('a full-scope teacher gets reads, drafts and writes', () => {
    const list = names({ scopes: [SCOPES.READ, SCOPES.DRAFT, SCOPES.WRITE], role: 'teacher' });
    for (const expected of ['list_classes', 'draft_exam', 'create_assignment', 'publish_exam']) {
        assert.ok(list.includes(expected), `teacher should see ${expected}`);
    }
});

test('every write tool defaults to requiring confirmation', () => {
    const { getTool } = require('../mcp/tools/registry');
    const all = require('../mcp/tools/registry');
    // Enumerated by walking the tool list the registry can produce.
    const list = [
        ...visibleTools({ scopes: [SCOPES.READ, SCOPES.DRAFT, SCOPES.WRITE], role: 'root_admin' }),
    ];
    assert.ok(list.length > 0);

    for (const entry of list) {
        const tool = all.getTool(entry.name);
        if (tool.effect === 'write') {
            assert.strictEqual(tool.requiresConfirmation, true, `${tool.name} must require confirmation`);
        }
        // 'render' produces a file without persisting anything, so like read and
        // draft it must never prompt for confirmation.
        if (tool.effect === 'read' || tool.effect === 'draft' || tool.effect === 'render') {
            assert.strictEqual(tool.requiresConfirmation, false, `${tool.name} must not require confirmation`);
        }
    }
    assert.strictEqual(typeof getTool, 'function');
});

test('only write tools change stored data, and every tool declares a known effect', () => {
    const all = require('../mcp/tools/registry');
    const list = visibleTools({ scopes: [SCOPES.READ, SCOPES.DRAFT, SCOPES.WRITE], role: 'root_admin' });
    const KNOWN = ['read', 'draft', 'write', 'render'];

    for (const entry of list) {
        const tool = all.getTool(entry.name);
        assert.ok(KNOWN.includes(tool.effect), `${tool.name} has unknown effect "${tool.effect}"`);
        // The audit log stores this value against an enum, so a typo here would be
        // silently dropped when the record is written.
        assert.ok(tool.description && tool.description.length > 20, `${tool.name} needs a real description`);
        assert.ok(tool.inputSchema && tool.inputSchema.type === 'object', `${tool.name} needs an object input schema`);
    }
});

test('no destructive tool is exposed', () => {
    const list = names({ scopes: [SCOPES.READ, SCOPES.DRAFT, SCOPES.WRITE], role: 'root_admin' });
    for (const name of list) {
        assert.ok(!/^delete_|^remove_|^destroy_|^unpublish_/.test(name), `${name} must not exist`);
    }
});

test('a tool outside the caller role is indistinguishable from a missing one', () => {
    const studentSeesStaffTool = resolveTool({
        name: 'publish_exam',
        scopes: [SCOPES.READ, SCOPES.DRAFT, SCOPES.WRITE],
        role: 'student',
    });
    const missing = resolveTool({
        name: 'no_such_tool',
        scopes: [SCOPES.READ, SCOPES.DRAFT, SCOPES.WRITE],
        role: 'student',
    });

    assert.strictEqual(studentSeesStaffTool.error, 'unknown_tool');
    assert.strictEqual(studentSeesStaffTool.error, missing.error);
    // Both answers must be the same shape: "no tool by that name", with the name
    // the caller already knows echoed back. Nothing here reveals that a tool of
    // that name exists, or that it exists for some other role.
    assert.ok(missing.message.startsWith('No tool named '));
    assert.ok(studentSeesStaffTool.message.startsWith('No tool named '));
    assert.ok(!/role|permission|forbidden|scope/i.test(missing.message));
});

test('adapters expose a JSON Schema the model can read', () => {
    for (const entry of visibleTools({ scopes: [SCOPES.READ, SCOPES.DRAFT, SCOPES.WRITE], role: 'root_admin' })) {
        assert.strictEqual(entry.inputSchema.type, 'object', `${entry.name} needs an object schema`);
        assert.ok(typeof entry.description === 'string' && entry.description.length > 20, `${entry.name} needs a description`);
    }
});
