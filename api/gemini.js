export default async function handler(req, res) {
    // 只接受 POST 請求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 從 Vercel 環境變數讀取金鑰 (注意：不需要 VITE_ 前綴了)
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: '後端找不到 API 金鑰，請至 Vercel 設定' });
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

        // 將前端傳來的資料 (req.body) 原封不動轉發給 Gemini
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        // 將 Google 的回應傳回給前端
        return res.status(200).json(data);
    } catch (error) {
        console.error('Serverless function error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
