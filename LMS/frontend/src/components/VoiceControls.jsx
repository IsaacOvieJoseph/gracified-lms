import React from 'react';
import { Mic, MicOff, Volume2, VolumeX, Users, ChevronDown, ShieldAlert } from 'lucide-react';

export default function VoiceControls({
    isVoiceEnabled,
    isMuted,
    onToggleVoice,
    onToggleMute,
    isTeacher,
    localVolume = 0,
    participants = {},
    onForceMute,
    activeSpeakers = new Set()
}) {
    const [showParticipants, setShowParticipants] = React.useState(false);

    // Normalize volume for display (analyser gives 0-255, we want a percentage)
    const volumePercent = Math.min(100, (localVolume / 100) * 100);

    const participantList = Object.keys(participants).map(id => ({
        id,
        name: participants[id].name || 'User',
        color: participants[id].color,
        isSpeaking: activeSpeakers.has(id)
    }));

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
                        }`}
                    onClick={onToggleMute}
                    title={isMuted ? 'Unmute' : 'Mute'}
                >
                    {/* Volume Level Indicator */}
                    {!isMuted && localVolume > 5 && (
                        <div
                            className="absolute bottom-0 left-0 w-full bg-green-400/50 transition-all duration-75"
                            style={{ height: `${volumePercent}%` }}
                        />
                    )}

                    <div className="relative z-10 transition-transform" style={{ transform: !isMuted && localVolume > 20 ? `scale(${1 + (localVolume / 400)})` : 'scale(1)' }}>
                        {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </div>
                </button>
            )}

            {/* Participants Popover */}
            {showParticipants && isTeacher && isVoiceEnabled && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-3 border-b flex items-center justify-between bg-gray-50 rounded-t-xl">
                        <span className="text-sm font-bold text-gray-700">Participants ({participantList.length})</span>
                        <button
                            className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition-colors flex items-center gap-1 font-bold"
                            onClick={() => { onForceMute('all'); setShowParticipants(false); }}
                        >
                            <ShieldAlert className="w-3 h-3" />
                            Mute All
                        </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-2 scrollbar-thin">
                        {participantList.length === 0 ? (
                            <div className="text-center py-4 text-gray-400 text-sm italic">
                                No students connected
                            </div>
                        ) : (
                            participantList.map(person => (
                                <div key={person.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors group">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div
                                            className={`w-2 h-2 rounded-full flex-shrink-0 ${person.isSpeaking ? 'bg-green-500 animate-pulse ring-4 ring-green-100' : 'bg-gray-300'}`}
                                        />
                                        <span className="text-sm text-gray-700 truncate font-medium">
                                            {person.name}
                                        </span>
                                    </div>
                                    <button
                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                                        onClick={() => onForceMute(person.id)}
                                        title={`Mute ${person.name}`}
                                    >
                                        <MicOff className="w-4 h-4" />
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
