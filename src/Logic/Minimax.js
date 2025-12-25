import { getRecruitmentValue, getDynamicWeight, CHARACTER_WEIGHTS } from './AIWeights';
import { 
    evaluateLeaderState, 
    getAdjacentNodeIds, 
    isNodeEmpty, 
    getAcrobatLandingOptions, 
    getRiderLandingOptions,
    getNodeOccupant,
    playerKeyToLabel,
    playerLabelToKey,
    buildPlacementRecord
} from './GameUtils';
import { getBoardNodes } from './Board';
import {
    getManipulatorTargets,
    getRoyalGuardMoves,
    getClawLauncherTargets,
    getBrewmasterTargets,
    getBruiserTargets,
    getIllusionistTargets,
    getWandererDestinations
} from './AbilityUtils';

const NODES = getBoardNodes();
const MAX_DEPTH = 3; // Optimal depth for web
const INFINITY = 1000000;

// Portrait filename to cardKey mapping (same as GameUtils)
const PORTRAIT_KEY_MAPPING = {
    'ancien': 'protecteur',
    'cuisinier': 'tavernier',
    'disrupteur': 'geolier',
    'furie': 'rodeuse',
    'maitredesbetes': 'vieilours',
    'oracle': 'vizir',
    'ours': 'ourson',
    'shifter': 'illusionniste',
};

const extractCardKey = (cardUrl) => {
    const fileName = cardUrl.split('/').pop()?.split('?')[0] ?? '';
    let base = fileName.replace(/^LEADERS[-_]/i, '');
    base = base.replace(/\.(tif|tiff|png)$/i, '');
    base = base.replace(/[-_]?LQ$/i, '');
    const normalized = base.toLowerCase().replace(/[^a-z0-9]/g, '');
    return PORTRAIT_KEY_MAPPING[normalized] ?? normalized;
};

/**
 * Main Entry Point for AI Decision
 */
export const getBestMove = (gameState, aiPlayerKey) => {
    const start = performance.now();
    
    // 1. Determine Phase (Recruitment or Action)
    const isRecruitmentPhase = gameState.recruitPickRemaining > 0;
    
    // 2. For Recruitment, use simple greedy selection based on weights
    if (isRecruitmentPhase) {
        const recruitMoves = [];
        gameState.leaders.forEach((card, index) => {
            if (card) {
                const cardKey = extractCardKey(card);
                const value = getRecruitmentValue(cardKey);
                recruitMoves.push({ type: 'RECRUIT', index, card, cardKey, value });
            }
        });
        
        // Sort by value (highest first) and pick the best
        recruitMoves.sort((a, b) => b.value - a.value);
        
        const end = performance.now();
        const bestRecruit = recruitMoves[0] || null;
        console.log(`AI Recruitment: ${(end - start).toFixed(2)}ms | Best: ${bestRecruit?.cardKey} (${bestRecruit?.value})`, recruitMoves);
        
        return bestRecruit;
    }
    
    // 3. For Action Phase, use Minimax
    const result = minimax(
        gameState, 
        MAX_DEPTH, 
        -INFINITY, 
        INFINITY, 
        true, 
        aiPlayerKey, 
        false
    );

    const end = performance.now();
    console.log(`AI Thought Time: ${(end - start).toFixed(2)}ms | Score: ${result.score} | Move:`, result.move);

    return result.move;
};

/**
 * Minimax Algorithm with Alpha-Beta Pruning
 */
const minimax = (state, depth, alpha, beta, isMaximizing, aiPlayerKey, isRecruitment) => {
    // Base Case: Depth limit reached or Game Over
    const outcome = checkGameOver(state);
    if (depth === 0 || outcome) {
        return { score: evaluateState(state, aiPlayerKey, outcome) };
    }

    const currentPlayer = isMaximizing ? aiPlayerKey : (aiPlayerKey === 'p1' ? 'p2' : 'p1');
    const possibleMoves = getAllPossibleMoves(state, currentPlayer, isRecruitment);

    if (possibleMoves.length === 0) {
        return { score: evaluateState(state, aiPlayerKey, null) };
    }

    let bestMove = null;

    if (isMaximizing) {
        let maxEval = -INFINITY;
        for (const move of possibleMoves) {
            const nextState = applyMove(state, move);
            const evalResult = minimax(nextState, depth - 1, alpha, beta, false, aiPlayerKey, isRecruitment);
            
            if (evalResult.score > maxEval) {
                maxEval = evalResult.score;
                bestMove = move;
            }
            alpha = Math.max(alpha, evalResult.score);
            if (beta <= alpha) break; // Pruning
        }
        return { score: maxEval, move: bestMove };
    } else {
        let minEval = INFINITY;
        for (const move of possibleMoves) {
            const nextState = applyMove(state, move);
            const evalResult = minimax(nextState, depth - 1, alpha, beta, true, aiPlayerKey, isRecruitment);
            
            if (evalResult.score < minEval) {
                minEval = evalResult.score;
                bestMove = move;
            }
            beta = Math.min(beta, evalResult.score);
            if (beta <= alpha) break; // Pruning
        }
        return { score: minEval, move: bestMove };
    }
};

