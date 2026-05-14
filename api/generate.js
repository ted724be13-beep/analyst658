export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { payload } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: 'Missing GEMINI_API_KEY environment variable' });
        }

        // 1. 從使用者的輸入中，擷取出股票代號 (例如：抓取 "2330")
        const userQuery = payload.contents[0].parts[0].text;
        const tickerMatch = userQuery.match(/\d{4}/); 
        const ticker = tickerMatch ? tickerMatch[0] : '2330'; // 如果沒抓到，預設使用台積電

        // 2. 呼叫 Yahoo Finance 隱藏版免費 API 抓取即時報價 (這裡先預設加 .TW，若是上櫃可自行調整)
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.TW`;
        
        let currentPrice = "抓取失敗";
        let priceChangePercent = "未知";

        try {
            const yahooRes = await fetch(yahooUrl);
            const yahooData = await yahooRes.json();
            
            if (yahooData.chart.result && yahooData.chart.result.length > 0) {
                const meta = yahooData.chart.result[0].meta;
                currentPrice = meta.regularMarketPrice.toString();
                const previousClose = meta.previousClose;
                priceChangePercent = (((meta.regularMarketPrice - previousClose) / previousClose) * 100).toFixed(2);
            }
        } catch (fetchError) {
            console.error("Yahoo API Fetch Error:", fetchError);
            // 若抓取失敗，依然讓 AI 繼續執行，只是價格會顯示抓取失敗
        }

        // 3. 動態建構 System Prompt，把「絕對正確的價格」硬塞給 AI
        const systemPrompt = `你是一位買方(Buy-Side)專業台股投資經理人。
你的目標只有一個：幫助基金做出最有利於回報的正確決策。這是一份「內部的決策工具」。

🚨【系統即時數據注入 - 極度重要】：
- 目標股票代號：${ticker}
- 最新即時股價：${currentPrice} 元
- 今日單日漲跌幅：${priceChangePercent}%

請你「絕對、必須」使用上方【系統即時數據注入】的股價與漲幅來撰寫報告，絕對不可以自己瞎猜或捏造價格！
根據這些資訊，輸出符合所提供 JSON schema 的深度分析報告。

嚴格遵守以下規則：
1. 評等(rating)只能從以下選擇："Buy" (買入), "Hold" (持有), "Sell" (賣出)。
2. 提供「分析師看多」與「分析師看空」的思辨過程，並給出核心判斷。
3. 股價與漲幅請直接填入上述系統提供的數值，不要加上貨幣單位。
4. 目標價(targetPrice)請給出一個明確的「單一數值」。
5. 【極度重要】你必須只輸出一個合法的 JSON 物件，絕對不要加上 \`\`\`json 標籤。格式必須包含：
{
  "ticker": "字串", "tags": ["字串陣列"], "currentPrice": "字串", "priceChange": "字串", "peRatio": "字串", "marketCap": "字串", "rating": "Buy/Hold/Sell",
  "buySide": { "bullish": "...", "bearish": "...", "judgment": "..." },
  "targetPrice": "字串",
  "valRelative": { "algorithm": "...", "logic": "...", "pros": "...", "cons": "..." },
  "valAbsolute": { "algorithm": "...", "logic": "...", "pros": "...", "cons": "..." },
  "factors": { "macro": "...", "capital": "...", "industry": "...", "company": "..." },
  "technicalAnalysis": { "supportResistance": "...", "movingAverages": "...", "kLine": "...", "kd": "...", "macd": "...", "bollinger": "...", "bias": "...", "summary": "..." },
  "news": [ { "title": "...", "source": "...", "url": "...", "impact": "High/Medium/Low", "analysis": "..." } ],
  "summary": "字串"
}`;

        // 4. 呼叫 Gemini 3.1 Flash Lite API (完全移除 tools / google_search)
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;
        
        const geminiPayload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] }
            // 注意：這裡乾乾淨淨，沒有 tools!
        };

        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error("Gemini API Error:", data);
            return res.status(response.status).json(data);
        }

        return res.status(200).json(data);

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
