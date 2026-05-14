import React, { useState, useEffect, useRef } from 'react';

// 格式化金錢顯示
const formatMoney = (num) => {
    return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

// 格式化文字，將 Markdown 粗體轉換為 HTML (並套用莫蘭迪文字色)
const formatText = (text) => {
    if (!text) return '---';
    return text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#4a4a4a] font-bold">$1</strong>');
};

// 渲染星星/火焰圖示 (莫蘭迪紅)
const ImpactIcons = ({ impact }) => {
    let count = 1;
    const str = (impact || '').toUpperCase();
    if (str.includes('HIGH') || str.includes('高')) count = 3;
    else if (str.includes('MED') || str.includes('中')) count = 2;
    
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <i key={i} className="fa-solid fa-fire text-[#C9A4A0] mr-1"></i>
            ))}
        </>
    );
};

export default function App() {
    // --- 應用程式與環境狀態 ---
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [appMode, setAppMode] = useState('analyst'); // 'analyst' 或 'calc'
    
    // --- API 狀態 ---
    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('');
    const [error, setError] = useState('');
    
    // --- 分析師系統狀態 ---
    const [tickerInput, setTickerInput] = useState('');
    const [reportData, setReportData] = useState(null);
    const [activeTab, setActiveTab] = useState('fundamental');
    const [isTechUnlocked, setIsTechUnlocked] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [passwordError, setPasswordError] = useState(false);
    const [currentChartSymbol, setCurrentChartSymbol] = useState("TWSE:2330");
    const [isExporting, setIsExporting] = useState(false);
    
    // --- 價值換算器狀態 ---
    const [benchmarkTarget, setBenchmarkTarget] = useState('0050');
    const [itemPrice, setItemPrice] = useState('');
    const [calcData, setCalcData] = useState(null);

    // --- 圖表 Refs ---
    const lwContainerRef = useRef(null);
    const lwChartRef = useRef(null);
    const calcCanvasRef = useRef(null);
    const calcChartRef = useRef(null);

    useEffect(() => {
        const loadScript = (src) => {
            return new Promise((resolve) => {
                if (document.querySelector(`script[src="${src}"]`)) return resolve();
                const script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                document.head.appendChild(script);
            });
        };
        const loadCSS = (href) => {
             if (document.querySelector(`link[href="${href}"]`)) return;
             const link = document.createElement('link');
             link.rel = 'stylesheet';
             link.href = href;
             document.head.appendChild(link);
        }

        // 載入字體與圖示
        loadCSS('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css');
        loadCSS('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=JetBrains+Mono:wght@400;700&display=swap');

        // 載入第三方庫
        Promise.all([
            loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'),
            loadScript('https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js'),
            loadScript('https://cdn.jsdelivr.net/npm/chart.js')
        ]).then(() => {
            setScriptsLoaded(true);
        });
    }, []);

    // 渲染 Lightweight Charts (K線圖)
    useEffect(() => {
        if (scriptsLoaded && activeTab === 'technical' && reportData?.klineData && lwContainerRef.current) {
            const timer = setTimeout(() => {
                if (lwChartRef.current) {
                    lwChartRef.current.remove();
                    lwChartRef.current = null;
                }
                
                lwContainerRef.current.innerHTML = '';
                
                const sortedData = [...reportData.klineData].sort((a, b) => new Date(a.date) - new Date(b.date));
                const chartData = sortedData.map(item => ({
                    time: item.date,
                    open: item.open,
                    high: item.high,
                    low: item.low,
                    close: item.close
                }));

                const chartOptions = {
                    autoSize: true,
                    layout: { textColor: '#8e8e8e', background: { type: 'solid', color: 'transparent' }, fontFamily: "'JetBrains Mono', monospace" },
                    grid: { vertLines: { color: 'rgba(184, 184, 176, 0.2)', style: 1 }, horzLines: { color: 'rgba(184, 184, 176, 0.2)', style: 1 } },
                    rightPriceScale: { borderColor: 'rgba(184, 184, 176, 0.3)' },
                    timeScale: { borderColor: 'rgba(184, 184, 176, 0.3)', timeVisible: false, fixLeftEdge: true, fixRightEdge: true },
                    crosshair: { mode: window.LightweightCharts.CrosshairMode.Normal }
                };

                const chart = window.LightweightCharts.createChart(lwContainerRef.current, chartOptions);
                const candlestickSeries = chart.addCandlestickSeries({
                    upColor: '#C9A4A0',
                    downColor: '#A3B5A6',
                    borderVisible: false,
                    wickUpColor: '#C9A4A0',
                    wickDownColor: '#A3B5A6',
                });

                candlestickSeries.setData(chartData);
                chart.timeScale().fitContent();
                lwChartRef.current = chart;
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [scriptsLoaded, activeTab, reportData]);

    // 渲染 Chart.js (價值對比圖)
    useEffect(() => {
        if (scriptsLoaded && appMode === 'calc' && calcData && calcCanvasRef.current) {
            if (calcChartRef.current) calcChartRef.current.destroy();
            
            const ctx = calcCanvasRef.current.getContext('2d');
            const { basePrice, val3m, val1y, targetShortName } = calcData;
            const dep3m = basePrice * 0.9;
            const dep1y = basePrice * 0.7;

            calcChartRef.current = new window.Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['現在', '3個月後', '1年後'],
                    datasets: [
                        { label: `投資 ${targetShortName} 預期價值`, data: [basePrice, val3m, val1y], borderColor: '#A3B5A6', backgroundColor: 'rgba(163, 181, 166, 0.2)', borderWidth: 3, pointBackgroundColor: '#A3B5A6', pointRadius: 6, fill: true, tension: 0.3 },
                        { type: 'bar', label: `消費掉的資金殘值預估`, data: [basePrice, dep3m, dep1y], backgroundColor: '#C9A4A0', borderRadius: 6, barThickness: 40 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { font: { family: "'Inter', sans-serif", size: 13 }, color: '#4a4a4a', usePointStyle: true, padding: 20 } },
                        tooltip: { backgroundColor: 'rgba(255, 255, 255, 0.95)', titleColor: '#8e8e8e', bodyColor: '#4a4a4a', borderColor: '#B8B8B0', borderWidth: 1, padding: 12, callbacks: { label: function(context) { let label = context.dataset.label || ''; if (label) { label += ': '; } if (context.parsed.y !== null) { label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(context.parsed.y).replace('$', 'NT$'); } return label; } } }
                    },
                    scales: {
                        y: { beginAtZero: false, grid: { color: 'rgba(184, 184, 176, 0.2)' }, ticks: { font: { family: "'JetBrains Mono', monospace", size: 12 }, color: '#8e8e8e', callback: function(value) { return value.toLocaleString('en-US'); } } },
                        x: { grid: { display: false }, ticks: { font: { family: "'Inter', sans-serif", size: 13 }, color: '#8e8e8e' } }
                    }
                }
            });
        }
    }, [scriptsLoaded, appMode, calcData]);

    const exportPDF = () => {
        setIsExporting(true);
        setTimeout(() => {
            const element = document.getElementById('reportContainer');
            const ticker = reportData?.ticker || 'Report';
            
            const opt = {
                margin:       10,
                filename:     `海涵路分析報告_${ticker.replace(/\s+/g, '')}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, logging: false },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            window.html2pdf().set(opt).from(element).save().then(() => {
                setIsExporting(false);
            });
        }, 100); // 延遲讓兩頁面都渲染入 DOM
    };

    const handleTabSwitch = (tabId) => {
        if (tabId === 'technical' && !isTechUnlocked) {
            setShowPasswordModal(true);
            setPasswordError(false);
            setPasswordInput('');
            return;
        }
        setActiveTab(tabId);
    };

    const unlockTechTab = () => {
        if (passwordInput === '427088') {
            setIsTechUnlocked(true);
            setShowPasswordModal(false);
            setActiveTab('technical');
        } else {
            setPasswordError(true);
        }
    };

    const generateReport = async () => {
        const input = tickerInput.trim();
        if (!input) return;

        setLoading(true);
        setError('');
        setReportData(null);
        setLoadingText('分析師正在蒐集最新數據並撰寫報告中...');
        
        const today = new Date();
        const dateContext = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

        try {
            const systemPrompt = `你是一位買方(Buy-Side)專業台股投資經理人。今天是 ${dateContext}。
你的目標只有一個：幫助基金做出最有利於回報的正確決策，無論決策多麼逆勢。這是一份「內部的決策工具」。
請務必使用 Google 搜尋獲取指定台股標的「台灣股市(TWSE/TPEX)」最新、最即時的資訊。
🚨【極度重要】：股價、單日漲跌幅、本益比、市值必須是「台灣本地股市（台股）」的最新數據，絕對不可使用美股 ADR 或海外掛牌的價格。請搜尋「Yahoo 股市 [股票代號]」或「[股票代號] 台灣證券交易所 即時股價」來確保報價正確。
根據這些即時資訊，輸出符合所提供 JSON schema 的深度分析報告。
嚴格遵守以下規則：
1. 評等(rating)只能從以下選擇："Buy" (買入/跑贏大盤), "Hold" (持有/與大盤一致), "Sell" (賣出/跑輸大盤)。
2. 買方觀點對決：主動尋找市場多空觀點進行交叉驗證。必須提供「看多觀點(理由1,2,3)」與「看空觀點(理由X,Y,Z)」的思辨過程。找出分析師為什麼對同樣數據有不同解讀。
3. 獨立決策：在吸收消化正反觀點後，給出經理人的「核心判斷」(例如：市場忽略了某因素，我決定站在某一方)。
4. 新聞(news)請提供 5 到 10 則，影響力(impact)請填寫 "High", "Medium", 或 "Low"。新聞來源必須嚴格限制為「中央社財經新聞」與「鉅亨網」，且【新聞發布時間必須限制在近三個月內】。
5. 股價與漲幅請直接提供數值，請絕對不要加上貨幣單位（如 TWD）。
6. 目標價(targetPrice)請給出一個明確的「單一數值」，絕對不要給區間。
7. 請提供該股的類股、產業、概念標籤(tags)，例如：#半導體業、#SEMI矽光子。
8. 包含技術分析：支撐壓力線、短中長期均線、K線、KD指標(判斷超買超賣及交叉)、MACD、布林通道(開口及上下軌)、乖離率(正負乖離)及技術面總結。
9. 回傳代號時，務必包含股票代碼以及交易市場後綴 (上市為 .TW，上櫃為 .TWO)。
10. 必須提供近30個交易日的「真實歷史OHLC K線資料」(klineData)，做為繪製圖表使用，按照日期由舊到新排列。`;

            const userQuery = `請分析這檔台灣股市標的：${input}。請務必優先搜尋「${input} Yahoo 股市 最新股價」，取得台灣時間今天的最新「台股」現價，並嚴格篩選「近三個月內」的新聞。`;

            const payload = {
                contents: [{ parts: [{ text: userQuery }] }],
                tools: [{ google_search: {} }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            ticker: { type: "STRING" }, tags: { type: "ARRAY", items: { type: "STRING" } }, currentPrice: { type: "STRING" },
                            priceChange: { type: "STRING" }, peRatio: { type: "STRING" }, marketCap: { type: "STRING" },
                            rating: { type: "STRING", enum: ["Buy", "Hold", "Sell"] },
                            buySide: { type: "OBJECT", properties: { bullish: { type: "STRING" }, bearish: { type: "STRING" }, judgment: { type: "STRING" } } },
                            targetPrice: { type: "STRING" },
                            valRelative: { type: "OBJECT", properties: { algorithm: { type: "STRING" }, logic: { type: "STRING" }, pros: { type: "STRING" }, cons: { type: "STRING" } } },
                            valAbsolute: { type: "OBJECT", properties: { algorithm: { type: "STRING" }, logic: { type: "STRING" }, pros: { type: "STRING" }, cons: { type: "STRING" } } },
                            factors: { type: "OBJECT", properties: { macro: { type: "STRING" }, capital: { type: "STRING" }, industry: { type: "STRING" }, company: { type: "STRING" } } },
                            technicalAnalysis: { type: "OBJECT", properties: { supportResistance: { type: "STRING" }, movingAverages: { type: "STRING" }, kLine: { type: "STRING" }, kd: { type: "STRING" }, macd: { type: "STRING" }, bollinger: { type: "STRING" }, bias: { type: "STRING" }, summary: { type: "STRING" } } },
                            klineData: { type: "ARRAY", items: { type: "OBJECT", properties: { date: { type: "STRING" }, open: { type: "NUMBER" }, high: { type: "NUMBER" }, low: { type: "NUMBER" }, close: { type: "NUMBER" } }, required: ["date", "open", "high", "low", "close"] } },
                            news: { type: "ARRAY", items: { type: "OBJECT", properties: { title: { type: "STRING" }, source: { type: "STRING" }, url: { type: "STRING" }, impact: { type: "STRING", enum: ["High", "Medium", "Low"] }, analysis: { type: "STRING" } } } },
                            summary: { type: "STRING" }
                        },
                        required: ["ticker", "tags", "currentPrice", "rating", "buySide", "targetPrice", "valRelative", "valAbsolute", "factors", "technicalAnalysis", "klineData", "news", "summary"]
                    }
                }
            };

            const apiUrl = '/api/gemini';
            
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API 請求失敗，狀態碼: ${response.status}`);
            }
            
            const result = await response.json();
            const data = JSON.parse(result.candidates[0].content.parts[0].text);

            if (data.news) {
                data.news.sort((a, b) => {
                    const getW = (imp) => {
                        const s = String(imp || '').toUpperCase();
                        if (s.includes('HIGH') || s.includes('高')) return 3;
                        if (s.includes('MED') || s.includes('中')) return 2;
                        return 1;
                    };
                    return getW(b.impact) - getW(a.impact);
                });
            }

            let codeMatch = data.ticker.match(/\d{4,}/) || input.match(/\d{4,}/);
            if (codeMatch) {
                const upperTicker = data.ticker.toUpperCase();
                setCurrentChartSymbol(upperTicker.includes('.TWO') || upperTicker.includes('TPEX') || upperTicker.includes('上櫃') ? `TPEX:${codeMatch[0]}` : `TWSE:${codeMatch[0]}`);
            }

            setReportData(data);
            setActiveTab('fundamental');
        } catch (err) {
            console.error('Error generating report:', err);
            setError(`生成失敗：${err.message}。請確認 API Key 是否正確。`);
        } finally {
            setLoading(false);
        }
    };

    const executeCalc = async () => {
        const val = parseInt(itemPrice);
        if (isNaN(val) || val <= 0) {
            setError('請輸入大於 0 的有效金額。');
            return;
        }

        setLoading(true);
        setError('');
        setCalcData(null);
        setLoadingText(`正在擷取 ${benchmarkTarget} 最新報價與精算預期報酬...`);

        try {
            const targetFullName = benchmarkTarget === '0050' ? '元大台灣50 (0050.TW)' : '台積電 (2330.TW)';
            const targetShortName = benchmarkTarget === '0050' ? '0050' : '台積電';
            
            const systemPrompt = `你是一個台灣股市資料擷取與精算機器人。
請搜尋「台灣股市 ${benchmarkTarget} 最新股價」，獲取「${targetFullName}」最新的台幣現價。
同時，基於 ${benchmarkTarget} 過去 10 年的歷史含息報酬數據，評估目前合理的：
1. 3 個月（季）預估含息報酬率 (百分比數值，例如 2.5)
2. 1 年預估含息報酬率 (百分比數值，例如 9.8)
嚴格以 JSON 格式回傳。`;

            const payload = {
                contents: [{ parts: [{ text: `查詢 ${benchmarkTarget} 最新價格與合理預期報酬` }] }],
                tools: [{ google_search: {} }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: { price: { type: "NUMBER" }, rate3M: { type: "NUMBER" }, rate1Y: { type: "NUMBER" } },
                        required: ["price", "rate3M", "rate1Y"]
                    }
                }
            };

            const apiUrl = '/api/gemini';
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API 請求失敗，狀態碼: ${response.status}`);
            }
            
            const result = await response.json();
            const data = JSON.parse(result.candidates[0].content.parts[0].text);

            const p0050 = data.price;
            const r3m = data.rate3M / 100;
            const r1y = data.rate1Y / 100;
            const totalShares = val / p0050;

            setCalcData({
                timestamp: new Date().toLocaleString('zh-TW'),
                targetFullName, targetShortName, basePrice: val,
                p0050, rate3M: data.rate3M, rate1Y: data.rate1Y,
                totalShares,
                lots: Math.floor(totalShares / 1000),
                oddShares: Math.floor(totalShares % 1000),
                val3m: val * (1 + r3m),
                val1y: val * (1 + r1y),
                profit3m: (val * (1 + r3m)) - val,
                profit1y: (val * (1 + r1y)) - val
            });
        } catch (err) {
            console.error('Error in calc:', err);
            setError(`無法取得最新報價：${err.message}。請確認 API Key 填寫正確。`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center py-10 px-4 md:px-8">
            <style>{`
                body {
                    background-color: #f0f0ed;
                    color: #4a4a4a;
                    font-family: 'Inter', sans-serif;
                }
                .glass-panel {
                    background: rgba(255, 255, 255, 0.9);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(184, 184, 176, 0.3);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
                }
                .loader {
                    border-top-color: #A2B4C0;
                    -webkit-animation: spinner 1.5s linear infinite;
                    animation: spinner 1.5s linear infinite;
                }
                @keyframes spinner {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                ::-webkit-scrollbar { width: 8px; }
                ::-webkit-scrollbar-track { background: #f0f0ed; }
                ::-webkit-scrollbar-thumb { background: #B8B8B0; border-radius: 4px; }
                ::-webkit-scrollbar-thumb:hover { background: #8e8e8e; }
        `}</style>

        {}
        <header className="w-full max-w-6xl mb-8 text-center mt-4">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 text-[#B8B8B0] transition-colors">
                {appMode === 'analyst' ? (
                    <><i className="fa-solid fa-chart-line mr-2 text-[#A2B4C0]"></i>海涵路分析師系統</>
                    ) : (
                        <><i className="fa-solid fa-scale-unbalanced-flip mr-2 text-[#A2B4C0]"></i>海涵路價值換算器</>
                    )}
                </h1>

                <div className="flex justify-center mb-8">
                    <div className="bg-white/60 p-1.5 rounded-full inline-flex border border-[#B8B8B0]/30 shadow-sm backdrop-blur-sm relative z-20">
                        <button onClick={() => {setAppMode('analyst'); setError('');}} className={`px-6 py-2 rounded-full font-bold text-sm transition-all flex items-center ${appMode === 'analyst' ? 'bg-[#A2B4C0] text-white shadow-sm' : 'text-[#8e8e8e] hover:text-[#4a4a4a]'}`}>
                            <i className="fa-solid fa-magnifying-glass-chart mr-2"></i>深度分析
                        </button>
                        <button onClick={() => {setAppMode('calc'); setError('');}} className={`px-6 py-2 rounded-full font-bold text-sm transition-all flex items-center ${appMode === 'calc' ? 'bg-[#A2B4C0] text-white shadow-sm' : 'text-[#8e8e8e] hover:text-[#4a4a4a]'}`}>
                            <i className="fa-solid fa-scale-unbalanced-flip mr-2"></i>價值換算
                        </button>
                    </div>
                </div>

                {}
                {appMode === 'analyst' ? (
                    <div className="max-w-2xl mx-auto relative group flex">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <i className="fa-solid fa-magnifying-glass text-[#8e8e8e] group-focus-within:text-[#A2B4C0] transition-colors"></i>
                        </div>
                        <input type="text" value={tickerInput} onChange={(e) => setTickerInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && generateReport()}
                            className="w-full bg-white border border-[#B8B8B0] text-[#4a4a4a] rounded-full py-3 md:py-4 pl-10 md:pl-12 pr-16 md:pr-32 focus:outline-none focus:border-[#A2B4C0] focus:ring-2 focus:ring-[#A2B4C0]/30 transition-all text-base md:text-lg shadow-sm placeholder:text-[#8e8e8e]"
                            placeholder="輸入股票代號或名稱..." />
                        <button onClick={generateReport} disabled={loading}
                            className="absolute right-2 top-2 bottom-2 bg-[#A2B4C0] hover:bg-[#8fa1ae] text-white font-semibold rounded-full w-10 md:w-auto md:px-6 transition-all shadow-sm transform hover:scale-105 flex items-center justify-center disabled:opacity-50">
                            {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <><span className="hidden md:inline">生成報告</span><i className="fa-solid fa-paper-plane md:hidden"></i></>}
                        </button>
                    </div>
                ) : (
                    <div className="max-w-3xl mx-auto flex flex-col md:flex-row gap-4 justify-center items-center">
                        <div className="relative w-full md:w-1/3">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><i className="fa-solid fa-bullseye text-[#8e8e8e]"></i></div>
                            <select value={benchmarkTarget} onChange={(e) => setBenchmarkTarget(e.target.value)} className="w-full bg-white border border-[#B8B8B0] text-[#4a4a4a] rounded-2xl py-3.5 md:py-4 pl-12 pr-10 focus:outline-none focus:border-[#A2B4C0] focus:ring-2 focus:ring-[#A2B4C0]/30 transition-all text-base md:text-lg shadow-sm appearance-none font-bold">
                                <option value="0050">0050 (元大台灣50)</option>
                                <option value="2330">2330 (台積電)</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none"><i className="fa-solid fa-chevron-down text-[#8e8e8e]"></i></div>
                        </div>
                        <div className="relative w-full md:w-1/3">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><span className="text-[#8e8e8e] font-bold">$</span></div>
                            <input type="number" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && executeCalc()}
                                className="w-full bg-white border border-[#B8B8B0] text-[#4a4a4a] rounded-2xl py-3.5 md:py-4 pl-10 pr-4 focus:outline-none focus:border-[#A2B4C0] focus:ring-2 focus:ring-[#A2B4C0]/30 transition-all text-base md:text-lg shadow-sm placeholder:text-[#8e8e8e] font-mono"
                                placeholder="輸入欲花費的金額" />
                        </div>
                        <button onClick={executeCalc} disabled={loading}
                            className="w-full md:w-auto bg-[#A2B4C0] hover:bg-[#8fa1ae] text-white font-bold rounded-2xl py-3.5 md:py-4 px-8 transition-all shadow-md transform hover:scale-105 flex items-center justify-center whitespace-nowrap disabled:opacity-50">
                            {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-calculator mr-2"></i>開始換算</>}
                        </button>
                    </div>
                )}
            </header>

            {}
            {loading && (
                <div className="flex flex-col items-center justify-center my-20">
                    <div className="loader ease-linear rounded-full border-4 border-[#B8B8B0]/30 h-16 w-16 mb-4"></div>
                    <p className="text-[#A2B4C0] font-semibold animate-pulse tracking-widest uppercase text-sm">
                        <i className="fa-solid fa-satellite-dish mr-2"></i>{loadingText}
                    </p>
                </div>
            )}

            {error && (
                <div className="w-full max-w-6xl bg-[#C9A4A0]/20 border border-[#C9A4A0] text-[#4a4a4a] p-6 rounded-2xl mb-8 shadow-sm flex items-start">
                    <i className="fa-solid fa-triangle-exclamation text-2xl mr-4 mt-1 text-[#C9A4A0]"></i>
                    <div>
                        <h3 className="font-bold text-lg mb-1">發生錯誤</h3>
                        <p>{error}</p>
                    </div>
                </div>
            )}

            {}
            {reportData && appMode === 'analyst' && !loading && !error && (
                <main id="reportContainer" className="w-full max-w-6xl flex flex-col gap-6">
                    <div className="flex justify-end w-full mb-2">
                        {!isExporting && (
                            <button id="export-btn" onClick={exportPDF} className="bg-white border border-[#B8B8B0] text-[#4a4a4a] hover:bg-[#B8B8B0]/10 px-4 py-2 rounded-lg shadow-sm transition-colors flex items-center text-sm font-semibold">
                                <i className="fa-solid fa-file-pdf text-[#C9A4A0] mr-2"></i>匯出 PDF
                            </button>
                        )}
                    </div>

                    <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <div className="flex items-center gap-4 mb-2 flex-wrap">
                                <h2 className="text-3xl md:text-4xl font-bold text-[#4a4a4a]">{reportData.ticker}</h2>
                                {(() => {
                                    const rt = reportData.rating.toUpperCase();
                                    if (rt.includes('BUY')) return <div className="px-6 py-2 rounded-xl border-2 font-bold text-lg md:text-xl bg-[#A3B5A6]/10 text-[#A3B5A6] border-[#A3B5A6] shadow-sm whitespace-nowrap">買入 / 強力買入 (Buy / Strong Buy)</div>;
                                    if (rt.includes('SELL') || rt.includes('UNDER')) return <div className="px-6 py-2 rounded-xl border-2 font-bold text-lg md:text-xl bg-[#C9A4A0]/10 text-[#C9A4A0] border-[#C9A4A0] shadow-sm whitespace-nowrap">賣出 / 表現不佳 (Sell / Underperform)</div>;
                                    return <div className="px-6 py-2 rounded-xl border-2 font-bold text-lg md:text-xl bg-[#A2B4C0]/10 text-[#A2B4C0] border-[#A2B4C0] shadow-sm whitespace-nowrap">持有 / 中性 (Hold / Neutral)</div>;
                                })()}
                            </div>
                            <div className="flex items-baseline gap-4 mt-2">
                                <span className="text-5xl md:text-6xl font-mono font-bold text-[#4a4a4a]">{reportData.currentPrice}</span>
                                <span className={`text-2xl font-mono font-semibold ${reportData.priceChange.includes('+') ? 'text-[#C9A4A0]' : reportData.priceChange.includes('-') ? 'text-[#A3B5A6]' : 'text-[#8e8e8e]'}`}>{reportData.priceChange}</span>
                            </div>
                            <div className="flex flex-wrap justify-start gap-2 mt-4 relative z-10">
                                {reportData.tags?.map((tag, idx) => <span key={idx} className="px-2 py-1 bg-[#B8B8B0]/10 text-[#4a4a4a] text-xs rounded-lg border border-[#B8B8B0]/30 font-semibold shadow-sm">{tag}</span>)}
                            </div>
                        </div>
                        <div className="flex flex-col gap-4 border-t md:border-t-0 md:border-l border-[#B8B8B0]/30 pt-4 md:pt-0 md:pl-8 min-w-[200px] w-full md:w-auto">
                            <div className="flex justify-between items-center md:flex-col md:items-start md:justify-center"><span className="text-[#8e8e8e] text-sm block mb-1">市值</span><span className="text-base font-mono text-[#4a4a4a] font-semibold">{reportData.marketCap || '---'}</span></div>
                            <div className="flex justify-between items-center md:flex-col md:items-start md:justify-center"><span className="text-[#8e8e8e] text-sm block mb-1">預估本益比 (P/E)</span><span className="text-base font-mono text-[#4a4a4a] font-semibold">{reportData.peRatio || '---'}</span></div>
                            <div className="flex justify-between items-center md:flex-col md:items-start md:justify-center"><span className="text-[#8e8e8e] text-sm block mb-1">目標價</span><span className="text-2xl font-mono text-[#A2B4C0] font-bold">{reportData.targetPrice}</span></div>
                        </div>
                    </div>

                    <div className="flex border-b border-[#B8B8B0]/30 mt-2 mb-2 w-full">
                        <button onClick={() => handleTabSwitch('fundamental')} className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors ${activeTab === 'fundamental' ? 'border-[#A2B4C0] text-[#A2B4C0]' : 'border-transparent text-[#8e8e8e] hover:text-[#4a4a4a] hover:bg-[#B8B8B0]/10'}`}>
                            <i className="fa-solid fa-file-invoice-dollar mr-2"></i>分析師觀點
                        </button>
                        <button onClick={() => handleTabSwitch('technical')} className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors ${activeTab === 'technical' ? 'border-[#A2B4C0] text-[#A2B4C0]' : 'border-transparent text-[#8e8e8e] hover:text-[#4a4a4a] hover:bg-[#B8B8B0]/10'}`}>
                            <i className="fa-solid fa-chart-pie mr-2"></i>技術分析 <i className={`fa-solid ml-1 text-xs ${isTechUnlocked ? 'fa-lock-open' : 'fa-lock'}`}></i>
                        </button>
                    </div>

                    {}
                    <div className={activeTab === 'fundamental' || isExporting ? "flex flex-col gap-6 w-full" : "hidden"}>
                        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden">
                            <div className="flex justify-between items-center mb-4 relative z-10">
                                <h3 className="text-[#8e8e8e] text-sm uppercase tracking-wider font-semibold flex items-center"><i className="fa-solid fa-scale-unbalanced text-[#A2B4C0] mr-2"></i>BUY-SIDE</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10 mb-4">
                                <div className="bg-[#A3B5A6]/10 border border-[#A3B5A6]/30 p-4 rounded-xl flex flex-col">
                                    <h4 className="text-[#A3B5A6] font-bold text-sm mb-2 flex items-center"><i className="fa-solid fa-arrow-trend-up mr-2"></i>看多觀點</h4>
                                    <p dangerouslySetInnerHTML={{__html: formatText(reportData.buySide.bullish)}} className="text-sm text-[#4a4a4a] leading-relaxed flex-grow"></p>
                                </div>
                                <div className="bg-[#C9A4A0]/10 border border-[#C9A4A0]/30 p-4 rounded-xl flex flex-col">
                                    <h4 className="text-[#C9A4A0] font-bold text-sm mb-2 flex items-center"><i className="fa-solid fa-arrow-trend-down mr-2"></i>看空觀點</h4>
                                    <p dangerouslySetInnerHTML={{__html: formatText(reportData.buySide.bearish)}} className="text-sm text-[#4a4a4a] leading-relaxed flex-grow"></p>
                                </div>
                            </div>
                            <div className="bg-[#B8B8B0]/10 border-l-4 border-[#A2B4C0] p-4 rounded-r-xl relative z-10 mt-auto">
                                <h4 className="text-[#A2B4C0] font-bold text-sm mb-1 flex items-center"><i className="fa-solid fa-gavel mr-2"></i>經理人核心判斷</h4>
                                <p dangerouslySetInnerHTML={{__html: formatText(reportData.buySide.judgment)}} className="text-sm text-[#4a4a4a] leading-relaxed font-medium"></p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="glass-panel p-6 rounded-2xl relative">
                                <div className="absolute top-0 right-0 bg-[#A2B4C0]/10 text-[#A2B4C0] text-xs px-3 py-1 rounded-bl-lg rounded-tr-xl font-mono border-b border-l border-[#A2B4C0]/20">Model: Relative</div>
                                <h3 className="text-xl font-bold text-[#4a4a4a] mb-4 flex items-center"><i className="fa-solid fa-scale-balanced text-[#A2B4C0] mr-2"></i>相對估值法</h3>
                                <div className="space-y-4">
                                    <div><h4 className="text-xs text-[#8e8e8e] uppercase tracking-wider mb-1">算法</h4><p dangerouslySetInnerHTML={{__html: formatText(reportData.valRelative.algorithm)}} className="text-sm text-[#4a4a4a] bg-[#B8B8B0]/10 p-3 rounded-lg border border-[#B8B8B0]/30"></p></div>
                                    <div><h4 className="text-xs text-[#8e8e8e] uppercase tracking-wider mb-1">邏輯</h4><p dangerouslySetInnerHTML={{__html: formatText(reportData.valRelative.logic)}} className="text-sm text-[#4a4a4a]"></p></div>
                                    <div className="grid grid-cols-2 gap-4 mt-2">
                                        <div><h4 className="text-xs text-[#8e8e8e] uppercase tracking-wider mb-1">優點</h4><p dangerouslySetInnerHTML={{__html: formatText(reportData.valRelative.pros)}} className="text-sm text-[#4a4a4a] border-l-2 border-[#A3B5A6] pl-3 italic"></p></div>
                                        <div><h4 className="text-xs text-[#8e8e8e] uppercase tracking-wider mb-1">缺點</h4><p dangerouslySetInnerHTML={{__html: formatText(reportData.valRelative.cons)}} className="text-sm text-[#4a4a4a] border-l-2 border-[#C9A4A0] pl-3 italic"></p></div>
                                    </div>
                                </div>
                            </div>
                            <div className="glass-panel p-6 rounded-2xl relative">
                                <div className="absolute top-0 right-0 bg-[#A3B5A6]/10 text-[#A3B5A6] text-xs px-3 py-1 rounded-bl-lg rounded-tr-xl font-mono border-b border-l border-[#A3B5A6]/20">Model: DCF</div>
                                <h3 className="text-xl font-bold text-[#4a4a4a] mb-4 flex items-center"><i className="fa-solid fa-money-bill-trend-up text-[#A3B5A6] mr-2"></i>絕對估值法</h3>
                                <div className="space-y-4">
                                    <div><h4 className="text-xs text-[#8e8e8e] uppercase tracking-wider mb-1">算法</h4><p dangerouslySetInnerHTML={{__html: formatText(reportData.valAbsolute.algorithm)}} className="text-sm text-[#4a4a4a] bg-[#B8B8B0]/10 p-3 rounded-lg border border-[#B8B8B0]/30"></p></div>
                                    <div><h4 className="text-xs text-[#8e8e8e] uppercase tracking-wider mb-1">邏輯</h4><p dangerouslySetInnerHTML={{__html: formatText(reportData.valAbsolute.logic)}} className="text-sm text-[#4a4a4a]"></p></div>
                                    <div className="grid grid-cols-2 gap-4 mt-2">
                                        <div><h4 className="text-xs text-[#8e8e8e] uppercase tracking-wider mb-1">優點</h4><p dangerouslySetInnerHTML={{__html: formatText(reportData.valAbsolute.pros)}} className="text-sm text-[#4a4a4a] border-l-2 border-[#A3B5A6] pl-3 italic"></p></div>
                                        <div><h4 className="text-xs text-[#8e8e8e] uppercase tracking-wider mb-1">缺點</h4><p dangerouslySetInnerHTML={{__html: formatText(reportData.valAbsolute.cons)}} className="text-sm text-[#4a4a4a] border-l-2 border-[#C9A4A0] pl-3 italic"></p></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="glass-panel p-6 rounded-2xl">
                            <h3 className="text-xl font-bold text-[#4a4a4a] mb-4 flex items-center"><i className="fa-solid fa-layer-group text-[#B8B8B0] mr-2"></i>其他影響因子</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-[#B8B8B0]/10 p-4 rounded-xl border border-[#B8B8B0]/30"><h4 className="text-[#4a4a4a] font-semibold mb-2"><i className="fa-solid fa-globe mr-2 text-[#B8B8B0]"></i>宏觀經濟</h4><p dangerouslySetInnerHTML={{__html: formatText(reportData.factors.macro)}} className="text-sm text-[#4a4a4a]"></p></div>
                                <div className="bg-[#B8B8B0]/10 p-4 rounded-xl border border-[#B8B8B0]/30"><h4 className="text-[#4a4a4a] font-semibold mb-2"><i className="fa-solid fa-building-columns mr-2 text-[#B8B8B0]"></i>資本市場</h4><p dangerouslySetInnerHTML={{__html: formatText(reportData.factors.capital)}} className="text-sm text-[#4a4a4a]"></p></div>
                                <div className="bg-[#B8B8B0]/10 p-4 rounded-xl border border-[#B8B8B0]/30"><h4 className="text-[#4a4a4a] font-semibold mb-2"><i className="fa-solid fa-industry mr-2 text-[#B8B8B0]"></i>產業展望</h4><p dangerouslySetInnerHTML={{__html: formatText(reportData.factors.industry)}} className="text-sm text-[#4a4a4a]"></p></div>
                                <div className="bg-[#B8B8B0]/10 p-4 rounded-xl border border-[#B8B8B0]/30"><h4 className="text-[#4a4a4a] font-semibold mb-2"><i className="fa-solid fa-building mr-2 text-[#B8B8B0]"></i>公司評估</h4><p dangerouslySetInnerHTML={{__html: formatText(reportData.factors.company)}} className="text-sm text-[#4a4a4a]"></p></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="glass-panel p-6 rounded-2xl lg:col-span-2">
                                <h3 className="text-xl font-bold text-[#4a4a4a] mb-4 flex items-center"><i className="fa-regular fa-newspaper text-[#B8B8B0] mr-2"></i>近期催化劑 (Catalysts)</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead><tr className="text-[#8e8e8e] text-sm border-b border-[#B8B8B0]/30"><th className="pb-3 font-medium">影響力</th><th className="pb-3 font-medium">新聞標題 (來源)</th><th className="pb-3 font-medium">分析師解讀</th></tr></thead>
                                        <tbody className="text-sm">
                                            {reportData.news?.map((n, i) => (
                                                <tr key={i} className="border-b border-[#B8B8B0]/20 hover:bg-[#B8B8B0]/10 transition-colors">
                                                    <td className="py-4 pr-4 whitespace-nowrap"><ImpactIcons impact={n.impact} /></td>
                                                    <td className="py-4 pr-4"><a href={`https://www.google.com/search?q=${encodeURIComponent(n.title + ' ' + n.source)}`} target="_blank" rel="noreferrer" className="font-semibold text-[#A2B4C0] hover:text-[#8fa1ae] hover:underline mb-1 block transition-colors">{n.title}</a><div className="text-xs text-[#8e8e8e]"><i className="fa-solid fa-link mr-1"></i>{n.source}</div></td>
                                                    <td className="py-4 text-[#4a4a4a]" dangerouslySetInnerHTML={{__html: formatText(n.analysis)}}></td>
                                                </tr>
                                            ))}
                                            {(!reportData.news || reportData.news.length === 0) && <tr><td colSpan="3" className="py-4 text-center text-[#8e8e8e]">暫無近期重大新聞分析</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="glass-panel p-6 rounded-2xl bg-gradient-to-br from-white to-[#B8B8B0]/10 border-[#B8B8B0]/40">
                                <h3 className="text-xl font-bold text-[#4a4a4a] mb-4 flex items-center"><i className="fa-solid fa-user-tie text-[#A2B4C0] mr-2"></i>經理人總結</h3>
                                <div className="text-[#4a4a4a] leading-relaxed space-y-3" dangerouslySetInnerHTML={{__html: `<p>${formatText(reportData.summary).replace(/\n/g, '</p><p className="mt-2">')}</p>`}}></div>
                            </div>
                        </div>
                    </div>

                    {}
                    <div className={activeTab === 'technical' || (isExporting && isTechUnlocked) ? "flex flex-col gap-6 w-full" : "hidden"}>
                        <div className="glass-panel p-6 rounded-2xl">
                            <div className="mb-6 border-b border-[#B8B8B0]/20 pb-4"><h3 className="text-2xl font-bold text-[#4a4a4a]">技術分析</h3></div>
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-3 gap-3">
                                <h4 className="text-[#4a4a4a] font-bold text-lg flex items-center"><i className="fa-solid fa-chart-candlestick text-[#A2B4C0] mr-2"></i>即時動態 K 線</h4>
                                <a href={`https://tw.stock.yahoo.com/quote/${currentChartSymbol.split(':')[1]}/technical-analysis`} target="_blank" rel="noreferrer" className="text-sm bg-white border-2 border-[#6001d2]/20 text-[#6001d2] hover:bg-[#6001d2] hover:text-white px-4 py-2 rounded-lg transition-all shadow-sm flex items-center font-bold"><i className="fa-solid fa-arrow-up-right-from-square mr-2"></i>前往 Yahoo 股市看圖</a>
                            </div>
                            <div ref={lwContainerRef} className="w-full h-[450px] mb-6 rounded-xl overflow-hidden border border-[#B8B8B0]/30 bg-white shadow-inner relative"></div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                                <div className="bg-[#B8B8B0]/10 p-5 rounded-xl border border-[#B8B8B0]/30"><h4 className="text-[#4a4a4a] font-bold text-lg mb-3">支撐與壓力線</h4><p dangerouslySetInnerHTML={{__html: formatText(reportData.technicalAnalysis.supportResistance)}} className="text-sm text-[#4a4a4a] leading-relaxed"></p></div>
                                <div className="bg-[#B8B8B0]/10 p-5 rounded-xl border border-[#B8B8B0]/30"><h4 className="text-[#4a4a4a] font-bold text-lg mb-3">移動平均線 (MA)</h4><p dangerouslySetInnerHTML={{__html: formatText(reportData.technicalAnalysis.movingAverages)}} className="text-sm text-[#4a4a4a] leading-relaxed"></p></div>
                                <div className="bg-[#B8B8B0]/10 p-5 rounded-xl border border-[#B8B8B0]/30"><h4 className="text-[#4a4a4a] font-bold text-lg mb-3">K線型態</h4><p dangerouslySetInnerHTML={{__html: formatText(reportData.technicalAnalysis.kLine)}} className="text-sm text-[#4a4a4a] leading-relaxed"></p></div>
                                <div className="bg-[#B8B8B0]/10 p-5 rounded-xl border border-[#B8B8B0]/30"><h4 className="text-[#4a4a4a] font-bold text-lg mb-3">KD 指標</h4><p dangerouslySetInnerHTML={{__html: formatText(reportData.technicalAnalysis.kd)}} className="text-sm text-[#4a4a4a] leading-relaxed"></p></div>
                                <div className="bg-[#B8B8B0]/10 p-5 rounded-xl border border-[#B8B8B0]/30"><h4 className="text-[#4a4a4a] font-bold text-lg mb-3">MACD</h4><p dangerouslySetInnerHTML={{__html: formatText(reportData.technicalAnalysis.macd)}} className="text-sm text-[#4a4a4a] leading-relaxed"></p></div>
                                <div className="bg-[#B8B8B0]/10 p-5 rounded-xl border border-[#B8B8B0]/30"><h4 className="text-[#4a4a4a] font-bold text-lg mb-3">布林通道</h4><p dangerouslySetInnerHTML={{__html: formatText(reportData.technicalAnalysis.bollinger)}} className="text-sm text-[#4a4a4a] leading-relaxed"></p></div>
                                <div className="bg-[#B8B8B0]/10 p-5 rounded-xl border border-[#B8B8B0]/30 md:col-span-2 lg:col-span-3"><h4 className="text-[#4a4a4a] font-bold text-lg mb-3">乖離率 (BIAS)</h4><p dangerouslySetInnerHTML={{__html: formatText(reportData.technicalAnalysis.bias)}} className="text-sm text-[#4a4a4a] leading-relaxed"></p></div>
                            </div>
                            <div className="bg-gradient-to-r from-[#A2B4C0]/20 to-[#B8B8B0]/10 p-5 rounded-xl border border-[#A2B4C0]/30 relative overflow-hidden">
                                <div className="absolute -right-4 -bottom-4 opacity-10"><i className="fa-solid fa-microchip text-8xl"></i></div>
                                <h4 className="text-[#A2B4C0] font-bold text-lg mb-3 relative z-10">技術分析總結</h4>
                                <p dangerouslySetInnerHTML={{__html: formatText(reportData.technicalAnalysis.summary)}} className="text-sm text-[#4a4a4a] leading-relaxed relative z-10 font-medium"></p>
                            </div>
                        </div>
                    </div>
                </main>
            )}

            {}
            {calcData && appMode === 'calc' && !loading && !error && (
                <section className="w-full max-w-5xl flex flex-col gap-8 mx-auto">
                    <div className="glass-panel p-6 rounded-3xl flex justify-between items-center border-t-4 border-t-[#A2B4C0]">
                        <div className="flex items-center gap-4">
                            <div className="bg-[#B8B8B0]/10 p-3 rounded-xl border border-[#B8B8B0]/20"><i className="fa-solid fa-chart-pie text-3xl text-[#A2B4C0]"></i></div>
                            <div><h2 className="text-lg font-bold text-[#4a4a4a]">{calcData.targetFullName} 最新現價</h2><p className="text-xs text-[#8e8e8e] mt-1">更新時間: {calcData.timestamp}</p></div>
                        </div>
                        <div className="text-right">
                            <span className="text-4xl font-mono font-bold text-[#4a4a4a] tracking-tight">{calcData.p0050.toFixed(2)}</span>
                            <span className="text-[#8e8e8e] text-sm ml-1">TWD / 股</span>
                        </div>
                    </div>

                    <div className="glass-panel p-8 md:p-12 rounded-3xl text-center relative overflow-hidden bg-gradient-to-b from-white to-[#B8B8B0]/5">
                        <h3 className="text-xl md:text-2xl text-[#4a4a4a] font-medium mb-6 relative z-10">您打算花費的 <span className="font-mono font-bold text-[#C9A4A0]">{formatMoney(calcData.basePrice)}</span> 元<br className="hidden md:block"/>相當於可以買進：</h3>
                        <div className="flex flex-col md:flex-row justify-center items-end gap-2 md:gap-4 mb-4 relative z-10">
                            <span className="text-6xl md:text-8xl font-mono font-bold text-[#A2B4C0] tracking-tighter drop-shadow-sm">{calcData.totalShares.toFixed(2)}</span>
                            <span className="text-2xl md:text-3xl font-bold text-[#8e8e8e] pb-2">股 <span>{calcData.targetShortName}</span></span>
                        </div>
                        <p className="text-sm text-[#8e8e8e] relative z-10">(= {calcData.lots} 張 + {calcData.oddShares} 股零股)</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="glass-panel p-6 rounded-3xl border border-[#B8B8B0]/30 hover:shadow-md transition-shadow relative">
                            <div className="absolute top-0 right-0 bg-[#B8B8B0]/10 text-[#4a4a4a] text-xs px-4 py-1.5 rounded-bl-xl rounded-tr-3xl font-bold border-b border-l border-[#B8B8B0]/20"><i className="fa-regular fa-clock mr-1"></i>3 個月後</div>
                            <h4 className="text-lg font-bold text-[#4a4a4a] mb-4 mt-2">預期短期增值</h4>
                            <div className="bg-white rounded-2xl p-4 border border-[#B8B8B0]/20">
                                <div className="flex justify-between items-center mb-2"><span className="text-sm text-[#8e8e8e]">預估含息報酬率</span><span className="text-base font-mono font-bold text-[#A3B5A6] bg-[#A3B5A6]/10 px-2 py-1 rounded">{calcData.rate3M.toFixed(2)}%</span></div>
                                <div className="w-full bg-[#B8B8B0]/20 rounded-full h-1.5 mb-6"><div className="bg-[#A3B5A6] h-1.5 rounded-full" style={{width: '25%'}}></div></div>
                                <div className="flex flex-col gap-1"><span className="text-xs text-[#8e8e8e] uppercase tracking-wider">預估本利和</span><div className="flex items-baseline gap-2"><span className="text-sm text-[#8e8e8e]">$</span><span className="text-3xl font-mono font-bold text-[#4a4a4a]">{formatMoney(calcData.val3m)}</span><span className="text-sm font-bold text-[#A3B5A6]">(+{formatMoney(calcData.profit3m)})</span></div></div>
                            </div>
                            <p className="text-xs text-[#8e8e8e] mt-4 text-center">短線股市波動大，此為基於歷史滾動之預期平均值。</p>
                        </div>
                        <div className="glass-panel p-6 rounded-3xl border-2 border-[#A3B5A6]/20 bg-gradient-to-br from-white to-[#A3B5A6]/5 hover:shadow-md transition-shadow relative">
                            <div className="absolute top-0 right-0 bg-[#A3B5A6]/20 text-[#A3B5A6] text-xs px-4 py-1.5 rounded-bl-xl rounded-tr-3xl font-bold border-b border-l border-[#A3B5A6]/20"><i className="fa-solid fa-calendar-check mr-1"></i>1 年後</div>
                            <h4 className="text-lg font-bold text-[#4a4a4a] mb-4 mt-2">預期長期增值</h4>
                            <div className="bg-white rounded-2xl p-4 border border-[#A3B5A6]/20 shadow-sm">
                                <div className="flex justify-between items-center mb-2"><span className="text-sm text-[#8e8e8e]">預估含息報酬率</span><span className="text-base font-mono font-bold text-[#A3B5A6] bg-[#A3B5A6]/10 px-2 py-1 rounded">{calcData.rate1Y.toFixed(2)}%</span></div>
                                <div className="w-full bg-[#B8B8B0]/20 rounded-full h-1.5 mb-6"><div className="bg-[#A3B5A6] h-1.5 rounded-full" style={{width: '100%'}}></div></div>
                                <div className="flex flex-col gap-1"><span className="text-xs text-[#8e8e8e] uppercase tracking-wider">預估本利和</span><div className="flex items-baseline gap-2"><span className="text-sm text-[#8e8e8e]">$</span><span className="text-4xl font-mono font-bold text-[#4a4a4a]">{formatMoney(calcData.val1y)}</span><span className="text-base font-bold text-[#A3B5A6]">(+{formatMoney(calcData.profit1y)})</span></div></div>
                            </div>
                            <p className="text-xs text-[#4a4a4a] font-medium mt-4 text-center bg-[#A3B5A6]/10 py-2 rounded-lg"><i className="fa-solid fa-lightbulb text-[#A3B5A6] mr-1"></i> 忍住消費，一年後你可能多了 <span className="font-bold">${formatMoney(calcData.profit1y)}</span> 的預算！</p>
                        </div>
                    </div>
                    <div className="glass-panel p-6 rounded-3xl">
                        <h3 className="text-lg font-bold text-[#4a4a4a] mb-6 text-center">資產走向視覺化：消費 vs. 投資</h3>
                        <div className="w-full h-[300px] relative"><canvas ref={calcCanvasRef}></canvas></div>
                    </div>
                </section>
            )}

            {}
            {showPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-300">
                    <div className="bg-white p-6 rounded-2xl border border-[#B8B8B0] shadow-xl w-full max-w-sm flex flex-col gap-4">
                        <h3 className="text-xl font-bold text-[#4a4a4a] flex items-center"><i className="fa-solid fa-lock mr-2 text-[#C9A4A0]"></i>解鎖技術分析</h3>
                        <p className="text-sm text-[#8e8e8e]">此為受保護區塊，請輸入高階經理人專屬密碼以查看即時 K 線圖表與深度指標分析。</p>
                        <div>
                            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && unlockTechTab()}
                                className="w-full border border-[#B8B8B0]/50 text-[#4a4a4a] rounded-lg px-4 py-3 focus:outline-none focus:border-[#A2B4C0] focus:ring-1 focus:ring-[#A2B4C0] transition-colors bg-[#B8B8B0]/5" placeholder="輸入密碼..." />
                            {passwordError && <p className="text-xs text-[#C9A4A0] mt-2"><i className="fa-solid fa-circle-exclamation mr-1"></i>密碼錯誤，請重新輸入。</p>}
                        </div>
                        <div className="flex justify-end gap-3 mt-2">
                            <button onClick={() => setShowPasswordModal(false)} className="px-4 py-2 text-sm text-[#8e8e8e] hover:bg-[#B8B8B0]/10 rounded-lg transition-colors font-semibold">取消</button>
                            <button onClick={unlockTechTab} className="px-5 py-2 text-sm bg-[#A2B4C0] text-white rounded-lg hover:bg-[#8fa1ae] transition-all shadow-sm font-semibold flex items-center"><i className="fa-solid fa-key mr-2"></i>解鎖</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
