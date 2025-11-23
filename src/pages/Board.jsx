import React from 'react';
import boardImg from '../assets/board/Leaders_Board.png';
import bgImg from '../assets/background/bg.jpg';
import blankCardImg from '../assets/Blank/blank.png';

const CardSlot = ({ isDeck, isEmpty, className = "" }) => (
  <div className={`w-32 h-48 bg-[#1a1a1a] rounded-lg flex items-center justify-center shadow-lg overflow-hidden border-2 border-white ${className}`}>
    {isDeck ? (
      <img src={blankCardImg} alt="Deck" className="w-full h-full object-cover" />
    ) : isEmpty ? null : (
      <span className="text-gray-600 text-4xl font-serif">?</span>
    )}
  </div>
);

const Board = () => {
  return (
    <div 
      className="w-full h-screen bg-cover bg-center flex items-center justify-between p-8 overflow-hidden relative"
      style={{ backgroundImage: `url(${bgImg})` }}
    >
      {/* Left Side - Deck & Slots */}
      <div className="flex items-center gap-4 z-10">
        {/* Deck Column */}
        <div className="flex flex-col justify-center gap-4">
           <CardSlot label="DECK" isDeck />
        </div>
        
        {/* 3 Vertical Slots */}
        <div className="flex flex-col gap-4">
            <CardSlot isEmpty />
            <CardSlot isEmpty />
            <CardSlot isEmpty />
        </div>
      </div>

      {/* Center - Board */}
      <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
        <img 
          src={boardImg} 
          alt="Game Board" 
          className="h-[90vh] w-auto object-contain drop-shadow-[0_0_15px_rgba(0,0,0,0.5)] -translate-x-48" 
        />
      </div>

      {/* Right Side - Player Hands */}
      <div className="flex flex-col justify-between h-full py-8 z-10 ml-auto">
        {/* Player 1 (Opponent) */}
        <div className="flex flex-col items-end gap-2">
            <span className="text-red-400 font-bold text-xl mr-2 drop-shadow-md">Player 1</span>
            <div className="flex gap-3">
                {[...Array(5)].map((_, i) => (
                    <CardSlot key={`p1-${i}`} />
                ))}
            </div>
        </div>

        {/* Player 2 (You) */}
        <div className="flex flex-col items-end gap-2">
            <span className="text-cyan-400 font-bold text-xl mr-2 drop-shadow-md">Player 2 (You)</span>
            <div className="flex gap-3">
                {[...Array(5)].map((_, i) => (
                    <CardSlot key={`p2-${i}`} />
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Board;