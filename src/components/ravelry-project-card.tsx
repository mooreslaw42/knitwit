import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Card, PillButton } from '@/components/knitwit-ui';
import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { accountStateOf } from '@/lib/auth';
import { sendProjectToRavelry } from '@/lib/ravelry/send-project';
import { currentSession, onSessionChange } from '@/lib/session';
import type { Project } from '@/types/knitwit';

// Where a project sits in relation to Ravelry, on the project screen.
//
// Three states, and nothing in between: it came from Ravelry (or has been sent there) and links
// back; it hasn't, and can be sent; or the knitter has no Ravelry connected, in which case this
// card does not appear at all. Most knitters have no Ravelry account, and a card explaining a
// service they do not use is just noise on their project.
//
// Sending creates, once. The button is gone the moment there is a `ravelrySource`, so the same
// project cannot be filed twice — see src/lib/ravelry/send-project.ts.

export function RavelryProjectCard({
  projectKey,
  project,
}: {
  projectKey: string;
  project: Project;
}) {
  const [connected, setConnected] = useState(
    () => accountStateOf(currentSession().session).providers.includes('custom:ravelry'),
  );
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(
    () =>
      onSessionChange((s) =>
        setConnected(accountStateOf(s.session).providers.includes('custom:ravelry')),
      ),
    [],
  );

  const source = project.ravelrySource;

  // Nothing to say to a knitter who has never connected Ravelry — unless their project came from
  // there, which is worth a link whatever they are signed in with today.
  if (!connected && !source) return null;

  const send = async () => {
    setSending(true);
    setNote('Filing this project on Ravelry…');
    try {
      await sendProjectToRavelry(projectKey);
      setNote('Filed on Ravelry. The link is here now.');
    } catch (error) {
      setNote(
        error instanceof Error
          ? error.message
          : 'The project could not be sent to Ravelry. Try again in a moment.',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Card style={styles.card}>
      <ThemedText type="small" themeColor="inkSoft">
        Ravelry
      </ThemedText>
      {source ? (
        <>
          <ThemedText type="smallBold">This project is on Ravelry.</ThemedText>
          {source.url ? (
            <ExternalLink href={source.url as Parameters<typeof ExternalLink>[0]['href']}>
              <ThemedText type="smallBold" themeColor="sageDeep">
                Open it there →
              </ThemedText>
            </ExternalLink>
          ) : null}
          {/* Said plainly, because the opposite would be a reasonable thing to assume: the two
              are not kept in step. Knitwit counts the rows; Ravelry has what was sent. */}
          <ThemedText type="small" themeColor="inkSoft">
            Changes here stay here — nothing is sent to Ravelry again.
          </ThemedText>
        </>
      ) : (
        <>
          <ThemedText type="smallBold">Not on Ravelry yet.</ThemedText>
          <ThemedText type="small" themeColor="inkSoft">
            Files it as a new project in your Ravelry notebook — name, dates, gauge, notes and how
            far along it is. Your labels and photos stay here.
          </ThemedText>
          <PillButton
            variant="secondary"
            onPress={() => void send()}
            loading={sending}
            disabled={sending}>
            <ThemedText type="smallBold" themeColor="ink">
              Send to Ravelry
            </ThemedText>
          </PillButton>
        </>
      )}
      {note ? (
        <ThemedText type="small" themeColor="inkSoft">
          {note}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, marginTop: Spacing.three },
});
