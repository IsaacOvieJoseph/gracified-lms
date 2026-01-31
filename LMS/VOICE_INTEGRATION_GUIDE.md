# Voice Communication Integration for Whiteboard

## Overview
This document provides the complete implementation for integrating WebRTC-based voice communication into the whiteboard component.

## Implementation Steps

### 1. Import VoiceControls Component
Add this import at the top of `Whiteboard.jsx` (around line 6):
```javascript
import VoiceControls from './VoiceControls';
```

### 2. Add Voice Handler Functions
Add these handler functions before the `return` statement (around line 690):

```javascript
  // Voice communication handlers
  const handleToggleVoice = async () => {
    if (isVoiceEnabled) {
      stopVoiceChat();
      setIsVoiceEnabled(false);
    } else {
      await startVoiceChat();
      setIsVoiceEnabled(true);
    }
  };

  const handleToggleMute = () => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
        // Notify other users about mute status
        socketRef.current?.emit('wb:mute-status', { muted: !isMuted });
      }
    }
  };
```

### 3. Add VoiceControls to Toolbar
In the toolbar section (around line 772, after the utility actions div closes), add:

```javascript
            {/* Voice Communication Controls */}
            <VoiceControls
              isVoiceEnabled={isVoiceEnabled}
              isMuted={isMuted}
              onToggleVoice={handleToggleVoice}
              onToggleMute={handleToggleMute}
              localStream={localStream}
            />
```

### 4. Fix Duplicate Refs
Remove the duplicate ref declarations around line 536-538:
```javascript
// DELETE THESE LINES (they're duplicates):
const peerConnections = useRef({});
const localStream = useRef(null);
const audioContext = useRef(null);
const gainNode = useRef(null);
```

The refs are already declared at the top with the other state variables.

### 5. Update stopVoice Function
Replace the `stopVoice()` call in the cleanup (around line 261) with `stopVoiceChat()`:

```javascript
// Cleanup voice connections
stopVoiceChat();
```

### 6. Backend Socket Events (Optional Enhancement)
Add these socket event handlers to your backend `server.js` or whiteboard socket handler:

```javascript
// Voice communication events
socket.on('wb:voice-start', () => {
  socket.to(classId).emit('voice:user-joined', { userId: socket.id });
});

socket.on('wb:voice-stop', () => {
  socket.to(classId).emit('voice:user-left', { userId: socket.id });
});

socket.on('wb:sdp-offer', ({ targetUserId, sdp }) => {
  io.to(targetUserId).emit('wb:sdp-offer', { senderUserId: socket.id, sdp });
});

socket.on('wb:sdp-answer', ({ targetUserId, sdp }) => {
  io.to(targetUserId).emit('wb:sdp-answer', { senderUserId: socket.id, sdp });
});

socket.on('wb:ice-candidate', ({ targetUserId, candidate }) => {
  io.to(targetUserId).emit('wb:ice-candidate', { senderUserId: socket.id, candidate });
});

socket.on('wb:mute-status', ({ muted }) => {
  socket.to(classId).emit('voice:speaking', { userId: socket.id, speaking: !muted });
});
```

## Features Included

✅ **Peer-to-Peer Audio**: WebRTC-based voice communication
✅ **Mute/Unmute**: Individual microphone control
✅ **Voice Enable/Disable**: Turn voice chat on/off
✅ **Visual Indicators**: Icons show voice and mute status
✅ **Teacher Control**: Only teachers can initiate voice chat
✅ **Auto Cleanup**: Proper cleanup of streams and connections

## How It Works

1. **Teacher Starts Voice**: Teacher clicks the voice button to enable voice chat
2. **Get User Media**: Browser requests microphone permission
3. **WebRTC Setup**: Creates peer connections for each participant
4. **SDP Exchange**: Offers and answers are exchanged via Socket.IO
5. **ICE Candidates**: Connection candidates are shared
6. **Audio Streaming**: Audio streams flow peer-to-peer
7. **Mute Control**: Each user can mute/unmute their own microphone

## Testing

1. Open whiteboard as teacher
2. Click the voice enable button (speaker icon)
3. Grant microphone permission
4. Open whiteboard as student in another browser/tab
5. Student should automatically connect to voice
6. Test mute/unmute functionality
7. Verify audio quality

## Troubleshooting

- **No Audio**: Check browser microphone permissions
- **Connection Failed**: Verify STUN servers are accessible
- **Echo**: Use headphones to prevent feedback
- **Latency**: WebRTC uses peer-to-peer, should be low latency

## Browser Compatibility

- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari (iOS 11+)
- ⚠️ Requires HTTPS in production

## Security Notes

- Microphone permission required
- Audio streams are peer-to-peer (not stored on server)
- Use HTTPS in production for getUserMedia
- Consider adding TURN server for firewall traversal
