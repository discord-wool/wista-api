import express from "express";
import { Innertube, UniversalCache } from "youtubei.js";
import path from "path";
import cors from "cors";

// 各ルートのインポート
import { initStreamRoutes } from "./routes/stream.js";
import { initInfoRoutes } from "./routes/info.js";
import { initChannelRoutes } from "./routes/channel.js";

const app = express();
const PORT = process.env.PORT || 3000;
const ytdlpPath = path.resolve(process.cwd(), 'yt-dlp_linux');
const PROXY_URL = "http://ytproxy-siawaseok.duckdns.org:3007";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

async function startServer() {
    // YouTubeクライアントの初期化 (共通利用)
    const youtube = await Innertube.create({
        lang: "ja",
        location: "JP",
        cache: new UniversalCache(false),
        generate_session_locally: true,
    });

    // 各モジュールの初期化
    initStreamRoutes(app, ytdlpPath, PROXY_URL);
    initInfoRoutes(app, youtube);
    initChannelRoutes(app, youtube);

    // ルートパスで index.html を返す
    app.get('/', (req, res) => {
        res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
    });

    app.listen(PORT, () => {
        console.log(`🚀 Server ready at http://localhost:${PORT}`);
    });
}

startServer().catch(console.error);
