// Ravelry's profile, reshaped into the claims Supabase Auth reads.
//
// Plain TypeScript, no Deno globals, so Jest runs it alongside the app's tests.
//
// Why this exists at all: Supabase's custom OAuth2 provider reads the userinfo response as a flat
// object and looks for `sub` at the top. Ravelry answers `/current_user.json` with
// `{ "user": { "id": 123, … } }` — the id one level down. Supabase's `attribute_mapping` cannot
// reach it either: it maps between top-level keys of claims it has already parsed, and `user` is
// not one of them. With no `sub`, every Ravelry sign-in fails with "missing provider id".
//
// So the provider's userinfo URL points at this function instead of at Ravelry, and this is the
// whole of the adaptation. Supabase still does the code exchange, the session, and identity
// linking; nothing here mints anything.

export type RavelryUser = {
  id?: number | string;
  username?: string;
  first_name?: string;
  photo_url?: string;
  large_photo_url?: string;
  small_photo_url?: string;
};

export type Claims = {
  sub: string;
  preferred_username?: string;
  user_name?: string;
  nickname?: string;
  name?: string;
  picture?: string;
  avatar_url?: string;
  profile?: string;
};

/**
 * The claims for one Ravelry account, or null when there is no id to key it on.
 *
 * `sub` is the numeric id, never the username: usernames can be changed on Ravelry, and an identity
 * keyed on one would detach from its account the day somebody renames themselves.
 *
 * There is deliberately no `email`. Ravelry does not expose one, and anything put here would be
 * trusted by Supabase as the address of the account.
 */
export function ravelryClaims(body: unknown): Claims | null {
  const user = (body as { user?: RavelryUser } | null)?.user;
  if (!user || typeof user !== 'object') return null;

  const id = user.id;
  if (typeof id === 'number' ? !Number.isFinite(id) : typeof id !== 'string' || id.trim() === '') return null;

  const username = nonEmpty(user.username);
  const photo = nonEmpty(user.large_photo_url) ?? nonEmpty(user.photo_url) ?? nonEmpty(user.small_photo_url);

  const claims: Claims = { sub: String(id) };
  if (username) {
    claims.preferred_username = username;
    claims.user_name = username;
    claims.nickname = username;
    claims.profile = `https://www.ravelry.com/people/${encodeURIComponent(username)}`;
  }
  const name = nonEmpty(user.first_name) ?? username;
  if (name) claims.name = name;
  if (photo) {
    claims.picture = photo;
    claims.avatar_url = photo;
  }
  return claims;
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}
