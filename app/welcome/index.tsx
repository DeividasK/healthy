import React from 'react';
import { WelcomeView } from '@/src/features/onboarding/WelcomeView';
import { DemoStartView } from '@/src/features/demo/DemoStartView';
import { IS_DEMO_BUILD } from '@/src/features/demo/demoBuild';

export default function WelcomeScreen() {
  return IS_DEMO_BUILD ? <DemoStartView /> : <WelcomeView />;
}
