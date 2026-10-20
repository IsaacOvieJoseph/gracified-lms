const test = require('node:test');
const assert = require('node:assert');
const zlib = require('zlib');

// Covers the file-producing tool and the transport change that lets a tool return
// an actual file instead of text. The risk being guarded is a silent regression:
// if the resource block stops being emitted, the deck still builds and every test
// that only inspects the renderer keeps passing, but the user receives nothing
// they can open.

const { toolContent } = require('../utils/mcpContent');
const { resourceResult, isResourceResult, getTool } = require('../mcp/tools/registry');
const { normaliseDeck, normaliseSlide, MAX_SLIDES } = require('../mcp/tools/files');

require('../mcp/tools/read');
require('../mcp/tools/draft');
require('../mcp/tools/files');
require('../mcp/tools/write');

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

/** Local copy of the zip central-directory reader; see tests/pptx.test.js. */
const zipEntryNames = (buffer) => {
    const names = [];
    const signature = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
    let offset = 0;
    while (offset < buffer.length - 4) {
        const found = buffer.indexOf(signature, offset);
        if (found === -1) break;
        const nameLength = buffer.readUInt16LE(found + 28);
        const extraLength = buffer.readUInt16LE(found + 30);
        const commentLength = buffer.readUInt16LE(found + 32);
        names.push(buffer.toString('utf8', found + 46, found + 46 + nameLength));
        offset = found + 46 + nameLength + extraLength + commentLength;
    }
    return names;
};
const countSlides = (buffer) =>
    zipEntryNames(buffer).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length;

const outline = () => ({
    title: 'Photosynthesis',
    slides: [
        { type: 'title', title: 'Photosynthesis', bullets: ['Year 10 Biology'] },
        { type: 'content', title: 'What is it?', bullets: ['Uses light', 'Makes glucose'] },
        { type: 'quiz', title: 'Check', bullets: ['Where?'] },
    ],
});

// ─── Transport ───────────────────────────────────────────────────────────────

test('an ordinary tool result is still a single text block', () => {
    // Regression guard for the 21 existing tools, all of which return plain data.
    const result = toolContent({ title: 'Maths', topics: ['Fractions'] }, false);
    assert.strictEqual(result.content.length, 1);
    assert.strictEqual(result.content[0].type, 'text');
    assert.deepStrictEqual(JSON.parse(result.content[0].text), { title: 'Maths', topics: ['Fractions'] });
    assert.strictEqual(result.isError, false);
});

test('a string result is passed through unescaped', () => {
    const result = toolContent('plain text', false);
    assert.strictEqual(result.content[0].text, 'plain text');
});

test('an error result is one text block with isError set', () => {
    const result = toolContent({ error: 'nope' }, true);
    assert.strictEqual(result.content.length, 1);
    assert.strictEqual(result.isError, true);
});

test('a resource result becomes a text block plus an embedded resource', () => {
    const blob = Buffer.from('PK pretend pptx').toString('base64');
    const result = toolContent(resourceResult('Deck ready.', { uri: 'gracy://slides/x/a.pptx', mimeType: PPTX_MIME, blob }), false);

    assert.strictEqual(result.isError, false);
    assert.strictEqual(result.content.length, 2);
    assert.strictEqual(result.content[0].type, 'text');
    assert.match(result.content[0].text, /Deck ready\./);

    const block = result.content[1];
    assert.strictEqual(block.type, 'resource');
    assert.strictEqual(block.resource.uri, 'gracy://slides/x/a.pptx');
    assert.strictEqual(block.resource.mimeType, PPTX_MIME);
    // The bytes must survive base64 intact — this is the whole delivery mechanism.
    assert.ok(Buffer.from(block.resource.blob, 'base64').equals(Buffer.from('PK pretend pptx')));
});

test('a resource result is serialisable as JSON-RPC', () => {
    const blob = Buffer.from([0x50, 0x4b, 0x03, 0x04]).toString('base64');
    const wire = JSON.stringify({ jsonrpc: '2.0', id: 1, result: toolContent(resourceResult('ok', { uri: 'gracy://slides/a', mimeType: PPTX_MIME, blob }), false) });
    const parsed = JSON.parse(wire);
    assert.strictEqual(parsed.result.content[1].resource.mimeType, PPTX_MIME);
    assert.deepStrictEqual(Buffer.from(parsed.result.content[1].resource.blob, 'base64'), Buffer.from([0x50, 0x4b, 0x03, 0x04]));
});

test('a payload with a resource-shaped field is not mistaken for a resource', () => {
    // Tool output is model-influenced, so duck-typing on a `resource` key would let
    // ordinary data change the shape of a response. Only the tag counts.
    const spoof = { resource: { uri: 'gracy://slides/x', mimeType: PPTX_MIME, blob: 'AAAA' }, note: 'hello' };
    assert.strictEqual(isResourceResult(spoof), false);
    const result = toolContent(spoof, false);
    assert.strictEqual(result.content.length, 1);
    assert.strictEqual(result.content[0].type, 'text');
});

