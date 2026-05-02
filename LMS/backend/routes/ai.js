const express = require('express');
const { auth } = require('../middleware/auth');
const Settings = require('../models/Settings');
const School = require('../models/School');
const Tutorial = require('../models/Tutorial');
const PptxGenJS = require('pptxgenjs');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// ─── Provider helpers ─────────────────────────────────────────────────────────

const callGroq = async (prompt) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === 'your_groq_api_key_here') {
        throw new Error('GROQ_API_KEY is not configured. Add your key from console.groq.com/keys to backend/.env and restart the server.');
    }

    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey });

    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: 'You are an expert educator and curriculum designer. Always respond with valid JSON only — no markdown, no extra text.' },
                { role: 'user', content: prompt }
            ],
            model,
            temperature: 0.7,
            max_tokens: 4096,
            response_format: { type: 'json_object' }
        });
        return completion.choices[0]?.message?.content?.trim() || '';
    } catch (err) {
        if (err?.status === 401) {
            throw new Error('Groq API key is invalid. Please check GROQ_API_KEY in backend/.env and restart the server.');
        }
        throw err;
    }
};

const callGemini = async (prompt) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');

    const fetch = (await import('node-fetch')).default;
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Strip markdown fences if Gemini wraps response
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    return text;
};

// ─── Central call dispatcher ──────────────────────────────────────────────────
const callAI = async (prompt) => {
    const settings = await Settings.findOne();
    const provider = settings?.activeAIProvider || 'groq';

    if (provider === 'gemini') {
        return callGemini(prompt);
    }
    return callGroq(prompt);
};

const parseJSON = (text) => {
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
};

