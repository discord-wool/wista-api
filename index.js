import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";

const app = express();
const PORT = process.env.PORT || 3000;

// yt-dlp 実行ファイル
const ytdlpPath = path.resolve("yt-dlp_linux");

// 🔄 GASのPACファイルURL
const PAC_URL = "https://script.google.com/macros/s/AKfycbyx5Hks2tp4XcUjQdRfo6BinXnwTiLlAvn-BZlRf8Fbrh22qndC80ohyiNwZ9gps-VFJg/exec";

// メモリ上に保持するプロキシ候補リスト
let cachedProxies = [];

app.use(cors());

// Render 対策：実行権限を強制付与
try {
    fs.chmodSync(ytdlpPath, 0o755);
    console.log("yt-dlp chmod OK");
} catch (e) {
    console.error("chmod failed:", e);
}

// yt-dlp 存在チェック
if (!fs.existsSync(ytdlpPath)) {
    console.error("❌ yt-dlp_linux not found:", ytdlpPath);
}

/**
 * 🌐 GASからPACテキストを取得し、yt-dlpが使えるURL配列に変換する
 */
async function updateProxyList() {
    try {
        console.log("🔄 Fetching proxy list from GAS...");
        const response = await fetch(PAC_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const text = await response.text();
        
        // 文字列から "PROXY ip:port" や "SOCKS5 ip:port" を抽出
        const matches = text.match(/(SOCKS5|PROXY|SOCKS)\s+([0-9.]+:[0-9]+)/gi);
        
        if (!matches) {
            console.warn("⚠️ No proxies found in PAC text.");
            return;
        }

        // yt-dlp が認識できる形式 (http://... や socks5://...) に一括変換
        cachedProxies = matches.map(item => {
            const [type, hostport] = item.split(/\s+/);
            const lowerType = type.toLowerCase();
            
            if (lowerType.startsWith("socks")) {
                return `socks5://${hostport}`;
            }
            return `http://${hostport}`; // PROXY は http://
        });

        console.log(`✅ Proxy list updated! Total proxies: ${cachedProxies.length}`);
    } catch (err) {
        console.error("❌ Failed to update proxy list:", err.message);
    }
}

// 起動時にプロキシリストを取得し、以後1時間ごとに自動更新
updateProxyList();
setInterval(updateProxyList, 1000 * 60 * 60);

/**
 * 🔍 共通：全フォーマット取得（プロキシを上から順に自動で試行）
 */
function getAllFormats(videoId) {
    return new Promise(async (resolve, reject) => {
        // プロキシリストが空なら直接接続も辞さない(最後尾にnullを入れる)
        const proxiesToTry = [...cachedProxies, null]; 
        let lastError = null;

        // 上から順に試すループ
        for (const proxy of proxiesToTry) {
            try {
                const args = ["--dump-json"];
                
                if (proxy) {
                    args.push("--proxy", proxy);
                }
                args.push(`https://www.youtube.com/watch?v=${videoId}`);

                const result = await new Promise((res, rej) => {
                    execFile(
                        ytdlpPath,
                        args,
                        { maxBuffer: 1024 * 1024 * 50 },
                        (err, stdout, stderr) => {
                            if (err) {
                                return rej({ err, stderr, proxy });
                            }
                            res(stdout);
                        }
                    );
                });

                // 成功したらパースして終了
                let json = JSON.parse(result);
                const formats = json.formats || [];
                const streams = formats
                    .filter(f => f.url)
                    .map(f => ({
                        url: f.url,
                        quality: f.format_note || f.height || "unknown",
                        ext: f.ext || "unknown",
                        fps: f.fps || null,
                        size: f.filesize || null,
                        format_id: f.format_id
                    }));

                console.log(`✨ Success using proxy: ${proxy || "DIRECT"}`);
                return resolve(streams);

            } catch (fail) {
                console.warn(`⚠️ Proxy failed: ${fail.proxy || "DIRECT"}. Trying next...`);
                lastError = fail.stderr || fail.err;
                // ループが継続し、自動で次のプロキシが試されます
            }
        }

        // すべて全滅した場合
        console.error("❌ All proxies failed.");
        reject(new Error("Failed to fetch formats with all available proxies"));
    });
}

/**
 * 🏠 / → API ドキュメントページ（HTML）
 */
app.get("/", (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Wista Stream API</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                code { background: #eee; padding: 4px; }
            </style>
        </head>
        <body>
            <h1>🚀 Wista Stream API</h1>
            <p>有効なプロキシプール数: <b>${cachedProxies.length} 個</b></p>

            <h2>📌 エンドポイント一覧</h2>
            <h3>1. 自動ストリームリダイレクト</h3>
            <code>/api/stream/:id</code>
            <h3>2. HLS のみリダイレクト</h3>
            <code>/api/m3u8/:id</code>
            <h3>3. 全ストリーム JSON</h3>
            <code>/api/video/:id</code>
            <h3>4. ヘルスチェック</h3>
            <code>/health</code>
            <hr>
            <p>Made for Wista</p>
        </body>
        </html>
    `);
});

/**
 * ❤️ /health → ヘルスチェック
 */
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        ytdlp: fs.existsSync(ytdlpPath),
        total_proxies: cachedProxies.length,
        proxies: cachedProxies,
        timestamp: Date.now()
    });
});

/**
 * 🔥 各種APIエンドポイント
 */
app.get("/api/stream/:id", async (req, res) => {
    const videoId = req.params.id;
    try {
        const streams = await getAllFormats(videoId);
        const hls = streams.find(s => s.ext === "m3u8");
        if (hls) return res.redirect(hls.url);
        const mp4 = streams.find(s => s.ext === "mp4");
        if (mp4) return res.redirect(mp4.url);
        return res.status(404).json({ error: "No playable stream found" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/m3u8/:id", async (req, res) => {
    const videoId = req.params.id;
    try {
        const streams = await getAllFormats(videoId);
        const hls = streams.find(s => s.ext === "m3u8");
        if (hls) return res.redirect(hls.url);
        return res.status(404).json({ error: "No HLS stream found" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/video/:id", async (req, res) => {
    const videoId = req.params.id;
    try {
        const streams = await getAllFormats(videoId);
        res.json({ streams });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});