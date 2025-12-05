import React from 'react';

const AbilityTooltip = ({ text, placement = 'right' }) => {
  if (!text) return null;

  if (placement === 'top') {
    return (
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 -mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
        <div className="relative bg-[#fffdf6]/95 text-slate-900 text-[12px] leading-relaxed px-5 py-3 rounded-2xl shadow-[0_12px_25px_rgba(0,0,0,0.35)] border border-[#f0c674] w-72 text-left">
          <p className="whitespace-normal wrap-break-word">
            {text}
          </p>
          <span aria-hidden="true" className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-3 h-3 bg-[#fffdf6]/95 border-r border-b border-[#f0c674] rotate-45"></span>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
      <div className="relative bg-[#fffdf6]/95 text-slate-900 text-[12px] leading-relaxed px-5 py-3 rounded-2xl shadow-[0_12px_25px_rgba(0,0,0,0.35)] border border-[#f0c674] w-72 text-left">
        <p className="whitespace-normal wrap-break-word">
          {text}
        </p>
        <span aria-hidden="true" className="absolute -left-2 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#fffdf6]/95 border-l border-t border-[#f0c674] rotate-45"></span>
      </div>
    </div>
  );
};

export default AbilityTooltip;
