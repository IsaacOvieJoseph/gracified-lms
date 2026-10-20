const test = require('node:test');
const assert = require('node:assert');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// These guard the extraction of the slide renderer out of routes/ai.js. The
// layout code moved verbatim, so the risk is not "did it break" but "did anything
// get lost on the way" — so the assertions are about the shape of the artefact
// (a real zip holding one XML part per slide) rather than pixel details.
const { buildPptx, deckFileName, PPTX_MIME, localLogoDataUrl, remoteLogoDataUrl } = require('../utils/pptx');

const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads');
const png =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const fixture = (slideCount = 4) => ({
    presentationTitle: 'Photosynthesis: An Introduction',
    // The renderer reads the subtitle from the deck, not from the title slide —
    // matched here so the fixture reflects the real input contract.
    subtitle: 'Year 10 Biology',
    slides: [
        { type: 'title', title: 'Photosynthesis', speakerNotes: 'Hook the class.' },
        {
            type: 'content',
            title: 'What is photosynthesis?',
            bulletPoints: ['Conversion of light energy', 'Occurs in the chloroplast', 'Produces glucose and oxygen'],
            speakerNotes: 'Check prior knowledge.',
        },
        {
            type: 'quiz',
            title: 'Quick check',
            bulletPoints: ['Where does it happen?', 'What is the by-product?'],
            speakerNotes: 'Two minutes, hands up.',
        },
        { type: 'summary', title: 'Recap', bulletPoints: ['Light + CO2 -> glucose + O2'], speakerNotes: 'Homework reminder.' },
        ...Array.from({ length: Math.max(0, slideCount - 4) }, (_, i) => ({
            type: 'content',
            title: `Extra ${i + 1}`,
            bulletPoints: [`point ${i + 1}`],
        })),
    ],
});

/**
 * Minimal zip reader so these tests can inspect the package without adding a
 * dependency or shelling out. Reads the central directory, which is the
 * authoritative index, then inflates the entry it points at.
 */
const zipEntries = (buffer) => {
    const signature = Buffer.from([0x50, 0x4b, 0x01, 0x02]); // central directory
    const entries = new Map();

    let offset = 0;
    while (offset < buffer.length - 4) {
        const found = buffer.indexOf(signature, offset);
        if (found === -1) break;

        const method = buffer.readUInt16LE(found + 10);
        const compressedSize = buffer.readUInt32LE(found + 20);
        const nameLength = buffer.readUInt16LE(found + 28);
        const extraLength = buffer.readUInt16LE(found + 30);
        const commentLength = buffer.readUInt16LE(found + 32);
        const localOffset = buffer.readUInt32LE(found + 42);
        const name = buffer.toString('utf8', found + 46, found + 46 + nameLength);

        // A local header repeats the name, but may carry a different extra field,
        // so the data offset has to come from the local header rather than assumed.
        const localNameLength = buffer.readUInt16LE(localOffset + 26);
        const localExtraLength = buffer.readUInt16LE(localOffset + 28);
        const dataStart = localOffset + 30 + localNameLength + localExtraLength;
        const raw = buffer.subarray(dataStart, dataStart + compressedSize);

        entries.set(name, method === 0 ? raw : zlib.inflateRawSync(raw));

        offset = found + 46 + nameLength + extraLength + commentLength;
    }
    return entries;
};

const zipEntryNames = (buffer) => [...zipEntries(buffer).keys()];
const slidePartNames = (names) => names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));

test('produces a real pptx archive, not an empty or malformed file', async () => {
    const buffer = await buildPptx(fixture(), null);

    assert.ok(Buffer.isBuffer(buffer), 'must return a Buffer');
    assert.ok(buffer.length > 5000, `deck looks too small to contain slides: ${buffer.length} bytes`);

    // A .pptx is a zip: "PK\x03\x04" local header, then "PK\x05\x06" end record.
    assert.strictEqual(buffer.subarray(0, 4).toString('hex'), '504b0304', 'missing zip local file header');
    assert.ok(buffer.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06])), 'missing zip end-of-central-directory');
});

test('contains one slide part per slide plus the required package parts', async () => {
    const buffer = await buildPptx(fixture(6), null);
    const names = zipEntryNames(buffer);

    const slideParts = names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
    assert.strictEqual(slideParts.length, 6, `expected 6 slide parts, got ${slideParts.length}`);

    // These are what make the file openable in PowerPoint rather than merely zipped.
    for (const required of ['[Content_Types].xml', 'ppt/presentation.xml']) {
        assert.ok(names.includes(required), `missing ${required}`);
    }
});

test('every slide type branch still renders', async () => {
    // title / content / quiz / summary each take a different path through the
    // renderer, so a fixture that misses one would not notice a regression in it.
    const buffer = await buildPptx(fixture(), null);
    const names = zipEntryNames(buffer);
    assert.strictEqual(names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length, 4);
    assert.ok(buffer.length > 5000);
});

test('slide text actually reaches the slide XML', async () => {
    const entries = zipEntries(await buildPptx(fixture(), null));

    // Read the title slide and confirm the text survived into the XML, escaping and
    // all. If the extraction had clipped or truncated a layout branch this is where
    // it would show up.
    const slide1 = entries.get('ppt/slides/slide1.xml').toString('utf8');
    assert.match(slide1, /Photosynthesis/, 'title text missing from slide 1');
    assert.match(slide1, /Year 10 Biology/, 'subtitle text missing from slide 1');

    const slide2 = entries.get('ppt/slides/slide2.xml').toString('utf8');
    assert.match(slide2, /chloroplast/, 'body bullet text missing from slide 2');
});

