/**
 * The part of the Suggestion still to type, while the draft is a strict prefix
 * of it. Tab accepts the Suggestion only while this is shown, so it never
 * overwrites text the user wrote, and moves focus as usual otherwise.
 */
export const ghostText = (
  draft: string,
  suggestion: string | null
): string | null =>
  suggestion !== null &&
  draft.length < suggestion.length &&
  suggestion.startsWith(draft)
    ? suggestion.slice(draft.length)
    : null;
