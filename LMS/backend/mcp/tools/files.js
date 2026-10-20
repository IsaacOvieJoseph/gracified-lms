// ─── File tools ──────────────────────────────────────────────────────────────
// Produce a real file for the user instead of more text in the transcript.
//
// A generated slide deck is the case that needs this. Returning base64 inside a
// text block would technically deliver the bytes, but no chat client offers that
// as a download, and a teacher who asked for slides wants something they can
// open. MCP embedded resources exist for exactly this, so `build_slide_deck`
// returns the .pptx as a resource and the client renders it as an attachment.
//
// The rendering itself is not here. It lives in utils/pptx.js, which the web app's
// download route calls too, so a deck a teacher gets from their browser and one
// they get through an assistant are built by the same code. That is the whole
// point of the extraction: two delivery mechanisms, one renderer.
//
// This tool deliberately calls no AI. The outline it renders is content the model
// already has — usually straight from `draft_slides` — so re-generating it here
// would cost the user a second generation and usually change the answer. For the
// same reason its effect is 'render' rather than 'draft', because 'draft' is what
// the transport meters as AI usage, and nothing here consumes a token.

const crypto = require('crypto');
const { register, resourceResult, SCOPES } = require('./registry');
const { buildPresentationPptx, PPTX_MIME } = require('../../utils/pptx');

const STAFF = ['teacher', 'personal_teacher', 'school_admin', 'root_admin'];

// The renderer accepts whatever it is given, so the caps live here, at the edge
// where untrusted model output enters. A deck of 400 slides or a slide whose
// "bullet" is an entire chapter would produce a file large enough to be a problem
// for the client to hold, not just for us to send.
const MAX_SLIDES = 60;
const MAX_BULLETS = 12;
const MAX_TITLE = 200;
const MAX_BULLET = 400;
const MAX_NOTES = 2000;

// Base64 inflates by 4/3, and this travels inside one JSON-RPC message. A 60-slide
// deck lands around 1.5 MB, so this only trips on pathological input — but it is a
// hard stop rather than a silent truncation, because a truncated .pptx would be a
// corrupt file the user could not tell apart from a real one.
const MAX_DECK_BYTES = 8 * 1024 * 1024;

const SLIDE_TYPES = ['title', 'content', 'quiz', 'summary'];

/** Trim to a string and a length, treating anything non-string as absent. */
const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/**
 * Coerce one model-supplied slide into the shape the renderer expects.
 *
 * Everything here is model output, so nothing is trusted to be the right type: a
 * slide may arrive with bullets as a string, as null, or as an object. Rendering
 * whatever turns up would either throw or produce a nonsense deck, so each field
 * is narrowed to what it is supposed to be and anything unusable is dropped.
 */
const normaliseSlide = (raw, index) => {
    const source = raw && typeof raw === 'object' ? raw : {};

    // `draft_slides` describes bullets as "bullets" while the renderer reads
    // "bulletPoints". Both spellings are accepted so the two tools compose
    // regardless of which one the model echoes back.
    const rawBullets = Array.isArray(source.bulletPoints)
        ? source.bulletPoints
        : Array.isArray(source.bullets)
          ? source.bullets
          : [];

    const bulletPoints = rawBullets
        .map((b) => text(typeof b === 'string' ? b : b?.text, MAX_BULLET))
        .filter(Boolean)
        .slice(0, MAX_BULLETS);

    // Only the first slide can be a title slide in the layout; asking for a title
    // midway through produces a deck with two title slides, which reads as a bug
    // to the teacher receiving it.
    const requestedType = text(source.type, 20);
    const type =
        index === 0 && requestedType === 'title'
            ? 'title'
            : SLIDE_TYPES.includes(requestedType) && requestedType !== 'title'
              ? requestedType
              : 'content';

    return {
        type,
        title: text(source.title, MAX_TITLE) || `Slide ${index + 1}`,
        bulletPoints,
        speakerNotes: text(source.speakerNotes ?? source.notes, MAX_NOTES),
    };
};

