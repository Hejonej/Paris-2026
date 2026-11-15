// Preserve the original Instagram post. Only derived/displayed venue labels lose decorative emoji.
export function placeText(value: string): string {
  return value
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}]/gu, (char) =>
      /[©®™]/.test(char) ? char : "",
    )
    .replace(/[\p{Emoji_Modifier}\u200D\uFE0E\uFE0F\u20E3]/gu, "")
    .replace(/^[\s·•▪▫◦:：]+/u, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
