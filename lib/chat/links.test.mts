import assert from "node:assert/strict";
import { describe, it } from "vitest";

import type { Block } from "../blocks/types.ts";
import {
  EXCERPT_MAX,
  blockFromHash,
  documentLinkUrl,
  excerptOf,
  linkLabel,
  parseDocumentLink,
  sharedLinks,
  splitUrls,
} from "./links.ts";
import type { ChatMessage } from "./types.ts";

describe("splitUrls", () => {
  it("cuts text into runs and http(s) URLs, in order", () => {
    assert.deepEqual(splitUrls("문서는 https://a.example/x 에 있고 http://b.example 도 봐"), [
      { text: "문서는 " },
      { url: "https://a.example/x" },
      { text: " 에 있고 " },
      { url: "http://b.example" },
      { text: " 도 봐" },
    ]);
  });

  it("leaves sentence punctuation outside, and keeps a URL's own parentheses", () => {
    assert.deepEqual(splitUrls("(see https://w.example/wiki/A_(b)), ok."), [
      { text: "(see " },
      { url: "https://w.example/wiki/A_(b)" },
      { text: "), ok." },
    ]);
  });

  it("does not link other schemes", () => {
    assert.deepEqual(splitUrls("javascript:alert(1) data:text/html,x"), [{ text: "javascript:alert(1) data:text/html,x" }]);
  });
});

describe("document link addresses", () => {
  it("round-trip a block link through its address", () => {
    const url = documentLinkUrl("http://192.168.0.14:3000", "doc-1", "b-1");

    assert.equal(url, "http://192.168.0.14:3000/documents/doc-1#block=b-1");
    assert.deepEqual(parseDocumentLink(` ${url} `), { documentId: "doc-1", blockId: "b-1" });
  });

  it("read a document address from any host, with no block", () => {
    assert.deepEqual(parseDocumentLink("http://localhost:3000/documents/doc-1"), { documentId: "doc-1" });
  });

  it("are not anything else", () => {
    assert.equal(parseDocumentLink("https://example.com/somewhere"), null);
    assert.equal(parseDocumentLink("/documents/doc-1"), null);
    assert.equal(parseDocumentLink("회의록 링크 http://localhost:3000/documents/doc-1"), null);
    assert.equal(parseDocumentLink("http://localhost:3000/documents/%E0%A4"), null);
  });

  it("read the block off a hash", () => {
    assert.equal(blockFromHash("#block=b-1"), "b-1");
    assert.equal(blockFromHash(""), null);
    assert.equal(blockFromHash("#block="), null);
  });
});

describe("excerptOf", () => {
  const block = (fields: Record<string, unknown>) => ({ id: "b", ...fields }) as unknown as Block;

  it("shows a text block's first line, and a file block's name", () => {
    assert.equal(excerptOf(block({ type: "text", text: "\n  배포 일정  \n둘째 줄" })), "배포 일정");
    assert.equal(excerptOf(block({ type: "image", fileName: "도식.png" })), "도식.png");
  });

  it("cuts a long line to EXCERPT_MAX, and has nothing for a divider or an empty block", () => {
    assert.equal(excerptOf(block({ type: "text", text: "가".repeat(200) }))?.length, EXCERPT_MAX);
    assert.equal(excerptOf(block({ type: "divider" })), undefined);
    assert.equal(excerptOf(block({ type: "text", text: "  " })), undefined);
  });
});

describe("linkLabel", () => {
  it("names the document, then the block by its excerpt or as 블록", () => {
    assert.equal(linkLabel("회의록", {}), "회의록");
    assert.equal(linkLabel("회의록", { blockId: "b", excerpt: "배포 일정" }), "회의록 › 배포 일정");
    assert.equal(linkLabel("회의록", { blockId: "b" }), "회의록 › 블록");
  });
});

describe("sharedLinks", () => {
  it("lists links and URLs from the history, newest first", () => {
    const messages: Array<ChatMessage> = [
      { id: "m1", sender: "가", text: "https://a.example", sentAt: "2026-10-19T01:00:00.000Z" },
      {
        id: "m2",
        sender: "나",
        text: "",
        link: { documentId: "doc-1", documentName: "회의록" },
        sentAt: "2026-10-19T02:00:00.000Z",
      },
      { id: "m3", sender: "다", text: "링크 없음", sentAt: "2026-10-19T03:00:00.000Z" },
    ];

    assert.deepEqual(
      sharedLinks(messages).map((entry) => ("url" in entry ? entry.url : entry.link.documentName)),
      ["회의록", "https://a.example"],
    );
  });
});
