import React, { useMemo, useState } from 'react';
import boardImg from '../assets/board/Leaders_Board.png';
import bgImg from '../assets/background/bg.jpg';
import blankCardImg from '../assets/Blank/blank.png';
import { getBoardNodes } from '../Logic/Board';
import { getUniqueRandomCharacter } from '../Logic/CharacterRandomizer';
import TiffImage from '../components/TiffImage.jsx';

// Leader Assets
import whiteReine from '../assets/leader_blanc/Leaders_BGA_white_LeaderReine.png';
import whiteRoi from '../assets/leader_blanc/Leaders_BGA_white_LeaderRoi.png';
import blackReine from '../assets/leader_noir/Leaders_BGA_black_LeaderReine.png';
import blackRoi from '../assets/leader_noir/Leaders_BGA_black_LeaderRoi.png';

// Hand Assets
import reinePortrait from '../assets/Q&K_Potrait/LEADERS-Reine.tif?url';
import roiPortrait from '../assets/Q&K_Potrait/LEADERS-Roi.tif?url';

// Character assets (white)
import whiteAcrobate from '../assets/character_blanc/Leaders_BGA_white_Acrobate.png';
import whiteArchere from '../assets/character_blanc/Leaders_BGA_white_Archere.png';
import whiteAssassin from '../assets/character_blanc/Leaders_BGA_white_Assassin.png';
import whiteCavalier from '../assets/character_blanc/Leaders_BGA_white_Cavalier.png';
import whiteCogneur from '../assets/character_blanc/Leaders_BGA_white_Cogneur.png';
import whiteGardeRoyal from '../assets/character_blanc/Leaders_BGA_white_GardeRoyal.png';
import whiteGeolier from '../assets/character_blanc/Leaders_BGA_white_Geolier.png';
import whiteIllusionniste from '../assets/character_blanc/Leaders_BGA_white_Illusionniste.png';
import whiteLanceGrappin from '../assets/character_blanc/Leaders_BGA_white_LanceGrappin.png';
import whiteManipulatrice from '../assets/character_blanc/Leaders_BGA_white_Manipulatrice.png';
import whiteNemesis from '../assets/character_blanc/Leaders_BGA_white_Nemesis.png';
import whiteOurson from '../assets/character_blanc/Leaders_BGA_white_Ourson.png';
import whiteProtecteur from '../assets/character_blanc/Leaders_BGA_white_Protecteur.png';
import whiteRodeuse from '../assets/character_blanc/Leaders_BGA_white_Rodeuse.png';
import whiteTavernier from '../assets/character_blanc/Leaders_BGA_white_Tavernier.png';
import whiteVieilOurs from '../assets/character_blanc/Leaders_BGA_white_VieilOurs.png';
import whiteVizir from '../assets/character_blanc/Leaders_BGA_white_Vizir.png';

// Character assets (black)
import blackAcrobate from '../assets/character_noir/Leaders_BGA_black_Acrobate.png';
import blackArchere from '../assets/character_noir/Leaders_BGA_black_Archere.png';
import blackAssassin from '../assets/character_noir/Leaders_BGA_black_Assassin.png';
import blackCavalier from '../assets/character_noir/Leaders_BGA_black_Cavalier.png';
import blackCogneur from '../assets/character_noir/Leaders_BGA_black_Cogneur.png';
import blackGardeRoyal from '../assets/character_noir/Leaders_BGA_black_GardeRoyal.png';
import blackGeolier from '../assets/character_noir/Leaders_BGA_black_Geolier.png';
import blackIllusionniste from '../assets/character_noir/Leaders_BGA_black_Illusionniste.png';
import blackLanceGrappin from '../assets/character_noir/Leaders_BGA_black_LanceGrappin.png';
import blackManipulatrice from '../assets/character_noir/Leaders_BGA_black_Manipulatrice.png';
import blackNemesis from '../assets/character_noir/Leaders_BGA_black_Nemesis.png';
import blackOurson from '../assets/character_noir/Leaders_BGA_black_Ourson.png';
import blackProtecteur from '../assets/character_noir/Leaders_BGA_black_Protecteur.png';
import blackRodeuse from '../assets/character_noir/Leaders_BGA_black_Rodeuse.png';
import blackTavernier from '../assets/character_noir/Leaders_BGA_black_Tavernier.png';
import blackVieilOurs from '../assets/character_noir/Leaders_BGA_black_VieilOurs.png';
import blackVizir from '../assets/character_noir/Leaders_BGA_black_Vizir.png';

const normalizeKey = (value = '') => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const WHITE_CHARACTER_MAP = {
  acrobate: whiteAcrobate,
  archere: whiteArchere,
  assassin: whiteAssassin,
  cavalier: whiteCavalier,
  cogneur: whiteCogneur,
  garderoyal: whiteGardeRoyal,
  geolier: whiteGeolier,
  illusionniste: whiteIllusionniste,
  lancegrappin: whiteLanceGrappin,
  manipulatrice: whiteManipulatrice,
  nemesis: whiteNemesis,
  ourson: whiteOurson,
  protecteur: whiteProtecteur,
  rodeuse: whiteRodeuse,
  tavernier: whiteTavernier,
  vieilours: whiteVieilOurs,
  vizir: whiteVizir,
};

