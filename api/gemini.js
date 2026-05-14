// api/gemini.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '只允許 POST 請求' });
    }

    const apiKey = process.env.GEMINI_API_KEY; 
    
    // 防呆 1：攔截空金鑰，避免把 undefined 傳給 Google
    if (!apiKey || apiKey === 'undefined') {
        return res.status(400).json({ 
            error: { message: '伺服器未設定 API Key，請檢查 Vercel 環境變數並重新部署。' } 
        });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

    // 防呆 2：安全處理 Payload 格式 (避免重複 Stringify 導致 Google 報錯 400)
    const payloadString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payloadString
        });

        const data = await response.json();

        // 如果 Google 報錯，原封不動傳回前端
        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: { message: error.message } });
    }
}
