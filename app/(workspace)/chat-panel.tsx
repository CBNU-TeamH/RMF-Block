"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { parseDocumentLink } from "@/lib/chat/links";
import type { ChatLinkRequest, ChatMessage } from "@/lib/chat/types";

import { ChatFiles } from "./chat-files";
import { ChatMessageRow } from "./chat-message";
import { useWorkspacePresence } from "./presence-provider";
import { FileIcon, flash } from "./ui";

/** The workspace chat (FR-060-01/02/04/05/07). **Prototype** — no chat artboard
 *  in `docs/ui/`, so this is built from the shell's vocabulary.
 *
 *  History arrives over REST and everything after it over the socket. The two
 *  can overlap, so messages are merged by id rather than appended. */

const WS_PATH = "/api/chat/ws";

/** A message this browser is sending, before the server has one of its own. */
type Pending = {
  key: string;
  text: string;
  file: File | null;
  /** Set once the file is stored, so a retry does not upload it twice. Only the
   *  send tends to fail, and a second copy would strand the first — deleting a
   *  file is out of scope, so an orphan is permanent. */
  fileId?: string;
  link?: ChatLinkRequest;
  failed: boolean;
};

const switchClass = (on: boolean) =>
  `rounded-control px-2 py-0.5 text-[12.5px] font-medium ${on ? "bg-paper-2 text-ink" : "text-ink-faint hover:text-ink"}`;

