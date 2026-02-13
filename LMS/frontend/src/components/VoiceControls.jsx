import React from 'react';
import { Mic, MicOff, Volume2, VolumeX, Users, ChevronDown, ShieldAlert, Hand, Paintbrush, Lock, Video, VideoOff, Maximize2, Minimize2, Move } from 'lucide-react';

export default function VoiceControls({
    isVoiceEnabled,
    isVideoEnabled,
    isMuted,
    onToggleVoice,
    onToggleMute,
    onToggleVideo,
    isTeacher,
    localVolume = 0,
    participants = {},
    onForceMute,
    activeSpeakers = new Set(),
    activeDrawers = new Set(),
    localId = null,
    micLocked = false,
    remoteStreams = {},
    localStream = null
}) {
    const [showParticipants, setShowParticipants] = React.useState(false);
    const [maximizedUser, setMaximizedUser] = React.useState(null); // ID of user whose video is maximized
    const [pos, setPos] = React.useState({ x: 24, y: 96 }); // Default top-right-ish
    const [dragging, setDragging] = React.useState(false);
    const dragStartRef = React.useRef({ x: 0, y: 0 });

    const handleDragStart = (e) => {
        setDragging(true);
        const clientX = e.clientX || e.touches?.[0]?.clientX;
        const clientY = e.clientY || e.touches?.[0]?.clientY;
        dragStartRef.current = {
            x: clientX - pos.x,
            y: clientY - pos.y
        };
    };

    const handleDragMove = React.useCallback((e) => {
        if (!dragging) return;
        const clientX = e.clientX || e.touches?.[0]?.clientX;
        const clientY = e.clientY || e.touches?.[0]?.clientY;

        // Constrain to window bounds
        const newX = Math.max(0, Math.min(window.innerWidth - 200, clientX - dragStartRef.current.x));
        const newY = Math.max(0, Math.min(window.innerHeight - 150, clientY - dragStartRef.current.y));

        setPos({ x: newX, y: newY });
    }, [dragging]);

    const handleDragEnd = () => {
        setDragging(false);
    };

    React.useEffect(() => {
        if (dragging) {
            window.addEventListener('mousemove', handleDragMove);
            window.addEventListener('mouseup', handleDragEnd);
            window.addEventListener('touchmove', handleDragMove);
            window.addEventListener('touchend', handleDragEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handleDragMove);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchmove', handleDragMove);
            window.removeEventListener('touchend', handleDragEnd);
        };
    }, [dragging, handleDragMove]);

    // Normalize volume for display (analyser gives 0-255, we want a percentage)
    const volumePercent = Math.min(100, (localVolume / 100) * 100);

    const VideoFeed = ({ stream, name, muted, isLocal, color, id }) => {
        const videoRef = React.useRef();
        const isMaximized = maximizedUser === id;

        React.useEffect(() => {
            if (videoRef.current && stream) {
                if (videoRef.current.srcObject !== stream) {
                    videoRef.current.srcObject = stream;
                }

                // Add event listeners for track changes
                const playVideo = () => {
                    if (videoRef.current) videoRef.current.play().catch(e => { });
                };

                stream.addEventListener('addtrack', playVideo);
                stream.addEventListener('removetrack', playVideo);

                // Also ensure it plays if already assigned
                playVideo();

                return () => {
                    stream.removeEventListener('addtrack', playVideo);
                    stream.removeEventListener('removetrack', playVideo);
                };
            }
        }, [stream]);

        return (
            <div
                className={`relative bg-gray-900 rounded-xl overflow-hidden shadow-2xl border-2 transition-all duration-300 group flex-shrink-0
                    ${isMaximized
                        ? 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[70vh] z-[200] border-indigo-500 shadow-[0_0_50px_rgba(79,70,229,0.3)]'
                        : 'w-48 h-32 md:w-64 md:h-44 border-gray-100/10'}`}
                style={{ borderColor: isMaximized ? '#6366f1' : (color || '#333'), backgroundColor: '#000' }}
            >
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isLocal}
                    className="w-full h-full object-cover bg-black"
                />

                {/* Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 pointer-events-none" />

                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => setMaximizedUser(isMaximized ? null : id)}
                        className="p-1.5 bg-black/40 backdrop-blur-md rounded-lg text-white hover:bg-black/60 transition-colors"
                        title={isMaximized ? "Exit Fullscreen" : "Maximize View"}
                    >
                        {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                </div>

                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${muted ? 'bg-red-500' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'}`} />
                        <span className={`text-white font-bold tracking-wide drop-shadow-md truncate ${isMaximized ? 'text-lg' : 'text-xs md:text-sm'}`}>
                            {isLocal ? 'You' : name}
                        </span>
                    </div>
                </div>

                {!stream && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800 gap-3">
                        <VideoOff className="w-8 h-8 text-gray-500 animate-pulse" />
                        <span className="text-gray-400 text-[10px] sm:text-xs">Camera is off</span>
                    </div>
                )}
            </div>
        );
    };

    const participantList = Object.keys(participants).map(id => ({
        id,
        name: participants[id].name || 'User',
        color: participants[id].color,
        isSpeaking: activeSpeakers.has(id),
        isDrawing: activeDrawers.has(id),
        muted: participants[id].muted,
        videoEnabled: participants[id].videoEnabled,
        handRaised: participants[id].handRaised
    })).sort((a, b) => {
        // Priority: Hand Raised > Speaking > Drawing > Name
        if (a.handRaised !== b.handRaised) return b.handRaised ? 1 : -1;
        if (a.isSpeaking !== b.isSpeaking) return b.isSpeaking ? 1 : -1;
        if (a.isDrawing !== b.isDrawing) return b.isDrawing ? 1 : -1;
        return a.name.localeCompare(b.name);
    });

    return (
        <div className="flex items-center gap-1 border-r pr-2 md:pr-4 relative">
            {isTeacher && (
                <div className="flex items-center gap-1">
                    <button
                        className={`p-2 rounded-lg transition-colors ${isVoiceEnabled
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        onClick={onToggleVoice}
                        title={isVoiceEnabled ? 'Disable Voice Chat' : 'Enable Voice Chat'}
                    >
                        {isVoiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </button>

                    {isVoiceEnabled && (
                        <button
                            className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${showParticipants ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            onClick={() => setShowParticipants(!showParticipants)}
                            title="Manage Participants"
                        >
                            <Users className="w-4 h-4" />
                            <ChevronDown className={`w-3 h-3 transition-transform ${showParticipants ? 'rotate-180' : ''}`} />
                        </button>
                    )}
                </div>
            )}

            {isVoiceEnabled && (
                <button
                    className={`p-2 rounded-lg transition-all relative overflow-hidden ${isMuted
                        ? 'bg-red-100 text-red-600'
                        : 'bg-blue-100 text-blue-600'
                        } ${micLocked && isMuted ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                    onClick={onToggleMute}
                    title={micLocked && isMuted ? 'Microphone Locked by Teacher' : (isMuted ? 'Unmute' : 'Mute')}
                >
                    {/* Volume Level Indicator */}
                    {!isMuted && localVolume > 5 && (
                        <div
                            className="absolute bottom-0 left-0 w-full bg-green-400/50 transition-all duration-75"
                            style={{ height: `${volumePercent}%` }}
                        />
                    )}

                    <div className="relative z-10 transition-transform" style={{ transform: !isMuted && localVolume > 20 ? `scale(${1 + (localVolume / 400)})` : 'scale(1)' }}>
                        {micLocked && isMuted && !isTeacher ? (
                            <div className="relative">
                                <MicOff className="w-4 h-4" />
                                <Lock className="w-2 h-2 absolute -bottom-1 -right-1 text-red-800" />
                            </div>
                        ) : (
                            isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />
                        )}
                    </div>
                </button>
            )}

            {isVoiceEnabled && (
                <button
                    className={`p-2 rounded-lg transition-all ${isVideoEnabled
                        ? 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                    onClick={onToggleVideo}
                    title={isVideoEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
                >
                    {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>
            )}

            {/* Participants Popover */}
            {showParticipants && isTeacher && isVoiceEnabled && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 border-b bg-white border-gray-100 rounded-t-xl space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Global Control</span>
                        </div>
                        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <span className="text-[11px] font-bold text-gray-700">
                                {micLocked ? 'Enable all participants\' mic' : 'Disable all participants\' mic'}
                            </span>
                            <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    style={{ opacity: 0, width: 0, height: 0 }}
                                    checked={!micLocked}
                                    onChange={() => onForceMute('all', !micLocked)}
                                />
                                <span style={{
                                    position: 'absolute',
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    backgroundColor: !micLocked ? '#22c55e' : '#cbd5e1',
                                    transition: '.4s',
                                    borderRadius: '34px',
                                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                                }}>
                                    <span style={{
                                        position: 'absolute',
                                        content: '""',
                                        height: '18px', width: '18px',
                                        left: !micLocked ? '20px' : '2px',
                                        bottom: '2px',
                                        backgroundColor: 'white',
                                        transition: '.4s',
                                        borderRadius: '50%',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                    }} />
                                </span>
                            </label>
                        </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-2 scrollbar-thin">
                        {participantList.length === 0 ? (
                            <div className="text-center py-4 text-gray-400 text-sm italic">
                                No students connected
                            </div>
                        ) : (
                            participantList.map(person => (
                                <div key={person.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors group">
                                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                                        <div
                                            className={`w-2 h-2 rounded-full flex-shrink-0 ${person.isSpeaking ? 'bg-green-500 animate-pulse ring-4 ring-green-100' : 'bg-gray-300'}`}
                                        />
                                        <span className="text-sm text-gray-700 truncate font-medium">
                                            {person.name}
                                        </span>
                                        {person.handRaised && (
                                            <Hand className="w-3.5 h-3.5 text-yellow-500 animate-bounce flex-shrink-0" />
                                        )}
                                        {person.isDrawing && !person.handRaised && (
                                            <Paintbrush className="w-3 h-3 text-indigo-500 animate-pulse flex-shrink-0" />
                                        )}
                                    </div>
                                    <button
                                        className={`p-1.5 rounded-md transition-all ${person.muted ? 'bg-red-50 text-red-400 hover:text-red-600' : 'bg-gray-50 text-gray-400 hover:text-green-500'} ${person.id === localId ? 'invisible pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}
                                        onClick={() => onForceMute(person.id, !person.muted)}
                                        title={person.muted ? `Unmute ${person.name}` : `Mute ${person.name}`}
                                    >
                                        {person.muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
            {/* Video Streams Container */}
            {(isVideoEnabled || Object.keys(remoteStreams).length > 0) && (
                <>
                    {/* Backdrop for maximized video */}
                    {maximizedUser && (
                        <div
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] animate-in fade-in duration-300"
                            onClick={() => setMaximizedUser(null)}
                        />
                    )}

                    <div
                        className={`fixed flex flex-col gap-3 z-[40] ${dragging ? 'cursor-grabbing select-none' : ''}`}
                        style={{
                            left: `${pos.x}px`,
                            top: `${pos.y}px`,
                            maxWidth: '400px'
                        }}
                    >
                        {/* Drag Handle */}
                        <div
                            onMouseDown={handleDragStart}
                            onTouchStart={handleDragStart}
                            className="flex items-center gap-2 px-2 py-1 bg-white/10 backdrop-blur-md rounded-t-lg border-x border-t border-white/5 cursor-grab active:cursor-grabbing hover:bg-white/20 transition-colors group"
                        >
                            <Move className="w-3 h-3 text-white/40 group-hover:text-white/80" />
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest group-hover:text-white/80">Class Videos</span>
                        </div>

                        <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto p-1 scrollbar-none transition-opacity duration-300 bg-black/5 rounded-b-xl border-x border-b border-white/5 backdrop-blur-[2px]">
                            {isVideoEnabled && localStream && (
                                <VideoFeed
                                    id={localId || 'local'}
                                    stream={localStream}
                                    name="You"
                                    isLocal={true}
                                    muted={isMuted}
                                    color={participants[localId]?.color}
                                />
                            )}
                            {Object.keys(remoteStreams).map(userId => {
                                const person = participants[userId];
                                if (!person?.videoEnabled) return null;
                                return (
                                    <VideoFeed
                                        key={userId}
                                        id={userId}
                                        stream={remoteStreams[userId]}
                                        name={person.name}
                                        muted={person.muted}
                                        color={person.color}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
