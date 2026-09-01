/**
 * Checks that an uploaded file cannot be turned into something the browser runs.
 *
 *   node scripts/verify-chat-files.mjs
 *
 * Needs the app running, and the workspace password. Defaults match a local
 * `.env` with WORKSPACE_PASSWORD=test1234:
 *
 *   APP=http://localhost:3000  PASSWORD=test1234
 *
 * `lib/files/serving.test.mts` already covers the rule as a unit — this checks
 * that the rule is what the running server actually puts on the wire, which is
 * a different claim and the one that matters to a browser.
 *
 * Every case prints what it expected and what happened, and the process exits
 * non-zero if any of them disagree.
 */

const APP = process.env.APP ?? "http://localhost:3000";
const PASSWORD = process.env.PASSWORD ?? "test1234";

let failures = 0;

function report(label, expected, actual) {
  const ok = expected === actual;
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? "✅" : "❌"} ${label.padEnd(46)} 기대=${String(expected).padEnd(24)} 실제=${actual}`,
  );
}

/** Joins the workspace and returns the session cookie every later call carries. */
async function joinAsGuest() {
  const response = await fetch(`${APP}/api/workspace/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nickname: `verify-${Date.now()}`,
      password: PASSWORD,
      force: true,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `join failed: ${response.status} ${await response.text()} — is the app running, and is PASSWORD right?`,
    );
  }

  const cookie = response.headers.getSetCookie().find((c) => c.startsWith("workspace_session="));
  if (!cookie) throw new Error("join succeeded but set no session cookie");
  return cookie.split(";")[0];
}

async function upload(session, name, type, bytes) {
  const form = new FormData();
  form.append("file", new File([bytes], name, { type }));

  const response = await fetch(`${APP}/api/chat/files`, {
    method: "POST",
    headers: { cookie: session },
    body: form,
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function serve(session, id, endpoint) {
  const response = await fetch(`${APP}/api/files/${id}/${endpoint}`, {
    headers: { cookie: session },
  });
  return {
    status: response.status,
    type: response.headers.get("content-type"),
    disposition: response.headers.get("content-disposition"),
    nosniff: response.headers.get("x-content-type-options"),
  };
}

// A real 1x1 PNG, so `preview` is asked to serve something it can genuinely draw.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const SCRIPT = "<script>document.title='executed'</script>";

const session = await joinAsGuest();

console.log("\n① 업로드 — 서버는 확장자를 막지 않는다 (막을 수 없기 때문에)");
const png = await upload(session, "shot.png", "image/png", PNG);
const html = await upload(session, "evil.html", "text/html", SCRIPT);
// The same bytes, uploaded claiming to be an image. The stored type is only
// ever the uploader's word for it.
const liar = await upload(session, "liar.html", "image/png", SCRIPT);
const svg = await upload(session, "a.svg", "image/svg+xml", `<svg xmlns="http://www.w3.org/2000/svg"/>`);
const walk = await upload(session, "../../etc/passwd", "text/plain", "root:x:0:0");

report("이미지 업로드", 201, png.status);
report(".html 업로드 (거부하지 않는다)", 201, html.status);
report("image/png 이라 주장하는 .html", 201, liar.status);
report(".svg 업로드", 201, svg.status);
report("이름이 ../../etc/passwd 인 파일", 201, walk.status);

console.log("\n② preview — 증명할 수 있는 것만, 그것도 sniff 금지로");
const previewPng = await serve(session, png.body.id, "preview");
report("PNG 는 자기 타입으로 inline", "image/png", previewPng.type);
report("PNG preview 는 inline", true, previewPng.disposition?.startsWith("inline"));
report("PNG preview 에 nosniff", "nosniff", previewPng.nosniff);

// 404 rather than 415 on purpose: "there is no preview of this" is the true
// statement. 415 would be telling the caller to retry with a different `Accept`,
// and there is nothing to retry — the file downloads perfectly well.
const previewHtml = await serve(session, html.body.id, "preview");
report(".html 은 preview 거부", 404, previewHtml.status);

const previewSvg = await serve(session, svg.body.id, "preview");
report(".svg 는 preview 거부 (script 를 품는다)", 404, previewSvg.status);

// The dangerous case the list alone cannot catch: it passes the whitelist
// because the stored type is a lie. `nosniff` is what stops the browser
// re-deciding from the bytes and running it.
const previewLiar = await serve(session, liar.body.id, "preview");
report("거짓 타입은 목록을 통과한다", 200, previewLiar.status);
report("그러나 text/html 로는 절대 안 나간다", "image/png", previewLiar.type);
report("그리고 nosniff 가 브라우저의 재판단을 막는다", "nosniff", previewLiar.nosniff);

console.log("\n③ download — 분기 자체가 없어서 틀릴 수가 없다");
for (const [label, file] of [
  ["PNG", png],
  [".html", html],
  ["경로 탈출 이름", walk],
]) {
  const download = await serve(session, file.body.id, "download");
  report(`${label} download 는 octet-stream`, "application/octet-stream", download.type);
  report(`${label} download 는 attachment`, true, download.disposition?.startsWith("attachment"));
  report(`${label} download 에 nosniff`, "nosniff", download.nosniff);
}

console.log("\n④ 저장 — 업로드된 이름은 경로가 되지 않는다");
report("디스크 이름은 id, 업로드 이름이 아니다", true, /^[0-9a-f-]{36}$/.test(walk.body.id));
report("원래 이름은 메타데이터로만 남는다", "../../etc/passwd", walk.body.name);

console.log("\n⑤ 용량 상한 — 500 이 아니라 사용자가 조치할 수 있는 메시지로");
const huge = await upload(session, "big.bin", "application/octet-stream", Buffer.alloc(26 * 1024 * 1024));
report("25MB 초과는 거부", 413, huge.status);
report("메시지가 있다", true, typeof huge.body?.error === "string" && huge.body.error.length > 0);
console.log(`     └ "${huge.body?.error}"`);

console.log("\n⑥ 세션 없이는 아무것도 못 한다");
const anonUpload = await fetch(`${APP}/api/chat/files`, { method: "POST", body: new FormData() });
report("세션 없는 업로드", 401, anonUpload.status);

console.log(
  failures === 0
    ? "\n전부 통과 — 업로드된 바이트가 이 오리진에서 실행될 수 있는 경로가 없습니다.\n"
    : `\n${failures}건 불일치.\n`,
);
process.exit(failures === 0 ? 0 : 1);
