const mongoose = require('mongoose');

const qnaQuestionSchema = new mongoose.Schema({
    boardId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'QnABoard',
        required: true
    },
    authorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    authorName: {
        type: String,
        default: 'Anonymous'
    },
    text: {
        type: String,
        required: true,
        trim: true
    },
    upvotes: [{
        type: String
    }],
    isAnswered: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('QnAQuestion', qnaQuestionSchema);
