const hasKey = () => Boolean(process.env.GEMINI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim());

async function requestJson(prompt, validate, system) {
  const gemini = process.env.GEMINI_API_KEY?.trim();
  const openAi = process.env.OPENAI_API_KEY?.trim();
  const providers = [];
  if (gemini) providers.push({
    name: 'Gemini',
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || 'gemini-2.5-flash')}:generateContent`,
    headers: { 'x-goog-api-key': gemini },
    input: { ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}), contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 1800 } },
    read: data => data.candidates?.[0]?.content?.parts?.[0]?.text
  });
  if (openAi) providers.push({
    name: 'OpenAI',
    url: 'https://api.openai.com/v1/chat/completions',
    headers: { Authorization: 'Bearer ' + openAi },
    input: { model: process.env.OPENAI_MODEL || 'gpt-4o-mini', messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }],
      response_format: { type: 'json_object' }, max_completion_tokens: 900 },
    read: data => data.choices?.[0]?.message?.content
  });
  for (const provider of providers) {
    try {
      const response = await fetch(provider.url, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
        headers: { ...provider.headers, 'Content-Type': 'application/json' }, body: JSON.stringify(provider.input)
      });
      if (!response.ok) {
        await response.body?.cancel();
        continue;
      }
      const value = JSON.parse(provider.read(await response.json()));
      if (validate(value)) return { value, provider: provider.name };
    } catch {
      // Try the next provider without logging submitted or generated content.
    }
  }
  return null;
}

module.exports = { hasKey, requestJson };
