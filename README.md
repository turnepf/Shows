# Show Tracker

A shared TV show and movie tracker built on Cloudflare Pages + D1. Track what you're watching, waiting on, recommending, and planning to watch next.

## Features

- **4 lists:** Watching, Waiting, Recommending, Up Next
- **IMDB ratings** and cast info (via OMDB API)
- **Direct links** to shows on their streaming network
- **4-digit code login** for editors
- **Anyone can suggest** a show (with duplicate detection and fun quips)
- **Move** shows between lists, archive, edit, delete
- **Sorted by rating** within each list
- **Shareable tab URLs** (e.g. `yoursite.com/#recommending`)
- **Network counts** at the bottom of each list
- **Movie flag** to distinguish movies from TV shows

## Setup with Claude

The easiest way to set up your own instance is with [Claude Code](https://claude.ai/code). Just paste this into Claude:

```
Clone https://github.com/turnepf/Shows and set it up on my Cloudflare account. Walk me through each step:
1. Clone the repo
2. Create a Cloudflare D1 database called "shows-db" and update wrangler.toml with the database ID
3. Run schema.sql against the database
4. Run seed-sample.sql to load sample data
5. Ask me for my app title and names to customize APP_TITLE and OWNERS in index.html
6. Ask me for two 4-digit login codes and two editor names, then update functions/auth/login.js and set the Cloudflare Pages secrets
7. Ask me for my OMDB API key (free at omdbapi.com) and set it as a secret
8. Create a Cloudflare Pages project and deploy
9. Optionally set up a custom domain
```

Claude will walk you through it interactively.

## Manual Setup

### Prerequisites

- A [Cloudflare](https://cloudflare.com) account (free tier works)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed
- A free [OMDB API key](http://www.omdbapi.com/apikey.aspx) (verify via email after signing up)

### Steps

1. **Clone the repo:**
   ```bash
   git clone https://github.com/turnepf/Shows.git
   cd Shows
   ```

2. **Customize the app** — Edit `index.html` and change `APP_TITLE` and `OWNERS` near the top of the `<script>` block:
   ```js
   const APP_TITLE = "Your App Title";
   const OWNERS = "Your Names";
   ```

3. **Create the database:**
   ```bash
   wrangler d1 create shows-db
   ```
   Copy the `database_id` from the output into `wrangler.toml`.

4. **Set up the schema and sample data:**
   ```bash
   wrangler d1 execute shows-db --remote --file=schema.sql
   wrangler d1 execute shows-db --remote --file=seed-sample.sql
   ```

5. **Update login codes** — Edit `functions/auth/login.js` and change the secret names and editor names to match your setup.

6. **Deploy:**
   ```bash
   wrangler pages project create shows
   wrangler pages deploy . --project-name shows
   ```

7. **Set secrets:**

   > ⚠️ Use `printf` instead of `echo` — `echo` appends a trailing newline that causes login codes to silently fail at runtime.

   ```bash
   printf "your-omdb-key" | wrangler pages secret put OMDB_API_KEY --project-name shows
   printf "1234" | wrangler pages secret put LOGIN_CODE_1 --project-name shows
   printf "5678" | wrangler pages secret put LOGIN_CODE_2 --project-name shows
   ```

8. **(Optional) Add a custom domain** — In the Cloudflare dashboard, go to Pages > your project > Custom domains.

## Tech Stack

- **Frontend:** Single HTML/CSS/JS page (no build step)
- **API:** Cloudflare Pages Functions
- **Database:** Cloudflare D1 (SQLite at the edge)
- **Ratings:** OMDB API (free tier, 1,000 req/day)

## Project Structure

```
├── index.html              Single page app
├── schema.sql              Database schema
├── seed-sample.sql         Sample data
├── wrangler.toml           Cloudflare config
└── functions/
    ├── api/
    │   ├── shows.js        GET all / POST new show
    │   ├── suggestions.js  POST suggestion (public)
    │   └── shows/
    │       ├── [id].js     GET / PUT / DELETE single show
    │       └── [id]/
    │           ├── move.js     Move to different list
    │           ├── archive.js  Archive a show
    │           └── actors.js   Get cast list
    └── auth/
        ├── login.js        4-digit code login
        ├── logout.js       Clear session
        └── check.js        Check auth status
```

## License

MIT
