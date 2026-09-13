import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmButton, FormField, PillButton, SelectField } from '@/components/knitwit-ui';
import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { CRAFT_LABELS, CRAFT_ORDER } from '@/constants/catalogs';
import { goBackOr } from '@/lib/navigation';
import { pickImage, pickImageMessage } from '@/lib/pick-image';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { TechniqueCraft } from '@/types/knitwit';

const CRAFT_OPTIONS: { value: TechniqueCraft; label: string }[] = CRAFT_ORDER.map((c) => ({
  value: c,
  label: CRAFT_LABELS[c],
}));

export default function ProjectEditScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();

  const project = useKnitwitStore((state) => state.projects[key]);
  const patterns = useKnitwitStore((state) => state.patterns);
  const updateProject = useKnitwitStore((state) => state.updateProject);
  const deleteProject = useKnitwitStore((state) => state.deleteProject);
  const setProjectStatus = useKnitwitStore((state) => state.setProjectStatus);

  const [name, setName] = useState(project?.name ?? '');
  const [startedOn, setStartedOn] = useState<string | null>(project?.startedOn ?? null);
  const [craft, setCraft] = useState<TechniqueCraft>(project?.craft ?? 'knit');
  const [patternId, setPatternId] = useState(project?.patternId ?? '');
  const [photo, setPhoto] = useState<string | null>(project?.photo ?? null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const choosePhoto = async () => {
    const result = await pickImage();
    if (result.status === 'picked') {
      setPhoto(result.dataUrl);
      setPhotoError(null);
    } else {
      setPhotoError(pickImageMessage(result.status));
    }
  };

  if (!project) return null;

  const patternOptions = [
    { value: '', label: "No pattern — I'll set it up myself" },
    ...Object.entries(patterns).map(([id, p]) => ({ value: id, label: p.name })),
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title">Edit project</ThemedText>

          {/* Same idiom as a pattern's picture: tap the hero to pick one, with a separate remove
              beneath so clearing it can't be a mis-tap on "change". */}
          <Pressable
            onPress={choosePhoto}
            style={[styles.hero, { backgroundColor: project.colorDeep }]}>
            {photo ? <Image source={{ uri: photo }} style={styles.heroPhoto} /> : null}
            <View style={styles.heroHint}>
              <ThemedText type="smallBold" themeColor="ink">
                {photo ? 'Tap to change picture' : 'Tap to add a picture'}
              </ThemedText>
            </View>
          </Pressable>
          {photo && (
            <Pressable hitSlop={6} style={styles.photoClear} onPress={() => setPhoto(null)}>
              <ThemedText type="smallBold" themeColor="coralDeep">
                Remove picture
              </ThemedText>
            </Pressable>
          )}
          {photoError && (
            <ThemedText type="small" themeColor="coralDeep">
              {photoError}
            </ThemedText>
          )}

          <FormField label="Project name" value={name} onChangeText={setName} />
          <DateField label="Started" value={startedOn} onChange={setStartedOn} />
          <SelectField
            label="Craft"
            options={CRAFT_OPTIONS}
            value={craft}
            onChange={setCraft}
          />
          <SelectField
            label="Pattern"
            options={patternOptions}
            value={patternId}
            onChange={setPatternId}
          />

          <PillButton
            style={styles.saveBtn}
            onPress={() => {
              updateProject(key, { name, startedOn, craft, patternId: patternId || null, photo });
              goBackOr(router, `/project/${key}`);
            }}>
            <ThemedText type="smallBold" themeColor="white">
              Save
            </ThemedText>
          </PillButton>

          {/* Below Save, because it isn't saving — it's a decision about the project. Frogging
              asks first: it takes the project off your needles, and unlike Save there's no
              obvious way to tell you've done it by accident. */}
          {project.status === 'frogged' ? (
            <PillButton
              variant="secondary"
              onPress={() => {
                setProjectStatus(key, 'active');
                goBackOr(router, `/project/${key}`);
              }}>
              <ThemedText type="smallBold" themeColor="ink">
                Put it back on the needles
              </ThemedText>
            </PillButton>
          ) : (
            <ConfirmButton
              label="Frog this project"
              question="Frog this project? It comes off your WIP list and stays in your history — the rows you've already counted still count."
              confirmLabel="Yes, frog it"
              onConfirm={() => {
                setProjectStatus(key, 'frogged');
                goBackOr(router, `/project/${key}`);
              }}
            />
          )}

          {/* Asked for the same way as frogging, and worded to draw the line between them:
              frogging keeps the project, this does not. Deleting is the only action here that
              can't be undone, so the difference has to be on the screen at the moment of
              choosing rather than assumed. */}
          <ConfirmButton
            label="Delete this project"
            question="Delete this project for good? Its rows, notes and time go with it and can't be brought back. If you just want it off your needles, frog it instead — that keeps it."
            confirmLabel="Yes, delete it"
            onConfirm={() => {
              deleteProject(key);
              // The project screen this came from no longer exists, so go home rather
              // than back to a dead route.
              router.replace('/');
            }}
          />
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
  saveBtn: { marginTop: Spacing.two },
  hero: {
    height: 140,
    borderRadius: Radii.large,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPhoto: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Radii.large,
  },
  heroHint: {
    backgroundColor: Colors.cream,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  photoClear: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
});
