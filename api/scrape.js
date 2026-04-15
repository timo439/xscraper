const MIN_RETWEETS = 500;

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const APIFY_TOKEN = process.env.APIFY_TOKEN;
  const ACCOUNTS    = ['orangebook_', 'naval'];

  try {
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

    const top = qualified[0];
    return res.status(200).json({
      text:     top.text,
      retweets: top.retweets
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
