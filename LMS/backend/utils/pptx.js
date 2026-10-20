// ─── PowerPoint rendering ─────────────────────────────────────────────────────────
// Turns a presentation outline into a real .pptx buffer.
//
// This exists as its own module because the work is needed in two places: the
// existing REST route that streams a download, and the MCP tool that returns the
// deck to an assistant's chat. Keeping one copy of the layout logic means the file
// a teacher downloads from the app and the file they receive in Claude cannot
// drift apart.
//
// The slide rendering below was moved here verbatim from the route it replaces.

const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');
const Tutorial = require('../models/Tutorial');
const School = require('../models/School');
const { safeFetch } = require('./safeFetch');

const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads');

const PPTX_MIME =
    'application/vnd.openxmlformats-officedocument.presentationml.presentation';

/** Filesystem-safe deck name, matching what the route has always returned. */
const deckFileName = (title) =>
    `${(title || 'Presentation').replace(/[^a-z0-9]/gi, '_')}.pptx`;

const MIME_BY_EXTENSION = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
};

/**
 * Where this user's logo lives, if anywhere.
 * Kept as a query on the user rather than a lookup by school name, so the value
 * that ends up in the deck is always one this account is actually attached to.
 */
const logoUrlForUser = async (user) => {
    try {
        if (user.role === 'personal_teacher' && user.tutorialId) {
            const tutorial = await Tutorial.findById(user.tutorialId).select('logoUrl').lean();
            return tutorial?.logoUrl || null;
        }
        if (Array.isArray(user.schoolId) && user.schoolId.length) {
            const school = await School.findById(user.schoolId[0]).select('logoUrl').lean();
            return school?.logoUrl || null;
        }
    } catch (err) {
        console.error('[pptx] logo lookup failed:', err.message);
    }
    return null;
};

/**
 * Read a locally-stored logo as a data URI, or null if it cannot be used.
 *
 * A logo is decoration, so every failure here is swallowed and the deck is built
 * without one. The one thing that must not be swallowed is a path that escapes
 * uploads/: a stored logoUrl of "../../../../etc/passwd" would otherwise be read
 * off the filesystem and embedded into the file the caller downloads.
 */
const localLogoDataUrl = (logoUrl) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    const cleanRelPath = logoUrl.startsWith(baseUrl) ? logoUrl.slice(baseUrl.length) : logoUrl;

    const absPath = path.resolve(UPLOADS_ROOT, cleanRelPath.replace(/\\/g, '/').replace(/^\/+/, ''));
    const insideUploads = absPath === UPLOADS_ROOT || absPath.startsWith(UPLOADS_ROOT + path.sep);

    if (!insideUploads || !fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
        console.warn('[pptx] logo path resolved outside uploads, skipping:', logoUrl);
        return null;
    }

    const extension = path.extname(absPath).toLowerCase().replace('.', '') || 'png';
    const mime = MIME_BY_EXTENSION[extension];
    if (!mime) {
        console.warn('[pptx] unsupported logo extension, skipping:', extension);
        return null;
    }
    return `data:${mime};base64,${fs.readFileSync(absPath).toString('base64')}`;
};

/**
 * Fetch a remote logo as a data URI, or null if it cannot be used.
 *
 * safeFetch refuses internal and link-local addresses, so a crafted logoUrl cannot
 * be turned into an SSRF probe, and `responseType: 'buffer'` keeps the bytes intact —
 * re-encoding a decoded string as 'binary' corrupts every byte above 0x7F.
 */
const remoteLogoDataUrl = async (logoUrl) => {
    if (!logoUrl.startsWith('https://')) {
        console.warn('[pptx] skipping insecure http logo');
        return null;
    }

    try {
        const res = await safeFetch(logoUrl, {
            timeoutMs: 5000,
            maxBytes: 4 * 1024 * 1024,
            responseType: 'buffer',
            headers: { Accept: 'image/*' },
        });
        if (res.redirected || res.status !== 200) return null;

        const contentType = (res.headers['content-type'] || 'image/png').split(';')[0].trim();
        if (!contentType.startsWith('image/')) {
            console.warn('[pptx] skipping logo with non-image content-type:', contentType);
            return null;
        }
        return `data:${contentType};base64,${res.body.toString('base64')}`;
    } catch (err) {
        console.warn('[pptx] could not fetch remote logo, skipping:', err.message);
        return null;
    }
};

