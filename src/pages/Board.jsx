import React, { useEffect, useMemo, useState } from 'react';
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

const MAX_DECK_SIZE = 4;
const DECK_INDEXES = Array.from({ length: MAX_DECK_SIZE }, (_, idx) => idx);
const STORAGE_KEY = 'leaders-game-state';

const CHARACTER_DISPLAY_NAMES = {
  acrobate: 'Acrobat',
  archere: 'Archer',
  assassin: 'Assassin',
  cavalier: 'Rider',
  cogneur: 'Bruiser',
  garderoyal: 'Royal Guard',
  geolier: 'Jailer',
  illusionniste: 'Illusionist',
  lancegrappin: 'Claw Launcher',
  manipulatrice: 'Manipulator',
  nemesis: 'Nemesis',
  ourson: 'Cub',
  protecteur: 'Protector',
  rodeuse: 'Wanderer',
  tavernier: 'Brewmaster',
  vieilours: 'Hermit',
  vizir: 'Vizier',
};

const LEADER_DISPLAY_NAMES = {
  reine: 'Reine',
  roi: 'Roi',
};

const CHARACTER_ABILITIES = {
  acrobate: 'Jumps in a straight line over an adjacent character. May jump twice consecutively.',
  archere: 'Two spaces away in a straight line, supports capturing the opposing Leader even if not visible.',
  assassin: 'Captures the opponent Leader alone when adjacent.',
  cavalier: 'Moves two spaces in a straight line.',
  cogneur: 'Moves onto an adjacent enemy and pushes them to one of the opposite spaces.',
  garderoyal: 'Teleports next to your Leader, then may move one extra space.',
  illusionniste: 'Switches places with a visible non-adjacent character in a straight line.',
  lancegrappin: 'Rushes in a straight line to a visible character or drags them adjacent.',
  manipulatrice: 'Moves a visible non-adjacent enemy one space.',
  nemesis: 'Must move two spaces after any action that moves the opposing Leader; cannot take its own action.',
  ourson: 'Paired with the Hermit; deploy both and move either during your turn.',
  protecteur: 'Enemy abilities cannot move the Protector or adjacent allies.',
  rodeuse: 'Moves to any space not adjacent to an enemy.',
  tavernier: 'Moves an adjacent ally one space.',
  vieilours: 'Paired with the Cub; deploy both and move either during your turn.',
  vizir: 'Your Leader may move one additional space during their action.',
  geolier: 'Adjacent enemies with active abilities cannot use them.',
};

const buildEmptyDecks = () => ({
  p1: Array(MAX_DECK_SIZE).fill(null),
  p2: Array(MAX_DECK_SIZE).fill(null),
});

const createGameLeaders = () => {
  const buildLeader = (color, isReine) => ({
    boardImage: color === 'white'
      ? (isReine ? whiteReine : whiteRoi)
      : (isReine ? blackReine : blackRoi),
    handImage: isReine ? reinePortrait : roiPortrait,
    isWhite: color === 'white',
    role: isReine ? 'reine' : 'roi',
  });

  const isReineP1 = Math.random() > 0.5;
  const leaders = {
    p1: buildLeader('white', isReineP1),
    p2: buildLeader('black', !isReineP1),
  };
  const firstPlayerKey = leaders.p1.role === 'roi' ? 'p1' : 'p2';

  return { leaders, firstPlayerKey };
};

const playerLabelToKey = (label) => (label === 'Player 1' ? 'p1' : 'p2');
const playerKeyToLabel = (key) => (key === 'p1' ? 'Player 1' : 'Player 2');

const getCardDisplayName = (imageUrl) => {
  if (!imageUrl) return '';
  const key = extractPortraitKey(imageUrl);
  if (!key) return '';
  return CHARACTER_DISPLAY_NAMES[key] ?? LEADER_DISPLAY_NAMES[key] ?? '';
};

const getCardAbility = (imageUrl) => {
  if (!imageUrl) return '';
  const key = extractPortraitKey(imageUrl);
  if (!key) return '';
  return CHARACTER_ABILITIES[key] ?? '';
};

const createInitialLeaderPositions = () => ({ p1: 15, p2: 21 });

const getSavedGameState = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Failed to parse saved game state', error);
    return null;
  }
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

