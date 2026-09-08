import React from 'react';
import { useTriviaGame } from '../../../context/TriviaGameContext';
import { TriviaLobbyScreen } from './TriviaLobbyScreen';
import { TriviaQuestionScreen } from './TriviaQuestionScreen';
import { TriviaRevealScreen } from './TriviaRevealScreen';
import { TriviaFinalResultsScreen } from './TriviaFinalResultsScreen';

interface TriviaGameScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
  /** Which tab the create/join hub opens on — set by the Games hub's Create/Join row buttons. */
  initialTab?: 'create' | 'join';
}

/** Trivia Night entry point — routes on server state, same philosophy as GamesScreen/CardsGameScreen. */
export function TriviaGameScreen({ onHome, onOpenExpenses, onOpenSplit, initialTab }: TriviaGameScreenProps) {
  const { game, currentQuestion } = useTriviaGame();

  if (game?.status === 'completed') {
    return <TriviaFinalResultsScreen onHome={onHome} />;
  }
  if (game?.status === 'active' && currentQuestion?.status === 'revealed') {
    return <TriviaRevealScreen />;
  }
  if (game?.status === 'active' && currentQuestion?.status === 'active') {
    return <TriviaQuestionScreen />;
  }
  return <TriviaLobbyScreen onHome={onHome} onOpenExpenses={onOpenExpenses} onOpenSplit={onOpenSplit} initialTab={initialTab} />;
}
