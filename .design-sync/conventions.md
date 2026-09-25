# rmf-block — how to build with it

rmf-block is a LAN document-collaboration app (Korean UI). These components are
its real screens' parts, exported on `window.RmfBlock`. The look is
"paper on warm grey": ink-black 1px borders, warm paper surfaces, one sky-blue
accent. No dark mode.

## Setup

- Wrap every screen in `<AppShell>`. It stands in for Next.js's router:
  `DocumentList`, `DocLinkBlockView`, `JoinForm`, `FocusShare` and
  `DocumentEditor` throw without it. Pass `pathname="/documents/<id>"` for
  document pages (FocusShare only offers 공유하기 there).
- Components that show who is online (`PresenceStack`, `FocusShare`,
  `ChatPanel` sender colours) read `PresenceContext`. Provide a value:
  `{ status: "active", members: [{ id, nickname, colorTag }], client: null, memberId, isPresenting: false, setPresenting: () => {} }`.
  Without it they show their "연결 중…" (connecting) state.
- Member colours come from this palette: `#ef4444 #f97316 #eab308 #22c55e #06b6d4 #3b82f6 #a855f7 #ec4899`
  (host `#64748b`).
- Data comes from the app server (`/api/...`) and Yorkie. In a design,
  pass props; don't expect fetches to resolve. `DocumentEditor` can't load
  blocks without Yorkie, so build document pages from the block views instead
  (`TextBlockView`, `DividerBlockView`, `FileBlockView`, `PdfBlockView`,
  `ImageBlockView`, `DocLinkBlockView`).

## Styling: Tailwind utilities with theme tokens

Style layout glue with Tailwind classes. **Only classes present in `styles.css`
exist**, so stay within this vocabulary:

| Family | Classes |
| --- | --- |
| Colour tokens (`bg-`/`text-`/`border-`, also `hover:`) | `ink` (text, borders), `ink-soft` (secondary text), `ink-faint` (meta, placeholders), `paper` (surfaces), `paper-2` (inputs, table heads, bubbles), `shell` (page background), `sky` (primary button fill), `sky-deep` (primary button border), `sky-soft` (selected / own-message tint) |
| Layout | `flex inline-flex grid flex-col flex-1 flex-wrap items-center justify-between justify-center`, `gap-/p-/px-/py-/m-/mt-/mb-{0,1,1.5,2,2.5,3,4,5,6,8,10,12}` |
| Type | `text-xs text-sm text-base text-lg text-xl text-2xl font-medium font-semibold font-bold font-mono uppercase tracking-wide truncate` |
| Shape | `rounded rounded-md rounded-lg rounded-full border border-t border-b shadow shadow-lg` |

For anything else, use inline styles with the tokens:
`style={{ color: "var(--color-ink-soft)", background: "var(--color-paper-2)" }}`.

Recurring patterns in the app:
- Primary button: `rounded-md border border-sky-deep bg-sky px-4 py-1.5 text-[13px] font-bold text-ink`
- Secondary button: `rounded-md border border-ink bg-paper px-3 py-1.5 text-sm text-ink`
- Input: `rounded-md border border-ink bg-paper-2 px-3 py-2 text-ink`
- Meta label: `font-mono text-[10px] tracking-wide text-ink-faint uppercase`
- Destructive: `text-red-600`, filled `border-red-600 bg-red-600 text-paper`

## Where the truth lives

- `styles.css` → `_ds_bundle.css`: the compiled stylesheet; the `@theme`
  tokens are the `--color-*` custom properties at its top.
- `components/<group>/<Name>/<Name>.d.ts` (props) and `<Name>.prompt.md`
  (usage) for each component. The preview cards show composed, real states.

## Example

```jsx
const { AppShell, DocumentList, PresenceContext, PresenceStack } = window.RmfBlock;

<AppShell>
  <PresenceContext.Provider value={{ status: "active", members, client: null, memberId: "m1", isPresenting: false, setPresenting: () => {} }}>
    <div className="min-h-screen bg-shell">
      <header className="flex items-center justify-between border-b border-ink bg-paper px-6 py-3">
        <span className="text-lg font-bold text-ink">TeamH 워크스페이스</span>
        <PresenceStack memberId="m1" />
      </header>
      <main className="p-6">
        <DocumentList documents={documents} />
      </main>
    </div>
  </PresenceContext.Provider>
</AppShell>
```

`documents` rows are `{ id, name, parentId, createdBy, createdAt, updatedAt, creator: { id, nickname, colorTag } | null }`.
