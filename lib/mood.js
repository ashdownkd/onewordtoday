// Simple keyword -> color lookup. No AI needed, fast and predictable.
// warm  = amber  (#F2A65A) - positive / good
// heavy = blue   (#5B8AA6) - hard / difficult
// else  = grey   (#C9C4B8) - neutral

const WARM = [
  "happy", "hopeful", "grateful", "excited", "great", "good", "calm",
  "peaceful", "alive", "bright", "sunny", "proud", "loved", "warm",
  "free", "strong", "blessed", "content", "joyful", "okay", "fine",
];

const HEAVY = [
  "tired", "sad", "exhausted", "stressed", "anxious", "lonely", "lost",
  "heavy", "stuck", "angry", "hurt", "cold", "empty", "numb", "chaotic",
  "overwhelmed", "scared", "broken", "grey", "gray", "drained",
];

export function moodColor(word) {
  const w = word.trim().toLowerCase();
  if (WARM.includes(w)) return "#F2A65A";
  if (HEAVY.includes(w)) return "#5B8AA6";
  return "#C9C4B8";
}