test('an error never carries a resource or its bytes', () => {
    // Pairing a failure with a file would be misleading, so isError wins.
    const blob = Buffer.alloc(200_000, 0x41).toString('base64');
    const failed = toolContent(
        resourceResult('should not appear', { uri: 'gracy://slides/x', mimeType: PPTX_MIME, blob }),
        true
    );
    assert.strictEqual(failed.isError, true);
    assert.strictEqual(failed.content.length, 1);
    assert.ok(!failed.content[0].text.includes('gracy://'), 'uri leaked into the error text');
    assert.ok(!failed.content[0].text.includes(blob), 'the file bytes leaked into the error text');
    // The failure is still described, rather than becoming an empty block.
    assert.ok(failed.content[0].text.length > 0);
});

// ─── Input normalisation ─────────────────────────────────────────────────────

test('an outline is accepted whether it says bullets or bulletPoints', () => {
    // draft_slides historically described "bullets" while the renderer reads
    // "bulletPoints". Both must work, or a deck silently renders with empty slides.
    const viaBullets = normaliseDeck({ title: 'A', slides: [{ title: 'S1', bullets: ['one', 'two'] }] });
    const viaBulletPoints = normaliseDeck({ title: 'A', slides: [{ title: 'S1', bulletPoints: ['one', 'two'] }] });
    assert.deepStrictEqual(viaBullets.slides[0].bulletPoints, ['one', 'two']);
    assert.deepStrictEqual(viaBulletPoints.slides[0].bulletPoints, ['one', 'two']);
});

test('bulletPoints wins when both spellings are present', () => {
    const deck = normaliseDeck({ slides: [{ title: 'S', bullets: ['from alias'], bulletPoints: ['from canonical'] }] });
    assert.deepStrictEqual(deck.slides[0].bulletPoints, ['from canonical']);
});

test('a slide is coerced to the shape the renderer expects', () => {
    // Everything here is model output, so wrong types must degrade rather than throw.
    assert.deepStrictEqual(normaliseSlide({ type: 'quiz', title: 'Q', bullets: ['a'] }, 1), {
        type: 'quiz',
        title: 'Q',
        bulletPoints: ['a'],
        speakerNotes: '',
    });

    // bullets as a bare string, not an array
    assert.deepStrictEqual(normaliseSlide({ title: 'S', bullets: 'not an array' }, 1).bulletPoints, []);

    // unknown slide type falls back to a body slide
    assert.strictEqual(normaliseSlide({ type: 'interpretive_dance', title: 'S' }, 1).type, 'content');

    // a slide with no usable text still gets a heading, so the deck has no blank slide
    assert.strictEqual(normaliseSlide({}, 3).title, 'Slide 4');
    assert.strictEqual(normaliseSlide(null, 0).title, 'Slide 1');
    assert.strictEqual(normaliseSlide('nonsense', 0).title, 'Slide 1');

    // notes are accepted under either name
    assert.strictEqual(normaliseSlide({ title: 'S', notes: 'from notes' }, 1).speakerNotes, 'from notes');
    assert.strictEqual(normaliseSlide({ title: 'S', speakerNotes: 'from speakerNotes' }, 1).speakerNotes, 'from speakerNotes');
});

test('only the first slide may be a title slide', () => {
    // A title slide midway through reads as a rendering bug to the teacher.
    const deck = normaliseDeck({
        slides: [
            { type: 'title', title: 'Start' },
            { type: 'title', title: 'Middle' },
        ],
    });
    assert.strictEqual(deck.slides[0].type, 'title');
    assert.strictEqual(deck.slides[1].type, 'content');
});

test('oversized input is capped rather than rendered whole', () => {
    const deck = normaliseDeck({
        title: 'T'.repeat(5000),
        slides: Array.from({ length: 500 }, (_, i) => ({
            type: 'content',
            title: `S${i}`,
            bullets: Array.from({ length: 100 }, (_, j) => `b${j}`),
            speakerNotes: 'n'.repeat(9000),
        })),
    });
    assert.strictEqual(deck.slides.length, MAX_SLIDES);
    assert.strictEqual(deck.presentationTitle.length, 200);
    assert.strictEqual(deck.slides[0].bulletPoints.length, 12);
    assert.strictEqual(deck.slides[0].speakerNotes.length, 2000);
});

test('a deck with nothing renderable is reported as empty, not crashed', () => {
    assert.strictEqual(normaliseDeck({ slides: [] }), null);
    assert.strictEqual(normaliseDeck({}), null);
    assert.strictEqual(normaliseDeck(null), null);
    assert.strictEqual(normaliseDeck({ slides: 'not an array' }), null);
});

