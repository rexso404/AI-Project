import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBoardNodes } from '../Logic/Board';
import { GameAI } from '../Logic/GameAI';
import {
  boardImg,
  bgImg,
  hermitPortrait,
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

const Board = ({ gameMode = 'player' }) => {
  const TURN_TIME_SECONDS = 5 * 60;
  const MOVE_BONUS_SECONDS = 20;
  const nodes = useMemo(() => getBoardNodes(), []);
  
  // Derived node maps for quick lookup
  const nodeMap = useMemo(() => {
    const map = new Map();
    nodes.forEach(node => {
      map.set(node.id, node);
    });
    return map;
  }, [nodes]);

  const normalizeVector = (dx, dy) => {
    const len = Math.hypot(dx, dy);
    if (!len) return { x: 0, y: 0 };
    return { x: dx / len, y: dy / len };
  };

  const getRayFromNeighbor = (originId, firstId) => {
    const originNode = nodeMap.get(originId);
    const firstNode = nodeMap.get(firstId);
    if (!originNode || !firstNode) return [];

    const dir = normalizeVector(firstNode.x - originNode.x, firstNode.y - originNode.y);
    const ray = [firstId];

    let prevId = originId;
    let currentId = firstId;
    while (true) {
      const currentNode = nodeMap.get(currentId);
      if (!currentNode) break;

      const neighbors = getAdjacentNodeIds(nodes, currentId)
        .filter((id) => id !== prevId)
        .map((id) => ({ id, node: nodeMap.get(id) }))
        .filter((entry) => Boolean(entry.node));

      let bestNextId = null;
      let bestDot = -Infinity;
      for (const { id, node } of neighbors) {
        const step = normalizeVector(node.x - currentNode.x, node.y - currentNode.y);
        const dot = dir.x * step.x + dir.y * step.y;
        const cross = dir.x * step.y - dir.y * step.x;

        // Continue in the same straight direction.
        if (dot > 0.985 && Math.abs(cross) <= 0.075 && dot > bestDot) {
          bestDot = dot;
          bestNextId = id;
        }
      }

      if (!bestNextId) break;
      ray.push(bestNextId);
      prevId = currentId;
      currentId = bestNextId;
    }

    return ray;
  };

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
      const firstPlayerKey = savedGame.gameLeaders?.p1?.role === 'roi' ? 'p1' : 'p2';
      return {
        leaders: savedGame.gameLeaders,
        firstPlayerKey,
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
  const [turnCount, setTurnCount] = useState(() => {
    const raw = Number(savedGame?.turnCount);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
  });
  const [leadersPositions, setLeadersPositions] = useState(() => savedGame?.leadersPositions ?? createInitialLeaderPositions());
  const [selectedLeader, setSelectedLeader] = useState(null);
  const [canPickFor, setCanPickFor] = useState(() => savedGame?.canPickFor ?? null);
  const [recruitPickRemaining, setRecruitPickRemaining] = useState(() => savedGame?.recruitPickRemaining ?? 0);
  const [p2RecruitBonusUsed, setP2RecruitBonusUsed] = useState(() => savedGame?.p2RecruitBonusUsed ?? false);
  const [decks, setDecks] = useState(initialDeckState);
  const [placements, setPlacements] = useState(() => sanitizePlacements(savedGame?.placements ?? [], initialDeckState));
  const [retiredCards, setRetiredCards] = useState(() => savedGame?.retiredCards ?? []);
  const [selectedSummon, setSelectedSummon] = useState(() => savedGame?.selectedSummon ?? null);
  const [movementTracker, setMovementTracker] = useState(() => savedGame?.movementTracker ?? createMovementTracker());
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [statusMessage, setStatusMessage] = useState(() => savedGame?.statusMessage ?? '');
  const [gameResult, setGameResult] = useState(() => savedGame?.gameResult ?? null);
  const [abilityContext, setAbilityContext] = useState(null);
  const [pendingForcedResume, setPendingForcedResume] = useState(null);
  const [clocks, setClocks] = useState(() => {
    const raw = savedGame?.clocks;
    const fallback = { p1: TURN_TIME_SECONDS, p2: TURN_TIME_SECONDS };
    if (!raw || typeof raw !== 'object') return fallback;
    const p1 = Number(raw.p1);
    const p2 = Number(raw.p2);
    return {
      p1: Number.isFinite(p1) && p1 >= 0 ? Math.floor(p1) : fallback.p1,
      p2: Number.isFinite(p2) && p2 >= 0 ? Math.floor(p2) : fallback.p2,
    };
  });
  const [gameLeaders, setGameLeaders] = useState(() => initialGameLeaderData.leaders);

  const reinePlayerKey = useMemo(() => {
    if (gameLeaders?.p1?.role === 'reine') return 'p1';
    if (gameLeaders?.p2?.role === 'reine') return 'p2';
    return 'p2';
  }, [gameLeaders]);

  const isGameOver = Boolean(gameResult);
  const isPlayerDeckFull = (playerKey) => decks[playerKey].every(Boolean);
  const bothDecksFull = isPlayerDeckFull('p1') && isPlayerDeckFull('p2');
  const boardShiftClass = '-translate-x-48';
  const playerDeckShiftClass = bothDecksFull ? '-translate-x-12' : '';
  const isPlayer1Turn = currentTurn === 'Player 1';

  const formatClock = (seconds) => {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0));
    const mm = String(Math.floor(safe / 60)).padStart(2, '0');
    const ss = String(safe % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const activeClockOwnerKey = useMemo(() => {
    if (abilityContext?.data?.isForced && abilityContext?.data?.allowOffTurn && abilityContext?.playerKey) {
      return abilityContext.playerKey;
    }
    return playerLabelToKey(currentTurn);
  }, [abilityContext, currentTurn]);

  function grantMoveBonus(playerKey) {
    if (!playerKey) return;
    setClocks((prev) => ({
      ...prev,
      [playerKey]: Math.max(0, Number(prev?.[playerKey] ?? TURN_TIME_SECONDS)) + MOVE_BONUS_SECONDS,
    }));
  }

  function executeAIMove(move) {
    console.log("Executing AI Move:", move);

    if (move.type === 'RECRUIT') {
      // 1. Find empty slot in deck
      const emptySlot = decks.p2.findIndex(c => c === null);
      if (emptySlot === -1) {
        console.warn("AI tried to recruit but deck is full.");
        toggleTurn();
        return;
      }

      // 2. Get the card
      const card = leaders[move.index];
      if (!card) {
        console.warn("AI tried to recruit invalid card.");
        toggleTurn();
        return;
      }

      // 3. Add card to retired list (so it won't appear again)
      const updatedRetired = retiredCards.includes(card) ? retiredCards : [...retiredCards, card];
      setRetiredCards(updatedRetired);

      // 4. Determine Placement (Simple Heuristic: First valid spot in back row)
      const validNodes = nodes.filter(n => isValidPlacementNode('p2', n) && isNodeEmpty(n.id, placements, leadersPositions));
      
      if (validNodes.length === 0) {
        console.warn("AI has no space to place recruited unit.");
        toggleTurn();
        return;
      }

      // Pick random valid node
      // Pick a deterministic valid node to keep renders/analysis stable.
      const targetNode = validNodes[0];
      
      // 5. Update Leaders pool - remove recruited card and draw replacement
      setLeaders(prev => {
        const next = [...prev];
        next[move.index] = null;
        const { card: replacement } = drawLeaderReplacement(next, updatedRetired);
        next[move.index] = replacement;
        return next;
      });

      // Handle Dual Token (Hermit & Cub)
      const isDual = isDualCharacter(extractPortraitKey(card));
      const tokenSequence = isDual ? [...DUAL_TOKEN_SEQUENCE] : [null];

      let currentPlacements = [...placements];
      let currentDecks = { ...decks };
      let currentLeadersPositions = { ...leadersPositions };

      // Place tokens
      tokenSequence.forEach((tokenId, idx) => {
        // For second token, find another valid spot
        let placementNode = targetNode;
        if (idx > 0) {
             const remainingNodes = nodes.filter(n => 
                isValidPlacementNode('p2', n) && 
                isNodeEmpty(n.id, currentPlacements, currentLeadersPositions) &&
                n.id !== targetNode.id
             );
             if (remainingNodes.length > 0) {
               placementNode = remainingNodes[0];
             }
        }

        // Update Deck
        currentDecks = {
            ...currentDecks,
            p2: currentDecks.p2.map((c, i) => {
                if (i !== emptySlot) return c;
                // If it's the first time we are adding the card to the deck
                const aliasKey = extractPortraitKey(card);
                const boardImage = getBoardAssetForPlayer(card, 'p2');
                const newCard = c || { 
                    ...getCardMetaFromAlias(aliasKey), 
                    portrait: card, 
                    boardImage: boardImage,
                    cardKey: aliasKey,
                    isDual 
                };
                
                if (isDual) {
                    const placedTokens = Array.from(new Set([...(newCard.placedTokens ?? []), tokenId].filter(Boolean)));
                    return { ...newCard, placedTokens };
                }
                return { ...newCard, boardNodeId: placementNode.id };
            })
        };

        const placementRecord = buildPlacementRecord('p2', emptySlot, placementNode.id, currentDecks, tokenId);
        
        // Update Placements
        if (placementRecord) {
            currentPlacements = [...currentPlacements, placementRecord];
        }
      });

      setPlacements(currentPlacements);
      setDecks(currentDecks);

      grantMoveBonus('p2');
      
      // Check Win Condition
      if (finalizeActionOutcome(currentPlacements, currentLeadersPositions)) return;

      // Handle Turn Switch
      // If AI has picks remaining (Reine bonus), it might want to pick again.
      // But Minimax currently returns 1 move.
      // For simplicity, we just toggle turn after 1 recruit.
      // Unless we want to support double recruit.
      // Let's stick to single recruit for now.
      toggleTurn();

    } else if (move.type === 'MOVE_LEADER') {
        const newPositions = { ...leadersPositions, p2: move.to };
        setLeadersPositions(newPositions);
        markLeaderMoved('p2');

      grantMoveBonus('p2');
        
        if (finalizeActionOutcome(placements, newPositions)) return;
        
        // Nemesis Reaction
        if (startNemesisReactionIfNeeded('p2', placements, newPositions)) {
        // Pause AI phase resolution until the forced Nemesis reaction is completed.
        setPendingForcedResume({
          type: 'nemesis',
          resumeTurnLabel: currentTurn,
        });
            // If Nemesis triggers, we need to handle it.
            // For AI, we should probably auto-resolve Nemesis too?
            // Or let the player handle their Nemesis if they have one.
            // If AI has Nemesis, it needs to move.
            // `startNemesisReactionIfNeeded` sets `abilityContext`.
            // If it's AI's Nemesis, we need to handle it.
            // But `startNemesisReactionIfNeeded` sets UI state.
            // We might need a separate AI handler for reaction.
            // For now, let's assume `startNemesisReactionIfNeeded` works for UI.
            // If AI triggers Player's Nemesis, Player needs to move.
            // If AI triggers AI's Nemesis (impossible since it's AI turn moving AI leader),
            // Wait, Nemesis moves when OPPONENT leader moves.
            // So if AI moves AI Leader, Player's Nemesis might trigger.
            // That's fine, `startNemesisReactionIfNeeded` will set UI for Player to move.
        } else {
            endPhase();
        }

    } else if (move.type === 'MOVE_UNIT') {
        const updatedPlacements = placements.map(p => {
            if (p.nodeId === move.unitId) {
                return { ...p, nodeId: move.to };
            }
            return p;
        });
        
        setPlacements(updatedPlacements);
        grantMoveBonus('p2');
        
        // Update Deck boardNodeId reference
        const unit = placements.find(p => p.nodeId === move.unitId);
        if (unit) {
             markUnitMoved('p2', unit.deckIndex, unit.tokenId);
             setDecks(prev => ({
                ...prev,
                p2: prev.p2.map((c, i) => {
                    if (i !== unit.deckIndex || !c) return c;
                    if (c.isDual) return c; // Duals don't track single boardNodeId
                    return { ...c, boardNodeId: move.to };
                })
             }));
        }

        if (finalizeActionOutcome(updatedPlacements, leadersPositions)) return;
        endPhase();

    } else if (move.type === 'USE_ABILITY') {
        let updatedPlacements = [...placements];
        let unitToMark = null;

        // Find the unit using the ability
        const unitIndex = updatedPlacements.findIndex(p => p.nodeId === move.unitId);
        if (unitIndex !== -1) {
            unitToMark = updatedPlacements[unitIndex];
        }

        if (['acrobate', 'cavalier', 'garderoyal', 'rodeuse'].includes(move.ability)) {
            // Simple Move
            if (unitIndex !== -1) {
                updatedPlacements[unitIndex] = { ...updatedPlacements[unitIndex], nodeId: move.to };
            }
        }
        else if (['manipulatrice', 'tavernier', 'cogneur'].includes(move.ability)) {
            // Move Target
            const targetIndex = updatedPlacements.findIndex(p => p.nodeId === move.targetId);
            if (targetIndex !== -1) {
                updatedPlacements[targetIndex] = { ...updatedPlacements[targetIndex], nodeId: move.to };
            }
        }
        else if (move.ability === 'lancegrappin') {
            if (move.subType === 'move_self') {
                if (unitIndex !== -1) {
                    updatedPlacements[unitIndex] = { ...updatedPlacements[unitIndex], nodeId: move.to };
                }
            } else if (move.subType === 'drag_target') {
                const targetIndex = updatedPlacements.findIndex(p => p.nodeId === move.targetId);
                if (targetIndex !== -1) {
                    updatedPlacements[targetIndex] = { ...updatedPlacements[targetIndex], nodeId: move.to };
                }
            }
        }
        else if (move.ability === 'illusionniste') {
            // Swap
            const targetIndex = updatedPlacements.findIndex(p => p.nodeId === move.targetId);
            if (unitIndex !== -1 && targetIndex !== -1) {
                const unitPos = updatedPlacements[unitIndex].nodeId;
                const targetPos = updatedPlacements[targetIndex].nodeId;
                
                updatedPlacements[unitIndex] = { ...updatedPlacements[unitIndex], nodeId: targetPos };
                updatedPlacements[targetIndex] = { ...updatedPlacements[targetIndex], nodeId: unitPos };
            }
        }

        setPlacements(updatedPlacements);
        grantMoveBonus('p2');

        // Mark unit as moved (Action used)
        if (unitToMark) {
            markUnitMoved('p2', unitToMark.deckIndex, unitToMark.tokenId);
            
            // Update Deck boardNodeId if unit moved (for consistency)
            if (['acrobate', 'cavalier', 'garderoyal', 'rodeuse'].includes(move.ability) || (move.ability === 'lancegrappin' && move.subType === 'move_self')) {
                 setDecks(prev => ({
                    ...prev,
                    p2: prev.p2.map((c, i) => {
                        if (i !== unitToMark.deckIndex || !c) return c;
                        if (c.isDual) return c;
                        return { ...c, boardNodeId: move.to };
                    })
                 }));
            }
            else if (move.ability === 'illusionniste') {
                 setDecks(prev => ({
                    ...prev,
                    p2: prev.p2.map((c, i) => {
                        if (i !== unitToMark.deckIndex || !c) return c;
                        if (c.isDual) return c;
                        return { ...c, boardNodeId: move.targetId };
                    })
                 }));
            }
        }

        if (finalizeActionOutcome(updatedPlacements, leadersPositions)) return;
        endPhase();
    }
  }

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
      turnCount,
      leadersPositions,
      canPickFor,
      recruitPickRemaining,
      p2RecruitBonusUsed,
      decks,
      placements,
      retiredCards,
      selectedSummon,
      movementTracker,
      gameLeaders,
      statusMessage,
      gameResult,
      clocks,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [leaders, currentTurn, turnCount, leadersPositions, canPickFor, recruitPickRemaining, p2RecruitBonusUsed, decks, placements, retiredCards, selectedSummon, movementTracker, gameLeaders, statusMessage, gameResult, clocks]);

  const clearSavedGame = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const resetGameState = () => {
    clearSavedGame();
    const { leaders: freshGameLeaders, firstPlayerKey } = createGameLeaders();
    setLeaders(generateInitialLeaders());
    setCurrentTurn(playerKeyToLabel(firstPlayerKey));
    setTurnCount(1);
    setLeadersPositions(createInitialLeaderPositions());
    setSelectedLeader(null);
    setSelectedNode(null);
    setCanPickFor(null);
    setRecruitPickRemaining(0);
    setP2RecruitBonusUsed(false);
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
    setPendingForcedResume(null);
    setClocks({ p1: TURN_TIME_SECONDS, p2: TURN_TIME_SECONDS });
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
  const resolveCharacterName = (piece, deckCard) => {
    // Prefer the hydrated metadata (it already comes from data.json via GameConstants/CHARACTER_DATA_MAP)
    const fromDeck = deckCard?.abilityName;
    const fromPiece = piece?.abilityName;
    const fromAlias = piece?.cardKey ? getCardMetaFromAlias(piece.cardKey)?.abilityName : '';

    // Final fallback: attempt to derive from portrait URL if present
    const fromPortrait = piece?.portrait ? getCardDisplayName(piece.portrait) : '';
    return fromDeck || fromPiece || fromAlias || fromPortrait || '';
  };

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
      abilityName: resolveCharacterName(piece, deckCard),
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
      abilityName: resolveCharacterName(piece, deckCard),
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
    const enemyCandidates = [
      ...placements
        .filter(unit => unit.playerKey === enemyKey)
        .map(unit => ({ ...unit, type: 'unit' })),
      {
        type: 'leader',
        playerKey: enemyKey,
        nodeId: leadersPositions[enemyKey],
      },
    ].filter(candidate => !!candidate.nodeId);

    const inLineEnemies = enemyCandidates.filter(target => {
      const targetNode = nodeMap.get(target.nodeId);
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

    const highlightNodes = inLineEnemies.map(target => target.nodeId);
    setStatusMessage('Pilih satu musuh yang disorot, lalu pilih petak di sekitarnya.');
    return {
      id: piece.cardKey,
      abilityName: resolveCharacterName(piece, deckCard),
      playerKey: piece.playerKey,
      playerLabel: playerKeyToLabel(piece.playerKey),
      deckIndex: piece.deckIndex,
      tokenId: piece.tokenId ?? null,
      originNodeId: piece.nodeId,
      phase: 'manipulator-select-target',
      highlightNodes,
      data: {
        hasProgress: false,
        targets: inLineEnemies.map(target => ({
          type: target.type,
          nodeId: target.nodeId,
          playerKey: target.playerKey,
          deckIndex: target.type === 'unit' ? target.deckIndex : null,
          tokenId: target.type === 'unit' ? (target.tokenId ?? null) : null,
        })),
      },
    };
  };

  const initializeRoyalGuardAbility = (piece, deckCard) => {
    const leaderNodeId = leadersPositions[piece.playerKey];
    const leaderNode = nodeMap.get(leaderNodeId);
    if (!leaderNode) {
      setStatusMessage('Leader tidak ditemukan di papan.');
      return null;
    }

    // Langkah 1: cari semua petak kosong yang adjacent ke leader
    const adjacentToLeader = getAdjacentNodeIds(leaderNodeId).filter(id =>
      isNodeEmpty(id, placements, leadersPositions)
    );
    if (!adjacentToLeader.length) {
      setStatusMessage('Tidak ada petak kosong di sekitar Leader untuk Royal Guard.');
      return null;
    }

    setStatusMessage('Pilih petak kosong di sekitar Leader untuk Royal Guard, lalu pilih satu petak lagi untuk langkah tambahan.');
    return {
      id: piece.cardKey,
      abilityName: resolveCharacterName(piece, deckCard),
      playerKey: piece.playerKey,
      playerLabel: playerKeyToLabel(piece.playerKey),
      deckIndex: piece.deckIndex,
      tokenId: piece.tokenId ?? null,
      originNodeId: piece.nodeId,
      phase: 'royal-select-adjacent',
      highlightNodes: adjacentToLeader,
      data: {
        hasProgress: false,
        leaderNodeId,
      },
    };
  };

  const initializeClawLauncherAbility = (piece, deckCard) => {
    const originNode = nodeMap.get(piece.nodeId);
    if (!originNode) {
      setStatusMessage('Claw Launcher tidak berada di petak papan yang valid.');
      return null;
    }

    // Ray-trace from the origin along each adjacent direction, so we only ever follow real nodes
    // (prevents lines that pass through gaps between spaces).
    const adjacent = getAdjacentNodeIds(nodes, piece.nodeId);
    const visibleTargets = [];
    const seenTargets = new Set();

    for (const firstId of adjacent) {
      const ray = getRayFromNeighbor(piece.nodeId, firstId);
      if (!ray.length) continue;

      for (let idx = 0; idx < ray.length; idx += 1) {
        const nodeId = ray[idx];
        const occ = getNodeOccupant(nodeId, leadersPositions, placements);
        if (!occ) continue;

        // Never allow targeting the Claw Launcher itself.
        if (occ.type === 'unit') {
          const isSelf =
            occ.playerKey === piece.playerKey &&
            occ.deckIndex === piece.deckIndex &&
            (piece.tokenId == null || occ.tokenId === piece.tokenId);
          if (isSelf) break;
        }

        const key = `${occ.type}:${occ.playerKey}:${nodeId}`;
        if (!seenTargets.has(key)) {
          const prevToTargetId = idx > 0 ? ray[idx - 1] : piece.nodeId;
          visibleTargets.push({
            ...occ,
            nodeId,
            rayFirstId: firstId,
            prevToTargetId,
          });
          seenTargets.add(key);
        }
        // First occupied piece blocks the ray beyond it.
        break;
      }
    }

    if (!visibleTargets.length) {
      setStatusMessage('Tidak ada karakter yang terlihat dalam garis lurus/diagonal untuk Claw Launcher.');
      return null;
    }

    const highlightNodes = visibleTargets.map(target => target.nodeId);
    setStatusMessage('Pilih satu karakter yang disorot untuk Claw Launcher.');
    return {
      id: piece.cardKey,
      abilityName: resolveCharacterName(piece, deckCard),
      playerKey: piece.playerKey,
      playerLabel: playerKeyToLabel(piece.playerKey),
      deckIndex: piece.deckIndex,
      tokenId: piece.tokenId ?? null,
      originNodeId: piece.nodeId,
      phase: 'claw-select-target',
      highlightNodes,
      data: {
        hasProgress: false,
        targets: visibleTargets.map(target => ({
          type: target.type,
          nodeId: target.nodeId,
          playerKey: target.playerKey,
          deckIndex: target.type === 'unit' ? target.deckIndex : null,
          tokenId: target.type === 'unit' ? (target.tokenId ?? null) : null,
          rayFirstId: target.rayFirstId,
          prevToTargetId: target.prevToTargetId,
        })),
      },
    };
  };

  const initializeBrewmasterAbility = (piece, deckCard) => {
    const originNode = nodeMap.get(piece.nodeId);
    if (!originNode) return null;

    // Cari ally yang adjacent ke Brewmaster
    const adjacentIds = getAdjacentNodeIds(originNode.id);
    const adjacentAllies = [
      ...placements
        .filter(unit => unit.playerKey === piece.playerKey && adjacentIds.includes(unit.nodeId))
        .map(unit => ({ ...unit, type: 'unit' })),
      {
        type: 'leader',
        playerKey: piece.playerKey,
        nodeId: leadersPositions[piece.playerKey],
      },
    ].filter(ally => ally.nodeId && adjacentIds.includes(ally.nodeId));

    if (!adjacentAllies.length) {
      setStatusMessage('Brewmaster membutuhkan ally di sekitarnya untuk menggunakan ability.');
      return null;
    }

    const highlightNodes = adjacentAllies.map(ally => ally.nodeId);
    setStatusMessage('Pilih satu ally adjacent untuk dipindahkan oleh Brewmaster.');
    return {
      id: piece.cardKey,
      abilityName: resolveCharacterName(piece, deckCard),
      playerKey: piece.playerKey,
      playerLabel: playerKeyToLabel(piece.playerKey),
      deckIndex: piece.deckIndex,
      tokenId: piece.tokenId ?? null,
      originNodeId: piece.nodeId,
      phase: 'brew-select-ally',
      highlightNodes,
      data: {
        hasProgress: false,
        allies: adjacentAllies.map(ally => ({
          type: ally.type,
          nodeId: ally.nodeId,
          playerKey: ally.playerKey,
          deckIndex: ally.type === 'unit' ? ally.deckIndex : null,
          tokenId: ally.type === 'unit' ? (ally.tokenId ?? null) : null,
        })),
      },
    };
  };

  const initializeBruiserAbility = (piece, deckCard) => {
    const originNode = nodeMap.get(piece.nodeId);
    if (!originNode) return null;

    const enemyKey = piece.playerKey === 'p1' ? 'p2' : 'p1';
    const adjacentIds = getAdjacentNodeIds(originNode.id);
    const adjacentEnemies = [
      ...placements
        .filter(unit => unit.playerKey === enemyKey && adjacentIds.includes(unit.nodeId))
        .map(unit => ({ ...unit, type: 'unit' })),
      {
        type: 'leader',
        playerKey: enemyKey,
        nodeId: leadersPositions[enemyKey],
      },
    ].filter(enemy => enemy.nodeId && adjacentIds.includes(enemy.nodeId));

    if (!adjacentEnemies.length) {
      setStatusMessage('Bruiser membutuhkan musuh di petak sebelah untuk mendorong.');
      return null;
    }

    const highlightNodes = adjacentEnemies.map(enemy => enemy.nodeId);
    setStatusMessage('Pilih satu musuh adjacent untuk didorong oleh Bruiser.');
    return {
      id: piece.cardKey,
      abilityName: resolveCharacterName(piece, deckCard),
      playerKey: piece.playerKey,
      playerLabel: playerKeyToLabel(piece.playerKey),
      deckIndex: piece.deckIndex,
      tokenId: piece.tokenId ?? null,
      originNodeId: piece.nodeId,
      phase: 'bruiser-select-target',
      highlightNodes,
      data: {
        hasProgress: false,
      },
    };
  };

  const initializeIllusionistAbility = (piece, deckCard) => {
    const originNode = nodeMap.get(piece.nodeId);
    if (!originNode) return null;

    const candidates = [
      ...placements
        .filter(unit => !(unit.playerKey === piece.playerKey && unit.deckIndex === piece.deckIndex && (piece.tokenId == null || unit.tokenId === piece.tokenId)))
        .map(unit => ({ ...unit, type: 'unit' })),
      {
        type: 'leader',
        playerKey: 'p1',
        nodeId: leadersPositions.p1,
      },
      {
        type: 'leader',
        playerKey: 'p2',
        nodeId: leadersPositions.p2,
      },
    ].filter(candidate => !!candidate.nodeId);

    const visibleTargets = candidates.filter(target => {
      // Illusionist can target any visible non-adjacent character (including leaders)
      const targetNode = nodeMap.get(target.nodeId);
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

    if (!visibleTargets.length) {
      setStatusMessage('Tidak ada karakter non-adjacent yang terlihat untuk Illusionist.');
      return null;
    }

    const highlightNodes = visibleTargets.map(target => target.nodeId);
    setStatusMessage('Pilih satu karakter non-adjacent yang terlihat untuk bertukar posisi.');
    return {
      id: piece.cardKey,
      abilityName: resolveCharacterName(piece, deckCard),
      playerKey: piece.playerKey,
      playerLabel: playerKeyToLabel(piece.playerKey),
      deckIndex: piece.deckIndex,
      tokenId: piece.tokenId ?? null,
      originNodeId: piece.nodeId,
      phase: 'illusionist-select-target',
      highlightNodes,
      data: {
        hasProgress: false,
      },
    };
  };

  const initializeWandererAbility = (piece, deckCard) => {
    const originNode = nodeMap.get(piece.nodeId);
    if (!originNode) return null;

    const enemyPositions = new Set(
      placements.filter(u => u.playerKey !== piece.playerKey).map(u => u.nodeId)
    );
    enemyPositions.add(leadersPositions[piece.playerKey === 'p1' ? 'p2' : 'p1']);

    const destinations = nodes
      .filter(node => {
        if (!isNodeEmpty(node.id, placements, leadersPositions)) return false;
        const adj = getAdjacentNodeIds(node.id);
        return !adj.some(id => enemyPositions.has(id));
      })
      .map(node => node.id);

    if (!destinations.length) {
      setStatusMessage('Tidak ada petak yang non-adjacent terhadap musuh untuk Wanderer.');
      return null;
    }

    setStatusMessage('Pilih petak mana saja yang tidak adjacent ke musuh.');
    return {
      id: piece.cardKey,
      abilityName: resolveCharacterName(piece, deckCard),
      playerKey: piece.playerKey,
      playerLabel: playerKeyToLabel(piece.playerKey),
      deckIndex: piece.deckIndex,
      tokenId: piece.tokenId ?? null,
      originNodeId: piece.nodeId,
      phase: 'wanderer-select-destination',
      highlightNodes: destinations,
      data: {
        hasProgress: false,
      },
    };
  };

  const concludeAbilityUsage = (placementsState, leaderPositionsState = leadersPositions, message) => {
    if (!abilityContext) return;
    const abilityMeta = abilityContext;
    setAbilityContext(null);
    markUnitMoved(abilityMeta.playerKey, abilityMeta.deckIndex, abilityMeta.tokenId ?? null);
    setSelectedUnit(null);
    setSelectedNode(null);
    setStatusMessage(message ?? `${abilityMeta.abilityName} ability resolved.`);
    setLeadersPositions(leaderPositionsState);
    grantMoveBonus(abilityMeta.playerKey);
    finalizeActionOutcome(placementsState, leaderPositionsState);
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

    concludeAbilityUsage(updatedPlacements, leadersPositions, 'Acrobat completes the jump.');
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

    concludeAbilityUsage(updatedPlacements, leadersPositions, 'Rider charges forward.');
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
    if (piece.cardKey === 'garderoyal') {
      const initialized = initializeRoyalGuardAbility(piece, deckCard);
      if (!initialized) return;
      setAbilityContext(initialized);
      return;
    }
    if (piece.cardKey === 'lancegrappin') {
      const initialized = initializeClawLauncherAbility(piece, deckCard);
      if (!initialized) return;
      setAbilityContext(initialized);
      return;
    }
    if (piece.cardKey === 'tavernier') {
      const initialized = initializeBrewmasterAbility(piece, deckCard);
      if (!initialized) return;
      setAbilityContext(initialized);
      return;
    }
    if (piece.cardKey === 'cogneur') {
      const initialized = initializeBruiserAbility(piece, deckCard);
      if (!initialized) return;
      setAbilityContext(initialized);
      return;
    }
    if (piece.cardKey === 'illusionniste') {
      const initialized = initializeIllusionistAbility(piece, deckCard);
      if (!initialized) return;
      setAbilityContext(initialized);
      return;
    }
    if (piece.cardKey === 'rodeuse') {
      const initialized = initializeWandererAbility(piece, deckCard);
      if (!initialized) return;
      setAbilityContext(initialized);
      return;
    }
    setStatusMessage('Ability interactions are being prepared.');
  };

  const cancelAbilityContext = () => {
    if (!abilityContext) return;
    if (abilityContext.data?.isForced) {
      setStatusMessage('Ability ini wajib diselesaikan dan tidak bisa dibatalkan.');
      return;
    }
    if (abilityContext.data?.hasProgress) {
      concludeAbilityUsage(placements, leadersPositions, `${abilityContext.abilityName} ability resolved.`);
      return;
    }
    setAbilityContext(null);
    setStatusMessage('Ability cancelled.');
  };

  useEffect(() => {
    if (!abilityContext) return;
    const allowOffTurn = Boolean(abilityContext.data?.allowOffTurn);
    const stillExists = placements.some(p => p.playerKey === abilityContext.playerKey && p.deckIndex === abilityContext.deckIndex && (abilityContext.tokenId == null || p.tokenId === abilityContext.tokenId));
    if (!stillExists || (!allowOffTurn && abilityContext.playerLabel !== currentTurn) || isGameOver) {
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

    if (abilityContext.id === 'nemesis') {
      const activePiece = getAbilityPieceInstance(abilityContext);
      if (!activePiece) {
        setAbilityContext(null);
        setStatusMessage('Nemesis tidak lagi tersedia di papan.');
        return;
      }
      if (!isNodeEmpty(node.id, placements, leadersPositions)) {
        setStatusMessage('Petak ini sudah terisi.');
        return;
      }

      const updatedPlacements = placements.map((piece) =>
        (piece.playerKey === activePiece.playerKey &&
          piece.deckIndex === activePiece.deckIndex &&
          (activePiece.tokenId == null || piece.tokenId === activePiece.tokenId))
          ? { ...piece, nodeId: node.id }
          : piece
      );

      if (wouldTrapSelf(nodes, activePiece.playerKey, updatedPlacements, leadersPositions)) {
        setStatusMessage('Nemesis tidak boleh bergerak jika itu membuat Leader-mu tertangkap/terkepung.');
        return;
      }

      setPlacements(updatedPlacements);
      setDecks((prev) => ({
        ...prev,
        [activePiece.playerKey]: prev[activePiece.playerKey].map((card, idx) => {
          if (idx !== activePiece.deckIndex || !card) return card;
          if (card.isDual) return card;
          return { ...card, boardNodeId: node.id };
        }),
      }));

      setAbilityContext(null);
      setSelectedNode(null);
      setSelectedUnit(null);
      setSelectedLeader(null);
      setStatusMessage('Nemesis bergerak setelah Leader musuh bergerak.');
      grantMoveBonus(activePiece.playerKey);
      const gameEnded = finalizeActionOutcome(updatedPlacements, leadersPositions);

      // If Nemesis was a forced interruption (e.g., triggered during AI leader move),
      // resume the paused phase after a short beat.
      if (pendingForcedResume?.type === 'nemesis') {
        const resumeTurnLabel = pendingForcedResume.resumeTurnLabel;
        setPendingForcedResume(null);
        if (!gameEnded && resumeTurnLabel) {
          setTimeout(() => {
            // Continue the mover's phase resolution (turn switch / recruit phase).
            handlePostMove(resumeTurnLabel);
          }, 450);
        }
      }
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

      if (abilityContext.phase === 'manipulator-select-target') {
        if (!abilityContext.highlightNodes?.includes(node.id)) {
          setStatusMessage('Pilih satu target musuh yang disorot.');
          return;
        }

        const targetOcc = getNodeOccupant(node.id, leadersPositions, placements);
        if (!targetOcc || targetOcc.playerKey === activePiece.playerKey) {
          setStatusMessage('Pilih satu target musuh yang disorot.');
          return;
        }

        if (isPieceProtectedFromEnemyMove(targetOcc.playerKey, node.id, placements, leadersPositions)) {
          setStatusMessage('Target dilindungi oleh Protector; tidak bisa digerakkan oleh ability musuh.');
          return;
        }

        const options = getAdjacentNodeIds(nodes, node.id).filter(id =>
          isNodeEmpty(id, placements, leadersPositions)
        );
        if (!options.length) {
          setStatusMessage('Tidak ada petak kosong di sekitar target.');
          return;
        }

        setAbilityContext({
          ...abilityContext,
          phase: 'manipulator-select-destination',
          highlightNodes: options,
          data: {
            ...abilityContext.data,
            hasProgress: true,
            selectedTarget: {
              type: targetOcc.type,
              nodeId: node.id,
              playerKey: targetOcc.playerKey,
              deckIndex: targetOcc.type === 'unit' ? targetOcc.deckIndex : null,
              tokenId: targetOcc.type === 'unit' ? (targetOcc.tokenId ?? null) : null,
            },
          },
        });
        setStatusMessage('Pilih petak kosong di sekitar target untuk memindahkannya 1 langkah.');
        return;
      }

      if (abilityContext.phase === 'manipulator-select-destination') {
        const selectedTarget = abilityContext.data?.selectedTarget;
        if (!selectedTarget) {
          setAbilityContext(null);
          setStatusMessage('Target tidak valid.');
          return;
        }
        if (!abilityContext.highlightNodes?.includes(node.id)) {
          setStatusMessage('Pilih salah satu petak yang disorot.');
          return;
        }
        if (!isNodeEmpty(node.id, placements, leadersPositions)) {
          setStatusMessage('Petak ini sudah terisi.');
          return;
        }

        if (selectedTarget.type === 'leader') {
          const updatedLeaderPositions = {
            ...leadersPositions,
            [selectedTarget.playerKey]: node.id,
          };
          concludeAbilityUsage(placements, updatedLeaderPositions, 'Manipulator memindahkan musuh 1 langkah.');
          startNemesisReactionIfNeeded(selectedTarget.playerKey, placements, updatedLeaderPositions);
          return;
        }

        const targetUnit = placements.find(p =>
          p.playerKey === selectedTarget.playerKey &&
          p.deckIndex === selectedTarget.deckIndex &&
          (selectedTarget.tokenId == null || p.tokenId === selectedTarget.tokenId)
        );
        if (!targetUnit) {
          setAbilityContext(null);
          setStatusMessage('Target sudah tidak ada di papan.');
          return;
        }

        const updatedPlacements = placements.map(p => (p === targetUnit ? { ...p, nodeId: node.id } : p));
        setPlacements(updatedPlacements);
        setDecks(prev => ({
          ...prev,
          [targetUnit.playerKey]: prev[targetUnit.playerKey].map((card, idx) => {
            if (idx !== targetUnit.deckIndex || !card) return card;
            if (card.isDual) return card;
            return { ...card, boardNodeId: node.id };
          }),
        }));

        concludeAbilityUsage(updatedPlacements, leadersPositions, 'Manipulator memindahkan musuh 1 langkah.');
        return;
      }

      setStatusMessage('Ability Manipulator dibatalkan.');
      setAbilityContext(null);
      return;
    }

    if (abilityContext.id === 'garderoyal') {
      const activePiece = getAbilityPieceInstance(abilityContext);
      if (!activePiece) {
        setAbilityContext(null);
        setStatusMessage('Selected unit is no longer available.');
        return;
      }

      if (abilityContext.phase === 'royal-select-adjacent') {
        if (!abilityContext.highlightNodes?.includes(node.id)) {
          setStatusMessage('Pilih salah satu petak yang disorot.');
          return;
        }

        const movedOncePlacements = placements.map(p =>
          (p.playerKey === activePiece.playerKey &&
           p.deckIndex === activePiece.deckIndex &&
           (activePiece.tokenId == null || p.tokenId === activePiece.tokenId))
            ? { ...p, nodeId: node.id }
            : p
        );

        setPlacements(movedOncePlacements);
        setDecks(prev => ({
          ...prev,
          [activePiece.playerKey]: prev[activePiece.playerKey].map((card, idx) => {
            if (idx !== activePiece.deckIndex || !card) return card;
            if (card.isDual) return card;
            return { ...card, boardNodeId: node.id };
          }),
        }));

        const secondOptions = getAdjacentNodeIds(nodes, node.id).filter(id =>
          isNodeEmpty(id, movedOncePlacements, leadersPositions)
        );
        if (!secondOptions.length) {
          concludeAbilityUsage(movedOncePlacements, leadersPositions, 'Royal Guard berpindah ke dekat Leader.');
          return;
        }

        setAbilityContext({
          ...abilityContext,
          phase: 'royal-select-second',
          highlightNodes: secondOptions,
          originNodeId: node.id,
          data: {
            ...abilityContext.data,
            hasProgress: true,
            firstStepNodeId: node.id,
          },
        });
        setStatusMessage('Pilih satu petak yang disorot untuk langkah tambahan, atau tekan Cancel Ability untuk selesai.');
        return;
      }

      if (abilityContext.phase === 'royal-select-second') {
        if (!abilityContext.highlightNodes?.includes(node.id)) {
          setStatusMessage('Pilih salah satu petak yang disorot.');
          return;
        }

        const movedTwicePlacements = placements.map(p =>
          (p.playerKey === activePiece.playerKey &&
           p.deckIndex === activePiece.deckIndex &&
           (activePiece.tokenId == null || p.tokenId === activePiece.tokenId))
            ? { ...p, nodeId: node.id }
            : p
        );

        setPlacements(movedTwicePlacements);
        setDecks(prev => ({
          ...prev,
          [activePiece.playerKey]: prev[activePiece.playerKey].map((card, idx) => {
            if (idx !== activePiece.deckIndex || !card) return card;
            if (card.isDual) return card;
            return { ...card, boardNodeId: node.id };
          }),
        }));

        concludeAbilityUsage(movedTwicePlacements, leadersPositions, 'Royal Guard menyelesaikan langkah tambahan.');
        return;
      }

      setStatusMessage('Ability Royal Guard dibatalkan.');
      setAbilityContext(null);
      return;
    }

    if (abilityContext.id === 'lancegrappin') {
      const activePiece = getAbilityPieceInstance(abilityContext);
      if (!activePiece) {
        setAbilityContext(null);
        setStatusMessage('Selected unit is no longer available.');
        return;
      }

      if (abilityContext.phase === 'claw-select-target') {
        if (!abilityContext.highlightNodes?.includes(node.id)) {
          setStatusMessage('Pilih satu target yang disorot.');
          return;
        }

        const targetOcc = getNodeOccupant(node.id, leadersPositions, placements);
        if (!targetOcc) {
          setStatusMessage('Pilih satu target yang disorot.');
          return;
        }

        const targetMeta = abilityContext.data?.targets?.find((t) => t.nodeId === node.id);
        if (!targetMeta) {
          setStatusMessage('Pilih satu target yang disorot.');
          return;
        }

        // Use the ray metadata so we only ever step on real spaces.
        const moveSelfCandidate = targetMeta.prevToTargetId;
        const moveSelfId =
          moveSelfCandidate &&
          moveSelfCandidate !== activePiece.nodeId &&
          isNodeEmpty(moveSelfCandidate, placements, leadersPositions)
            ? moveSelfCandidate
            : null;

        const dragCandidate = targetMeta.rayFirstId;
        const dragId =
          dragCandidate &&
          dragCandidate !== node.id &&
          isNodeEmpty(dragCandidate, placements, leadersPositions)
            ? dragCandidate
            : null;

        // Can always move self closer (towards any visible target).
        // Drag/pull is only allowed against enemies.
        const canDragTarget = targetOcc.playerKey !== activePiece.playerKey;
        const options = [moveSelfId, canDragTarget ? dragId : null].filter(Boolean);
        if (!options.length) {
          setStatusMessage('Tidak ada aksi valid untuk Claw Launcher pada target ini.');
          return;
        }

        setAbilityContext({
          ...abilityContext,
          phase: 'claw-select-action',
          highlightNodes: options,
          data: {
            ...abilityContext.data,
            hasProgress: true,
            selectedTarget: {
              type: targetOcc.type,
              playerKey: targetOcc.playerKey,
              deckIndex: targetOcc.type === 'unit' ? targetOcc.deckIndex : null,
              tokenId: targetOcc.type === 'unit' ? (targetOcc.tokenId ?? null) : null,
              nodeId: node.id,
            },
            moveSelfId,
            dragId,
          },
        });
        setStatusMessage('Pilih petak dekat target untuk bergerak, atau petak dekat Claw untuk menarik target.' );
        return;
      }

      if (abilityContext.phase === 'claw-select-action') {
        const selectedTarget = abilityContext.data?.selectedTarget;
        const moveSelfId = abilityContext.data?.moveSelfId ?? null;
        const dragId = abilityContext.data?.dragId ?? null;
        if (!selectedTarget) {
          setAbilityContext(null);
          setStatusMessage('Target tidak valid.');
          return;
        }

        if (!abilityContext.highlightNodes?.includes(node.id)) {
          setStatusMessage('Pilih salah satu petak yang disorot.');
          return;
        }

        if (moveSelfId && node.id === moveSelfId) {
          const updatedPlacements = placements.map(p =>
            (p.playerKey === activePiece.playerKey &&
             p.deckIndex === activePiece.deckIndex &&
             (activePiece.tokenId == null || p.tokenId === activePiece.tokenId))
              ? { ...p, nodeId: moveSelfId }
              : p
          );
          setPlacements(updatedPlacements);
          setDecks(prev => ({
            ...prev,
            [activePiece.playerKey]: prev[activePiece.playerKey].map((card, idx) => {
              if (idx !== activePiece.deckIndex || !card) return card;
              if (card.isDual) return card;
              return { ...card, boardNodeId: moveSelfId };
            }),
          }));
          concludeAbilityUsage(updatedPlacements, leadersPositions, 'Claw Launcher bergerak mendekati target.');
          return;
        }

        if (dragId && node.id === dragId) {
          if (selectedTarget.playerKey === activePiece.playerKey) {
            setStatusMessage('Tidak bisa menarik karakter yang berada dalam pihak yang sama.');
            return;
          }
          if (isPieceProtectedFromEnemyMove(selectedTarget.playerKey, selectedTarget.nodeId, placements, leadersPositions)) {
            setStatusMessage('Target dilindungi oleh Protector; tidak bisa ditarik oleh ability musuh.');
            return;
          }

          if (selectedTarget.type === 'leader') {
            const updatedLeaderPositions = {
              ...leadersPositions,
              [selectedTarget.playerKey]: dragId,
            };
            concludeAbilityUsage(placements, updatedLeaderPositions, 'Claw Launcher menarik target sampai adjacent.');
            startNemesisReactionIfNeeded(selectedTarget.playerKey, placements, updatedLeaderPositions);
            return;
          }

          const targetUnit = placements.find(p =>
            p.playerKey === selectedTarget.playerKey &&
            p.deckIndex === selectedTarget.deckIndex &&
            (selectedTarget.tokenId == null || p.tokenId === selectedTarget.tokenId)
          );
          if (!targetUnit) {
            setAbilityContext(null);
            setStatusMessage('Target sudah tidak ada di papan.');
            return;
          }

          const updatedPlacements = placements.map(p => (p === targetUnit ? { ...p, nodeId: dragId } : p));
          setPlacements(updatedPlacements);
          setDecks(prev => ({
            ...prev,
            [targetUnit.playerKey]: prev[targetUnit.playerKey].map((card, idx) => {
              if (idx !== targetUnit.deckIndex || !card) return card;
              if (card.isDual) return card;
              return { ...card, boardNodeId: dragId };
            }),
          }));
          concludeAbilityUsage(updatedPlacements, leadersPositions, 'Claw Launcher menarik target sampai adjacent.');
          return;
        }

        setStatusMessage('Aksi Claw Launcher tidak valid.');
        return;
      }

      setStatusMessage('Ability Claw Launcher dibatalkan.');
      setAbilityContext(null);
      return;
    }

    if (abilityContext.id === 'tavernier') {
      const activePiece = getAbilityPieceInstance(abilityContext);
      if (!activePiece) {
        setAbilityContext(null);
        setStatusMessage('Selected unit is no longer available.');
        return;
      }

      if (abilityContext.phase === 'brew-select-ally') {
        if (!abilityContext.highlightNodes?.includes(node.id)) {
          setStatusMessage('Pilih satu ally adjacent yang disorot.');
          return;
        }

        const allyOcc = getNodeOccupant(node.id, leadersPositions, placements);
        if (!allyOcc || allyOcc.playerKey !== activePiece.playerKey) {
          setStatusMessage('Pilih satu ally adjacent yang disorot.');
          return;
        }

        const options = getAdjacentNodeIds(nodes, node.id).filter(id =>
          isNodeEmpty(id, placements, leadersPositions)
        );
        if (!options.length) {
          setStatusMessage('Tidak ada petak kosong di sekitar ally tersebut.');
          return;
        }

        setAbilityContext({
          ...abilityContext,
          phase: 'brew-select-destination',
          highlightNodes: options,
          data: {
            ...abilityContext.data,
            hasProgress: true,
            selectedAlly: {
              type: allyOcc.type,
              nodeId: node.id,
              playerKey: allyOcc.playerKey,
              deckIndex: allyOcc.type === 'unit' ? allyOcc.deckIndex : null,
              tokenId: allyOcc.type === 'unit' ? (allyOcc.tokenId ?? null) : null,
            },
          },
        });
        setStatusMessage('Pilih petak kosong di sekitar ally untuk memindahkannya 1 langkah.');
        return;
      }

      if (abilityContext.phase === 'brew-select-destination') {
        const selectedAlly = abilityContext.data?.selectedAlly;
        if (!selectedAlly) {
          setAbilityContext(null);
          setStatusMessage('Ally tidak valid.');
          return;
        }
        if (!abilityContext.highlightNodes?.includes(node.id)) {
          setStatusMessage('Pilih salah satu petak yang disorot.');
          return;
        }
        if (!isNodeEmpty(node.id, placements, leadersPositions)) {
          setStatusMessage('Petak ini sudah terisi.');
          return;
        }

        if (selectedAlly.type === 'leader') {
          const updatedLeaderPositions = {
            ...leadersPositions,
            [selectedAlly.playerKey]: node.id,
          };
          concludeAbilityUsage(placements, updatedLeaderPositions, 'Brewmaster memindahkan ally 1 langkah.');
          startNemesisReactionIfNeeded(selectedAlly.playerKey, placements, updatedLeaderPositions);
          return;
        }

        const allyUnit = placements.find(p =>
          p.playerKey === selectedAlly.playerKey &&
          p.deckIndex === selectedAlly.deckIndex &&
          (selectedAlly.tokenId == null || p.tokenId === selectedAlly.tokenId)
        );
        if (!allyUnit) {
          setAbilityContext(null);
          setStatusMessage('Ally sudah tidak ada di papan.');
          return;
        }

        const updatedPlacements = placements.map(p => (p === allyUnit ? { ...p, nodeId: node.id } : p));
        setPlacements(updatedPlacements);
        setDecks(prev => ({
          ...prev,
          [allyUnit.playerKey]: prev[allyUnit.playerKey].map((card, idx) => {
            if (idx !== allyUnit.deckIndex || !card) return card;
            if (card.isDual) return card;
            return { ...card, boardNodeId: node.id };
          }),
        }));

        concludeAbilityUsage(updatedPlacements, leadersPositions, 'Brewmaster memindahkan ally 1 langkah.');
        return;
      }

      setStatusMessage('Ability Brewmaster dibatalkan.');
      setAbilityContext(null);
      return;
    }

    if (abilityContext.id === 'cogneur') {
      const activePiece = getAbilityPieceInstance(abilityContext);
      if (!activePiece) {
        setAbilityContext(null);
        setStatusMessage('Selected unit is no longer available.');
        return;
      }

      if (abilityContext.phase === 'bruiser-select-target') {
        if (!abilityContext.highlightNodes?.includes(node.id)) {
          setStatusMessage('Pilih satu musuh adjacent yang disorot.');
          return;
        }

        const targetOcc = getNodeOccupant(node.id, leadersPositions, placements);
        if (!targetOcc || targetOcc.playerKey === activePiece.playerKey) {
          setStatusMessage('Pilih satu musuh adjacent yang disorot.');
          return;
        }

        if (isPieceProtectedFromEnemyMove(targetOcc.playerKey, node.id, placements, leadersPositions)) {
          setStatusMessage('Target dilindungi oleh Protector; tidak bisa digerakkan oleh ability musuh.');
          return;
        }

        const originNode = nodeMap.get(activePiece.nodeId);
        const targetNode = nodeMap.get(node.id);
        if (!originNode || !targetNode) {
          setAbilityContext(null);
          setStatusMessage('Posisi tidak lagi valid.');
          return;
        }

        const dx = targetNode.x - originNode.x;
        const dy = targetNode.y - originNode.y;

        const oppositeOptions = [];
        const baseX = targetNode.x;
        const baseY = targetNode.y;

        const addIfValid = (x, y) => {
          const candidate = findNodeByCoordinates(x, y);
          if (!candidate) return;
          if (!isNodeEmpty(candidate.id, placements, leadersPositions)) return;
          oppositeOptions.push(candidate.id);
        };

        // Three spaces "on the opposite side" of your choice around the line
        if (Math.abs(dx) > Math.abs(dy)) {
          // Target mostly in horizontal direction
          addIfValid(baseX + dx, baseY); // straight
          addIfValid(baseX + dx, baseY + 1);
          addIfValid(baseX + dx, baseY - 1);
        } else if (Math.abs(dy) > Math.abs(dx)) {
          // Vertical
          addIfValid(baseX, baseY + dy); // straight
          addIfValid(baseX + 1, baseY + dy);
          addIfValid(baseX - 1, baseY + dy);
        } else {
          // Diagonal or equal; approximate by extending vector
          addIfValid(baseX + dx, baseY + dy);
          addIfValid(baseX + dx, baseY);
          addIfValid(baseX, baseY + dy);
        }

        if (!oppositeOptions.length) {
          setStatusMessage('Tidak ada petak kosong di tiga petak belakang musuh.');
          return;
        }

        setAbilityContext({
          ...abilityContext,
          phase: 'bruiser-select-destination',
          highlightNodes: oppositeOptions,
          data: {
            ...abilityContext.data,
            hasProgress: true,
            selectedTarget: {
              type: targetOcc.type,
              nodeId: node.id,
              playerKey: targetOcc.playerKey,
              deckIndex: targetOcc.type === 'unit' ? targetOcc.deckIndex : null,
              tokenId: targetOcc.type === 'unit' ? (targetOcc.tokenId ?? null) : null,
            },
          },
        });
        setStatusMessage('Pilih salah satu dari tiga petak di belakang musuh untuk mendorongnya.');
        return;
      }

      if (abilityContext.phase === 'bruiser-select-destination') {
        const selected = abilityContext.data?.selectedTarget;
        if (!selected) {
          setAbilityContext(null);
          setStatusMessage('Musuh tidak lagi tersedia.');
          return;
        }

        if (!abilityContext.highlightNodes?.includes(node.id)) {
          setStatusMessage('Pilih salah satu petak yang disorot.');
          return;
        }

        if (!isNodeEmpty(node.id, placements, leadersPositions)) {
          setStatusMessage('Petak ini sudah terisi. Pilih petak lain.');
          return;
        }

        const targetNodeId = selected.nodeId;
        let updatedLeaderPositions = leadersPositions;
        let updatedPlacements = placements;

        // Move Bruiser into the target's original space
        updatedPlacements = updatedPlacements.map(p => {
          if (p.playerKey === activePiece.playerKey &&
              p.deckIndex === activePiece.deckIndex &&
              (activePiece.tokenId == null || p.tokenId === activePiece.tokenId)) {
            return { ...p, nodeId: targetNodeId };
          }
          return p;
        });

        // Push the target to the chosen destination
        if (selected.type === 'leader') {
          updatedLeaderPositions = {
            ...updatedLeaderPositions,
            [selected.playerKey]: node.id,
          };
        } else {
          const targetUnit = updatedPlacements.find(p =>
            p.nodeId === targetNodeId &&
            p.playerKey === selected.playerKey &&
            p.deckIndex === selected.deckIndex &&
            (selected.tokenId == null || p.tokenId === selected.tokenId)
          );
          if (!targetUnit) {
            setAbilityContext(null);
            setStatusMessage('Musuh tersebut sudah tidak ada.');
            return;
          }

          updatedPlacements = updatedPlacements.map(p =>
            p === targetUnit ? { ...p, nodeId: node.id } : p
          );
        }

        if (wouldTrapSelf(nodes, activePiece.playerKey, updatedPlacements, updatedLeaderPositions)) {
          setStatusMessage('Langkah ini membuat Leader-mu tertangkap/terkepung, tidak valid.');
          return;
        }

        setPlacements(updatedPlacements);
        setDecks(prev => ({
          ...prev,
          [activePiece.playerKey]: prev[activePiece.playerKey].map((card, idx) => {
            if (idx !== activePiece.deckIndex || !card) return card;
            if (card.isDual) return card;
            return { ...card, boardNodeId: targetNodeId };
          }),
          ...(selected.type === 'unit'
            ? {
              [selected.playerKey]: prev[selected.playerKey].map((card, idx) => {
                if (idx !== selected.deckIndex || !card) return card;
                if (card.isDual) return card;
                return { ...card, boardNodeId: node.id };
              }),
            }
            : {}),
        }));

        concludeAbilityUsage(updatedPlacements, updatedLeaderPositions, 'Bruiser mendorong musuh ke belakang dan maju ke tempatnya.');
        if (selected.type === 'leader') {
          startNemesisReactionIfNeeded(selected.playerKey, updatedPlacements, updatedLeaderPositions);
        }
        return;
      }

      setStatusMessage('Ability Bruiser dibatalkan.');
      setAbilityContext(null);
      return;
    }

    if (abilityContext.id === 'illusionniste') {
      const activePiece = getAbilityPieceInstance(abilityContext);
      if (!activePiece) {
        setAbilityContext(null);
        setStatusMessage('Selected unit is no longer available.');
        return;
      }

      if (abilityContext.phase === 'illusionist-select-target') {
        if (!abilityContext.highlightNodes?.includes(node.id)) {
          setStatusMessage('Pilih satu karakter yang disorot untuk bertukar posisi.');
          return;
        }

        const targetOcc = getNodeOccupant(node.id, leadersPositions, placements);
        if (!targetOcc) {
          setStatusMessage('Pilih satu karakter yang disorot untuk bertukar posisi.');
          return;
        }

        const originNodeId = activePiece.nodeId;
        const targetNodeId = node.id;

        let updatedLeaderPositions = leadersPositions;
        let updatedPlacements = placements;

        // Move Illusionist to target space
        updatedPlacements = updatedPlacements.map(p => {
          if (p.playerKey === activePiece.playerKey &&
              p.deckIndex === activePiece.deckIndex &&
              (activePiece.tokenId == null || p.tokenId === activePiece.tokenId)) {
            return { ...p, nodeId: targetNodeId };
          }
          return p;
        });

        if (targetOcc.type === 'leader') {
          updatedLeaderPositions = {
            ...updatedLeaderPositions,
            [targetOcc.playerKey]: originNodeId,
          };
        } else {
          const targetUnit = updatedPlacements.find(p =>
            p.nodeId === targetNodeId &&
            p.playerKey === targetOcc.playerKey &&
            p.deckIndex === targetOcc.deckIndex &&
            (targetOcc.tokenId == null || p.tokenId === targetOcc.tokenId)
          );
          if (!targetUnit) {
            setAbilityContext(null);
            setStatusMessage('Target sudah tidak ada di papan.');
            return;
          }

          updatedPlacements = updatedPlacements.map(p =>
            p === targetUnit ? { ...p, nodeId: originNodeId } : p
          );
        }

        setPlacements(updatedPlacements);
        setDecks(prev => ({
          ...prev,
          [activePiece.playerKey]: prev[activePiece.playerKey].map((card, idx) => {
            if (idx !== activePiece.deckIndex || !card) return card;
            if (card.isDual) return card;
            return { ...card, boardNodeId: targetNodeId };
          }),
          ...(targetOcc.type === 'unit'
            ? {
              [targetOcc.playerKey]: prev[targetOcc.playerKey].map((card, idx) => {
                if (idx !== targetOcc.deckIndex || !card) return card;
                if (card.isDual) return card;
                return { ...card, boardNodeId: originNodeId };
              }),
            }
            : {}),
        }));

        concludeAbilityUsage(updatedPlacements, updatedLeaderPositions, 'Illusionist menukar posisi dengan target.');
        if (targetOcc.type === 'leader') {
          startNemesisReactionIfNeeded(targetOcc.playerKey, updatedPlacements, updatedLeaderPositions);
        }
        return;
      }

      setStatusMessage('Ability Illusionist dibatalkan.');
      setAbilityContext(null);
      return;
    }

    if (abilityContext.id === 'rodeuse') {
      const activePiece = getAbilityPieceInstance(abilityContext);
      if (!activePiece) {
        setAbilityContext(null);
        setStatusMessage('Selected unit is no longer available.');
        return;
      }

      if (abilityContext.phase === 'wanderer-select-destination') {
        if (!abilityContext.highlightNodes?.includes(node.id)) {
          setStatusMessage('Pilih salah satu petak yang disorot.');
          return;
        }

        const updatedPlacements = placements.map(p =>
          (p.playerKey === activePiece.playerKey &&
           p.deckIndex === activePiece.deckIndex &&
           (activePiece.tokenId == null || p.tokenId === activePiece.tokenId))
            ? { ...p, nodeId: node.id }
            : p
        );

        setPlacements(updatedPlacements);
        setDecks(prev => ({
          ...prev,
          [activePiece.playerKey]: prev[activePiece.playerKey].map((card, idx) => {
            if (idx !== activePiece.deckIndex || !card) return card;
            if (card.isDual) return card;
            return { ...card, boardNodeId: node.id };
          }),
        }));

        concludeAbilityUsage(updatedPlacements, leadersPositions, 'Wanderer berpindah ke petak yang aman dari musuh.');
        return;
      }

      setStatusMessage('Ability Wanderer dibatalkan.');
      setAbilityContext(null);
      return;
    }

    setStatusMessage('This ability is not implemented yet.');
    setAbilityContext(null);
  };

  // Counts "characters" (deck slots) rather than tokens, so Hermit+Cub counts as 1.
  const getPlayerPieceCount = (playerKey) => {
    const indexes = new Set(
      placements
        .filter(piece => piece.playerKey === playerKey)
        .map(piece => piece.deckIndex)
    );
    return indexes.size;
  };

  const handlePostMove = (playerLabel) => {
    if (isGameOver) return;
    const playerKey = playerLabelToKey(playerLabel);
    const piecesCount = getPlayerPieceCount(playerKey);
    const hasDraftOptions = leaders.some(Boolean);
    if (bothDecksFull || piecesCount >= 4 || !hasDraftOptions) {
      toggleTurn();
    } else {
      setCanPickFor(playerLabel);
      // Reine gets 2 recruit picks only on her first ever recruit phase.
      const initialAllowance = (playerKey === reinePlayerKey && !p2RecruitBonusUsed) ? 2 : 1;
      setRecruitPickRemaining(initialAllowance);
    }
  };

  function toggleTurn() {
    if (isGameOver) return;
    const nextTurn = currentTurn === 'Player 1' ? 'Player 2' : 'Player 1';
    const nextKey = playerLabelToKey(nextTurn);
    setCurrentTurn(nextTurn);
    setTurnCount((prev) => (Number.isFinite(prev) ? prev + 1 : 2));
    setClocks((prev) => ({ ...prev, [nextKey]: TURN_TIME_SECONDS }));
    setSelectedLeader(null);
    setSelectedUnit(null);
    setSelectedNode(null);
    setCanPickFor(null);
    setRecruitPickRemaining(0);
    setSelectedSummon(null);
    resetMovementTracker();
    setStatusMessage('');
  }

  function handleTurnTimeout(ownerKey) {
    if (isGameOver) return;

    // Forced off-turn interaction (Nemesis) gets auto-resolved to prevent deadlocks.
    if (abilityContext?.data?.isForced && abilityContext?.data?.allowOffTurn && abilityContext?.playerKey === ownerKey) {
      if (abilityContext.id === 'nemesis') {
        const fallbackId = abilityContext.highlightNodes?.[0];
        const fallbackNode = nodes.find((n) => n.id === fallbackId);
        if (fallbackNode) {
          handleAbilityNodeInteraction(fallbackNode);
          grantMoveBonus(ownerKey);
        }
      }
      return;
    }

    // Forced placement (e.g. recruit token placement)
    if (selectedSummon?.forced && selectedSummon.playerKey === ownerKey) {
      const firstValid = nodes.find((n) =>
        isValidPlacementNode(ownerKey, n) && isNodeEmpty(n.id, placements, leadersPositions)
      );
      if (firstValid) {
        attemptPlacement(firstValid);
        grantMoveBonus(ownerKey);
      }
      return;
    }

    // Normal timeout: end the turn.
    if (playerLabelToKey(currentTurn) === ownerKey) {
      setStatusMessage(`${playerKeyToLabel(ownerKey)} kehabisan waktu. Turn berakhir.`);
      toggleTurn();
    }
  }

  const timeoutGuardRef = useRef({});
  useEffect(() => {
    if (isGameOver) return;
    const ownerKey = activeClockOwnerKey;
    const remaining = clocks?.[ownerKey] ?? 0;
    const guardKey = `${ownerKey}:${turnCount}:${abilityContext?.id ?? 'none'}:${Boolean(selectedSummon?.forced)}`;
    if (remaining > 0) {
      timeoutGuardRef.current[ownerKey] = null;
      return;
    }
    if (timeoutGuardRef.current[ownerKey] === guardKey) return;
    timeoutGuardRef.current[ownerKey] = guardKey;
    handleTurnTimeout(ownerKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClockOwnerKey, clocks, isGameOver, turnCount, abilityContext, selectedSummon, currentTurn]);

  useEffect(() => {
    if (isGameOver) return;
    const ownerKey = activeClockOwnerKey;
    const timer = setInterval(() => {
      setClocks((prev) => {
        const current = Math.max(0, Number(prev?.[ownerKey] ?? 0));
        if (current <= 0) return prev;
        return { ...prev, [ownerKey]: current - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeClockOwnerKey, isGameOver]);

  // --- AI Integration ---
  useEffect(() => {
    // If a forced interaction is active (e.g., Nemesis reaction), pause AI until resolved.
    if (abilityContext?.data?.isForced) return;
    if (gameMode === 'ai' && currentTurn === 'Player 2' && !isGameOver) {
      const ai = new GameAI({
        leaders,
        decks,
        placements,
        leadersPositions,
        currentTurn,
        movementTracker,
        retiredCards,
        recruitPickRemaining,
      });

      const timer = setTimeout(() => {
        const move = ai.decideMove('p2');
        if (move) {
          executeAIMove(move);
        } else {
          console.warn('AI found no valid move. Skipping turn.');
          toggleTurn();
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abilityContext, currentTurn, gameMode, isGameOver, leaders, decks, placements, leadersPositions, movementTracker, recruitPickRemaining, retiredCards]);

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

  const getNemesisReactionDestinations = (originNodeId, placementsState, leaderPositionsState) => {
    const step1 = getAdjacentNodeIds(nodes, originNodeId).filter((id) =>
      isNodeEmpty(id, placementsState, leaderPositionsState)
    );

    const step2 = new Set();
    for (const mid of step1) {
      const options = getAdjacentNodeIds(nodes, mid).filter((id) =>
        id !== originNodeId && isNodeEmpty(id, placementsState, leaderPositionsState)
      );
      options.forEach((id) => step2.add(id));
    }

    if (step2.size > 0) {
      return { steps: 2, destinations: Array.from(step2) };
    }
    if (step1.length > 0) {
      return { steps: 1, destinations: step1 };
    }
    return { steps: 0, destinations: [] };
  };

  const startNemesisReactionIfNeeded = (movedLeaderKey, placementsState, leaderPositionsState) => {
    const nemesisOwnerKey = movedLeaderKey === 'p1' ? 'p2' : 'p1';
    const nemesisPiece = placementsState.find((p) => p.playerKey === nemesisOwnerKey && p.cardKey === 'nemesis');
    if (!nemesisPiece) return false;

    const { steps, destinations } = getNemesisReactionDestinations(
      nemesisPiece.nodeId,
      placementsState,
      leaderPositionsState
    );
    if (steps <= 0 || destinations.length === 0) return false;

    setAbilityContext({
      id: 'nemesis',
      abilityName: 'Nemesis',
      playerKey: nemesisOwnerKey,
      playerLabel: playerKeyToLabel(nemesisOwnerKey),
      deckIndex: nemesisPiece.deckIndex,
      tokenId: nemesisPiece.tokenId ?? null,
      originNodeId: nemesisPiece.nodeId,
      phase: 'nemesis-react',
      highlightNodes: destinations,
      data: {
        isForced: true,
        allowOffTurn: true,
        steps,
        triggeredByLeaderKey: movedLeaderKey,
      },
    });

    setClocks((prev) => ({
      ...prev,
      [nemesisOwnerKey]: TURN_TIME_SECONDS,
    }));

    setStatusMessage(`Nemesis harus bergerak ${steps} langkah: ${playerKeyToLabel(nemesisOwnerKey)} pilih petak yang disorot.`);
    return true;
  };

  const isPieceProtectedFromEnemyMove = (targetPlayerKey, targetNodeId, placementsState, leaderPositionsState) => {
    // Protector: enemy abilities may not move the Protector or any adjacent allies.
    const protector = placementsState.find(p => p.playerKey === targetPlayerKey && p.cardKey === 'protecteur');
    if (!protector) return false;
    if (protector.nodeId === targetNodeId) return true;
    const adjacentToProtector = getAdjacentNodeIds(nodes, protector.nodeId);
    return adjacentToProtector.includes(targetNodeId)
      || leaderPositionsState[targetPlayerKey] === protector.nodeId; // edge safety
  };

  const hasVizierOnBoard = (playerKey, placementsState = placements) =>
    placementsState.some((piece) => piece.playerKey === playerKey && piece.cardKey === 'vizir');

  const getLeaderReachableNodeIds = (
    playerKey,
    fromNodeId,
    maxSteps,
    placementsState = placements,
    leaderPositionsState = leadersPositions
  ) => {
    const steps = Math.max(1, Number(maxSteps) || 1);
    const visited = new Set([fromNodeId]);
    let frontier = [fromNodeId];
    const reachable = new Set();

    for (let depth = 0; depth < steps; depth += 1) {
      const nextFrontier = [];
      for (const currentId of frontier) {
        const neighbors = getAdjacentNodeIds(nodes, currentId);
        for (const neighborId of neighbors) {
          if (visited.has(neighborId)) continue;
          visited.add(neighborId);
          if (!isNodeEmpty(neighborId, placementsState, leaderPositionsState)) continue;
          reachable.add(neighborId);
          nextFrontier.push(neighborId);
        }
      }
      frontier = nextFrontier;
      if (!frontier.length) break;
    }

    return reachable;
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
      const leaderKey = selectedLeader.playerKey;
      const leaderSteps = hasVizierOnBoard(leaderKey) ? 2 : 1;
      const reachable = getLeaderReachableNodeIds(leaderKey, fromNode, leaderSteps, placements, leadersPositions);

      if (reachable.has(toNode)) {
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

        grantMoveBonus(leaderKey);

        // First resolve win/lose checks from the leader move itself.
        if (finalizeActionOutcome(placements, nextPositions)) {
          return;
        }

        // Then, if the opponent has a Nemesis on board, force a mid-turn reaction.
        startNemesisReactionIfNeeded(leaderKey, placements, nextPositions);
      }
      return;
    }

    if (selectedUnit) {
      const fromNode = selectedUnit.nodeId;
      const toNode = nodeId;
      if (isNodeEmpty(toNode, placements, leadersPositions) && isWithinMoveRange(nodes, fromNode, toNode)) {
        const playerKey = selectedUnit.playerKey;
        const nextPlacements = placements.map(piece => {
          const isSamePiece =
            piece.playerKey === playerKey
            && piece.deckIndex === selectedUnit.deckIndex
            && (selectedUnit.tokenId == null || piece.tokenId === selectedUnit.tokenId);

          if (isSamePiece) {
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
        markUnitMoved(playerKey, selectedUnit.deckIndex, selectedUnit.tokenId ?? null);
        grantMoveBonus(playerKey);
        finalizeActionOutcome(nextPlacements, leadersPositions);
      }
      return;
    }
  };

  const handlePickCard = (index) => {
    if (isGameOver) return;
    if (!canPickFor) return;
    if (currentTurn !== canPickFor) return;
    if (recruitPickRemaining <= 0) {
      setStatusMessage('Batas pengambilan kartu untuk recruit sudah tercapai.');
      return;
    }
    if (bothDecksFull) {
      setCanPickFor(null);
      toggleTurn();
      return;
    }


    const card = leaders[index];
    if (!card) return; // no card to pick

    const playerKey = playerLabelToKey(canPickFor);

    // Reine gets 2 picks only on her first ever recruit pick.
    if (playerKey === reinePlayerKey && !p2RecruitBonusUsed) {
      setP2RecruitBonusUsed(true);
    }

    const picksRemainingAfterThisPick = Math.max(0, recruitPickRemaining - 1);
    setRecruitPickRemaining(picksRemainingAfterThisPick);

    const totalPieces = getPlayerPieceCount(playerKey);
    if (totalPieces >= 4) {
      console.warn(`Maximum characters reached for ${canPickFor}`);
      setCanPickFor(null);
      toggleTurn();
      return;
    }

    const boardImage = getBoardAssetForPlayer(card, playerKey) ?? card;
    // Hermit & Cub is one character; never store the cub key as a separate deck card.
    const rawCardKey = extractPortraitKey(card);
    const cardKey = rawCardKey === 'ourson' ? 'vieilours' : rawCardKey;
    const cardInfo = getCardMetaFromAlias(cardKey);
    const isDual = isDualCharacter(cardKey);
    const deckPortrait = cardKey === 'vieilours' ? hermitPortrait : card;
    const emptySlot = decks[playerKey].findIndex(slot => !slot);
    if (emptySlot === -1) {
      console.warn('No empty deck slot available.');
      setCanPickFor(null);
      toggleTurn();
      return;
    }

    const updatedRetired = retiredCards.includes(card) ? retiredCards : [...retiredCards, card];
    const cardData = {
      portrait: deckPortrait,
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
      recruit: true,
      recruitPicksRemaining: picksRemainingAfterThisPick,
    });
  };

  const attemptPlacement = (node) => {
    if (isGameOver) return;
    if (!selectedSummon || !node) return;
    const { playerKey, cardIndex, pendingTokens } = selectedSummon;
    const isRecruitPlacement = Boolean(selectedSummon.recruit);
    const recruitPicksRemaining = selectedSummon.recruitPicksRemaining ?? 0;
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

    // Hermit & Cub are treated as ONE character card, but placed as TWO tokens.
    // Player chooses placement for Hermit first, then chooses placement for Cub.
    const hasMoreTokenToPlace = Boolean(tokenQueue && tokenQueue.length > 1);
    if (hasMoreTokenToPlace) {
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

      grantMoveBonus(playerKey);

      // Continue forced placement for the next token (Cub)
      setSelectedSummon((prev) => (prev
        ? {
          ...prev,
          forced: true,
          pendingTokens: tokenQueue.slice(1),
        }
        : prev
      ));

      setStatusMessage('Sekarang pilih petak untuk Cub (hewan peliharaan).');
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
    setSelectedSummon(null);
    setStatusMessage('');

    grantMoveBonus(playerKey);
    if (finalizeActionOutcome(nextPlacements, leadersPositions)) {
      return;
    }

    // If this was a recruit placement and there are picks remaining, keep the turn
    // and allow another recruit pick (Player 2 first recruit can do this once).
    if (isRecruitPlacement && canPickFor === currentTurn && recruitPicksRemaining > 0) {
      const piecesCountAfter = nextPlacements.filter(p => p.playerKey === playerKey).length;
      const hasDraftOptions = leaders.some(Boolean);
      const hasEmptyDeckSlot = nextDecks[playerKey].some(slot => !slot);
      if (!isGameOver && piecesCountAfter < 4 && hasDraftOptions && hasEmptyDeckSlot) {
        setStatusMessage('Silakan ambil 1 kartu lagi untuk recruit.');
        return;
      }
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
    setSelectedSummon({
      player: playerLabel,
      playerKey,
      cardIndex,
      image: card.boardImage,
      forced: false,
      pendingTokens: pendingTokens && pendingTokens.length ? pendingTokens : null,
    });
  };

  const isWithinHighlight = (node) => {
    if (!selectedNode) return false;

    if (selectedLeader) {
      const leaderKey = selectedLeader.playerKey;
      const leaderSteps = hasVizierOnBoard(leaderKey) ? 2 : 1;
      const reachable = getLeaderReachableNodeIds(leaderKey, selectedLeader.nodeId, leaderSteps, placements, leadersPositions);
      return reachable.has(node.id);
    }

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
        <div className="flex flex-col">
          <div className="text-2xl font-bold text-gray-800">
            Current Turn: <span className={currentTurn === 'Player 1' ? 'text-red-500' : 'text-cyan-500'}>{currentTurn}</span>
          </div>
          <div className="text-xs font-semibold text-gray-600">Turn {turnCount}</div>
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
            disabled={selectedSummon?.forced || abilityContext?.data?.isForced}
            className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded shadow transition-colors ${(selectedSummon?.forced || abilityContext?.data?.isForced) ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                const leaderKey = image ? extractPortraitKey(image) : '';
                const shownImage = (leaderKey === 'ourson' || leaderKey === 'vieilours')
                  ? hermitPortrait
                  : image;
                const isClickable = Boolean(
                  canPickFor &&
                  currentTurn === canPickFor &&
                  recruitPickRemaining > 0 &&
                  image &&
                  !bothDecksFull
                );
                const displayName = getCardDisplayName(shownImage);
                const abilityText = getCardAbility(shownImage);
                return (
                  <RecruitOptionCard
                    key={`left-card-${i}`}
                    image={shownImage}
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
        <div className={`relative h-[90vh] transition-transform duration-700 ${isPlayer1Turn ? 'rotate-180' : ''}`}>
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
                  const hasActiveAbility = Boolean(
                    abilityType === 'active' &&
                    occupantType === 'unit' &&
                    placedPiece
                  );
                  const canActivateAbility = Boolean(
                    hasActiveAbility &&
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
                          className={`w-full h-full object-cover transition-all duration-200 ${opacityClass} ${isPlayer1Turn ? 'rotate-180' : ''}`}
                        />
                      )}
                      {hasActiveAbility && placedPiece && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!canActivateAbility) return;
                            startAbilityForPiece(placedPiece);
                          }}
                          disabled={!canActivateAbility}
                          className={`absolute bottom-1 right-1 w-7 h-7 rounded-full text-white text-xs font-bold shadow-lg border border-white/40 ${
                            canActivateAbility
                              ? 'bg-purple-600 hover:bg-purple-500 cursor-pointer'
                              : 'bg-gray-600/70 opacity-60 cursor-not-allowed'
                          }`}
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
          <div className="flex items-baseline gap-3 mr-2">
            <span className={`text-sm font-bold ${activeClockOwnerKey === 'p1' ? 'text-red-500' : 'text-gray-600'}`}>
              {gameMode === 'ai' ? 'Player' : 'Player 1'} {formatClock(clocks.p1)}
            </span>
            <span className="text-red-400 font-bold text-2xl drop-shadow-md tracking-wide">Player 1 Deck ({decks.p1.filter(Boolean).length})</span>
          </div>
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
          <div className="flex items-baseline gap-3 mr-2">
            <span className={`text-sm font-bold ${activeClockOwnerKey === 'p2' ? 'text-cyan-300' : 'text-gray-300'}`}>
              {gameMode === 'ai' ? 'AI' : 'Player 2'} {formatClock(clocks.p2)}
            </span>
            <span className="text-cyan-400 font-bold text-2xl drop-shadow-md tracking-wide">Player 2 Deck ({decks.p2.filter(Boolean).length})</span>
          </div>
          <div className="bg-black/90 border-2 border-[#4f3d31] rounded-[28px] px-6 py-4 shadow-[0_18px_35px_rgba(0,0,0,0.55)]">
            <div className="flex items-center gap-5">
              <div className="flex flex-col items-center gap-1">
                <CardSlot image={gameLeaders.p2.handImage} bgColor="bg-black" borderColor="border-[#f6dcb5]" />
              </div>
              <div className="flex gap-3">
                {DECK_INDEXES.map(idx => {
                  <span className="text-cyan-400 font-bold text-2xl drop-shadow-md tracking-wide">Player 2 Deck ({decks.p2.filter(Boolean).length})</span>
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
