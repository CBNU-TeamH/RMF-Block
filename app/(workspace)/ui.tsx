/** The redesign's shared dialog chrome and file glyph
 *  (`docs/ui/redesign/HANDOFF.md` §3) — one place for every modal in the app,
 *  including `app/join/`'s. */

export const DIALOG =
  "mx-auto mt-[18vh] w-full max-w-[400px] rounded-card bg-elev p-5 text-ink shadow-elev backdrop:bg-scrim";
export const DIALOG_TITLE = "text-[17px] font-bold tracking-tight text-ink";
export const FIELD_LABEL = "flex flex-col gap-1.5 text-[13px] font-semibold text-ink-soft";
export const inputClass = (bad: boolean) =>
  `h-[38px] rounded-control border bg-elev px-3 text-[14.5px] font-normal text-ink outline-none ${
    bad
      ? "border-danger ring-3 ring-danger-soft"
      : "border-line-strong focus:border-sky-deep focus:ring-3 focus:ring-sky-ring"
  }`;
export const CANCEL =
  "h-[34px] rounded-control px-3.5 text-sm font-medium text-ink hover:bg-hover disabled:opacity-40";
export const confirmClass = (danger: boolean) =>
  `flex h-[34px] items-center gap-2 rounded-control px-3.5 text-sm font-semibold text-paper hover:opacity-90 disabled:opacity-70 ${
    danger ? "bg-danger" : "bg-ink"
  }`;

export const Spinner = () => (
  <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
);

export const FileIcon = ({ size = 16 }: { size?: number }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round">
    <path d="M4 2.5h5l3 3v8H4z" />
    <path d="M9 2.5v3h3" />
  </svg>
);
