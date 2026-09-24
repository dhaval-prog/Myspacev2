import React from 'react';
import { View } from 'react-native';
import { useDrop } from '../../context/DropContext';
import { dpColor } from '../../theme/dropTokens';
import { DropPairingScreen } from './DropPairingScreen';
import { DropTodayScreen } from './DropTodayScreen';

interface DropHubScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
  onOpenAnswer: () => void;
  onOpenReveal: () => void;
  onOpenRefocus: () => void;
  onOpenLoveMap: () => void;
  onOpenSettings: () => void;
}

/** Entry point for the Drop section — shows pairing until there's an active partner, then the Today hub. */
export function DropHubScreen({ onHome, onOpenExpenses, onOpenSplit, onOpenAnswer, onOpenReveal, onOpenRefocus, onOpenLoveMap, onOpenSettings }: DropHubScreenProps) {
  const { loading, pair } = useDrop();

  if (loading) return <View style={{ flex: 1, backgroundColor: dpColor.bg1 }} />;

  if (!pair) {
    return <DropPairingScreen onHome={onHome} onPaired={() => {}} />;
  }

  return (
    <DropTodayScreen
      onHome={onHome}
      onOpenExpenses={onOpenExpenses}
      onOpenSplit={onOpenSplit}
      onOpenAnswer={onOpenAnswer}
      onOpenReveal={onOpenReveal}
      onOpenRefocus={onOpenRefocus}
      onOpenLoveMap={onOpenLoveMap}
      onOpenPartnerSettings={onOpenSettings}
    />
  );
}
