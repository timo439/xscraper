export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const APIFY_TOKEN = process.env.APIFY_TOKEN;
  const ACCOUNTS    = ['orangebook_'];

  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/apidojo~twitter-scraper-lite/runs?token=${APIFY_TOKEN}`,
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

    const data = await response.json();
    const runId      = data.data.id;
    const datasetId  = data.data.defaultDatasetId;

    return res.status(200).json({ runId, datasetId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
