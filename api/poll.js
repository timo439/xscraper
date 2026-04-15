const MIN_RETWEETS = 1000;

async function fetchRunStatus(runId, token) {
  const r = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
  const d = await r.json();
  return { status: d.data.status, datasetId: d.data.defaultDatasetId };
}

async function fetchDataset(datasetId, token) {
  const r = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&format=json`
  );
  return r.json();
}

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { runId } = req.query;
  if (!runId) return res.status(400).json({ error: 'Missing runId' });

  const APIFY_TOKEN   = process.env.APIFY_TOKEN;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  try {
    // 1. Check run status
    const { status, datasetId } = await fetchRunStatus(runId, APIFY_TOKEN);

    if (status === 'RUNNING' || status === 'READY' || status === 'CREATED') {
      return res.status(200).json({ status: 'pending', runStatus: status });
    }

    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      return res.status(500).json({ error: `Apify run ${status}`, status: 'failed' });
    }

    // 2. Fetch + filter tweets
    const items     = await fetchDataset(datasetId, APIFY_TOKEN);
    const qualified = filterTweets(items);

    if (qualified.length === 0) {
      return res.status(200).json({
        status: 'done',
        error: `No tweets met the ${MIN_RETWEETS}+ retweet threshold. Found ${items.length} total tweets.`
      });
    }

    // 3. Try reshaping candidates best-first
    for (const candidate of qualified) {
      const quote = await reshapeTweet(candidate.text, ANTHROPIC_KEY);
      if (quote) {
        return res.status(200).json({
          status:   'done',
          title:    quote.title,
          body:     quote.body,
          source:   candidate.text,
          retweets: candidate.retweets
        });
      }
    }

    return res.status(200).json({
      status: 'done',
      error:  `${qualified.length} tweets passed threshold but none could be reshaped to meet the hypothesis.`
    });

  } catch (err) {
    return res.status(500).json({ error: err.message, status: 'failed' });
  }
}