const BLACK_CHARACTER_MAP = {
  acrobate: blackAcrobate,
  archere: blackArchere,
  assassin: blackAssassin,
  cavalier: blackCavalier,
  cogneur: blackCogneur,
  garderoyal: blackGardeRoyal,
  geolier: blackGeolier,
  illusionniste: blackIllusionniste,
  lancegrappin: blackLanceGrappin,
  manipulatrice: blackManipulatrice,
  nemesis: blackNemesis,
  ourson: blackOurson,
  protecteur: blackProtecteur,
  rodeuse: blackRodeuse,
  tavernier: blackTavernier,
  vieilours: blackVieilOurs,
  vizir: blackVizir,
};
const BOARD_COMPATIBLE_KEYS = new Set([
  ...Object.keys(WHITE_CHARACTER_MAP),
  ...Object.keys(BLACK_CHARACTER_MAP),
]);

const extractPortraitKey = (imageUrl = '') => {
  const fileName = imageUrl.split('/').pop()?.split('?')[0] ?? '';
  let base = fileName.replace(/^LEADERS[-_]/i, '');
  base = base.replace(/\.(tif|tiff|png)$/i, '');
  base = base.replace(/[-_]?LQ$/i, '');
  return normalizeKey(base);
};

const hasBoardAssetForCard = (imageUrl) => BOARD_COMPATIBLE_KEYS.has(extractPortraitKey(imageUrl));

const getBoardAssetForPlayer = (imageUrl, playerKey) => {
  const key = extractPortraitKey(imageUrl);
  const map = playerKey === 'p1' ? WHITE_CHARACTER_MAP : BLACK_CHARACTER_MAP;
  return map[key] ?? null;
};

const drawPlayableCharacter = (excludeList = []) => {
  const banned = [];
  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = getUniqueRandomCharacter([...excludeList.filter(Boolean), ...banned]);
    if (!candidate) break;
    if (hasBoardAssetForCard(candidate)) {
      return candidate;
    }
    banned.push(candidate);
  }
  return null;
};

const generateInitialLeaders = () => {
  const picks = [];
  while (picks.length < 3) {
    const next = drawPlayableCharacter(picks);
    if (!next) break;
    picks.push(next);
  }
  while (picks.length < 3) {
    picks.push(null);
  }
  return picks;
};

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
  const [leaders, setLeaders] = useState(() => generateInitialLeaders());
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
  const [turnHasMoved, setTurnHasMoved] = useState(false);

  // Game Leaders Logic (P1 vs P2)
  const [gameLeaders] = useState(() => {
      const isReineP1 = Math.random() > 0.5;
      const isReineP2 = Math.random() > 0.5;

      const buildLeader = (color, isReine) => ({
        boardImage: color === 'white'
          ? (isReine ? whiteReine : whiteRoi)
          : (isReine ? blackReine : blackRoi),
        handImage: isReine ? reinePortrait : roiPortrait,
        isWhite: color === 'white',
      });

      return {
        p1: buildLeader('white', isReineP1),
        p2: buildLeader('black', isReineP2),
      };
  });

  const handleLeaderError = (index) => {
      console.warn(`Leader at index ${index} failed to load. Retrying with a new character...`);
      setLeaders(prevLeaders => {
          const newLeaders = [...prevLeaders];
        const newChar = drawPlayableCharacter(newLeaders.filter(Boolean));
          if (newChar) {
              newLeaders[index] = newChar;
        } else {
          newLeaders[index] = null;
          }
          return newLeaders;
      });
  };

        const playerLabelToKey = (label) => (label === 'Player 1' ? 'p1' : 'p2');
        const playerKeyToLabel = (key) => (key === 'p1' ? 'Player 1' : 'Player 2');
        const getPlayerPieceCount = (playerKey) => decks[playerKey].length + placements.filter(piece => piece.playerKey === playerKey).length;

        const toggleTurn = () => {
          setCurrentTurn(prev => prev === 'Player 1' ? 'Player 2' : 'Player 1');
          setSelectedLeader(null);
          setSelectedNode(null);
          setCanPickFor(null);
          setSelectedSummon(null);
          setTurnHasMoved(false);
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

          if (turnHasMoved) {
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
              setTurnHasMoved(true);
              const playerLabel = selectedLeader.player;
              const playerKey = playerLabelToKey(playerLabel);
              const piecesCount = getPlayerPieceCount(playerKey);
              const hasDraftOptions = leaders.some(Boolean);
              if (piecesCount >= 4 || !hasDraftOptions) {
                toggleTurn();
              } else {
                setCanPickFor(playerLabel);
              }
            }
          }
        };

        const handlePickCard = (index) => {
          if (!canPickFor) return;
          if (currentTurn !== canPickFor) return;

          const card = leaders[index];
          if (!card) return; // no card to pick

          const playerKey = playerLabelToKey(canPickFor);
          const totalPieces = getPlayerPieceCount(playerKey);
          if (totalPieces >= 4) {
            console.warn(`Maximum characters reached for ${canPickFor}`);
            setCanPickFor(null);
            toggleTurn();
            return;
          }

          const boardImage = getBoardAssetForPlayer(card, playerKey) ?? card;
          const deckIndex = decks[playerKey].length;
          const cardData = { portrait: card, boardImage };

          setDecks(prev => {
            const next = { ...prev };
            next[playerKey] = [...next[playerKey], cardData];
            return next;
          });

          setLeaders(prev => {
            const next = [...prev];
            next[index] = null;
            const exclude = next.filter(Boolean);
            const replacement = drawPlayableCharacter(exclude);
            next[index] = replacement;
            return next;
          });

          setSelectedSummon({
            player: canPickFor,
            playerKey,
            cardIndex: deckIndex,
            image: boardImage,
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
            image: card.boardImage,
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
                        <CardSlot image={card?.portrait} isEmpty={!card} />
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
                        <CardSlot image={card?.portrait} isEmpty={!card} />
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