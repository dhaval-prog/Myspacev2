import React from 'react';
import { useGame } from '../../context/GameContext';
import { NpatLobbyScreen } from './npat/NpatLobbyScreen';
import { NpatRoundScreen } from './npat/NpatRoundScreen';
import { NpatResultsScreen } from './npat/NpatResultsScreen';
import { NpatGameOverScreen } from './npat/NpatGameOverScreen';

interface GamesScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
  /** Which tab the create/join hub opens on — set by the Games hub's Create/Join row buttons. */
  initialTab?: 'create' | 'join';
}

/**
 * The Games feature entry point — right now just Name/Place/Animal/Thing.
 * Which screen shows is derived entirely from server state (game/round
 * status), not a locally-tracked page — so every connected player lands
 * on the same screen the server thinks they should be on.
 */
export function GamesScreen({ onHome, onOpenExpenses, onOpenSplit, initialTab }: GamesScreenProps) {
  const { game, round } = useGame();

  if (!game || game.status === 'waiting') {
    return <NpatLobbyScreen onHome={onHome} onOpenExpenses={onOpenExpenses} onOpenSplit={onOpenSplit} initialTab={initialTab} />;
  }
  if (game.status === 'game_complete') {
    return <NpatGameOverScreen onHome={onHome} onOpenExpenses={onOpenExpenses} onOpenSplit={onOpenSplit} />;
  }
  if (round && round.status !== 'results') {
    return <NpatRoundScreen />;
  }
  if (round && round.status === 'results') {
    return <NpatResultsScreen onHome={onHome} onOpenExpenses={onOpenExpenses} onOpenSplit={onOpenSplit} />;
  }
  return <NpatLobbyScreen onHome={onHome} onOpenExpenses={onOpenExpenses} onOpenSplit={onOpenSplit} />;
}
