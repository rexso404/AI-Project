import React, { useCallback, useEffect, useMemo, useState } from 'react';
import gameData from '../../data.json';
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

const BOARD_IMAGE_ALIAS_MAP = Object.entries({
  ...WHITE_CHARACTER_MAP,
  ...BLACK_CHARACTER_MAP,
}).reduce((acc, [alias, asset]) => {
  acc[asset] = alias;
  return acc;
}, {});

const DUAL_CARD_KEYS = new Set(['ourson', 'vieilours']);
const DUAL_TOKEN_SEQUENCE = ['hermit', 'cub'];
const DUAL_TOKEN_ASSETS = {
  p1: {
    hermit: whiteVieilOurs,
    cub: whiteOurson,
  },
  p2: {
    hermit: blackVieilOurs,
    cub: blackOurson,
  },
};
const FLOAT_TOLERANCE = 0.001;
const BOARD_COMPATIBLE_KEYS = new Set([
  ...Object.keys(WHITE_CHARACTER_MAP),
  ...Object.keys(BLACK_CHARACTER_MAP),
]);
const IMPLEMENTED_ACTIVE_ABILITIES = new Set(['acrobate', 'cavalier', 'manipulatrice']);

const getBoardImageForAlias = (aliasKey, playerKey) => {
  if (!aliasKey || !playerKey) return null;
  const map = playerKey === 'p1' ? WHITE_CHARACTER_MAP : BLACK_CHARACTER_MAP;
  return map[aliasKey] ?? null;
};

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

const LEADER_DISPLAY_NAMES = {
  reine: 'Reine',
  roi: 'Roi',
};

const CHARACTER_ALIAS_MAP = {
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
  ourson: 'Hermit and Cub',
  vieilours: 'Hermit and Cub',
  protecteur: 'Protector',
  rodeuse: 'Wanderer',
  tavernier: 'Brewmaster',
  vizir: 'Vizier',
};

const CHARACTER_DATA_MAP = gameData.characters.reduce((acc, character) => {
  const key = normalizeKey(character.name);
  if (key) acc[key] = character;
  return acc;
}, {});

const getCardDataByAlias = (aliasKey) => {
  if (!aliasKey) return null;
  const canonicalName = CHARACTER_ALIAS_MAP[aliasKey] ?? aliasKey;
  return CHARACTER_DATA_MAP[normalizeKey(canonicalName)] ?? null;
};

const getCardMetaFromPortrait = (portraitUrl) => {
  if (!portraitUrl) return { cardKey: '', abilityType: null, abilityName: '' };
  const cardKey = extractPortraitKey(portraitUrl);
  const cardData = getCardDataByAlias(cardKey);
  return {
    cardKey,
    abilityType: cardData?.type ?? null,
    abilityName: cardData?.name ?? '',
  };
};

const getCardMetaFromAlias = (aliasKey) => {
  if (!aliasKey) return { abilityType: null, abilityName: '' };
  const cardData = getCardDataByAlias(aliasKey);
  return {
    abilityType: cardData?.type ?? null,
    abilityName: cardData?.name ?? '',
  };
};

const isDualCharacter = (cardKey) => DUAL_CARD_KEYS.has(cardKey);

const hydrateDecks = (rawDecks = buildEmptyDecks()) => {
  const hydrated = { p1: [], p2: [] };
  ['p1', 'p2'].forEach((playerKey) => {
    hydrated[playerKey] = DECK_INDEXES.map((idx) => {
      const card = rawDecks?.[playerKey]?.[idx];
      if (!card) return null;
      const portrait = card.portrait ?? card.boardImage ?? '';
      const meta = card.cardKey ? { cardKey: card.cardKey } : getCardMetaFromPortrait(portrait);
      const aliasKey = meta.cardKey || card.cardKey || extractPortraitKey(portrait);
      const resolvedBoardImage = card.boardImage ?? getBoardImageForAlias(aliasKey, playerKey) ?? portrait;
      const aliasMeta = getCardMetaFromAlias(aliasKey);
      return {
        portrait,
        boardImage: resolvedBoardImage,
        boardNodeId: card.boardNodeId ?? null,
        cardKey: aliasKey,
        abilityType: card.abilityType ?? aliasMeta.abilityType,
        abilityName: card.abilityName ?? aliasMeta.abilityName,
        isDual: isDualCharacter(aliasKey),
        placedTokens: card.placedTokens ?? [],
      };
    });
  });
  return hydrated;
};

const getAliasFromBoardImage = (imageSrc) => BOARD_IMAGE_ALIAS_MAP[imageSrc] ?? null;

const sanitizePlacements = (rawPlacements = [], deckSnapshot = buildEmptyDecks()) => rawPlacements.map((piece) => {
  if (!piece) return piece;
  const deckCard = deckSnapshot?.[piece.playerKey]?.[piece.deckIndex];
  const inferredAlias = piece.cardKey
    || deckCard?.cardKey
    || getAliasFromBoardImage(piece.image)
    || extractPortraitKey(piece.portrait ?? '');
  const aliasMeta = getCardMetaFromAlias(inferredAlias);
  return {
    ...piece,
    portrait: piece.portrait ?? deckCard?.portrait ?? null,
    cardKey: inferredAlias,
    abilityType: piece.abilityType ?? deckCard?.abilityType ?? aliasMeta.abilityType,
    abilityName: piece.abilityName ?? deckCard?.abilityName ?? aliasMeta.abilityName,
    tokenId: piece.tokenId ?? null,
  };
});

