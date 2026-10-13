import { ravelryClaims } from './claims';

// The response shape is from Ravelry's API docs (`User (full)`), trimmed to the fields we read.
const ravelry = {
  user: {
    id: 1234567,
    username: 'purlwise',
    first_name: 'Anna',
    photo_url: 'https://avatars.example/medium.jpg',
    large_photo_url: 'https://avatars.example/large.jpg',
    small_photo_url: 'https://avatars.example/small.jpg',
    location: 'Utrecht',
  },
};

describe('ravelryClaims', () => {
  it('lifts the nested id to a top-level string sub', () => {
    expect(ravelryClaims(ravelry)?.sub).toBe('1234567');
  });

  it('keys on the id, not the username', () => {
    const renamed = { user: { ...ravelry.user, username: 'knitwise' } };
    expect(ravelryClaims(renamed)?.sub).toBe(ravelryClaims(ravelry)?.sub);
  });

  it('carries the username, name and largest photo', () => {
    expect(ravelryClaims(ravelry)).toEqual({
      sub: '1234567',
      preferred_username: 'purlwise',
      user_name: 'purlwise',
      nickname: 'purlwise',
      name: 'Anna',
      picture: 'https://avatars.example/large.jpg',
      avatar_url: 'https://avatars.example/large.jpg',
      profile: 'https://www.ravelry.com/people/purlwise',
    });
  });

  it('never invents an email', () => {
    expect(ravelryClaims(ravelry)).not.toHaveProperty('email');
  });

  it('falls back to the username when there is no first name', () => {
    expect(ravelryClaims({ user: { id: 1, username: 'purlwise' } })?.name).toBe('purlwise');
  });

  it('passes nothing else through', () => {
    expect(ravelryClaims(ravelry)).not.toHaveProperty('location');
  });

  it.each([
    ['no body', null],
    ['a flat object', { id: 1 }],
    ['no id', { user: { username: 'purlwise' } }],
    ['an empty id', { user: { id: '  ' } }],
    ['a non-finite id', { user: { id: Number.NaN } }],
  ])('refuses %s', (_label, body) => {
    expect(ravelryClaims(body)).toBeNull();
  });
});
