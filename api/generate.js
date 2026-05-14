export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { payload } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });

    // 使用目前最強、支援度最高的 Gemini 3.1 Flash Lite 引擎
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    // 這裡就是你要求的「原本的方式」：在後端呼叫時開啟 google_search 工具
    const geminiPayload = {
      contents: payload.contents,
      systemInstruction: payload.systemInstruction,
      tools: [{ "google_search": {} }], // 重新開啟 AI 搜尋模式
      generationConfig: payload.generationConfig
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload)
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