test('a logo is embedded as media when supplied', async () => {
    const logoData = `data:image/png;base64,${png}`;

    const withLogo = await buildPptx(fixture(3), logoData);
    const withoutLogo = await buildPptx(fixture(3), null);

    // pptxgenjs always writes the ppt/media/ directory entry, so count files only.
    const imageIn = (buffer) =>
        zipEntryNames(buffer).filter((n) => !n.endsWith('/') && n.startsWith('ppt/media/'));

    assert.ok(
        imageIn(withLogo).some((n) => n.endsWith('.png')),
        'logo was not added to the package'
    );
    assert.strictEqual(
        imageIn(withoutLogo).length,
        0,
        'a deck built without a logo should contain no media files'
    );
});

test('deckFileName keeps the filename the download route has always produced', async () => {
    // The frontend and anything already saved depend on this exact transformation.
    assert.strictEqual(deckFileName('Photosynthesis: An Introduction'), 'Photosynthesis__An_Introduction.pptx');
    assert.strictEqual(deckFileName('C++ / OOP'), 'C_____OOP.pptx');
    assert.strictEqual(deckFileName(''), 'Presentation.pptx');
    assert.strictEqual(deckFileName(undefined), 'Presentation.pptx');
    // A title is attacker-adjacent input: it must not be able to steer the path.
    assert.ok(!deckFileName('../../etc/passwd').includes('/'));
    assert.ok(!deckFileName('a/b\\c').includes('/'));
    assert.ok(!deckFileName('a/b\\c').includes('\\'));
});

test('the advertised mime type is the real presentation type', () => {
    assert.strictEqual(
        PPTX_MIME,
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
});

test('a slide list containing hostile strings cannot break the build', async () => {
    // Slide text reaches pptxgenjs as XML. It must be escaped by the library rather
    // than corrupting the package.
    const hostile = {
        presentationTitle: '<script>alert(1)</script>',
        slides: [
            { type: 'title', title: '</a:txBody></p:sp></a:graphicFrame></p:spTree>', subtitle: '&<>"' },
            { type: 'content', title: 'x'.repeat(5000), bulletPoints: ['ok', "quote'and\"double"] },
        ],
    };
    const buffer = await buildPptx(hostile, null);
    assert.ok(buffer.subarray(0, 4).toString('hex') === '504b0304');
    assert.strictEqual(zipEntryNames(buffer).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length, 2);
});

test('a deck with no slides still returns a valid package', async () => {
    // The route guards this with a 400, but the builder should not throw if called
    // directly with an empty outline.
    const buffer = await buildPptx({ presentationTitle: 'Empty', slides: [] }, null);
    assert.strictEqual(buffer.subarray(0, 4).toString('hex'), '504b0304');
});

// ─── Logo resolution ──────────────────────────────────────────────────────────
// The logo path was rewritten to be shareable between the route and the MCP tool,
// which meant re-deriving it. These cover the two properties that must survive:
// a stored logoUrl cannot read outside uploads/, and a remote one cannot be used
// to reach the internal network.

test('a logo path that escapes uploads is refused', () => {
    // These are the shapes a crafted logoUrl takes. None may return file contents.
    for (const attempt of [
        '../../../../etc/passwd',
        '../../../../Windows/win.ini',
        '/etc/passwd',
        '..\\..\\..\\..\\Windows\\win.ini',
        '/uploads/../../../etc/passwd',
        'logos/../../../../etc/passwd',
    ]) {
        assert.strictEqual(
            localLogoDataUrl(attempt),
            null,
            `path traversal was not blocked: ${attempt}`
        );
    }
});

test('a real logo inside uploads is read as a data uri', () => {
    const dir = path.join(UPLOADS_ROOT, 'pptx-test');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'logo.png');
    fs.writeFileSync(file, Buffer.from(png, 'base64'));

    try {
        const dataUrl = localLogoDataUrl('/pptx-test/logo.png');
        assert.ok(dataUrl, 'expected the logo to be read');
        assert.ok(dataUrl.startsWith('data:image/png;base64,'), `wrong mime prefix: ${dataUrl.slice(0, 30)}`);

        // The bytes must survive the round trip untouched, not be re-encoded from a
        // decoded string — that is the corruption this path is supposed to prevent.
        const decoded = Buffer.from(dataUrl.split(',')[1], 'base64');
        assert.ok(decoded.equals(fs.readFileSync(file)), 'logo bytes were altered in transit');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('a non-image file inside uploads is not embedded', () => {
    const dir = path.join(UPLOADS_ROOT, 'pptx-test');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'not an image');

    try {
        assert.strictEqual(localLogoDataUrl('/pptx-test/notes.txt'), null);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('a missing logo file is simply skipped', () => {
    assert.strictEqual(localLogoDataUrl('/pptx-test/does-not-exist.png'), null);
});

test('plain http remote logos are refused', async () => {
    // Refused before any request is made, so this needs no network.
    assert.strictEqual(await remoteLogoDataUrl('http://example.com/logo.png'), null);
});

test('remote logos pointing at internal addresses are refused', async () => {
    // safeFetch rejects these on address alone. Literal IPs so nothing resolves.
    for (const url of [
        'https://127.0.0.1/logo.png',
        'https://localhost/logo.png',
        'https://169.254.169.254/latest/meta-data/',
        'https://10.0.0.1/logo.png',
    ]) {
        assert.strictEqual(await remoteLogoDataUrl(url), null, `internal address was not blocked: ${url}`);
    }
});
