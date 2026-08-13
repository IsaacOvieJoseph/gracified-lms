const express = require('express');
const { auth } = require('../middleware/auth');
const Settings = require('../models/Settings');
const School = require('../models/School');
const Tutorial = require('../models/Tutorial');
const TutorSession = require('../models/TutorSession');
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

// ─── AI Tutor (student self-learning) access control ──────────────────────────
// Resolution order: student override → their school's override → global setting.
// 'inherit' means "fall through to the next level".

const todayKey = () => new Date().toISOString().slice(0, 10);

const resolveStudentAIAccess = async (user) => {
    const settings = await Settings.findOne();
    let enabled = !!settings?.studentAIEnabled;
    const dailyLimit = Math.min(1000, Math.max(1, parseInt(settings?.studentAIDailyLimit) || 20));

    // School override (uses the student's first school)
    if (user.schoolId && user.schoolId.length > 0) {
        try {
            const school = await School.findById(user.schoolId[0]);
            if (school && school.aiTutorAccess === 'enabled') enabled = true;
            if (school && school.aiTutorAccess === 'disabled') enabled = false;
        } catch (_) { /* ignore school lookup errors */ }
    }

    // Student override (highest priority)
    if (user.aiTutorAccess === 'enabled') enabled = true;
    if (user.aiTutorAccess === 'disabled') enabled = false;

    return { enabled, dailyLimit };
};

const getTutorUsage = (user) => {
    const usage = user.aiTutorUsage || {};
    return usage.usageDate === todayKey() ? (usage.count || 0) : 0;
};

// Enabled-only gate (reads: access, history)
const requireStudentAITutor = async (req, res, next) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'AI Tutor is available to students only' });
        }
        const access = await resolveStudentAIAccess(req.user);
        if (!access.enabled) {
            return res.status(403).json({ message: 'AI Tutor is not enabled for your account. Contact your academy administrator.' });
        }
        req.aiTutor = { access, usedToday: getTutorUsage(req.user) };
        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Full gate (AI-consuming endpoints): enabled + daily quota
const requireStudentAI = async (req, res, next) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'AI Tutor is available to students only' });
        }
        const access = await resolveStudentAIAccess(req.user);
        if (!access.enabled) {
            return res.status(403).json({ message: 'AI Tutor is not enabled for your account. Contact your academy administrator.' });
        }
        const usedToday = getTutorUsage(req.user);
        if (usedToday >= access.dailyLimit) {
            return res.status(429).json({ message: `You have reached today's AI Tutor limit (${access.dailyLimit} interactions). Try again tomorrow.` });
        }
        req.aiTutor = { access, usedToday };
        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const consumeTutorQuota = async (user) => {
    const key = todayKey();
    const usage = user.aiTutorUsage || {};
    user.aiTutorUsage = usage.usageDate === key
        ? { usageDate: key, count: (usage.count || 0) + 1 }
        : { usageDate: key, count: 1 };
    await user.save();
};

// ─── GET /api/ai/provider ─────────────────────────────────────────────────────
// Returns the currently active AI provider (public — frontend can display it)
/**
 * @swagger
 * /api/ai/provider:
 *   get:
 *     summary: Get the currently active AI provider (Groq or Gemini)
 *     tags: [AI Services]
 *     responses:
 *       200:
 *         description: AI provider details
 */
