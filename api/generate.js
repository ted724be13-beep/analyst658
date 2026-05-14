// api/generate.js
export default async function handler(req, res) {
  // 只允許 POST 請求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 取得前端傳來的參數
    const { payload } = req.body;

    // 從環境變數中讀取 API Key (這是安全隱藏的關鍵)
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Server configuration error: Missing API Key' });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

    // 向 Google API 發送請求
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Google API Error: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    
    // 將結果原封不動回傳給前端
    return res.status(200).json(result);

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
