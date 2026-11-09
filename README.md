# X Tweet Deleter

Delete your own posts by date range and keyword, with a dry-run list and per-tweet log.

## What it does

Walks your own timeline inside a date range, filters by keyword, previews every match, then deletes the confirmed set through `statuses/destroy` with one retry per post.

## Install

Read the shared **[userscript install guide](https://github.com/chirag127/userscript-install-guide)** once (ScriptCat / Tampermonkey setup), then install:

**[Install x-tweet-deleter-userscript.user.js](https://github.com/chirag127/x-tweet-deleter-userscript/raw/main/x-tweet-deleter-userscript.user.js)**

## Use

1. Open x.com signed in and press **Alt+Shift+D** (panel is on the bottom right).
2. Set From / To dates and an optional keyword; choose whether reposts are included.
3. Press **Scan timeline** - nothing is deleted yet. Review the list and untick anything to keep.
4. Press **Delete N** once to confirm, then watch the per-tweet log.

Everything runs in a floating panel: drag it by the header, resize from the corner, collapse it to a chip. The dry run always comes first; exactly one confirm starts the work.

## Limits

- Scans at most 3200 timeline entries per run and stops at the earliest From date.
- Deletes are permanent - X keeps no trash. Export anything you may want back.
- Reposts are deleted as reposts, not as the original post.
- Rate limits are retried once after ~2.2 s; a second failure is logged and skipped.

## Risk note

Deletion cannot be undone. Run a narrow date range first, confirm the preview, and keep the JSON/Markdown habit for anything worth archiving.

The script acts with your own signed-in session against your own account. It is not an anti-bot bypass - it uses the same endpoints the site's own page uses.

## Documentation

- [AGENTS.md](AGENTS.md) - implementation notes and test steps
- [okf/](../../../../../docs/okf/index.md) - knowledge bundle for humans and agents

## License

[MIT](LICENSE) (c) 2026 chirag127

<!-- docs-single-source -->
## 📚 Documentation

Documentation for this repository lives in the umbrella workspace, in exactly **one** place:

| What | Where |
|------|-------|
| This script's note | [`docs/okf/scripts/x-tweet-deleter-userscript.md`](../../../../../docs/okf/scripts/x-tweet-deleter-userscript.md) |
| All notes, catalogued | [`docs/okf/index.md`](../../../../../docs/okf/index.md) |
| Shared knowledge | [`docs/okf/concepts/`](../../../../../docs/okf/concepts/) |

It is **not** copied into this repository. Nothing in this workspace is duplicated: one
document, one file. Verify with `node c:\ws\scripts\check-okf.mjs`.
