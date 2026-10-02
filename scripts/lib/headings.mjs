// GitHub-style heading anchors, shared by the doc checkers.

// Drop link syntax down to its text, then everything but letters, digits,
// `-`, `_` and spaces (Unicode-aware, so Korean survives).
export function slugify(text) {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

export function headingSlugs(markdownText) {
  const slugs = new Set();
  const seen = new Map();
  let fence = null;
  for (const line of markdownText.split(/\r?\n/)) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      continue;
    }
    if (fence) continue;
    const heading = line.match(/^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/);
    if (!heading) continue;
    const base = slugify(heading[1]);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    slugs.add(n === 0 ? base : `${base}-${n}`);
  }
  return slugs;
}
