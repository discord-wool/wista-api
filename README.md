# Simple yt-dlp Stream API 🚀

超軽量な YouTube ストリームAPIサーバーです。

------------------------------------------------------------

## 📦 Project Structure

```
├── index.js
├── yt-dlp_linux
├── package.json
└── render.yaml
```

yt-dlp を利用して動画を直接ストリーム、または直リンク取得を行います。

------------------------------------------------------------

## 🌐 API Endpoints

🎬 MP4 Binary Stream
```
GET /video/:id
```
Example:
```
/video/dQw4w9WgXcQ
```
サーバーが yt-dlp を実行し、動画をそのまま転送します。

------------------------------------------------------------

🔗 Direct Stream Redirect
```
GET /stream/:id
```
Example:
```
/stream/dQw4w9WgXcQ
```
動画の直接URLへリダイレクトします。

------------------------------------------------------------

## 🚀 Deployment (Render)

1. Repository Structure

index.js
yt-dlp_linux
package.json
render.yaml

2. Deploy via Blueprint

Render Dashboard:
New → Blueprint → Connect Repository

render.yaml が自動で設定を読み込みます。

------------------------------------------------------------

## ⚙ Environment Variables (Optional)

PORT       Server port
PROXY_URL  Proxy for yt-dlp

------------------------------------------------------------

## 🛠 Local Run

npm install
chmod +x yt-dlp_linux
npm start

------------------------------------------------------------

## ⚠ Legal Notice

This software is provided strictly for research and educational purposes only.

Users are fully responsible for complying with:
- YouTube Terms of Service
- Local laws and regulations
- Copyright laws

The author assumes no liability.

------------------------------------------------------------

## 🔒 LICENSE

STRICT NON-COMMERCIAL RESEARCH LICENSE v1.0
All Rights Reserved.

Permission is granted under the following STRICT conditions:

1. Personal, non-commercial research use only
2. Commercial use is strictly prohibited
3. Redistribution is prohibited
4. Public redistribution of source code is prohibited
5. Publication of modified versions is prohibited
6. Offering as an API service is prohibited
7. Hosting for third-party use is prohibited
8. Integration into SaaS or commercial cloud services is prohibited
9. Any revenue-generating use is prohibited

Violation of any condition immediately terminates all usage rights.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
