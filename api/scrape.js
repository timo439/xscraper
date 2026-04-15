const MIN_RETWEETS = 1000;

function filterTweets(items) {
  return items
    .filter(item => {
      const rt   = item.retweetCount ?? item.retweet_count ?? 0;
      const text = item.text || item.full_text || '';
      return rt >= MIN_RETWEETS && !text.startsWith('RT @') && !text.startsWith('@');
    })
    .sort((a, b) => {
      const rtA = a.retweetCount ?? a.retweet_count ?? 0;
      const rtB = b.retweetCount ?? b.retweet_count ?? 0;
      return rtB - rtA;
    })
    .map(item => ({
      text:     item.text || item.full_text,
      retweets: item.retweetCount ?? item.retweet_count ?? 0
    }));
}

async function reshapeTweet(tweetText, anthropicKey) {
  const prompt = `You are a quote editor for a self-improvement Instagram account (@timarmoo).

Reshape the tweet below into a 2-part quote card.

RULES — all must be met or return invalid:
- Total word count: 19–25 words across BOTH parts combined. Count every word carefully.
- Part 1 (title): punchy standalone opener. The sharper, more provocative half.
- Part 2 (body): follow-through — adds context, contrast, or consequence.
- Topic must relate to: self-development, achieving goals, or success in life/work/business.
- No motivational fluff. No clichés. Direct and earned.
- If the tweet CANNOT meet all rules, return: {"valid": false}

Return JSON only, no markdown:
{"valid": true, "title": "Part 1", "body": "Part 2"}

Tweet: ${tweetText}`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await r.json();
  try {
    const result = JSON.parse(data.content[0].text.trim());
    if (!result.valid) return null;
    const wordCount = (result.title + ' ' + result.body).split(/\s+/).length;
    if (wordCount < 19 || wordCount > 25) return null;
    return result;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const APIFY_TOKEN   = process.env.APIFY_TOKEN;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const ACCOUNTS      = ['orangebook_'];

  try {
    // Single synchronous call — runs actor and returns dataset items directly
    const response = await fetch(
      `https://api.apify.com/v2/acts/apidojo~twitter-scraper-lite/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: ACCOUNTS.map(h => ({ url: `https://twitter.com/${h}` })),
          maxTweets: 50,
          addUserInfo: false,
          scrapeTweetReplies: false
        })
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: `Apify error: ${err}` });
    }

    const items     = await response.json();
    const qualified = filterTweets(items);

    if (qualified.length === 0) {
      return res.status(200).json({
        error: `No tweets met the ${MIN_RETWEETS}+ retweet threshold. Found ${items.length} total tweets.`
      });
    }

    // Try reshaping candidates best-first
    for (const candidate of qualified) {
      const quote = await reshapeTweet(candidate.text, ANTHROPIC_KEY);
      if (quote) {
        return res.status(200).json({
          title:    quote.title,
          body:     quote.body,
          source:   candidate.text,
          retweets: candidate.retweets
        });
      }
    }

    return res.status(200).json({
      error: `${qualified.length} tweets passed threshold but none could be reshaped to meet the rules.`
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
