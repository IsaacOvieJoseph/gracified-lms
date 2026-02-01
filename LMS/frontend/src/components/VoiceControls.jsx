import React from 'react';
import { Mic, MicOff, Volume2, VolumeX, Users, ChevronDown, ShieldAlert, Hand, Paintbrush, Lock } from 'lucide-react';

export default function VoiceControls({
    isVoiceEnabled,
    isMuted,
    onToggleVoice,
    onToggleMute,
    isTeacher,
    localVolume = 0,
    participants = {},
    onForceMute,
    activeSpeakers = new Set(),
    activeDrawers = new Set(),
    localId = null,
    micLocked = false
}) {
    const [showParticipants, setShowParticipants] = React.useState(false);

    // Normalize volume for display (analyser gives 0-255, we want a percentage)
    const volumePercent = Math.min(100, (localVolume / 100) * 100);

    const participantList = Object.keys(participants).map(id => ({
        id,
        name: participants[id].name || 'User',
        color: participants[id].color,
        isSpeaking: activeSpeakers.has(id),
        isDrawing: activeDrawers.has(id),
        muted: participants[id].muted,
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
                        {micLocked && isMuted ? (
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

            {/* Participants Popover */}
            {showParticipants && isTeacher && isVoiceEnabled && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-3 border-b flex items-center justify-between bg-gray-50 rounded-t-xl gap-2">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Participants</span>
                        <div className="flex gap-1">
                            <button
                                className="text-[10px] px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors flex items-center gap-1 font-bold"
                                onClick={() => { onForceMute('all', true); }}
                                title="Mute Everyone"
                            >
                                <MicOff className="w-3 h-3" />
                                All
                            </button>
                            <button
                                className="text-[10px] px-2 py-1 bg-green-100 text-green-600 rounded hover:bg-green-200 transition-colors flex items-center gap-1 font-bold"
                                onClick={() => { onForceMute('all', false); }}
                                title="Unmute Everyone"
                            >
                                <Mic className="w-3 h-3" />
                                All
                            </button>
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
        </div>
    );
}
