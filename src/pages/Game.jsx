import React from 'react';
import { useLocation } from 'react-router-dom';
import Board from './Board';

const Game = () => {
  const location = useLocation();
  const mode = location.state?.mode || 'player'; // Default to PvP if no state

  return (
    <Board gameMode={mode} />
  );
};

export default Game;
