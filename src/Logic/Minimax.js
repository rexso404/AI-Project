import { getRecruitmentValue, getDynamicWeight, CHARACTER_WEIGHTS, getCounterPickBonus, getSynergyBonus } from './AIWeights';
import { 
    evaluateLeaderState, 
    getAdjacentNodeIds, 
    isNodeEmpty, 
    getAcrobatLandingOptions, 
    getRiderLandingOptions,
    getNodeOccupant,
    playerKeyToLabel,
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

// Dangerous ability categories for threat assessment
const HIGH_THREAT_ABILITIES = ['assassin', 'lancegrappin', 'manipulatrice', 'illusionniste', 'cogneur'];
const MOBILE_ABILITIES = ['cavalier', 'acrobate', 'rodeuse', 'garderoyal'];
const PASSIVE_THREAT_ABILITIES = ['geolier', 'archere', 'nemesis'];

const NODES = getBoardNodes();
const NODE_MAP = new Map(NODES.map(n => [n.id, n]));
const MAX_DEPTH = 6; // Optimal depth for web
const INFINITY = 1000000;

const BOARD_BOUNDS = (() => {
    let minRow = Infinity;
    let maxRow = -Infinity;
    let minCol = Infinity;
    let maxCol = -Infinity;
    for (const n of NODES) {
        if (typeof n?.row === 'number') {
            minRow = Math.min(minRow, n.row);
            maxRow = Math.max(maxRow, n.row);
        }
        if (typeof n?.col === 'number') {
            minCol = Math.min(minCol, n.col);
            maxCol = Math.max(maxCol, n.col);
        }
    }
    return { minRow, maxRow, minCol, maxCol };
})();

// Heuristik ringan untuk mengurutkan langkah (membantu pruning dan hindari pembukaan kaku)
const manhattanDist = (idA, idB) => {
    const a = NODE_MAP.get(idA);
    const b = NODE_MAP.get(idB);
    if (!a || !b) return 0;
    return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
};

const isLeaderOnEdge = (leaderNodeId) => {
    const node = NODE_MAP.get(leaderNodeId);
    if (!node) return false;
    return (
        node.col === BOARD_BOUNDS.minCol ||
        node.col === BOARD_BOUNDS.maxCol ||
        node.row === BOARD_BOUNDS.minRow ||
        node.row === BOARD_BOUNDS.maxRow
    );
};

const getLeaderAdjacencyStats = (state, playerKey) => {
    const leaderId = state?.leadersPositions?.[playerKey];
    if (leaderId == null) return { leaderId: null, adjacentUnitCount: 0, emptyAdjacentCount: 0, adjacentIds: [] };
    const adjacentIds = getAdjacentNodeIds(NODES, leaderId);
    const adjacentUnitCount = (state?.placements ?? []).filter((p) =>
        p && p.playerKey === playerKey && adjacentIds.includes(p.nodeId)
    ).length;
    const emptyAdjacentCount = adjacentIds.filter((id) => isNodeEmpty(id, state.placements, state.leadersPositions)).length;
    return { leaderId, adjacentUnitCount, emptyAdjacentCount, adjacentIds };
};

const countAdjacentEnemyCharacters = (nodeId, playerKey, placements, leadersPositions) => {
    if (nodeId == null) return 0;
    const enemyKey = playerKey === 'p1' ? 'p2' : 'p1';
    const adj = getAdjacentNodeIds(NODES, nodeId);
    let count = 0;
    for (const id of adj) {
        const occ = getNodeOccupant(id, leadersPositions, placements);
        if (!occ) continue;
        if (occ.playerKey !== enemyKey) continue;
        // Hermit+Cub: cub cannot help capture, but still blocks space.
        // For "don't walk between enemies" blunder avoidance, cub still counts as an enemy body.
        count += 1;
    }
    return count;
};

const hasEnemyWithinDistanceOfLeader = (state, playerKey, maxDist = 2) => {
    const ownLeaderId = state?.leadersPositions?.[playerKey];
    if (ownLeaderId == null) return false;
    const enemyKey = playerKey === 'p1' ? 'p2' : 'p1';
    const enemyLeaderId = state?.leadersPositions?.[enemyKey];
    if (enemyLeaderId != null && manhattanDist(enemyLeaderId, ownLeaderId) <= maxDist) return true;

    const enemyPlacements = (state?.placements ?? []).filter((p) => p && p.playerKey === enemyKey);
    for (const p of enemyPlacements) {
        if (p?.nodeId == null) continue;
        if (manhattanDist(p.nodeId, ownLeaderId) <= maxDist) return true;
    }
    return false;
};

// Detect when the enemy is "full defense" (turtling) based on user-described patterns.
// 1) Enemy leader is ringed by ~5 units (Hermit+Cub counts as 2 units on board).
// 2) Enemy leader sits on an edge and blocks the few approach squares (>=2 adjacent units with <=1 empty adjacent).
const getEnemyFullDefenseInfo = (state, enemyKey) => {
    const stats = getLeaderAdjacencyStats(state, enemyKey);
    const condRing5 = stats.adjacentUnitCount >= 5;
    const condEdgeTurtle =
        stats.leaderId != null &&
        isLeaderOnEdge(stats.leaderId) &&
        stats.adjacentUnitCount >= 2 &&
        stats.emptyAdjacentCount <= 1;

    const isFullDefense = condRing5 || condEdgeTurtle;
    const reason = condRing5 ? 'ring-5' : (condEdgeTurtle ? 'edge-2-block' : '');
    return { isFullDefense, reason, stats };
};

const getOurDefenseInfo = (state, aiPlayerKey) => {
    const stats = getLeaderAdjacencyStats(state, aiPlayerKey);
    const isFullDefense = stats.adjacentUnitCount >= 3 && stats.emptyAdjacentCount >= 2;
    return { isFullDefense, stats };
};

// Pathfinding (BFS) through empty nodes only.
// Used for planning "unblocked routes" (not occupied by either team or leaders).
const findShortestPathThroughEmpty = (state, startNodeId, goalNodeId) => {
    if (startNodeId == null || goalNodeId == null) return null;
    if (startNodeId === goalNodeId) return [startNodeId];

    const visited = new Set([startNodeId]);
    const prev = new Map();
    const queue = [startNodeId];

    while (queue.length > 0) {
        const cur = queue.shift();
        const neighbors = getAdjacentNodeIds(NODES, cur);
        for (const next of neighbors) {
            if (visited.has(next)) continue;

            // Only traverse empty squares; allow reaching the goal explicitly.
            const traversable = (next === goalNodeId) || isNodeEmpty(next, state.placements, state.leadersPositions);
            if (!traversable) continue;

            visited.add(next);
            prev.set(next, cur);
            if (next === goalNodeId) {
                // Reconstruct path.
                const path = [goalNodeId];
                let p = cur;
                while (p != null && p !== startNodeId) {
                    path.push(p);
                    p = prev.get(p);
                }
                path.push(startNodeId);
                path.reverse();
                return path;
            }
            queue.push(next);
        }
    }
    return null;
};

// Choose the best "first step" for Assassin to approach the enemy leader via an unblocked route.
// Goal squares are empty nodes adjacent to the enemy leader.
const getAssassinBestFirstStep = (state, aiPlayerKey, enemyKey, assassinNodeId) => {
    const enemyLeaderId = state?.leadersPositions?.[enemyKey];
    if (enemyLeaderId == null || assassinNodeId == null) return null;

    // If enemy leader is fully surrounded, there may be no empty adjacent squares.
    // In that case, stage the assassin on the closest reachable empty squares within distance 2-3.
    const goalCandidates = NODES
        .map((n) => n.id)
        .filter((id) => isNodeEmpty(id, state.placements, state.leadersPositions))
        .filter((id) => {
            const d = manhattanDist(id, enemyLeaderId);
            return d >= 1 && d <= 3;
        })
        .sort((a, b) => manhattanDist(a, enemyLeaderId) - manhattanDist(b, enemyLeaderId));
    if (goalCandidates.length === 0) return null;

    let best = null;
    for (const goal of goalCandidates) {
        const path = findShortestPathThroughEmpty(state, assassinNodeId, goal);
        if (!path || path.length < 2) continue;
        const firstStep = path[1];
        const pathLen = path.length - 1;
        if (!best || pathLen < best.pathLen) {
            best = { goal, firstStep, pathLen, path };
        }
    }
    return best;
};

const scoreMoveHeuristic = (state, move, currentPlayer) => {
    const enemyKey = currentPlayer === 'p1' ? 'p2' : 'p1';
    const enemyLeaderId = state.leadersPositions[enemyKey];
    const ownLeaderId = state.leadersPositions[currentPlayer];

    const enemyDefense = getEnemyFullDefenseInfo(state, enemyKey);
    const ourDefense = getOurDefenseInfo(state, currentPlayer);
    const enemyNearOwnLeader = hasEnemyWithinDistanceOfLeader(state, currentPlayer, 2);

    let score = 0;

    // Urutan jenis aksi
    // Catatan: ini hanya untuk ordering (alpha-beta), bukan keputusan final.
    // Kita bias ke defensive-first agar AI tidak dominan menyerang.
    if (move.type === 'USE_ABILITY') score += 3;
    else if (move.type === 'MOVE_UNIT') score += 2;
    else if (move.type === 'MOVE_LEADER') score += 1;

    const actorKey = move.cardKey ?? move.ability ?? null;

    // If we are already in full defense and the enemy is threatening (within 2 tiles of our leader),
    // keep the bodyguards in place. This stabilizes pruning/ordering and avoids "opening" the leader.
    if (ourDefense.isFullDefense && enemyNearOwnLeader) {
        const isSelfMove = (move.to != null && move.unitId != null);
        if (isSelfMove) {
            const before = manhattanDist(move.unitId, ownLeaderId);
            const after = manhattanDist(move.to, ownLeaderId);
            const k = move.cardKey;
            const isDefender = Boolean(k && (DEFENSIVE_UNITS.includes(k) || k === 'ourson'));

            // Don't peel off adjacent defenders when under direct pressure.
            if (isDefender && before <= 1 && after > 1) score -= 80;

            // Protector is specifically intended to lock down around the leader; keep it close.
            if (k === 'protecteur' && before <= 2 && after > 2) score -= 140;
        }
    }

    // Turtle-vs-turtle: even if the enemy isn't currently within 2 tiles,
    // keep our full-defense shell intact so we don't "open" the leader.
    if (ourDefense.isFullDefense && enemyDefense.isFullDefense) {
        const isSelfMove = (move.to != null && move.unitId != null);
        if (isSelfMove) {
            const before = manhattanDist(move.unitId, ownLeaderId);
            const after = manhattanDist(move.to, ownLeaderId);
            const k = move.cardKey;
            const isDefender = Boolean(k && (DEFENSIVE_UNITS.includes(k) || k === 'ourson'));

            // Don't peel off adjacent defenders during a full-defense standoff.
            if (isDefender && before <= 1 && after > 1) score -= 55;
            if (k === 'protecteur' && before <= 2 && after > 2) score -= 85;
        }
    }

    // Prefergerakan unit defensif agar dekat leader sendiri (proteksi + escort)
    if (actorKey && (DEFENSIVE_UNITS.includes(actorKey) || actorKey === 'ourson')) {
        if (move.to != null && move.unitId != null) {
            const before = manhattanDist(move.unitId, ownLeaderId);
            const after = manhattanDist(move.to, ownLeaderId);
            score += (before - after) * 6;
        }
    }

    // Hindari leader maju sendirian: kalau leader bergerak mendekat musuh, wajib ada escort defensif.
    if (move.type === 'MOVE_LEADER' && move.to != null) {
        const beforeToEnemy = manhattanDist(ownLeaderId, enemyLeaderId);
        const afterToEnemy = manhattanDist(move.to, enemyLeaderId);

        // Hitung "escort" defensif yang sudah dekat ke posisi leader tujuan.
        const defendersNearDest = (state.placements ?? []).filter((p) => {
            if (!p || p.playerKey !== currentPlayer) return false;
            const k = p.cardKey;
            if (!(DEFENSIVE_UNITS.includes(k) || k === 'ourson')) return false;
            return manhattanDist(p.nodeId, move.to) <= 2;
        }).length;

        const isAdvancing = afterToEnemy < beforeToEnemy;
        if (isAdvancing) {
            const requiredEscorts = enemyDefense.isFullDefense ? 2 : 1;
            if (defendersNearDest >= requiredEscorts) score += 4;
            else score -= enemyDefense.isFullDefense ? 18 : 12;
        } else {
            // Retreat/side-step slightly preferred when unsure.
            score += 1;
        }
    }

    // Jika musuh full defense: jangan kirim banyak penyerang.
    // - Assassin boleh maju sendirian.
    // - Archer boleh ikut menyerang, tapi selain itu bias kembali menjaga leader.
    if (enemyDefense.isFullDefense) {
        if (move.type === 'MOVE_UNIT' && move.to != null && move.unitId != null) {
            const k = move.cardKey;
            const before = manhattanDist(move.unitId, ownLeaderId);
            const after = manhattanDist(move.to, ownLeaderId);

            // Bonus kuat kalau assassin mendekat ke leader musuh.
            if (k === 'assassin') {
                const d0 = manhattanDist(move.unitId, enemyLeaderId);
                const d1 = manhattanDist(move.to, enemyLeaderId);
                score += (d0 - d1) * 18;
            }

            // Penalize moving non-defensive units too far away from own leader (turtle response).
            const isDefensive = (DEFENSIVE_UNITS.includes(k) || k === 'ourson');
            const allowedAttacker = (k === 'assassin' || k === 'archere');
            if (!isDefensive && !allowedAttacker) {
                if (after > 3 && after > before) score -= 10;
                if (after > 4 && after > before) score -= 12;
            }
        }
    }

    return score;
};

// Turtle-vs-turtle helper: keep OUR full defense, but still attack if the enemy has a gap.
// - If enemy has a gap (empty adjacent to enemy leader): prefer filling that gap safely.
// - If enemy has no gap: keep full defense and try to CREATE a gap using units already near enemy leader.
const findBestSafeAttackWhileMaintainingFullDefense = (state, aiPlayerKey, startedAt, totalBudgetMs) => {
    const enemyKey = otherPlayerKey(aiPlayerKey);
    const enemyDefenseNow = getEnemyFullDefenseInfo(state, enemyKey);
    const ourDefenseNow = getOurDefenseInfo(state, aiPlayerKey);

    if (!enemyDefenseNow.isFullDefense || !ourDefenseNow.isFullDefense) return null;

    const enemyLeaderId = state?.leadersPositions?.[enemyKey];
    const ownLeaderId = state?.leadersPositions?.[aiPlayerKey];
    if (enemyLeaderId == null || ownLeaderId == null) return null;

    const enemyGapNow = (enemyDefenseNow?.stats?.emptyAdjacentCount ?? 0) > 0;
    const enemyAdjIds = enemyDefenseNow?.stats?.adjacentIds ?? [];

    const moves = orderMovesForForcedScan(state, getAllPossibleMoves(state, aiPlayerKey, false), aiPlayerKey);

    let bestMove = null;
    let bestScore = -INFINITY;
    let checked = 0;

    for (const move of moves) {
        if (checked >= 22 || isTimeUp(startedAt, totalBudgetMs)) break;

        // Keep it simple/safe: do not move the leader in turtle-vs-turtle.
        if (move?.type === 'MOVE_LEADER') {
            checked++;
            continue;
        }

        // Avoid peeling off adjacent defenders while in full defense.
        if (move?.type === 'MOVE_UNIT' && move?.to != null && move?.unitId != null) {
            const k = move.cardKey;
            const isDef = (DEFENSIVE_UNITS.includes(k) || k === 'ourson');
            if (isDef) {
                const before = manhattanDist(move.unitId, ownLeaderId);
                const after = manhattanDist(move.to, ownLeaderId);
                if (before <= 1 && after > 1) {
                    checked++;
                    continue;
                }
                if (k === 'protecteur' && before <= 2 && after > 2) {
                    checked++;
                    continue;
                }
            }
        }

        const nextState = applyMove(state, move);

        // Hard requirement: we must still be in full defense after attacking.
        const ourDefenseAfter = getOurDefenseInfo(nextState, aiPlayerKey);
        if (!ourDefenseAfter.isFullDefense) {
            checked++;
            continue;
        }

        const aiSafetyAfter = evaluateLeaderState(aiPlayerKey, nextState.placements, nextState.leadersPositions);
        if (aiSafetyAfter.captured || aiSafetyAfter.surrounded) {
            checked++;
            continue;
        }

        // Hard requirement: do not allow immediate enemy win.
        const remainingBudget = Math.max(1, totalBudgetMs - (performance.now() - startedAt));
        if (hasImmediateWin(nextState, enemyKey, performance.now(), remainingBudget)) {
            checked++;
            continue;
        }

        // Score: base eval + tactical objective (exploit gap / create gap).
        const base = evaluateState(nextState, aiPlayerKey, null, 0);
        let tactical = 0;

        // Recompute enemy defense stats after this move (cheap & robust).
        const enemyDefenseAfter = getEnemyFullDefenseInfo(nextState, enemyKey);
        const emptyAfter = enemyDefenseAfter?.stats?.emptyAdjacentCount ?? 0;
        const emptyBefore = enemyDefenseNow?.stats?.emptyAdjacentCount ?? 0;
        const adjAfter = enemyDefenseAfter?.stats?.adjacentUnitCount ?? 0;
        const adjBefore = enemyDefenseNow?.stats?.adjacentUnitCount ?? 0;
        const deltaEmpty = emptyAfter - emptyBefore;
        const deltaAdj = adjBefore - adjAfter;

        // If enemy has a gap, prioritize stepping into an adjacent empty square (pressure).
        if (enemyGapNow) {
            if (move?.type === 'MOVE_UNIT' && move?.to != null && enemyAdjIds.includes(move.to)) {
                tactical += 900;
            }
            // General: moves that get closer to enemy leader are good, but don't overcommit.
            if (move?.type === 'MOVE_UNIT' && move?.to != null && move?.unitId != null) {
                const d0 = manhattanDist(move.unitId, enemyLeaderId);
                const d1 = manhattanDist(move.to, enemyLeaderId);
                tactical += (d0 - d1) * 220;
                if (d0 <= 4) tactical += 120; // prefer using units already near enemy leader
            }
        } else {
            // No gap: try to CREATE one (increase empty adjacents / reduce adjacent defenders).
            tactical += (deltaEmpty * 700) + (deltaAdj * 600);

            // Prefer using units that are already near enemy leader to probe.
            if (move?.type === 'MOVE_UNIT' && move?.to != null && move?.unitId != null) {
                const d0 = manhattanDist(move.unitId, enemyLeaderId);
                const d1 = manhattanDist(move.to, enemyLeaderId);
                tactical += (d0 - d1) * 140;
                if (d0 <= 4) tactical += 220;
                if (d1 <= 3) tactical += 140;
            }
            if (move?.type === 'USE_ABILITY') {
                // Abilities are often the main way to pry open a turtle.
                tactical += 220 + (deltaEmpty * 220) + (deltaAdj * 220);
            }
        }

        const total = base + tactical;
        if (total > bestScore) {
            bestScore = total;
            bestMove = move;
        }

        checked++;
    }

    return bestMove;
};

const moveTiebreakKey = (move) => {
    // Deterministic ordering: helps alpha-beta pruning and makes AI behavior reproducible.
    return [
        move?.type ?? '',
        move?.ability ?? '',
        move?.subType ?? '',
        move?.unitId ?? '',
        move?.from ?? '',
        move?.targetId ?? '',
        move?.to ?? '',
        move?.deckIndex ?? '',
        move?.tokenId ?? '',
        move?.index ?? '',
    ].join('|');
};

const orderMovesByHeuristic = (state, moves, currentPlayer) => {
    return [...moves].sort((a, b) => {
        const diff = scoreMoveHeuristic(state, b, currentPlayer) - scoreMoveHeuristic(state, a, currentPlayer);
        if (diff !== 0) return diff;
        return moveTiebreakKey(a).localeCompare(moveTiebreakKey(b));
    });
};

// =========================================================================
// TURN-AWARE SEARCH + TRANSPOSITION TABLE
// =========================================================================

const buildEmptyMovementTracker = () => ({
    p1: { leader: false, units: [] },
    p2: { leader: false, units: [] },
});

const cloneMovementTracker = (tracker) => ({
    p1: { leader: Boolean(tracker?.p1?.leader), units: [...(tracker?.p1?.units ?? [])] },
    p2: { leader: Boolean(tracker?.p2?.leader), units: [...(tracker?.p2?.units ?? [])] },
});

const normalizeMovementTracker = (tracker) => {
    const safe = tracker ?? buildEmptyMovementTracker();
    return {
        p1: {
            leader: Boolean(safe?.p1?.leader),
            units: [...(safe?.p1?.units ?? [])].slice().sort(),
        },
        p2: {
            leader: Boolean(safe?.p2?.leader),
            units: [...(safe?.p2?.units ?? [])].slice().sort(),
        },
    };
};

const stateKeyForTT = (state, playerToMove) => {
    // Note: This TT is used within a single getBestMove call.
    // Deck composition doesn't change in action phase, so we omit full decks for speed.
    const leaders = state?.leadersPositions ?? {};
    const placements = Array.isArray(state?.placements) ? state.placements : [];
    const tracker = normalizeMovementTracker(state?.movementTracker);

    const leaderKey = `L:${leaders.p1 ?? 'x'}:${leaders.p2 ?? 'x'}`;
    const trackerKey = `T:${tracker.p1.leader ? 1 : 0}:${tracker.p1.units.join(',')}|${tracker.p2.leader ? 1 : 0}:${tracker.p2.units.join(',')}`;

    const piecesKey = placements
        .map((p) => {
            const tokenKey = p?.tokenId != null ? `:${p.tokenId}` : '';
            return `${p?.playerKey ?? '?'}:${p?.cardKey ?? '?'}:${p?.deckIndex ?? '?'}${tokenKey}@${p?.nodeId ?? '?'}`;
        })
        .sort()
        .join(';');

    return `${playerToMove}|${leaderKey}|${trackerKey}|P:${piecesKey}`;
};

// Turn-aware minimax: a player may take multiple actions in a single turn until movementTracker blocks them.
// When no actions remain for that player, the turn passes and movementTracker resets.
const minimaxTurnAware = (state, depth, alpha, beta, aiPlayerKey, playerToMove, tt) => {
    const outcome = checkGameOver(state);
    const plyFromRoot = MAX_DEPTH - depth;
    if (depth === 0 || outcome) {
        return { score: evaluateState(state, aiPlayerKey, outcome, plyFromRoot) };
    }

    const table = tt ?? new Map();
    const key = stateKeyForTT(state, playerToMove);
    const cached = table.get(key);
    if (cached && cached.depth >= depth) {
        return { score: cached.score, move: cached.move ?? null };
    }

    const moves = getAllPossibleMoves(state, playerToMove, false);
    const orderedMoves = orderMovesByHeuristic(state, moves, playerToMove);

    if (orderedMoves.length === 0) {
        // Pass the turn.
        const nextPlayer = otherPlayerKey(playerToMove);
        const passedState = {
            ...state,
            currentTurn: playerKeyToLabel(nextPlayer),
            movementTracker: buildEmptyMovementTracker(),
        };

        // If opponent also has no moves, evaluate.
        const opponentMoves = getAllPossibleMoves(passedState, nextPlayer, false);
        if (opponentMoves.length === 0) {
            const leafScore = evaluateState(passedState, aiPlayerKey, null, plyFromRoot);
            table.set(key, { depth, score: leafScore, move: null });
            return { score: leafScore };
        }

        const res = minimaxTurnAware(passedState, depth, alpha, beta, aiPlayerKey, nextPlayer, table);
        table.set(key, { depth, score: res.score, move: null });
        return res;
    }

    const isMaximizing = playerToMove === aiPlayerKey;
    let bestMove = null;

    if (isMaximizing) {
        let bestScore = -INFINITY;
        for (const move of orderedMoves) {
            let nextState = applyMove(state, move);

            // Same player continues if they still have actions in this turn.
            const stillHasMoves = getAllPossibleMoves(nextState, playerToMove, false).length > 0;
            const nextPlayer = stillHasMoves ? playerToMove : otherPlayerKey(playerToMove);
            if (!stillHasMoves) {
                nextState = {
                    ...nextState,
                    currentTurn: playerKeyToLabel(nextPlayer),
                    movementTracker: buildEmptyMovementTracker(),
                };
            }

            const evalResult = minimaxTurnAware(nextState, depth - 1, alpha, beta, aiPlayerKey, nextPlayer, table);
            if (evalResult.score > bestScore) {
                bestScore = evalResult.score;
                bestMove = move;
            }
            alpha = Math.max(alpha, bestScore);
            if (beta <= alpha) break;
        }
        table.set(key, { depth, score: bestScore, move: bestMove });
        return { score: bestScore, move: bestMove };
    }

    let bestScore = INFINITY;
    for (const move of orderedMoves) {
        let nextState = applyMove(state, move);

        const stillHasMoves = getAllPossibleMoves(nextState, playerToMove, false).length > 0;
        const nextPlayer = stillHasMoves ? playerToMove : otherPlayerKey(playerToMove);
        if (!stillHasMoves) {
            nextState = {
                ...nextState,
                currentTurn: playerKeyToLabel(nextPlayer),
                movementTracker: buildEmptyMovementTracker(),
            };
        }

        const evalResult = minimaxTurnAware(nextState, depth - 1, alpha, beta, aiPlayerKey, nextPlayer, table);
        if (evalResult.score < bestScore) {
            bestScore = evalResult.score;
            bestMove = move;
        }
        beta = Math.min(beta, bestScore);
        if (beta <= alpha) break;
    }
    table.set(key, { depth, score: bestScore, move: bestMove });
    return { score: bestScore, move: bestMove };
};

// =========================================================================
// FORCED LINES (TACTICAL SCAN)
// =========================================================================

const otherPlayerKey = (playerKey) => (playerKey === 'p1' ? 'p2' : 'p1');

// Keep forced-lines scan fast. These scans run BEFORE minimax.
// If budget is exceeded, fall back to full minimax.
const FORCED_SCAN_TOTAL_BUDGET_MS = 18;
const FORCED_SCAN_PER_CALL_BUDGET_MS = 10;
const FORCED_SCAN_MAX_CHECKS = 24;
const FORCED_SCAN_MAX_CANDIDATES_MATE2 = 8;
const FORCED_SCAN_MAX_ENEMY_REPLIES_MATE2 = 14;

const isTimeUp = (startedAt, budgetMs) => (performance.now() - startedAt) >= budgetMs;

const forcedScanSortKey = (state, move, currentPlayer) => {
    // Strongly prefer abilities in tactical scan.
    const abilityBonus = move.type === 'USE_ABILITY' ? 100000 : 0;
    // Prefer moves that directly interact with leader lines: quick heuristic already favors proximity.
    // Reuse existing heuristic for secondary ordering.
    return abilityBonus + (scoreMoveHeuristic(state, move, currentPlayer) * 100);
};

const orderMovesForForcedScan = (state, moves, currentPlayer) => {
    return [...moves].sort((a, b) => forcedScanSortKey(state, b, currentPlayer) - forcedScanSortKey(state, a, currentPlayer));
};

const didPlayerWin = (outcome, playerKey) => {
    if (!outcome) return false;
    return outcome.winner === playerKeyToLabel(playerKey);
};

// Try to find an immediate winning move (mate-in-1): any move that ends the game right away.
const findImmediateWinMove = (state, playerKey, startedAt = performance.now(), budgetMs = FORCED_SCAN_PER_CALL_BUDGET_MS) => {
    const moves = getAllPossibleMoves(state, playerKey, false);
    const ordered = orderMovesForForcedScan(state, moves, playerKey);
    let checked = 0;
    for (const move of ordered) {
        if (checked >= FORCED_SCAN_MAX_CHECKS || isTimeUp(startedAt, budgetMs)) break;
        const nextState = applyMove(state, move);
        const outcome = checkGameOver(nextState);
        if (didPlayerWin(outcome, playerKey)) return move;
        checked++;
    }
    return null;
};

// Returns true if the given player has ANY immediate winning move from this state.
const hasImmediateWin = (state, playerKey, startedAt, budgetMs) => Boolean(findImmediateWinMove(state, playerKey, startedAt, budgetMs));

// Collect up to N immediate winning moves (used for fast threat checks).
const getImmediateWinningMoves = (state, playerKey, maxResults, startedAt, budgetMs) => {
    const moves = getAllPossibleMoves(state, playerKey, false);
    const ordered = orderMovesForForcedScan(state, moves, playerKey);
    const wins = [];
    let checked = 0;
    for (const move of ordered) {
        if (wins.length >= maxResults || checked >= FORCED_SCAN_MAX_CHECKS || isTimeUp(startedAt, budgetMs)) break;
        const nextState = applyMove(state, move);
        const outcome = checkGameOver(nextState);
        if (didPlayerWin(outcome, playerKey)) wins.push(move);
        checked++;
    }
    return wins;
};

// If enemy has a mate-in-1 threat, pick the best defensive move that removes all enemy mate-in-1 replies.
// Uses minimax evaluation to choose among candidate defenses.
const findBestDefenseAgainstMateIn1 = (state, aiPlayerKey) => {
    const enemyKey = otherPlayerKey(aiPlayerKey);
    const startedAt = performance.now();
    const initialThreats = getImmediateWinningMoves(state, enemyKey, 6, startedAt, FORCED_SCAN_PER_CALL_BUDGET_MS);
    if (initialThreats.length === 0) return null;

    const aiMoves = orderMovesForForcedScan(state, getAllPossibleMoves(state, aiPlayerKey, false), aiPlayerKey);
    const safeMoves = [];
    let checked = 0;
    for (const move of aiMoves) {
        if (checked >= FORCED_SCAN_MAX_CHECKS || isTimeUp(startedAt, FORCED_SCAN_PER_CALL_BUDGET_MS)) break;
        const nextState = applyMove(state, move);
        // If this move already wins, it is also a valid defense.
        const outcome = checkGameOver(nextState);
        if (didPlayerWin(outcome, aiPlayerKey)) return move;

        // Otherwise, ensure enemy no longer has a mate-in-1.
        // For speed, we re-scan only a small number of winning replies within remaining budget.
        const remainingBudget = Math.max(1, FORCED_SCAN_PER_CALL_BUDGET_MS - (performance.now() - startedAt));
        const stillThreats = getImmediateWinningMoves(nextState, enemyKey, 2, performance.now(), remainingBudget);
        if (stillThreats.length === 0) {
            safeMoves.push(move);
        }
        checked++;
    }

    if (safeMoves.length === 0) return null;

    let bestMove = safeMoves[0];
    let bestScore = -INFINITY;
    let alpha = -INFINITY;
    let beta = INFINITY;
    const tt = new Map();

    for (const move of safeMoves) {
        const nextState = applyMove(state, move);
        // After AI defends, it may still have remaining actions in this turn.
        const evalResult = minimaxTurnAware(nextState, MAX_DEPTH - 1, alpha, beta, aiPlayerKey, aiPlayerKey, tt);
        if (evalResult.score > bestScore) {
            bestScore = evalResult.score;
            bestMove = move;
        }
        alpha = Math.max(alpha, bestScore);
    }

    return bestMove;
};

// Forced win in 2 plies (mate-in-2): AI makes a move such that NO MATTER what enemy replies,
// AI has an immediate win next. This is a tactical check to avoid missing short forced mates.
const findForcedWinInTwo = (state, aiPlayerKey, maxCandidates = 12) => {
    const enemyKey = otherPlayerKey(aiPlayerKey);
    const startedAt = performance.now();
    const candidateLimit = Math.min(maxCandidates, FORCED_SCAN_MAX_CANDIDATES_MATE2);
    const aiMoves = orderMovesForForcedScan(state, getAllPossibleMoves(state, aiPlayerKey, false), aiPlayerKey).slice(0, candidateLimit);

    for (const move of aiMoves) {
        if (isTimeUp(startedAt, FORCED_SCAN_PER_CALL_BUDGET_MS)) break;
        const afterAi = applyMove(state, move);
        const outcome = checkGameOver(afterAi);
        if (didPlayerWin(outcome, aiPlayerKey)) return move; // Already mate-in-1

        const enemyReplies = orderMovesForForcedScan(afterAi, getAllPossibleMoves(afterAi, enemyKey, false), enemyKey)
            .slice(0, FORCED_SCAN_MAX_ENEMY_REPLIES_MATE2);
        if (enemyReplies.length === 0) continue;

        let forced = true;
        for (const reply of enemyReplies) {
            if (isTimeUp(startedAt, FORCED_SCAN_PER_CALL_BUDGET_MS)) {
                forced = false;
                break;
            }
            const afterEnemy = applyMove(afterAi, reply);
            const replyOutcome = checkGameOver(afterEnemy);
            if (didPlayerWin(replyOutcome, enemyKey)) {
                forced = false;
                break;
            }
            const remainingBudget = Math.max(1, FORCED_SCAN_PER_CALL_BUDGET_MS - (performance.now() - startedAt));
            if (!hasImmediateWin(afterEnemy, aiPlayerKey, performance.now(), remainingBudget)) {
                forced = false;
                break;
            }
        }
        if (forced) return move;
    }

    return null;
};

// Lightweight helper for forced reactions (e.g., Nemesis). Returns the best destination id.
// Uses the same evaluation brain so it stays consistent with main minimax scoring.
export const chooseNemesisMove = (state, nemesisOwnerKey, originNodeId, destinationIds, nodesRef = null) => {
    if (!Array.isArray(destinationIds) || destinationIds.length === 0) return null;

    let bestDest = null;
    let bestScore = -INFINITY;
    const leaderPositions = state.leadersPositions || {};

    for (const destId of destinationIds) {
        const nextPlacements = state.placements.map((p) => {
            if (p.playerKey === nemesisOwnerKey && p.cardKey === 'nemesis' && p.nodeId === originNodeId) {
                return { ...p, nodeId: destId };
            }
            return p;
        });

        const nextState = {
            ...state,
            placements: nextPlacements,
        };

        // Use evaluateState directly (plyFromRoot = 0). Perspective = nemesis owner.
        const score = evaluateState(nextState, nemesisOwnerKey, null, 0);
        if (score > bestScore) {
            bestScore = score;
            bestDest = destId;
        } else if (score === bestScore && nodesRef) {
            const ownLeaderId = leaderPositions[nemesisOwnerKey];
            const nodeA = nodesRef.find((n) => n.id === destId);
            const nodeB = nodesRef.find((n) => n.id === bestDest);
            const leaderNode = nodesRef.find((n) => n.id === ownLeaderId);
            if (leaderNode && nodeA && nodeB) {
                const distA = Math.abs(nodeA.col - leaderNode.col) + Math.abs(nodeA.row - leaderNode.row);
                const distB = Math.abs(nodeB.col - leaderNode.col) + Math.abs(nodeB.row - leaderNode.row);
                if (distA > distB) bestDest = destId;
            }
        }
    }

    return bestDest;
};

// =========================================================================
// CHECKMATE DETECTION HELPERS
// =========================================================================

/**
 * Calculate how many units can reach a target node in N moves
 * @param {number} targetNodeId - The node to check threats against
 * @param {string} threatPlayerKey - The player whose units we're checking
 * @param {Array} placements - Current board placements
 * @param {Object} leadersPositions - Leader positions
 * @param {number} maxMoves - Maximum moves to consider (1 or 2)
 */
const countThreatsToNode = (targetNodeId, threatPlayerKey, placements, leadersPositions, maxMoves = 1) => {
    let threatCount = 0;
    const threatUnits = [];
    
    const enemyUnits = placements.filter(p => p.playerKey === threatPlayerKey);
    
    enemyUnits.forEach(unit => {
        const unitNode = NODE_MAP.get(unit.nodeId);
        if (!unitNode) return;
        
        // Check if unit can reach target in 1 move
        const adjacents = getAdjacentNodeIds(NODES, unit.nodeId);
        if (adjacents.includes(targetNodeId)) {
            threatCount++;
            threatUnits.push({ ...unit, movesAway: 1 });
            return;
        }
        
        // Check special abilities for 1-move reach
        if (unit.cardKey === 'acrobate') {
            const jumps = getAcrobatLandingOptions(unit.nodeId, placements, leadersPositions);
            if (jumps.some(j => j.nodeId === targetNodeId)) {
                threatCount++;
                threatUnits.push({ ...unit, movesAway: 1, ability: 'acrobate' });
                return;
            }
        }
        else if (unit.cardKey === 'cavalier') {
            const dashes = getRiderLandingOptions(unit.nodeId, placements, leadersPositions);
            if (dashes.includes(targetNodeId)) {
                threatCount++;
                threatUnits.push({ ...unit, movesAway: 1, ability: 'cavalier' });
                return;
            }
        }
        
        // Check 2-move threats if requested
        if (maxMoves >= 2) {
            // Standard 2-step move check
            for (const adj1 of adjacents) {
                if (isNodeEmpty(adj1, placements, leadersPositions)) {
                    const adj2s = getAdjacentNodeIds(NODES, adj1);
                    if (adj2s.includes(targetNodeId)) {
                        threatCount += 0.5; // Half weight for 2-move threats
                        threatUnits.push({ ...unit, movesAway: 2 });
                        break;
                    }
                }
            }
        }
    });
    
    return { count: threatCount, units: threatUnits };
};

/**
 * Detect if the enemy can checkmate AI leader in the next turn
 * Returns a threat level: 0 (safe), 1 (warning), 2 (danger), 3 (critical)
 */
const detectImmediateCheckmateThreat = (aiPlayerKey, state) => {
    const enemyKey = aiPlayerKey === 'p1' ? 'p2' : 'p1';
    const aiLeaderNodeId = state.leadersPositions[aiPlayerKey];
    const aiLeaderAdjacents = getAdjacentNodeIds(NODES, aiLeaderNodeId);
    
    // Count how many adjacent spaces are blocked (by anyone)
    const blockedSpaces = aiLeaderAdjacents.filter(id => 
        !isNodeEmpty(id, state.placements, state.leadersPositions)
    ).length;
    
    // Count spaces blocked specifically by enemies
    const enemyBlockedSpaces = aiLeaderAdjacents.filter(id => {
        const occupant = getNodeOccupant(id, state.leadersPositions, state.placements);
        return occupant && occupant.playerKey === enemyKey;
    }).length;
    
    // Count empty spaces around leader
    const emptySpaces = aiLeaderAdjacents.length - blockedSpaces;
    
    // Count threats to each empty escape route
    let escapesUnderThreat = 0;
    aiLeaderAdjacents.forEach(adjId => {
        if (isNodeEmpty(adjId, state.placements, state.leadersPositions)) {
            const threats = countThreatsToNode(adjId, enemyKey, state.placements, state.leadersPositions, 1);
            if (threats.count > 0) escapesUnderThreat++;
        }
    });
    
    // Count direct threats to leader position
    const directThreats = countThreatsToNode(aiLeaderNodeId, enemyKey, state.placements, state.leadersPositions, 1);
    
    // Evaluate threat level
    if (enemyBlockedSpaces >= aiLeaderAdjacents.length - 1 && emptySpaces <= 1) {
        return { level: 3, reason: 'CRITICAL: Almost surrounded, 1 or fewer escapes' };
    }
    if (emptySpaces <= 2 && directThreats.count >= 2) {
        return { level: 3, reason: 'CRITICAL: Few escapes + multiple direct threats' };
    }
    if (emptySpaces <= 1 && escapesUnderThreat >= emptySpaces) {
        return { level: 3, reason: 'CRITICAL: All escapes under threat' };
    }
    if (emptySpaces <= 2 && escapesUnderThreat >= 1) {
        return { level: 2, reason: 'DANGER: Low mobility + escape under threat' };
    }
    if (directThreats.count >= 3) {
        return { level: 2, reason: 'DANGER: Multiple units threatening leader' };
    }
    if (emptySpaces <= 2) {
        return { level: 1, reason: 'WARNING: Low mobility' };
    }
    if (directThreats.count >= 2) {
        return { level: 1, reason: 'WARNING: Multiple approaching threats' };
    }
    
    return { level: 0, reason: 'Safe' };
};

/**
 * Calculate checkmate opportunity against enemy leader
 */
const detectCheckmateOpportunity = (aiPlayerKey, state) => {
    const enemyKey = aiPlayerKey === 'p1' ? 'p2' : 'p1';
    const enemyLeaderNodeId = state.leadersPositions[enemyKey];
    const enemyLeaderAdjacents = getAdjacentNodeIds(NODES, enemyLeaderNodeId);
    
    const blockedByAI = enemyLeaderAdjacents.filter(id => {
        const occupant = getNodeOccupant(id, state.leadersPositions, state.placements);
        return occupant && occupant.playerKey === aiPlayerKey;
    }).length;
    
    const emptySpaces = enemyLeaderAdjacents.filter(id => 
        isNodeEmpty(id, state.placements, state.leadersPositions)
    ).length;
    
    // Check if AI units can reach empty spaces near enemy leader
    let reachableEmptySpaces = 0;
    enemyLeaderAdjacents.forEach(adjId => {
        if (isNodeEmpty(adjId, state.placements, state.leadersPositions)) {
            const aiThreats = countThreatsToNode(adjId, aiPlayerKey, state.placements, state.leadersPositions, 1);
            if (aiThreats.count > 0) reachableEmptySpaces++;
        }
    });
    
    if (emptySpaces <= 1 && blockedByAI >= 2) {
        return { level: 3, reason: 'Can checkmate!' };
    }
    if (emptySpaces <= 2 && reachableEmptySpaces >= emptySpaces) {
        return { level: 2, reason: 'Close to checkmate' };
    }
    if (blockedByAI >= 2) {
        return { level: 1, reason: 'Good pressure' };
    }
    
    return { level: 0, reason: 'No opportunity' };
};

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

// =========================================================================
// STRATEGIC PLACEMENT SCORING
// =========================================================================

// Unit role classifications for placement strategy
const OFFENSIVE_UNITS = ['assassin', 'lancegrappin', 'cogneur', 'acrobate', 'cavalier', 'archere'];
const DEFENSIVE_UNITS = ['garderoyal', 'protecteur', 'geolier', 'vizir'];
const MOBILE_UNITS = ['acrobate', 'cavalier', 'rodeuse', 'garderoyal'];
const CONTROL_UNITS = ['manipulatrice', 'illusionniste', 'tavernier', 'cogneur', 'lancegrappin'];

/**
 * Scores a placement position for a unit during recruitment.
 * Higher score = better placement.
 * 
 * @param {Object} node - The board node to evaluate
 * @param {string} cardKey - The character being placed
 * @param {Array} placements - Current board placements
 * @param {Object} leadersPositions - Leader positions { p1: nodeId, p2: nodeId }
 * @param {string} aiPlayerKey - The AI's player key ('p1' or 'p2')
 * @returns {number} Score for this placement position
 */
export const scorePlacementPosition = (node, cardKey, placements, leadersPositions, aiPlayerKey = 'p2') => {
    let score = 0;
    const enemyKey = aiPlayerKey === 'p1' ? 'p2' : 'p1';
    
    const enemyLeaderNodeId = leadersPositions[enemyKey];
    const ownLeaderNodeId = leadersPositions[aiPlayerKey];
    const enemyLeaderNode = NODE_MAP.get(enemyLeaderNodeId);
    const ownLeaderNode = NODE_MAP.get(ownLeaderNodeId);
    
    if (!enemyLeaderNode || !ownLeaderNode) return 0;
    
    // Calculate distances
    const distToEnemy = Math.abs(node.col - enemyLeaderNode.col) + Math.abs(node.y - enemyLeaderNode.y);
    const distToOwnLeader = Math.abs(node.col - ownLeaderNode.col) + Math.abs(node.y - ownLeaderNode.y);
    
    // Center column preference (column 3 is center in 0-6 range)
    const centerCol = 3;
    const centerBonus = (3 - Math.abs(node.col - centerCol)) * 8;
    score += centerBonus;
    
    // === OFFENSIVE UNITS: Prefer positions closer to enemy leader ===
    if (OFFENSIVE_UNITS.includes(cardKey)) {
        // Closer to enemy = higher score (max ~10 distance on this board)
        score += Math.max(0, (12 - distToEnemy)) * 15;
        
        // Assassin specifically wants to be in striking range
        if (cardKey === 'assassin') {
            if (distToEnemy <= 3) score += 50; // Very close
            if (distToEnemy <= 5) score += 30; // Threatening range
        }
        
        // Archer (archere) prefers to be on same row/column as enemy for line of sight
        if (cardKey === 'archere') {
            if (node.col === enemyLeaderNode.col) score += 40; // Same column
            if (Math.abs(node.y - enemyLeaderNode.y) < 1) score += 30; // Similar row
        }
        
        // Lancegrappin benefits from diagonal positioning
        if (cardKey === 'lancegrappin') {
            // Prefer positions where it can threaten multiple directions
            const adjacents = getAdjacentNodeIds(NODES, node.id);
            score += adjacents.length * 5; // More adjacent nodes = more pull options
        }
    }
    
    // === DEFENSIVE UNITS: Prefer positions near own leader ===
    if (DEFENSIVE_UNITS.includes(cardKey)) {
        // Closer to own leader = higher score
        score += Math.max(0, (8 - distToOwnLeader)) * 12;
        
        // Adjacent to leader is ideal for defense
        const ownLeaderAdjacents = getAdjacentNodeIds(NODES, ownLeaderNodeId);
        if (ownLeaderAdjacents.includes(node.id)) {
            score += 60; // Strong defensive position
        }
        
        // Royal Guard (garderoyal) wants to be 1-2 spaces from leader
        if (cardKey === 'garderoyal') {
            if (distToOwnLeader === 1) score += 40;
            if (distToOwnLeader === 2) score += 25;
        }
        
        // Jailer (geolier) is effective when blocking paths
        if (cardKey === 'geolier') {
            // Check if this position blocks enemy approach to leader
            const enemyApproachCol = ownLeaderNode.col < centerCol ? ownLeaderNode.col + 1 : ownLeaderNode.col - 1;
            if (node.col === enemyApproachCol) score += 30;
        }
    }
    
    // === MOBILE UNITS: Prefer flexible central positions ===
    if (MOBILE_UNITS.includes(cardKey) && !OFFENSIVE_UNITS.includes(cardKey) && !DEFENSIVE_UNITS.includes(cardKey)) {
        // Mobile units benefit from central positions for flexibility
        score += centerBonus * 1.5;
        
        // Wanderer (rodeuse) can teleport, so starting position less critical
        // but still prefer central for options
        if (cardKey === 'rodeuse') {
            score += centerBonus;
        }
    }
    
    // === CONTROL UNITS: Prefer positions with many adjacent targets ===
    if (CONTROL_UNITS.includes(cardKey)) {
        const adjacents = getAdjacentNodeIds(NODES, node.id);
        score += adjacents.length * 8; // More options = better
        
        // Illusionist wants to be near both allies and enemies for swap options
        if (cardKey === 'illusionniste') {
            // Count nearby units (both friendly and enemy)
            let nearbyUnits = 0;
            adjacents.forEach(adjId => {
                const occupant = getNodeOccupant(adjId, leadersPositions, placements);
                if (occupant) nearbyUnits++;
            });
            score += nearbyUnits * 15;
        }
        
        // Brewmaster (tavernier) wants to be near allies
        if (cardKey === 'tavernier') {
            let nearbyAllies = 0;
            adjacents.forEach(adjId => {
                const occupant = getNodeOccupant(adjId, leadersPositions, placements);
                if (occupant && occupant.playerKey === aiPlayerKey) nearbyAllies++;
            });
            score += nearbyAllies * 20;
        }
    }
    
    // === SPECIAL CASES ===
    
    // Hermit & Cub (vieilours/ourson) - Hermit should be positioned defensively
    if (cardKey === 'vieilours' || cardKey === 'hermitandcub') {
        score += Math.max(0, (8 - distToOwnLeader)) * 10;
    }
    // Cub is defensive blocker
    if (cardKey === 'ourson') {
        score += Math.max(0, (6 - distToOwnLeader)) * 8;
        // Adjacent to leader is good for blocking
        const ownLeaderAdjacents = getAdjacentNodeIds(NODES, ownLeaderNodeId);
        if (ownLeaderAdjacents.includes(node.id)) {
            score += 35;
        }
    }
    
    // Nemesis - unpredictable, prefer positions that aren't too close to own leader
    if (cardKey === 'nemesis') {
        if (distToOwnLeader >= 3) score += 20; // Keep away from own leader
        score += Math.max(0, (10 - distToEnemy)) * 8; // But close to enemy
    }
    
    // === AVOID BAD POSITIONS ===
    
    // Penalty for being too close to existing enemy units (vulnerable)
    placements.forEach(p => {
        if (p.playerKey === enemyKey) {
            const enemyNode = NODE_MAP.get(p.nodeId);
            if (enemyNode) {
                const distToEnemy = Math.abs(node.col - enemyNode.col) + Math.abs(node.y - enemyNode.y);
                if (distToEnemy === 1) {
                    // Adjacent to enemy on placement is risky
                    score -= 25;
                    // Extra penalty if the enemy is a high-threat unit
                    if (HIGH_THREAT_ABILITIES.includes(p.cardKey)) {
                        score -= 30;
                    }
                }
            }
        }
    });
    
    // Bonus for being near friendly units (mutual support)
    let friendlyNeighbors = 0;
    const adjacents = getAdjacentNodeIds(NODES, node.id);
    adjacents.forEach(adjId => {
        const occupant = getNodeOccupant(adjId, leadersPositions, placements);
        if (occupant && occupant.playerKey === aiPlayerKey && occupant.type === 'unit') {
            friendlyNeighbors++;
        }
    });
    score += friendlyNeighbors * 10; // Mutual support bonus
    
    return score;
};

/**
 * Finds the best placement position from a list of valid nodes.
 * 
 * @param {Array} validNodes - Array of valid placement nodes
 * @param {string} cardKey - The character being placed
 * @param {Array} placements - Current board placements
 * @param {Object} leadersPositions - Leader positions
 * @param {string} aiPlayerKey - The AI's player key
 * @returns {Object} The best node to place the unit
 */
export const getBestPlacementNode = (validNodes, cardKey, placements, leadersPositions, aiPlayerKey = 'p2') => {
    if (!validNodes || validNodes.length === 0) return null;
    if (validNodes.length === 1) return validNodes[0];
    
    let bestNode = validNodes[0];
    let bestScore = -Infinity;
    
    validNodes.forEach(node => {
        const score = scorePlacementPosition(node, cardKey, placements, leadersPositions, aiPlayerKey);
        if (score > bestScore) {
            bestScore = score;
            bestNode = node;
        }
    });
    
    console.log(`AI Placement: ${cardKey} -> Node ${bestNode.id} (Score: ${bestScore})`);
    return bestNode;
};

/**
 * Main Entry Point for AI Decision
 */
export const getBestMove = (gameState, aiPlayerKey) => {
    const start = performance.now();
    
    // 1. Determine Phase (Recruitment or Action)
    const isRecruitmentPhase = gameState.recruitPickRemaining > 0;
    
    // 2. For Recruitment, use smart selection with counter-picking and synergy
    if (isRecruitmentPhase) {
        const enemyKey = aiPlayerKey === 'p1' ? 'p2' : 'p1';
        const enemyDeck = gameState.decks[enemyKey] || [];
        const ownDeck = gameState.decks[aiPlayerKey] || [];
        const ownPlacements = gameState.placements?.filter(p => p?.playerKey === aiPlayerKey) || [];
        
        const recruitMoves = [];
        gameState.leaders.forEach((card, index) => {
            if (card) {
                const cardKey = extractCardKey(card);
                
                // Base recruitment value (already includes context-aware adjustments)
                let value = getRecruitmentValue(cardKey, { state: gameState, playerKey: aiPlayerKey, enemyKey });
                
                // Add counter-pick bonus based on enemy deck composition
                const counterBonus = getCounterPickBonus(cardKey, enemyDeck);
                value += counterBonus;
                
                // Add synergy bonus based on what we already have
                const synergyBonus = getSynergyBonus(cardKey, ownDeck, ownPlacements);
                value += synergyBonus;
                
                recruitMoves.push({ 
                    type: 'RECRUIT', 
                    index, 
                    card, 
                    cardKey, 
                    value,
                    debug: { 
                        base: getRecruitmentValue(cardKey, { state: gameState, playerKey: aiPlayerKey, enemyKey }), 
                        counter: counterBonus, 
                        synergy: synergyBonus 
                    } 
                });
            }
        });
        
        // Sort by value (highest first) and pick the best
        recruitMoves.sort((a, b) => b.value - a.value);
        
        const end = performance.now();
        const bestRecruit = recruitMoves[0] || null;
        console.log(`AI Recruitment: ${(end - start).toFixed(2)}ms | Best: ${bestRecruit?.cardKey} (${bestRecruit?.value})`, recruitMoves);
        
        return bestRecruit;
    }
    
    // 3. For Action Phase, do tactical scan first (forced lines), then fallback to Minimax.
    // A) Mate-in-1 (immediate win)
    const forcedStart = performance.now();
    const immediateWin = findImmediateWinMove(gameState, aiPlayerKey, forcedStart, FORCED_SCAN_PER_CALL_BUDGET_MS);
    if (immediateWin) {
        const end = performance.now();
        console.log(`AI Forced Line: mate-in-1 found in ${(end - start).toFixed(2)}ms | Move:`, immediateWin);
        return immediateWin;
    }

    // B) Must-defend against enemy mate-in-1
    if (!isTimeUp(forcedStart, FORCED_SCAN_TOTAL_BUDGET_MS)) {
        const defenseMove = findBestDefenseAgainstMateIn1(gameState, aiPlayerKey);
        if (defenseMove) {
            const end = performance.now();
            console.log(`AI Forced Line: defended mate-in-1 in ${(end - start).toFixed(2)}ms | Move:`, defenseMove);
            return defenseMove;
        }
    }

    // C) Forced win in 2 plies (mate-in-2)
    if (!isTimeUp(forcedStart, FORCED_SCAN_TOTAL_BUDGET_MS)) {
        const forcedWin2 = findForcedWinInTwo(gameState, aiPlayerKey, FORCED_SCAN_MAX_CANDIDATES_MATE2);
        if (forcedWin2) {
            const end = performance.now();
            console.log(`AI Forced Line: mate-in-2 found in ${(end - start).toFixed(2)}ms | Move:`, forcedWin2);
            return forcedWin2;
        }
    }

    // E) Enemy full defense (turtle) response:
    // - If we have Assassin, send it in solo.
    // - If we have Archer, prefer keeping only Archer + 1 non-defensive attacker committed.
    // The deeper minimax evaluation also enforces this, but this fast check helps pick the right "first step".
    const enemyKey = otherPlayerKey(aiPlayerKey);
    const enemyDefense = getEnemyFullDefenseInfo(gameState, enemyKey);
    if (enemyDefense.isFullDefense && !isTimeUp(forcedStart, FORCED_SCAN_TOTAL_BUDGET_MS)) {
        const enemyLeaderId = gameState.leadersPositions[enemyKey];
        const ownLeaderId = gameState.leadersPositions[aiPlayerKey];

        const assassinUnits = (gameState.placements ?? []).filter((p) => p?.playerKey === aiPlayerKey && p?.cardKey === 'assassin');
        if (assassinUnits.length > 0) {
            const allMoves = orderMovesForForcedScan(gameState, getAllPossibleMoves(gameState, aiPlayerKey, false), aiPlayerKey);
            const assassinMoves = allMoves.filter((m) => m?.type === 'MOVE_UNIT' && m?.cardKey === 'assassin' && m?.to != null);

            let best = null;
            let bestScore = -Infinity;
            let checked = 0;

            // Precompute best first-step per assassin position.
            const assassinStepPlan = new Map();
            for (const u of assassinUnits) {
                assassinStepPlan.set(u.nodeId, getAssassinBestFirstStep(gameState, aiPlayerKey, enemyKey, u.nodeId));
            }

            for (const move of assassinMoves) {
                if (checked >= 10 || isTimeUp(forcedStart, FORCED_SCAN_TOTAL_BUDGET_MS)) break;

                const plan = assassinStepPlan.get(move.unitId) ?? null;
                // If we found an unblocked route, strongly prefer following its first step.
                // If there's no route, we still allow fallback to distance-improving moves.
                if (plan && move.to !== plan.firstStep) {
                    checked++;
                    continue;
                }

                const d0 = manhattanDist(move.unitId, enemyLeaderId);
                const d1 = manhattanDist(move.to, enemyLeaderId);
                // Must actually move closer (solo attack intention).
                if (d1 >= d0) {
                    checked++;
                    continue;
                }

                const nextState = applyMove(gameState, move);
                const aiSafetyAfter = evaluateLeaderState(aiPlayerKey, nextState.placements, nextState.leadersPositions);
                if (aiSafetyAfter.captured || aiSafetyAfter.surrounded) {
                    checked++;
                    continue;
                }

                // Do not allow an immediate enemy win as a result of this poke.
                if (hasImmediateWin(nextState, enemyKey, forcedStart, FORCED_SCAN_PER_CALL_BUDGET_MS)) {
                    checked++;
                    continue;
                }

                // Prefer assassin closer to enemy leader, but keep a soft preference to not overextend our leader.
                const leaderGap = manhattanDist(ownLeaderId, enemyLeaderId);
                const evalScore = evaluateState(nextState, aiPlayerKey, null, 0);
                const pathBonus = plan ? Math.max(0, 7 - plan.pathLen) * 220 : 0;
                const quickScore = evalScore + ((d0 - d1) * 400) + pathBonus + (leaderGap <= 4 ? -80 : 0);

                if (quickScore > bestScore) {
                    bestScore = quickScore;
                    best = move;
                }
                checked++;
            }

            if (best) {
                const end = performance.now();
                console.log(`AI Turtle Response: enemy=${enemyDefense.reason} | assassin solo in ${(end - start).toFixed(2)}ms | Move:`, best);
                return best;
            }
        }
    }

    // F) Mirror full defense: if enemy is turtling, keep OUR leader maximally safe.
    // This prevents the "full def only a few rounds" problem by selecting a defense-improving move
    // before running the full minimax.
    if (enemyDefense.isFullDefense && !isTimeUp(forcedStart, FORCED_SCAN_TOTAL_BUDGET_MS)) {
        const ourDefense = getOurDefenseInfo(gameState, aiPlayerKey);
        const aiSafetyNow = evaluateLeaderState(aiPlayerKey, gameState.placements, gameState.leadersPositions);
        const needMaintainDefense = !ourDefense.isFullDefense || aiSafetyNow.surrounded || aiSafetyNow.captured;

        if (needMaintainDefense) {
            const moves = orderMovesForForcedScan(gameState, getAllPossibleMoves(gameState, aiPlayerKey, false), aiPlayerKey);
            let bestMove = null;
            let bestValue = -Infinity;
            let checked = 0;

            for (const move of moves) {
                if (checked >= 18 || isTimeUp(forcedStart, FORCED_SCAN_TOTAL_BUDGET_MS)) break;

                // Prefer defensive-unit moves and safe leader moves; avoid throwing attackers away.
                if (move?.type === 'MOVE_UNIT') {
                    const k = move.cardKey;
                    const isDef = DEFENSIVE_UNITS.includes(k) || k === 'ourson';
                    const allowedPoke = k === 'assassin' || k === 'archere';
                    if (!isDef && !allowedPoke) {
                        // Skip most non-defensive moves in this maintenance phase.
                        checked++;
                        continue;
                    }
                }

                const nextState = applyMove(gameState, move);
                const aiSafetyAfter = evaluateLeaderState(aiPlayerKey, nextState.placements, nextState.leadersPositions);
                if (aiSafetyAfter.captured) {
                    checked++;
                    continue;
                }

                // Hard requirement: do not allow immediate enemy win.
                if (hasImmediateWin(nextState, enemyKey, forcedStart, FORCED_SCAN_PER_CALL_BUDGET_MS)) {
                    checked++;
                    continue;
                }

                const stats = getLeaderAdjacencyStats(nextState, aiPlayerKey);
                const defendersAdj = (nextState.placements ?? []).filter((p) =>
                    p && p.playerKey === aiPlayerKey && (DEFENSIVE_UNITS.includes(p.cardKey) || p.cardKey === 'ourson') &&
                    stats.adjacentIds.includes(p.nodeId)
                ).length;

                // Primary: more adjacent defenders + more empty adjacent squares (escape routes).
                // Secondary: overall evaluation.
                const value = (defendersAdj * 500) + (stats.emptyAdjacentCount * 180) + evaluateState(nextState, aiPlayerKey, null, 0);

                if (value > bestValue) {
                    bestValue = value;
                    bestMove = move;
                }

                checked++;
            }

            if (bestMove) {
                const end = performance.now();
                console.log(`AI Turtle Response: mirror full defense in ${(end - start).toFixed(2)}ms | Move:`, bestMove);
                return bestMove;
            }
        }
    }

    // G) Turtle-vs-turtle: keep OUR full defense, but still attack if there is an opening.
    // - If enemy has a gap: exploit it without breaking our shell.
    // - If no gap: probe using units already near enemy leader to create a gap.
    if (enemyDefense.isFullDefense && !isTimeUp(forcedStart, FORCED_SCAN_TOTAL_BUDGET_MS)) {
        const ourDefense = getOurDefenseInfo(gameState, aiPlayerKey);
        if (ourDefense.isFullDefense) {
            const poke = findBestSafeAttackWhileMaintainingFullDefense(gameState, aiPlayerKey, forcedStart, FORCED_SCAN_TOTAL_BUDGET_MS);
            if (poke) {
                const end = performance.now();
                console.log(`AI Turtle Response: maintain full defense + attack in ${(end - start).toFixed(2)}ms | Move:`, poke);
                return poke;
            }
        }
    }

    // D) Full search (TURN-AWARE): respects movementTracker so the AI can plan multi-action turns.
    // Also uses a transposition table so deeper tactics are feasible in the browser.
    const tt = new Map();
    const result = minimaxTurnAware(
        gameState,
        MAX_DEPTH,
        -INFINITY,
        INFINITY,
        aiPlayerKey,
        aiPlayerKey,
        tt
    );

    const end = performance.now();
    console.log(`AI Thought Time: ${(end - start).toFixed(2)}ms | Score: ${result.score} | Move:`, result.move);

    return result.move;
};

/**
 * Evaluation Function (The "Brain")
 */
const evaluateState = (state, aiPlayerKey, outcome, plyFromRoot = 0) => {
    if (outcome) {
        if (outcome.winner === playerKeyToLabel(aiPlayerKey)) return INFINITY; // AI Wins
        return -INFINITY; // AI Loses
    }

    const enemyKey = aiPlayerKey === 'p1' ? 'p2' : 'p1';
    const useHeavyEval = plyFromRoot <= 2; // Heavy heuristics only near the root to save time
    let score = 0;

    // 1. Material Score (Units on Board)
    state.placements.forEach(p => {
        const opposingDeck = p.playerKey === aiPlayerKey ? state.decks[enemyKey] : state.decks[aiPlayerKey];
        const weight = getDynamicWeight(p.cardKey, opposingDeck, {
            state,
            aiPlayerKey,
            pieceOwnerKey: p.playerKey,
        });
        if (p.playerKey === aiPlayerKey) score += weight;
        else score -= weight;
    });

    // 2. Hand Score (Potential)
    state.decks[aiPlayerKey]?.forEach(c => {
        if (c) score += (getRecruitmentValue(c.cardKey, { state, playerKey: aiPlayerKey, enemyKey }) * 0.5); // Hand value is 50% of board value
    });
    state.decks[enemyKey]?.forEach(c => {
        if (c) score -= (getRecruitmentValue(c.cardKey, { state, playerKey: enemyKey, enemyKey: aiPlayerKey }) * 0.5);
    });

    // 3. Leader Safety (Crucial)
    const aiSafety = evaluateLeaderState(aiPlayerKey, state.placements, state.leadersPositions);
    const enemySafety = evaluateLeaderState(enemyKey, state.placements, state.leadersPositions);

    // Detect if the enemy is turtling (full defense). Used to shift our strategy.
    const enemyDefense = getEnemyFullDefenseInfo(state, enemyKey);

    if (aiSafety.captured || aiSafety.surrounded) score -= 10000; // Danger! (Increased from 5000)
    if (enemySafety.captured || enemySafety.surrounded) score += 10000; // Winning chance!

    // --- Early exit for light eval to keep depth fast ---
    if (!useHeavyEval) {
        const aiLeaderId = state.leadersPositions[aiPlayerKey];
        const aiLeaderNode = NODE_MAP.get(aiLeaderId);
        const enemyLeaderId = state.leadersPositions[enemyKey];
        const enemyLeaderNode = NODE_MAP.get(enemyLeaderId);

        // Escort heuristic (cheap): leader yang terlalu maju tanpa unit defensif = buruk.
        const distLeaders = manhattanDist(aiLeaderId, enemyLeaderId);
        const defendersNearLeader = (state.placements ?? []).filter((p) => {
            if (!p || p.playerKey !== aiPlayerKey) return false;
            const k = p.cardKey;
            if (!(DEFENSIVE_UNITS.includes(k) || k === 'ourson')) return false;
            return manhattanDist(p.nodeId, aiLeaderId) <= 2;
        }).length;
        if (distLeaders <= 5 && defendersNearLeader === 0) score -= 450;
        if (distLeaders <= 4 && defendersNearLeader === 0) score -= 700;

        // Penalize nearby high-threat enemies (cheap distance-only)
        state.placements.forEach(p => {
            if (p.playerKey !== enemyKey) return;
            const unitNode = NODE_MAP.get(p.nodeId);
            if (!unitNode || !aiLeaderNode) return;
            const dist = Math.abs(unitNode.col - aiLeaderNode.col) + Math.abs(unitNode.row - aiLeaderNode.row);
            if (HIGH_THREAT_ABILITIES.includes(p.cardKey)) {
                score -= Math.max(0, 5 - dist) * 170;
            } else {
                score -= Math.max(0, 4 - dist) * 70;
            }
        });

        // Reward own units pressuring enemy leader (cheap distance-only)
        // Diturunkan agar AI tidak terlalu agresif.
        state.placements.forEach(p => {
            if (p.playerKey !== aiPlayerKey) return;
            const unitNode = NODE_MAP.get(p.nodeId);
            if (!unitNode || !enemyLeaderNode) return;
            const dist = Math.abs(unitNode.col - enemyLeaderNode.col) + Math.abs(unitNode.row - enemyLeaderNode.row);
            score += Math.max(0, 5 - dist) * 15;
        });

        // Turtle response (light):
        // If enemy is in full defense, only commit:
        // - Assassin solo (preferred), OR
        // - Archer + 1 non-defensive attacker.
        // Everyone else should stay near our leader.
        if (enemyDefense.isFullDefense) {
            const aiLeaderId = state.leadersPositions[aiPlayerKey];
            const enemyLeaderId = state.leadersPositions[enemyKey];
            const aiUnits = (state.placements ?? []).filter((p) => p?.playerKey === aiPlayerKey);

            const hasAssassin = aiUnits.some((u) => u.cardKey === 'assassin');
            const hasArcher = aiUnits.some((u) => u.cardKey === 'archere');
            const allowedTokenKeys = new Set();

            if (hasAssassin) {
                // Allow assassin to be far.
                aiUnits
                    .filter((u) => u.cardKey === 'assassin')
                    .forEach((u) => allowedTokenKeys.add(`${u.deckIndex ?? ''}:${u.tokenId ?? ''}:${u.nodeId ?? ''}`));

                // Bonus for assassin proximity to enemy leader.
                aiUnits
                    .filter((u) => u.cardKey === 'assassin')
                    .forEach((u) => {
                        const d = manhattanDist(u.nodeId, enemyLeaderId);
                        score += Math.max(0, 6 - d) * 180;
                    });
            } else if (hasArcher) {
                // Allow archer + one best attacker.
                const archer = aiUnits.find((u) => u.cardKey === 'archere');
                if (archer) allowedTokenKeys.add(`${archer.deckIndex ?? ''}:${archer.tokenId ?? ''}:${archer.nodeId ?? ''}`);

                const candidates = aiUnits.filter((u) => {
                    const k = u.cardKey;
                    const isDefensive = (DEFENSIVE_UNITS.includes(k) || k === 'ourson');
                    return !isDefensive && k !== 'archere';
                });
                let bestAttacker = null;
                let bestAttackerDist = Infinity;
                for (const c of candidates) {
                    const d = manhattanDist(c.nodeId, enemyLeaderId);
                    if (d < bestAttackerDist) {
                        bestAttackerDist = d;
                        bestAttacker = c;
                    }
                }
                if (bestAttacker) {
                    allowedTokenKeys.add(`${bestAttacker.deckIndex ?? ''}:${bestAttacker.tokenId ?? ''}:${bestAttacker.nodeId ?? ''}`);
                }
            }

            // Penalize all other non-defensive units that wander too far from our leader.
            for (const u of aiUnits) {
                const k = u.cardKey;
                const isDefensive = (DEFENSIVE_UNITS.includes(k) || k === 'ourson');
                if (isDefensive) continue;

                const tokenKey = `${u.deckIndex ?? ''}:${u.tokenId ?? ''}:${u.nodeId ?? ''}`;
                if (allowedTokenKeys.has(tokenKey)) continue;

                const dOwn = manhattanDist(u.nodeId, aiLeaderId);
                if (dOwn > 3) score -= (dOwn - 3) * 220;
            }
        }

        return score;
    }

    // --- NEW: Threat Awareness & Ability Awareness ---
    
    // A. Analyze Enemy Threats on Board (COMPREHENSIVE)
    const aiLeaderNodeId = state.leadersPositions[aiPlayerKey];
    const aiLeaderNode = NODES.find(n => n.id === aiLeaderNodeId);
    const aiLeaderAdjacentsForThreats = getAdjacentNodeIds(NODES, aiLeaderNodeId);
    
    state.placements.forEach(p => {
        if (p.playerKey === enemyKey) {
            const unitNode = NODES.find(n => n.id === p.nodeId);
            
            // ============ ACTIVE ABILITY THREATS ============
            
            // 1. LANCE-GRAPPIN (Grappling Hook) - Can pull Leader
            if (p.cardKey === 'lancegrappin') {
                const targets = getClawLauncherTargets(p.nodeId, enemyKey, state.placements, state.leadersPositions);
                const threatensLeader = targets.some(t => t.nodeId === aiLeaderNodeId);
                if (threatensLeader) score -= 2500; // High threat: Can be pulled
                
                // Also dangerous if it can pull AI's defensive units away
                const canPullDefender = targets.some(t => 
                    t.playerKey === aiPlayerKey && aiLeaderAdjacentsForThreats.includes(t.nodeId)
                );
                if (canPullDefender) score -= 800; // Can disrupt defense
            }
            
            // 2. MANIPULATRICE - Can forcibly move Leader
            else if (p.cardKey === 'manipulatrice') {
                const targets = getManipulatorTargets(p.nodeId, enemyKey, state.placements, state.leadersPositions);
                const threatensLeader = targets.some(t => t.nodeId === aiLeaderNodeId);
                if (threatensLeader) score -= 2500; // High threat: Can be moved into trap
                
                // Check if manipulator can move AI units protecting leader
                const canMoveDefender = targets.some(t => 
                    t.playerKey === aiPlayerKey && aiLeaderAdjacentsForThreats.includes(t.nodeId)
                );
                if (canMoveDefender) score -= 800;
            }
            
            // 3. ASSASSIN - Lethal at close range
            else if (p.cardKey === 'assassin') {
                if (unitNode && aiLeaderNode) {
                    const dist = Math.abs(unitNode.col - aiLeaderNode.col) + Math.abs(unitNode.row - aiLeaderNode.row);
                    if (dist === 1) score -= 4000; // Adjacent = CRITICAL
                    else if (dist === 2) score -= 1500; // Very close
                    else if (dist <= 3) score -= 500; // Approaching
                }
            }
            
            // 4. ILLUSIONNISTE - Can swap positions (VERY DANGEROUS)
            else if (p.cardKey === 'illusionniste') {
                const targets = getIllusionistTargets(p.nodeId, enemyKey, state.placements, state.leadersPositions);
                
                // Can it swap with AI Leader directly?
                const canSwapLeader = targets.some(t => t.nodeId === aiLeaderNodeId);
                if (canSwapLeader) score -= 3000; // Can teleport leader into danger!
                
                // Can it swap an enemy unit to be adjacent to AI leader?
                const canSwapToThreat = targets.some(t => {
                    if (t.playerKey === enemyKey && t.type === 'unit') {
                        // After swap, illusionist would be at target position
                        // Check if illusionist's current position is adjacent to AI leader
                        return aiLeaderAdjacentsForThreats.includes(p.nodeId);
                    }
                    return false;
                });
                if (canSwapToThreat) score -= 1500;
                
                // Can swap AI's defensive units away?
                const canSwapDefender = targets.some(t => 
                    t.playerKey === aiPlayerKey && aiLeaderAdjacentsForThreats.includes(t.nodeId)
                );
                if (canSwapDefender) score -= 1000;
            }
            
            // 5. COGNEUR (Bruiser) - Can push units
            else if (p.cardKey === 'cogneur') {
                const pushTargets = getBruiserTargets(p.nodeId, enemyKey, state.placements, state.leadersPositions);
                
                // Can it push AI leader?
                const canPushLeader = pushTargets.some(t => t.nodeId === aiLeaderNodeId);
                if (canPushLeader) score -= 2000; // Can push leader into corner
                
                // Can it push away AI's defenders?
                const canPushDefender = pushTargets.some(t => 
                    t.playerKey === aiPlayerKey && aiLeaderAdjacentsForThreats.includes(t.nodeId)
                );
                if (canPushDefender) score -= 1200; // Can clear path to leader
                
                // Distance-based threat
                if (unitNode && aiLeaderNode) {
                    const dist = Math.abs(unitNode.col - aiLeaderNode.col) + Math.abs(unitNode.row - aiLeaderNode.row);
                    if (dist <= 2) score -= 400;
                }
            }
            
            // 6. RODEUSE (Wanderer) - Extreme mobility, can appear anywhere!
            else if (p.cardKey === 'rodeuse') {
                const destinations = getWandererDestinations(p.nodeId, enemyKey, state.placements, state.leadersPositions);
                
                // Can land adjacent to AI leader?
                const canReachLeader = destinations.some(destId => aiLeaderAdjacentsForThreats.includes(destId));
                if (canReachLeader) score -= 1500; // High mobility threat
                
                // Even if can't reach now, wanderer is always dangerous
                score -= 200; // General anxiety about wanderer
            }
            
            // 7. CAVALIER (Rider) - Dash through units
            else if (p.cardKey === 'cavalier') {
                const dashes = getRiderLandingOptions(p.nodeId, state.placements, state.leadersPositions);
                const canReachLeaderAdjacent = dashes.some(destId => aiLeaderAdjacentsForThreats.includes(destId));
                if (canReachLeaderAdjacent) score -= 1200; // Can dash to leader
                
                if (unitNode && aiLeaderNode) {
                    const dist = Math.abs(unitNode.col - aiLeaderNode.col) + Math.abs(unitNode.row - aiLeaderNode.row);
                    if (dist <= 4) score -= 300; // In dash range
                }
            }
            
            // 8. ACROBATE - Jump over units
            else if (p.cardKey === 'acrobate') {
                const jumps = getAcrobatLandingOptions(p.nodeId, state.placements, state.leadersPositions);
                const canJumpToLeader = jumps.some(j => aiLeaderAdjacentsForThreats.includes(j.nodeId));
                if (canJumpToLeader) score -= 1200; // Can jump to leader
                
                if (unitNode && aiLeaderNode) {
                    const dist = Math.abs(unitNode.col - aiLeaderNode.col) + Math.abs(unitNode.row - aiLeaderNode.row);
                    if (dist <= 3) score -= 300;
                }
            }
            
            // 9. GARDE ROYAL (Royal Guard) - Special movement near enemy leader
            else if (p.cardKey === 'garderoyal') {
                // Royal Guard moves relative to ENEMY leader, which is AI's leader!
                // Note: getRoyalGuardMoves uses the player's OWN leader, so this might need adjustment
                // But if enemy Royal Guard exists, it's still a mobile threat
                if (unitNode && aiLeaderNode) {
                    const dist = Math.abs(unitNode.col - aiLeaderNode.col) + Math.abs(unitNode.row - aiLeaderNode.row);
                    if (dist <= 2) score -= 600; // Close royal guard
                    else if (dist <= 4) score -= 300;
                }
            }
            
            // ============ PASSIVE ABILITY THREATS ============
            
            // 10. GEOLIER (Jailer) - Blocks escape routes passively
            else if (p.cardKey === 'geolier') {
                // Geolier is dangerous near leader because it can block escapes
                if (unitNode && aiLeaderNode) {
                    const dist = Math.abs(unitNode.col - aiLeaderNode.col) + Math.abs(unitNode.row - aiLeaderNode.row);
                    if (dist <= 2) score -= 800; // Blocking escape routes
                    if (dist === 1) score -= 1200; // Adjacent jailer is very bad
                }
            }
            
            // 11. ARCHERE (Archer) - Ranged passive threat
            else if (p.cardKey === 'archere') {
                // Archer threatens in straight lines
                if (unitNode && aiLeaderNode) {
                    const sameCol = unitNode.col === aiLeaderNode.col;
                    const sameRow = unitNode.row === aiLeaderNode.row;
                    if (sameCol || sameRow) {
                        score -= 500; // In firing line
                    }
                    const dist = Math.abs(unitNode.col - aiLeaderNode.col) + Math.abs(unitNode.row - aiLeaderNode.row);
                    if (dist <= 3) score -= 300;
                }
            }
            
            // 12. NEMESIS - Mirrors opponent's last move (unpredictable)
            else if (p.cardKey === 'nemesis') {
                if (unitNode && aiLeaderNode) {
                    const dist = Math.abs(unitNode.col - aiLeaderNode.col) + Math.abs(unitNode.row - aiLeaderNode.row);
                    if (dist <= 2) score -= 500; // Unpredictable threat
                }
            }
            
            // 13. Generic proximity threat for any other unit
            else {
                if (unitNode && aiLeaderNode) {
                    const dist = Math.abs(unitNode.col - aiLeaderNode.col) + Math.abs(unitNode.row - aiLeaderNode.row);
                    if (dist === 1) score -= 200; // Any adjacent enemy is a threat
                }
            }
        }
    });

    // B. Analyze Enemy Hand (Potential Threats) - COMPREHENSIVE
    const aiLeaderEmptySpacesForHand = aiLeaderAdjacentsForThreats.filter(id => 
        isNodeEmpty(id, state.placements, state.leadersPositions)
    ).length;
    const isLeaderVulnerable = aiLeaderEmptySpacesForHand <= 2;
    
    state.decks[enemyKey]?.forEach(c => {
        if (c) {
            // High threat abilities in hand
            if (HIGH_THREAT_ABILITIES.includes(c.cardKey)) {
                score -= 150;
                if (isLeaderVulnerable) score -= 200; // Extra penalty when vulnerable
            }
            
            // Mobile abilities in hand
            if (MOBILE_ABILITIES.includes(c.cardKey)) {
                score -= 80;
                if (isLeaderVulnerable) score -= 150;
            }
            
            // Passive threat abilities
            if (PASSIVE_THREAT_ABILITIES.includes(c.cardKey)) {
                score -= 50;
            }
            
            // Specific high-danger cards
            if (c.cardKey === 'illusionniste') {
                score -= 100; // Swap ability is very dangerous to hold
            }
            if (c.cardKey === 'rodeuse') {
                score -= 100; // Can appear anywhere
            }
        }
    });

    // C. ADVANCED Checkmate / Trap Awareness
    const checkmateThreat = detectImmediateCheckmateThreat(aiPlayerKey, state);
    const checkmateOpp = detectCheckmateOpportunity(aiPlayerKey, state);
    
    // Apply threat penalties based on severity
    switch (checkmateThreat.level) {
        case 3: // CRITICAL
            score -= 8000;
            break;
        case 2: // DANGER
            score -= 4000;
            break;
        case 1: // WARNING
            score -= 1500;
            break;
    }
    
    // Apply opportunity bonuses
    switch (checkmateOpp.level) {
        case 3: // Can checkmate!
            score += 8000;
            break;
        case 2: // Close to checkmate
            score += 3000;
            break;
        case 1: // Good pressure
            score += 500;
            break;
    }
    
    // D. Escape Route Quality Analysis
    const aiLeaderAdjacents = getAdjacentNodeIds(NODES, state.leadersPositions[aiPlayerKey]);
    const aiLeaderEmptySpaces = aiLeaderAdjacents.filter(id => isNodeEmpty(id, state.placements, state.leadersPositions)).length;
    
    // Check quality of escape routes (are they safe or threatened?)
    let safeEscapes = 0;
    aiLeaderAdjacents.forEach(adjId => {
        if (isNodeEmpty(adjId, state.placements, state.leadersPositions)) {
            const threats = countThreatsToNode(adjId, enemyKey, state.placements, state.leadersPositions, 1);
            if (threats.count === 0) {
                safeEscapes++;
            }
        }
    });
    
    // Bonus for safe escapes, penalty if all escapes are threatened
    score += safeEscapes * 50;
    if (safeEscapes === 0 && aiLeaderEmptySpaces > 0) {
        score -= 2000; // All escape routes are under threat!
    }

    // If enemy is in full defense, we must also stay in full defense:
    // prioritize keeping our leader uncatchable by maintaining escapes + a defender shell.
    if (enemyDefense.isFullDefense) {
        // Larger premium on safe escapes in turtle mode.
        score += safeEscapes * 90;

        // Strong penalty if we're low on mobility while enemy is turtling (they will wait for a mistake).
        if (aiLeaderEmptySpaces <= 1) score -= 1200;
        if (aiLeaderEmptySpaces === 0) score -= 2200;

        // Extra penalty for any immediate checkmate warning while enemy turtles.
        if (checkmateThreat.level >= 1) score -= 1200 * checkmateThreat.level;
    }
    
    // E. Two-Turn Threat Detection
    // Check if enemy can set up a checkmate in 2 turns
    const twoMoveThreats = countThreatsToNode(state.leadersPositions[aiPlayerKey], enemyKey, state.placements, state.leadersPositions, 2);
    if (twoMoveThreats.count >= 3 && aiLeaderEmptySpaces <= 3) {
        score -= 1000; // Multiple units converging
    }

    // =========================================================================
    // F. OFFENSE (scaled): Attack Enemy Leader
    // =========================================================================

    // Leader protection is the priority. We compute offense separately and scale it down
    // when leader is vulnerable / not escorted by defensive units.
    const distLeaders = manhattanDist(state.leadersPositions[aiPlayerKey], state.leadersPositions[enemyKey]);
    const aiUnits = state.placements.filter(p => p.playerKey === aiPlayerKey);
    const aiDefenders = aiUnits.filter(u => (DEFENSIVE_UNITS.includes(u.cardKey) || u.cardKey === 'ourson'));
    const aiLeaderNodeIdForEscort = state.leadersPositions[aiPlayerKey];
    const defendersAdjacent = aiDefenders.filter(d => manhattanDist(d.nodeId, aiLeaderNodeIdForEscort) === 1).length;
    const defendersNear = aiDefenders.filter(d => manhattanDist(d.nodeId, aiLeaderNodeIdForEscort) <= 2).length;
    const leaderVulnerable = checkmateThreat.level >= 1 || aiLeaderEmptySpaces <= 2 || safeEscapes === 0;
    const escorted = defendersNear >= 1;

    // Strong penalty if leader advances without escort.
    if (distLeaders <= 5 && !escorted) score -= 900;
    if (distLeaders <= 4 && !escorted) score -= 1400;

    // Strong reward for maintaining a defensive shell around leader.
    score += defendersAdjacent * 260;
    score += Math.max(0, defendersNear - defendersAdjacent) * 110;
    if (leaderVulnerable) {
        aiDefenders.forEach((d) => {
            const dd = manhattanDist(d.nodeId, aiLeaderNodeIdForEscort);
            if (dd > 2) score -= (dd - 2) * 140;
        });
    }

    // Offense scaling: never zero (still can win), but much lower when unsafe.
    let offenseFactor = leaderVulnerable ? 0.15 : 0.55;
    if (distLeaders <= 5 && !escorted) offenseFactor = Math.min(offenseFactor, 0.10);

    // If enemy is turtling: do not overcommit attackers.
    // We still allow Assassin solo or Archer + 1 attacker, but the rest should prioritize defense.
    if (enemyDefense.isFullDefense) {
        offenseFactor = Math.min(offenseFactor, escorted ? 0.30 : 0.18);

        // Enforce a "full defense" posture: if we don't have enough defenders near leader, punish hard.
        if (defendersAdjacent < 2) score -= (2 - defendersAdjacent) * 900;
        if (defendersNear < 3) score -= (3 - defendersNear) * 450;
    }

    let offenseScore = 0;
    
    const enemyLeaderNodeId = state.leadersPositions[enemyKey];
    const enemyLeaderPos = NODES.find(n => n.id === enemyLeaderNodeId);
    const aiLeaderPos = NODES.find(n => n.id === state.leadersPositions[aiPlayerKey]);
    const enemyLeaderAdjacents = getAdjacentNodeIds(NODES, enemyLeaderNodeId);
    
    // F1. Enemy Leader Mobility Analysis (Lower = Better for AI)
    const enemyLeaderEmptySpaces = enemyLeaderAdjacents.filter(id => 
        isNodeEmpty(id, state.placements, state.leadersPositions)
    ).length;
    
    // Bonus for trapping enemy leader
    if (enemyLeaderEmptySpaces <= 1) {
        offenseScore += 3000; // Enemy almost trapped!
    } else if (enemyLeaderEmptySpaces <= 2) {
        offenseScore += 1500; // Enemy mobility restricted
    } else if (enemyLeaderEmptySpaces <= 3) {
        offenseScore += 500; // Some pressure
    }
    
    // F2. AI Units Pressure on Enemy Leader
    let aiUnitsAdjacentToEnemyLeader = 0;
    let aiUnitsNearEnemyLeader = 0; // Within 2 spaces
    let aiUnitsThreateningEnemyLeader = 0; // Can reach in 1 move (including abilities)
    
    aiUnits.forEach(unit => {
        const unitNode = NODES.find(n => n.id === unit.nodeId);
        if (!unitNode || !enemyLeaderPos) return;
        
        const distToEnemyLeader = Math.abs(unitNode.col - enemyLeaderPos.col) + Math.abs(unitNode.row - enemyLeaderPos.row);
        
        // Adjacent to enemy leader
        if (enemyLeaderAdjacents.includes(unit.nodeId)) {
            aiUnitsAdjacentToEnemyLeader++;
            offenseScore += 400; // Strong offensive position
        }
        
        // Near enemy leader (2-3 spaces)
        if (distToEnemyLeader <= 2) {
            aiUnitsNearEnemyLeader++;
            offenseScore += 150;
        } else if (distToEnemyLeader <= 3) {
            offenseScore += 50;
        }
        
        // Check if unit can threaten enemy leader with abilities
        if (unit.cardKey === 'lancegrappin') {
            const targets = getClawLauncherTargets(unit.nodeId, aiPlayerKey, state.placements, state.leadersPositions);
            if (targets.some(t => t.nodeId === enemyLeaderNodeId)) {
                aiUnitsThreateningEnemyLeader++;
                offenseScore += 800; // Can pull enemy leader!
            }
        }
        else if (unit.cardKey === 'manipulatrice') {
            const targets = getManipulatorTargets(unit.nodeId, aiPlayerKey, state.placements, state.leadersPositions);
            if (targets.some(t => t.nodeId === enemyLeaderNodeId)) {
                aiUnitsThreateningEnemyLeader++;
                offenseScore += 800; // Can move enemy leader!
            }
        }
        else if (unit.cardKey === 'cogneur') {
            const targets = getBruiserTargets(unit.nodeId, aiPlayerKey, state.placements, state.leadersPositions);
            if (targets.some(t => t.nodeId === enemyLeaderNodeId)) {
                aiUnitsThreateningEnemyLeader++;
                offenseScore += 600; // Can push enemy leader!
            }
        }
        else if (unit.cardKey === 'illusionniste') {
            const targets = getIllusionistTargets(unit.nodeId, aiPlayerKey, state.placements, state.leadersPositions);
            if (targets.some(t => t.nodeId === enemyLeaderNodeId)) {
                aiUnitsThreateningEnemyLeader++;
                offenseScore += 700; // Can swap with enemy leader!
            }
        }
        else if (unit.cardKey === 'cavalier') {
            const dashes = getRiderLandingOptions(unit.nodeId, state.placements, state.leadersPositions);
            if (dashes.some(destId => enemyLeaderAdjacents.includes(destId))) {
                aiUnitsThreateningEnemyLeader++;
                offenseScore += 500; // Can dash to enemy leader
            }
        }
        else if (unit.cardKey === 'acrobate') {
            const jumps = getAcrobatLandingOptions(unit.nodeId, state.placements, state.leadersPositions);
            if (jumps.some(j => enemyLeaderAdjacents.includes(j.nodeId))) {
                aiUnitsThreateningEnemyLeader++;
                offenseScore += 500; // Can jump to enemy leader
            }
        }
        else if (unit.cardKey === 'rodeuse') {
            const dests = getWandererDestinations(unit.nodeId, aiPlayerKey, state.placements, state.leadersPositions);
            if (dests.some(destId => enemyLeaderAdjacents.includes(destId))) {
                aiUnitsThreateningEnemyLeader++;
                offenseScore += 600; // Can wander to enemy leader
            }
        }
        
        // Bonus for offensive positioning (closer to enemy = better)
        offenseScore += Math.max(0, (7 - distToEnemyLeader) * 15);
    });
    
    // Combo bonus: Multiple units pressuring enemy leader
    if (aiUnitsAdjacentToEnemyLeader >= 2) {
        offenseScore += 1000; // Pincer attack!
    }
    if (aiUnitsNearEnemyLeader >= 3) {
        offenseScore += 800; // Surrounding enemy
    }
    if (aiUnitsThreateningEnemyLeader >= 2) {
        offenseScore += 1200; // Multiple ability threats!
    }
    
    // F3. Control Empty Spaces Around Enemy Leader
    let aiControlledEnemyEscapes = 0;
    enemyLeaderAdjacents.forEach(adjId => {
        if (isNodeEmpty(adjId, state.placements, state.leadersPositions)) {
            // Can any AI unit reach this escape route?
            const aiThreats = countThreatsToNode(adjId, aiPlayerKey, state.placements, state.leadersPositions, 1);
            if (aiThreats.count > 0) {
                aiControlledEnemyEscapes++;
                offenseScore += 200; // Controlling enemy escape
            }
        }
    });
    
    // Huge bonus if all enemy escapes are under AI control
    if (aiControlledEnemyEscapes >= enemyLeaderEmptySpaces && enemyLeaderEmptySpaces > 0) {
        offenseScore += 2000; // Checkmate setup!
    }
    
    // =========================================================================
    // G. OFFENSE (scaled): Target Enemy Units
    // =========================================================================
    
    const enemyUnits = state.placements.filter(p => p.playerKey === enemyKey);
    
    // G1. Identify High-Value Enemy Targets
    enemyUnits.forEach(enemy => {
        const enemyNode = NODES.find(n => n.id === enemy.nodeId);
        if (!enemyNode) return;
        
        // Prioritize targeting dangerous enemy units
        const isDangerous = HIGH_THREAT_ABILITIES.includes(enemy.cardKey) || 
                           MOBILE_ABILITIES.includes(enemy.cardKey);
        
        // Check if AI can threaten this enemy unit
        aiUnits.forEach(aiUnit => {
            const aiNode = NODES.find(n => n.id === aiUnit.nodeId);
            if (!aiNode) return;
            
            const dist = Math.abs(aiNode.col - enemyNode.col) + Math.abs(aiNode.row - enemyNode.row);
            
            // Adjacent = direct threat
            if (dist === 1) {
                offenseScore += isDangerous ? 150 : 50; // Bonus for threatening enemy
            }
            
            // Can capture/displace with ability?
            if (aiUnit.cardKey === 'lancegrappin') {
                const targets = getClawLauncherTargets(aiUnit.nodeId, aiPlayerKey, state.placements, state.leadersPositions);
                if (targets.some(t => t.nodeId === enemy.nodeId)) {
                    offenseScore += isDangerous ? 300 : 100; // Can pull enemy
                }
            }
            else if (aiUnit.cardKey === 'cogneur') {
                const targets = getBruiserTargets(aiUnit.nodeId, aiPlayerKey, state.placements, state.leadersPositions);
                if (targets.some(t => t.nodeId === enemy.nodeId)) {
                    offenseScore += isDangerous ? 250 : 80; // Can push enemy
                }
            }
        });
        
        // Penalty if dangerous enemy is uncontested (no AI nearby)
        const nearbyAI = aiUnits.filter(u => {
            const uNode = NODES.find(n => n.id === u.nodeId);
            if (!uNode) return false;
            const d = Math.abs(uNode.col - enemyNode.col) + Math.abs(uNode.row - enemyNode.row);
            return d <= 2;
        }).length;
        
        if (isDangerous && nearbyAI === 0) {
            offenseScore -= 200; // Dangerous enemy roaming free
        }
    });

    // Apply scaled offense at the end so defense dominates unless conditions are safe.
    score += offenseScore * offenseFactor;
    
    // =========================================================================
    // H. DEFENSIVE POSITIONING (Priority)
    // =========================================================================

    // Additional small formation score for ANY unit near leader.
    // (The main defensive shell is already rewarded above for defensive units.)
    aiUnits.forEach(unit => {
        const unitNode = NODES.find(n => n.id === unit.nodeId);
        if (!unitNode || !aiLeaderPos) return;

        const distToOwnLeader = Math.abs(unitNode.col - aiLeaderPos.col) + Math.abs(unitNode.row - aiLeaderPos.row);
        if (distToOwnLeader === 1) score += 60;
        else if (distToOwnLeader === 2) score += 15;
    });
    
    // I. Leader Mobility Balance
    score += aiLeaderEmptySpaces * 15; // Own mobility is good
    score -= enemyLeaderEmptySpaces * 20; // Enemy trapped is better

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

            // Avoid "konyol" leader moves: stepping into a square with >=2 adjacent enemy characters
            // (often means walking between two enemies), unless we're already under equal/worse pressure.
            const beforeEnemyAdj = countAdjacentEnemyCharacters(leaderNodeId, playerKey, state.placements, state.leadersPositions);
            leaderAdjacents.forEach(targetId => {
                if (isNodeEmpty(targetId, state.placements, state.leadersPositions)) {
                    const afterEnemyAdj = countAdjacentEnemyCharacters(targetId, playerKey, state.placements, state.leadersPositions);

                    // Never allow immediate self-trap / capture.
                    const nextLeaderPositions = { ...state.leadersPositions, [playerKey]: targetId };
                    if (evaluateLeaderState(playerKey, state.placements, nextLeaderPositions).captured) return;
                    if (evaluateLeaderState(playerKey, state.placements, nextLeaderPositions).surrounded) return;

                    // Blunder filter: don't increase adjacency pressure to 2+.
                    if (afterEnemyAdj >= 2 && afterEnemyAdj > beforeEnemyAdj) return;

                    moves.push({ type: 'MOVE_LEADER', from: leaderNodeId, to: targetId });
                }
            });
        }

        // 2. Unit Moves (Standard + Abilities)
        const movedUnits = state.movementTracker?.[playerKey]?.units || [];
        const playerUnits = state.placements.filter(unit => unit && unit.playerKey === playerKey);
        
        playerUnits.forEach(unit => {
            // Nemesis cannot take an action during its action phase.
            // It only moves via the forced off-turn reaction when the opponent leader moves.
            if (unit.cardKey === 'nemesis') return;

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
                    const destId = target.prevToTargetId;
                    if (destId != null && isNodeEmpty(destId, state.placements, state.leadersPositions)) {
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
        leaders: [...state.leaders], // Recruitment pool
        movementTracker: cloneMovementTracker(state.movementTracker)
    };

    // Helper: mark a unit as having used its action this turn.
    const markUnitMovedInState = (piece) => {
        if (!piece?.playerKey) return;
        const key = piece?.tokenId != null
            ? `${piece.deckIndex}:${piece.tokenId}`
            : `${piece.deckIndex}`;
        const existing = newState.movementTracker?.[piece.playerKey]?.units ?? [];
        if (existing.includes(key)) return;
        newState.movementTracker[piece.playerKey] = {
            ...newState.movementTracker[piece.playerKey],
            units: [...existing, key],
        };
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
            newState.movementTracker[playerKey] = {
                ...newState.movementTracker[playerKey],
                leader: true,
            };
        }
    } else if (move.type === 'MOVE_UNIT') {
        const unitIndex = newState.placements.findIndex(p => p.nodeId === move.unitId);
        if (unitIndex !== -1) {
            const movedPiece = newState.placements[unitIndex];
            newState.placements[unitIndex] = {
                ...newState.placements[unitIndex],
                nodeId: move.to
            };
            markUnitMovedInState(movedPiece);
        }
    } else if (move.type === 'USE_ABILITY') {
        const unitIndex = newState.placements.findIndex(p => p.nodeId === move.unitId);
        const movedPiece = unitIndex !== -1 ? newState.placements[unitIndex] : null;
        const getLeaderAtNode = (nodeId) => {
            if (newState.leadersPositions.p1 === nodeId) return 'p1';
            if (newState.leadersPositions.p2 === nodeId) return 'p2';
            return null;
        };

        const moveTargetOccupant = (targetNodeId, toNodeId) => {
            const targetIndex = newState.placements.findIndex(p => p.nodeId === targetNodeId);
            if (targetIndex !== -1) {
                newState.placements[targetIndex] = { ...newState.placements[targetIndex], nodeId: toNodeId };
                return true;
            }
            const leaderKey = getLeaderAtNode(targetNodeId);
            if (leaderKey) {
                newState.leadersPositions[leaderKey] = toNodeId;
                return true;
            }
            return false;
        };
        
        if (move.ability === 'acrobate' || move.ability === 'cavalier' || move.ability === 'garderoyal' || move.ability === 'rodeuse') {
            // Simple move abilities
            if (unitIndex !== -1) {
                newState.placements[unitIndex] = { ...newState.placements[unitIndex], nodeId: move.to };
            }
        }
        else if (move.ability === 'manipulatrice' || move.ability === 'tavernier' || move.ability === 'cogneur') {
            // Move target abilities
            moveTargetOccupant(move.targetId, move.to);
        }
        else if (move.ability === 'lancegrappin') {
            if (move.subType === 'move_self') {
                if (unitIndex !== -1) {
                    newState.placements[unitIndex] = { ...newState.placements[unitIndex], nodeId: move.to };
                }
            } else if (move.subType === 'drag_target') {
                moveTargetOccupant(move.targetId, move.to);
            }
        }
        else if (move.ability === 'illusionniste') {
            // Swap positions
            const targetIndex = newState.placements.findIndex(p => p.nodeId === move.targetId);
            const leaderKey = getLeaderAtNode(move.targetId);
            if (unitIndex !== -1 && targetIndex !== -1) {
                const unitPos = newState.placements[unitIndex].nodeId;
                const targetPos = newState.placements[targetIndex].nodeId;

                newState.placements[unitIndex] = { ...newState.placements[unitIndex], nodeId: targetPos };
                newState.placements[targetIndex] = { ...newState.placements[targetIndex], nodeId: unitPos };
            } else if (unitIndex !== -1 && leaderKey) {
                const unitPos = newState.placements[unitIndex].nodeId;
                const leaderPos = newState.leadersPositions[leaderKey];
                newState.placements[unitIndex] = { ...newState.placements[unitIndex], nodeId: leaderPos };
                newState.leadersPositions[leaderKey] = unitPos;
            }
        }

        // Abilities consume the unit's action for this turn.
        if (movedPiece) markUnitMovedInState(movedPiece);
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

// Lightweight export so other modules (e.g., Nemesis auto-move) can score a state without running full search.
export const scoreState = (state, aiPlayerKey) => evaluateState(state, aiPlayerKey, null, 0);
