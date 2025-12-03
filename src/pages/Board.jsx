import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getBoardNodes } from '../Logic/Board';
import {
  boardImg,
  bgImg,
  DECK_INDEXES,
  STORAGE_KEY,
  DUAL_TOKEN_SEQUENCE,
  FLOAT_TOLERANCE,
  IMPLEMENTED_ACTIVE_ABILITIES
} from '../Logic/GameConstants';
import {
  hydrateDecks,
  buildEmptyDecks,
  createGameLeaders,
  playerKeyToLabel,
  playerLabelToKey,
  createInitialLeaderPositions,
  getSavedGameState,
  generateInitialLeaders,
  createMovementTracker,
  sanitizePlacements,
  drawLeaderReplacement,
  getCardDisplayName,
  getCardAbility,
  getBoardAssetForPlayer,
  extractPortraitKey,
  getCardMetaFromAlias,
  isDualCharacter,
  buildPlacementRecord,
  getAdjacentNodeIds,
  getNodeOccupant,
  isNodeEmpty,
  findNodeByCoordinates,
  isWithinMoveRange,
  wouldTrapSelf,
  determineGameOutcome,
  getAcrobatLandingOptions,
  getRiderLandingOptions
} from '../Logic/GameUtils';

import CardSlot from '../components/CardSlot.jsx';
import RecruitOptionCard from '../components/RecruitOptionCard.jsx';
import AbilityTooltip from '../components/AbilityTooltip.jsx';

const Board = () => {
  const nodes = useMemo(() => getBoardNodes(), []);
  
  // Derived node maps for quick lookup
  const nodeMap = useMemo(() => {
    const map = new Map();
    nodes.forEach(node => {
      map.set(node.id, node);
    });
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

  // State Declarations
  const [leaders, setLeaders] = useState(() => savedGame?.leaders ?? generateInitialLeaders());
  const [selectedNode, setSelectedNode] = useState(null);
  const [currentTurn, setCurrentTurn] = useState(() => savedGame?.currentTurn ?? playerKeyToLabel(initialGameLeaderData.firstPlayerKey));
  const [leadersPositions, setLeadersPositions] = useState(() => savedGame?.leadersPositions ?? createInitialLeaderPositions());
  const [selectedLeader, setSelectedLeader] = useState(null);
  const [canPickFor, setCanPickFor] = useState(() => savedGame?.canPickFor ?? null);
  const [decks, setDecks] = useState(initialDeckState);
  const [placements, setPlacements] = useState(() => sanitizePlacements(savedGame?.placements ?? [], initialDeckState));
  const [retiredCards, setRetiredCards] = useState(() => savedGame?.retiredCards ?? []);
  const [selectedSummon, setSelectedSummon] = useState(() => savedGame?.selectedSummon ?? null);
  const [movementTracker, setMovementTracker] = useState(() => savedGame?.movementTracker ?? createMovementTracker());
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [statusMessage, setStatusMessage] = useState(() => savedGame?.statusMessage ?? '');
  const [gameResult, setGameResult] = useState(() => savedGame?.gameResult ?? null);
  const [abilityContext, setAbilityContext] = useState(null);
  const [gameLeaders, setGameLeaders] = useState(() => initialGameLeaderData.leaders);

  const isGameOver = Boolean(gameResult);
  const isPlayerDeckFull = (playerKey) => decks[playerKey].every(Boolean);
  const bothDecksFull = isPlayerDeckFull('p1') && isPlayerDeckFull('p2');
  const boardShiftClass = '-translate-x-48';
  const playerDeckShiftClass = bothDecksFull ? '-translate-x-12' : '';

  // Helper Wrappers
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

  // Persistence Effect
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
      const timer = setTimeout(() => ensureLeaderSupply(), 0);
      return () => clearTimeout(timer);
    }
  }, [leaders, ensureLeaderSupply]);

  // Ability Logic
  const isAbilitySilencedByJailer = (piece, placementsState = placements) => {
    if (!piece) return false;
    const enemyKey = piece.playerKey === 'p1' ? 'p2' : 'p1';
    const adjacentIds = getAdjacentNodeIds(nodes, piece.nodeId);
    return placementsState.some(unit => unit.playerKey === enemyKey && unit.cardKey === 'geolier' && adjacentIds.includes(unit.nodeId));
  };

  const getAbilityPieceInstance = (context, placementsState = placements) => {
    if (!context) return null;
    return placementsState.find(piece =>
      piece.playerKey === context.playerKey &&
      piece.deckIndex === context.deckIndex &&
      (context.tokenId == null || piece.tokenId === context.tokenId)
    ) ?? null;
  };

  const initializeAcrobatAbility = (piece, deckCard) => {
    const landingOptions = getAcrobatLandingOptions(piece.nodeId, placements, leadersPositions);
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

  const initializeRiderAbility = (piece, deckCard) => {
    const landingNodes = getRiderLandingOptions(piece.nodeId, placements, leadersPositions);
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
      const timer = setTimeout(() => setAbilityContext(null), 0);
      return () => clearTimeout(timer);
    }
  }, [abilityContext, placements, currentTurn, isGameOver]);

  useEffect(() => {
    if (!abilityContext) return;
    if (selectedSummon?.forced) {
      const timer = setTimeout(() => setAbilityContext(null), 0);
      return () => clearTimeout(timer);
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
    if (selectedSummon?.forced) return;
    handlePostMove(currentTurn);
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
      if (isNodeEmpty(toNode, placements, leadersPositions) && isWithinMoveRange(nodes, fromNode, toNode)) {
        const leaderKey = selectedLeader.playerKey;
        const nextPositions = {
          ...leadersPositions,
          [leaderKey]: toNode,
        };

        if (wouldTrapSelf(nodes, leaderKey, placements, nextPositions)) {
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
      if (isNodeEmpty(toNode, placements, leadersPositions) && isWithinMoveRange(nodes, fromNode, toNode)) {
        const playerKey = selectedUnit.playerKey;
        const nextPlacements = placements.map(piece => {
          if (piece.playerKey === playerKey && piece.deckIndex === selectedUnit.deckIndex) {
            return { ...piece, nodeId: toNode };
          }
          return piece;
        });
        if (wouldTrapSelf(nodes, playerKey, nextPlacements, leadersPositions)) {
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
    if (!isNodeEmpty(node.id, placements, leadersPositions)) return;
    const tokenQueue = pendingTokens ? [...pendingTokens] : null;
    const tokenId = tokenQueue?.length ? tokenQueue[0] : null;
    const nextPlacementRecord = buildPlacementRecord(playerKey, cardIndex, node.id, decks, tokenId);
    if (!nextPlacementRecord) {
      console.warn('Failed to build placement record for summon.');
      return;
    }

    const nextPlacements = [...placements, nextPlacementRecord];

    if (wouldTrapSelf(nodes, playerKey, nextPlacements, leadersPositions)) {
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
                    isNodeEmpty(node.id, placements, leadersPositions)
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