/** Find this user's logo and turn it into a data URI, or null to build without one. */
const resolveLogoDataUrl = async (user) => {
    const logoUrl = await logoUrlForUser(user);
    if (!logoUrl) return null;
    return /^https?:\/\//i.test(logoUrl) ? remoteLogoDataUrl(logoUrl) : localLogoDataUrl(logoUrl);
};

/**
 * Build the deck.
 *
 * @param {object} presentation  { presentationTitle, slides: [...] }
 * @param {string|null} logoData data URI, or null for no logo
 * @returns {Promise<Buffer>}
 */
const buildPptx = async (presentation, logoData = null) => {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'Gracified LMS AI';
    pptx.subject = presentation.presentationTitle || 'Lesson';
    pptx.title = presentation.presentationTitle || 'Lesson';

    // Theme colors
    const THEME = {
        PRIMARY: '4F46E5',    // indigo-600
        ACCENT: '7C3AED',     // violet-600
        DARK: '1E1B4B',       // very dark indigo
        WHITE: 'FFFFFF',
        LIGHT: 'EEF2FF',      // indigo-50
        MUTED: '6B7280',
    };

    presentation.slides.forEach((slide, idx) => {
        const pptSlide = pptx.addSlide();

        if (slide.type === 'title' || idx === 0) {
            // ── Title slide ───────────────────────────────────────────────
            // Background gradient-like fill
            pptSlide.background = { color: THEME.DARK };

            // Decorative accent bar
            pptSlide.addShape(pptx.ShapeType.rect, {
                x: 0, y: 4.5, w: '100%', h: 0.08,
                fill: { color: THEME.PRIMARY },
                line: { type: 'none' }
            });

            // Decorative large circle (top-right)
            pptSlide.addShape(pptx.ShapeType.ellipse, {
                x: 7.5, y: -1.5, w: 3, h: 3,
                fill: { color: THEME.PRIMARY, transparency: 70 },
                line: { type: 'none' }
            });

            pptSlide.addText(presentation.presentationTitle || slide.title || '', {
                x: 0.8, y: 1.5, w: 8.4, h: 1.5,
                fontSize: 36, bold: true, color: THEME.WHITE,
                fontFace: 'Calibri',
                align: 'left', valign: 'middle',
                breakLine: false,
            });

            if (presentation.subtitle) {
                pptSlide.addText(presentation.subtitle, {
                    x: 0.8, y: 3.1, w: 7, h: 0.6,
                    fontSize: 16, color: 'A5B4FC',
                    fontFace: 'Calibri', align: 'left',
                });
            }

            if (slide.speakerNotes) {
                pptSlide.addNotes(slide.speakerNotes);
            }

        } else if (slide.type === 'summary' || slide.type === 'quiz') {
            // ── Summary / Quiz slide ──────────────────────────────────────
            pptSlide.background = { color: THEME.LIGHT };

            pptSlide.addShape(pptx.ShapeType.rect, {
                x: 0, y: 0, w: '100%', h: 1.1,
                fill: { color: THEME.PRIMARY },
                line: { type: 'none' }
            });

            pptSlide.addText(slide.title || '', {
                x: 0.4, y: 0.1, w: 9.2, h: 0.9,
                fontSize: 24, bold: true, color: THEME.WHITE,
                fontFace: 'Calibri', valign: 'middle',
            });

            if (slide.bulletPoints?.length) {
                const rows = slide.bulletPoints.map(bp => ([
                    { text: bp, options: { fontSize: 14, color: THEME.DARK, fontFace: 'Calibri', margin: [4, 4, 4, 4] } }
                ]));
                pptSlide.addTable(rows, {
                    x: 0.6, y: 1.3, w: 8.8,
                    fill: { color: THEME.WHITE },
                    border: { type: 'none' },
                    rowH: 0.45,
                });
            }

            if (slide.speakerNotes) pptSlide.addNotes(slide.speakerNotes);

        } else {
            // ── Regular content slide ─────────────────────────────────────
            pptSlide.background = { color: THEME.WHITE };

            // Left accent bar
            pptSlide.addShape(pptx.ShapeType.rect, {
                x: 0, y: 0, w: 0.15, h: '100%',
                fill: { color: THEME.PRIMARY },
                line: { type: 'none' }
            });

            // Header band
            pptSlide.addShape(pptx.ShapeType.rect, {
                x: 0.15, y: 0, w: '100%', h: 1.05,
                fill: { color: THEME.LIGHT },
                line: { type: 'none' }
            });

            // Slide number badge
            pptSlide.addText(`${slide.slideNumber || idx + 1}`, {
                x: 9.0, y: 4.8, w: 0.5, h: 0.3,
                fontSize: 9, color: THEME.MUTED, align: 'right',
                fontFace: 'Calibri',
            });

            // Title
            pptSlide.addText(slide.title || '', {
                x: 0.5, y: 0.1, w: 9.0, h: 0.85,
                fontSize: 22, bold: true, color: THEME.PRIMARY,
                fontFace: 'Calibri', valign: 'middle',
            });

            // Bullet points
            if (slide.bulletPoints?.length) {
                const bulletText = slide.bulletPoints.map(bp => ({
                    text: bp,
                    options: { bullet: { type: 'bullet', indent: 10 }, fontSize: 14, color: THEME.DARK, paraSpaceAfter: 6 }
                }));
                pptSlide.addText(bulletText, {
                    x: 0.5, y: 1.2, w: 9.0, h: 3.4,
                    fontFace: 'Calibri', valign: 'top',
                    wrap: true,
                });
            }

            if (slide.speakerNotes) pptSlide.addNotes(slide.speakerNotes);
        }

        // ── Footer (All slides) ──────────────────────────────────────────
        // Background bar for footer
        pptSlide.addShape(pptx.ShapeType.rect, {
            x: 0, y: 5.2, w: '100%', h: 0.4,
            fill: { color: THEME.LIGHT },
            line: { type: 'none' }
        });

        // Logo
        if (logoData) {
            pptSlide.addImage({
                data: logoData.startsWith('data:') ? logoData : undefined,
                path: !logoData.startsWith('data:') ? logoData : undefined,
                x: 0.2, y: 5.25, w: 0.3, h: 0.3
            });
        }

        // Branding text
        pptSlide.addText('Generated on Gracified LMS', {
            x: logoData ? 0.6 : 0.2, y: 5.2, w: 5, h: 0.4,
            fontSize: 8, color: THEME.MUTED,
            fontFace: 'Calibri', italic: true,
            valign: 'middle',
        });

        // Page number (redundant but nice)
        pptSlide.addText(`${idx + 1}`, {
            x: 9.3, y: 5.2, w: 0.5, h: 0.4,
            fontSize: 8, color: THEME.MUTED,
            fontFace: 'Calibri', align: 'right',
            valign: 'middle',
        });
    });


    const output = await pptx.write({ outputType: 'nodebuffer' });
    return Buffer.from(output);
};

/**
 * Full path used by both callers: resolve the logo, then render.
 * @returns {Promise<{ buffer: Buffer, fileName: string, mimeType: string }>}
 */
const buildPresentationPptx = async (presentation, { user } = {}) => {
    const logoData = user ? await resolveLogoDataUrl(user) : null;
    const buffer = await buildPptx(presentation, logoData);
    return {
        buffer,
        fileName: deckFileName(presentation.presentationTitle),
        mimeType: PPTX_MIME,
    };
};

module.exports = {
    buildPresentationPptx,
    buildPptx,
    resolveLogoDataUrl,
    localLogoDataUrl,
    remoteLogoDataUrl,
    deckFileName,
    PPTX_MIME,
};
