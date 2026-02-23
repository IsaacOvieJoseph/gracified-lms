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

                const playVideo = () => {
                    if (videoRef.current) videoRef.current.play().catch(e => { });
                };

                stream.addEventListener('addtrack', playVideo);
                stream.addEventListener('removetrack', playVideo);
                playVideo();

                return () => {
                    stream.removeEventListener('addtrack', playVideo);
                    stream.removeEventListener('removetrack', playVideo);
                };
            }
        }, [stream]);

        return (
            <div
                className={`relative bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl transition-all duration-700 group flex-shrink-0
                    ${isMaximized
                        ? 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85vw] h-[80vh] z-[200] ring-[12px] ring-primary/20 shadow-[0_0_100px_rgba(0,0,0,0.5)]'
                        : 'w-52 h-36 md:w-72 md:h-48 ring-1 ring-white/10'}`}
                style={{ backgroundColor: '#000' }}
            >
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isLocal}
                    className="w-full h-full object-cover bg-black"
                />

                {/* Glassmorphic Overlays */}
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                    <button
                        onClick={() => setMaximizedUser(isMaximized ? null : id)}
                        className="p-2.5 bg-white/10 backdrop-blur-md rounded-2xl text-white hover:bg-white/20 border border-white/20 transition-all active:scale-90"
                        title={isMaximized ? "Exit Focus" : "Focus Video"}
                    >
                        {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                    </button>
                </div>

                <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between pointer-events-none">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className={`w-3 h-3 rounded-full ${muted ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]' : 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]'}`} />
                            {!muted && <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-40" />}
                        </div>
                        <div className="flex flex-col">
                            <span className={`text-white font-black tracking-wide drop-shadow-lg truncate ${isMaximized ? 'text-2xl' : 'text-sm'}`}>
                                {isLocal ? 'You' : name}
                            </span>
                            {isMaximized && (
                                <span className="text-white/60 text-xs font-bold uppercase tracking-widest mt-0.5">Focus Mode Active</span>
                            )}
                        </div>
                    </div>
                </div>

                {!stream && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 gap-4 animate-in fade-in duration-500">
                        <div className="w-16 h-16 bg-slate-700 rounded-[1.5rem] flex items-center justify-center shadow-inner">
                            <VideoOff className="w-8 h-8 text-slate-500" />
                        </div>
                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Signal Lost</span>
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
        <div className="flex items-center gap-1.5 border-r border-slate-100 pr-3 md:pr-5 relative">
            {isTeacher && (
                <div className="flex items-center gap-1.5">
                    <button
                        className={`p-2.5 rounded-xl transition-all duration-300 transform active:scale-90 shadow-sm ${isVoiceEnabled
                            ? 'bg-emerald-500 text-white shadow-emerald-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                        onClick={onToggleVoice}
                        title={isVoiceEnabled ? 'Disable Voice Chat' : 'Enable Voice Chat'}
                    >
                        {isVoiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </button>

                    {isVoiceEnabled && (
                        <button
                            className={`p-2.5 rounded-xl transition-all duration-300 flex items-center gap-1.5 transform active:scale-95 shadow-sm ${showParticipants ? 'bg-primary text-white shadow-primary/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            onClick={() => setShowParticipants(!showParticipants)}
                            title="Manage Participants"
                        >
                            <Users className="w-4 h-4" />
                            <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${showParticipants ? 'rotate-180' : ''}`} />
                        </button>
                    )}
                </div>
            )}

            {isVoiceEnabled && (
                <button
                    className={`p-2.5 rounded-xl transition-all duration-300 relative overflow-hidden transform active:scale-95 shadow-sm ${isMuted
                        ? 'bg-red-50 text-red-500 border border-red-100'
                        : 'bg-blue-50 text-blue-600 border border-blue-100'
                        } ${micLocked && isMuted ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                    onClick={onToggleMute}
                    title={micLocked && isMuted ? 'Microphone Locked by Teacher' : (isMuted ? 'Unmute' : 'Mute')}
                >
                    {/* Volume Level Indicator */}
                    {!isMuted && localVolume > 5 && (
                        <div
                            className="absolute bottom-0 left-0 w-full bg-blue-500/20 transition-all duration-75"
                            style={{ height: `${volumePercent}%` }}
                        />
                    )}

                    <div className="relative z-10 transition-transform" style={{ transform: !isMuted && localVolume > 20 ? `scale(${1 + (localVolume / 400)})` : 'scale(1)' }}>
                        {micLocked && isMuted && !isTeacher ? (
                            <div className="relative">
                                <MicOff className="w-4 h-4" />
                                <Lock className="w-2.5 h-2.5 absolute -bottom-1 -right-1 text-red-600 bg-white rounded-full p-0.5 shadow-sm" />
                            </div>
                        ) : (
                            isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />
                        )}
                    </div>
                </button>
            )}

            {isVoiceEnabled && (
                <button
                    className={`p-2.5 rounded-xl transition-all duration-300 transform active:scale-95 shadow-sm ${isVideoEnabled
                        ? 'bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-indigo-100/50'
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        }`}
                    onClick={onToggleVideo}
                    title={isVideoEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
                >
                    {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>
            )}

            {/* Participants Popover */}
            {showParticipants && isTeacher && isVoiceEnabled && (
                <div className="absolute top-full left-0 mt-3 w-72 bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 z-[100] animate-in fade-in slide-in-from-top-4 duration-300 overflow-hidden">
                    <div className="p-5 border-b border-slate-50 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Moderation</span>
                        </div>
                        <div className="flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                            <div className="flex flex-col">
                                <span className="text-xs font-black text-slate-700">Mute Everyone</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Lock microphones</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer group">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={micLocked}
                                    onChange={() => onForceMute('all', !micLocked)}
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-sm group-active:scale-95 transition-transform" />
                            </label>
                        </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto p-3 scrollbar-none">
                        {participantList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-3">
                                <Users className="w-10 h-10 opacity-20" />
                                <span className="text-xs font-bold italic">No students in room</span>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {participantList.map(person => (
                                    <div key={person.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-all duration-300 group">
                                        <div className="flex items-center gap-3 overflow-hidden flex-1">
                                            <div className="relative">
                                                <div
                                                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all ${person.isSpeaking ? 'bg-emerald-500 ring-4 ring-emerald-100 animate-pulse' : 'bg-slate-200'}`}
                                                />
                                                {person.isSpeaking && (
                                                    <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-30" />
                                                )}
                                            </div>
                                            <div className="flex flex-col truncate">
                                                <span className="text-sm text-slate-800 font-bold truncate">
                                                    {person.name}
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    {person.handRaised && (
                                                        <span className="flex items-center gap-1 text-[9px] font-black text-amber-500 uppercase tracking-widest bg-amber-50 px-1.5 py-0.5 rounded-md">
                                                            <Hand className="w-2.5 h-2.5" />
                                                            Raised
                                                        </span>
                                                    )}
                                                    {person.isDrawing && (
                                                        <span className="flex items-center gap-1 text-[9px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-1.5 py-0.5 rounded-md">
                                                            <Paintbrush className="w-2.5 h-2.5" />
                                                            Drawing
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            className={`p-2.5 rounded-xl transition-all duration-300 ${person.muted ? 'bg-red-50 text-red-500 ring-1 ring-red-100' : 'bg-slate-50 text-slate-400 group-hover:text-emerald-500 hover:bg-emerald-50'} ${person.id === localId ? 'invisible pointer-events-none' : 'opacity-0 group-hover:opacity-100 transform translate-x-1 group-hover:translate-x-0'}`}
                                            onClick={() => onForceMute(person.id, !person.muted)}
                                            title={person.muted ? `Unmute ${person.name}` : `Mute ${person.name}`}
                                        >
                                            {person.muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                        </button>
                                    </div>
                                ))}
                            </div>
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
                            className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[150] animate-in fade-in duration-500 cursor-pointer"
                            onClick={() => setMaximizedUser(null)}
                        />
                    )}

                    <div
                        className={`fixed flex flex-col gap-4 z-[40] transition-[transform,shadow] duration-200 ${dragging ? 'scale-105 shadow-2xl z-[50]' : ''}`}
                        style={{
                            left: `${pos.x}px`,
                            top: `${pos.y}px`,
                            maxWidth: '420px',
                            willChange: 'transform, left, top'
                        }}
                    >
                        {/* Drag Handle - Premium Floating Style */}
                        <div
                            onMouseDown={handleDragStart}
                            onTouchStart={handleDragStart}
                            className="flex items-center justify-between px-4 py-3 bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl shadow-slate-900/10 border border-white/50 cursor-grab active:cursor-grabbing hover:bg-white transition-all group overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex items-center gap-3 relative z-10">
                                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                                    <Move className="w-4 h-4" />
                                </div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] group-hover:text-slate-600 transition-colors">Room Vision</span>
                            </div>
                            <div className="flex gap-1 relative z-10 opacity-30 group-hover:opacity-100 transition-opacity">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto p-1 scrollbar-none animate-in slide-in-from-left duration-500">
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
