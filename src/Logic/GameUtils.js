import { getBoardNodes } from './Board';
import { getUniqueRandomCharacter } from './CharacterRandomizer';
import {
  WHITE_CHARACTER_MAP,
  BLACK_CHARACTER_MAP,
  BOARD_IMAGE_ALIAS_MAP,
  DUAL_CARD_KEYS,
  DUAL_TOKEN_ASSETS,
  FLOAT_TOLERANCE,
  BOARD_COMPATIBLE_KEYS,
  MAX_DECK_SIZE,
  DECK_INDEXES,
  STORAGE_KEY,
  LEADER_DISPLAY_NAMES,
  CHARACTER_ALIAS_MAP,
  CHARACTER_DATA_MAP,
  whiteReine, whiteRoi, blackReine, blackRoi,
  reinePortrait, roiPortrait
} from './GameConstants';

const nodes = getBoardNodes();
const nodeMap = new Map(nodes.map(n => [n.id, n]));

const normalizeKey = (value = '') => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export const getBoardImageForAlias = (aliasKey, playerKey) => {
  if (!aliasKey || !playerKey) return null;
  const map = playerKey === 'p1' ? WHITE_CHARACTER_MAP : BLACK_CHARACTER_MAP;
  return map[aliasKey] ?? null;
};

export const extractPortraitKey = (imageUrl = '') => {
  const fileName = imageUrl.split('/').pop()?.split('?')[0] ?? '';
  let base = fileName.replace(/^LEADERS[-_]/i, '');
  base = base.replace(/\.(tif|tiff|png)$/i, '');
  base = base.replace(/[-_]?LQ$/i, '');
  return normalizeKey(base);
};

export const getCardDataByAlias = (aliasKey) => {
  if (!aliasKey) return null;
  const canonicalName = CHARACTER_ALIAS_MAP[aliasKey] ?? aliasKey;
  return CHARACTER_DATA_MAP[normalizeKey(canonicalName)] ?? null;
};

export const getCardMetaFromPortrait = (portraitUrl) => {
  if (!portraitUrl) return { cardKey: '', abilityType: null, abilityName: '' };
  const cardKey = extractPortraitKey(portraitUrl);
  const cardData = getCardDataByAlias(cardKey);
  return {
    cardKey,
    abilityType: cardData?.type ?? null,
    abilityName: cardData?.name ?? '',
  };
};

export const getCardMetaFromAlias = (aliasKey) => {
  if (!aliasKey) return { abilityType: null, abilityName: '' };
  const cardData = getCardDataByAlias(aliasKey);
  return {
    abilityType: cardData?.type ?? null,
    abilityName: cardData?.name ?? '',
  };
};

export const isDualCharacter = (cardKey) => DUAL_CARD_KEYS.has(cardKey);

export const buildEmptyDecks = () => ({
  p1: Array(MAX_DECK_SIZE).fill(null),
  p2: Array(MAX_DECK_SIZE).fill(null),
});

