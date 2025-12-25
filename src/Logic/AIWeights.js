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

export const CHARACTER_WEIGHTS = {
    // --- TIER S (Win Conditions) ---
    'assassin': 100, // Solo capture threat. Highest priority.
    'archere': 95,   // Ranged zoning. Creates "death zones".

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
    'nemesis': 30,   // Uncontrollable movement. Can be baited easily.
};

/**
 * Calculates the value of RECRUITING a character.
 * Handles special cases like Hermit & Cub where 1 pick = 2 units.
 */
export const getRecruitmentValue = (characterKey) => {
    let value = CHARACTER_WEIGHTS[characterKey] || 50;
    
    // Special Case: Hermit & Cub
    // Recruiting Hermit (vieilours) automatically grants the Cub (ourson).
    // So the value of the PICK is the sum of both units.
    if (characterKey === 'vieilours' || characterKey === 'hermitandcub') {
        value += (CHARACTER_WEIGHTS['ourson'] || 25);
    }

    return value;
};

/**
 * Dynamic Weight Adjustments
 * 
 * The AI can adjust weights based on the current game state.
 * e.g., If the enemy has a Bruiser, the Protector becomes more valuable.
 */
export const getDynamicWeight = (characterKey, enemyDeck = []) => {
    let weight = CHARACTER_WEIGHTS[characterKey] || 50;

    // Example: Protector value increases if enemy has displacement units
    if (characterKey === 'protecteur') {
        const enemyHasDisplacement = enemyDeck.some(c => 
            ['cogneur', 'lancegrappin', 'manipulatrice'].includes(c?.cardKey)
        );
        if (enemyHasDisplacement) {
            weight += 40; // Jumps from Tier D to Tier A/B
        }
    }

    // Example: Jailer value increases if enemy has strong active units
    if (characterKey === 'geolier') {
        const enemyHasStrongActives = enemyDeck.some(c => 
            ['acrobate', 'garderoyal', 'illusionniste'].includes(c?.cardKey)
        );
        if (enemyHasStrongActives) {
            weight += 10;
        }
    }

    return weight;
};