// ─── The tool ────────────────────────────────────────────────────────────────

test('build_slide_deck is not a destructive or AI-metered tool', () => {
    const tool = getTool('build_slide_deck');
    assert.strictEqual(tool.effect, 'render', 'must not be logged or metered as a draft');
    assert.strictEqual(tool.requiresConfirmation, false, 'renders a file, changes nothing');
    assert.ok(!/^delete_|^remove_|^destroy_/.test(tool.name));
});

test('the audit model accepts the render effect', () => {
    // The audit log is written fire-and-forget, so an effect the schema rejects
    // would fail silently and lose the record entirely.
    const MCPAuditLog = require('../models/MCPAuditLog');
    const oid = 'a'.repeat(24);
    const doc = new MCPAuditLog({ clientId: oid, userId: oid, tool: 'build_slide_deck', effect: 'render', succeeded: true });
    const error = doc.validateSync();
    assert.strictEqual(error, undefined, error ? String(error.message) : '');
});

test('an unrecognised effect is still rejected', () => {
    // Guards the point of the test above: the enum must not have been loosened.
    const MCPAuditLog = require('../models/MCPAuditLog');
    const oid = 'a'.repeat(24);
    const doc = new MCPAuditLog({ clientId: oid, userId: oid, tool: 'x', effect: 'sideways', succeeded: true });
    assert.ok(doc.validateSync(), 'effect enum accepted an unknown value');
});

test('build_slide_deck returns a real pptx as an embedded resource', async () => {
    const tool = getTool('build_slide_deck');
    const result = await tool.handler({
        user: { role: 'teacher', schoolId: [] }, // no logo configured
        args: outline(),
        role: 'teacher',
        scope: 'execute',
    });

    assert.ok(isResourceResult(result), 'handler must return a resource result');
    assert.match(result.text, /Photosynthesis/);
    assert.match(result.text, /3 slides/);

    const { uri, mimeType, blob } = result.resource;
    assert.strictEqual(mimeType, PPTX_MIME);
    assert.ok(uri.startsWith('gracy://slides/'));
    assert.ok(uri.endsWith('.pptx'));

    const buffer = Buffer.from(blob, 'base64');
    assert.strictEqual(buffer.subarray(0, 4).toString('hex'), '504b0304', 'not a zip archive');
    assert.strictEqual(countSlides(buffer), 3);
});

test('two calls never share a resource uri', () => {
    // Clients may cache by URI; a stable one would serve a stale deck.
    const tool = getTool('build_slide_deck');
    const run = () => tool.handler({ user: { role: 'teacher', schoolId: [] }, args: outline(), role: 'teacher' });
    return Promise.all([run(), run()]).then(([a, b]) => {
        assert.notStrictEqual(a.resource.uri, b.resource.uri);
    });
});

test('the deck is reachable through the transport as a downloadable block', async () => {
    const tool = getTool('build_slide_deck');
    const result = await tool.handler({ user: { role: 'teacher', schoolId: [] }, args: outline(), role: 'teacher' });
    const wire = toolContent(result, false);

    assert.strictEqual(wire.content.length, 2);
    assert.strictEqual(wire.content[1].type, 'resource');
    // Decode exactly what a client would decode.
    const delivered = Buffer.from(wire.content[1].resource.blob, 'base64');
    assert.strictEqual(countSlides(delivered), 3);
});

test('an outline nested under presentation is accepted', () => {
    // The web app's download endpoint takes { presentation }, and a model that has
    // seen that shape will nest its arguments the same way.
    const tool = getTool('build_slide_deck');
    return tool
        .handler({ user: { role: 'teacher', schoolId: [] }, args: { presentation: outline() }, role: 'teacher' })
        .then((result) => {
            assert.strictEqual(countSlides(Buffer.from(result.resource.blob, 'base64')), 3);
        });
});

test('an empty outline fails with a message the model can act on', async () => {
    const tool = getTool('build_slide_deck');
    await assert.rejects(
        () => tool.handler({ user: { role: 'teacher' }, args: { title: 'Empty', slides: [] }, role: 'teacher' }),
        (err) => {
            assert.strictEqual(err.code, 'EMPTY_DECK');
            assert.match(err.message, /draft_slides/);
            return true;
        }
    );
});

test('students are not offered the tool', () => {
    const { visibleTools, resolveTool } = require('../mcp/tools/registry');
    const scopes = ['mcp:read', 'mcp:draft', 'mcp:write'];
    assert.ok(!visibleTools({ scopes, role: 'student' }).some((t) => t.name === 'build_slide_deck'));
    // And calling it directly is refused indistinguishably from a missing tool.
    assert.strictEqual(resolveTool({ name: 'build_slide_deck', scopes, role: 'student' }).error, 'unknown_tool');
});