// ─── GET /api/ai/provider ─────────────────────────────────────────────────────
// Returns the currently active AI provider (public — frontend can display it)
router.get('/provider', async (req, res) => {
    try {
        const settings = await Settings.findOne();
        res.json({ provider: settings?.activeAIProvider || 'groq' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/ai/generate-topic ─────────────────────────────────────────────
router.post('/generate-topic', auth, async (req, res) => {
    try {
        const { className, subject, level, teacherHint } = req.body;
        if (!subject) return res.status(400).json({ message: 'subject is required' });

        const prompt = `Generate a structured class topic as a JSON object.

Class: "${className || 'General'}"
Subject: "${subject}"
Level: "${level || 'General'}"
Teacher Hint: "${teacherHint || 'None'}"

Return ONLY this JSON structure:
{
  "name": "Topic title (max 60 chars)",
  "description": "2-3 sentence description of what students will learn",
  "lessonsOutline": "Bullet outline of 4-6 key lessons, each starting with •",
  "duration": { "mode": "day", "value": 7 }
}
Duration mode can be "day", "week", or "month".`;

        const raw = await callAI(prompt);
        const result = parseJSON(raw);
        res.json({ success: true, topic: result });
    } catch (err) {
        console.error('AI generate-topic error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/ai/generate-assignment ────────────────────────────────────────
router.post('/generate-assignment', auth, async (req, res) => {
    try {
        const { className, topicName, subject, level, assignmentType, questionCount, teacherHint } = req.body;
        if (!topicName && !subject) return res.status(400).json({ message: 'topicName or subject is required' });

        const count = Math.min(parseInt(questionCount) || 5, 20);
        const type = assignmentType === 'mcq' ? 'mcq' : 'theory';

        const mcqSchema = `{
  "title": "Assignment title",
  "description": "Brief instructions (1-2 sentences)",
  "questions": [
    {
      "questionText": "Question text",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctOption": "Option A text"
    }
  ]
}
IMPORTANT: correctOption must be the exact text of one of the options.`;

        const theorySchema = `{
  "title": "Assignment title",
  "description": "Brief instructions (1-2 sentences)",
  "questions": [
    {
      "questionText": "Question text",
      "markingPreference": "manual",
      "maxScore": 10
    }
  ]
}`;

        const prompt = `Generate a ${type.toUpperCase()} assignment as a JSON object.

Class: "${className || 'General'}"
Topic: "${topicName || subject}"
Subject: "${subject || topicName}"
Level: "${level || 'General'}"
Number of questions: ${count}
Teacher notes: "${teacherHint || 'None'}"

Return ONLY this JSON structure:
${type === 'mcq' ? mcqSchema : theorySchema}`;

        const raw = await callAI(prompt);
        const result = parseJSON(raw);
        res.json({ success: true, assignment: result });
    } catch (err) {
        console.error('AI generate-assignment error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/ai/generate-exam ──────────────────────────────────────────────
router.post('/generate-exam', auth, async (req, res) => {
    try {
        const { className, topicName, subject, level, questionCount, duration, teacherHint, examType } = req.body;
        if (!topicName && !subject) return res.status(400).json({ message: 'topicName or subject is required' });

        const count = Math.min(parseInt(questionCount) || 10, 30);
        const type = examType === 'theory' ? 'theory' : 'mcq';

        const mcqSchema = `{
  "title": "Formal exam title",
  "description": "Exam instructions for candidates (2-3 sentences)",
  "duration": ${duration || 60},
  "questions": [
    {
      "questionText": "Question text",
      "questionType": "mcq",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctOptionIndex": 0,
      "maxScore": 1
    }
  ]
}
IMPORTANT: correctOptionIndex is the 0-based index of the correct option.`;

        const theorySchema = `{
  "title": "Formal theory exam title",
  "description": "Exam instructions for candidates (2-3 sentences)",
  "duration": ${duration || 60},
  "questions": [
    {
      "questionText": "Question text",
      "questionType": "theory",
      "maxScore": 10
    }
  ]
}`;

        const prompt = `Generate a formal ${type.toUpperCase()} examination as a JSON object.

Class: "${className || 'General'}"
Topic / Coverage: "${topicName || subject}"
Subject: "${subject || topicName}"
Level: "${level || 'General'}"
Duration: ${duration || 60} minutes
Number of questions: ${count}
Teacher notes: "${teacherHint || 'None'}"

Return ONLY this JSON structure:
${type === 'mcq' ? mcqSchema : theorySchema}`;

        const raw = await callAI(prompt);
        const result = parseJSON(raw);
        res.json({ success: true, exam: result });
    } catch (err) {
        console.error('AI generate-exam error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/ai/generate-classroom ──────────────────────────────────────────
router.post('/generate-classroom', auth, async (req, res) => {
    try {
        const { subject, level, className, teacherHint } = req.body;
        const prompt = `Generate details for a new school classroom/course.
Subject: ${subject}
Level: ${level}
Class Name (optional): ${className}
Teacher Hint: ${teacherHint}

Return ONLY this JSON structure:
{
  "name": "Professional name for the class",
  "description": "Engaging 2-3 paragraph description of the course",
  "learningOutcomes": "List of 5-8 key outcomes, separated by commas"
}`;
        const raw = await callAI(prompt);
        const result = parseJSON(raw);
        res.json({ success: true, classroom: result });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/ai/qna-assistant ───────────────────────────────────────────────
router.post('/qna-assistant', auth, async (req, res) => {
    try {
        const { question, context } = req.body;
        const prompt = `You are an expert academic assistant. Provide a helpful, clear, and accurate answer to the following question.
Context (if any): ${context || 'General knowledge'}
Question: ${question}

Return ONLY this JSON structure:
{
  "answer": "Markdown formatted detailed answer",
  "suggestedFollowUp": ["Question 1", "Question 2"]
}`;
        const raw = await callAI(prompt);
        const result = parseJSON(raw);
        res.json({ success: true, qna: result });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/ai/generate-syllabus ──────────────────────────────────────────
router.post('/generate-syllabus', auth, async (req, res) => {
    try {
        const { className, subject, level, description, outcomes, teacherHint } = req.body;
        const prompt = `Generate a comprehensive syllabus (list of topics) for a school course.
Class Name: "${className || 'General'}"
Subject: "${subject || 'General'}"
Level: "${level || 'General'}"
Context: "${description || 'None'}"
Outcomes: "${outcomes || 'None'}"
Teacher Preferences: "${teacherHint || 'None'}"

Return ONLY a JSON object with this exact structure:
{
  "topics": [
    {
      "name": "Concise topic title",
      "description": "1-2 sentence description",
      "lessonsOutline": "• Lesson 1\\n• Lesson 2\\n• Lesson 3",
      "duration": { "mode": "day", "value": 7 }
    }
  ]
}
Provide between 5 and 10 topics that form a logical learning progression. Duration mode can be "day", "week", or "month".`;

        const raw = await callAI(prompt);
        const result = parseJSON(raw);
        res.json({ success: true, syllabus: result });
    } catch (err) {
        console.error('AI generate-syllabus error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/ai/generate-powerpoint ────────────────────────────────────────
// Returns JSON outline (for preview in the panel)
router.post('/generate-powerpoint', auth, async (req, res) => {
    try {
        const { topicName, className, subject, level, slideCount, teacherHint } = req.body;
        if (!topicName && !subject) return res.status(400).json({ message: 'topicName or subject is required' });

        const count = Math.min(parseInt(slideCount) || 8, 20);

        const prompt = `Generate a PowerPoint presentation outline as a JSON object.

Topic: "${topicName || subject}"
Class: "${className || 'General'}"
Subject: "${subject || topicName}"
Level: "${level || 'General'}"
Number of slides: ${count}
Teacher notes: "${teacherHint || 'None'}"

Return ONLY this JSON structure:
{
  "presentationTitle": "Main presentation title",
  "subtitle": "Course or class subtitle",
  "slides": [
    {
      "slideNumber": 1,
      "title": "Slide title",
      "type": "title",
      "bulletPoints": [],
      "speakerNotes": "What the teacher says on this slide"
    },
    {
      "slideNumber": 2,
      "title": "Slide title",
      "type": "content",
      "bulletPoints": ["Key point 1", "Key point 2", "Key point 3"],
      "speakerNotes": "Elaboration notes for the teacher"
    }
  ]
}
Slide types: "title" (first only), "content", "activity", "summary", "quiz".`;

        const raw = await callAI(prompt);
        const result = parseJSON(raw);
        res.json({ success: true, presentation: result });
    } catch (err) {
        console.error('AI generate-powerpoint error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/ai/download-powerpoint ────────────────────────────────────────
// Accepts a presentation JSON and returns a real .pptx binary file
router.post('/download-powerpoint', auth, async (req, res) => {
    try {
        const { presentation } = req.body;
        if (!presentation || !presentation.slides) {
            return res.status(400).json({ message: 'No presentation data provided' });
        }

        // Fetch School/Tutorial Logo and convert to base64
        let logoData = null;
        try {
            let logoUrl = null;
            if (req.user.role === 'personal_teacher' && req.user.tutorialId) {
                const tut = await Tutorial.findById(req.user.tutorialId);
                logoUrl = tut?.logoUrl;
            } else if (req.user.schoolId && req.user.schoolId.length > 0) {
                const school = await School.findById(req.user.schoolId[0]);
                logoUrl = school?.logoUrl;
            }

            if (logoUrl) {
                // Try local file first (fastest)
                const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
                const cleanRelPath = logoUrl.startsWith('http') 
                    ? logoUrl.replace(baseUrl, '').replace(/^\/+/, '')
                    : logoUrl.replace(/\\/g, '/').replace(/^\/+/, '');
                
                const absPath = path.join(__dirname, '..', cleanRelPath);
                
                if (fs.existsSync(absPath)) {
                    const buffer = fs.readFileSync(absPath);
                    let ext = path.extname(absPath).toLowerCase().replace('.', '') || 'png';
                    if (ext === 'jpg') ext = 'jpeg';
                    logoData = `data:image/${ext};base64,${buffer.toString('base64')}`;
                } else if (logoUrl.startsWith('https')) {
                    // Try fetching via axios ONLY for https to avoid crashing pptxgenjs
                    try {
                        const axios = require('axios');
                        const response = await axios.get(logoUrl, { responseType: 'arraybuffer', timeout: 5000 });
                        const buffer = Buffer.from(response.data, 'binary');
                        const contentType = response.headers['content-type'] || 'image/png';
                        logoData = `data:${contentType};base64,${buffer.toString('base64')}`;
                    } catch (fetchErr) {
                        console.warn('Could not fetch remote logo, skipping:', fetchErr.message);
                    }
                } else if (logoUrl.startsWith('http:')) {
                    console.warn('[PPT] Skipping insecure http logo to prevent crash');
                    logoData = null;
                }
            }
        } catch (logoErr) {
            console.error('Logo processing error for PPT:', logoErr.message);
        }

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

        const fileName = `${(presentation.presentationTitle || 'Presentation').replace(/[^a-z0-9]/gi, '_')}.pptx`;
        console.log(`[PPT] Generating ${fileName} with ${presentation.slides.length} slides...`);

        // Write to buffer and stream to response
        const output = await pptx.write({ outputType: 'nodebuffer' });
        const buffer = Buffer.from(output);
        console.log(`[PPT] Generated buffer size: ${buffer.length} bytes`);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);

    } catch (err) {
        console.error('AI download-powerpoint error:', err.message);
        console.error(err.stack);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
