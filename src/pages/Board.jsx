import React, { useState } from 'react';
import boardImg from '../assets/board/Leaders_Board.png';
import bgImg from '../assets/background/bg.jpg';
import blankCardImg from '../assets/Blank/blank.png';
import { getBoardNodes } from '../Logic/Board';
import { getRandomCharacters, getUniqueRandomCharacter } from '../Logic/CharacterRandomizer';
import TiffImage from '../components/TiffImage.jsx';

const CardSlot = ({ isDeck, isEmpty, image, className = "", onError }) => {
  const isTiff = image && (image.toLowerCase().includes('.tif') || image.toLowerCase().includes('.tiff'));

  return (
    <div className={`w-32 h-48 bg-[#1a1a1a] rounded-lg flex items-center justify-center shadow-lg overflow-hidden border-2 border-white ${className}`}>
      {isDeck ? (
        <img src={blankCardImg} alt="Deck" className="w-full h-full object-cover" />
      ) : image ? (
        isTiff ? (
          <TiffImage src={image} alt="Card" className="w-full h-full object-cover" onError={onError} />
        ) : (
          <img src={image} alt="Card" className="w-full h-full object-cover" />
        )
      ) : isEmpty ? null : (
        <span className="text-gray-600 text-4xl font-serif">?</span>
      )}
    </div>
  );
};

const Board = () => {
  const nodes = getBoardNodes();
  const [leaders, setLeaders] = useState(() => getRandomCharacters(3));

  const handleLeaderError = (index) => {
      console.warn(`Leader at index ${index} failed to load. Retrying with a new character...`);
      setLeaders(prevLeaders => {
          const newLeaders = [...prevLeaders];
          const newChar = getUniqueRandomCharacter(newLeaders);
          if (newChar) {
              newLeaders[index] = newChar;
          }
          return newLeaders;
      });
  };

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
            <CardSlot image={leaders[0]} isEmpty={!leaders[0]} onError={() => handleLeaderError(0)} />
            <CardSlot image={leaders[1]} isEmpty={!leaders[1]} onError={() => handleLeaderError(1)} />
            <CardSlot image={leaders[2]} isEmpty={!leaders[2]} onError={() => handleLeaderError(2)} />
        </div>
      </div>

      {/* Center - Board */}
      <div className="absolute inset-0 flex justify-center items-center pointer-events-none -translate-x-48">
        <div className="relative h-[90vh]">
            <img 
              src={boardImg} 
              alt="Game Board" 
              className="h-full w-auto object-contain drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]" 
            />
            
            {/* Grid Overlay */}
            <div className="absolute inset-0">
                {nodes.map(node => (
                    <div 
                        key={node.id}
                        className="absolute rounded-full cursor-pointer pointer-events-auto hover:bg-white/20 transition-colors"
                        style={{
                            width: '9vh',
                            height: '9vh',
                            left: `calc(50% + ${(node.x - 3) * 10.5}vh)`, 
                            top: `calc(50% + ${(node.y - 3) * 12.1}vh)`,
                            transform: 'translate(-50%, -50%)'
                        }}
                    />
                ))}
            </div>
        </div>
      </div>

      {/* Right Side - Player Hands */}
      <div className="flex flex-col justify-between h-full py-8 z-10 ml-auto">
        {/* Player 1 (Opponent) */}
        <div className="flex flex-col items-end gap-2">
            <span className="text-red-400 font-bold text-3xl mr-2 drop-shadow-md tracking-wide">Player 1</span>
            <div className="flex gap-3">
                {[...Array(5)].map((_, i) => (
                    <CardSlot key={`p1-${i}`} />
                ))}
            </div>
        </div>

        {/* Player 2 (You) */}
        <div className="flex flex-col items-end gap-2">
            <span className="text-cyan-400 font-bold text-3xl mr-2 drop-shadow-md tracking-wide">Player 2 (You)</span>
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