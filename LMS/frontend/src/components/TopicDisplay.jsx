import React, { useEffect, useState } from 'react';
import { Book, Clock, CheckCircle, Circle, Calendar } from 'lucide-react';
import api from '../utils/api';
import { formatDisplayDate } from '../utils/timezone';


const TopicDisplay = ({ classroomId }) => {
    const [currentTopic, setCurrentTopic] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showPaidTopics, setShowPaidTopics] = useState(false);
    const [topicStatus, setTopicStatus] = useState(null); // { paidTopics, unpaidTopics, totalUnpaidAmount, allTopics }
    const [paying, setPaying] = useState(false);


    useEffect(() => {
        if (classroomId) {
            fetchCurrentTopic();
            fetchTopicStatus();
        }
    }, [classroomId]);
    // Fetch paid/unpaid topics and total
    const fetchTopicStatus = async () => {
        try {
            const resp = await api.get(`/payments/topic-status/${classroomId}`);
            setTopicStatus(resp.data);
        } catch (err) {
            setTopicStatus(null);
        }
    };
    // Payment handlers (stub, to be implemented with payment integration)
    const handlePayForTopic = async (topicId) => {
        setPaying(true);
        // TODO: Integrate with payment API for single topic
        alert('Pay for topic: ' + topicId);
        setPaying(false);
    };

    const handlePayForAllTopics = async () => {
        setPaying(true);
        // TODO: Integrate with payment API for all unpaid topics
        alert('Pay for all unpaid topics');
        setPaying(false);
    };

    const fetchCurrentTopic = async () => {
        try {
            const response = await api.get(`/topics/classroom/${classroomId}/current`);
            setCurrentTopic(response.data.currentTopic);
            // Fetch paid topic visibility
            const topicsResp = await api.get(`/topics/classroom/${classroomId}`);
            setShowPaidTopics(topicsResp.data.showPaidTopics);
        } catch (error) {
            console.error('Error fetching current topic:', error);
        } finally {
            setLoading(false);
        }
    };

    const getDurationText = (duration) => {
        if (!duration || duration.mode === 'not_sure') return null;
        return `${duration.value} ${duration.mode}${duration.value > 1 ? 's' : ''}`;
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed':
                return 'text-green-600 bg-green-50 border-green-200';
            case 'active':
                return 'text-blue-600 bg-blue-50 border-blue-200';
            default:
                return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="w-5 h-5" />;
            case 'active':
                return <Clock className="w-5 h-5 animate-pulse" />;
            default:
                return <Circle className="w-5 h-5" />;
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            </div>
        );
    }

    if (!currentTopic) {
        return (
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg shadow-md p-6 border-2 border-dashed border-gray-300">
                <div className="flex items-center space-x-3 text-gray-500">
                    <Book className="w-6 h-6" />
                    <div>
                        <p className="font-medium">No Active Topic</p>
                        <p className="text-sm">Topics will appear here when activated</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-white rounded-lg shadow-md p-6 border-2 ${getStatusColor(currentTopic.status)}`}>
            <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                    <div className={`mt-1 ${getStatusColor(currentTopic.status)}`}>
                        {getStatusIcon(currentTopic.status)}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                            <h3 className="text-lg font-bold text-gray-800">{currentTopic.name}</h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(currentTopic.status)}`}>
                                {currentTopic.status === 'active' ? 'Current Topic' : currentTopic.status}
                            </span>
                        </div>

                        {currentTopic.description && (
                            <p className="text-gray-600 mb-3">{currentTopic.description}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                            {getDurationText(currentTopic.duration) && (
                                <div className="flex items-center space-x-1">
                                    <Clock className="w-4 h-4" />
                                    <span>Duration: {getDurationText(currentTopic.duration)}</span>
                                </div>
                            )}

                            {currentTopic.startedAt && (
                                <div className="flex items-center space-x-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>Started: {formatDisplayDate(currentTopic.startedAt)}</span>
                                </div>
                            )}

                            {currentTopic.expectedEndDate && currentTopic.status === 'active' && (
                                <div className="flex items-center space-x-1">
                                    <Calendar className="w-4 h-4" />
                                    <span className="font-medium text-indigo-600">
                                        Expected End: {formatDisplayDate(currentTopic.expectedEndDate)}
                                    </span>
                                </div>
                            )}

                            {/* Only show paid topic price if allowed */}
                            {showPaidTopics && currentTopic.isPaid && currentTopic.price > 0 && (
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                                    ₦{currentTopic.price}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Paid/Unpaid Topics and Payment Options */}
            {showPaidTopics && topicStatus && (
                <div className="mt-6">
                    <h4 className="font-semibold mb-2">Your Topic Access</h4>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {topicStatus.allTopics.map(topic => (
                            <span key={topic._id} className={`px-2 py-1 rounded-full text-xs font-semibold ${topic.isPaid ? 'bg-green-200 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                {topic.name} {topic.isPaid ? '✓' : `₦${topic.price}`}
                                {!topic.isPaid && topic.price > 0 && (
                                    <button
                                        className="ml-2 px-2 py-0.5 bg-purple-600 text-white rounded text-xs"
                                        disabled={paying}
                                        onClick={() => handlePayForTopic(topic._id)}
                                    >
                                        Pay
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>
                    {topicStatus.unpaidTopics.length > 1 && topicStatus.totalUnpaidAmount > 0 && (
                        <button
                            className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
                            disabled={paying}
                            onClick={handlePayForAllTopics}
                        >
                            Pay for all unpaid topics (₦{topicStatus.totalUnpaidAmount})
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default TopicDisplay;
