// @ts-nocheck
// Umbrella Plugin for CineStream
// Multi-source streaming aggregator
// Modules available in sandbox: Cheerio, CryptoJS
// Built-in Node.js modules available via require()
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const https = require('https');
const http = require('http');
const url = require('url');
const BASE_URL = 'https://multimovies.sarl';
// ─── Helper: Fetch HTML from a URL ───────────────────────────────────────────
function fetchHTML(targetUrl) {
    return new Promise((resolve, reject) => {
        const parsedUrl = url.parse(targetUrl);
        const client = parsedUrl.protocol === 'https:' ? https : http;
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.path,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                Referer: BASE_URL + '/',
            },
        };
        const req = client.request(options, (res) => {
            if (res.statusCode >= 300 &&
                res.statusCode < 400 &&
                res.headers.location) {
                const loc = res.headers.location.startsWith('http')
                    ? res.headers.location
                    : `${parsedUrl.protocol}//${parsedUrl.hostname}${res.headers.location}`;
                fetchHTML(loc).then(resolve).catch(reject);
                return;
            }
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error('Request timed out'));
        });
        req.end();
    });
}
// ─── Helper: Extract slug ───────────────────────────────────────────────────
function extractSlug(itemUrl) {
    try {
        const path = url.parse(itemUrl).pathname || '';
        const segments = path.split('/').filter(Boolean);
        return segments[segments.length - 1] || itemUrl;
    }
    catch (_a) {
        return itemUrl;
    }
}
// ─── Helper: Parse movie/show cards ─────────────────────────────────────────
function parseCards($) {
    const items = [];
    const seen = new Set();
    // CineStream/MultiMovies uses various card layouts
    $('article, .post-card, .result-item, .movies .movie, .item, .film-poster, .items .item').each((_, el) => {
        const $el = $(el);
        const $link = $el.is('a') ? $el : $el.find('a').first();
        const href = $link.attr('href') || '';
        if (!href || href === '#')
            return;
        if (href.includes('/category/') || href.includes('/tag/') || href.includes('/page/'))
            return;
        const slug = extractSlug(href);
        if (seen.has(slug))
            return;
        seen.add(slug);
        const title = $el.find('.entry-title, h2, h3, .data h3, .film-name').text().trim() ||
            $link.attr('title') ||
            $el.find('img').attr('alt') || '';
        if (!title || title.length < 2)
            return;
        const img = $el.find('img').attr('src') ||
            $el.find('img').attr('data-src') ||
            $el.find('img').attr('data-lazy-src') || '';
        items.push({
            id: slug,
            name: title.replace(/^Download\s+/i, '').trim(),
            description: '',
            imageUrl: img,
            url: href.startsWith('http') ? href : BASE_URL + href,
            type: 'Video',
        });
    });
    // Fallback: anchor+img
    if (items.length === 0) {
        $('a[href]').each((_, el) => {
            const $el = $(el);
            const href = $el.attr('href') || '';
            const img = $el.find('img').attr('src') || '';
            if (!img || !href || href === '#')
                return;
            if (href.includes('/category/') || href.includes('/tag/') || href.includes('/page/'))
                return;
            const slug = extractSlug(href);
            if (seen.has(slug))
                return;
            seen.add(slug);
            const title = $el.find('img').attr('alt') || $el.attr('title') || '';
            if (!title || title.length < 2)
                return;
            items.push({
                id: slug,
                name: title.trim(),
                description: '',
                imageUrl: img,
                url: href.startsWith('http') ? href : BASE_URL + href,
                type: 'Video',
            });
        });
    }
    return items;
}
// ═══════════════════════════════════════════════════════════════════════════════
// CineStream Plugin Class
// ═══════════════════════════════════════════════════════════════════════════════
class CineStreamPlugin {
    // ─── Search ─────────────────────────────────────────────────────────────────
    search(query, page) {
        return __awaiter(this, void 0, void 0, function* () {
            const pageNum = page || 1;
            let searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
            if (pageNum > 1) {
                searchUrl = `${BASE_URL}/page/${pageNum}/?s=${encodeURIComponent(query)}`;
            }
            const html = yield fetchHTML(searchUrl);
            const $ = Cheerio.load(html);
            const items = parseCards($);
            const hasNextPage = $('a.next, .pagination a:contains("Next"), .next').length > 0 ||
                items.length >= 10;
            return {
                name: `Search: ${query}`,
                description: `Results for "${query}"`,
                url: searchUrl,
                isPaginated: hasNextPage,
                nextPageNumber: hasNextPage ? pageNum + 1 : undefined,
                previousPageNumber: pageNum > 1 ? pageNum - 1 : undefined,
                items: items,
            };
        });
    }
    // ─── Get Category ───────────────────────────────────────────────────────────
    getCategory(category, page) {
        return __awaiter(this, void 0, void 0, function* () {
            const pageNum = page || 1;
            let categoryUrl = `${BASE_URL}/${category}/`;
            if (pageNum > 1) {
                categoryUrl += `page/${pageNum}/`;
            }
            const html = yield fetchHTML(categoryUrl);
            const $ = Cheerio.load(html);
            const items = parseCards($);
            const hasNextPage = items.length >= 10;
            const categoryName = $('h1').first().text().trim() ||
                category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            return {
                name: categoryName,
                description: `Browse ${categoryName}`,
                url: categoryUrl,
                isPaginated: hasNextPage,
                nextPageNumber: hasNextPage ? pageNum + 1 : undefined,
                previousPageNumber: pageNum > 1 ? pageNum - 1 : undefined,
                items: items,
            };
        });
    }
    // ─── Get Home Categories ────────────────────────────────────────────────────
    getHomeCategories() {
        return __awaiter(this, void 0, void 0, function* () {
            const categories = [];
            const html = yield fetchHTML(BASE_URL);
            const $ = Cheerio.load(html);
            const homeItems = parseCards($);
            if (homeItems.length > 0) {
                categories.push({
                    name: 'Trending',
                    description: 'Trending now',
                    url: BASE_URL,
                    isPaginated: true,
                    nextPageNumber: 2,
                    items: homeItems,
                });
            }
            // Predefined categories
            const categoryPages = [
                { slug: 'movies', name: 'Movies' },
                { slug: 'tvshows', name: 'TV Shows' },
                { slug: 'genre/action', name: 'Action' },
                { slug: 'genre/comedy', name: 'Comedy' },
                { slug: 'genre/drama', name: 'Drama' },
                { slug: 'genre/thriller', name: 'Thriller' },
            ];
            for (const cat of categoryPages) {
                try {
                    const catHtml = yield fetchHTML(`${BASE_URL}/${cat.slug}/`);
                    const $cat = Cheerio.load(catHtml);
                    const catItems = parseCards($cat);
                    if (catItems.length > 0) {
                        categories.push({
                            name: cat.name,
                            description: `Browse ${cat.name}`,
                            url: `${BASE_URL}/${cat.slug}/`,
                            isPaginated: true,
                            nextPageNumber: 2,
                            items: catItems.slice(0, 15),
                        });
                    }
                }
                catch (e) {
                    // Skip
                }
            }
            return categories;
        });
    }
    // ─── Get Item Details ───────────────────────────────────────────────────────
    getItemDetails(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const detailUrl = id.startsWith('http') ? id : `${BASE_URL}/${id}/`;
            const html = yield fetchHTML(detailUrl);
            const $ = Cheerio.load(html);
            const title = $('h1').first().text().trim() ||
                $('title').text().trim().replace(/\s*[-–|].*$/, '') || id;
            const imageUrl = $('meta[property="og:image"]').attr('content') ||
                $('img.wp-post-image, .sheader img, .poster img').first().attr('src') || '';
            let synopsis = '';
            $('.wp-content p, .description p, #info p, .sbox p').each((_, el) => {
                const text = $(el).text().trim();
                if (text.length > 60 && !synopsis) {
                    synopsis = text;
                }
            });
            if (!synopsis) {
                synopsis = $('meta[property="og:description"]').attr('content') ||
                    $('meta[name="description"]').attr('content') || '';
            }
            // Genres
            const genres = [];
            $('a[href*="/genre/"], .sgeneros a, .genres a').each((_, el) => {
                const name = $(el).text().trim();
                const href = $(el).attr('href') || '';
                if (name && name.length > 1 && !genres.find(g => g.name === name)) {
                    genres.push({
                        id: extractSlug(href),
                        name: name,
                        url: href.startsWith('http') ? href : BASE_URL + href,
                    });
                }
            });
            // Episodes / seasons
            const media = [];
            let counter = 1;
            // Season/Episode links
            $('a[href*="episode"], a[href*="season"], .episodios li a, .se-a a').each((_, el) => {
                const link = $(el).attr('href') || '';
                const name = $(el).text().trim() || `Episode ${counter}`;
                if (link && link !== '#') {
                    media.push({
                        id: `${id}-ep-${counter}`,
                        name: name,
                        type: 1,
                        url: link.startsWith('http') ? link : BASE_URL + link,
                        number: counter,
                    });
                    counter++;
                }
            });
            // Fallback: iframe/embed sources
            if (media.length === 0) {
                $('iframe[src], iframe[data-src]').each((_, el) => {
                    const src = $(el).attr('src') || $(el).attr('data-src') || '';
                    if (src) {
                        media.push({
                            id: `${id}-stream-${counter}`,
                            name: `Stream ${counter}`,
                            type: 1,
                            url: src.startsWith('http') ? src : 'https:' + src,
                            number: counter,
                        });
                        counter++;
                    }
                });
            }
            return {
                id: id,
                name: title,
                description: synopsis.substring(0, 200),
                imageUrl: imageUrl,
                url: detailUrl,
                type: 'Video',
                language: 'Hindi',
                synopsis: synopsis,
                genres: genres,
                media: media,
            };
        });
    }
    // ─── Get Item Media ─────────────────────────────────────────────────────────
    getItemMedia(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const detailUrl = id.startsWith('http') ? id : `${BASE_URL}/${id}/`;
            const html = yield fetchHTML(detailUrl);
            const $ = Cheerio.load(html);
            const mediaList = [];
            let counter = 1;
            // Episode links
            $('a[href*="episode"], a[href*="season"], .episodios li a').each((_, el) => {
                const link = $(el).attr('href') || '';
                const name = $(el).text().trim() || `Episode ${counter}`;
                if (link && link !== '#') {
                    mediaList.push({
                        type: 1,
                        url: link.startsWith('http') ? link : BASE_URL + link,
                        name: name,
                    });
                    counter++;
                }
            });
            // Iframe/embed sources
            if (mediaList.length === 0) {
                $('iframe[src], iframe[data-src], video source[src]').each((_, el) => {
                    const src = $(el).attr('src') || $(el).attr('data-src') || '';
                    if (src) {
                        mediaList.push({
                            type: 1,
                            url: src.startsWith('http') ? src : 'https:' + src,
                            name: `Stream ${counter}`,
                        });
                        counter++;
                    }
                });
            }
            // Download links
            if (mediaList.length === 0) {
                $('a[href]').each((_, el) => {
                    const link = $(el).attr('href') || '';
                    const text = $(el).text().trim();
                    if (link && link !== '#' && !link.includes(BASE_URL) &&
                        (text.toLowerCase().includes('download') ||
                            text.toLowerCase().includes('watch') ||
                            text.toLowerCase().includes('480p') ||
                            text.toLowerCase().includes('720p') ||
                            text.toLowerCase().includes('1080p'))) {
                        mediaList.push({
                            type: 1,
                            url: link,
                            name: text || `Link ${counter}`,
                        });
                        counter++;
                    }
                });
            }
            return mediaList;
        });
    }
}
// ═══════════════════════════════════════════════════════════════════════════════
// Export plugin methods (required by Umbrella sandbox)
// ═══════════════════════════════════════════════════════════════════════════════
module.exports = {
    search: (query, page) => __awaiter(this, void 0, void 0, function* () { return new CineStreamPlugin().search(query, page); }),
    getCategory: (category, page) => __awaiter(this, void 0, void 0, function* () { return new CineStreamPlugin().getCategory(category, page); }),
    getHomeCategories: () => __awaiter(this, void 0, void 0, function* () { return new CineStreamPlugin().getHomeCategories(); }),
    getItemDetails: (id) => __awaiter(this, void 0, void 0, function* () { return new CineStreamPlugin().getItemDetails(id); }),
    getItemMedia: (id) => __awaiter(this, void 0, void 0, function* () { return new CineStreamPlugin().getItemMedia(id); }),
};
