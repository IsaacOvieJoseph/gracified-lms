// Topic Progression System - Quick Reference

// ============================================
// 1. TOPIC MANAGEMENT MODAL
// ============================================

// Open Modal:
<button onClick={() => setShowTopicModal(true)}>
  Manage Topics
</button>

// Modal Component:
<TopicManagementModal
  show={showTopicModal}
  onClose={() => setShowTopicModal(false)}
  classroomId={classroomId}
  onSuccess={refreshData}
/>

// ============================================
// 2. TOPIC DISPLAY (Current Topic)
// ============================================

<TopicDisplay classroomId={classroomId} />

// ============================================
// 3. CREATE TOPIC FORM DATA
// ============================================

const topicData = {
    name: "Introduction to Variables",
    description: "Learn about variables in programming",
    duration: {
        mode: "week",  // 'not_sure' | 'day' | 'week' | 'month' | 'year'
        value: 2       // Number of units
    },
    isPaid: false,
    price: 0,
    classroomId: "classroom_id_here"
};

// ============================================
// 4. API ENDPOINTS
// ============================================

// Get all topics for classroom
GET / api / topics / classroom /: classroomId

// Get current active topic
GET / api / topics / classroom /: classroomId / current

// Create topic
POST / api / topics
Body: topicData

// Update topic
PUT / api / topics /: topicId
Body: topicData

// Delete topic
DELETE / api / topics /: topicId

// Activate topic
POST / api / topics /: topicId / activate

// Complete topic
POST / api / topics /: topicId / complete

// Set next topic
PUT / api / topics /: topicId / set - next
Body: { nextTopicId: "next_topic_id" }

// Reorder topics
PUT / api / topics / reorder
Body: { orderedIds: ["id1", "id2", "id3"] }

// ============================================
// 5. TOPIC STATUS VALUES
// ============================================

const STATUS = {
    PENDING: 'pending',    // Not started
    ACTIVE: 'active',      // Currently being taught
    COMPLETED: 'completed' // Finished
};

// ============================================
// 6. DURATION MODES
// ============================================

const DURATION_MODES = {
    NOT_SURE: 'not_sure',  // No auto-progression
    DAY: 'day',            // Days
    WEEK: 'week',          // Weeks
    MONTH: 'month',        // Months
    YEAR: 'year'           // Years
};

// ============================================
// 7. EXAMPLE USAGE IN COMPONENT
// ============================================

import { useState, useEffect } from 'react';
import api from '../utils/api';
import TopicManagementModal from '../components/TopicManagementModal';
import TopicDisplay from '../components/TopicDisplay';

function MyClassroom({ classroomId }) {
    const [showTopicModal, setShowTopicModal] = useState(false);
    const [topics, setTopics] = useState([]);

    const fetchTopics = async () => {
        const response = await api.get(`/topics/classroom/${classroomId}`);
        setTopics(response.data.topics);
    };

    useEffect(() => {
        fetchTopics();
    }, [classroomId]);

    return (
        <div>
            {/* Show current topic */}
            <TopicDisplay classroomId={classroomId} />

            {/* Manage button */}
            <button onClick={() => setShowTopicModal(true)}>
                Manage Topics
            </button>

            {/* Topic list preview */}
            <div>
                {topics.slice(0, 5).map(topic => (
                    <div key={topic._id}>
                        <h4>{topic.name}</h4>
                        <span>{topic.status}</span>
                    </div>
                ))}
            </div>

            {/* Management modal */}
            <TopicManagementModal
                show={showTopicModal}
                onClose={() => setShowTopicModal(false)}
                classroomId={classroomId}
                onSuccess={fetchTopics}
            />
        </div>
    );
}

// ============================================
// 8. STYLING REFERENCE
// ============================================

// Status Badge Classes
const statusBadges = {
    active: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    pending: 'bg-gray-100 text-gray-600'
};

// Topic Card Classes
const topicCardClasses = {
    active: 'border-blue-400 bg-blue-50',
    completed: 'border-green-200 bg-green-50 opacity-75',
    pending: 'border-gray-200 bg-white hover:border-gray-300'
};

// Button Classes
const buttonClasses = {
    manage: 'bg-gradient-to-r from-green-600 to-emerald-600 text-white',
    activate: 'text-blue-600 hover:bg-blue-50',
    complete: 'text-green-600 hover:bg-green-50',
    edit: 'text-yellow-600 hover:bg-yellow-50',
    delete: 'text-red-600 hover:bg-red-50'
};

// ============================================
// 9. COMMON WORKFLOWS
// ============================================

// Workflow 1: Create and Activate Topic
async function createAndActivateTopic() {
    // 1. Create topic
    const response = await api.post('/api/topics', {
        name: "New Topic",
        classroomId: "classroom_id",
        duration: { mode: 'week', value: 2 }
    });

    // 2. Activate it
    await api.post(`/api/topics/${response.data.topic._id}/activate`);

    // 3. Refresh UI
    fetchTopics();
}

// Workflow 2: Complete Topic and Progress
async function completeAndProgress(topicId) {
    // Complete current topic (auto-activates next)
    const response = await api.post(`/api/topics/${topicId}/complete`);

    console.log('Completed:', response.data.completedTopic.name);
    console.log('Next:', response.data.nextTopic?.name || 'None');

    // Refresh UI
    fetchTopics();
}

// Workflow 3: Set Custom Progression
async function setCustomNext(currentTopicId, nextTopicId) {
    await api.put(`/api/topics/${currentTopicId}/set-next`, {
        nextTopicId
    });

    // Now when currentTopic completes, nextTopic will activate
    // instead of following the order
}

// ============================================
// 10. ERROR HANDLING
// ============================================

try {
    await api.post('/api/topics', topicData);
    toast.success('Topic created!');
} catch (error) {
    const message = error.response?.data?.message || 'Error creating topic';
    toast.error(message);
}

// ============================================
// 11. AUTHORIZATION CHECK
// ============================================

const canManageTopics = ['root_admin', 'school_admin', 'teacher', 'personal_teacher']
    .includes(user?.role);

{
    canManageTopics && (
        <button onClick={() => setShowTopicModal(true)}>
            Manage Topics
        </button>
    )
}

// ============================================
// 12. TOPIC OBJECT STRUCTURE
// ============================================

const topic = {
    _id: "topic_id",
    name: "Introduction to Variables",
    description: "Learn about variables...",
    classroomId: "classroom_id",
    order: 0,
    duration: {
        mode: "week",
        value: 2
    },
    status: "active",
    startedAt: "2026-01-08T12:00:00Z",
    completedAt: null,
    expectedEndDate: "2026-01-22T12:00:00Z",
    nextTopicId: null,
    completedBy: null,
    isPaid: false,
    price: 0,
    materials: [],
    createdAt: "2026-01-08T10:00:00Z"
};
