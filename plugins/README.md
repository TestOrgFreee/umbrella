# ☂️ Umbrella Plugins

Custom plugins for the [Umbrella](https://github.com/new-umbrella/umbrella) media app.

## 🔌 Plugins

| Plugin | Source | Content |
|--------|--------|---------|
| **AnimeVilla** | [animevilla.in](https://animevilla.in/) | Hindi Dubbed Anime |
| **VegaMovies** | [vegamovies.mobile](https://vegamovies.mobile/) | Movies & TV Shows |
| **MoviesMod** | [moviesmod.town](https://moviesmod.town/) | Movies & TV Shows |

## 📋 Features

Each plugin implements all 5 required methods:
- `search(query, page)` — Search for anime/movies
- `getCategory(category, page)` — Browse by genre/category
- `getHomeCategories()` — Get homepage content with featured items
- `getItemDetails(id)` — Get detailed info (synopsis, genres, episodes)
- `getItemMedia(id)` — Get download/streaming links

## 🛠️ Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [VS Code](https://code.visualstudio.com/) with [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension
- [Umbrella app](https://github.com/new-umbrella/umbrella/releases) installed on your Android device

### Build

```bash
npm install
npx tsc
```

This compiles TypeScript to JavaScript in the `dist/` folder.

### Install Plugins on Your Phone

1. **Update the IP addresses** in the `manifest.json` and `index.html` files:
   - Replace `YOUR_LOCAL_IP` with your computer's local IP (e.g., `192.168.1.100`)
   - You can find your IP by running `ipconfig` in terminal

2. **Start Live Server** in VS Code from the project root folder

3. **Open the deeplink** on your phone's browser:
   - AnimeVilla: `http://YOUR_LOCAL_IP:5500/test/animevilla/index.html`
   - VegaMovies: `http://YOUR_LOCAL_IP:5500/test/vegamovies/index.html`
   - MoviesMod: `http://YOUR_LOCAL_IP:5500/test/moviesmod/index.html`

4. Click **"Install Plugin"** and confirm in the Umbrella app

5. Check the **Plugins** page in Umbrella to verify installation

## 📁 Project Structure

```
umbrella-plugins/
├── src/
│   ├── models/                    # Type definitions (from plugin-example)
│   ├── animevilla-plugin.ts       # AnimeVilla scraper
│   ├── vegamovies-plugin.ts       # VegaMovies scraper
│   └── moviesmod-plugin.ts        # MoviesMod scraper
├── test/
│   ├── animevilla/                # manifest.json + deeplink page
│   ├── vegamovies/                # manifest.json + deeplink page
│   └── moviesmod/                 # manifest.json + deeplink page
├── dist/                          # Compiled JS (after npx tsc)
├── package.json
└── tsconfig.json
```

## ⚠️ Disclaimer

These plugins are for educational purposes. Content is provided by third-party websites.
Use at your own risk. Respect copyright laws in your jurisdiction.

## 📝 License

MIT
