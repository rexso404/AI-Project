# Leaders Strategy Game - College project
## Project Overview
This project is a web-based implementation of a strategy board game developed as a mini-project. It simulates a tactical game involving two opposing factions: the White Army (Blanc) and the Black Army (Noir). The game features various character classes, leaders, and strategic board mechanics.

The **primary focus** of this project is the implementation of an Artificial Intelligence (AI) opponent using the **Minimax algorithm with Alpha-Beta Pruning**. This demonstrates the application of algorithmic game theory to create a challenging single-player experience.

## Features
- **Interactive Game Board:** A visual representation of the battlefield where the game takes place.
- **Two Factions:** Play as either the White or Black faction, each with unique leaders (King/Queen).
- **Diverse Characters:** Includes multiple character classes such as Acrobat, Archer, Assassin, Cavalier, and more, each with specific roles.
- **Recruitment System:** Mechanics for recruiting new units to the field.
- **AI Opponent:** A strategic AI implemented using Minimax with Alpha-Beta Pruning to play against the user.
- **Game Logic:** Implements core rules for movement, placement, and interaction between units.

## Game Modes
The application offers two distinct modes of play:

1. **PvP (Player vs. Player):**
   - This mode serves as a local multiplayer implementation.
   - While it may not feature the full visual polish of the original game, it acts as the **reference implementation** for the game rules and mechanics, which serves as the foundation for the AI's logic.

2. **VS AI (Player vs. Computer):**
   - This is the core feature of the project.
   - It utilizes a custom-built AI powered by the **Minimax algorithm with Alpha-Beta Pruning**.
   - This mode demonstrates the capability of JavaScript to handle complex decision-making processes in a strategy game environment.

## Technologies Used
This project is built using the following technologies:

- **React:** A JavaScript library for building user interfaces.
- **Vite:** A fast build tool and development server.
- **Tailwind CSS:** A utility-first CSS framework for styling.
- **JavaScript (ES6+):** The primary programming language for game logic and interactivity.
- **TIFF.js / UTIF:** Libraries used for handling specific image formats within the game.

## Project Structure
- `src/components`: Contains reusable UI components like cards and tooltips.
- `src/Logic`: Houses the core game mechanics, board logic, and character randomization.
- `src/assets`: Stores game assets including character sprites, board images, and icons.
- `src/pages`: Defines the main views of the application (Home, Game, Board).

## How to Run the Project

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   ```

2. **Navigate to the project directory:**
   ```bash
   cd AI-Project
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   The application will typically run at `http://localhost:5173` (or the port shown in your terminal).

## Future Improvements
- Implementation of multiplayer functionality.
- Further optimization of AI heuristicsmovements.
- AI opponent for single-player mode.

## Credits & Inspiration
This project is a College project inspired by the original board game **Leaders**.
You can check out the original game here: [https://www.leadersthegame.com/](https://www.leadersthegame.com/)
