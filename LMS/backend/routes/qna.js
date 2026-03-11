const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const QnABoard = require('../models/QnABoard');
const QnAQuestion = require('../models/QnAQuestion');
const Classroom = require('../models/Classroom');
const crypto = require('crypto');

// Get all QnA boards for a classroom
router.get('/classroom/:classroomId', auth, async (req, res) => {
    try {
        const qnas = await QnABoard.find({ classroomId: req.params.classroomId }).populate('topicId', 'name');
        res.json(qnas);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Create QnA board
router.post('/board', auth, authorize('school_admin', 'personal_teacher', 'teacher'), async (req, res) => {
    try {
        const { title, description, topicId, classroomId, isPublic, allowAnonymous, hideQuestions } = req.body;

        // Validate that the request contains title and classroomId at least
        if (!title || !classroomId) {
            return res.status(400).json({ message: 'Title and classroom are required' });
        }

        const board = new QnABoard({
            title,
            description,
            topicId: topicId || null,
            classroomId,
            creatorId: req.user._id,
            shareableLink: crypto.randomBytes(16).toString('hex'),
            isPublic: isPublic || false,
            allowAnonymous: allowAnonymous || false,
            hideQuestions: hideQuestions || false
        });

        await board.save();
        res.status(201).json(board);
    } catch (error) {
        console.error('Create QnA error:', error);
        res.status(500).json({ message: 'Error creating QnA board' });
    }
});

// Check access by token
router.get('/join/:token', async (req, res) => {
    try {
        const board = await QnABoard.findOne({ shareableLink: req.params.token })
            .populate('topicId', 'name')
            .populate('classroomId', 'name');

        if (!board) return res.status(404).json({ message: 'Board not found' });
        if (!board.isActive) return res.status(400).json({ message: 'Board is inactive' });

        res.json(board);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get board details directly by id
router.get('/board/:id', auth, async (req, res) => {
    try {
        const board = await QnABoard.findById(req.params.id)
            .populate('topicId', 'name')
            .populate('classroomId', 'name');
        if (!board) return res.status(404).json({ message: 'Board not found' });
        res.json(board);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Update board
router.put('/board/:id', auth, authorize('school_admin', 'personal_teacher', 'teacher', 'root_admin'), async (req, res) => {
    try {
        const board = await QnABoard.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(board);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete board
router.delete('/board/:id', auth, authorize('school_admin', 'personal_teacher', 'teacher', 'root_admin'), async (req, res) => {
    try {
        await QnABoard.findByIdAndDelete(req.params.id);
        await QnAQuestion.deleteMany({ boardId: req.params.id });
        res.json({ message: 'Board deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get questions for a board
router.get('/board/:id/questions', async (req, res) => {
    try {
        const questions = await QnAQuestion.find({ boardId: req.params.id }).sort({ createdAt: -1 });
        res.json(questions);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Add a question
router.post('/board/:id/questions', async (req, res) => {
    try {
        const { text, authorName, authorId } = req.body;
        const board = await QnABoard.findById(req.params.id);
        if (!board) return res.status(404).json({ message: 'Board not found' });
        if (!board.isActive) return res.status(400).json({ message: 'Board is inactive' });

        if (!text) {
            return res.status(400).json({ message: 'Question text is required' });
        }

        const question = new QnAQuestion({
            boardId: req.params.id,
            text,
            authorName: board.allowAnonymous && !authorId ? (authorName || 'Anonymous') : (authorName || 'Unknown'),
            authorId: authorId || null
        });

        await question.save();
        res.status(201).json(question);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Upvote question
router.put('/question/:id/upvote', async (req, res) => {
    try {
        const { userId } = req.body;
        const question = await QnAQuestion.findById(req.params.id);
        if (!question) return res.status(404).json({ message: 'Question not found' });

        // We treat userId as a unique string, or IP if not provided
        const idToUse = userId || req.ip;

        if (question.upvotes.includes(idToUse)) {
            question.upvotes = question.upvotes.filter(id => id.toString() !== idToUse.toString());
        } else {
            question.upvotes.push(idToUse);
        }
        await question.save();
        res.json(question);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Answer a question
router.put('/question/:id/answer', auth, authorize('school_admin', 'personal_teacher', 'teacher', 'root_admin'), async (req, res) => {
    try {
        const question = await QnAQuestion.findByIdAndUpdate(req.params.id, { isAnswered: req.body.isAnswered }, { new: true });
        res.json(question);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete a question
router.delete('/question/:id', auth, authorize('school_admin', 'personal_teacher', 'teacher', 'root_admin'), async (req, res) => {
    try {
        await QnAQuestion.findByIdAndDelete(req.params.id);
        res.json({ message: 'Question deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
