import * as Sentry from '@sentry/react-native';

// Knowing that Knitwit broke on somebody else's phone.
//
// Until now the only way was being told. The iOS build crashed on launch for a week and the way it
// was diagnosed was a knitter tapping through to a stack trace and pasting it into a chat — which
// worked because that knitter was also the person who could fix it. Nobody else will do that. They
// will put the app down.
//
// ## This is Bugsink, not Sentry
//
// The client is Sentry's SDK because Bugsink speaks the same protocol, and the SDK is open-source
// software rather than a service — nothing here reaches Sentry the company. Bugsink B.V. is Dutch
// and runs on EU infrastructure, which is the same reasoning that put the database in Ireland and
// picked an EU model provider. It also means this is reversible: another Sentry-compatible backend
// is a different DSN and no code at all.
//
// ## What is deliberately not sent
//
// Bugsink's own guidance is to turn PII *on*, on the reasoning that a self-hosted error tracker is
// your own infrastructure and holding a bit more is safe. That reasoning does not carry here. This
// is the hosted service, the people it would describe are knitters rather than colleagues, and
// Knitwit's privacy statement tells them what leaves their device. So: no IP addresses, no request
// bodies, and the knitter's user id attached deliberately rather than by default — enough to see
// that one person hit something five times, not enough to read anything of theirs.
//
// Their knitting never goes. A crash report says where the code was, not what it was holding.

// The Sentry SDK ships an Xcode build phase that uploads source maps to sentry.io. Knitwit reports
// to Bugsink, so there is nothing there to upload to and the phase fails the build outright asking
// for an organisation slug. It is switched off in eas.json with SENTRY_DISABLE_AUTO_UPLOAD.
//
// The cost is real and worth stating: stack traces arrive minified, naming entry-<hash>.js and a
// column number rather than a function and a line. Readable enough to tell two crashes apart, not
// readable enough to read. Bugsink accepts source maps of its own; wiring them up is a separate
// job needing a token.
const DSN = process.env.EXPO_PUBLIC_BUGSINK_DSN;

let started = false;

export function startMonitoring(): void {
  if (started || !DSN) return;
  started = true;

  Sentry.init({
    dsn: DSN,
    // Bugsink handles error events and nothing else — no traces, no metrics, no replay. Sending
    // them would be bytes it throws away.
    tracesSampleRate: 0,
    enableAutoSessionTracking: false,
    // The opposite of Bugsink's recommendation, on purpose. See above.
    sendDefaultPii: false,
    // Which build a report came from, so a fix can be told from a regression.
    release: process.env.EXPO_PUBLIC_RELEASE ?? undefined,
    environment: __DEV__ ? 'development' : 'production',

    // Last look before anything leaves the device.
    beforeSend(event) {
      // The SDK attaches an IP when it can. An error report does not need to know where somebody
      // is sitting.
      if (event.user) delete event.user.ip_address;
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.data;
      }
      return event;
    },
  });
}

// Who it happened to, so five reports from one knitter are not read as five knitters.
//
// The account id and nothing else: no email, no name. It is already the key to everything about
// them in the database, and adding a second identifier would only widen what a leak here exposes.
export function monitorAccount(userId: string | null): void {
  if (!started) return;
  Sentry.setUser(userId ? { id: userId } : null);
}

// An error that has already been caught and shown to somebody. Reported anyway, because a handled
// error is still a knitter who did not get what they came for.
export function reportProblem(error: unknown, context?: Record<string, string>): void {
  if (!started) return;
  Sentry.captureException(error, context ? { tags: context } : undefined);
}
