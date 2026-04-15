function getRetweets(item) {
  // Handle all known Apify Twitter scraper field variants
  return item.retweetCount
    ?? item.retweet_count
    ?? item.public_metrics?.retweet_count
    ?? item.stats?.retweetCount
    ?? item.retweetsCount
    ?? 0;
}

function getText(item) {
  return item.text || item.full_text || item.tweet_text || '';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const APIFY_TOKEN = process.env.APIFY_TOKEN;
  const ACCOUNTS    = ['orangebook_', 'naval'];
  const MIN_RETWEETS = 0; // Testing: no threshold

  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/apidojo~twitter-scraper-lite/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: ACCOUNTS.map(h => ({ url: `https://twitter.com/${h}` })),
          maxTweets: 20,
          addUserInfo: false,
          scrapeTweetReplies: false
        })
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: `Apify error: ${err}` });
    }

    const items = await response.json();

    // Log the first item's full structure for debugging
    if (items.length > 0) {
      console.log('SAMPLE ITEM KEYS:', Object.keys(items[0]).join(', '));
      console.log('SAMPLE RT VALUE:', getRetweets(items[0]));
      console.log('SAMPLE TEXT:', getText(items[0]).substring(0, 80));
    }

    const qualified = items
      .filter(item => {
        const rt   = getRetweets(item);
        const text = getText(item);
        return rt >= MIN_RETWEETS && !text.startsWith('RT @') && !text.startsWith('@');
      })
      .sort((a, b) => getRetweets(b) - getRetweets(a));

    if (qualified.length === 0) {
      return res.status(200).json({ error: `No tweets found. Total scraped: ${items.length}` });
    }

    const top = qualified[0];
    return res.status(200).json({
      text:     getText(top),
      retweets: getRetweets(top)
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
