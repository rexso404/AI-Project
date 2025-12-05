import React from 'react';
import TiffImage from './TiffImage.jsx';
import AbilityTooltip from './AbilityTooltip.jsx';

const RecruitOptionCard = ({ image, name, ability, onClick, disabled, onError }) => {
  const isTiff = image && (image.toLowerCase().includes('.tif') || image.toLowerCase().includes('.tiff'));
  const title = name || 'Unknown Champion';
  const abilityText = ability || 'Ability info unavailable.';

  return (
    <div className="relative group">
      <button
        type="button"
        disabled={disabled}
        onClick={disabled ? undefined : onClick}
        className={`w-40 h-64 rounded-[30px] border border-white/20 bg-linear-to-b from-[#1f1f24]/95 via-[#131316]/95 to-[#07070a]/95 backdrop-blur-sm shadow-[0_22px_35px_rgba(0,0,0,0.6)] p-3.5 flex flex-col gap-3 transition-transform ${disabled ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer hover:-translate-y-1.5'}`}
      >
        <div className="flex-1 rounded-2xl overflow-hidden bg-black/40 border border-white/10">
          {image ? (
            isTiff ? (
              <TiffImage src={image} alt={title} className="w-full h-full object-cover" onError={onError} />
            ) : (
              <img src={image} alt={title} className="w-full h-full object-cover" onError={onError} />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/40 text-2xl font-serif">?</div>
          )}
        </div>
        <div className="space-y-1 text-left">
          <p className="text-white font-semibold tracking-wide text-sm leading-tight overflow-hidden text-ellipsis whitespace-nowrap">{title}</p>
          <p className="text-[11px] leading-snug text-white/80 max-h-[3.6em] overflow-hidden">{abilityText}</p>
        </div>
      </button>
      <AbilityTooltip text={abilityText} />
    </div>
  );
};

export default RecruitOptionCard;
