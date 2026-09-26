# Sync the app's components to Claude Design — lessons

**Created**: 2026-09-25

## What surprised us

- Next client modules read `process.env.*` at load, so a browser bundle outside Next needs a `process` shim imported before them.
- The converter derives groups from directory names, so the `[id]` route segment became a group called "id". A small fork of `source-kit.mjs` skips `[param]` segments.
- The WSL headless Chromium lacked `libasound.so.2` and any Korean font. Both were unpacked into `.ds-sync/` instead of installed system-wide.

## What we would do differently

- ...

## Worth extracting

- ...
