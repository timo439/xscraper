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
          maxTweets: 5,
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
    const sample = items[0] || {};

    // Log all keys and retweet-related fields so we can see the structure
    console.log('TOTAL ITEMS:', items.length);
    console.log('KEYS:', Object.keys(sample).join(', '));
    console.log('RT FIELDS:', JSON.stringify({
      retweetCount: sample.retweetCount,
      retweet_count: sample.retweet_count,
      retweeted: sample.retweeted,
      public_metrics: sample.public_metrics,
      likeCount: sample.likeCount,
      favoriteCount: sample.favoriteCount,
    }));

    return res.status(200).json({
      total: items.length,
      keys: Object.keys(sample),
      sample: items.slice(0, 2).map(i => ({
        text: (i.text || i.full_text || '').substring(0, 100),
        retweetCount: i.retweetCount,
        retweet_count: i.retweet_count,
        public_metrics: i.public_metrics,
        likeCount: i.likeCount,
      }))
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