export function ChatPanel({
  me,
  documents,
  link,
  onLink,
  landOn = null,
  onLanded = () => undefined,
}: {
  me: string;
  /** The layout's catalogue: a link's current name, and whether it is gone. */
  documents: Array<{ id: string; name: string }>;
  /** The link the next message carries (FR-060-03), held by the window. */
  link: ChatLinkRequest | null;
  onLink: (link: ChatLinkRequest | null) => void;
  /** A message to scroll to and highlight once it is here (UC-050 E3-3). */
  landOn?: string | null;
  onLanded?: () => void;
}) {
  const [messages, setMessages] = useState<Array<ChatMessage>>([]);
  const [pending, setPending] = useState<Array<Pending>>([]);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  // UC-061 step 1: the file list is a menu in this panel, fed by the same
  // `messages`, so it is live without a second fetch.
  const [showFiles, setShowFiles] = useState(false);
  const [pickingDocument, setPickingDocument] = useState(false);
  const names = useMemo(() => new Map(documents.map((document) => [document.id, document.name])), [documents]);
  const linkLabel = (target: ChatLinkRequest) =>
    `${names.get(target.documentId) ?? "삭제된 문서"}${target.blockId ? ` › ${target.excerpt ?? "블록"}` : ""}`;
  // A landing is in the conversation, which the file list hides — settled
  // during render so the effect below measures a visible list.
  if (landOn && showFiles) setShowFiles(false);

  const scroller = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  // Names this browser's pending sends, nothing more. Not `crypto.randomUUID()`:
  // guests use plain HTTP on the LAN, which is not a secure context.
  const nextKey = useRef(0);

  // The roster is already in the tree; reusing it means one person is the same
  // colour here as in the document list and the presence stack.
  const { members } = useWorkspacePresence();
  const colourOf = (sender: string) =>
    members.find((member) => member.nickname === sender)?.colorTag;

  // One path for both sources. Backfill and the live feed overlap by design, so
  // id is what decides what is new — and `sentAt` is what decides the order,
  // because a reconnect can deliver an older message after a newer one.
  const merge = useCallback((incoming: Array<ChatMessage>) => {
    setMessages((current) => {
      const known = new Set(current.map((message) => message.id));
      const added = incoming.filter((message) => !known.has(message.id));
      if (added.length === 0) return current;

      return [...current, ...added].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
    });
  }, []);

  const receive = useCallback(
    (incoming: ChatMessage) => merge([incoming]),
    [merge],
  );

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const backfill = () =>
      fetch("/api/chat")
        .then((response) => (response.ok ? response.json() : []))
        .then((history: Array<ChatMessage>) => {
          if (!cancelled) merge(history);
        })
        .catch(() => undefined);

    const connect = () => {
      if (cancelled) return;

      socket = new WebSocket(
        `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}${WS_PATH}`,
      );

      // On every open, not just the first: a socket that was down missed
      // whatever was said meanwhile, and reconnecting without asking for it
      // leaves a hole in the history that nothing later fills.
      socket.addEventListener("open", () => {
        attempt = 0;
        void backfill();
      });

      socket.addEventListener("message", (event) => {
        try {
          const frame = JSON.parse(event.data as string);
          if (frame.event === "chat:message") receive(frame.payload as ChatMessage);
        } catch {
          // A frame this client cannot parse is one it was not meant to read.
        }
      });

      // Without this the panel goes deaf for good on the first blip — the host
      // restarting the container, a laptop waking up — and says nothing about
      // it, which is worse than showing an error. Backing off because that
      // restart is the common case, and a tight loop would hammer the server
      // exactly while it is coming back up.
      socket.addEventListener("close", () => {
        if (cancelled) return;
        retry = setTimeout(connect, Math.min(1000 * 2 ** attempt++, 15000));
      });
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, [merge, receive]);

  // Only when already near the bottom, so reading history is not yanked away by
  // someone else's message.
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    if (node.scrollHeight - node.scrollTop - node.clientHeight < 160) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages, pending]);

  // After the effect above, so a landing wins over its pull to the bottom; and
  // on every history change, since the message may arrive with the backfill.
  useEffect(() => {
    const node = scroller.current;
    const row = landOn ? node?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(landOn)}"]`) : null;
    if (!node || !row) return;
    // From the two boxes, not `offsetTop`: the list is not the row's offset parent.
    const above = row.getBoundingClientRect().top - node.getBoundingClientRect().top;
    node.scrollTop += above - (node.clientHeight - row.offsetHeight) / 2;
    flash(row);
    onLanded();
  }, [landOn, messages, onLanded]);

  async function deliver(entry: Pending): Promise<void> {
    let fileId = entry.fileId;

    if (entry.file && !fileId) {
      const form = new FormData();
      form.append("file", entry.file);
      const upload = await fetch("/api/chat/files", { method: "POST", body: form });
      if (!upload.ok) throw new Error(await upload.text());
      fileId = (await upload.json()).id;

      // Recorded before the send is attempted, because the send is the part
      // that fails and the retry reads this back.
      setPending((current) =>
        current.map((item) => (item.key === entry.key ? { ...item, fileId } : item)),
      );
    }

    const sent = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: entry.text, fileId, link: entry.link }),
    });
    if (!sent.ok) throw new Error(await sent.text());

    // The socket will deliver this too; `receive` dedupes by id, and showing it
    // now rather than waiting for the round trip is what makes typing feel local.
    receive(await sent.json());
  }

  function send(entry: Pending) {
    setPending((current) =>
      current.some((item) => item.key === entry.key)
        ? current.map((item) => (item.key === entry.key ? { ...item, failed: false } : item))
        : [...current, entry],
    );

    deliver(entry)
      .then(() => setPending((current) => current.filter((item) => item.key !== entry.key)))
      // UC-060 E1-1 asks for a resend button rather than only an error, so a
      // failed send stays on screen holding everything needed to try again.
      .catch(() =>
        setPending((current) =>
          current.map((item) => (item.key === entry.key ? { ...item, failed: true } : item)),
        ),
      );
  }

  function submit() {
    if (!draft.trim() && !file && !link) return;

    send({ key: String(++nextKey.current), text: draft, file, link: link ?? undefined, failed: false });
    setDraft("");
    setFile(null);
    onLink(null);
    if (picker.current) picker.current.value = "";
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const dropped = event.dataTransfer.files[0];
        if (dropped) setFile(dropped);
      }}
      className={`flex min-h-0 flex-1 flex-col ${dragging ? "bg-sky-soft" : "bg-elev"}`}
    >
      <div className="flex flex-none gap-1 border-b border-line px-3 py-1.5">
        <button
          type="button"
          aria-pressed={!showFiles}
          onClick={() => setShowFiles(false)}
          className={switchClass(!showFiles)}
        >
          대화
        </button>
        <button
          type="button"
          aria-pressed={showFiles}
          onClick={() => setShowFiles(true)}
          className={switchClass(showFiles)}
        >
          파일
        </button>
      </div>

      {showFiles ? <ChatFiles messages={messages} names={names} /> : null}

      {/* Hidden rather than unmounted, so coming back from the file list finds
          the conversation where it was left. */}
      <div ref={scroller} hidden={showFiles} className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {messages.length === 0 && pending.length === 0 ? (
          <p className="pt-8 text-center text-[13px] text-ink-faint">
            아직 대화가 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {messages.map((message) => (
              <ChatMessageRow
                key={message.id}
                colorTag={colourOf(message.sender)}
                message={message}
                mine={message.sender === me}
                linkName={message.link ? names.get(message.link.documentId) : undefined}
              />
            ))}

            {pending.map((entry) => (
              <li key={entry.key} className="flex flex-col gap-0.5 py-1.5 pr-2 pl-[44px]">
                <p className="text-[14px] leading-[1.55] break-words whitespace-pre-wrap text-ink-faint">
                  {entry.text || entry.file?.name || (entry.link ? linkLabel(entry.link) : "")}
                </p>
                {entry.failed ? (
                  <button
                    type="button"
                    onClick={() => send(entry)}
                    className="w-fit rounded-control px-1.5 py-0.5 text-xs font-medium text-danger hover:bg-danger-soft"
                  >
                    전송 실패 · 다시 보내기
                  </button>
                ) : (
                  <span className="text-xs text-ink-faint">보내는 중…</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div hidden={showFiles} className="flex-none px-3 pt-2.5 pb-3">
        {/* FR-060-03's picker for a whole document; a block is sent from the editor. */}
        {pickingDocument ? (
          <div className="mb-2 rounded-control border border-line bg-elev p-1">
            <p className="px-2 py-1 text-[12px] text-ink-faint">어느 문서를 보낼까요?</p>
            <ul className="flex max-h-40 flex-col gap-px overflow-y-auto">
              {documents.map((document) => (
                <li key={document.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onLink({ documentId: document.id });
                      setPickingDocument(false);
                    }}
                    className="flex h-7 w-full items-center truncate rounded-control px-2 text-left text-[13px] text-ink hover:bg-hover"
                  >
                    {document.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {link ? (
          <div className="mb-2 flex items-center gap-2 rounded-control bg-sky-soft px-2.5 py-1.5">
            <span className="min-w-0 flex-1 truncate text-[12px] text-sky-text">{linkLabel(link)}</span>
            <button type="button" onClick={() => onLink(null)} aria-label="링크 첨부 취소" className="text-[12px] text-sky-text">
              ✕
            </button>
          </div>
        ) : null}

        {file ? (
          <div className="mb-2 flex items-center gap-2 rounded-control bg-paper-2 px-2.5 py-1.5">
            <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{file.name}</span>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                if (picker.current) picker.current.value = "";
              }}
              aria-label="첨부 취소"
              className="text-[12px] text-ink-faint"
            >
              ✕
            </button>
          </div>
        ) : null}

        <div className="flex items-end gap-1.5 rounded-card border border-line-strong bg-elev p-1.5 focus-within:border-sky-deep">
          <input
            ref={picker}
            type="file"
            hidden
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => picker.current?.click()}
            aria-label="파일 첨부"
            className="flex size-[30px] flex-none items-center justify-center rounded-control text-ink-faint hover:bg-hover hover:text-ink"
          >
            <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.5 4.5l-4.8 4.8a1.4 1.4 0 002 2l5.1-5.1a2.8 2.8 0 00-4-4L3.7 7.3a4.2 4.2 0 006 6l3.8-3.8" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setPickingDocument((open) => !open)}
            aria-label="문서 링크 첨부"
            aria-expanded={pickingDocument}
            className="flex size-[30px] flex-none items-center justify-center rounded-control text-ink-faint hover:bg-hover hover:text-ink"
          >
            <FileIcon size={16} />
          </button>

          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            // Enter sends, shift+Enter breaks the line — the convention every
            // chat this is modelled on uses.
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
            // A pasted screenshot is the case this feature is most for. A pasted
            // document or block address (링크 복사) is attached as a link rather
            // than typed, when it names a document this workspace has.
            onPaste={(event) => {
              const pasted = event.clipboardData.files[0];
              if (pasted) {
                event.preventDefault();
                setFile(pasted);
                return;
              }
              const target = parseDocumentLink(event.clipboardData.getData("text/plain"));
              if (target && names.has(target.documentId)) {
                event.preventDefault();
                onLink(target);
              }
            }}
            rows={1}
            placeholder="메시지를 입력하세요"
            aria-label="채팅 메시지"
            className="max-h-24 min-h-[30px] w-full flex-1 resize-none bg-transparent px-1 py-[5px] text-[14px] text-ink outline-none placeholder:text-ink-faint"
          />

          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim() && !file && !link}
            className="h-[30px] flex-none rounded-control bg-sky-deep px-3 text-[13px] font-semibold text-white disabled:bg-hover disabled:text-ink-faint"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}
