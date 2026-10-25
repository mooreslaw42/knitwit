import { useLocalSearchParams } from 'expo-router';

import { CalcScreen } from '@/components/calc-screen';
import { MeasureCalculator } from '@/components/calculators/measure-calculator';
import { NeedleCalculator } from '@/components/calculators/needle-calculator';
import { RescaleCalculator } from '@/components/calculators/rescale-calculator';
import { WindowsCalculator } from '@/components/calculators/windows-calculator';
import { CardLink } from '@/components/card-link';
import { Card } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { calculatorById, type CalculatorId } from '@/lib/calculators';
import { usePageTitle } from '@/lib/use-page-title';
import { useCalculatorPrefill } from '@/lib/use-calculator-prefill';

// One calculator, pushed onto the stack rather than reached by switching tabs.
//
// That is the whole reason this route lives outside `(tabs)`: a "work out the cast-on at my gauge"
// link on a section has to come back to that section when the knitter presses the chevron. Jumping
// to the Calculator tab would strand them with no way back to their row. The hub inside the tab
// links here too, so there is one route with two doors and the back button is right in both.
const SCREENS: Record<CalculatorId, () => React.ReactElement> = {
  rescale: RescaleCalculator,
  needle: NeedleCalculator,
  measure: MeasureCalculator,
  windows: WindowsCalculator,
};

export default function CalculatorToolScreen() {
  const { tool } = useLocalSearchParams<{ tool: string }>();
  const def = calculatorById(tool);
  usePageTitle(def ? def.title : 'Calculator');
  // Before the early return, so the hooks run in the same order whatever the id turns out to be.
  useCalculatorPrefill();

  // The registry decides what exists. A typo in a URL lands here rather than on a blank screen, and
  // says where to go instead.
  if (!def) {
    return (
      <CalcScreen
        title="No such calculator"
        saveNote={false}
        question={`There's nothing at "${tool}". It may have been renamed since you saved the link.`}>
        <CardLink href="/calculator">
          <Card>
            <ThemedText type="smallBold" themeColor="sageDeep">
              See everything the calculator can work out →
            </ThemedText>
          </Card>
        </CardLink>
      </CalcScreen>
    );
  }

  const Screen = SCREENS[def.id];
  return <Screen />;
}