router.get('/provider', async (req, res) => {
    try {
        const settings = await Settings.findOne();
        res.json({ provider: settings?.activeAIProvider || 'groq' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/ai/generate-topic ─────────────────────────────────────────────
/**
 * @swagger
 * /api/ai/generate-topic:
 *   post:
 *     summary: Generate a structured class topic using AI
 *     tags: [AI Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject
 *             properties:
 *               subject:
 *                 type: string
 *               level:
 *                 type: string
 *               className:
 *                 type: string
 *     responses:
 *       200:
 *         description: Topic generated
 */
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
/**
 * @swagger
 * /api/ai/generate-assignment:
 *   post:
 *     summary: Generate an assignment using AI
 *     tags: [AI Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               topicName:
 *                 type: string
 *               assignmentType:
 *                 type: string
 *                 enum: [mcq, theory]
 *     responses:
 *       200:
 *         description: Assignment generated
 */
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
/**
 * @swagger
 * /api/ai/generate-exam:
 *   post:
 *     summary: Generate a formal examination using AI
 *     tags: [AI Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               topicName:
 *                 type: string
 *               examType:
 *                 type: string
 *                 enum: [mcq, theory]
 *     responses:
 *       200:
 *         description: Exam generated
 */
router.post('/generate-exam', auth, async (req, res) => {
    try {
        const { className, topicName, subject, level, questionCount, duration, teacherHint, examType } = req.body;
        if (!topicName && !subject) return res.status(400).json({ message: 'topicName or subject is required' });

        const count = Math.min(parseInt(questionCount) || 10, 30);
        const type = examType === 'theory' ? 'theory' : 'mcq';

        const mcqSchema = `{
  "title": "Formal exam title",
  "description": "Exam instructions for candidates (2-3 sentences)",
  "duration": 45,
  "questions": [
    {
      "questionText": "Question text. Use LaTeX for math like \\( 2x^2 \\) or \\( \\\\frac{1}{2} \\)",
      "questionType": "mcq",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctOptionIndex": 0,
      "maxScore": 1
    }
  ]
}
IMPORTANT: Use LaTeX for any mathematical expressions, enclosed in \\( ... \\). duration should be a reasonable number of minutes. correctOptionIndex is 0-based.`;

        const theorySchema = `{
  "title": "Formal theory exam title",
  "description": "Exam instructions for candidates (2-3 sentences)",
  "duration": 60,
  "questions": [
    {
      "questionText": "Question text. Use LaTeX for math like \\( x = \\\\frac{-b \\\\pm \\\\sqrt{b^2-4ac}}{2a} \\)",
      "questionType": "theory",
      "maxScore": 10
    }
  ]
}
IMPORTANT: Use LaTeX for any mathematical expressions, enclosed in \\( ... \\). duration should be a reasonable number of minutes.`;

        const prompt = `Generate a formal ${type.toUpperCase()} examination as a JSON object.

Class: "${className || 'General'}"
Topic / Coverage: "${topicName || subject}"
Subject: "${subject || topicName}"
Level: "${level || 'General'}"
Number of questions: ${count}
Teacher notes: "${teacherHint || 'None'}"

Calculate and provide a "duration" (in minutes) that is appropriate for answering all ${count} ${type} questions at the specified ${level} level.

CRITICAL: All mathematical notation MUST be enclosed in double dollar signs: $$ math $$.
CRITICAL JSON ESCAPING: You MUST escape backslashes in your JSON strings. Use \\\\frac, \\\\sqrt, \\\\pm, etc. (four backslashes in your internal logic to result in two backslashes in the raw JSON string).
If you output \f (single backslash), the JSON will break. Always use \\\\f.

Examples: 
- "Solve $$ 2x^2 + 5x - 3 = 0 $$" 
- "Calculate $$ \\\\frac{3}{4} $$ of 100"
- "Using the quadratic formula $$ x = \\\\frac{-b \\\\pm \\\\sqrt{b^2-4ac}}{2a} $$"

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
/**
 * @swagger
 * /api/ai/generate-classroom:
 *   post:
 *     summary: Generate classroom details using AI
 *     tags: [AI Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject:
 *                 type: string
 *     responses:
 *       200:
 *         description: Classroom details generated
 */
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
/**
 * @swagger
 * /api/ai/qna-assistant:
 *   post:
 *     summary: Academic assistant for students (Q&A)
 *     tags: [AI Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question
 *             properties:
 *               question:
 *                 type: string
 *               context:
 *                 type: string
 *     responses:
 *       200:
 *         description: Answer generated
 */
router.post('/qna-assistant', auth, async (req, res) => {
    try {
        if (req.user.role === 'student') {
            return res.status(403).json({ message: 'AI Q&A is not available to students. Use the AI Tutor instead.' });
        }
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
/**
 * @swagger
 * /api/ai/generate-syllabus:
 *   post:
 *     summary: Generate a multi-topic syllabus using AI
 *     tags: [AI Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject:
 *                 type: string
 *     responses:
 *       200:
 *         description: Syllabus generated
 */
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
/**
 * @swagger
 * /api/ai/generate-powerpoint:
 *   post:
 *     summary: Generate a PowerPoint presentation outline using AI
 *     tags: [AI Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               topicName:
 *                 type: string
 *               slideCount:
 *                 type: number
 *     responses:
 *       200:
 *         description: PPT outline generated
 */
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
/**
 * @swagger
 * /api/ai/download-powerpoint:
 *   post:
 *     summary: Convert a presentation JSON to a real .pptx file
 *     tags: [AI Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - presentation
 *     responses:
 *       200:
 *         description: PPTX file buffer
 *         content:
 *           application/vnd.openxmlformats-officedocument.presentationml.presentation:
 *             schema:
 *               type: string
 *               format: binary
 */
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

// ─── POST /api/ai/generate-marketing-email ──────────────────────────────────────────────
/**
 * @swagger
 * /api/ai/generate-marketing-email:
 *   post:
 *     summary: Generate a marketing email template
 *     tags: [AI Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               prompt:
 *                 type: string
 *               kind:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email generated
 */
router.post('/generate-marketing-email', auth, async (req, res) => {
    try {
        const { prompt, kind } = req.body;
        if (!prompt) return res.status(400).json({ message: 'prompt is required' });

        const schema = `{
  "subject": "Catchy email subject line",
  "html": "The HTML content of the email"
}
IMPORTANT: Provide well-formatted HTML suitable for an email body. Do not include full <html> tags, just the content (like <div>, <p>, <h2>). You can use placeholders like {{firstName}} and {{company}}.`;

        const fullPrompt = `Generate a marketing email of type "${kind || 'general'}" based on the following instruction:
"${prompt}"

Return ONLY this JSON structure:
${schema}`;

        const raw = await callAI(fullPrompt);
        const result = parseJSON(raw);
        res.json({ success: true, email: result });
    } catch (err) {
        console.error('AI generate-marketing-email error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/ai/generate-marketing-campaign ──────────────────────────────────────────
/**
 * @swagger
 * /api/ai/generate-marketing-campaign:
 *   post:
 *     summary: Generate a multi-step marketing campaign with templates
 *     tags: [AI Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               prompt:
 *                 type: string
 *               numSteps:
 *                 type: number
 *     responses:
 *       200:
 *         description: Campaign generated
 */
router.post('/generate-marketing-campaign', auth, async (req, res) => {
    try {
        const { prompt, numSteps } = req.body;
        if (!prompt) return res.status(400).json({ message: 'prompt is required' });

        const stepsCount = numSteps ? parseInt(numSteps, 10) : 3;

        const schema = `{
  "campaignName": "Catchy and relevant internal campaign name",
  "campaignDescription": "A short summary of what this drip campaign is about",
  "emails": [
    {
      "name": "Template Name (e.g., Welcome Email, Follow-up 1)",
      "subject": "Email subject line",
      "html": "The HTML content of the email (well formatted with basic tags)",
      "delayDays": 0
    }
  ]
}
IMPORTANT: Provide exactly ${stepsCount} email objects in the "emails" array. The first email should typically have delayDays=0. The subsequent ones should have delayDays>0 representing the wait time after the previous email.`;

        const fullPrompt = `Generate a ${stepsCount}-step drip marketing campaign based on the following instruction:
"${prompt}"

Return ONLY this JSON structure:
${schema}`;

        const raw = await callAI(fullPrompt);
        const result = parseJSON(raw);
        res.json({ success: true, campaign: result });
    } catch (err) {
        console.error('AI generate-marketing-campaign error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// ═══ AI TUTOR — Student Self-Learning (mobile + web) ═══════════════════════════

// ─── GET /api/ai/tutor/access ─────────────────────────────────────────────────
// Effective AI Tutor access for the logged-in student (enabled + remaining quota).
router.get('/tutor/access', auth, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.json({ enabled: false, dailyLimit: 0, usedToday: 0, remaining: 0 });
        }
        const access = await resolveStudentAIAccess(req.user);
        const usedToday = getTutorUsage(req.user);
        res.json({
            enabled: access.enabled,
            dailyLimit: access.dailyLimit,
            usedToday,
            remaining: access.enabled ? Math.max(0, access.dailyLimit - usedToday) : 0
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── GET /api/ai/tutor/history ────────────────────────────────────────────────
// Lightweight list of the student's past tutor sessions.
router.get('/tutor/history', auth, requireStudentAITutor, async (req, res) => {
    try {
        const sessions = await TutorSession.find({ userId: req.user._id }).sort({ updatedAt: -1 }).limit(50);
        const history = sessions.map((s) => ({
            _id: s._id,
            topicId: s.topicId,
            subject: s.subject,
            updatedAt: s.updatedAt,
            chatCount: (s.chat || []).length,
            lastQuestion: (s.chat || []).filter((c) => c.role === 'user').slice(-1)[0]?.content || '',
            quizzes: (s.quizzes || []).map((q) => ({
                title: q.title,
                attempts: (q.attempts || []).length,
                bestScore: (q.attempts || []).reduce((best, a) => (a.total ? Math.max(best, Math.round((a.score / a.total) * 100)) : best), 0)
            }))
        }));
        res.json({ success: true, history });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/ai/tutor/chat ──────────────────────────────────────────────────
// Q&A with optional topic context. Never uses teacher assignment/exam content.
router.post('/tutor/chat', auth, requireStudentAI, async (req, res) => {
    try {
        const { question, context, topicId, sessionId } = req.body;
        if (!question || !String(question).trim()) {
            return res.status(400).json({ message: 'question is required' });
        }

        const prompt = `You are a friendly, encouraging AI tutor helping a student learn independently. Answer clearly and accurately, building on the student's current understanding.
Topic context (if any): ${context || 'General knowledge'}
Student question: ${question}

Return ONLY this JSON structure:
{
  "answer": "Markdown formatted detailed answer",
  "suggestedFollowUp": ["Question 1", "Question 2"]
}`;

        const raw = await callAI(prompt);
        const result = parseJSON(raw);

        // Persist to the student's session for that topic (or explicit session)
        let session = null;
        if (sessionId) {
            session = await TutorSession.findOne({ _id: sessionId, userId: req.user._id });
        }
        if (!session) {
            session = await TutorSession.findOne({ userId: req.user._id, topicId: topicId || null });
        }
        if (!session) {
            session = new TutorSession({ userId: req.user._id, topicId: topicId || null });
            if (context) session.subject = String(context).slice(0, 200);
        }
        session.chat.push({ role: 'user', content: String(question).slice(0, 2000) });
        session.chat.push({ role: 'assistant', content: String(result.answer || '').slice(0, 10000) });
        await session.save();

        await consumeTutorQuota(req.user);

        res.json({ success: true, sessionId: session._id, answer: result.answer, suggestedFollowUp: result.suggestedFollowUp || [] });
    } catch (err) {
        console.error('AI tutor chat error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/ai/tutor/quiz ──────────────────────────────────────────────────
// Generate a practice MCQ from topic STUDY MATERIAL ONLY (name/description/outline).
// The answer key is stored server-side and never returned to the client.
router.post('/tutor/quiz', auth, requireStudentAI, async (req, res) => {
    try {
        const { topicId, className, subject, level, questionCount, area, general } = req.body;
        let topicContext = '';
        let classroomName = className || '';
        let pickedTopics = [];

        const Topic = require('../models/Topic');

        if (topicId) {
            const topic = await Topic.findById(topicId);
            if (topic) {
                topicContext = [topic.name, topic.description, topic.lessonsOutline].filter(Boolean).join(' — ').slice(0, 2000);
                if (!classroomName && topic.classroomId) {
                    try {
                        const Classroom = require('../models/Classroom');
                        const cls = await Classroom.findById(topic.classroomId).select('name subject level');
                        if (cls) classroomName = cls.name;
                    } catch (_) { /* ignore */ }
                }
            }
        } else if (general) {
            // General mode: pick from completed topics of the classes the student is enrolled in.
            const User = require('../models/User');
            const student = await User.findById(req.user._id).select('enrolledClasses');
            const enrolledClassIds = (student?.enrolledClasses || []).map((c) => c?._id || c).filter(Boolean);
            const TopicProgress = require('../models/TopicProgress');
            const completedProgress = await TopicProgress.find({ userId: req.user._id, completionPercentage: { $gte: 100 } });
            const completedTopicIds = completedProgress.map((p) => p.topicId).filter(Boolean);

            const classFilter = enrolledClassIds.length ? { classroomId: { $in: enrolledClassIds } } : {};
            let candidates = [];
            if (completedTopicIds.length) {
                candidates = await Topic.find({ _id: { $in: completedTopicIds }, ...classFilter }).select('name description lessonsOutline classroomId');
            }
            if (!candidates.length && enrolledClassIds.length) {
                candidates = await Topic.find(classFilter).select('name description lessonsOutline classroomId').limit(10);
            }
            const shuffled = candidates.sort(() => Math.random() - 0.5).slice(0, 3);
            pickedTopics = shuffled.map((t) => t.name).filter(Boolean);
            topicContext = shuffled.map((t) => [t.name, t.description, t.lessonsOutline].filter(Boolean).join(' — ')).join('\n').slice(0, 2000);
        } else if (area && String(area).trim()) {
            topicContext = String(area).trim();
        }
        if (!topicContext && subject) topicContext = subject;

        const count = Math.min(parseInt(questionCount) || 5, 10);

        const prompt = `Generate a short multiple-choice practice quiz to help a student self-assess and learn. IMPORTANT: Do NOT reference or reproduce any teacher's assignment or examination. Base every question only on the study context provided.
Study context: "${topicContext || 'General'}"
Class: "${classroomName || 'General'}"
Subject: "${subject || 'General'}"
Level: "${level || 'General'}"
Number of questions: ${count}

Return ONLY this JSON structure:
{
  "title": "Practice quiz title",
  "questions": [
    {
      "questionText": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctOption": "Exact text of the correct option",
      "explanation": "1-2 sentence teaching explanation of the correct answer"
    }
  ]
}
IMPORTANT: correctOption must be the exact text of one of the options. Provide an explanation for every question.`;

        const raw = await callAI(prompt);
        const parsed = parseJSON(raw);
        const quiz = {
            title: parsed.title || 'Practice Quiz',
            topicContext: topicContext || '',
            questions: Array.isArray(parsed.questions) ? parsed.questions : []
        };
        if (!quiz.questions.length) {
            return res.status(500).json({ message: 'AI returned no questions. Please try again.' });
        }

        // Persist quiz (with answer key) server-side only
        let session = await TutorSession.findOne({ userId: req.user._id, topicId: topicId || null });
        if (!session) {
            session = new TutorSession({ userId: req.user._id, topicId: topicId || null, subject: subject || '' });
        }
        session.quizzes.push(quiz);
        await session.save();

        await consumeTutorQuota(req.user);

        const quizIndex = session.quizzes.length - 1;
        const safeQuestions = quiz.questions.map((q) => ({
            questionText: q.questionText,
            options: q.options || []
        }));

        res.json({ success: true, sessionId: session._id, quizIndex, title: quiz.title, questions: safeQuestions, pickedTopics });
    } catch (err) {
        console.error('AI tutor quiz error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/ai/tutor/quiz/submit ───────────────────────────────────────────
// Grade against the stored key, then AI writes per-question explanations + a summary.
router.post('/tutor/quiz/submit', auth, requireStudentAI, async (req, res) => {
    try {
        const { sessionId, quizIndex, answers } = req.body;
        if (!sessionId || quizIndex === undefined || quizIndex === null) {
            return res.status(400).json({ message: 'sessionId and quizIndex are required' });
        }

        const session = await TutorSession.findOne({ _id: sessionId, userId: req.user._id });
        if (!session) return res.status(404).json({ message: 'Session not found' });

        const quiz = session.quizzes[quizIndex];
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

        const selected = Array.isArray(answers) ? answers : [];
        const perQuestion = quiz.questions.map((q, index) => {
            const chosen = String(selected[index] !== undefined ? selected[index] : '').trim();
            const correct = String(q.correctOption || '').trim();
            return {
                questionText: q.questionText,
                selected: chosen || '(no answer)',
                correct,
                isCorrect: !!(chosen && chosen === correct),
                explanation: q.explanation || ''
            };
        });

        const score = perQuestion.filter((p) => p.isCorrect).length;
        const total = perQuestion.length;

        // AI summary feedback
        let summaryFeedback = `You scored ${score} out of ${total}.`;
        try {
            const correctTopics = perQuestion.filter((p) => p.isCorrect).map((p) => p.questionText).join(' | ').slice(0, 800);
            const weakTopics = perQuestion.filter((p) => !p.isCorrect).map((p) => p.questionText).join(' | ').slice(0, 800);
            const feedbackPrompt = `A student just completed a practice quiz scoring ${score}/${total}.
Areas done well: ${correctTopics || 'None'}
Areas to improve: ${weakTopics || 'None'}

Write a short, encouraging feedback summary (max 80 words) with 2-3 specific suggestions on what to study or practice next.

Return ONLY this JSON structure:
{
  "summary": "Feedback summary with suggestions"
}`;
            const raw = await callAI(feedbackPrompt);
            const parsed = parseJSON(raw);
            if (parsed.summary) summaryFeedback = parsed.summary;
        } catch (err) {
            console.warn('AI tutor feedback failed, using default:', err.message);
        }

        quiz.attempts.push({ answers: selected, score, total, perQuestion, summaryFeedback });
        await session.save();

        await consumeTutorQuota(req.user);

        res.json({ success: true, score, total, perQuestion, summaryFeedback });
    } catch (err) {
        console.error('AI tutor quiz submit error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// ─── GET /api/ai/tutor/progress ───────────────────────────────────────────────
// Aggregates ONLY the student's own data (topic progress, own submissions,
// own AI quiz attempts) and asks AI for a growth summary + next step.
router.get('/tutor/progress', auth, requireStudentAI, async (req, res) => {
    try {
        const userId = req.user._id;

        const TopicProgress = require('../models/TopicProgress');
        const topicProgressDocs = await TopicProgress.find({ userId });
        const topicsCompleted = topicProgressDocs.filter((p) => p.completionPercentage >= 100).length;
        const averageVideoCompletion = topicProgressDocs.length
            ? Math.round(topicProgressDocs.reduce((sum, p) => sum + (p.completionPercentage || 0), 0) / topicProgressDocs.length)
            : 0;

        const Assignment = require('../models/Assignment');
        const assignments = await Assignment.find({ 'submissions.studentId': userId }).lean();
        const assignmentPcts = [];
        assignments.forEach((a) => {
            (a.submissions || []).forEach((s) => {
                if (s.studentId && String(s.studentId) === String(userId) && s.status === 'graded' && s.score !== undefined) {
                    const maxScore = a.maxScore || 100;
                    assignmentPcts.push({ title: a.title, pct: maxScore ? (s.score / maxScore) * 100 : 0 });
                }
            });
        });

        const ExamSubmission = require('../models/ExamSubmission');
        const examSubs = await ExamSubmission.find({ studentId: userId, status: 'graded' }).populate('examId', 'title questions').lean();
        const examPcts = [];
        examSubs.forEach((s) => {
            const maxScore = s.examId && Array.isArray(s.examId.questions)
                ? s.examId.questions.reduce((sum, q) => sum + (q.maxScore || 1), 0)
                : 0;
            if (maxScore) examPcts.push({ title: s.examId?.title || 'Exam', pct: (s.totalScore || 0) / maxScore * 100 });
        });

        const sessions = await TutorSession.find({ userId });
        let aiQuizPcts = [];
        sessions.forEach((s) => {
            (s.quizzes || []).forEach((q) => {
                (q.attempts || []).forEach((att) => {
                    if (att.total) aiQuizPcts.push({ title: q.title || 'Practice Quiz', pct: (att.score / att.total) * 100 });
                });
            });
        });

        const avg = (items) => items.length ? Math.round(items.reduce((sum, i) => sum + i.pct, 0) / items.length) : null;

        const metrics = {
            topicsStudied: topicProgressDocs.length,
            topicsCompleted,
            averageVideoCompletion,
            assignmentsGraded: assignmentPcts.length,
            assignmentAverage: avg(assignmentPcts),
            examsGraded: examPcts.length,
            examAverage: avg(examPcts),
            aiQuizzesTaken: aiQuizPcts.length,
            aiQuizAverage: avg(aiQuizPcts)
        };

        let summary = '';
        let nextStep = '';
        try {
            const progressPrompt = `Here is a summary of a student's learning progress:
- Topics studied: ${metrics.topicsStudied}, completed: ${metrics.topicsCompleted}, average video completion: ${metrics.averageVideoCompletion}%
- Graded assignments: ${metrics.assignmentsGraded}, average score: ${metrics.assignmentAverage ?? 'N/A'}%
- Graded exams: ${metrics.examsGraded}, average score: ${metrics.examAverage ?? 'N/A'}%
- AI practice quizzes: ${metrics.aiQuizzesTaken}, average score: ${metrics.aiQuizAverage ?? 'N/A'}%

Write an encouraging growth summary (max 80 words) and ONE specific recommended next growth step for this student.

Return ONLY this JSON structure:
{
  "summary": "Growth summary",
  "nextStep": "One concrete next step"
}`;
            const raw = await callAI(progressPrompt);
            const parsed = parseJSON(raw);
            summary = parsed.summary || '';
            nextStep = parsed.nextStep || '';
        } catch (err) {
            console.warn('AI tutor progress summary failed:', err.message);
        }

        await consumeTutorQuota(req.user);

        res.json({ success: true, metrics, summary, nextStep });
    } catch (err) {
        console.error('AI tutor progress error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
