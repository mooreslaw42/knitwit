// Handing a file to the knitter, in a browser: an object URL and a click on a link nobody sees.
//
// The URL is revoked straight after. It pins the whole backup in memory until it is released, and a
// stash with photos in it is not small.
export async function saveTextFile(name: string, text: string): Promise<boolean> {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    return true;
  } finally {
    URL.revokeObjectURL(url);
  }
}
