import React from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

const ConfirmationModal = ({
    show,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmButtonColor = 'bg-red-600 hover:bg-red-700',
    isLoading = false,
    icon: Icon = AlertTriangle,
    iconColor = 'text-red-600',
    iconBg = 'bg-red-100'
}) => {
    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] shadow-[0_30px_70px_-10px_rgba(0,0,0,0.3)] max-w-sm w-full p-10 text-center relative animate-slide-up overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-500/0 via-red-500 to-red-500/0 opacity-20" />

                <div className={`w-24 h-24 ${iconBg} rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner`}>
                    <Icon className={`w-12 h-12 ${iconColor} drop-shadow-sm`} />
                </div>

                <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">{title}</h3>
                <p className="text-slate-500 font-medium mb-10 leading-relaxed text-sm">{message}</p>

                <div className="flex gap-4">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 px-4 py-4 rounded-2xl border-2 border-slate-50 font-black text-slate-400 hover:bg-slate-50 hover:text-slate-600 hover:border-slate-100 transition-all uppercase tracking-widest text-[10px] disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`flex-1 px-4 py-4 ${confirmButtonColor} text-white rounded-2xl shadow-xl shadow-red-200/50 hover:scale-[1.02] active:scale-95 transition-all font-black uppercase tracking-widest text-[10px] disabled:opacity-50 flex items-center justify-center`}
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            confirmText
                        )}
                    </button>
                </div>

                <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-95"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default ConfirmationModal;
