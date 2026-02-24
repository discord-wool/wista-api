import express from "express";
import { spawn, execFile } from "child_process";
import path from "path";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// yt-dlp 実行ファイル
const ytdlpPath = path.resolve("./yt-dlp_linux");

// 必要なら環境変数で上書き可能
const PROXY_URL = process.env.PROXY_URL || "";

app.use(cors());

/**
 * MP4バイナリストリーム
 * GET /video/:id
 */
app.get("/video/:id", (req, res) => {
    const videoId = req.params.id;

    const args = [
        ...(PROXY_URL ? ["--proxy", PROXY_URL] : []),
        "-f", "best[ext=mp4]/best",
        "-o", "-",
        `https://www.youtube.com/watch?v=${videoId}`
    ];

    const child = spawn(ytdlpPath, args);

    res.setHeader("Content-Type", "video/mp4");

    child.stdout.pipe(res);

    child.stderr.on("data", (data) => {
        console.error("[yt-dlp stderr]", data.toString());
    });

    req.on("close", () => {
        if (!child.killed) child.kill();
    });

    child.on("error", (err) => {
        console.error("yt-dlp start error:", err);
        if (!res.headersSent) res.status(500).end();
    });
});

/**
 * 直リンク取得 → リダイレクト
 * GET /stream/:id
 */
app.get("/stream/:id", (req, res) => {
    const videoId = req.params.id;

    const args = [
        ...(PROXY_URL ? ["--proxy", PROXY_URL] : []),
        "--get-url",
        "-f", "best[ext=mp4]/best",
        `https://www.youtube.com/watch?v=${videoId}`
    ];

    execFile(ytdlpPath, args, (err, stdout) => {
        if (err) {
            console.error("get-url error:", err);
            return res.status(500).json({ error: "Failed to fetch stream URL" });
        }

        const directUrl = stdout.trim();
        res.redirect(directUrl);
    });
});

app.get("/", (req, res) => {
    res.send("Simple yt-dlp Stream API is running 🚀");
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