export const hydrateDecks = (rawDecks = buildEmptyDecks()) => {
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

export const getAliasFromBoardImage = (imageSrc) => BOARD_IMAGE_ALIAS_MAP[imageSrc] ?? null;

export const sanitizePlacements = (rawPlacements = [], deckSnapshot = buildEmptyDecks()) => rawPlacements.map((piece) => {
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

export const buildPlacementRecord = (playerKey, deckIndex, nodeId, decksSnapshot, tokenId = null) => {
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

export const createGameLeaders = () => {
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

export const playerLabelToKey = (label) => (label === 'Player 1' ? 'p1' : 'p2');
export const playerKeyToLabel = (key) => (key === 'p1' ? 'Player 1' : 'Player 2');

export const getCharacterInfo = (imageUrl) => {
  if (!imageUrl) return null;
  const assetKey = extractPortraitKey(imageUrl);
  if (!assetKey) return null;
  const aliasName = CHARACTER_ALIAS_MAP[assetKey];
  if (!aliasName) return null;
  return CHARACTER_DATA_MAP[normalizeKey(aliasName)] ?? null;
};

export const getCardDisplayName = (imageUrl) => {
  if (!imageUrl) return '';
  const assetKey = extractPortraitKey(imageUrl);
  if (!assetKey) return '';
  const info = getCharacterInfo(imageUrl);
  if (info?.name) return info.name;
  return LEADER_DISPLAY_NAMES[assetKey] ?? '';
};

export const getCardAbility = (imageUrl) => {
  const info = getCharacterInfo(imageUrl);
  return info?.ability ?? '';
};

export const createInitialLeaderPositions = () => ({ p1: 15, p2: 21 });

export const getSavedGameState = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Failed to parse saved game state', error);
    return null;
  }
};

export const hasBoardAssetForCard = (imageUrl) => BOARD_COMPATIBLE_KEYS.has(extractPortraitKey(imageUrl));

export const getBoardAssetForPlayer = (imageUrl, playerKey) => {
  const key = extractPortraitKey(imageUrl);
  const map = playerKey === 'p1' ? WHITE_CHARACTER_MAP : BLACK_CHARACTER_MAP;
  return map[key] ?? null;
};

export const drawPlayableCharacter = (excludeList = []) => {
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

export const drawLeaderReplacement = (currentOptions = [], usedCards = []) => {
  const activeOptions = currentOptions.filter(Boolean);
  const exclusion = Array.from(new Set([...activeOptions, ...usedCards])).filter(Boolean);
  const card = drawPlayableCharacter(exclusion);
  return { card, exhausted: !card };
};

export const generateInitialLeaders = () => {
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

export const createMovementTracker = () => ({
  p1: { leader: false, units: [] },
  p2: { leader: false, units: [] },
});

export const findNodeByCoordinates = (nodesList, targetX, targetY) => {
  // If nodesList is not provided, use the local nodes
  const list = Array.isArray(nodesList) ? nodesList : nodes;
  // If the first arg was actually x (because nodes was omitted), handle that? 
  // No, let's enforce passing nodes or use local.
  // But wait, the original function didn't take nodes.
  // Let's stick to the signature: (nodes, x, y) or just (x, y) using local nodes.
  // To be safe and flexible:
  let x = targetX;
  let y = targetY;
  let n = list;
  
  if (typeof nodesList === 'number') {
      x = nodesList;
      y = targetX;
      n = nodes;
  }

  return n.find((node) =>
    Math.abs(node.x - x) <= FLOAT_TOLERANCE && Math.abs(node.y - y) <= FLOAT_TOLERANCE
  ) ?? null;
};

export const isWithinMoveRange = (nodesList, fromNode, toNode) => {
    let f = fromNode;
    let t = toNode;
    let n = nodesList;
    if (typeof nodesList === 'number') {
        f = nodesList;
        t = fromNode;
        n = nodes;
    }

  const from = n.find(node => node.id === f);
  const to = n.find(node => node.id === t);
  if (!from || !to) return false;
  const dx = Math.abs(from.x - to.x);
  const dy = Math.abs(from.y - to.y);
  return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
};

export const getAdjacentNodeIds = (nodesList, nodeId) => {
    let id = nodeId;
    let n = nodesList;
    if (typeof nodesList === 'number') {
        id = nodesList;
        n = nodes;
    }

  const target = n.find(node => node.id === id);
  if (!target) return [];
  return n
    .filter(node => {
      const dx = Math.abs(node.x - target.x);
      const dy = Math.abs(node.y - target.y);
      return (dx > 0 || dy > 0) && dx <= 1 && dy <= 1;
    })
    .map(node => node.id);
};

export const getNodeOccupant = (nodeId, leaderPositionsState, placementsState) => {
  if (leaderPositionsState.p1 === nodeId) return { type: 'leader', playerKey: 'p1' };
  if (leaderPositionsState.p2 === nodeId) return { type: 'leader', playerKey: 'p2' };
  const unit = placementsState.find(piece => piece.nodeId === nodeId);
  return unit ? { ...unit, type: 'unit' } : null;
};

export const isNodeEmpty = (nodeId, placementsState, leaderPositionsState) => {
  if (leaderPositionsState.p1 === nodeId || leaderPositionsState.p2 === nodeId) return false;
  return !placementsState.some(piece => piece.nodeId === nodeId);
};

export const evaluateLeaderState = (playerKey, placementsState, leaderPositionsState) => {
  const leaderNodeId = leaderPositionsState[playerKey];
  const adjacentIds = getAdjacentNodeIds(nodes, leaderNodeId);
  const enemyKey = playerKey === 'p1' ? 'p2' : 'p1';
  let enemyCount = 0;
  let allOccupied = adjacentIds.length > 0;
  let hasAssassinAdjacent = false;
  let otherAlliesAdjacent = 0;

  adjacentIds.forEach(id => {
    const occupant = getNodeOccupant(id, leaderPositionsState, placementsState);
    if (!occupant) {
      allOccupied = false;
    } else if (occupant.playerKey === enemyKey && occupant.type !== 'leader') {
      enemyCount += 1;
      if (occupant.cardKey === 'assassin') {
        hasAssassinAdjacent = true;
      } else {
        otherAlliesAdjacent += 1;
      }
    }
  });

  let captured = enemyCount >= 2;
  if (!captured && hasAssassinAdjacent && otherAlliesAdjacent === 0) {
    captured = true;
  }

  return {
    captured,
    surrounded: allOccupied,
  };
};

export const wouldTrapSelf = (nodesList, playerKey, placementsState, leaderPositionsState) => {
    // Handle optional nodesList
    let pk = playerKey;
    let ps = placementsState;
    let lps = leaderPositionsState;
    if (typeof nodesList === 'string') {
        pk = nodesList;
        ps = playerKey;
        lps = placementsState;
    }
    // evaluateLeaderState uses local 'nodes' constant, so we don't strictly need to pass it if we use the local one.
    // But for consistency with the refactor plan, let's just use the local 'nodes' in evaluateLeaderState.
  const status = evaluateLeaderState(pk, ps, lps);
  return status.captured || status.surrounded;
};

export const determineGameOutcome = (arg1, arg2, arg3) => {
  let placementsState, leaderPositionsState;

  if (arg3) {
    // Called with (nodes, placements, leaders)
    placementsState = arg2;
    leaderPositionsState = arg3;
  } else {
    // Called with (placements, leaders)
    placementsState = arg1;
    leaderPositionsState = arg2;
  }

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

export const getAcrobatLandingOptions = (originNodeId, placementsState, leaderPositionsState) => {
  const originNode = nodeMap.get(originNodeId);
  if (!originNode) return [];
  const adjacentIds = getAdjacentNodeIds(nodes, originNodeId);
  return adjacentIds.reduce((acc, neighborId) => {
    const occupant = getNodeOccupant(neighborId, leaderPositionsState, placementsState);
    if (!occupant) return acc;
    const neighborNode = nodeMap.get(neighborId);
    if (!neighborNode) return acc;
    const deltaX = neighborNode.x - originNode.x;
    const deltaY = neighborNode.y - originNode.y;
    if (Math.abs(deltaX) <= FLOAT_TOLERANCE && Math.abs(deltaY) <= FLOAT_TOLERANCE) return acc;
    const landingNode = findNodeByCoordinates(nodes, neighborNode.x + deltaX, neighborNode.y + deltaY);
    if (!landingNode) return acc;
    if (!isNodeEmpty(landingNode.id, placementsState, leaderPositionsState)) return acc;
    acc.push({ nodeId: landingNode.id, overNodeId: neighborId });
    return acc;
  }, []);
};

export const getRiderLandingOptions = (originNodeId, placementsState, leaderPositionsState) => {
  const originNode = nodeMap.get(originNodeId);
  if (!originNode) return [];
  const adjacentIds = getAdjacentNodeIds(nodes, originNodeId);
  const destinations = new Set();

  adjacentIds.forEach(stepNodeId => {
    const stepNode = nodeMap.get(stepNodeId);
    if (!stepNode) return;
    if (!isNodeEmpty(stepNodeId, placementsState, leaderPositionsState)) return;
    const deltaX = stepNode.x - originNode.x;
    const deltaY = stepNode.y - originNode.y;
    if (Math.abs(deltaX) <= FLOAT_TOLERANCE && Math.abs(deltaY) <= FLOAT_TOLERANCE) return;
    const landingNode = findNodeByCoordinates(nodes, stepNode.x + deltaX, stepNode.y + deltaY);
    if (!landingNode) return;
    if (!isNodeEmpty(landingNode.id, placementsState, leaderPositionsState)) return;
    destinations.add(landingNode.id);
  });

  return Array.from(destinations);
};
