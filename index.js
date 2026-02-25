import express from "express";
import { execFile } from "child_process";
import cors from "cors";
import path from "path";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;

// yt-dlp 実行ファイル
const ytdlpPath = path.join(process.cwd(), "yt-dlp_linux");

// 🔥 固定プロキシ（必須）
const PROXY_URL = "http://ytproxy-siawaseok.duckdns.org:3008";

app.use(cors());

// yt-dlp 存在チェック
if (!fs.existsSync(ytdlpPath)) {
    console.error("❌ yt-dlp_linux not found:", ytdlpPath);
}

/**
 * yt-dlp から全フォーマット情報を取得
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
            { maxBuffer: 1024 * 1024 * 20 },
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
 * /video/:id
 * → 全ストリームを JSON で返す
 */
app.get("/video/:id", async (req, res) => {
    const videoId = req.params.id;

    if (!/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
        return res.status(400).json({ error: "Invalid video ID" });
    }

    try {
        const streams = await getAllFormats(videoId);
        res.json({ streams });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to fetch stream list" });
    }
});

/**
 * /stream/:id
 * → HLS 優先で自動リダイレクト
 */
app.get("/stream/:id", async (req, res) => {
    const videoId = req.params.id;

    if (!/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
        return res.status(400).json({ error: "Invalid video ID" });
    }

    try {
        const streams = await getAllFormats(videoId);

        // HLS 優先
        const hls = streams.find(s => s.ext === "m3u8");
        if (hls) return res.redirect(hls.url);

        // 次に MP4
        const mp4 = streams.find(s => s.ext === "mp4");
        if (mp4) return res.redirect(mp4.url);

        return res.status(404).json({ error: "No playable stream found" });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to resolve stream URL" });
    }
});

/**
 * 動作確認用
 */
app.get("/", (req, res) => {
    res.send("🚀 Proxy-enabled yt-dlp API running (HLS + MP4)");
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
