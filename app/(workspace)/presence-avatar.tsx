"use client";

/** One presence avatar — a coloured circle with a hover/focus-revealed full
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
      className={`group/avatar relative flex ${size} items-center justify-center rounded-full text-[11px] font-semibold text-white outline-none hover:ring-2 hover:ring-sky-deep focus-visible:ring-2 focus-visible:ring-sky-deep ${className}`}
    >
      <span aria-hidden>{label}</span>
      {/* Below rather than above, where HANDOFF draws it: these sit in a 46px
          header at the top of the viewport, and above would be off-screen. */}
      <span className="pointer-events-none absolute top-full left-1/2 z-10 mt-1.5 -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-xs font-medium whitespace-nowrap text-paper opacity-0 transition-opacity duration-[120ms] group-hover/avatar:opacity-100 group-focus-visible/avatar:opacity-100">
        {name}
      </span>
    </span>
  );
}
