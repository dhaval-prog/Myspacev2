import React from 'react';
import { TriviaLobbyScreen } from './TriviaLobbyScreen';

interface TriviaGameScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
  /** Which tab the create/join hub opens on — set by the Games hub's Create/Join row buttons. */
  initialTab?: 'create' | 'join';
}

/**
 * Trivia Night entry point — same router philosophy as GamesScreen/CardsGameScreen.
 * Phase 1 only has the lobby; the question engine (Phase 2+) adds branches
 * here for question/reveal/leaderboard/final-results the same way CardsGameScreen
 * branches on game.status.
 */
export function TriviaGameScreen({ onHome, onOpenExpenses, onOpenSplit, initialTab }: TriviaGameScreenProps) {
  return <TriviaLobbyScreen onHome={onHome} onOpenExpenses={onOpenExpenses} onOpenSplit={onOpenSplit} initialTab={initialTab} />;
}
