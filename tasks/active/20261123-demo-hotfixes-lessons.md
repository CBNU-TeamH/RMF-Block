# Demo hotfixes — lessons

**Created**: 2026-11-23

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- A reconnect trigger needs to know whether a retry is pending. `chat-panel.tsx` clears its `retry` handle when the timer fires, because `reconnectNow` reads `retry === undefined` as "a socket is live" — without that, `online` on a healthy socket would open a second one.


## What we would do differently

- The browser acceptance checks for #241, #221 and #80 were left out of this task, so the PR carries unit-test evidence only. A pre-demo hotfix is where a two-minute DevTools check pays most.


## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- Nothing yet.

