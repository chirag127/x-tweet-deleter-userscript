---
type: Script
title: X Tweet Deleter
description: Delete your own posts by date range and keyword, with a dry-run list and per-tweet log.
repo: https://github.com/chirag127/x-tweet-deleter-userscript
install: https://github.com/chirag127/x-tweet-deleter-userscript/raw/main/x-tweet-deleter-userscript.user.js
version: "1.0.0"
tags: [userscript, x, twitter, delete, archive]
timestamp: 2026-11-09T00:00:00Z
---

# X Tweet Deleter

Walks your own timeline inside a date range, filters by keyword, previews every match, then deletes the confirmed set through `statuses/destroy` with one retry per post.

## Method

Timeline pagination with `max_id`, client-side date/keyword filtering, then one `DELETE statuses/destroy/:id` per confirmed post with a single retry on 429/5xx.

Endpoints:

- `GET /i/api/1.1/statuses/user_timeline.json?user_id=&count=200&tweet_mode=extended&max_id=` - own posts, paginated backwards.
- `DELETE /i/api/1.1/statuses/destroy/:id.json` - the delete.

## Limitations

- Scans at most 3200 timeline entries per run and stops at the earliest From date.
- Deletes are permanent - X keeps no trash. Export anything you may want back.
- Reposts are deleted as reposts, not as the original post.
- Rate limits are retried once after ~2.2 s; a second failure is logged and skipped.

## Risk

Deletion cannot be undone. Run a narrow date range first, confirm the preview, and keep the JSON/Markdown habit for anything worth archiving.

## Install

Read the shared [install guide](https://github.com/chirag127/userscript-install-guide) once, then install the raw file above.
