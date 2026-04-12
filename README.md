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

The easiest way to set up your own instance is to use [Claude Code](https://claude.ai/code). Give Claude these instructions:

> Set up the Show Tracker app from this repo on my Cloudflare account. Here's what I need:
>
> 1. Create a D1 database called `shows-db` and update `wrangler.toml` with the database ID
> 2. Run `schema.sql` against the database
> 3. Run `seed-sample.sql` to load sample data (or I'll provide my own)
> 4. Create a Cloudflare Pages project and deploy
> 5. Set up these secrets:
>    - `OMDB_API_KEY` — get a free key at [omdbapi.com](http://www.omdbapi.com/apikey.aspx)
>    - `LOGIN_CODE_1` — a 4-digit code for the first editor
>    - `LOGIN_CODE_2` — a 4-digit code for the second editor
> 6. Update the login codes in `functions/auth/login.js` to match the secret names
> 7. Update `APP_TITLE` and `OWNERS` at the top of the script in `index.html`

## Manual Setup

### Prerequisites

- A [Cloudflare](https://cloudflare.com) account (free tier works)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed
- A free [OMDB API key](http://www.omdbapi.com/apikey.aspx) (verify via email after signing up)

### Steps

1. **Customize the app** — Edit `index.html` and change `APP_TITLE` and `OWNERS` near the top of the `<script>` block:
   ```js
   const APP_TITLE = "Your App Title";
   const OWNERS = "Your Names";
   ```

2. **Create the database:**
   ```bash
   wrangler d1 create shows-db
   ```
   Copy the `database_id` from the output into `wrangler.toml`.

3. **Set up the schema and sample data:**
   ```bash
   wrangler d1 execute shows-db --remote --file=schema.sql
   wrangler d1 execute shows-db --remote --file=seed-sample.sql
   ```

4. **Update login codes** — Edit `functions/auth/login.js` and set the secret names and editor names to match your setup.

5. **Deploy:**
   ```bash
   wrangler pages project create shows
   wrangler pages deploy . --project-name shows
   ```

6. **Set secrets:**
   ```bash
   echo "your-omdb-key" | wrangler pages secret put OMDB_API_KEY --project-name shows
   echo "1234" | wrangler pages secret put LOGIN_CODE_1 --project-name shows
   echo "5678" | wrangler pages secret put LOGIN_CODE_2 --project-name shows
   ```

7. **(Optional) Add a custom domain** — In the Cloudflare dashboard, go to Pages > your project > Custom domains.

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

## Database

Schema is in `schema.sql`. Tables:

- **shows** — title, network, network_url, recommended_by, rating, list, notes, movie, archived
- **actors** — show_id, name (cast members from OMDB)
- **sessions** — login sessions
- **suggestions** — (legacy, suggestions now go directly into shows)

## URL Cleaning

The app automatically cleans pasted URLs:
- Strips everything after `?` (tracking params)
- For Amazon, also strips `ref=` and beyond

## License

MIT
