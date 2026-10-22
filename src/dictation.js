// Adds a dictated phrase to what's typed: a space between, and a capital
// after the end of a sentence (speech-to-text often starts lower case).
export function appendDictation(prev, words) {
  const add = String(words || '').trim();
  if (!add) return prev || '';
  const before = String(prev || '').replace(/\s+$/, '');
  const capital = !before || /[.!?]$/.test(before);
  const chunk = capital ? add.charAt(0).toUpperCase() + add.slice(1) : add;
  return before ? `${before} ${chunk}` : chunk;
}
