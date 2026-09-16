import { useEffect, useState } from 'react';
import { Image, type ImageProps } from 'react-native';

import { getPhoto, isInlinePhoto } from '@/lib/photo-store';

// Showing a picture, wherever its bytes happen to live.
//
// A record's `photo` is an id now and was a data URL before, and during a migration it is some of
// each. Rather than making every screen know that, the resolution happens here: pass whatever the
// record holds, get something an <Image> can draw.

export function usePhoto(value: string | null | undefined): string | null {
  // A data URL needs no lookup, so it resolves during render. Otherwise every legacy photo would
  // flash empty for a frame before appearing.
  const inline = isInlinePhoto(value) ? (value as string) : null;

  // Tagged with the value it was fetched for, rather than reset when that value changes. Clearing
  // it would mean setting state synchronously inside the effect, which costs a second render pass
  // on every photo; comparing here is free and cannot show the previous record's picture.
  const [entry, setEntry] = useState<{ for: string | null | undefined; uri: string | null }>({
    for: null,
    uri: null,
  });

  useEffect(() => {
    if (inline || !value) return;

    // A list can scroll a row out from under an in-flight read, and a photo arriving after the
    // component moved on would draw the wrong picture.
    let current = true;
    void getPhoto(value).then((found) => {
      if (current) setEntry({ for: value, uri: found });
    });
    return () => {
      current = false;
    };
  }, [value, inline]);

  return inline ?? (entry.for === value ? entry.uri : null);
}

// An <Image> for a record's photo. Draws nothing until there is something to draw, which is the
// same thing the screens did before when a photo was absent.
export function PhotoImage({
  photo,
  ...props
}: Omit<ImageProps, 'source'> & { photo: string | null | undefined }) {
  const uri = usePhoto(photo);
  if (!uri) return null;
  return <Image source={{ uri }} {...props} />;
}
