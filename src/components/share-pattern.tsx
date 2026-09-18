import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PillButton } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { EN, patternHtml, type PatternStrings } from '@/lib/pattern-html';
import { getPhoto } from '@/lib/photo-store';
import { printPattern } from '@/lib/print-pattern';
import { translatePattern } from '@/lib/translate-pattern-remote';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { Pattern } from '@/types/knitwit';

// Sharing a pattern, which today means one thing and is built to mean more.
//
// The sheet is a list of ways to send a pattern somewhere, with a PDF as the only entry so far.
// It is laid out as a list rather than as a single button because the next entry — a link, a copy
// for another knitter — should slot in beside this one rather than force the screen to be
// rethought.
//
// ## Language
//
// A pattern can be printed in a language it was not written in. The translation is made for the
// share and then thrown away: the pattern in the library stays in the words the knitter chose,
// because it is theirs, and a translation is a rendering of it rather than a correction to it.
//
// The one thing kept is which language it turned out to be in, so that the next share into that
// same language knows it has nothing to do. That is learned rather than asked — nobody should
// meet a "what language is this?" question before they can print something.

// Offered rather than exhaustive. Anything here is a language the model will be asked for by name,
// so the list is about what is reachable in two taps, not about what is possible.
const LANGUAGES = [
  'English',
  'Nederlands',
  'Deutsch',
  'Français',
  'Español',
  'Italiano',
  'Português',
  'Svenska',
  'Dansk',
  'Norsk',
  'Suomi',
  'Polski',
  'Íslenska',
  '日本語',
];

// What the model is asked for, which is not what the knitter is shown: a list of languages reads
// better in each language's own name, and a model is more reliably asked in English.
const IN_ENGLISH: Record<string, string> = {
  English: 'English',
  Nederlands: 'Dutch',
  Deutsch: 'German',
  Français: 'French',
  Español: 'Spanish',
  Italiano: 'Italian',
  Português: 'Portuguese',
  Svenska: 'Swedish',
  Dansk: 'Danish',
  Norsk: 'Norwegian',
  Suomi: 'Finnish',
  Polski: 'Polish',
  Íslenska: 'Icelandic',
  日本語: 'Japanese',
};

function filename(name: string): string {
  const clean = name.trim().replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, '-');
  return `${clean || 'pattern'}.pdf`;
}

export function SharePattern({ patternId, pattern }: { patternId: string; pattern: Pattern }) {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState('English');
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const savePattern = useKnitwitStore((s) => s.savePattern);

  const exportPdf = async () => {
    setProblem(null);
    const wanted = IN_ENGLISH[language] ?? language;

    let document: Pattern = pattern;
    let strings: PatternStrings = EN;

    try {
      // Nothing to translate when it is already in that language, which is the common case and
      // should not cost a call.
      if (pattern.language && pattern.language === wanted) {
        // Already right.
      } else if (wanted !== 'English' || (pattern.language && pattern.language !== 'English')) {
        setBusy('Translating…');
        const result = await translatePattern(pattern, EN, wanted, {
          // A long pattern is tens of batches. A spinner with no number on it, for a minute, is
          // indistinguishable from one that has hung.
          onProgress: ({ done: n, total }) =>
            setBusy(`Translating… ${Math.round((n / total) * 100)}%`),
        });
        document = result.pattern;
        strings = result.strings;
        // Some of it kept its original words. Said plainly rather than handed over as a document
        // that is quietly half in English.
        if (result.missing > 0) {
          setProblem(
            `${result.missing} line${result.missing === 1 ? '' : 's'} could not be translated and stayed as you wrote them.`,
          );
        }
        // Learned, so the next share into this language knows it has nothing to do.
        if (result.sourceLanguage && result.sourceLanguage !== pattern.language) {
          savePattern(patternId, { ...pattern, language: result.sourceLanguage });
        }
      }

      setBusy('Making the PDF…');
      // Resolved here rather than in patternHtml, which does no I/O so that it stays testable.
      const photo = await getPhoto(pattern.photo);
      const outcome = await printPattern(patternHtml({ pattern: document, photo, strings }), filename(pattern.name));

      setBusy(null);
      if (outcome.status === 'failed') {
        setProblem(outcome.message);
        return;
      }
      if (outcome.status === 'shared') setOpen(false);
    } catch (error) {
      setBusy(null);
      setProblem(error instanceof Error ? error.message : "That didn't work. Try again in a moment.");
    }
  };

  return (
    <>
      <PillButton variant="secondary" onPress={() => setOpen(true)} style={styles.trigger}>
        <ThemedText type="smallBold" themeColor="ink">
          Share
        </ThemedText>
      </PillButton>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => (busy ? null : setOpen(false))}>
          {/* Stops a tap inside the sheet from closing it, which the backdrop above would. */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ThemedText type="subtitle" heading={2}>
              Share this pattern
            </ThemedText>

            <ThemedText type="smallBold" style={styles.label}>
              Language
            </ThemedText>
            <ThemedText type="small" themeColor="inkSoft">
              Printing in another language translates it for the file only. Your pattern stays as
              you wrote it.
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langRow}>
              <View style={styles.langs}>
                {LANGUAGES.map((name) => {
                  const on = name === language;
                  return (
                    <Pressable
                      key={name}
                      onPress={() => setLanguage(name)}
                      style={[styles.chip, on && styles.chipOn]}>
                      <ThemedText type="smallBold" themeColor={on ? 'white' : 'inkSoft'}>
                        {name}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <ThemedText type="smallBold" style={styles.label}>
              How
            </ThemedText>
            <PillButton onPress={() => void exportPdf()} style={styles.action} disabled={!!busy}>
              <ThemedText type="smallBold" themeColor="white">
                {busy ?? 'Export as PDF'}
              </ThemedText>
            </PillButton>

            {problem ? (
              <ThemedText type="small" themeColor="coralDeep">
                {problem}
              </ThemedText>
            ) : null}

            <Pressable onPress={() => setOpen(false)} disabled={!!busy} style={styles.close}>
              <ThemedText type="smallBold" themeColor="inkSoft">
                Close
              </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { paddingHorizontal: Spacing.four },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(74,59,56,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.cream,
    borderTopLeftRadius: Radii.large,
    borderTopRightRadius: Radii.large,
    padding: Spacing.five,
    gap: Spacing.two,
  },
  label: { marginTop: Spacing.three },
  langRow: { marginTop: Spacing.one },
  langs: { flexDirection: 'row', gap: Spacing.two },
  chip: {
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  chipOn: { backgroundColor: Colors.blushDeep },
  action: { marginTop: Spacing.one, alignSelf: 'flex-start', paddingHorizontal: Spacing.five },
  close: { alignSelf: 'center', paddingVertical: Spacing.three, marginTop: Spacing.two },
});
