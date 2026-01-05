import { 
    getAdjacentNodeIds, 
    isNodeEmpty, 
    getNodeOccupant, 
    findNodeByCoordinates
} from './GameUtils';
import { getBoardNodes } from './Board';
import { FLOAT_TOLERANCE } from './GameConstants';

const NODES = getBoardNodes();
const NODE_MAP = new Map(NODES.map(n => [n.id, n]));

// Protector rule: enemy abilities may not move the Protector or any adjacent allies
const isProtectedFromEnemyAbility = (targetNodeId, targetPlayerKey, placements, leadersPositions) => {
    if (targetNodeId == null || !targetPlayerKey) return false;
    const protectors = placements.filter(p => p.playerKey === targetPlayerKey && p.cardKey === 'protecteur');
    if (protectors.some(p => p.nodeId === targetNodeId)) return true; // Protector itself

    const adjacents = getAdjacentNodeIds(NODES, targetNodeId);
    return protectors.some(p => adjacents.includes(p.nodeId));
};

// --- Helper: Raycasting ---
const normalizeVector = (dx, dy) => {
    const len = Math.hypot(dx, dy);
    if (!len) return { x: 0, y: 0 };
    return { x: dx / len, y: dy / len };
};

const getRayFromNeighbor = (originId, firstId) => {
    const originNode = NODE_MAP.get(originId);
    const firstNode = NODE_MAP.get(firstId);
    if (!originNode || !firstNode) return [];

    const dir = normalizeVector(firstNode.x - originNode.x, firstNode.y - originNode.y);
    const ray = [firstId];

    let prevId = originId;
    let currentId = firstId;
    while (true) {
        const currentNode = NODE_MAP.get(currentId);
        if (!currentNode) break;

        const neighbors = getAdjacentNodeIds(NODES, currentId)
            .filter((id) => id !== prevId)
            .map((id) => ({ id, node: NODE_MAP.get(id) }))
            .filter((entry) => Boolean(entry.node));

        let bestNextId = null;
        let bestDot = -Infinity;
        for (const { id, node } of neighbors) {
            const step = normalizeVector(node.x - currentNode.x, node.y - currentNode.y);
            const dot = dir.x * step.x + dir.y * step.y;
            const cross = dir.x * step.y - dir.y * step.x;

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

// --- Ability Logic ---

export const getManipulatorTargets = (originNodeId, playerKey, placements, leadersPositions) => {
    // Use the same hex "raycasting" as ClawLauncher so Manipulator sees in
    // all straight-line directions on this board.
    const enemyKey = playerKey === 'p1' ? 'p2' : 'p1';
    const adjacent = getAdjacentNodeIds(NODES, originNodeId);
    const targets = [];
    const seenTargets = new Set();

    for (const firstId of adjacent) {
        const ray = getRayFromNeighbor(originNodeId, firstId);
        if (!ray.length) continue;

        for (let idx = 0; idx < ray.length; idx += 1) {
            const nodeId = ray[idx];
            const occ = getNodeOccupant(nodeId, leadersPositions, placements);
            if (!occ) continue;

            // Line of sight blocks at the first occupied piece.
            // Must be non-adjacent: idx === 0 means the occupied piece is adjacent.
            if (idx > 0 && occ.playerKey === enemyKey) {
                if (isProtectedFromEnemyAbility(nodeId, occ.playerKey, placements, leadersPositions)) {
                    break; // dilindungi protector, tidak bisa dipindah
                }
                const key = `${occ.type}:${occ.playerKey}:${nodeId}`;
                if (!seenTargets.has(key)) {
                    targets.push({
                        ...occ,
                        nodeId,
                        rayFirstId: firstId,
                        prevToTargetId: ray[idx - 1] ?? originNodeId,
                    });
                    seenTargets.add(key);
                }
            }
            break;
        }
    }

    return targets;
};

export const getRoyalGuardMoves = (playerKey, placements, leadersPositions) => {
    const leaderNodeId = leadersPositions[playerKey];
    if (!leaderNodeId && leaderNodeId !== 0) return []; // Leader might be captured? Or just check existence.

    // Step 1: Adjacent to Leader
    const adjacentToLeader = getAdjacentNodeIds(NODES, leaderNodeId).filter(id =>
        isNodeEmpty(id, placements, leadersPositions)
    );

    const moves = [];
    adjacentToLeader.forEach(firstStepId => {
        // Option A: Stop at first step
        moves.push({ to: firstStepId });

        // Option B: Move one more step
        const secondSteps = getAdjacentNodeIds(NODES, firstStepId).filter(id =>
            isNodeEmpty(id, placements, leadersPositions)
        );
        secondSteps.forEach(secondStepId => {
            moves.push({ to: secondStepId });
        });
    });
    return moves;
};

export const getClawLauncherTargets = (originNodeId, playerKey, placements, leadersPositions) => {
    const adjacent = getAdjacentNodeIds(NODES, originNodeId);
    const targets = [];
    const seenTargets = new Set();

    for (const firstId of adjacent) {
        const ray = getRayFromNeighbor(originNodeId, firstId);
        if (!ray.length) continue;

        for (let idx = 0; idx < ray.length; idx += 1) {
            const nodeId = ray[idx];
            const occ = getNodeOccupant(nodeId, leadersPositions, placements);
            if (!occ) continue;

            // Skip self
            if (occ.type === 'unit' && occ.nodeId === originNodeId) break;

            const key = `${occ.type}:${occ.playerKey}:${nodeId}`;
            if (!seenTargets.has(key)) {
                const prevToTargetId = idx > 0 ? ray[idx - 1] : originNodeId;
                // Untuk target musuh, hormati perlindungan Protector
                if (occ.playerKey !== playerKey && isProtectedFromEnemyAbility(nodeId, occ.playerKey, placements, leadersPositions)) {
                    break;
                }
                targets.push({
                    ...occ,
                    nodeId,
                    rayFirstId: firstId,
                    prevToTargetId,
                });
                seenTargets.add(key);
            }
            break;
        }
    }
    return targets;
};

export const getBrewmasterTargets = (originNodeId, playerKey, placements, leadersPositions) => {
    const adjacentIds = getAdjacentNodeIds(NODES, originNodeId);
    return [
        ...placements
            .filter(unit => unit.playerKey === playerKey && adjacentIds.includes(unit.nodeId))
            .map(unit => ({ ...unit, type: 'unit' })),
        {
            type: 'leader',
            playerKey: playerKey,
            nodeId: leadersPositions[playerKey],
        },
    ].filter(ally => ally.nodeId && adjacentIds.includes(ally.nodeId));
};

export const getBruiserTargets = (originNodeId, playerKey, placements, leadersPositions) => {
    const enemyKey = playerKey === 'p1' ? 'p2' : 'p1';
    const adjacentIds = getAdjacentNodeIds(NODES, originNodeId);
    return [
        ...placements
            .filter(unit => unit.playerKey === enemyKey && adjacentIds.includes(unit.nodeId))
            .filter(unit => !isProtectedFromEnemyAbility(unit.nodeId, unit.playerKey, placements, leadersPositions))
            .map(unit => ({ ...unit, type: 'unit' })),
        {
            type: 'leader',
            playerKey: enemyKey,
            nodeId: leadersPositions[enemyKey],
        },
    ]
        .filter(enemy => enemy.nodeId && adjacentIds.includes(enemy.nodeId))
        .filter(enemy => !isProtectedFromEnemyAbility(enemy.nodeId, enemy.playerKey, placements, leadersPositions));
};

export const getIllusionistTargets = (originNodeId, playerKey, placements, leadersPositions) => {
    const originNode = NODE_MAP.get(originNodeId);
    if (!originNode) return [];

    const candidates = [
        ...placements
            .filter(unit => unit.nodeId !== originNodeId)
            .map(unit => ({ ...unit, type: 'unit' })),
        { type: 'leader', playerKey: 'p1', nodeId: leadersPositions.p1 },
        { type: 'leader', playerKey: 'p2', nodeId: leadersPositions.p2 },
    ].filter(candidate => !!candidate.nodeId);

    return candidates.filter(target => {
        const targetNode = NODE_MAP.get(target.nodeId);
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
            const blocker = findNodeByCoordinates(NODES, currentX, currentY);
            if (blocker) {
                const occ = getNodeOccupant(blocker.id, leadersPositions, placements);
                if (occ) return false;
            }
            currentX += stepX;
            currentY += stepY;
        }
        // Protector rule: Illusionist tidak boleh memindahkan musuh yang dilindungi Protector
        if (target.playerKey && target.playerKey !== playerKey) {
            return !isProtectedFromEnemyAbility(target.nodeId, target.playerKey, placements, leadersPositions);
        }
        return true;
    });
};

export const getWandererDestinations = (originNodeId, playerKey, placements, leadersPositions) => {
    const enemyKey = playerKey === 'p1' ? 'p2' : 'p1';
    const enemyPositions = new Set(
        placements.filter(u => u.playerKey === enemyKey).map(u => u.nodeId)
    );
    enemyPositions.add(leadersPositions[enemyKey]);

    return NODES
        .filter(node => {
            if (!isNodeEmpty(node.id, placements, leadersPositions)) return false;
            const adj = getAdjacentNodeIds(NODES, node.id);
            return !adj.some(id => enemyPositions.has(id));
        })
        .map(node => node.id);
};