const buildPlacementRecord = (playerKey, deckIndex, nodeId, decksSnapshot, tokenId = null) => {
  const deckCard = decksSnapshot?.[playerKey]?.[deckIndex];
  if (!deckCard) return null;
  const aliasKey = deckCard.cardKey ?? extractPortraitKey(deckCard.portrait ?? '');
  const aliasMeta = getCardMetaFromAlias(aliasKey);
  const specializedImage = tokenId && DUAL_TOKEN_ASSETS[playerKey]?.[tokenId]
    ? DUAL_TOKEN_ASSETS[playerKey][tokenId]
    : null;
  return {
    nodeId,
    playerKey,
    deckIndex,
    image: specializedImage ?? deckCard.boardImage ?? deckCard.portrait,
    portrait: deckCard.portrait ?? null,
    cardKey: aliasKey,
    abilityType: deckCard.abilityType ?? aliasMeta.abilityType,
    abilityName: deckCard.abilityName ?? aliasMeta.abilityName,
    tokenId: tokenId ?? null,
  };
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

const getCharacterInfo = (imageUrl) => {
  if (!imageUrl) return null;
  const assetKey = extractPortraitKey(imageUrl);
  if (!assetKey) return null;
  const aliasName = CHARACTER_ALIAS_MAP[assetKey];
  if (!aliasName) return null;
  return CHARACTER_DATA_MAP[normalizeKey(aliasName)] ?? null;
};

const getCardDisplayName = (imageUrl) => {
  if (!imageUrl) return '';
  const assetKey = extractPortraitKey(imageUrl);
  if (!assetKey) return '';
  const info = getCharacterInfo(imageUrl);
  if (info?.name) return info.name;
  return LEADER_DISPLAY_NAMES[assetKey] ?? '';
};

const getCardAbility = (imageUrl) => {
  const info = getCharacterInfo(imageUrl);
  return info?.ability ?? '';
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

const drawLeaderReplacement = (currentOptions = [], usedCards = []) => {
  const activeOptions = currentOptions.filter(Boolean);
  const exclusion = Array.from(new Set([...activeOptions, ...usedCards])).filter(Boolean);
  const card = drawPlayableCharacter(exclusion);
  return { card, exhausted: !card };
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
        className={`w-40 h-64 rounded-[30px] border border-white/20 bg-gradient-to-b from-[#1f1f24]/95 via-[#131316]/95 to-[#07070a]/95 backdrop-blur-sm shadow-[0_22px_35px_rgba(0,0,0,0.6)] p-3.5 flex flex-col gap-3 transition-transform ${disabled ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer hover:-translate-y-1.5'}`}
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

const AbilityTooltip = ({ text, placement = 'right' }) => {
  if (!text) return null;

  if (placement === 'top') {
    return (
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 -mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="relative bg-[#fffdf6]/95 text-slate-900 text-[12px] leading-relaxed px-5 py-3 rounded-2xl shadow-[0_12px_25px_rgba(0,0,0,0.35)] border border-[#f0c674] w-72 text-left">
          <p className="whitespace-normal break-words">
            {text}
          </p>
          <span aria-hidden="true" className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-3 h-3 bg-[#fffdf6]/95 border-r border-b border-[#f0c674] rotate-45"></span>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <div className="relative bg-[#fffdf6]/95 text-slate-900 text-[12px] leading-relaxed px-5 py-3 rounded-2xl shadow-[0_12px_25px_rgba(0,0,0,0.35)] border border-[#f0c674] w-72 text-left">
        <p className="whitespace-normal break-words">
          {text}
        </p>
        <span aria-hidden="true" className="absolute -left-2 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#fffdf6]/95 border-l border-t border-[#f0c674] rotate-45"></span>
      </div>
    </div>
  );
};

const Board = () => {
  const nodes = useMemo(() => getBoardNodes(), []);
  const nodeMap = useMemo(() => {
    const map = new Map();
    nodes.forEach(node => {
      map.set(node.id, node);
    });
    return map;
  }, [nodes]);
  const columnNodeMap = useMemo(() => {
    const map = new Map();
    nodes.forEach(node => {
      if (!map.has(node.col)) map.set(node.col, []);
      map.get(node.col).push(node);
    });
    map.forEach(list => list.sort((a, b) => a.row - b.row));
    return map;
  }, [nodes]);
  const rowNodeMap = useMemo(() => {
    const map = new Map();
    nodes.forEach(node => {
      const key = node.y.toFixed(3);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(node);
    });
    map.forEach(list => list.sort((a, b) => a.x - b.x));
    return map;
  }, [nodes]);
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
  const initialDeckState = useMemo(
    () => hydrateDecks(savedGame?.decks ?? buildEmptyDecks()),
    [savedGame]
  );
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
  const [decks, setDecks] = useState(initialDeckState);
  // Cards already placed on the board (besides leaders)
  const [placements, setPlacements] = useState(() => sanitizePlacements(savedGame?.placements ?? [], initialDeckState));
  const [retiredCards, setRetiredCards] = useState(() => savedGame?.retiredCards ?? []);
  // Currently selected summon card to place (may be forced right after pick)
  const [selectedSummon, setSelectedSummon] = useState(() => savedGame?.selectedSummon ?? null);
  const [movementTracker, setMovementTracker] = useState(() => savedGame?.movementTracker ?? createMovementTracker());
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [statusMessage, setStatusMessage] = useState(() => savedGame?.statusMessage ?? '');
  const [gameResult, setGameResult] = useState(() => savedGame?.gameResult ?? null);
  const [abilityContext, setAbilityContext] = useState(null);
  const isGameOver = Boolean(gameResult);

  const hasLeaderMoved = (playerKey) => Boolean(movementTracker[playerKey]?.leader);
  const getUnitMoveKey = (deckIndex, tokenId = null) => (tokenId != null ? `${deckIndex}:${tokenId}` : `${deckIndex}`);
  const hasUnitMoved = (playerKey, deckIndex, tokenId = null) => {
    const key = getUnitMoveKey(deckIndex, tokenId);
    return movementTracker[playerKey]?.units.includes(key);
  };
  const markLeaderMoved = (playerKey) => {
    setMovementTracker((prev) => ({
      ...prev,
      [playerKey]: { ...prev[playerKey], leader: true },
    }));
  };
  const markUnitMoved = (playerKey, deckIndex, tokenId = null) => {
    setMovementTracker((prev) => {
      const key = getUnitMoveKey(deckIndex, tokenId);
      const existing = prev[playerKey]?.units ?? [];
      if (existing.includes(key)) return prev;
      return {
        ...prev,
        [playerKey]: {
          ...prev[playerKey],
          units: [...existing, key],
        },
      };
    });
  };
  const resetMovementTracker = () => setMovementTracker(createMovementTracker());
  const isPlayerDeckFull = (playerKey) => decks[playerKey].every(Boolean);
  const bothDecksFull = isPlayerDeckFull('p1') && isPlayerDeckFull('p2');
  const boardShiftClass = '-translate-x-48';
  const playerDeckShiftClass = bothDecksFull ? '-translate-x-12' : '';

  // Game Leaders Logic (P1 vs P2)
  const [gameLeaders, setGameLeaders] = useState(() => initialGameLeaderData.leaders);

  const handleLeaderError = (index) => {
    console.warn(`Leader at index ${index} failed to load. Retrying with a new character...`);
    let poolExhausted = false;
    setLeaders(prevLeaders => {
      const newLeaders = [...prevLeaders];
      newLeaders[index] = null;
      const { card: replacement, exhausted } = drawLeaderReplacement(newLeaders, retiredCards);
      poolExhausted = exhausted;
      newLeaders[index] = replacement;
      return newLeaders;
    });
    if (poolExhausted) {
      setStatusMessage('All champions recruited; no further characters available.');
    }
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
      statusMessage,
      gameResult,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [leaders, currentTurn, leadersPositions, canPickFor, decks, placements, retiredCards, selectedSummon, movementTracker, gameLeaders, statusMessage, gameResult]);

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
    setDecks(hydrateDecks(buildEmptyDecks()));
    setPlacements([]);
    setRetiredCards([]);
    setSelectedSummon(null);
    resetMovementTracker();
    setSelectedUnit(null);
    setGameLeaders(freshGameLeaders);
    setStatusMessage('');
    setGameResult(null);
    setAbilityContext(null);
  };

  const ensureLeaderSupply = useCallback(() => {
    let poolExhausted = false;
    setLeaders(prev => {
      if (prev.every(Boolean)) return prev;
      const next = [...prev];
      let modified = false;

      next.forEach((slot, idx) => {
        if (!slot) {
          const { card, exhausted } = drawLeaderReplacement(next, retiredCards);
          if (card) {
            next[idx] = card;
            modified = true;
          }
          poolExhausted = poolExhausted || exhausted;
        }
      });

      return modified ? next : prev;
    });
    if (poolExhausted) {
      setStatusMessage('All champions recruited; no further characters available.');
    }
  }, [retiredCards]);

  useEffect(() => {
    if (leaders.some(card => !card)) {
      ensureLeaderSupply();
    }
  }, [leaders, ensureLeaderSupply]);

  const isAbilitySilencedByJailer = (piece, placementsState = placements) => {
    if (!piece) return false;
    const enemyKey = piece.playerKey === 'p1' ? 'p2' : 'p1';
    const adjacentIds = getAdjacentNodeIds(piece.nodeId);
    return placementsState.some(unit => unit.playerKey === enemyKey && unit.cardKey === 'geolier' && adjacentIds.includes(unit.nodeId));
  };

  const findNodeByCoordinates = (targetX, targetY) => nodes.find((node) =>
    Math.abs(node.x - targetX) <= FLOAT_TOLERANCE && Math.abs(node.y - targetY) <= FLOAT_TOLERANCE
  ) ?? null;

  const getAbilityPieceInstance = (context, placementsState = placements) => {
    if (!context) return null;
    return placementsState.find(piece =>
      piece.playerKey === context.playerKey &&
      piece.deckIndex === context.deckIndex &&
      (context.tokenId == null || piece.tokenId === context.tokenId)
    ) ?? null;
  };

  const getAcrobatLandingOptions = (originNodeId, placementsState = placements, leaderPositionsState = leadersPositions) => {
    const originNode = nodeMap.get(originNodeId);
    if (!originNode) return [];
    const adjacentIds = getAdjacentNodeIds(originNodeId);
    return adjacentIds.reduce((acc, neighborId) => {
      const occupant = getNodeOccupant(neighborId, leaderPositionsState, placementsState);
      if (!occupant) return acc;
      const neighborNode = nodeMap.get(neighborId);
      if (!neighborNode) return acc;
      const deltaX = neighborNode.x - originNode.x;
      const deltaY = neighborNode.y - originNode.y;
      if (Math.abs(deltaX) <= FLOAT_TOLERANCE && Math.abs(deltaY) <= FLOAT_TOLERANCE) return acc;
      const landingNode = findNodeByCoordinates(neighborNode.x + deltaX, neighborNode.y + deltaY);
      if (!landingNode) return acc;
      if (!isNodeEmpty(landingNode.id, placementsState, leaderPositionsState)) return acc;
      acc.push({ nodeId: landingNode.id, overNodeId: neighborId });
      return acc;
    }, []);
  };

  const initializeAcrobatAbility = (piece, deckCard) => {
    const landingOptions = getAcrobatLandingOptions(piece.nodeId);
    if (!landingOptions.length) {
      setStatusMessage('No adjacent characters to jump over.');
      return null;
    }

    setStatusMessage('Select a highlighted space to complete the Acrobat jump.');
    return {
      id: piece.cardKey,
      abilityName: deckCard?.abilityName ?? piece.abilityName ?? getCardDisplayName(piece.portrait ?? ''),
      playerKey: piece.playerKey,
      playerLabel: playerKeyToLabel(piece.playerKey),
      deckIndex: piece.deckIndex,
      tokenId: piece.tokenId ?? null,
      originNodeId: piece.nodeId,
      phase: 'acrobat-select',
      highlightNodes: landingOptions.map(option => option.nodeId),
      data: {
        remainingJumps: 2,
        landingOptions,
        hasProgress: false,
      },
    };
  };

  const getRiderLandingOptions = (originNodeId, placementsState = placements, leaderPositionsState = leadersPositions) => {
    const originNode = nodeMap.get(originNodeId);
    if (!originNode) return [];
    const adjacentIds = getAdjacentNodeIds(originNodeId);
    const destinations = new Set();

    adjacentIds.forEach(stepNodeId => {
      const stepNode = nodeMap.get(stepNodeId);
      if (!stepNode) return;
      if (!isNodeEmpty(stepNodeId, placementsState, leaderPositionsState)) return;
      const deltaX = stepNode.x - originNode.x;
      const deltaY = stepNode.y - originNode.y;
      if (Math.abs(deltaX) <= FLOAT_TOLERANCE && Math.abs(deltaY) <= FLOAT_TOLERANCE) return;
      const landingNode = findNodeByCoordinates(stepNode.x + deltaX, stepNode.y + deltaY);
      if (!landingNode) return;
      if (!isNodeEmpty(landingNode.id, placementsState, leaderPositionsState)) return;
      destinations.add(landingNode.id);
    });

    return Array.from(destinations);
  };

  const initializeRiderAbility = (piece, deckCard) => {
    const landingNodes = getRiderLandingOptions(piece.nodeId);
    if (!landingNodes.length) {
      setStatusMessage('No straight path available for the Rider to move two spaces.');
      return null;
    }

    setStatusMessage('Select a highlighted space exactly two nodes away.');
    return {
      id: piece.cardKey,
      abilityName: deckCard?.abilityName ?? piece.abilityName ?? getCardDisplayName(piece.portrait ?? ''),
      playerKey: piece.playerKey,
      playerLabel: playerKeyToLabel(piece.playerKey),
      deckIndex: piece.deckIndex,
      tokenId: piece.tokenId ?? null,
      originNodeId: piece.nodeId,
      phase: 'rider-select',
      highlightNodes: landingNodes,
      data: {
        hasProgress: false,
      },
    };
  };

  const initializeManipulatorAbility = (piece, deckCard) => {
    const originNode = nodeMap.get(piece.nodeId);
    if (!originNode) return null;

    const enemyKey = piece.playerKey === 'p1' ? 'p2' : 'p1';
    const inLineEnemies = placements.filter(unit => {
      if (unit.playerKey !== enemyKey) return false;
      const targetNode = nodeMap.get(unit.nodeId);
      if (!targetNode) return false;

      const sameCol = Math.abs(targetNode.x - originNode.x) <= FLOAT_TOLERANCE;
      const sameRow = Math.abs(targetNode.y - originNode.y) <= FLOAT_TOLERANCE;
      if (!sameCol && !sameRow) return false;

      const dx = targetNode.x - originNode.x;
      const dy = targetNode.y - originNode.y;
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) return false; // must be non-adjacent

      const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
      const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;

      let currentX = originNode.x + stepX;
      let currentY = originNode.y + stepY;
      while (Math.abs(currentX - targetNode.x) > FLOAT_TOLERANCE || Math.abs(currentY - targetNode.y) > FLOAT_TOLERANCE) {
        const blocker = findNodeByCoordinates(currentX, currentY);
        if (blocker) {
          const occ = getNodeOccupant(blocker.id, leadersPositions, placements);
          if (occ) return false;
        }
        currentX += stepX;
        currentY += stepY;
      }
      return true;
    });

    if (!inLineEnemies.length) {
      setStatusMessage('Tidak ada musuh non-adjacent yang terlihat dalam garis lurus.');
      return null;
    }

    const highlightNodes = inLineEnemies.map(unit => unit.nodeId);
    setStatusMessage('Pilih satu musuh yang disorot, lalu pilih petak di sekitarnya.');
    return {
      id: piece.cardKey,
      abilityName: deckCard?.abilityName ?? piece.abilityName ?? getCardDisplayName(piece.portrait ?? ''),
      playerKey: piece.playerKey,
      playerLabel: playerKeyToLabel(piece.playerKey),
      deckIndex: piece.deckIndex,
      tokenId: piece.tokenId ?? null,
      originNodeId: piece.nodeId,
      phase: 'manipulator-select-target',
      highlightNodes,
      data: {
        hasProgress: false,
        targets: inLineEnemies.map(unit => ({
          nodeId: unit.nodeId,
          playerKey: unit.playerKey,
          deckIndex: unit.deckIndex,
          tokenId: unit.tokenId ?? null,
        })),
      },
    };
  };

  const concludeAbilityUsage = (placementsState, message) => {
    if (!abilityContext) return;
    const abilityMeta = abilityContext;
    setAbilityContext(null);
    markUnitMoved(abilityMeta.playerKey, abilityMeta.deckIndex, abilityMeta.tokenId ?? null);
    setSelectedUnit(null);
    setSelectedNode(null);
    setStatusMessage(message ?? `${abilityMeta.abilityName} ability resolved.`);
    finalizeActionOutcome(placementsState, leadersPositions);
  };

  const executeAcrobatJump = (targetNodeId) => {
    if (!abilityContext) return;
    const { data } = abilityContext;
    const option = data?.landingOptions?.find(opt => opt.nodeId === targetNodeId);
    if (!option) {
      setStatusMessage('Invalid target for the Acrobat.');
      return;
    }

    const activePiece = getAbilityPieceInstance(abilityContext);
    if (!activePiece) {
      setAbilityContext(null);
      setStatusMessage('Selected unit is no longer available.');
      return;
    }

    const updatedPlacements = placements.map(piece => {
      if (piece.playerKey === activePiece.playerKey && piece.deckIndex === activePiece.deckIndex && (activePiece.tokenId == null || piece.tokenId === activePiece.tokenId)) {
        return { ...piece, nodeId: targetNodeId };
      }
      return piece;
    });

    setPlacements(updatedPlacements);
    setDecks(prevDecks => ({
      ...prevDecks,
      [abilityContext.playerKey]: prevDecks[abilityContext.playerKey].map((card, idx) => {
        if (idx !== abilityContext.deckIndex || !card) return card;
        if (card.isDual) return card;
        return { ...card, boardNodeId: targetNodeId };
      }),
    }));

    const remainingJumps = Math.max(0, (data?.remainingJumps ?? 1) - 1);
    const nextOptions = remainingJumps > 0
      ? getAcrobatLandingOptions(targetNodeId, updatedPlacements, leadersPositions)
      : [];

    if (remainingJumps > 0 && nextOptions.length) {
      setAbilityContext({
        ...abilityContext,
        originNodeId: targetNodeId,
        highlightNodes: nextOptions.map(opt => opt.nodeId),
        data: {
          remainingJumps,
          landingOptions: nextOptions,
          hasProgress: true,
        },
      });
      setStatusMessage('Acrobat may jump again. Select another highlighted space or cancel to finish.');
      return;
    }

    concludeAbilityUsage(updatedPlacements, 'Acrobat completes the jump.');
  };

  const executeRiderDash = (targetNodeId) => {
    if (!abilityContext) return;
    const activePiece = getAbilityPieceInstance(abilityContext);
    if (!activePiece) {
      setAbilityContext(null);
      setStatusMessage('Selected unit is no longer available.');
      return;
    }

    if (!abilityContext.highlightNodes?.includes(targetNodeId)) {
      setStatusMessage('Select one of the highlighted destinations.');
      return;
    }

    const updatedPlacements = placements.map(piece => {
      if (piece.playerKey === activePiece.playerKey && piece.deckIndex === activePiece.deckIndex && (activePiece.tokenId == null || piece.tokenId === activePiece.tokenId)) {
        return { ...piece, nodeId: targetNodeId };
      }
      return piece;
    });

    setPlacements(updatedPlacements);
    setDecks(prevDecks => ({
      ...prevDecks,
      [abilityContext.playerKey]: prevDecks[abilityContext.playerKey].map((card, idx) => {
        if (idx !== abilityContext.deckIndex || !card) return card;
        if (card.isDual) return card;
        return { ...card, boardNodeId: targetNodeId };
      }),
    }));

    concludeAbilityUsage(updatedPlacements, 'Rider charges forward.');
  };

  const startAbilityForPiece = (piece) => {
    if (!piece || isGameOver || selectedSummon?.forced || abilityContext) return;
    if (hasUnitMoved(piece.playerKey, piece.deckIndex, piece.tokenId)) return;
    const deckCard = decks[piece.playerKey]?.[piece.deckIndex];
    const abilityType = deckCard?.abilityType ?? piece.abilityType;
    if (abilityType !== 'active') return;
    if (isAbilitySilencedByJailer(piece)) {
      setStatusMessage('Ability cannot be used while adjacent to an enemy Jailer.');
      return;
    }
    if (!IMPLEMENTED_ACTIVE_ABILITIES.has(piece.cardKey)) {
      setStatusMessage('This ability is not available yet.');
      return;
    }
    setSelectedLeader(null);
    setSelectedUnit(null);
    if (piece.cardKey === 'acrobate') {
      const initialized = initializeAcrobatAbility(piece, deckCard);
      if (!initialized) return;
      setAbilityContext(initialized);
      return;
    }
    if (piece.cardKey === 'cavalier') {
      const initialized = initializeRiderAbility(piece, deckCard);
      if (!initialized) return;
      setAbilityContext(initialized);
      return;
    }
    if (piece.cardKey === 'manipulatrice') {
      const initialized = initializeManipulatorAbility(piece, deckCard);
      if (!initialized) return;
      setAbilityContext(initialized);
      return;
    }
    setStatusMessage('Ability interactions are being prepared.');
  };

  const cancelAbilityContext = () => {
    if (!abilityContext) return;
    if (abilityContext.data?.hasProgress) {
      concludeAbilityUsage(placements, `${abilityContext.abilityName} ability resolved.`);
      return;
    }
    setAbilityContext(null);
    setStatusMessage('Ability cancelled.');
  };

  useEffect(() => {
    if (!abilityContext) return;
    const stillExists = placements.some(p => p.playerKey === abilityContext.playerKey && p.deckIndex === abilityContext.deckIndex && (abilityContext.tokenId == null || p.tokenId === abilityContext.tokenId));
    if (!stillExists || abilityContext.playerLabel !== currentTurn || isGameOver) {
      setAbilityContext(null);
    }
  }, [abilityContext, placements, currentTurn, isGameOver]);

  useEffect(() => {
    if (!abilityContext) return;
    if (selectedSummon?.forced) {
      setAbilityContext(null);
    }
  }, [selectedSummon, abilityContext]);

  const handleAbilityNodeInteraction = (node) => {
    if (!abilityContext || !node) return;
    if (abilityContext.highlightNodes?.length && !abilityContext.highlightNodes.includes(node.id)) {
      setStatusMessage('Select a highlighted space to resolve this ability.');
      return;
    }

    if (abilityContext.id === 'acrobate') {
      executeAcrobatJump(node.id);
      return;
    }
    if (abilityContext.id === 'cavalier') {
      executeRiderDash(node.id);
      return;
    }
    if (abilityContext.id === 'manipulatrice') {
      const activePiece = getAbilityPieceInstance(abilityContext);
      if (!activePiece) {
        setAbilityContext(null);
        setStatusMessage('Selected unit is no longer available.');
        return;
      }

      // Tahap 1: pilih target musuh yang se-garis
      if (abilityContext.phase === 'manipulator-select-target') {
        const targetPlacement = placements.find(p =>
          p.nodeId === node.id && p.playerKey !== activePiece.playerKey
        );
        if (!targetPlacement) {
          setStatusMessage('Pilih satu musuh yang disorot sebagai target.');
          return;
        }

        const targetNode = nodes.find(n => n.id === targetPlacement.nodeId);
        if (!targetNode) {
          setAbilityContext(null);
          return;
        }

        // Cari semua petak 1 langkah di sekitar target yang kosong
        const candidateIds = getAdjacentNodeIds(targetNode.id);
        const movableNodes = candidateIds.filter(id => isNodeEmpty(id));

        if (!movableNodes.length) {
          setStatusMessage('Sekitar target penuh, pilih musuh lain.');
          return;
        }

        setAbilityContext({
          ...abilityContext,
          phase: 'manipulator-select-destination',
          highlightNodes: movableNodes,
          data: {
            ...abilityContext.data,
            hasProgress: true,
            selectedTarget: {
              nodeId: targetPlacement.nodeId,
              playerKey: targetPlacement.playerKey,
              deckIndex: targetPlacement.deckIndex,
              tokenId: targetPlacement.tokenId ?? null,
            },
          },
        });
        setStatusMessage('Pilih petak kosong di sekitar target untuk memindahkannya.');
        return;
      }

      // Tahap 2: pilih petak tujuan di sekitar target
      if (abilityContext.phase === 'manipulator-select-destination') {
        const selected = abilityContext.data?.selectedTarget;
        if (!selected) {
          setAbilityContext(null);
          setStatusMessage('Target tidak lagi tersedia.');
          return;
        }

        if (!abilityContext.highlightNodes?.includes(node.id)) {
          setStatusMessage('Pilih salah satu petak yang disorot.');
          return;
        }

        const targetPlacement = placements.find(p =>
          p.nodeId === selected.nodeId &&
          p.playerKey === selected.playerKey &&
          p.deckIndex === selected.deckIndex &&
          (selected.tokenId == null || p.tokenId === selected.tokenId)
        );
        if (!targetPlacement) {
          setAbilityContext(null);
          setStatusMessage('Musuh tersebut sudah tidak ada.');
          return;
        }

        if (!isNodeEmpty(node.id)) {
          setStatusMessage('Petak ini sudah terisi. Pilih petak lain.');
          return;
        }

        const updatedPlacements = placements.map(p =>
          p === targetPlacement ? { ...p, nodeId: node.id } : p
        );

        setPlacements(updatedPlacements);
        setDecks(prev => ({
          ...prev,
          [targetPlacement.playerKey]: prev[targetPlacement.playerKey].map((card, idx) => {
            if (idx !== targetPlacement.deckIndex || !card) return card;
            if (card.isDual) return card;
            return { ...card, boardNodeId: node.id };
          }),
        }));

        concludeAbilityUsage(updatedPlacements, 'Manipulator memindahkan musuh satu petak.');
        return;
      }

      // Fallback jika phase tidak dikenal
      setStatusMessage('Ability Manipulator dibatalkan.');
      setAbilityContext(null);
      return;
    }

    setStatusMessage('This ability is not implemented yet.');
    setAbilityContext(null);
  };

        const getPlayerPieceCount = (playerKey) => placements.filter(piece => piece.playerKey === playerKey).length;

        const handlePostMove = (playerLabel) => {
          if (isGameOver) return;
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
          if (isGameOver) return;
          setCurrentTurn(prev => prev === 'Player 1' ? 'Player 2' : 'Player 1');
          setSelectedLeader(null);
          setSelectedUnit(null);
          setSelectedNode(null);
          setCanPickFor(null);
          setSelectedSummon(null);
          resetMovementTracker();
          setStatusMessage('');
        };

        const endPhase = () => {
          if (isGameOver) return;
          if (selectedSummon?.forced) return; // cannot change phase while forced placement is pending
          handlePostMove(currentTurn);
        };

        const isNodeEmpty = (nodeId, placementsState = placements, leaderPositionsState = leadersPositions) => {
          if (leaderPositionsState.p1 === nodeId || leaderPositionsState.p2 === nodeId) return false;
          return !placementsState.some(piece => piece.nodeId === nodeId);
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

        const getAdjacentNodeIds = (nodeId) => {
          const target = nodes.find(n => n.id === nodeId);
          if (!target) return [];
          return nodes
            .filter(n => {
              const dx = Math.abs(n.x - target.x);
              const dy = Math.abs(n.y - target.y);
              return (dx > 0 || dy > 0) && dx <= 1 && dy <= 1;
            })
            .map(n => n.id);
        };

        const getNodeOccupant = (nodeId, leaderPositionsState = leadersPositions, placementsState = placements) => {
          if (leaderPositionsState.p1 === nodeId) return { type: 'leader', playerKey: 'p1' };
          if (leaderPositionsState.p2 === nodeId) return { type: 'leader', playerKey: 'p2' };
          const unit = placementsState.find(piece => piece.nodeId === nodeId);
          return unit ? { ...unit, type: 'unit' } : null;
        };

        const evaluateLeaderState = (playerKey, placementsState = placements, leaderPositionsState = leadersPositions) => {
          const leaderNodeId = leaderPositionsState[playerKey];
          const adjacentIds = getAdjacentNodeIds(leaderNodeId);
          const enemyKey = playerKey === 'p1' ? 'p2' : 'p1';
          let enemyCount = 0;
          let allOccupied = adjacentIds.length > 0;

          adjacentIds.forEach(id => {
            const occupant = getNodeOccupant(id, leaderPositionsState, placementsState);
            if (!occupant) {
              allOccupied = false;
            } else if (occupant.playerKey === enemyKey && occupant.type !== 'leader') {
              enemyCount += 1;
            }
          });

          return {
            captured: enemyCount >= 2,
            surrounded: allOccupied,
          };
        };

        const wouldTrapSelf = (playerKey, placementsState, leaderPositionsState) => {
          const status = evaluateLeaderState(playerKey, placementsState, leaderPositionsState);
          return status.captured || status.surrounded;
        };

        const determineGameOutcome = (placementsState = placements, leaderPositionsState = leadersPositions) => {
          const p1Status = evaluateLeaderState('p1', placementsState, leaderPositionsState);
          if (p1Status.captured || p1Status.surrounded) {
            return {
              winner: playerKeyToLabel('p2'),
              loser: playerKeyToLabel('p1'),
              reason: p1Status.captured ? 'capture' : 'surround',
            };
          }

          const p2Status = evaluateLeaderState('p2', placementsState, leaderPositionsState);
          if (p2Status.captured || p2Status.surrounded) {
            return {
              winner: playerKeyToLabel('p1'),
              loser: playerKeyToLabel('p2'),
              reason: p2Status.captured ? 'capture' : 'surround',
            };
          }

          return null;
        };

        const finalizeActionOutcome = (placementsState, leaderPositionsState) => {
          const outcome = determineGameOutcome(placementsState, leaderPositionsState);
          if (outcome) {
            setGameResult(outcome);
            setStatusMessage('');
            setSelectedLeader(null);
            setSelectedUnit(null);
            setSelectedSummon(null);
            setCanPickFor(null);
            return true;
          }
          return false;
        };

        const handleNodeClick = (node, image) => {
          if (isGameOver) return;
          if (abilityContext) {
            handleAbilityNodeInteraction(node);
            return;
          }
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
            if (hasUnitMoved(currentPlayerKey, clickedUnit.deckIndex, clickedUnit.tokenId)) {
              return;
            }
            if (selectedUnit && selectedUnit.deckIndex === clickedUnit.deckIndex && selectedUnit.tokenId === clickedUnit.tokenId) {
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
              const leaderKey = selectedLeader.playerKey;
              const nextPositions = {
                ...leadersPositions,
                [leaderKey]: toNode,
              };

              if (wouldTrapSelf(leaderKey, placements, nextPositions)) {
                setStatusMessage('You cannot move your leader into capture or surround range.');
                return;
              }

              setLeadersPositions(nextPositions);
              setStatusMessage('');
              setSelectedLeader(null);
              setSelectedNode(null);
              markLeaderMoved(leaderKey);
              if (finalizeActionOutcome(placements, nextPositions)) {
                return;
              }
            }
            return;
          }

          if (selectedUnit) {
            const fromNode = selectedUnit.nodeId;
            const toNode = nodeId;
            if (isNodeEmpty(toNode) && isWithinMoveRange(fromNode, toNode)) {
              const playerKey = selectedUnit.playerKey;
              const nextPlacements = placements.map(piece => {
                if (piece.playerKey === playerKey && piece.deckIndex === selectedUnit.deckIndex) {
                  return { ...piece, nodeId: toNode };
                }
                return piece;
              });
              if (wouldTrapSelf(playerKey, nextPlacements, leadersPositions)) {
                setStatusMessage('Moving that unit would trap your own leader.');
                return;
              }

              const updatedDeck = decks[playerKey].map((card, idx) => {
                if (idx !== selectedUnit.deckIndex || !card) return card;
                if (card.isDual) return card;
                return { ...card, boardNodeId: toNode };
              });

              const nextDecks = { ...decks, [playerKey]: updatedDeck };

              setPlacements(nextPlacements);
              setDecks(nextDecks);
              setStatusMessage('');
              setSelectedUnit(null);
              setSelectedNode(null);
              markUnitMoved(playerKey, selectedUnit.deckIndex);
              finalizeActionOutcome(nextPlacements, leadersPositions);
            }
            return;
          }
        };

        const handlePickCard = (index) => {
          if (isGameOver) return;
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
          const cardKey = extractPortraitKey(card);
          const cardInfo = getCardMetaFromAlias(cardKey);
          const isDual = isDualCharacter(cardKey);
          const emptySlot = decks[playerKey].findIndex(slot => !slot);
          if (emptySlot === -1) {
            console.warn('No empty deck slot available.');
            setCanPickFor(null);
            toggleTurn();
            return;
          }

          const updatedRetired = retiredCards.includes(card) ? retiredCards : [...retiredCards, card];
          const cardData = {
            portrait: card,
            boardImage,
            boardNodeId: null,
            cardKey,
            abilityType: cardInfo.abilityType,
            abilityName: cardInfo.abilityName,
            isDual,
            placedTokens: [],
          };
          setDecks((prev) => {
            const next = { ...prev };
            next[playerKey] = next[playerKey].map((slot, idx) => (idx === emptySlot ? cardData : slot));
            return next;
          });

          let poolExhausted = false;
          setLeaders(prev => {
            const next = [...prev];
            next[index] = null;
            const { card: replacement, exhausted } = drawLeaderReplacement(next, updatedRetired);
            poolExhausted = exhausted;
            next[index] = replacement;
            return next;
          });

          setRetiredCards(updatedRetired);
          if (poolExhausted) {
            setStatusMessage('All champions recruited; no further characters available.');
          }

          setSelectedSummon({
            player: canPickFor,
            playerKey,
            cardIndex: emptySlot,
            image: boardImage,
            forced: true,
            pendingTokens: isDual ? [...DUAL_TOKEN_SEQUENCE] : null,
          });

          setCanPickFor(null);
        };

        const attemptPlacement = (node) => {
          if (isGameOver) return;
          if (!selectedSummon || !node) return;
          const { playerKey, cardIndex, pendingTokens } = selectedSummon;
          const playerLabel = playerKeyToLabel(playerKey);

          if (currentTurn !== playerLabel) return;
          if (!isValidPlacementNode(playerKey, node)) return;
          if (!isNodeEmpty(node.id)) return;
          const tokenQueue = pendingTokens ? [...pendingTokens] : null;
          const tokenId = tokenQueue?.length ? tokenQueue[0] : null;
          const nextPlacementRecord = buildPlacementRecord(playerKey, cardIndex, node.id, decks, tokenId);
          if (!nextPlacementRecord) {
            console.warn('Failed to build placement record for summon.');
            return;
          }

          const nextPlacements = [...placements, nextPlacementRecord];

          if (wouldTrapSelf(playerKey, nextPlacements, leadersPositions)) {
            setStatusMessage('This placement would trap your own leader. Choose another spot.');
            return;
          }

          const nextDecks = {
            ...decks,
            [playerKey]: decks[playerKey].map((card, idx) => {
              if (idx !== cardIndex || !card) return card;
              if (card.isDual) {
                const placedTokens = Array.from(new Set([...(card.placedTokens ?? []), tokenId].filter(Boolean)));
                return { ...card, placedTokens };
              }
              return { ...card, boardNodeId: node.id };
            })
          };

          setPlacements(nextPlacements);
          setDecks(nextDecks);
          if (tokenQueue && tokenQueue.length > 1) {
            tokenQueue.shift();
            setSelectedSummon({
              ...selectedSummon,
              pendingTokens: tokenQueue,
            });
          } else {
            setSelectedSummon(null);
          }
          setStatusMessage('');
          if (finalizeActionOutcome(nextPlacements, leadersPositions)) {
            return;
          }
          toggleTurn();
        };

        const handleDeckCardClick = (playerKey, cardIndex) => {
          if (isGameOver) return;
          if (selectedSummon?.forced) return; // must resolve forced placement first
          const card = decks[playerKey][cardIndex];
          if (!card) return;
          const playerLabel = playerKeyToLabel(playerKey);
          if (currentTurn !== playerLabel) return;

          const placedUnits = placements.filter(p => p.playerKey === playerKey && p.deckIndex === cardIndex);
          const isDual = Boolean(card?.isDual);

          // If the card is already deployed (has a boardNodeId), allow selecting its on-board unit
          if ((card.boardNodeId && !isDual) || (isDual && placedUnits.length > 0)) {
            const placed = placedUnits[0];
            if (selectedSummon || canPickFor || hasUnitMoved(playerKey, cardIndex, placed?.tokenId ?? null)) return;
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
          const pendingTokens = isDual
            ? DUAL_TOKEN_SEQUENCE.filter(token => !(card.placedTokens ?? []).includes(token))
            : null;
          const requiresMultiPlacement = Boolean(pendingTokens && pendingTokens.length);
          setSelectedSummon({
            player: playerLabel,
            playerKey,
            cardIndex,
            image: card.boardImage,
            forced: requiresMultiPlacement,
            pendingTokens: requiresMultiPlacement ? pendingTokens : null,
          });
        };

        const isWithinHighlight = (node) => {
          if (!selectedNode) return false;
          const dx = Math.abs(node.x - selectedNode.x);
          const dy = Math.abs(node.y - selectedNode.y);
          return dx <= 1 && dy <= 1;
        };

  const phaseInfo = useMemo(() => {
    if (isGameOver) {
      return {
        label: 'Game Over',
        description: gameResult
          ? `${gameResult.winner} wins by ${gameResult.reason === 'capture' ? 'capture' : 'surround'}.`
          : 'Victory resolved.'
      };
    }
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
  }, [selectedSummon, canPickFor, isGameOver, gameResult]);

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
          {abilityContext && (
            <button
              onClick={cancelAbilityContext}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-5 rounded shadow"
            >
              Cancel Ability
            </button>
          )}
          <button
            onClick={() => endPhase()}
            disabled={selectedSummon?.forced}
            className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded shadow transition-colors ${selectedSummon?.forced ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            End Phase
          </button>
        </div>
      </div>

      {!isGameOver && statusMessage && (
        <div className="w-full bg-amber-100 text-amber-900 text-center font-semibold py-2 shadow-inner z-40">
          {statusMessage}
        </div>
      )}

      <div className="flex-1 flex items-center justify-between p-8 relative w-full">
      {/* Left Side - Deck & Slots */}
      <div className="flex items-center gap-4 z-10">
        {/* Deck Column */}
        <div className="flex flex-col justify-center gap-4">
           <CardSlot label="DECK" isDeck />
        </div>
        
          {/* 3 Vertical Slots */}
          <div className="flex flex-col gap-5">
              {[0,1,2].map(i => {
                const image = leaders[i];
                const isClickable = Boolean(canPickFor && currentTurn === canPickFor && image && !bothDecksFull);
                const displayName = getCardDisplayName(image);
                const abilityText = getCardAbility(image);
                return (
                  <RecruitOptionCard
                    key={`left-card-${i}`}
                    image={image}
                    name={displayName}
                    ability={abilityText}
                    disabled={!isClickable}
                    onClick={() => handlePickCard(i)}
                    onError={() => handleLeaderError(i)}
                  />
                );
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
                  let occupantPlayerKey = null;
                  let occupantType = null;
                  const placedPiece = placements.find(piece => piece.nodeId === node.id);
                  if (node.id === leadersPositions.p1) {
                    nodeImage = gameLeaders.p1.boardImage;
                    occupantPlayerKey = 'p1';
                    occupantType = 'leader';
                  } else if (node.id === leadersPositions.p2) {
                    nodeImage = gameLeaders.p2.boardImage;
                    occupantPlayerKey = 'p2';
                    occupantType = 'leader';
                  } else if (placedPiece) {
                    nodeImage = placedPiece.image;
                    occupantPlayerKey = placedPiece.playerKey;
                    occupantType = 'unit';
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

                  const abilityHighlightActive = abilityContext?.highlightNodes?.includes(node.id);
                  const opacityClass = canMoveHere ? 'opacity-40 grayscale contrast-75' : 'opacity-100';
                  const selectionRingClass = isCenter ? 'ring-4 ring-yellow-300 ring-offset-2 ring-offset-black shadow-[0_0_20px_rgba(255,215,0,0.5)]' : '';
                  const abilityRingClass = abilityHighlightActive ? 'ring-4 ring-purple-400 ring-offset-2 ring-offset-black animate-pulse' : '';
                  const ringClass = `${selectionRingClass} ${abilityRingClass}`.trim();
                  const haloClass = canMoveHere ? 'bg-yellow-200/25 shadow-[0_0_18px_rgba(255,215,0,0.75)]' : '';
                  const hoverClass = nodeImage ? 'hover:bg-white/10' : 'hover:bg-white/20';

                  const pieceDeckCard = placedPiece ? decks[placedPiece.playerKey]?.[placedPiece.deckIndex] : null;
                  const abilityType = pieceDeckCard?.abilityType ?? placedPiece?.abilityType;
                  const isCurrentPlayersPiece = occupantPlayerKey && playerKeyToLabel(occupantPlayerKey) === currentTurn;
                  const abilityAvailable = Boolean(
                    abilityType === 'active' &&
                    occupantType === 'unit' &&
                    IMPLEMENTED_ACTIVE_ABILITIES.has(placedPiece?.cardKey) &&
                    isCurrentPlayersPiece &&
                    !selectedSummon?.forced &&
                    !abilityContext &&
                    !hasUnitMoved(occupantPlayerKey, placedPiece?.deckIndex ?? null, placedPiece?.tokenId ?? null) &&
                    !isAbilitySilencedByJailer(placedPiece)
                  );

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
                      {abilityAvailable && placedPiece && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            startAbilityForPiece(placedPiece);
                          }}
                          className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-purple-600 text-white text-xs font-bold shadow-lg border border-white/40 hover:bg-purple-500"
                          title="Activate ability"
                        >
                          ⚡
                        </button>
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
                  const cardPlacements = placements.filter(p => p.playerKey === 'p1' && p.deckIndex === idx);
                  const deployed = cardPlacements.length > 0;
                  const isSummonSelected = selectedSummon && selectedSummon.playerKey === 'p1' && selectedSummon.cardIndex === idx;
                  const isUnitSelected = selectedUnit && selectedUnit.playerKey === 'p1' && selectedUnit.deckIndex === idx;
                  const unitAlreadyMoved = deployed && cardPlacements.every(p => hasUnitMoved('p1', idx, p.tokenId ?? null));
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
                      <AbilityTooltip text={abilityText} placement="top" />
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
                  const cardPlacements = placements.filter(p => p.playerKey === 'p2' && p.deckIndex === idx);
                  const deployed = cardPlacements.length > 0;
                  const isSummonSelected = selectedSummon && selectedSummon.playerKey === 'p2' && selectedSummon.cardIndex === idx;
                  const isUnitSelected = selectedUnit && selectedUnit.playerKey === 'p2' && selectedUnit.deckIndex === idx;
                  const unitAlreadyMoved = deployed && cardPlacements.every(p => hasUnitMoved('p2', idx, p.tokenId ?? null));
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
                      <AbilityTooltip text={abilityText} placement="top" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {gameResult && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center px-6" style={{ zIndex: 60 }}>
          <div className="bg-white/95 rounded-2xl shadow-2xl px-10 py-8 text-center max-w-lg">
            <p className="text-3xl font-bold text-gray-900 mb-2">{gameResult.winner} Wins!</p>
            <p className="text-lg text-gray-700 mb-6">
              Victory by {gameResult.reason === 'capture' ? 'leader capture' : 'surrounding the leader'}.
            </p>
            <button
              onClick={resetGameState}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg shadow"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Board;