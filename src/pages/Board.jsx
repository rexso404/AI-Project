import React, { useMemo, useState } from 'react';
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
  const nodes = useMemo(() => getBoardNodes(), []);
  const columnMaxRow = useMemo(() => {
    const map = {};
    nodes.forEach((node) => {
      map[node.col] = Math.max(map[node.col] ?? 0, node.row);
    });
    return map;
  }, [nodes]);
  const [leaders, setLeaders] = useState(() => getRandomCharacters(3));
  const [selectedNode, setSelectedNode] = useState(null);
  const [currentTurn, setCurrentTurn] = useState('Player 1');
  // Positions of leaders on the board (node ids)
  const [leadersPositions, setLeadersPositions] = useState({ p1: 15, p2: 21 });
  // Selected leader info when a player selects their leader to move
  const [selectedLeader, setSelectedLeader] = useState(null);
  // After moving, the player may pick one of the 3 left-side characters
  const [canPickFor, setCanPickFor] = useState(null); // 'Player 1' | 'Player 2' | null
  // Deck/hand of picked characters waiting to be placed on the board
  const [decks, setDecks] = useState({ p1: [], p2: [] });
  // Cards already placed on the board (besides leaders)
  const [placements, setPlacements] = useState([]);
  // Currently selected summon card to place (may be forced right after pick)
  const [selectedSummon, setSelectedSummon] = useState(null);

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

        const playerLabelToKey = (label) => (label === 'Player 1' ? 'p1' : 'p2');
        const playerKeyToLabel = (key) => (key === 'p1' ? 'Player 1' : 'Player 2');

        const toggleTurn = () => {
          setCurrentTurn(prev => prev === 'Player 1' ? 'Player 2' : 'Player 1');
          setSelectedLeader(null);
          setSelectedNode(null);
          setCanPickFor(null);
          setSelectedSummon(null);
        };

        const isNodeEmpty = (nodeId) => {
          if (leadersPositions.p1 === nodeId || leadersPositions.p2 === nodeId) return false;
          return !placements.some(piece => piece.nodeId === nodeId);
        };

        const isValidPlacementNode = (playerKey, node) => {
          if (!node) return false;
          if (playerKey === 'p1') {
            return node.row === 0;
          }
          if (playerKey === 'p2') {
            return node.row === columnMaxRow[node.col];
          }
          return false;
        };

        const isWithinMoveRange = (fromNode, toNode) => {
          const from = nodes.find(n => n.id === fromNode);
          const to = nodes.find(n => n.id === toNode);
          if (!from || !to) return false;
          const dx = Math.abs(from.x - to.x);
          const dy = Math.abs(from.y - to.y);
          return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
        };

        const handleNodeClick = (node, image) => {
          const nodeId = node.id;

          if (selectedSummon) {
            attemptPlacement(node);
            return;
          }

          // If clicking on a node that has a leader
          const clickedIsP1 = leadersPositions.p1 === nodeId;
          const clickedIsP2 = leadersPositions.p2 === nodeId;

          // If current player clicked their own leader, select/deselect it
          if ((currentTurn === 'Player 1' && clickedIsP1) || (currentTurn === 'Player 2' && clickedIsP2)) {
            // Select or toggle off
            if (selectedLeader && selectedLeader.nodeId === nodeId) {
              setSelectedLeader(null);
              setSelectedNode(null);
            } else {
              setSelectedLeader({ player: currentTurn, nodeId, x: node.x, y: node.y, image });
              setSelectedNode({ id: nodeId, x: node.x, y: node.y, image });
            }
            return;
          }

          // If a leader is selected and clicked an empty node within range, move
          if (selectedLeader) {
            const fromNode = selectedLeader.nodeId;
            const toNode = nodeId;
            if (isNodeEmpty(toNode) && isWithinMoveRange(fromNode, toNode)) {
              // perform move
              setLeadersPositions(prev => {
                const next = { ...prev };
                if (selectedLeader.player === 'Player 1') next.p1 = toNode;
                else next.p2 = toNode;
                return next;
              });
              // clear selection and pass turn
              setSelectedLeader(null);
              setSelectedNode(null);
              // Enter pick phase for the player who moved. They may pick one of the 3 cards on the left.
              setCanPickFor(selectedLeader.player);
            }
          }
        };

        const handlePickCard = (index) => {
          if (!canPickFor) return;
          if (currentTurn !== canPickFor) return;

          const card = leaders[index];
          if (!card) return;

          const playerKey = playerLabelToKey(canPickFor);
          const deckIndex = decks[playerKey].length;

          setDecks(prev => {
            const next = { ...prev };
            next[playerKey] = [...next[playerKey], card];
            return next;
          });

          setLeaders(prev => {
            const next = [...prev];
            next[index] = null;
            return next;
          });

          setSelectedSummon({
            player: canPickFor,
            playerKey,
            cardIndex: deckIndex,
            image: card,
            forced: true,
          });

          setCanPickFor(null);
        };

        const attemptPlacement = (node) => {
          if (!selectedSummon || !node) return;
          const { playerKey, cardIndex, image } = selectedSummon;
          const playerLabel = playerKeyToLabel(playerKey);

          if (currentTurn !== playerLabel) return;
          if (!isValidPlacementNode(playerKey, node)) return;
          if (!isNodeEmpty(node.id)) return;

          setPlacements(prev => [...prev, { nodeId: node.id, playerKey, image }]);

          setDecks(prev => {
            const next = { ...prev };
            next[playerKey] = next[playerKey].filter((_, idx) => idx !== cardIndex);
            return next;
          });

          setSelectedSummon(null);
          toggleTurn();
        };

        const handleDeckCardClick = (playerKey, cardIndex) => {
          if (selectedSummon?.forced) return; // must resolve forced placement first
          const card = decks[playerKey][cardIndex];
          if (!card) return;
          const playerLabel = playerKeyToLabel(playerKey);
          if (currentTurn !== playerLabel) return;

          setSelectedSummon({
            player: playerLabel,
            playerKey,
            cardIndex,
            image: card,
            forced: false,
          });
        };

        const isWithinHighlight = (node) => {
          if (!selectedNode) return false;
          const dx = Math.abs(node.x - selectedNode.x);
          const dy = Math.abs(node.y - selectedNode.y);
          return dx <= 1 && dy <= 1;
        };

  const skipDisabled = Boolean(selectedSummon?.forced);

  return (
    <div 
      className="w-full h-screen bg-cover bg-center flex flex-col overflow-hidden relative"
      style={{ backgroundImage: `url(${bgImg})` }}
    >
      {/* Navbar */}
      <div className="w-full h-16 bg-white flex items-center justify-between px-8 shadow-md z-50">
        <div className="text-2xl font-bold text-gray-800">
          Current Turn: <span className={currentTurn === 'Player 1' ? 'text-red-500' : 'text-cyan-500'}>{currentTurn}</span>
        </div>
        <button 
          onClick={() => toggleTurn()}
          disabled={skipDisabled}
          className={`bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded shadow transition-colors ${skipDisabled ? 'opacity-50 cursor-not-allowed hover:bg-red-600' : ''}`}
        >
          Skip Turn
        </button>
      </div>

      <div className="flex-1 flex items-center justify-between p-8 relative w-full">
      {/* Left Side - Deck & Slots */}
      <div className="flex items-center gap-4 z-10">
        {/* Deck Column */}
        <div className="flex flex-col justify-center gap-4">
           <CardSlot label="DECK" isDeck />
        </div>
        
        {/* 3 Vertical Slots */}
          <div className="flex flex-col gap-4">
              {[0,1,2].map(i => {
                const isClickable = canPickFor && currentTurn === canPickFor && leaders[i];
                return (
                  <div
                    key={`left-card-${i}`}
                    onClick={() => { if (isClickable) handlePickCard(i); }}
                    className={`${isClickable ? 'cursor-pointer hover:scale-105' : ''}`}
                    title={isClickable ? 'Pick this character' : ''}
                  >
                    <CardSlot image={leaders[i]} isEmpty={!leaders[i]} onError={() => handleLeaderError(i)} bgColor="bg-black" borderColor="border-black" />
                  </div>
                )
              })}
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
                {nodes.map(node => {
                  let nodeImage = null;
                  if (node.id === leadersPositions.p1) {
                    nodeImage = gameLeaders.p1.boardImage;
                  } else if (node.id === leadersPositions.p2) {
                    nodeImage = gameLeaders.p2.boardImage;
                  } else {
                    const placed = placements.find(piece => piece.nodeId === node.id);
                    if (placed) nodeImage = placed.image;
                  }

                  const isCenter = selectedNode?.id === node.id;
                  const withinHalo = selectedNode && !isCenter && isWithinHighlight(node);
                  const shouldRenderHighlight = isCenter || withinHalo;
                  const displayImage = shouldRenderHighlight ? selectedNode?.image : nodeImage;

                  const opacityClass = withinHalo ? 'opacity-40 grayscale contrast-75' : 'opacity-100';
                  const ringClass = isCenter ? 'ring-4 ring-yellow-300 ring-offset-2 ring-offset-black shadow-[0_0_20px_rgba(255,215,0,0.5)]' : '';
                  const hoverClass = nodeImage ? 'hover:bg-white/10' : 'hover:bg-white/20';

                  return (
                    <div 
                      key={node.id}
                      onClick={() => handleNodeClick(node, nodeImage)}
                      className={`absolute rounded-full cursor-pointer pointer-events-auto transition-all flex items-center justify-center overflow-hidden ${hoverClass} ${ringClass}`}
                      style={{
                        width: '9vh',
                        height: '9vh',
                        left: `calc(50% + ${(node.x - 3) * 10.5}vh)`, 
                        top: `calc(50% + ${(node.y - 3) * 12.1}vh)`,
                        transform: 'translate(-50%, -50%)'
                      }}
                    >
                      {displayImage && (
                        <img 
                          src={displayImage} 
                          alt="Leader" 
                          className={`w-full h-full object-cover transition-opacity duration-200 ${opacityClass}`}
                        />
                      )}
                    </div>
                  );
                })}
            </div>
        </div>
      </div>

      {/* Right Side - Player Hands */}
      <div className="flex flex-col justify-between h-full py-8 z-10 ml-auto">
        {/* Player 1 (Opponent) */}
        <div className="flex flex-col items-end gap-2">
          <span className="text-red-400 font-bold text-2xl mr-2 drop-shadow-md tracking-wide">Player 1 Deck ({decks.p1.length})</span>
            <div className="flex gap-3 flex-wrap max-w-[220px] justify-end">
                {decks.p1.length === 0 ? (
                  <CardSlot isEmpty className="opacity-70" />
                ) : (
                  decks.p1.map((card, idx) => {
                    const isSelected = selectedSummon && selectedSummon.playerKey === 'p1' && selectedSummon.cardIndex === idx;
                    const border = isSelected ? 'ring-4 ring-yellow-300 ring-offset-2 ring-offset-black' : '';
                    return (
                      <div
                        key={`p1-card-${idx}`}
                        onClick={() => handleDeckCardClick('p1', idx)}
                        className={`${currentTurn === 'Player 1' && !selectedSummon?.forced ? 'cursor-pointer' : 'cursor-not-allowed'} ${border}`}
                      >
                        <CardSlot image={card} isEmpty={!card} />
                      </div>
                    );
                  })
                )}
            </div>
        </div>

        {/* Player 2 (You) */}
        <div className="flex flex-col items-end gap-2">
          <span className="text-cyan-400 font-bold text-2xl mr-2 drop-shadow-md tracking-wide">Player 2 Deck ({decks.p2.length})</span>
            <div className="flex gap-3 flex-wrap max-w-[220px] justify-end">
                {decks.p2.length === 0 ? (
                  <CardSlot isEmpty className="opacity-70" />
                ) : (
                  decks.p2.map((card, idx) => {
                    const isSelected = selectedSummon && selectedSummon.playerKey === 'p2' && selectedSummon.cardIndex === idx;
                    const border = isSelected ? 'ring-4 ring-yellow-300 ring-offset-2 ring-offset-black' : '';
                    return (
                      <div
                        key={`p2-card-${idx}`}
                        onClick={() => handleDeckCardClick('p2', idx)}
                        className={`${currentTurn === 'Player 2' && !selectedSummon?.forced ? 'cursor-pointer' : 'cursor-not-allowed'} ${border}`}
                      >
                        <CardSlot image={card} isEmpty={!card} />
                      </div>
                    );
                  })
                )}
            </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Board;