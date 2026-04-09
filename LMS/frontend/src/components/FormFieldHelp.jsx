import React, { useState } from 'react';
import { Info } from 'lucide-react';

const FormFieldHelp = ({ content }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block ml-1.5 group">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help transition-colors duration-200 text-slate-400 hover:text-indigo-600 active:text-indigo-700"
      >
        <Info size={14} strokeWidth={2.5} />
      </div>

      {isVisible && (
        <div className="absolute z-[100] bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-white border border-slate-100 rounded-xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] backdrop-blur-sm animate-in fade-in zoom-in duration-200">
          <div className="relative">
            <p className="text-xs leading-relaxed text-slate-600 font-medium">
              {content}
            </p>
            {/* Tooltip Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-slate-100 rotate-45 mt-1.5"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormFieldHelp;
