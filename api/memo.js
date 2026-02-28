export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
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

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return res.status(response.status).json({ error: err.error?.message || `Groq error ${response.status}` });
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  const clean = text.replace(/```json|```/g, '').trim();

  try {
    return res.status(200).json(JSON.parse(clean));
  } catch {
    return res.status(500).json({ error: 'Failed to parse Groq response' });
  }
}
