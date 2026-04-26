# Show Picker Club

A shared TV show and movie tracker built on Cloudflare Pages + D1. Multiple members each maintain their own lists (Watching, Waiting, Recommending, Up Next), with a shared home page that surfaces what everyone is watching.

Live at [showpicker.club](https://showpicker.club).

## Features

- **Multi-tenant:** one deployment serves every member; each member has their own slug (e.g. `/patrick`, `/sherry`) and their own lists.
- **4 lists per member:** Watching, Waiting, Recommending, Up Next.
- **Auto-enriched** with IMDB ratings, cast, and network links via OMDB and TMDB.
- **TMDB next-season dates** with finale range and auto-detected series-complete status.
- **What Members Are Watching** — home page shows the most-watched shows across all members.
- **Suggest a show** — anyone (logged in or not) can suggest a show to any member.
- **Per-member 4-digit login codes** stored in the DB (no hardcoded secrets).
- **PWA** — installable to home screen.
- **TV view** — `/tv/<slug>` renders a larger, read-only layout for casting to a TV.
- **Watching With** field, per-show notes, recommended-by attribution, archive, hide/show toggles.

## Tech Stack

- **Frontend:** Single HTML/CSS/JS page (no build step), service worker for PWA
- **API:** Cloudflare Pages Functions
- **Database:** Cloudflare D1 (SQLite at the edge)
- **Enrichment:** OMDB API (ratings) + TMDB API (next-season dates, series status)

## Project Structure

Only `public/` (static assets) and `functions/` (Pages Functions at the repo root) are deployed. Everything else — `schema.sql`, `.env`, `deployments.local.md`, `backups/` — stays out of the build output dir on purpose so it can never be served.

```
├── public/                 Deployed static assets (build output dir)
│   ├── index.html          Member picker + per-member lists (single-page app)
│   ├── tv.html             Read-only TV view
│   ├── reporting.html      Internal stats
│   ├── manifest.json       PWA manifest
│   ├── sw.js               Service worker
│   └── _redirects          Cloudflare Pages routing rules
├── schema.sql              Database schema (not deployed)
├── wrangler.toml           Cloudflare config
└── functions/
    ├── api/
    │   ├── shows.js              GET all shows for a member / POST new
    │   ├── shows/[id].js         GET / PUT / DELETE single show
    │   ├── shows/[id]/move.js    Move to a different list
    │   ├── shows/[id]/archive.js Archive a show
    │   ├── shows/[id]/actors.js  Get cast list
    │   ├── shows/check.js        Duplicate-detection for suggestions
    │   ├── shows/share.js        Share-link handler
    │   ├── members.js            List all members
    │   ├── popular.js            Top shows across all members
    │   ├── activity.js           Recent activity feed
    │   ├── suggestions.js        POST suggestion (public, no auth)
    │   ├── enrich.js             OMDB/TMDB enrichment
    │   ├── reporting.js          Stats for /reporting
    │   └── sync-urls.js          Network URL sync helper
    └── auth/
        ├── login.js          4-digit code login (codes live in member_codes)
        ├── logout.js         Clear session
        └── check.js          Check auth status
```

## Routing

Handled by `_redirects`:

| Path             | Behavior                                  |
|------------------|-------------------------------------------|
| `/tv/*`          | Rewrites to `tv.html` (TV view)           |
| `/dorothy[/]`    | 301 to `/whitt` (legacy slug rename)      |
| `/*`             | Falls through to `index.html` (SPA)       |

`index.html` parses the URL path client-side to decide whether to show the member picker or a specific member's lists.

## Setup

### Prerequisites

- A [Cloudflare](https://cloudflare.com) account
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- A free [OMDB API key](http://www.omdbapi.com/apikey.aspx)
- A free [TMDB API key](https://www.themoviedb.org/settings/api)

### Steps

1. **Clone:**
   ```bash
   git clone https://github.com/turnepf/Shows.git
   cd Shows
   ```

2. **Create the D1 database:**
   ```bash
   wrangler d1 create shows-db
   ```
   Copy the `database_id` into `wrangler.toml`.

3. **Apply the schema:**
   ```bash
   wrangler d1 execute shows-db --remote --file=schema.sql
   ```

4. **Seed members + login codes** — insert rows into `members` and `member_codes`. Example:
   ```sql
   INSERT INTO members (slug, name) VALUES ('patrick', 'Patrick Turner');
   INSERT INTO member_codes (member_slug, code, editor_name) VALUES ('patrick', '1234', 'Patrick');
   ```

5. **Create the Pages project and deploy:**
   ```bash
   wrangler pages project create shows
   wrangler pages deploy --project-name shows
   ```
   Wrangler reads `pages_build_output_dir = "public"` from `wrangler.toml` and uploads only that directory. Functions at the repo root are picked up automatically. **Do not pass `.` as the directory** — that ships the entire repo (including `.env`, `backups/`, `wrangler.toml`) to production.

6. **Set API key secrets** — use `printf` (not `echo`) to avoid trailing newlines that break things at runtime:
   ```bash
   printf "your-omdb-key" | wrangler pages secret put OMDB_API_KEY --project-name shows
   printf "your-tmdb-key" | wrangler pages secret put TMDB_API_KEY --project-name shows
   ```

7. **(Optional) Custom domain** — Cloudflare dashboard → Pages → your project → Custom domains.

## License

MIT
