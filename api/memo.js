const MODELS_URL = 'https://openrouter.ai/api/v1/models';
const CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL_CACHE_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// Used only if the live model list can't be fetched.
const FALLBACK_MODELS = ['openrouter/free'];

let modelCache = { ids: [], fetchedAt: 0 };

// Ask OpenRouter which models are currently free, newest first, so models
// that stop being free drop out and new free ones are picked up automatically.
async function getFreeModels() {
  if (modelCache.ids.length && Date.now() - modelCache.fetchedAt < MODEL_CACHE_MS) {
    return modelCache.ids;
  }
  try {
    const res = await fetch(MODELS_URL);
    if (!res.ok) throw new Error(`models ${res.status}`);
    const { data } = await res.json();
    const ids = data
      .filter((m) =>
        Number(m.pricing?.prompt) === 0 &&
        Number(m.pricing?.completion) === 0 &&
        (m.context_length || 0) >= 8000 &&
        m.architecture?.output_modalities?.includes('text') &&
        !/(embed|guard|moderation)/i.test(m.id))
      .sort((a, b) => (b.created || 0) - (a.created || 0))
      .map((m) => m.id);
    if (ids.length) {
      modelCache = { ids, fetchedAt: Date.now() };
      return ids;
    }
  } catch {
    // fall through to stale cache / fallback
  }
  return modelCache.ids.length ? modelCache.ids : FALLBACK_MODELS;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
  }

  const { quote } = req.body;
  if (!quote?.text || !quote?.author) {
    return res.status(400).json({ error: 'Missing quote text or author' });
  }

  const prompt = `You are a seasoned equity research analyst and student of history. For the following quote, write a tight analyst memo with three sections. Respond ONLY with valid JSON — no preamble, no markdown fences.

Quote: "${quote.text}"
Author: ${quote.author}

JSON format (all values are plain text strings, NO markdown):
{
  "context": "2-3 sentences of historical context about who said this, when, and why it matters. Include a specific year or era if relevant.",
  "reflection": "2-3 sentences connecting this quote directly to investing, capital allocation, or portfolio management. Be specific and practical.",
  "questions": ["A focused investing question this quote raises", "A second question that challenges conventional practice"]
}`;

  const models = (await getFreeModels()).slice(0, MAX_ATTEMPTS);
  let lastError = 'No free models available';

  for (const model of models) {
    try {
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        lastError = err.error?.message || `OpenRouter error ${response.status}`;
        if (response.status === 401 || response.status === 402) break; // key/credit problem, other models won't help
        modelCache.fetchedAt = 0; // model may have gone paid/offline; refresh list next time
        continue;
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';
      const match = text.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
      const memo = match && JSON.parse(match[0]);
      if (memo?.context && memo?.reflection && Array.isArray(memo?.questions)) {
        return res.status(200).json(memo);
      }
      lastError = `Bad response from ${model}`;
    } catch (e) {
      lastError = e.message || `Request to ${model} failed`;
    }
  }

  return res.status(502).json({ error: lastError });
}
