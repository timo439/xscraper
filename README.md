# @timarmoo Apple Notes Quote Generator

Scrapes high-signal tweets from approved accounts via Apify, filters to 1,000+ retweets, reshapes into a 2-part self-development quote via Claude, and renders in an iPhone/Instagram mockup.

## Environment Variables

Set these in Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `APIFY_TOKEN` | `YOUR_APIFY_TOKEN` |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |

## How it works

1. User hits **Generate Quote**
2. `/api/start` triggers Apify scraper on `@orangebook_`
3. Frontend polls `/api/poll` every 5 seconds
4. Once complete: tweets filtered to 1,000+ RTs, best candidate reshaped by Claude into 2-part hypothesis quote (19–25 words, self-development topic)
5. Quote renders in iPhone mockup live in the browser
6. **Download Card** saves the HTML file

## Adding more accounts

Edit `ACCOUNTS` array in `/api/start.js`.