const createMovementTracker = () => ({
  p1: { leader: false, units: [] },
  p2: { leader: false, units: [] },
});

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
  const savedGame = useMemo(() => getSavedGameState(), []);
  const initialGameLeaderData = useMemo(() => {
    if (savedGame?.gameLeaders) {
      const roiEntry = Object.entries(savedGame.gameLeaders).find(([, leader]) => leader?.role === 'roi');
      return {
        leaders: savedGame.gameLeaders,
        firstPlayerKey: roiEntry ? roiEntry[0] : 'p1',
      };
    }
    return createGameLeaders();
  }, [savedGame]);
  const [leaders, setLeaders] = useState(() => savedGame?.leaders ?? generateInitialLeaders());
  const [selectedNode, setSelectedNode] = useState(null);
  const [currentTurn, setCurrentTurn] = useState(() => savedGame?.currentTurn ?? playerKeyToLabel(initialGameLeaderData.firstPlayerKey));
  // Positions of leaders on the board (node ids)
  const [leadersPositions, setLeadersPositions] = useState(() => savedGame?.leadersPositions ?? createInitialLeaderPositions());
  // Selected leader info when a player selects their leader to move
  const [selectedLeader, setSelectedLeader] = useState(null);
  // After moving, the player may pick one of the 3 left-side characters
  const [canPickFor, setCanPickFor] = useState(() => savedGame?.canPickFor ?? null); // 'Player 1' | 'Player 2' | null
  // Deck/hand of picked characters waiting to be placed on the board
  const [decks, setDecks] = useState(() => savedGame?.decks ?? buildEmptyDecks());
  // Cards already placed on the board (besides leaders)
  const [placements, setPlacements] = useState(() => savedGame?.placements ?? []);
  const [retiredCards, setRetiredCards] = useState(() => savedGame?.retiredCards ?? []);
  // Currently selected summon card to place (may be forced right after pick)
  const [selectedSummon, setSelectedSummon] = useState(() => savedGame?.selectedSummon ?? null);
  const [movementTracker, setMovementTracker] = useState(() => savedGame?.movementTracker ?? createMovementTracker());
  const [selectedUnit, setSelectedUnit] = useState(null);

  const hasLeaderMoved = (playerKey) => Boolean(movementTracker[playerKey]?.leader);
  const hasUnitMoved = (playerKey, deckIndex) => movementTracker[playerKey]?.units.includes(deckIndex);
  const markLeaderMoved = (playerKey) => {
    setMovementTracker((prev) => ({
      ...prev,
      [playerKey]: { ...prev[playerKey], leader: true },
    }));
  };
  const markUnitMoved = (playerKey, deckIndex) => {
    setMovementTracker((prev) => {
      const existing = prev[playerKey]?.units ?? [];
      if (existing.includes(deckIndex)) return prev;
      return {
        ...prev,
        [playerKey]: {
          ...prev[playerKey],
          units: [...existing, deckIndex],
        },
      };
    });
  };
  const resetMovementTracker = () => setMovementTracker(createMovementTracker());
  const isPlayerDeckFull = (playerKey) => decks[playerKey].every(Boolean);
  const bothDecksFull = isPlayerDeckFull('p1') && isPlayerDeckFull('p2');
  const boardShiftClass = bothDecksFull ? '-translate-x-24' : '-translate-x-48';
  const playerDeckShiftClass = bothDecksFull ? '-translate-x-12' : '';

  // Game Leaders Logic (P1 vs P2)
  const [gameLeaders, setGameLeaders] = useState(() => initialGameLeaderData.leaders);

  const handleLeaderError = (index) => {
    console.warn(`Leader at index ${index} failed to load. Retrying with a new character...`);
    setLeaders(prevLeaders => {
      const newLeaders = [...prevLeaders];
      const newChar = drawPlayableCharacter([...newLeaders.filter(Boolean), ...retiredCards]);
      if (newChar) {
        newLeaders[index] = newChar;
      } else {
        newLeaders[index] = null;
      }
      return newLeaders;
    });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = {
      leaders,
      currentTurn,
      leadersPositions,
      canPickFor,
      decks,
      placements,
      retiredCards,
      selectedSummon,
      movementTracker,
      gameLeaders,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [leaders, currentTurn, leadersPositions, canPickFor, decks, placements, retiredCards, selectedSummon, movementTracker, gameLeaders]);

  const clearSavedGame = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const resetGameState = () => {
    clearSavedGame();
    const { leaders: freshGameLeaders, firstPlayerKey } = createGameLeaders();
    setLeaders(generateInitialLeaders());
    setCurrentTurn(playerKeyToLabel(firstPlayerKey));
    setLeadersPositions(createInitialLeaderPositions());
    setSelectedLeader(null);
    setSelectedNode(null);
    setCanPickFor(null);
    setDecks(buildEmptyDecks());
    setPlacements([]);
    setRetiredCards([]);
    setSelectedSummon(null);
    resetMovementTracker();
    setSelectedUnit(null);
    setGameLeaders(freshGameLeaders);
  };

        const getPlayerPieceCount = (playerKey) => placements.filter(piece => piece.playerKey === playerKey).length;

        const handlePostMove = (playerLabel) => {
          const playerKey = playerLabelToKey(playerLabel);
          const piecesCount = getPlayerPieceCount(playerKey);
          const hasDraftOptions = leaders.some(Boolean);
          if (bothDecksFull || piecesCount >= 4 || !hasDraftOptions) {
            toggleTurn();
          } else {
            setCanPickFor(playerLabel);
          }
        };

        const toggleTurn = () => {
          setCurrentTurn(prev => prev === 'Player 1' ? 'Player 2' : 'Player 1');
          setSelectedLeader(null);
          setSelectedUnit(null);
          setSelectedNode(null);
          setCanPickFor(null);
          setSelectedSummon(null);
          resetMovementTracker();
        };

        const endPhase = () => {
          if (selectedSummon?.forced) return; // cannot change phase while forced placement is pending
          handlePostMove(currentTurn);
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

          if (canPickFor && canPickFor === currentTurn) {
            return;
          }

          // If clicking on a node that has a leader
          const clickedIsP1 = leadersPositions.p1 === nodeId;
          const clickedIsP2 = leadersPositions.p2 === nodeId;
          const clickedLeaderKey = clickedIsP1 ? 'p1' : clickedIsP2 ? 'p2' : null;

          // If current player clicked their own leader, select/deselect it
          if ((currentTurn === 'Player 1' && clickedIsP1) || (currentTurn === 'Player 2' && clickedIsP2)) {
            if (hasLeaderMoved(clickedLeaderKey)) {
              return;
            }
            // Select or toggle off
            if (selectedLeader && selectedLeader.nodeId === nodeId) {
              setSelectedLeader(null);
              setSelectedNode(null);
            } else {
              setSelectedLeader({ player: currentTurn, playerKey: playerLabelToKey(currentTurn), nodeId, x: node.x, y: node.y, image });
              setSelectedUnit(null);
              setSelectedNode({ id: nodeId, x: node.x, y: node.y, image });
            }
            return;
          }

          const currentPlayerKey = playerLabelToKey(currentTurn);
          const clickedUnit = placements.find(piece => piece.playerKey === currentPlayerKey && piece.nodeId === nodeId);
          if (clickedUnit) {
            if (hasUnitMoved(currentPlayerKey, clickedUnit.deckIndex)) {
              return;
            }
            if (selectedUnit && selectedUnit.deckIndex === clickedUnit.deckIndex) {
              setSelectedUnit(null);
              setSelectedNode(null);
            } else {
              setSelectedUnit({ ...clickedUnit, playerKey: currentPlayerKey, player: currentTurn });
              setSelectedLeader(null);
              setSelectedNode({ id: nodeId, x: node.x, y: node.y, image: clickedUnit.image });
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
              markLeaderMoved(selectedLeader.playerKey);
            }
            return;
          }

          if (selectedUnit) {
            const fromNode = selectedUnit.nodeId;
            const toNode = nodeId;
            if (isNodeEmpty(toNode) && isWithinMoveRange(fromNode, toNode)) {
              setPlacements(prev => prev.map(piece => {
                if (piece.playerKey === selectedUnit.playerKey && piece.deckIndex === selectedUnit.deckIndex) {
                  return { ...piece, nodeId: toNode };
                }
                return piece;
              }));

              setDecks(prev => {
                const next = { ...prev };
                next[selectedUnit.playerKey] = next[selectedUnit.playerKey].map((card, idx) => {
                  if (idx !== selectedUnit.deckIndex || !card) return card;
                  return { ...card, boardNodeId: toNode };
                });
                return next;
              });

              setSelectedUnit(null);
              setSelectedNode(null);
              markUnitMoved(selectedUnit.playerKey, selectedUnit.deckIndex);
            }
            return;
          }
        };

        const handlePickCard = (index) => {
          if (!canPickFor) return;
          if (currentTurn !== canPickFor) return;
          if (bothDecksFull) {
            setCanPickFor(null);
            toggleTurn();
            return;
          }

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
          const emptySlot = decks[playerKey].findIndex(slot => !slot);
          if (emptySlot === -1) {
            console.warn('No empty deck slot available.');
            setCanPickFor(null);
            toggleTurn();
            return;
          }

          const updatedRetired = retiredCards.includes(card) ? retiredCards : [...retiredCards, card];
          setRetiredCards(updatedRetired);

          const cardData = { portrait: card, boardImage, boardNodeId: null };

          setDecks(prev => {
            const next = { ...prev };
            next[playerKey] = next[playerKey].map((slot, idx) => (idx === emptySlot ? cardData : slot));
            return next;
          });

          setLeaders(prev => {
            const next = [...prev];
            next[index] = null;
            const exclude = [...next.filter(Boolean), ...updatedRetired];
            const replacement = drawPlayableCharacter(exclude);
            next[index] = replacement;
            return next;
          });

          setSelectedSummon({
            player: canPickFor,
            playerKey,
            cardIndex: emptySlot,
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

          setPlacements(prev => [...prev, { nodeId: node.id, playerKey, image, deckIndex: cardIndex }]);

          setDecks(prev => {
            const next = { ...prev };
            next[playerKey] = next[playerKey].map((card, idx) => {
              if (idx !== cardIndex || !card) return card;
              return { ...card, boardNodeId: node.id };
            });
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

          // If the card is already deployed (has a boardNodeId), allow selecting its on-board unit
          if (card.boardNodeId) {
            if (selectedSummon || canPickFor || hasUnitMoved(playerKey, cardIndex)) return;
            const placed = placements.find(p => p.playerKey === playerKey && p.deckIndex === cardIndex);
            if (placed) {
              const nodeRef = nodes.find(n => n.id === placed.nodeId) || { x: 0, y: 0 };
              setSelectedUnit({ ...placed, playerKey, player: playerLabel });
              setSelectedLeader(null);
              setSelectedSummon(null);
              setSelectedNode({ id: placed.nodeId, x: nodeRef.x, y: nodeRef.y, image: placed.image });
            }
            return;
          }

          // Otherwise, prepare to place the card (normal summon selection)
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

  const phaseInfo = useMemo(() => {
    // Merge Phase 3 into Phase 2: both picking and placing are part of Phase 2 now
    if (canPickFor || selectedSummon) {
      return {
        label: 'Phase 2',
        description: selectedSummon
          ? 'Tempatkan champion pilihanmu ke slot summon yang sesuai.'
          : 'Pilih salah satu champion dari kolom kiri untuk direkrut.'
      };
    }
    return {
      label: 'Phase 1',
      description: 'Gerakkan semua championmu (leader maupun pasukan) masing-masing satu petak sebelum merekrut.'
    };
  }, [selectedSummon, canPickFor]);

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
        <div className="text-center">
          <div className="text-sm font-bold tracking-wide text-gray-600 uppercase">{phaseInfo.label}</div>
          <div className="text-base text-gray-800 font-medium">{phaseInfo.description}</div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={resetGameState}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-5 rounded shadow"
          >
            Reset Game
          </button>
          <button
            onClick={() => endPhase()}
            disabled={selectedSummon?.forced}
            className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded shadow transition-colors ${selectedSummon?.forced ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            End Phase
          </button>
        </div>
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
                const image = leaders[i];
                const isClickable = canPickFor && currentTurn === canPickFor && image && !bothDecksFull;
                const displayName = getCardDisplayName(image);
                const abilityText = getCardAbility(image);
                return (
                  <div
                    key={`left-card-${i}`}
                    onClick={() => { if (isClickable) handlePickCard(i); }}
                    className={`${isClickable ? 'cursor-pointer hover:scale-105' : ''} flex flex-col items-center gap-1 relative group`}
                    title={isClickable ? 'Pick this character' : displayName}
                  >
                    <CardSlot image={image} isEmpty={!image} onError={() => handleLeaderError(i)} bgColor="bg-black" borderColor="border-black" />
                    {displayName && <span className="text-xs font-semibold uppercase tracking-wide text-white drop-shadow-sm">{displayName}</span>}
                    {abilityText && (
                      <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="bg-black/90 text-white text-[11px] leading-snug px-3 py-2 rounded-lg shadow-lg max-w-[14rem] text-center">
                          {abilityText}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
      </div>

      {/* Center - Board */}
      <div className={`absolute inset-0 flex justify-center items-center pointer-events-none ${boardShiftClass}`}>
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
                  const hasActiveSelection = selectedLeader || selectedUnit;
                  const canMoveHere = Boolean(
                    hasActiveSelection &&
                    !isCenter &&
                    isWithinHighlight(node) &&
                    isNodeEmpty(node.id)
                  );
                  const shouldRenderHighlight = isCenter || canMoveHere;
                  const displayImage = shouldRenderHighlight ? selectedNode?.image : nodeImage;

                  const opacityClass = canMoveHere ? 'opacity-40 grayscale contrast-75' : 'opacity-100';
                  const ringClass = isCenter ? 'ring-4 ring-yellow-300 ring-offset-2 ring-offset-black shadow-[0_0_20px_rgba(255,215,0,0.5)]' : '';
                  const haloClass = canMoveHere ? 'bg-yellow-200/25 shadow-[0_0_18px_rgba(255,215,0,0.75)]' : '';
                  const hoverClass = nodeImage ? 'hover:bg-white/10' : 'hover:bg-white/20';

                  return (
                    <div 
                      key={node.id}
                      onClick={() => handleNodeClick(node, nodeImage)}
                      className={`absolute rounded-full cursor-pointer pointer-events-auto transition-all flex items-center justify-center overflow-hidden ${hoverClass} ${ringClass} ${haloClass}`}
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
      <div className={`flex flex-col justify-between h-full py-8 z-10 ml-auto gap-6 ${playerDeckShiftClass}`}>
        {/* Player 1 (Opponent) */}
        <div className="flex flex-col items-end gap-3">
          <span className="text-red-400 font-bold text-2xl mr-2 drop-shadow-md tracking-wide">Player 1 Deck ({decks.p1.filter(Boolean).length})</span>
          <div className="bg-white/95 border-2 border-[#d2c2ac] rounded-[28px] px-6 py-4 shadow-[0_18px_35px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-5">
              <div className="flex flex-col items-center gap-1">
                <CardSlot image={gameLeaders.p1.handImage} bgColor="bg-black" borderColor="border-black" />
                <span className="text-xs font-semibold tracking-[0.2em] text-gray-700 uppercase">Leader</span>
              </div>
              <div className="flex gap-3">
                {DECK_INDEXES.map(idx => {
                  const card = decks.p1[idx];
                  const deployed = Boolean(card?.boardNodeId);
                  const isSummonSelected = selectedSummon && selectedSummon.playerKey === 'p1' && selectedSummon.cardIndex === idx;
                  const isUnitSelected = selectedUnit && selectedUnit.playerKey === 'p1' && selectedUnit.deckIndex === idx;
                  const unitAlreadyMoved = deployed && hasUnitMoved('p1', idx);
                  const allowMoveSelection = deployed && !unitAlreadyMoved && !selectedSummon && !canPickFor;
                  const allowSummonSelection = !deployed && !selectedSummon?.forced;
                  const canInteract = currentTurn === 'Player 1' && Boolean(card) && (allowMoveSelection || allowSummonSelection);
                  const cursorClass = canInteract ? 'cursor-pointer hover:-translate-y-1 transition-transform' : 'cursor-not-allowed';
                  const ringClass = (isSummonSelected || isUnitSelected) ? 'ring-4 ring-yellow-300 ring-offset-2 ring-offset-white' : '';
                  const borderClass = isSummonSelected
                    ? 'border-yellow-300'
                    : deployed
                      ? 'border-green-400'
                      : 'border-dashed border-[#b3a796]';
                  const displayName = getCardDisplayName(card?.portrait ?? card?.boardImage);
                  const abilityText = getCardAbility(card?.portrait ?? card?.boardImage);
                  const statusLabel = unitAlreadyMoved ? 'Moved' : 'In Play';
                  const statusColor = unitAlreadyMoved ? 'text-gray-500' : 'text-green-700';
                  return (
                    <div
                      key={`p1-card-${idx}`}
                      onClick={() => canInteract && handleDeckCardClick('p1', idx)}
                      className={`${cursorClass} ${ringClass} rounded-xl relative flex flex-col items-center group`}
                    >
                      <CardSlot image={card?.portrait} isEmpty={Boolean(card)} bgColor="bg-white" borderColor={borderClass} className={deployed ? 'opacity-85' : ''} />
                      <div className="flex flex-col items-center mt-2 leading-tight">
                        {displayName && (
                          <span className="text-xs font-semibold uppercase tracking-wide text-gray-800">{displayName}</span>
                        )}
                        {deployed && (
                          <span className={`text-[10px] font-bold uppercase tracking-wide ${statusColor}`}>{statusLabel}</span>
                        )}
                      </div>
                      {abilityText && (
                        <div className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <div className="bg-black/90 text-white text-[11px] leading-snug px-3 py-2 rounded-lg shadow-lg max-w-[14rem] text-center">
                            {abilityText}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Player 2 (You) */}
        <div className="flex flex-col items-end gap-3">
          <span className="text-cyan-400 font-bold text-2xl mr-2 drop-shadow-md tracking-wide">Player 2 Deck ({decks.p2.filter(Boolean).length})</span>
          <div className="bg-black/90 border-2 border-[#4f3d31] rounded-[28px] px-6 py-4 shadow-[0_18px_35px_rgba(0,0,0,0.55)]">
            <div className="flex items-center gap-5">
              <div className="flex flex-col items-center gap-1">
                <CardSlot image={gameLeaders.p2.handImage} bgColor="bg-black" borderColor="border-[#f6dcb5]" />
                <span className="text-xs font-semibold tracking-[0.2em] text-white uppercase">Leader</span>
              </div>
              <div className="flex gap-3">
                {DECK_INDEXES.map(idx => {
                  const card = decks.p2[idx];
                  const deployed = Boolean(card?.boardNodeId);
                  const isSummonSelected = selectedSummon && selectedSummon.playerKey === 'p2' && selectedSummon.cardIndex === idx;
                  const isUnitSelected = selectedUnit && selectedUnit.playerKey === 'p2' && selectedUnit.deckIndex === idx;
                  const unitAlreadyMoved = deployed && hasUnitMoved('p2', idx);
                  const allowMoveSelection = deployed && !unitAlreadyMoved && !selectedSummon && !canPickFor;
                  const allowSummonSelection = !deployed && !selectedSummon?.forced;
                  const canInteract = currentTurn === 'Player 2' && Boolean(card) && (allowMoveSelection || allowSummonSelection);
                  const cursorClass = canInteract ? 'cursor-pointer hover:-translate-y-1 transition-transform' : 'cursor-not-allowed';
                  const ringClass = (isSummonSelected || isUnitSelected) ? 'ring-4 ring-yellow-300 ring-offset-2 ring-offset-black' : '';
                  const borderClass = isSummonSelected
                    ? 'border-yellow-300'
                    : deployed
                      ? 'border-cyan-300'
                      : 'border-dashed border-[#6a5b4e]';
                  const displayName = getCardDisplayName(card?.portrait ?? card?.boardImage);
                  const abilityText = getCardAbility(card?.portrait ?? card?.boardImage);
                  const statusLabel = unitAlreadyMoved ? 'Moved' : 'In Play';
                  const statusColor = unitAlreadyMoved ? 'text-gray-400' : 'text-cyan-200';
                  return (
                    <div
                      key={`p2-card-${idx}`}
                      onClick={() => canInteract && handleDeckCardClick('p2', idx)}
                      className={`${cursorClass} ${ringClass} rounded-xl relative flex flex-col items-center group`}
                    >
                      <CardSlot image={card?.portrait} isEmpty={Boolean(card)} bgColor="bg-black" borderColor={borderClass} className={deployed ? 'opacity-85' : ''} />
                      <div className="flex flex-col items-center mt-2 leading-tight">
                        {displayName && (
                          <span className="text-xs font-semibold uppercase tracking-wide text-white">{displayName}</span>
                        )}
                        {deployed && (
                          <span className={`text-[10px] font-bold uppercase tracking-wide ${statusColor}`}>{statusLabel}</span>
                        )}
                      </div>
                      {abilityText && (
                        <div className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <div className="bg-black/90 text-white text-[11px] leading-snug px-3 py-2 rounded-lg shadow-lg max-w-[14rem] text-center">
                            {abilityText}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Board;