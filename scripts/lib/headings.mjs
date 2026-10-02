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

// Blank every fenced-code line (``` / ~~~, markers included) to spaces, keeping line and
// character offsets, so a checker never reads an example as the real thing.
export function stripFences(markdownText) {
  let fence = null;
  return markdownText.split("\n").map((line) => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/)?.[1];
    const inside = fence || marker;
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
    }
    return inside ? line.replace(/[^\r]/g, " ") : line;
  }).join("\n");
}

export function headingSlugs(markdownText) {
  const slugs = new Set();
  const seen = new Map();
  for (const line of stripFences(markdownText).split(/\r?\n/)) {
    const heading = line.match(/^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/);
    if (!heading) continue;
    const base = slugify(heading[1]);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    slugs.add(n === 0 ? base : `${base}-${n}`);
  }
  return slugs;
}
