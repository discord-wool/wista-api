import express from "express";
import { spawn, execFile } from "child_process";
import cors from "cors";
import path from "path";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;

// yt-dlp 実行ファイル
const ytdlpPath = path.join(process.cwd(), "yt-dlp_linux");

// 🔥 固定プロキシ
const PROXY_URL = "http://ytproxy-siawaseok.duckdns.org:3008";

app.use(cors());

if (!fs.existsSync(ytdlpPath)) {
    console.error("❌ yt-dlp_linux not found:", ytdlpPath);
}

/**
 * MP4 ストリーム
 * GET /video/:id
 */
app.get("/video/:id", (req, res) => {
    const videoId = req.params.id;

    const args = [
        "--proxy", PROXY_URL,
        "-f", "best[ext=mp4]/best",
        "-o", "-",
        `https://www.youtube.com/watch?v=${videoId}`
    ];

    console.log("▶ Running:", ytdlpPath, args.join(" "));

    const child = spawn(ytdlpPath, args);

    res.setHeader("Content-Type", "video/mp4");

    child.stdout.pipe(res);

    child.stderr.on("data", (data) => {
        console.error("yt-dlp stderr:", data.toString());
    });

    child.on("error", (err) => {
        console.error("Spawn error:", err);
        if (!res.headersSent) {
            res.status(500).json({ error: "yt-dlp execution failed" });
        }
    });

    child.on("close", (code) => {
        console.log("yt-dlp exited with code:", code);
    });

    req.on("close", () => {
        if (!child.killed) child.kill("SIGKILL");
    });
});

/**
 * 直リンク取得
 * GET /stream/:id
 */
app.get("/stream/:id", (req, res) => {
    const videoId = req.params.id;

    const args = [
        "--proxy", PROXY_URL,
        "--get-url",
        "-f", "best[ext=mp4]/best",
        `https://www.youtube.com/watch?v=${videoId}`
    ];

    execFile(
        ytdlpPath,
        args,
        { maxBuffer: 1024 * 1024 * 10 },
        (err, stdout, stderr) => {
            if (err) {
                console.error("execFile error:", err);
                console.error("stderr:", stderr);
                return res.status(500).json({
                    error: "Failed to fetch stream URL"
                });
            }

            const url = stdout.trim();

            if (!url) {
                return res.status(500).json({
                    error: "Empty stream URL"
                });
            }

            res.redirect(url);
        }
    );
});

app.get("/", (req, res) => {
    res.send("🚀 Proxy-enabled yt-dlp API running");
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
