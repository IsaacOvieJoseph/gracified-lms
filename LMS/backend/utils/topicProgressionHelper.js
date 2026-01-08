const Topic = require('../models/Topic');
const Classroom = require('../models/Classroom');

/**
 * Calculate expected end date based on duration
 */
const calculateExpectedEndDate = (startDate, duration) => {
    if (!startDate || !duration || duration.mode === 'not_sure') {
        return null;
    }

    const endDate = new Date(startDate);
    const value = duration.value || 1;

    switch (duration.mode) {
        case 'day':
            endDate.setDate(endDate.getDate() + value);
            break;
        case 'week':
            endDate.setDate(endDate.getDate() + (value * 7));
            break;
        case 'month':
            endDate.setMonth(endDate.getMonth() + value);
            break;
        case 'year':
            endDate.setFullYear(endDate.getFullYear() + value);
            break;
        default:
            return null;
    }

    return endDate;
};

/**
 * Get the next topic based on manual selection or order
 */
const getNextTopic = async (currentTopic, classroomId) => {
    // If manual next topic is set, use that
    if (currentTopic.nextTopicId) {
        const nextTopic = await Topic.findById(currentTopic.nextTopicId);
        if (nextTopic && nextTopic.classroomId.toString() === classroomId.toString()) {
            return nextTopic;
        }
    }

    // Otherwise, get next topic by order
    const nextTopic = await Topic.findOne({
        classroomId,
        order: { $gt: currentTopic.order }
    }).sort({ order: 1 });

    return nextTopic;
};

/**
 * Get the current active topic for a classroom
 */
const getCurrentTopic = async (classroomId) => {
    const classroom = await Classroom.findById(classroomId).populate('currentTopicId');

    if (classroom && classroom.currentTopicId) {
        return classroom.currentTopicId;
    }

    // If no current topic set, find the first active or pending topic
    const activeTopic = await Topic.findOne({
        classroomId,
        status: 'active'
    }).sort({ order: 1 });

    if (activeTopic) return activeTopic;

    // Otherwise, return the first pending topic
    const pendingTopic = await Topic.findOne({
        classroomId,
        status: 'pending'
    }).sort({ order: 1 });

    return pendingTopic;
};

/**
 * Mark a topic as completed and activate the next one
 */
const markTopicComplete = async (topicId, userId) => {
    const topic = await Topic.findById(topicId);
    if (!topic) {
        throw new Error('Topic not found');
    }

    const now = new Date();

    // Mark current topic as completed
    topic.status = 'completed';
    topic.completedAt = now;
    topic.completedBy = userId;
    await topic.save();

    // Get and activate next topic
    const nextTopic = await getNextTopic(topic, topic.classroomId);

    if (nextTopic) {
        nextTopic.status = 'active';
        nextTopic.startedAt = now;
        nextTopic.expectedEndDate = calculateExpectedEndDate(now, nextTopic.duration);
        await nextTopic.save();

        // Update classroom's current topic
        await Classroom.findByIdAndUpdate(topic.classroomId, {
            currentTopicId: nextTopic._id
        });

        return { completedTopic: topic, nextTopic };
    }

    // No next topic, clear classroom's current topic
    await Classroom.findByIdAndUpdate(topic.classroomId, {
        currentTopicId: null
    });

    return { completedTopic: topic, nextTopic: null };
};

/**
 * Manually set the next topic
 */
const setNextTopic = async (currentTopicId, nextTopicId) => {
    const currentTopic = await Topic.findById(currentTopicId);
    const nextTopic = await Topic.findById(nextTopicId);

    if (!currentTopic || !nextTopic) {
        throw new Error('Topic not found');
    }

    if (currentTopic.classroomId.toString() !== nextTopic.classroomId.toString()) {
        throw new Error('Topics must be from the same classroom');
    }

    currentTopic.nextTopicId = nextTopicId;
    await currentTopic.save();

    return currentTopic;
};

/**
 * Activate a topic (start it)
 */
const activateTopic = async (topicId) => {
    const topic = await Topic.findById(topicId);
    if (!topic) {
        throw new Error('Topic not found');
    }

    const now = new Date();
    topic.status = 'active';
    topic.startedAt = now;
    topic.expectedEndDate = calculateExpectedEndDate(now, topic.duration);
    await topic.save();

    // Update classroom's current topic
    await Classroom.findByIdAndUpdate(topic.classroomId, {
        currentTopicId: topic._id
    });

    return topic;
};

/**
 * Check if any topics have exceeded their expected end date and should auto-progress
 */
const checkAutoProgression = async () => {
    const now = new Date();

    // Find all active topics that have exceeded their expected end date
    const expiredTopics = await Topic.find({
        status: 'active',
        expectedEndDate: { $ne: null, $lte: now }
    });

    const results = [];
    for (const topic of expiredTopics) {
        try {
            // Auto-complete the topic (use system user ID or null)
            const result = await markTopicComplete(topic._id, null);
            results.push(result);
            console.log(`[Topic Auto-Progression] Completed topic: ${topic.name}, Next: ${result.nextTopic?.name || 'None'}`);
        } catch (error) {
            console.error(`[Topic Auto-Progression] Error for topic ${topic._id}:`, error.message);
        }
    }

    return results;
};

module.exports = {
    calculateExpectedEndDate,
    getNextTopic,
    getCurrentTopic,
    markTopicComplete,
    setNextTopic,
    activateTopic,
    checkAutoProgression
};
