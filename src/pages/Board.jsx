import React, { useState } from 'react';
import boardImg from '../assets/board/Leaders_Board.png';
import bgImg from '../assets/background/bg.jpg';
import blankCardImg from '../assets/Blank/blank.png';
import { getBoardNodes } from '../Logic/Board';
import { getRandomCharacters, getUniqueRandomCharacter } from '../Logic/CharacterRandomizer';
import TiffImage from '../components/TiffImage.jsx';

// Leader Assets
import whiteReine from '../assets/leader_blanc/Leaders_BGA_white_LeaderReine.png';
import whiteRoi from '../assets/leader_blanc/Leaders_BGA_white_LeaderRoi.png';
import blackReine from '../assets/leader_noir/Leaders_BGA_black_LeaderReine.png';
import blackRoi from '../assets/leader_noir/Leaders_BGA_black_LeaderRoi.png';

// Hand Assets
import reinePortrait from '../assets/Q&K_Potrait/LEADERS-Reine.tif?url';
import roiPortrait from '../assets/Q&K_Potrait/LEADERS-Roi.tif?url';

const CardSlot = ({ isDeck, isEmpty, image, className = "", onError, bgColor = "bg-[#1a1a1a]", borderColor = "border-white" }) => {
  const isTiff = image && (image.toLowerCase().includes('.tif') || image.toLowerCase().includes('.tiff'));

  return (
    <div className={`w-28 h-40 ${bgColor} rounded-lg flex items-center justify-center shadow-lg overflow-hidden border-2 ${borderColor} ${className}`}>
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

  // Game Leaders Logic (P1 vs P2)
  const [gameLeaders] = useState(() => {
      const isP1White = Math.random() > 0.5;
      const isP1Reine = Math.random() > 0.5;

      const getLeaderImage = (isWhite, isReine) => {
          if (isWhite) return isReine ? whiteReine : whiteRoi;
          return isReine ? blackReine : blackRoi;
      };

      const getHandImage = (isReine) => {
          return isReine ? reinePortrait : roiPortrait;
      };

      return {
          p1: {
              boardImage: getLeaderImage(isP1White, isP1Reine),
              handImage: getHandImage(isP1Reine),
              isWhite: isP1White
          },
          p2: {
              boardImage: getLeaderImage(!isP1White, !isP1Reine),
              handImage: getHandImage(!isP1Reine),
              isWhite: !isP1White
          }
      };
  });

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
            <CardSlot image={leaders[0]} isEmpty={!leaders[0]} onError={() => handleLeaderError(0)} bgColor="bg-black" borderColor="border-black" />
            <CardSlot image={leaders[1]} isEmpty={!leaders[1]} onError={() => handleLeaderError(1)} bgColor="bg-black" borderColor="border-black" />
            <CardSlot image={leaders[2]} isEmpty={!leaders[2]} onError={() => handleLeaderError(2)} bgColor="bg-black" borderColor="border-black" />
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
                        className="absolute rounded-full cursor-pointer pointer-events-auto hover:bg-white/20 transition-colors flex items-center justify-center overflow-hidden"
                        style={{
                            width: '9vh',
                            height: '9vh',
                            left: `calc(50% + ${(node.x - 3) * 10.5}vh)`, 
                            top: `calc(50% + ${(node.y - 3) * 12.1}vh)`,
                            transform: 'translate(-50%, -50%)'
                        }}
                    >
                        {/* P1 Leader (Top - Node 15) */}
                        {node.id === 15 && (
                            <img src={gameLeaders.p1.boardImage} alt="P1 Leader" className="w-full h-full object-cover" />
                        )}
                        {/* P2 Leader (Bottom - Node 21) */}
                        {node.id === 21 && (
                            <img src={gameLeaders.p2.boardImage} alt="P2 Leader" className="w-full h-full object-cover" />
                        )}
                    </div>
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
                    <CardSlot 
                        key={`p1-${i}`} 
                        image={i === 0 ? gameLeaders.p1.handImage : null}
                        isEmpty={i !== 0}
                    />
                ))}
            </div>
        </div>

        {/* Player 2 (You) */}
        <div className="flex flex-col items-end gap-2">
            <span className="text-cyan-400 font-bold text-3xl mr-2 drop-shadow-md tracking-wide">Player 2 (You)</span>
            <div className="flex gap-3">
                {[...Array(5)].map((_, i) => (
                    <CardSlot 
                        key={`p2-${i}`} 
                        image={i === 0 ? gameLeaders.p2.handImage : null}
                        isEmpty={i !== 0}
                    />
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Board;