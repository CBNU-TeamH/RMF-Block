import { useRef } from "react";
import { TextBlockView } from "rmf-block";

const noop = () => undefined;

/** One editable block. Outside the editor it has no Yorkie document to write
 *  to (`docRef` stays null), so edits stay local to the textarea. */
function Block({ id, text, variant }: { id: string; text: string; variant: Parameters<typeof TextBlockView>[0]["variant"] }) {
  const docRef = useRef(null);
  return (
    <TextBlockView
      blockId={id}
      initialText={text}
      variant={variant}
      docRef={docRef}
      registerRemoteHandler={() => noop}
      registerTextarea={noop}
      onMarkdownShortcut={noop}
      onSlashSelect={noop}
      onSplit={noop}
      onMergeWithPrevious={noop}
      onNavigateUp={noop}
      onNavigateDown={noop}
      onIndent={noop}
      onPasteBlocks={noop}
      onHistory={noop}
      onTextCommitted={noop}
      onFocusBlock={noop}
    />
  );
}

export function Headings() {
  return (
    <div className="flex w-[28rem] flex-col gap-1 bg-paper p-4">
      <Block id="h1" text="프로젝트 계획서" variant={{ type: "heading", level: 1 }} />
      <Block id="h2" text="1. 목표" variant={{ type: "heading", level: 2 }} />
      <Block id="h3" text="1.1 범위" variant={{ type: "heading", level: 3 }} />
      <Block id="p" text="LAN 환경에서 여러 사람이 한 문서를 동시에 편집한다." variant={{ type: "text" }} />
    </div>
  );
}

export function QuoteAndCode() {
  return (
    <div className="flex w-[28rem] flex-col gap-2 bg-paper p-4">
      <Block id="q" text="단순한 것이 가장 좋다." variant={{ type: "quote" }} />
      <Block id="c" text="pnpm docker:up" variant={{ type: "code" }} />
    </div>
  );
}
