import { getBoardNodes } from './Board';
import { 
    CHARACTER_DATA_MAP, 
    LEADER_DISPLAY_NAMES 
} from './GameConstants';
import { 
    getNodeOccupant, 
    isNodeEmpty, 
    getAdjacentNodeIds,
    evaluateLeaderState,
    getCardMetaFromAlias,
    extractPortraitKey,
    playerLabelToKey
} from './GameUtils';
import { getBestMove } from './Minimax';

/**
 * AI Knowledge Base & State Representation
 * 
 * This module provides the AI with a structured understanding of the game.
 * It acts as the bridge between the raw React state and the AI's decision-making logic (Minimax).
 */

export class GameAI {
    constructor(gameState) {
        this.updateState(gameState);
        this.boardNodes = getBoardNodes();
        this.nodeMap = new Map(this.boardNodes.map(n => [n.id, n]));
    }

    /**
     * Updates the AI's internal knowledge of the current game state.
     * @param {Object} gameState - The current state from Board.jsx
     */
    updateState(gameState) {
        this.leaders = gameState.leaders; // The 3 random recruitment characters
        this.decks = gameState.decks; // Player hands
        this.placements = gameState.placements; // Units on board
        this.leadersPositions = gameState.leadersPositions; // Main Leader positions
        this.currentTurn = gameState.currentTurn;
        this.movementTracker = gameState.movementTracker;
        this.retiredCards = gameState.retiredCards;
        this.recruitPickRemaining = gameState.recruitPickRemaining;
    }

    // =========================================================================
    // 1. Board & General Knowledge
    // =========================================================================

    /**
     * Returns the static board structure.
     */
    getBoardStructure() {
        return {
            nodes: this.boardNodes,
            totalNodes: this.boardNodes.length,
            // AI can use this to pre-calculate distances or influence maps
        };
    }

    /**
     * Returns details about a specific character ability.
     * @param {string} characterKey 
     */
    getCharacterAbilityInfo(characterKey) {
        return CHARACTER_DATA_MAP[characterKey] || null;
    }

    // =========================================================================
    // 2. Map & Deck Knowledge (Current State)
    // =========================================================================

    /**
     * Returns a simplified representation of the board for the AI.
     * Maps Node IDs to their occupants (Unit or Leader).
     */
    getBoardState() {
        const state = {};
        this.boardNodes.forEach(node => {
            const occupant = getNodeOccupant(node.id, this.leadersPositions, this.placements);
            if (occupant) {
                state[node.id] = {
                    type: occupant.type, // 'leader' or 'unit'
                    player: occupant.playerKey, // 'p1' or 'p2'
                    cardKey: occupant.cardKey || (occupant.type === 'leader' ? 'leader' : null),
                    // Add ability info for quick lookup during Minimax
                    ability: occupant.cardKey ? this.getCharacterAbilityInfo(occupant.cardKey) : null
                };
            } else {
                state[node.id] = null; // Empty
            }
        });
        return state;
    }

    /**
     * Returns the deck (hand) of a specific player.
     * @param {string} playerKey - 'p1' or 'p2'
     */
    getPlayerDeck(playerKey) {
        return this.decks[playerKey].map((card, index) => {
            if (!card) return null;
            return {
                index,
                cardKey: card.cardKey,
                name: card.abilityName,
                type: card.abilityType,
                // AI needs to know if this card is playable (e.g. not exhausted if that's a mechanic)
            };
        }).filter(Boolean);
    }

    /**
     * Returns the current positions of the main Leaders (Roi/Reine).
     */
    getLeaderPositions() {
        return this.leadersPositions;
    }

    // =========================================================================
    // 3. Random Deck (Recruitment Pool) Knowledge
    // =========================================================================

    /**
     * Returns the characters currently available in the recruitment pool.
     */
    getRecruitmentOptions() {
        return this.leaders.map((cardUrl, index) => {
            if (!cardUrl) return null;
            const cardKey = extractPortraitKey(cardUrl);
            const abilityInfo = this.getCharacterAbilityInfo(cardKey);
            
            return {
                index,
                cardKey,
                name: abilityInfo?.name,
                type: abilityInfo?.type,
                ability: abilityInfo?.ability
            };
        });
    }

    // =========================================================================
    // 4. Analysis Helpers (For Minimax Evaluation)
    // =========================================================================

    /**
     * Checks if a player is in danger (Check/Checkmate logic).
     */
    evaluateDangerLevel(playerKey) {
        return evaluateLeaderState(playerKey, this.placements, this.leadersPositions);
    }

    /**
     * Get all valid moves for a specific player (to be used in Minimax expansion).
     * This is a placeholder for the move generation logic.
     */
    getValidMoves(playerKey) {
        // TODO: Implement move generation for all units and leader of the player
        return [];
    }

    /**
     * Calculates the best move for the AI using Minimax.
     * @param {string} aiPlayerKey - 'p1' or 'p2'
     */
    decideMove(aiPlayerKey) {
        // Construct a clean state object for the Minimax algorithm
        const cleanState = {
            leaders: this.leaders,
            decks: this.decks,
            placements: this.placements,
            leadersPositions: this.leadersPositions,
            currentTurn: this.currentTurn,
            recruitPickRemaining: this.recruitPickRemaining || 0, // Ensure this property exists in updateState
            movementTracker: this.movementTracker
        };

        return getBestMove(cleanState, aiPlayerKey);
    }
}
