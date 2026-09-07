"use client";

/** One presence avatar — a colored circle with a hover/focus-revealed full
 *  name. Its own named group (`group/avatar`) so it works standalone wherever
 *  it's dropped, regardless of any `group` an ancestor already uses (the
 *  editor's per-block row is one — its drag handle needs `group-hover`). The
 *  name is always in the DOM for a screen reader; `title` would be one
 *  attribute less but its delay is too slow for something you glance at. */
export function Avatar({
  colorTag,
  label,
  name,
  size = "size-6",
  className = "",
}: {
  colorTag: string;
  label: string;
  name: React.ReactNode;
  size?: string;
  className?: string;
}) {
  return (
    <span
      style={{ backgroundColor: colorTag }}
      tabIndex={0}
      className={`group/avatar relative flex ${size} items-center justify-center rounded-full border border-ink text-[11px] font-bold text-ink ${className}`}
    >
      <span aria-hidden>{label}</span>
      <span className="pointer-events-none absolute top-full left-1/2 z-10 mt-1.5 -translate-x-1/2 rounded border border-ink bg-paper px-1.5 py-0.5 font-mono text-[10px] font-medium whitespace-nowrap text-ink opacity-0 transition-opacity group-hover/avatar:opacity-100 group-focus-visible/avatar:opacity-100">
        {name}
      </span>
    </span>
  );
}
