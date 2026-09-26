import { Avatar } from "rmf-block";

/** Member colours come from the session registry's palette. */
export function Roster() {
  return (
    <div className="flex items-center gap-2 bg-paper p-4 pb-8">
      <Avatar colorTag="#ef4444" label="김" name="김민지" />
      <Avatar colorTag="#22c55e" label="박" name="박서준" />
      <Avatar colorTag="#3b82f6" label="이" name="이하은" />
      <Avatar colorTag="#eab308" label="H" name="Host" />
    </div>
  );
}

/** `size` takes a Tailwind size class; the default is `size-6`. */
export function Sizes() {
  return (
    <div className="flex items-center gap-3 bg-paper p-4 pb-8">
      <Avatar colorTag="#a855f7" label="최" name="최태진" size="size-5" />
      <Avatar colorTag="#a855f7" label="최" name="최태진" />
      <Avatar colorTag="#a855f7" label="최" name="최태진" size="size-8" />
    </div>
  );
}

/** The name tag is revealed on hover or keyboard focus. */
export function NameShown() {
  return (
    <div className="bg-paper p-4 pb-10">
      <Avatar colorTag="#06b6d4" label="정" name="정도윤" className="[&>span:last-child]:opacity-100" />
    </div>
  );
}