/**
 * Evaluation Function (The "Brain")
 */
const evaluateState = (state, aiPlayerKey, outcome) => {
    if (outcome) {
        if (outcome.winner === playerKeyToLabel(aiPlayerKey)) return INFINITY; // AI Wins
        return -INFINITY; // AI Loses
    }

    const enemyKey = aiPlayerKey === 'p1' ? 'p2' : 'p1';
    let score = 0;

    // 1. Material Score (Units on Board)
    state.placements.forEach(p => {
        const weight = getDynamicWeight(p.cardKey, state.decks[enemyKey]);
        if (p.playerKey === aiPlayerKey) score += weight;
        else score -= weight;
    });

    // 2. Hand Score (Potential)
    state.decks[aiPlayerKey]?.forEach(c => {
        if (c) score += (getRecruitmentValue(c.cardKey) * 0.5); // Hand value is 50% of board value
    });
    state.decks[enemyKey]?.forEach(c => {
        if (c) score -= (getRecruitmentValue(c.cardKey) * 0.5);
    });

    // 3. Leader Safety (Crucial)
    const aiSafety = evaluateLeaderState(aiPlayerKey, state.placements, state.leadersPositions);
    const enemySafety = evaluateLeaderState(enemyKey, state.placements, state.leadersPositions);

    if (aiSafety.captured || aiSafety.surrounded) score -= 5000; // Danger!
    if (enemySafety.captured || enemySafety.surrounded) score += 5000; // Winning chance!

    // 4. Positional Advantage for Units
    const enemyLeaderPos = NODES.find(n => n.id === state.leadersPositions[enemyKey]);
    const aiLeaderPos = NODES.find(n => n.id === state.leadersPositions[aiPlayerKey]);
    
    state.placements.forEach(p => {
        const unitNode = NODES.find(n => n.id === p.nodeId);
        if (!unitNode) return;

        if (p.playerKey === aiPlayerKey) {
            // Bonus for AI units being close to enemy leader (offensive pressure)
            if (enemyLeaderPos) {
                const distToEnemyLeader = Math.abs(unitNode.col - enemyLeaderPos.col) + Math.abs(unitNode.row - enemyLeaderPos.row);
                score += Math.max(0, (6 - distToEnemyLeader) * 10); // Closer = better
            }
            
            // Bonus for AI units being adjacent to enemy leader (VERY good)
            const adjacentToEnemy = getAdjacentNodeIds(NODES, p.nodeId).includes(state.leadersPositions[enemyKey]);
            if (adjacentToEnemy) score += 200;

            // Bonus for protecting own leader (units near own leader)
            if (aiLeaderPos) {
                const distToOwnLeader = Math.abs(unitNode.col - aiLeaderPos.col) + Math.abs(unitNode.row - aiLeaderPos.row);
                if (distToOwnLeader <= 2) score += 15; // Defensive bonus
            }
        } else {
            // Penalty for enemy units close to AI leader
            if (aiLeaderPos) {
                const distToAILeader = Math.abs(unitNode.col - aiLeaderPos.col) + Math.abs(unitNode.row - aiLeaderPos.row);
                score -= Math.max(0, (6 - distToAILeader) * 10);
            }
            
            // Big penalty if enemy adjacent to AI leader
            const adjacentToAI = getAdjacentNodeIds(NODES, p.nodeId).includes(state.leadersPositions[aiPlayerKey]);
            if (adjacentToAI) score -= 200;
        }
    });

    // 5. Leader Mobility (Having escape routes)
    const aiLeaderAdjacents = getAdjacentNodeIds(NODES, state.leadersPositions[aiPlayerKey]);
    const aiLeaderEmptySpaces = aiLeaderAdjacents.filter(id => isNodeEmpty(id, state.placements, state.leadersPositions)).length;
    score += aiLeaderEmptySpaces * 5; // More escape routes = safer

    const enemyLeaderAdjacents = getAdjacentNodeIds(NODES, state.leadersPositions[enemyKey]);
    const enemyLeaderEmptySpaces = enemyLeaderAdjacents.filter(id => isNodeEmpty(id, state.placements, state.leadersPositions)).length;
    score -= enemyLeaderEmptySpaces * 5; // Trap enemy leader

    return score;
};

