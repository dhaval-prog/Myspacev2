import React from 'react';
import { useCardsGame } from '../../../context/CardsGameContext';
import { CardsLobbyScreen } from './CardsLobbyScreen';
import { CardsBoardScreen } from './CardsBoardScreen';
import { CardsResultsScreen } from './CardsResultsScreen';

interface CardsGameScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
}

/** My Space Cards entry point — routes on server state, same philosophy as the NPAT game router. */
export function CardsGameScreen({ onHome, onOpenExpenses, onOpenSplit }: CardsGameScreenProps) {
  const { game, result } = useCardsGame();

  if (game?.status === 'game_end' || result) {
    return <CardsResultsScreen onHome={onHome} onOpenExpenses={onOpenExpenses} onOpenSplit={onOpenSplit} />;
  }
  if (game?.status === 'playing') {
    return <CardsBoardScreen onHome={onHome} />;
  }
  return <CardsLobbyScreen onHome={onHome} onOpenExpenses={onOpenExpenses} onOpenSplit={onOpenSplit} />;
}
