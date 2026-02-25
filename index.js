import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";

const app = express();
const PORT = process.env.PORT || 3000;

// yt-dlp 実行ファイル
const ytdlpPath = path.resolve("yt-dlp_linux");

// 🔥 固定プロキシ（必須）
const PROXY_URL = "http://ytproxy-siawaseok.duckdns.org:3008";

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
 * 🔍 共通：全フォーマット取得
 */
function getAllFormats(videoId) {
    return new Promise((resolve, reject) => {
        const args = [
            "--proxy", PROXY_URL,
            "--dump-json",
            `https://www.youtube.com/watch?v=${videoId}`
        ];

        execFile(
            ytdlpPath,
            args,
            { maxBuffer: 1024 * 1024 * 50 },
            (err, stdout, stderr) => {
                if (err) {
                    console.error("yt-dlp error:", err);
                    console.error(stderr);
                    return reject(new Error("Failed to fetch formats"));
                }

                let json;
                try {
                    json = JSON.parse(stdout);
                } catch (e) {
                    return reject(new Error("Invalid JSON from yt-dlp"));
                }

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

                resolve(streams);
            }
        );
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
            <p>プロキシ: <b>${PROXY_URL}</b></p>

            <h2>📌 エンドポイント一覧</h2>

            <h3>1. 自動ストリームリダイレクト</h3>
            <code>/api/stream/:id</code>
            <p>HLS → MP4 の順で自動リダイレクト</p>

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
        proxy: PROXY_URL,
        timestamp: Date.now()
    });
});

/**
 * 🔥 /api/stream/:id → HLS → MP4 の順で自動リダイレクト
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
        console.error(e);
        res.status(500).json({ error: "Failed to resolve stream URL" });
    }
});

/**
 * 📺 /api/m3u8/:id → HLS のみリダイレクト
 */
app.get("/api/m3u8/:id", async (req, res) => {
    const videoId = req.params.id;

    try {
        const streams = await getAllFormats(videoId);

        const hls = streams.find(s => s.ext === "m3u8");
        if (hls) return res.redirect(hls.url);

        return res.status(404).json({ error: "No HLS stream found" });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to fetch HLS stream" });
    }
});

/**
 * 🎥 /api/video/:id → 全ストリーム JSON
 */
app.get("/api/video/:id", async (req, res) => {
    const videoId = req.params.id;

    try {
        const streams = await getAllFormats(videoId);
        res.json({ streams });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to fetch stream list" });
    }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