/**
 * Move Generator
 */
const getAllPossibleMoves = (state, playerKey, isRecruitment) => {
    const moves = [];

    if (isRecruitment) {
        // Generate Recruitment Moves
        state.leaders.forEach((card, index) => {
            if (card) {
                moves.push({ type: 'RECRUIT', index, card });
            }
        });
    } else {
        // Generate Gameplay Moves
        
        // 1. Leader Moves (only if leader hasn't moved this turn)
        const hasLeaderMoved = state.movementTracker?.[playerKey]?.leader === true;
        if (!hasLeaderMoved) {
            const leaderNodeId = state.leadersPositions[playerKey];
            const leaderAdjacents = getAdjacentNodeIds(NODES, leaderNodeId);
            leaderAdjacents.forEach(targetId => {
                if (isNodeEmpty(targetId, state.placements, state.leadersPositions)) {
                    moves.push({ type: 'MOVE_LEADER', from: leaderNodeId, to: targetId });
                }
            });
        }

        // 2. Unit Moves (Standard + Abilities)
        const movedUnits = state.movementTracker?.[playerKey]?.units || [];
        const playerUnits = state.placements.filter(unit => unit && unit.playerKey === playerKey);
        
        playerUnits.forEach(unit => {
            // Check if unit has already moved this turn
            const unitKey = unit.tokenId != null ? `${unit.deckIndex}:${unit.tokenId}` : `${unit.deckIndex}`;
            const hasUnitMoved = movedUnits.includes(unitKey);
            
            if (hasUnitMoved) return; // Skip units that already moved
            
            // A. Standard Move (1 step)
            const adjacents = getAdjacentNodeIds(NODES, unit.nodeId);
            adjacents.forEach(targetId => {
                if (isNodeEmpty(targetId, state.placements, state.leadersPositions)) {
                    moves.push({ 
                        type: 'MOVE_UNIT', 
                        unitId: unit.nodeId, 
                        to: targetId,
                        cardKey: unit.cardKey,
                        deckIndex: unit.deckIndex,
                        tokenId: unit.tokenId
                    });
                }
            });

            // B. Active Abilities
            // Only if unit hasn't moved yet (assuming ability replaces move or is the move)
            // Note: In this game, ability usually consumes the action.
                
            if (unit.cardKey === 'acrobate') {
                const jumps = getAcrobatLandingOptions(unit.nodeId, state.placements, state.leadersPositions);
                jumps.forEach(jump => {
                    moves.push({ type: 'USE_ABILITY', ability: 'acrobate', unitId: unit.nodeId, to: jump.nodeId, deckIndex: unit.deckIndex, tokenId: unit.tokenId });
                });
            }
            else if (unit.cardKey === 'cavalier') {
                const dashes = getRiderLandingOptions(unit.nodeId, state.placements, state.leadersPositions);
                dashes.forEach(destId => {
                    moves.push({ type: 'USE_ABILITY', ability: 'cavalier', unitId: unit.nodeId, to: destId, deckIndex: unit.deckIndex, tokenId: unit.tokenId });
                });
            }
            else if (unit.cardKey === 'garderoyal') {
                const royalMoves = getRoyalGuardMoves(playerKey, state.placements, state.leadersPositions);
                royalMoves.forEach(m => {
                    moves.push({ type: 'USE_ABILITY', ability: 'garderoyal', unitId: unit.nodeId, to: m.to, deckIndex: unit.deckIndex, tokenId: unit.tokenId });
                });
            }
            else if (unit.cardKey === 'manipulatrice') {
                const targets = getManipulatorTargets(unit.nodeId, playerKey, state.placements, state.leadersPositions);
                targets.forEach(target => {
                    // Try moving target to all adjacent empty spots
                    const targetAdjacents = getAdjacentNodeIds(NODES, target.nodeId);
                    targetAdjacents.forEach(destId => {
                        if (isNodeEmpty(destId, state.placements, state.leadersPositions)) {
                            moves.push({ 
                                type: 'USE_ABILITY', 
                                ability: 'manipulatrice', 
                                unitId: unit.nodeId, 
                                targetId: target.nodeId,
                                to: destId,
                                deckIndex: unit.deckIndex,
                                tokenId: unit.tokenId
                            });
                        }
                    });
                });
            }
            else if (unit.cardKey === 'lancegrappin') {
                const targets = getClawLauncherTargets(unit.nodeId, playerKey, state.placements, state.leadersPositions);
                targets.forEach(target => {
                    // Option 1: Move Self
                    if (target.prevToTargetId && isNodeEmpty(target.prevToTargetId, state.placements, state.leadersPositions)) {
                        moves.push({ 
                            type: 'USE_ABILITY', 
                            ability: 'lancegrappin', 
                            subType: 'move_self',
                            unitId: unit.nodeId, 
                            to: target.prevToTargetId,
                            deckIndex: unit.deckIndex,
                            tokenId: unit.tokenId
                        });
                    }
                    // Option 2: Drag Target (Only enemies)
                    if (target.playerKey !== playerKey && target.rayFirstId && isNodeEmpty(target.rayFirstId, state.placements, state.leadersPositions)) {
                        moves.push({ 
                            type: 'USE_ABILITY', 
                            ability: 'lancegrappin', 
                            subType: 'drag_target',
                            unitId: unit.nodeId, 
                            targetId: target.nodeId,
                            to: target.rayFirstId,
                            deckIndex: unit.deckIndex,
                            tokenId: unit.tokenId
                        });
                    }
                });
            }
            else if (unit.cardKey === 'tavernier') {
                const allies = getBrewmasterTargets(unit.nodeId, playerKey, state.placements, state.leadersPositions);
                allies.forEach(ally => {
                    const allyAdjacents = getAdjacentNodeIds(NODES, ally.nodeId);
                    allyAdjacents.forEach(destId => {
                        if (isNodeEmpty(destId, state.placements, state.leadersPositions)) {
                            moves.push({ 
                                type: 'USE_ABILITY', 
                                ability: 'tavernier', 
                                unitId: unit.nodeId, 
                                targetId: ally.nodeId,
                                to: destId,
                                deckIndex: unit.deckIndex,
                                tokenId: unit.tokenId
                            });
                        }
                    });
                });
            }
            else if (unit.cardKey === 'cogneur') {
                const enemies = getBruiserTargets(unit.nodeId, playerKey, state.placements, state.leadersPositions);
                enemies.forEach(enemy => {
                    const enemyAdjacents = getAdjacentNodeIds(NODES, enemy.nodeId);
                    enemyAdjacents.forEach(destId => {
                        if (isNodeEmpty(destId, state.placements, state.leadersPositions)) {
                            moves.push({ 
                                type: 'USE_ABILITY', 
                                ability: 'cogneur', 
                                unitId: unit.nodeId, 
                                targetId: enemy.nodeId,
                                to: destId,
                                deckIndex: unit.deckIndex,
                                tokenId: unit.tokenId
                            });
                        }
                    });
                });
            }
            else if (unit.cardKey === 'illusionniste') {
                const targets = getIllusionistTargets(unit.nodeId, playerKey, state.placements, state.leadersPositions);
                targets.forEach(target => {
                    moves.push({ 
                        type: 'USE_ABILITY', 
                        ability: 'illusionniste', 
                        unitId: unit.nodeId, 
                        targetId: target.nodeId,
                        deckIndex: unit.deckIndex,
                        tokenId: unit.tokenId
                    });
                });
            }
            else if (unit.cardKey === 'rodeuse') {
                const dests = getWandererDestinations(unit.nodeId, playerKey, state.placements, state.leadersPositions);
                dests.forEach(destId => {
                    moves.push({ type: 'USE_ABILITY', ability: 'rodeuse', unitId: unit.nodeId, to: destId, deckIndex: unit.deckIndex, tokenId: unit.tokenId });
                });
            }
        });
        
        // 3. Deployment (From Hand)
        // If there are empty spaces near leader? (Rules specific)
        // For now, let's assume units are already placed or this handles movement of placed units.
        // If the game allows summoning from deck to board during turn:
        // (Need to check specific game rules for summoning phase vs action phase)
    }

    return moves;
};

