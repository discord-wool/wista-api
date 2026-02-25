import { execFile, spawn } from "child_process";

export function initStreamRoutes(app, ytdlpPath, PROXY_URL) {

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
     * 1. 🔥 /api/stream/:id
     * HLS → MP4 の順で自動リダイレクト
     */
    app.get('/api/stream/:id', async (req, res) => {
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
     * 2. 🎥 /api/video/:id
     * 取得できる全ストリームを JSON で返す
     */
    app.get('/api/video/:id', async (req, res) => {
        const videoId = req.params.id;

        try {
            const streams = await getAllFormats(videoId);
            res.json({ streams });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "Failed to fetch stream list" });
        }
    });

    /**
     * 3. 📺 /api/m3u8/:id
     * HLS のみリダイレクト（HLS が無ければ 404）
     */
    app.get('/api/m3u8/:id', async (req, res) => {
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
     * 4. 🧱 旧 /stream は廃止（統合済み）
     * 必要ならここに互換 API を追加できる
     */
}
