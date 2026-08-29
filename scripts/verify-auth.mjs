/**
 * Checks that Yorkie is actually gated behind a workspace session.
 *
 *   node scripts/verify-auth.mjs
 *
 * Needs Yorkie and the app running, and the workspace password. Defaults match
 * a local `.env` with WORKSPACE_PASSWORD=test1234:
 *
 *   APP=http://localhost:3000  RPC=http://localhost:8080  PASSWORD=test1234
 *
 * Every case prints what it expected and what happened, and the process exits
 * non-zero if any of them disagree — so it is usable as a check, not only as
 * something to read.
 */
import yorkie from "@yorkie-js/sdk";

const APP = process.env.APP ?? "http://localhost:3000";
const RPC = process.env.RPC ?? "http://localhost:8080";
const PASSWORD = process.env.PASSWORD ?? "test1234";

let failures = 0;

// The SDK prints the whole error object when a connection is refused, and half
// this script's cases refuse on purpose — so the expected noise would bury the
// results. Silenced around the probes only; anything unexpected still surfaces
// as a case that disagrees with what it expected.
const realConsoleError = console.error;
const quiet = async (run) => {
  console.error = () => {};
  try {
    return await run();
  } finally {
    console.error = realConsoleError;
  }
};

function report(label, expected, actual) {
  const ok = expected === actual;
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? "✅" : "❌"} ${label.padEnd(42)} 기대=${String(expected).padEnd(8)} 실제=${actual}`,
  );
}

/** Attaches a client and says whether it got in, without leaking one on failure. */
function canReachYorkie(token) {
  return quiet(async () => {
    const client = new yorkie.Client({
      rpcAddr: RPC,
      ...(token === undefined ? {} : { authTokenInjector: async () => token }),
    });

    try {
      await client.activate();
      // A fresh key each time, because Yorkie caches an auth decision for ten
      // seconds against the request body — reusing one would measure the cache.
      await client.attach(new yorkie.Document(`probe-${Date.now()}-${Math.random()}`));
      await client.deactivate();
      return true;
    } catch {
      try {
        await client.deactivate();
      } catch {
        // A client refused at activate() was never active; nothing to wind down.
      }
      return false;
    }
  });
}

async function join(nickname, password) {
  const response = await fetch(`${APP}/api/workspace/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // `force` so the script can be run twice. Its own previous run leaves that
    // nickname signed in, and joining as a live nickname answers 409 by design
    // — a real guest is asked before another device is displaced. Taking over
    // its own session is what a repeated run means.
    body: JSON.stringify({ nickname, password, force: true }),
  });

  return {
    status: response.status,
    cookie: response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
  };
}

async function tokenFor(cookie) {
  const response = await fetch(`${APP}/api/auth/yorkie-token`, {
    headers: cookie ? { cookie } : {},
  });

  return {
    status: response.status,
    token: response.ok ? (await response.json()).token : undefined,
  };
}

// Fail early rather than reporting every case as "blocked" because nothing is up.
for (const [name, url] of [
  ["Yorkie", `${RPC}/yorkie.v1.YorkieService/health`],
  ["app", `${APP}/join`],
]) {
  try {
    await fetch(url);
  } catch {
    console.error(`\n  ${name} is not reachable. Start it and try again.\n`);
    process.exit(2);
  }
}

console.log("\n① 서버를 거치지 않고 Yorkie에 직접 (토큰 없음)");
report("SDK로 바로 attach", false, await canReachYorkie(undefined));
report("아무 토큰이나 지어내서 attach", false, await canReachYorkie("made-up"));

console.log("\n② 로그인하지 않고");
report("비밀번호 없이 join", 401, (await join("intruder")).status);
report("틀린 비밀번호로 join", 401, (await join("intruder", "wrong")).status);
report("세션 없이 토큰 요청", 401, (await tokenFor(undefined)).status);
report("남의 쿠키를 흉내낸 토큰 요청", 401, (await tokenFor("workspace_session=made-up")).status);

console.log("\n③ 서버를 거쳐서 (정상 경로)");
const guest = await join("verify-guest", PASSWORD);
report("올바른 비밀번호로 join", 200, guest.status);

const issued = await tokenFor(guest.cookie);
report("세션으로 토큰 발급", 200, issued.status);
report("발급받은 토큰으로 attach", true, await canReachYorkie(issued.token));

console.log(
  failures === 0
    ? "\n  모두 기대대로입니다.\n"
    : `\n  ${failures}건이 기대와 다릅니다.\n`,
);

process.exit(failures === 0 ? 0 : 1);
