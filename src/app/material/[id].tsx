import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmButton, FormField, PillButton, SelectField } from '@/components/knitwit-ui';
import { CareSymbolsField } from '@/components/care-symbols-field';
import { GaugeField } from '@/components/gauge-field';
import { PhotoImage } from '@/components/photo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EdgeFunctionAborted } from '@/lib/edge-function';
import { goBackOr } from '@/lib/navigation';
import { pickImage, pickImageMessage } from '@/lib/pick-image';
import { putPhoto } from '@/lib/photo-store';
import { describeFilled, readYarnLabel } from '@/lib/read-yarn-label';
import { WASHING_LABELS, YARN_WEIGHTS,
  toolSizeOptions,
} from '@/constants/catalogs';
import { Colors, MaxContentWidth, MaxNameLength, Radii, Spacing } from '@/constants/theme';
import { usePageTitle } from '@/lib/use-page-title';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { CraftType, Material } from '@/types/knitwit';

const BLANK: Material = {
  brand: '',
  colorName: '',
  colorLot: '',
  price: '',
  weight: '',
  grams: '',
  meters: '',
  composition: '',
  thickness: '',
  strands: '1',
  craftType: 'knit',
  washing: 'hand-wash',
  gauge: null,
  link: '',
  photo: null,
};

const CRAFT_OPTIONS: { value: CraftType; label: string }[] = [
  { value: 'knit', label: 'Knitting' },
  { value: 'crochet', label: 'Crochet' },
];

const WEIGHT_OPTIONS = [
  { value: '', label: 'Not set' },
  ...YARN_WEIGHTS.map((w) => ({ value: w.code, label: `${w.code} · ${w.label}` })),
];

