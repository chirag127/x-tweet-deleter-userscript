# AGENTS.md - x-tweet-deleter-userscript

Single-file product. `x-tweet-deleter-userscript.user.js` at the repo root **is** the product. No build, no deps, plain IIFE, `@grant none`.

## Endpoints actually used

- `GET /i/api/1.1/statuses/user_timeline.json?user_id=&count=200&tweet_mode=extended&max_id=` - own posts, paginated backwards.
- `DELETE /i/api/1.1/statuses/destroy/:id.json` - the delete.

X auth: bearer from `window.__INITIAL_STATE__` / a scanned script tag, falling back to the public web-client bearer; `x-csrf-token` is the `ct0` cookie. GitHub auth: the page `authenticity_token` from the unfollow form.

## Rules

- One file, zero dependencies, no build step. Bump `@version` and keep `@updateURL` / `@downloadURL` on raw `main`.
- API first, DOM clicking only as a fallback (thread replies and the GitHub following list are the only DOM reads).
- Dry run first, exactly one confirm, then execute. Never delete or unfollow on scan.
- 3 concurrent workers, 150-400 ms jitter, live per-row status, pause and stop always available.
- Never handle a shortcut while focus is in an input, textarea or contenteditable.
- Survive SPA navigation: the panel re-mounts on a URL change and keeps its state.
- `@noframes`; the panel is draggable, resizable and collapsible to a chip.

## Test with sctl

```bash
sctl install https://github.com/chirag127/x-tweet-deleter-userscript/raw/main/x-tweet-deleter-userscript.user.js
sctl page goto "<a matching page>"
# press the panel shortcut, run a scan, check the dry-run table
sctl debug console --level error
```

Verify on a throwaway slice first: a narrow date range, one page of results, or a 5-item cap. Then widen.

## Install docs

Shared guide: https://github.com/chirag127/userscript-install-guide - link it, never duplicate install steps.

<!-- okf-requirement -->
## OKF documentation requirement (mandatory)

Every repository in this collection MUST ship an Open Knowledge Format bundle in `okf/`.

- Canonical bundle: `repos/own/public/userscripts/okf/` in the `c:\ws` monorepo. Never hand-edit a repo's `okf/` copy.
- After changing the canonical bundle run `node okf/sync-okf.mjs`; verify with `node okf/sync-okf.mjs --check` (must exit 0).
- This repo's own note is `okf/scripts/x-tweet-deleter-userscript.md`; `README.md` must link to `okf/`.
