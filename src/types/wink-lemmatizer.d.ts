declare module 'wink-lemmatizer' {
  // Minimal typing for wink-lemmatizer used by this project
  // The library exports a `word` function which returns the lemma for the input token.
  export function word(token: string): string;
  const _default: { word: (token: string) => string };
  export default _default;
}