const WASHING_OPTIONS = Object.entries(WASHING_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export default function MaterialEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  usePageTitle(isNew ? 'New yarn' : 'Edit yarn');
  const router = useRouter();

  const existing = useKnitwitStore((state) => (isNew ? null : state.materials[id]));
  const saveMaterial = useKnitwitStore((state) => state.saveMaterial);
  const deleteMaterial = useKnitwitStore((state) => state.deleteMaterial);

  const [form, setForm] = useState<Material>(existing ?? BLANK);
  const set = <K extends keyof Material>(key: K, value: Material[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const [photoError, setPhotoError] = useState<string | null>(null);
  // The bytes of a picture just chosen, held only until the knitter answers the question below.
  // The reader wants the image itself, where the form keeps the id the bytes were filed under.
  const [pending, setPending] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  // What the last reading managed, kept so the form can say what it changed. Nothing here is
  // saved: the knitter still has to press Save, which is what makes overwriting safe to offer.
  const [reads, setReads] = useState<{ filled: (keyof Material)[]; confident: boolean } | null>(
    null,
  );
  // A ref, not state: leaving the screen has to stop the request rather than ignore its answer,
  // and the unmount cleanup never sees a re-render's state.
  const readRef = useRef<AbortController | null>(null);
  useEffect(() => () => readRef.current?.abort(), []);

  // Pick a picture, keep it, and then ask — rather than reading the band on sight. A photo of the
  // band is worth having on its own, and a yarn whose fields are already right should not have
  // them rewritten just because its picture was added.
  const choosePhoto = async () => {
    const picked = await pickImage();
    if (picked.status !== 'picked') {
      setPhotoError(pickImageMessage(picked.status));
      return;
    }
    setPhotoError(null);
    setReadError(null);
    setReads(null);
    // Filed straight away, so saying no to the reading still leaves the knitter with the picture
    // they asked for.
    set('photo', await putPhoto(picked.dataUrl));
    setPending(picked.dataUrl);
  };

  const readBand = async () => {
    if (!pending) return;
    const controller = new AbortController();
    readRef.current = controller;
    setReading(true);
    setReadError(null);
    try {
      const result = await readYarnLabel(pending, { signal: controller.signal });
      // Whatever the band says wins over what is in the field, which is the point of asking first:
      // the knitter chose to be overwritten, and can still leave without saving.
      setForm((f) => ({ ...f, ...result.values }));
      setReads({ filled: result.filled, confident: result.confident });
      setPending(null);
    } catch (error) {
      // Stopping on purpose isn't a failure.
      if (error instanceof EdgeFunctionAborted) return;
      setReadError(
        error instanceof Error
          ? error.message
          : "Couldn't read that label. Try again, or type it in.",
      );
    } finally {
      if (readRef.current === controller) readRef.current = null;
      setReading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" heading={1}>{isNew ? 'New material' : 'Edit material'}</ThemedText>

          {/* Same idiom as a project's or a pattern's picture: tap the hero to pick one, with a
              separate remove beneath so clearing it can't be a mis-tap on "change". A yarn could be
              photographed when it was added and never afterwards, which left a band shot in the
              wizard as the one picture the yarn would ever have. */}
          <Pressable onPress={() => void choosePhoto()} style={styles.hero}>
            {form.photo ? <PhotoImage photo={form.photo} style={styles.heroPhoto} /> : null}
            <View style={styles.heroHint}>
              <ThemedText type="smallBold" themeColor="ink">
                {form.photo ? 'Tap to change the picture' : 'Tap to add a picture of the band'}
              </ThemedText>
            </View>
          </Pressable>
          {form.photo ? (
            <Pressable
              hitSlop={6}
              style={styles.photoClear}
              onPress={() => {
                set('photo', null);
                setPending(null);
              }}>
              <ThemedText type="smallBold" themeColor="coralDeep">
                Remove picture
              </ThemedText>
            </Pressable>
          ) : null}
          {photoError ? (
            <ThemedText type="small" themeColor="coralDeep">
              {photoError}
            </ThemedText>
          ) : null}

          {/* Asked, not assumed. The wizard reads every photo it is given because there is nothing
              yet to overwrite; here there is a yarn the knitter may have typed in by hand, so the
              picture is kept either way and the reading is a separate yes. */}
          {pending ? (
            <View style={styles.askCard}>
              <ThemedText type="smallBold">Read the band?</ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                Knitwit can fill in what this band says — brand, colour, dye lot, fibre, length,
                tension and care. It writes over the fields it can read, and nothing is saved until
                you press Save.
              </ThemedText>
              {reading ? (
                <View style={styles.readingRow}>
                  <ActivityIndicator color={Colors.blushDeep} />
                  <ThemedText type="small" themeColor="inkSoft">
                    Reading the band…
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.askRow}>
                  <PillButton style={styles.askBtn} onPress={() => void readBand()}>
                    <ThemedText type="smallBold" themeColor="white">
                      Read the band
                    </ThemedText>
                  </PillButton>
                  <PillButton
                    variant="secondary"
                    style={styles.askBtn}
                    onPress={() => setPending(null)}>
                    <ThemedText type="smallBold" themeColor="ink">
                      Just keep the photo
                    </ThemedText>
                  </PillButton>
                </View>
              )}
            </View>
          ) : null}

          {reads ? (
            <View style={[styles.note, !reads.confident && styles.noteUnsure]}>
              <ThemedText type="small" themeColor="ink">
                {reads.filled.length > 0
                  ? `Read the band and filled in ${describeFilled(reads.filled)}. Check it, then press Save.`
                  : 'Nothing on that photo could be read. The picture is kept with the yarn anyway.'}
              </ThemedText>
              {!reads.confident ? (
                <ThemedText type="small" themeColor="coralDeep">
                  That photo was hard to read — go through the fields before saving.
                </ThemedText>
              ) : null}
            </View>
          ) : null}

          {readError ? (
            <ThemedText type="small" themeColor="coralDeep">
              {readError}
            </ThemedText>
          ) : null}

          <FormField label="Brand" value={form.brand} onChangeText={(v) => set('brand', v)} />
          <FormField
            label="Color name"
            value={form.colorName}
            maxLength={MaxNameLength}
            onChangeText={(v) => set('colorName', v)}
          />
          <FormField
            label="Color lot"
            value={form.colorLot}
            onChangeText={(v) => set('colorLot', v)}
          />
          <FormField
            label="Price (€)"
            value={form.price}
            onChangeText={(v) => set('price', v)}
            keyboardType="decimal-pad"
          />
          <FormField
            label="Composition"
            value={form.composition}
            onChangeText={(v) => set('composition', v)}
            placeholder="e.g. 100% merino wool"
          />
          <SelectField
            label="Yarn weight"
            options={WEIGHT_OPTIONS}
            value={form.weight}
            onChange={(v) => set('weight', v)}
          />
          <FormField
            label="Grams per skein"
            value={form.grams}
            onChangeText={(v) => set('grams', v)}
            keyboardType="numeric"
          />
          <FormField
            label="Meters per skein"
            value={form.meters}
            onChangeText={(v) => set('meters', v)}
            keyboardType="numeric"
          />
          <SelectField
            label="Craft"
            options={CRAFT_OPTIONS}
            value={form.craftType}
            onChange={(v) => set('craftType', v)}
          />
          <SelectField
            label={form.craftType === 'crochet' ? 'Hook size' : 'Needle size'}
            options={toolSizeOptions(form.thickness, form.craftType)}
            value={form.thickness}
            onChange={(v) => set('thickness', v)}
          />
          <GaugeField value={form.gauge} onChange={(g) => set('gauge', g)} />
          <SelectField
            label="Washing"
            options={WASHING_OPTIONS}
            value={form.washing}
            onChange={(v) => set('washing', v)}
          />
          <CareSymbolsField
            value={form.careSymbols}
            onChange={(careSymbols) => set('careSymbols', careSymbols)}
          />
          <FormField label="Link" value={form.link} onChangeText={(v) => set('link', v)} />

          <PillButton
            style={styles.saveBtn}
            onPress={() => {
              saveMaterial(isNew ? null : id, {
                ...form,
                brand: form.brand || 'Unbranded',
                colorName: form.colorName || 'Unnamed color',
              });
              goBackOr(router, '/library');
            }}>
            <ThemedText type="smallBold" themeColor="white">
              Save
            </ThemedText>
          </PillButton>

          {/* Asked for the same way as deleting a project or a technique. Deleting a yarn reaches
              further than this screen — it also drops out of every project section that says it
              was knitted in — so it says so before it happens rather than after. */}
          {!isNew && (
            <ConfirmButton
              label="Delete this yarn"
              question="Delete this yarn? It goes for good, and any project section you'd put it in will stop listing it."
              confirmLabel="Yes, delete it"
              onConfirm={() => {
                deleteMaterial(id);
                goBackOr(router, '/library');
              }}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: Spacing.six * 2,
    gap: Spacing.three,
  },
  saveBtn: {
    marginTop: Spacing.two,
  },
  hero: {
    height: 140,
    borderRadius: Radii.large,
    backgroundColor: Colors.creamDeep,
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
  askCard: {
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  askRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  askBtn: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  // Same note the wizard shows after a scan, in the same two colours: sage for a reading to check,
  // coral for one the photo itself put in doubt.
  note: {
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    padding: Spacing.three,
    gap: 2,
    borderLeftWidth: 3,
    borderLeftColor: Colors.sageDeep,
  },
  noteUnsure: {
    borderLeftColor: Colors.coralDeep,
  },
});
