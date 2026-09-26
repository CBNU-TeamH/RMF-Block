# rmf-block — how to build with it

rmf-block is a LAN document-collaboration app (Korean UI). These components are
its real screens' parts, exported on `window.RmfBlock`. The look is
"B · Soft / paper": warm paper surfaces separated by fill and soft shadow (not
borders), Pretendard type, one sky-blue accent used only for selection, links,
focus and "I'm sharing". Row actions and block handles appear on hover. No
monospace labels, no dark mode yet.

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
| Surfaces (`bg-`) | `paper` (page), `paper-2` (sidebar, file/PDF cards, inputs' wells), `elev` (menus, dialogs, floating windows), `shell` (outer canvas), `hover` (row hover), `sky-soft` (selected row, accent-soft) |
| Text (`text-`) | `ink`, `ink-soft` (secondary), `ink-faint` (meta, placeholders), `sky-text` (links, selected), `danger` |
| Lines (`border-`) | `line` (dividers), `line-strong` (inputs), `sky-deep` (focus); rings `ring-sky-ring` / `ring-danger-soft` |
| Shape | `rounded-control` (9px: buttons, inputs, rows), `rounded-card` (14px: cards, menus, dialogs), `rounded-full` (avatars); `shadow-elev`, `bg-scrim` behind modals |
| Layout | `flex inline-flex grid flex-col flex-1 flex-wrap items-center justify-between justify-center`, `gap-/p-/px-/py-/m-/mt-/mb-{0,1,1.5,2,2.5,3,4,5,6,8,10,12}` |
| Type | Pretendard via `font-sans` (default). `text-xs text-sm text-base text-lg text-xl text-2xl font-medium font-semibold font-bold truncate`; UI text is 14.5px, body 16.5px/1.7, meta 12–13px `text-ink-faint` |

For anything else, use inline styles with the tokens:
`style={{ color: "var(--color-ink-soft)", background: "var(--color-paper-2)" }}`.

Recurring patterns in the app:
- Primary button: `h-[34px] rounded-control bg-ink px-3.5 text-sm font-semibold text-paper`
- Ghost button: `h-[30px] rounded-control px-2.5 text-ink-soft hover:bg-hover`
- Input: `h-[38px] rounded-control border border-line-strong bg-elev px-3 text-ink`
- Menu / dialog: `rounded-card bg-elev p-1 shadow-elev` (menus), `p-5` (dialogs)
- Sidebar row: `h-8 rounded-control px-2 text-ink-soft hover:bg-hover`; current row `bg-sky-soft font-semibold text-ink`
- Destructive: `text-danger`, filled `bg-danger text-paper`, hover `bg-danger-soft`

## Where the truth lives

- `styles.css` → `_ds_bundle.css`: the compiled stylesheet; the `@theme`
  tokens are the `--color-*` custom properties at its top.
- `components/<group>/<Name>/<Name>.d.ts` (props) and `<Name>.prompt.md`
  (usage) for each component. The preview cards show composed, real states.
- `fonts/` ships Pretendard Variable; `styles.css` wires it as `font-sans`.

## Example

```jsx
const { AppShell, DocumentList, PresenceContext, PresenceStack } = window.RmfBlock;

<AppShell>
  <PresenceContext.Provider value={{ status: "active", members, client: null, memberId: "m1", isPresenting: false, setPresenting: () => {} }}>
    <div className="flex h-full min-h-screen bg-paper">
      <aside className="flex w-[260px] flex-col border-r border-line bg-paper-2 px-1.5 pt-2">
        <div className="mb-1 flex h-9 items-center gap-2 px-2 font-semibold text-ink">TeamH 워크스페이스</div>
        <DocumentList documents={documents} />
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-[46px] items-center justify-end gap-2 px-4">
          <PresenceStack memberId="m1" />
        </header>
        <main className="mx-auto w-full max-w-[888px] px-16 pt-16">
          <h1 className="text-[42px] font-bold text-ink">회의록</h1>
        </main>
      </div>
    </div>
  </PresenceContext.Provider>
</AppShell>
```

`documents` rows are `{ id, name, parentId, createdBy, createdAt, updatedAt }`; pass `pathname="/documents/<id>"` to `AppShell` to highlight the open one.