/**
 * Normalise a whole deck. Returns null when there is nothing renderable, so the
 * caller can tell "the model gave me an empty outline" apart from a real failure.
 */
const normaliseDeck = (raw) => {
    const source = raw && typeof raw === 'object' ? raw : {};
    const rawSlides = Array.isArray(source.slides) ? source.slides : [];

    const slides = rawSlides.slice(0, MAX_SLIDES).map(normaliseSlide);
    if (!slides.length) return null;

    return {
        presentationTitle: text(source.title ?? source.presentationTitle, MAX_TITLE) || 'Presentation',
        subtitle: text(source.subtitle, MAX_TITLE),
        slides,
    };
};

register({
    name: 'build_slide_deck',
    description:
        'Render an outline you already have into a downloadable PowerPoint file (.pptx). ' +
        'Call draft_slides first, then pass its outline here. Accepts bullets or bulletPoints. ' +
        `Up to ${MAX_SLIDES} slides. Costs no AI generation of its own.`,
    effect: 'render',
    // Generating a document is a drafting action, so it sits behind the same scope
    // as the drafting tools even though it calls no model.
    requiredScope: SCOPES.DRAFT,
    allowedRoles: STAFF,
    inputSchema: {
        type: 'object',
        properties: {
            title: { type: 'string', description: 'Deck title.' },
            subtitle: { type: 'string', description: 'Optional subtitle for the title slide.' },
            slides: {
                type: 'array',
                description: 'The slides to render, in order.',
                items: {
                    type: 'object',
                    properties: {
                        type: {
                            type: 'string',
                            enum: SLIDE_TYPES,
                            description: "Slide layout. 'title' is only honoured on the first slide.",
                        },
                        title: { type: 'string', description: 'Slide heading.' },
                        bullets: {
                            type: 'array',
                            items: { type: 'string' },
                            description: `Body points. Up to ${MAX_BULLETS}, kept short.`,
                        },
                        speakerNotes: { type: 'string', description: 'Notes for the teacher.' },
                    },
                    required: ['title'],
                },
            },
        },
        required: ['title', 'slides'],
    },
    handler: async ({ user, args }) => {
        // The model may nest the deck under `presentation` if it copied the shape
        // used by the web app's download endpoint, or pass the fields directly.
        const deck = normaliseDeck(args.presentation ?? args) || normaliseDeck(args.deck ?? args);

        if (!deck) {
            const err = new Error(
                'No slides to render. Pass an outline with a "slides" array, for example the one draft_slides returned.'
            );
            err.code = 'EMPTY_DECK';
            throw err;
        }

        const { buffer, fileName } = await buildPresentationPptx(deck, { user });

        if (buffer.length > MAX_DECK_BYTES) {
            const err = new Error(
                `That deck renders to ${(buffer.length / 1024 / 1024).toFixed(1)} MB, over the ` +
                    `${(MAX_DECK_BYTES / 1024 / 1024).toFixed(0)} MB limit for an inline file. ` +
                    'Ask for fewer or shorter slides and try again.'
            );
            err.code = 'DECK_TOO_LARGE';
            throw err;
        }

        return resourceResult(
            `Rendered "${deck.presentationTitle}" as ${deck.slides.length} slides (${fileName}, ` +
                `${Math.round(buffer.length / 1024)} KB). The deck is attached; tell the user it is ready to open or download.`,
            {
                // Unique per call so a client that caches by URI cannot serve a
                // previous deck in place of this one.
                uri: `gracy://slides/${crypto.randomUUID()}/${fileName}`,
                mimeType: PPTX_MIME,
                blob: buffer.toString('base64'),
            }
        );
    },
});

module.exports = { normaliseDeck, normaliseSlide, MAX_SLIDES, MAX_DECK_BYTES };