/**
 * State Transition (Simulation)
 */
const applyMove = (state, move) => {
    // Create a shallow copy of state
    const newState = {
        ...state,
        placements: [...state.placements],
        leadersPositions: { ...state.leadersPositions },
        decks: { 
            p1: [...state.decks.p1], 
            p2: [...state.decks.p2] 
        },
        leaders: [...state.leaders] // Recruitment pool
    };

    if (move.type === 'RECRUIT') {
        // Remove from pool
        newState.leaders[move.index] = null;
        
        // Determine which player is recruiting based on current turn
        const recruitingPlayer = state.currentTurn === 'Player 1' ? 'p1' : 'p2';
        
        // Find first empty slot in deck
        const emptySlotIndex = newState.decks[recruitingPlayer].findIndex(c => c === null);
        
        if (emptySlotIndex !== -1) {
            // Extract cardKey from the card URL
            const cardUrl = move.card;
            const fileName = cardUrl.split('/').pop()?.split('?')[0] ?? '';
            let base = fileName.replace(/^LEADERS[-_]/i, '');
            base = base.replace(/\.(tif|tiff|png)$/i, '');
            base = base.replace(/[-_]?LQ$/i, '');
            const cardKey = base.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            // Add card to deck (simplified representation for AI simulation)
            newState.decks[recruitingPlayer][emptySlotIndex] = {
                cardKey: cardKey,
                portrait: cardUrl
            };
        }
    } else if (move.type === 'MOVE_LEADER') {
        const playerKey = Object.keys(newState.leadersPositions).find(k => newState.leadersPositions[k] === move.from);
        if (playerKey) {
            newState.leadersPositions[playerKey] = move.to;
        }
    } else if (move.type === 'MOVE_UNIT') {
        const unitIndex = newState.placements.findIndex(p => p.nodeId === move.unitId);
        if (unitIndex !== -1) {
            newState.placements[unitIndex] = {
                ...newState.placements[unitIndex],
                nodeId: move.to
            };
        }
    } else if (move.type === 'USE_ABILITY') {
        const unitIndex = newState.placements.findIndex(p => p.nodeId === move.unitId);
        
        if (move.ability === 'acrobate' || move.ability === 'cavalier' || move.ability === 'garderoyal' || move.ability === 'rodeuse') {
            // Simple move abilities
            if (unitIndex !== -1) {
                newState.placements[unitIndex] = { ...newState.placements[unitIndex], nodeId: move.to };
            }
        }
        else if (move.ability === 'manipulatrice' || move.ability === 'tavernier' || move.ability === 'cogneur') {
            // Move target abilities
            const targetIndex = newState.placements.findIndex(p => p.nodeId === move.targetId);
            if (targetIndex !== -1) {
                newState.placements[targetIndex] = { ...newState.placements[targetIndex], nodeId: move.to };
            }
        }
        else if (move.ability === 'lancegrappin') {
            if (move.subType === 'move_self') {
                if (unitIndex !== -1) {
                    newState.placements[unitIndex] = { ...newState.placements[unitIndex], nodeId: move.to };
                }
            } else if (move.subType === 'drag_target') {
                const targetIndex = newState.placements.findIndex(p => p.nodeId === move.targetId);
                if (targetIndex !== -1) {
                    newState.placements[targetIndex] = { ...newState.placements[targetIndex], nodeId: move.to };
                }
            }
        }
        else if (move.ability === 'illusionniste') {
            // Swap positions
            const targetIndex = newState.placements.findIndex(p => p.nodeId === move.targetId);
            if (unitIndex !== -1 && targetIndex !== -1) {
                const unitPos = newState.placements[unitIndex].nodeId;
                const targetPos = newState.placements[targetIndex].nodeId;
                
                newState.placements[unitIndex] = { ...newState.placements[unitIndex], nodeId: targetPos };
                newState.placements[targetIndex] = { ...newState.placements[targetIndex], nodeId: unitPos };
            }
        }
    }

    return newState;
};

const checkGameOver = (state) => {
    // Check if P1 lost
    const p1Status = evaluateLeaderState('p1', state.placements, state.leadersPositions);
    if (p1Status.captured || p1Status.surrounded) return { winner: 'Player 2' };

    // Check if P2 lost
    const p2Status = evaluateLeaderState('p2', state.placements, state.leadersPositions);
    if (p2Status.captured || p2Status.surrounded) return { winner: 'Player 1' };

    return null;
};
