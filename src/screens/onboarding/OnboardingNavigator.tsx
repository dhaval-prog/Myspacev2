import React, { useState } from 'react';
import { SplashScreen } from './SplashScreen';
import { WelcomeScreen } from './WelcomeScreen';
import { SignUpChatScreen, type SignUpAnswers } from './SignUpChatScreen';
import { PickAvatarScreen } from './PickAvatarScreen';
import { CheckMailScreen } from './CheckMailScreen';
import { LoginIntercomScreen } from './LoginIntercomScreen';

type Step =
  | { name: 'splash' }
  | { name: 'welcome' }
  | { name: 'login' }
  | { name: 'signup' }
  | { name: 'avatar'; answers: SignUpAnswers }
  | { name: 'checkMail'; answers: SignUpAnswers; photoUri: string | null; swatchIdx: number };

export interface PostSignupData {
  fullName: string;
  email: string;
  photoUri: string | null;
  swatchIdx: number;
}

interface OnboardingNavigatorProps {
  /** Fires the instant CheckMail's poll confirms a real session — hands the collected
   * name/email/photo/colour up to RootNavigator (which outlives this component: once a session
   * exists, RootNavigator swaps this whole pre-session tree out for the post-signup one, so
   * anything this screen needs to survive that swap has to be lifted up rather than kept here). */
  onSignedUp: (data: PostSignupData) => void;
}

/** Drives the pre-session part of onboarding: Splash → Welcome → (Sign up chat → Pick your look →
 * Check mail) or (Log in). An existing user's Log in simply resolves to a session the normal way
 * (AuthContext's own onAuthStateChange picks it up) with no further onboarding; a fresh signup's
 * confirmed session instead triggers the post-signup celebration (see onSignedUp / App.tsx). */
export function OnboardingNavigator({ onSignedUp }: OnboardingNavigatorProps) {
  const [step, setStep] = useState<Step>({ name: 'splash' });

  if (step.name === 'splash') return <SplashScreen onContinue={() => setStep({ name: 'welcome' })} />;
  if (step.name === 'welcome') {
    return <WelcomeScreen onContinue={() => setStep({ name: 'signup' })} onLogin={() => setStep({ name: 'login' })} />;
  }
  if (step.name === 'login') return <LoginIntercomScreen onBack={() => setStep({ name: 'welcome' })} onGoSignup={() => setStep({ name: 'signup' })} />;
  if (step.name === 'signup') {
    return (
      <SignUpChatScreen
        onBack={() => setStep({ name: 'welcome' })}
        onGoLogin={() => setStep({ name: 'login' })}
        onDone={(answers) => setStep({ name: 'avatar', answers })}
      />
    );
  }
  if (step.name === 'avatar') {
    return (
      <PickAvatarScreen
        answers={step.answers}
        onBack={() => setStep({ name: 'signup' })}
        onDone={(choice) => setStep({ name: 'checkMail', answers: step.answers, photoUri: choice.photoUri, swatchIdx: choice.swatchIdx })}
      />
    );
  }
  return (
    <CheckMailScreen
      email={step.answers.email}
      password={step.answers.password}
      onConfirmed={() => onSignedUp({ fullName: step.answers.fullName, email: step.answers.email, photoUri: step.photoUri, swatchIdx: step.swatchIdx })}
    />
  );
}
