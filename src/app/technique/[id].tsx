import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { Card, ConfirmButton } from '@/components/knitwit-ui';
import { NotesCard } from '@/components/notes-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CRAFT_LABELS } from '@/constants/catalogs';
import { Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { goBackOr } from '@/lib/navigation';
import {
  FAMILY_LABELS,
  resolveTechnique,
  STATUS_LABELS,
  STATUS_ORDER,
} from '@/lib/technique-catalogue';
import { usePageTitle } from '@/lib/use-page-title';
import { useKnitwitStore } from '@/store/useKnitwitStore';

// One technique: what it is, and where the knitter is with it.
//
// The catalogue's half is read-only — it is shared, and one knitter editing the description of
// Kitchener stitch for everyone would be wrong. Their status and their notes are theirs, and save
// as they're set rather than behind a button.
export default function TechniqueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const mine = useKnitwitStore((state) => state.techniques[id]);
  const catalogue = useKnitwitStore((state) => state.catalogue);
  const loadCatalogue = useKnitwitStore((state) => state.loadCatalogue);
  const setTechniqueStatus = useKnitwitStore((state) => state.setTechniqueStatus);
  const setTechniqueNotes = useKnitwitStore((state) => state.setTechniqueNotes);
  const deleteTechnique = useKnitwitStore((state) => state.deleteTechnique);

  // Reachable by deep link, so the catalogue may not be here yet.
  useEffect(() => {
    void loadCatalogue();
  }, [loadCatalogue]);

  const technique = resolveTechnique(id, mine, catalogue);
  usePageTitle(technique.name);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" heading={1}>{technique.name}</ThemedText>
          <ThemedText type="small" themeColor="inkSoft">
            {CRAFT_LABELS[technique.craft]} · {FAMILY_LABELS[technique.family]}
            {technique.isCustom ? ' · your own' : ''}
          </ThemedText>

          {technique.summary ? (
            <Card style={styles.card}>
              <ThemedText type="default">{technique.summary}</ThemedText>
            </Card>
          ) : null}

          <Card style={styles.card}>
            <ThemedText type="small" themeColor="inkSoft">
              Where you are with it
            </ThemedText>
            <View style={styles.statusRow}>
              {STATUS_ORDER.map((s) => {
                const on = mine?.status === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => setTechniqueStatus(id, on ? null : s)}
                    style={[styles.status, on && styles.statusOn]}>
                    <ThemedText type="smallBold" themeColor={on ? 'white' : 'inkSoft'}>
                      {STATUS_LABELS[s]}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {!mine ? (
              <ThemedText type="small" themeColor="inkSoft">
                Pick one to add this to your techniques.
              </ThemedText>
            ) : null}
          </Card>

          {technique.video || technique.link ? (
            <Card style={styles.card}>
              <ThemedText type="small" themeColor="inkSoft">
                How to do it
              </ThemedText>
              {technique.video ? (
                <ExternalLink href={technique.video as Parameters<typeof ExternalLink>[0]['href']}>
                  <ThemedText type="smallBold" themeColor="sageDeep">
                    Watch a demonstration →
                  </ThemedText>
                </ExternalLink>
              ) : null}
              {technique.link ? (
                <ExternalLink href={technique.link as Parameters<typeof ExternalLink>[0]['href']}>
                  <ThemedText type="smallBold" themeColor="sageDeep">
                    Read the instructions →
                  </ThemedText>
                </ExternalLink>
              ) : null}
            </Card>
          ) : null}

          {/* Only once it's theirs — notes on something you haven't marked have nowhere to live. */}
          {mine ? (
            <NotesCard
              value={mine.notes}
              onChange={(notes) => setTechniqueNotes(id, notes)}
              label="Your notes"
              hint="What worked, what to watch for. Saved as you type."
            />
          ) : null}

          {/* A catalogue entry is never deleted, only unmarked — the status buttons above do that.
              One the knitter wrote themselves is theirs to remove. */}
          {mine?.custom ? (
            <ConfirmButton
              label="Delete this technique"
              question="Delete this technique? It's one of your own, so it goes for good — and any section that says it uses it will stop saying so."
              confirmLabel="Yes, delete it"
              onConfirm={() => {
                deleteTechnique(id);
                goBackOr(router, '/library');
              }}
            />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: Spacing.six * 2,
    gap: Spacing.three,
  },
  card: { gap: Spacing.two },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  status: {
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  statusOn: { backgroundColor: Colors.blushDeep },
});
