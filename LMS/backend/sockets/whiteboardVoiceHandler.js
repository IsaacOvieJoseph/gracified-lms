// Voice Communication Socket Handler for Whiteboard
// Add this to your backend socket.io whiteboard namespace handler

module.exports = (io, socket, classId) => {
    // Voice communication events
    socket.on('wb:voice-start', () => {
        console.log(`User ${socket.id} started voice in class ${classId}`);
        // Notify all other users in the room that this user joined voice
        socket.to(classId).emit('wb:voice-user-joined', { userId: socket.id });
    });

    socket.on('wb:voice-stop', () => {
        console.log(`User ${socket.id} stopped voice in class ${classId}`);
        // Notify all other users that this user left voice
        socket.to(classId).emit('wb:voice-user-left', { userId: socket.id });
    });

    // WebRTC Signaling - SDP Offer
    socket.on('wb:sdp-offer', ({ targetUserId, sdp }) => {
        console.log(`SDP offer from ${socket.id} to ${targetUserId}`);
        io.to(targetUserId).emit('wb:sdp-offer', {
            senderUserId: socket.id,
            sdp
        });
    });

    // WebRTC Signaling - SDP Answer
    socket.on('wb:sdp-answer', ({ targetUserId, sdp }) => {
        console.log(`SDP answer from ${socket.id} to ${targetUserId}`);
        io.to(targetUserId).emit('wb:sdp-answer', {
            senderUserId: socket.id,
            sdp
        });
    });

    // WebRTC Signaling - ICE Candidate
    socket.on('wb:ice-candidate', ({ targetUserId, candidate }) => {
        console.log(`ICE candidate from ${socket.id} to ${targetUserId}`);
        io.to(targetUserId).emit('wb:ice-candidate', {
            senderUserId: socket.id,
            candidate
        });
    });

    // Mute status updates
    socket.on('wb:mute-status', ({ muted }) => {
        console.log(`User ${socket.id} ${muted ? 'muted' : 'unmuted'}`);
        socket.to(classId).emit('voice:speaking', {
            userId: socket.id,
            speaking: !muted
        });
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
        // Notify others that this user left voice
        socket.to(classId).emit('wb:voice-user-left', { userId: socket.id });
    });
};
