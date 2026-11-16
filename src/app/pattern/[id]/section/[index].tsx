import { useLocalSearchParams, useRouter } from 'expo-router';

import { SectionStitchEditor } from '@/components/section-stitch-editor';
import { NotesCard } from '@/components/notes-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { atLeastCharted } from '@/lib/knitwit-helpers';
import { goBackOr } from '@/lib/navigation';
import { usePageTitle } from '@/lib/use-page-title';
import { useKnitwitStore } from '@/store/useKnitwitStore';

export default function SectionStitchesScreen() {
  const { id, index } = useLocalSearchParams<{ id: string; index: string }>();
  const sectionIndex = Number(index);
  const router = useRouter();

  const pattern = useKnitwitStore((state) => state.patterns[id]);
  const savePattern = useKnitwitStore((state) => state.savePattern);
  const setPatternSectionNotes = useKnitwitStore((state) => state.setPatternSectionNotes);
  const section = pattern?.sections[sectionIndex];
  usePageTitle(section ? `${section.name} · ${pattern?.name ?? ''}` : undefined);

  // The pattern or section can be missing (deep link, or deleted in another tab).
  if (!pattern || !section) return null;

  return (
    <Screen kind="pushed">
          <ThemedText type="title" heading={1}>{section.name}</ThemedText>
          <ThemedText type="small" themeColor="inkSoft">
            {pattern.name} · stitch-by-stitch
          </ThemedText>

          {/* Above the editor and outside its Save, for the same reason as everywhere else. */}
          <NotesCard
            value={section.notes}
            onChange={(notes) => setPatternSectionNotes(id, sectionIndex, notes)}
            hint="About this section. Saved as you type."
          />

          <SectionStitchEditor
            initial={{
              description: section.description,
              castOn: section.castOn,
              rows: section.rows,
            }}
            craft={pattern.craft}
            sizes={pattern.sizes}
            patternGauge={pattern.gauge}
            swatchGauge={pattern.swatchGauge}
            multiple={section.stitchMultiple}
            calculatorContext={{ pattern: id }}
            materials={pattern.materials}
            onSave={(draft) => {
              savePattern(id, {
                ...pattern,
                sections: pattern.sections.map((s, idx) =>
                  idx === sectionIndex
                    ? {
                        ...s,
                        ...draft,
                        // Charting 23 rows and leaving the row count at 1 makes every project
                        // stamped from this section a one-row piece.
                        totalRows: atLeastCharted(s.totalRows, draft.rows.length),
                      }
                    : s,
                ),
              });
              goBackOr(router, `/pattern/${id}`);
            }}
          />
    </Screen>
  );
}
