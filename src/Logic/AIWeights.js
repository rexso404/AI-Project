/**
 * AI Weights & Heuristics
 * 
 * This file defines the intrinsic value of each character.
 * Used by the AI to evaluate:
 * 1. Recruitment decisions (Drafting phase)
 * 2. Threat assessment (Gameplay phase)
 * 
 * Scale: 0 - 100
 */

import { evaluateLeaderState, getAdjacentNodeIds, isNodeEmpty } from './GameUtils';

export const CHARACTER_WEIGHTS = {
    // --- TIER S (Win Conditions) ---
    'assassin': 100, // Solo capture threat. Highest priority.
    'archere': 95,   // Ranged zoning. Creates "death zones".
    'nemesis': 90,   // Uncontrollable movement. Can be baited easily.

    // --- TIER A (High Control/Defense) ---
    'geolier': 88,    // Disables enemy abilities. Strong control.
    'garderoyal': 85, // High mobility + Leader protection.
    'lancegrappin': 82, // Displacement (Pull/Move). Very disruptive.

    // --- TIER B (Value & Mobility) ---
    'cogneur': 75,   // Displacement (Push). Breaks formations.
    'illusionniste': 70, // Swapping positions. High potential but risky.
    'acrobate': 68,  // High mobility (Double jump). Good flanker.
    
    // Hermit & Cub (Individual Unit Values)
    // Note: The *Recruitment Value* is higher because you get both.
    'vieilours': 55,    // The Hermit. Standard movement/capture.
    'hermitandcub': 55, // Alias
    'ourson': 25,       // The Cub. Cannot capture, but excellent for blocking/surrounding.

    // --- TIER C (Situational) ---
    'vizir': 60,    // Leader mobility buff. Good for survival.
    'manipulatrice': 58, // Minor displacement. Hard to setup.
    'rodeuse': 55,  // Teleport. Good for positioning, bad for immediate attack.

    // --- TIER D (Low Priority) ---
    'cavalier': 45,  // Linear movement. Predictable.
    'tavernier': 40, // Ally movement. Too passive.
    'protecteur': 35, // Anti-displacement. Only good as a specific counter.
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const countInDeck = (deck = [], cardKey) => deck.filter((c) => c?.cardKey === cardKey).length;
const countOnBoard = (placements = [], playerKey, cardKey) =>
    placements.filter((p) => p?.playerKey === playerKey && p?.cardKey === cardKey).length;

const getEscapeCount = (playerKey, placements, leadersPositions) => {
    const leaderNodeId = leadersPositions?.[playerKey];
    if (leaderNodeId == null) return 0;
    const adjacent = getAdjacentNodeIds(leaderNodeId);
    return adjacent.filter((id) => isNodeEmpty(id, placements, leadersPositions)).length;
};

const isActiveUnit = (cardKey) =>
    ['assassin', 'archere', 'geolier', 'garderoyal', 'lancegrappin', 'cogneur', 'illusionniste', 'acrobate', 'manipulatrice', 'rodeuse', 'cavalier', 'tavernier', 'protecteur', 'nemesis', 'vizir', 'vieilours'].includes(cardKey);

/**
 * Calculates the value of RECRUITING a character.
 * Handles special cases like Hermit & Cub where 1 pick = 2 units.
 */
export const getRecruitmentValue = (characterKey, context = null) => {
    let value = CHARACTER_WEIGHTS[characterKey] || 50;
    
    // Special Case: Hermit & Cub
    // Recruiting Hermit (vieilours) automatically grants the Cub (ourson).
    // So the value of the PICK is the sum of both units.
    if (characterKey === 'vieilours' || characterKey === 'hermitandcub') {
        value += (CHARACTER_WEIGHTS['ourson'] || 25);
    }

    // Optional: contextual adjustment based on current board.
    // Keeps backward compatibility: if context is not provided, recruitment stays static.
    if (context?.state && context?.playerKey) {
        const state = context.state;
        const playerKey = context.playerKey;
        const enemyKey = playerKey === 'p1' ? 'p2' : 'p1';
        const placements = state.placements ?? [];
        const enemyDeck = state.decks?.[enemyKey] ?? [];
        value = getDynamicWeight(characterKey, enemyDeck, {
            state,
            aiPlayerKey: playerKey,
            pieceOwnerKey: playerKey,
        });

        // Dual pick bonus should still apply.
        if (characterKey === 'vieilours' || characterKey === 'hermitandcub') {
            value += clamp(CHARACTER_WEIGHTS['ourson'] || 25, 0, 40);
        }

        // Slight bias towards filling missing roles early.
        const myDeck = state.decks?.[playerKey] ?? [];
        const alreadyHave = countInDeck(myDeck, characterKey) + countOnBoard(placements, playerKey, characterKey);
        if (alreadyHave >= 1) value -= 8;
        if (alreadyHave >= 2) value -= 12;
    }

    return clamp(Math.round(value), 0, 140);
};

/**
 * Dynamic Weight Adjustments
 * 
 * The AI can adjust weights based on the current game state.
 * e.g., If the enemy has a Bruiser, the Protector becomes more valuable.
 */
export const getDynamicWeight = (characterKey, enemyDeck = [], context = null) => {
    let weight = CHARACTER_WEIGHTS[characterKey] || 50;

    // Keep old behavior if no context is available.
    const state = context?.state;
    const aiPlayerKey = context?.aiPlayerKey;
    const pieceOwnerKey = context?.pieceOwnerKey;
    const placements = state?.placements ?? [];
    const leadersPositions = state?.leadersPositions ?? null;
    const decks = state?.decks ?? null;

    const enemyKeyFromAI = aiPlayerKey ? (aiPlayerKey === 'p1' ? 'p2' : 'p1') : null;
    const isEnemyPiece = Boolean(aiPlayerKey && pieceOwnerKey && pieceOwnerKey !== aiPlayerKey);
    const isAllyPiece = Boolean(aiPlayerKey && pieceOwnerKey && pieceOwnerKey === aiPlayerKey);

    const aiSafety = (aiPlayerKey && leadersPositions)
        ? evaluateLeaderState(aiPlayerKey, placements, leadersPositions)
        : null;
    const enemySafety = (enemyKeyFromAI && leadersPositions)
        ? evaluateLeaderState(enemyKeyFromAI, placements, leadersPositions)
        : null;

    const aiEscapes = (aiPlayerKey && leadersPositions)
        ? getEscapeCount(aiPlayerKey, placements, leadersPositions)
        : null;
    const enemyEscapes = (enemyKeyFromAI && leadersPositions)
        ? getEscapeCount(enemyKeyFromAI, placements, leadersPositions)
        : null;

    const enemyActiveCount = enemyKeyFromAI
        ? placements.filter((p) => p?.playerKey === enemyKeyFromAI && isActiveUnit(p?.cardKey)).length
        : 0;

    const aiDeck = aiPlayerKey && decks ? (decks[aiPlayerKey] ?? []) : [];
    const enemyDeckFromAI = enemyKeyFromAI && decks ? (decks[enemyKeyFromAI] ?? []) : enemyDeck;

    // --- Baseline counters / role pressure ---
    const enemyHasDisplacement = enemyDeckFromAI.some((c) => ['cogneur', 'lancegrappin', 'manipulatrice'].includes(c?.cardKey));
    const enemyHasStrongActives = enemyDeckFromAI.some((c) => ['acrobate', 'garderoyal', 'illusionniste', 'assassin', 'archere'].includes(c?.cardKey));
    const weAreInTrouble = Boolean(aiSafety?.captured || aiSafety?.surrounded || (aiEscapes != null && aiEscapes <= 1));
    const enemyIsInTrouble = Boolean(enemySafety?.captured || enemySafety?.surrounded || (enemyEscapes != null && enemyEscapes <= 1));

    // Slight devalue duplicates (deck + board) for the evaluating side.
    if (aiPlayerKey && pieceOwnerKey && decks && isAllyPiece) {
        const already = countInDeck(aiDeck, characterKey) + countOnBoard(placements, aiPlayerKey, characterKey);
        if (already >= 1) weight -= 6;
        if (already >= 2) weight -= 10;
    }

    // Example: Protector value increases if enemy has displacement units
    if (characterKey === 'protecteur') {
        if (enemyHasDisplacement) {
            weight += 40; // Jumps from Tier D to Tier A/B
        }
        if (weAreInTrouble && enemyHasDisplacement) {
            weight += 10;
        }
    }

    // Example: Jailer value increases if enemy has strong active units
    if (characterKey === 'geolier') {
        if (enemyHasStrongActives) {
            weight += 10;
        }

        if (enemyActiveCount >= 2) weight += 6;
        if (enemyActiveCount >= 4) weight += 6;
    }

    // --- Board-context tuning per character ---
    switch (characterKey) {
        case 'vizir': {
            // Mobility buff is most valuable when your leader has few escapes.
            if (weAreInTrouble) weight += 20;
            if (aiEscapes != null && aiEscapes <= 2) weight += 8;
            const already = countInDeck(aiDeck, 'vizir') + (aiPlayerKey ? countOnBoard(placements, aiPlayerKey, 'vizir') : 0);
            if (already >= 1) weight -= 18;
            break;
        }
        case 'garderoyal': {
            if (weAreInTrouble) weight += 16;
            if (aiEscapes != null && aiEscapes <= 2) weight += 6;
            if (enemyIsInTrouble) weight += 4; // helps convert pressure into mate
            break;
        }
        case 'tavernier': {
            // Ally reposition is helpful when defending.
            if (weAreInTrouble) weight += 10;
            if (enemyIsInTrouble) weight += 2;
            break;
        }
        case 'assassin': {
            // More valuable when the opposing leader is low on escapes.
            if (enemyIsInTrouble) weight += 12;
            if (enemyEscapes != null && enemyEscapes <= 2) weight += 6;
            // As a threat: enemy assassin becomes scarier when you're in trouble.
            if (isEnemyPiece && weAreInTrouble) weight += 10;
            break;
        }
        case 'archere': {
            if (enemyEscapes != null && enemyEscapes <= 3) weight += 10;
            if (isEnemyPiece && weAreInTrouble) weight += 8;
            break;
        }
        case 'lancegrappin': {
            // Displacement spikes when leaders are under pressure.
            if (enemyIsInTrouble) weight += 10;
            if (weAreInTrouble) weight += 6;
            break;
        }
        case 'cogneur': {
            if (enemyIsInTrouble) weight += 8;
            if (weAreInTrouble) weight += 5;
            break;
        }
        case 'manipulatrice': {
            // With raycasting, manipulator is better at finding angles.
            if (enemyIsInTrouble) weight += 10;
            if (weAreInTrouble) weight += 4;
            break;
        }
        case 'illusionniste': {
            // Swaps can save leader or create tactics, but riskier.
            if (weAreInTrouble) weight += 8;
            if (enemyIsInTrouble) weight += 6;
            break;
        }
        case 'acrobate': {
            // Mobility becomes important when board is clogged.
            const occupied = placements.length + (leadersPositions ? 2 : 0);
            if (occupied >= 6) weight += 6;
            if (enemyIsInTrouble) weight += 4;
            break;
        }
        case 'rodeuse': {
            const occupied = placements.length + (leadersPositions ? 2 : 0);
            if (occupied >= 6) weight += 6;
            if (weAreInTrouble) weight += 6;
            break;
        }
        case 'cavalier': {
            // Linear rush is better when the board is less crowded.
            const occupied = placements.length + (leadersPositions ? 2 : 0);
            if (occupied <= 4) weight += 6;
            break;
        }
        case 'vieilours':
        case 'hermitandcub': {
            // Dual bodies are great for blocking when defending.
            if (weAreInTrouble) weight += 10;
            // Slightly less valuable very late when already at unit cap (if state has it).
            if (state?.placements) {
                const myUnitsOnBoard = placements.filter((p) => p?.playerKey === aiPlayerKey).length;
                if (myUnitsOnBoard >= 4) weight -= 8;
            }
            break;
        }
        case 'nemesis': {
            // High chaos: slightly up when behind (defensive shake-up) or when attacking.
            if (weAreInTrouble) weight += 6;
            if (enemyIsInTrouble) weight += 4;
            break;
        }
        default:
            break;
    }

    return clamp(Math.round(weight), 0, 140);
};
