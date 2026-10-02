// design-sync entry: the app's presentational surfaces, re-exported for
// claude.ai/design. rmf-block is an app, not a component library - this list
// is curated by hand. Pure providers (network/Yorkie) and effect-only
// components are left out; see .design-sync/NOTES.md.
import "./process-shim";
import type { ReactNode } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";

const noop = () => undefined;
const router = { back: noop, forward: noop, refresh: noop, push: noop, replace: noop, prefetch: noop };

/** Stand-in for Next's App Router. Components that navigate (`next/link`,
 *  `useRouter`, `usePathname`) throw without it; clicks become no-ops. */
export function AppShell({ pathname = "/", children }: { pathname?: string; children?: ReactNode }) {
  return (
    <AppRouterContext.Provider value={router}>
      <PathnameContext.Provider value={pathname}>{children}</PathnameContext.Provider>
    </AppRouterContext.Provider>
  );
}

export { Avatar } from "../app/(workspace)/presence-avatar";
export { PresenceStack } from "../app/(workspace)/presence-stack";
export { PresenceContext } from "../app/(workspace)/presence-provider";
export { ChatMessageRow } from "../app/(workspace)/chat-message";
export { ChatPanel } from "../app/(workspace)/chat-panel";
export { ChatWindow } from "../app/(workspace)/chat-window";
export { FloatingFrame } from "../app/(workspace)/floating-frame";
export { DocumentList } from "../app/(workspace)/document-list";
export { DocumentRowMenu } from "../app/(workspace)/document-row-menu";
export { DocumentActionDialog } from "../app/(workspace)/document-actions";
export { FocusShare } from "../app/(workspace)/focus-share";
export { JoinForm } from "../app/join/join-form";
export { DividerBlockView } from "../app/(workspace)/documents/[id]/divider-block";
export { DocLinkBlockView } from "../app/(workspace)/documents/[id]/doc-link-block";
export { FileBlockView } from "../app/(workspace)/documents/[id]/file-block";
export { ImageBlockView } from "../app/(workspace)/documents/[id]/image-block";
export { PdfBlockView } from "../app/(workspace)/documents/[id]/pdf-block";
export { TextBlockView } from "../app/(workspace)/documents/[id]/text-block";
export { VersionHistory } from "../app/(workspace)/documents/[id]/version-history";
export { DocumentEditor } from "../app/(workspace)/documents/[id]/editor";
