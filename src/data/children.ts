/** Built-in avatars, so kids never need to upload a photo. */
export const AVATARS = ['🐛', '🦊', '🐼', '🐰', '🐯', '🐨', '🦄', '🐳', '🦖', '🐧'];

/** Parses an age field; blank or nonsense means "not given". */
export function parseAge(raw: string): number | undefined {
  const age = Number.parseInt(raw, 10);
  return age > 0 && age < 19 ? age : undefined;
}
