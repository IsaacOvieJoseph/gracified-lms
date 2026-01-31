import React from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

export default function VoiceControls({
    isVoiceEnabled,
    isMuted,
    onToggleVoice,
    onToggleMute,
    isTeacher,
    localVolume = 0
}) {
    // Normalize volume for display (analyser gives 0-255, we want a percentage)
    const volumePercent = Math.min(100, (localVolume / 100) * 100);

    return (
        <div className="flex items-center gap-1 border-r pr-2 md:pr-4">
            {isTeacher && (
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
        </div>
    );
}
