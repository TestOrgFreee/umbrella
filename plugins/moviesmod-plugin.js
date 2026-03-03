// @ts-nocheck
// Umbrella Plugin for MoviesMod (https://moviesmod.town/)
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
const BASE_URL = 'https://moviesmod.town';
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
            // Follow redirects
            if (res.statusCode >= 300 &&
                res.statusCode < 400 &&
                res.headers.location) {
                fetchHTML(res.headers.location).then(resolve).catch(reject);
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
// ─── Helper: Extract slug from URL ──────────────────────────────────────────
function extractSlug(itemUrl) {
    const match = itemUrl.match(/\/([^/]+)\/?$/);
    return match ? match[1] : itemUrl;
}
// ─── Helper: Clean title text ───────────────────────────────────────────────
function cleanTitle(rawTitle) {
    return rawTitle
        .replace(/^Download\s+/i, '')
        .replace(/\s*\(?\d+p\s*\[.*?\]\s*(\|\|.*?)?\)?/g, '')
        .replace(/\s*WEB-DL.*$/i, '')
        .replace(/\s*WeB-DL.*$/i, '')
        .replace(/\s*Web-Dl.*$/i, '')
        .replace(/\s*BluRay.*$/i, '')
        .replace(/\s*HDRip.*$/i, '')
        .replace(/\s*Esubs?.*$/i, '')
        .replace(/\s*Msubs?.*$/i, '')
        .trim();
}
// ─── Helper: Parse movie cards from listing pages ───────────────────────────
function parseMovieCards($) {
    const items = [];
    const seen = new Set();
    // MoviesMod uses WordPress with article posts
    $('article, .post, .blog-post').each((_, el) => {
        const $el = $(el);
        // Get title and link
        const $titleLink = $el.find('h2 a, h3 a, .entry-title a, .post-title a').first();
        let href = $titleLink.attr('href') || '';
        let name = $titleLink.text().trim();
        // Fallback
        if (!href) {
            const $link = $el.find('a[href*="download"], a[href*="moviesmod"]').first();
            href = $link.attr('href') || '';
            name = name || $link.text().trim();
        }
        if (!href || !name)
            return;
        const slug = extractSlug(href);
        if (seen.has(slug))
            return;
        seen.add(slug);
        const cleanedName = cleanTitle(name);
        // Get poster image
        const img = $el.find('img').first().attr('src') ||
            $el.find('img').first().attr('data-lazy-src') ||
            $el.find('img').first().attr('data-src') ||
            '';
        const description = $el.find('.entry-content p, .post-content p').first().text().trim() || '';
        items.push({
            id: slug,
            name: cleanedName || name,
            description: description.substring(0, 200),
            imageUrl: img,
            url: href.startsWith('http') ? href : BASE_URL + href,
            type: 'Video',
        });
    });
    // Fallback: generic download links
    if (items.length === 0) {
        $('a[href*="/download-"]').each((_, el) => {
            const $el = $(el);
            const href = $el.attr('href') || '';
            const name = $el.text().trim();
            if (!href || !name || name.length < 5)
                return;
            const slug = extractSlug(href);
            if (seen.has(slug))
                return;
            seen.add(slug);
            const img = $el.find('img').attr('src') ||
                $el.closest('div').find('img').first().attr('src') ||
                '';
            items.push({
                id: slug,
                name: cleanTitle(name),
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
// MoviesMod Plugin Class
// ═══════════════════════════════════════════════════════════════════════════════
class MoviesModPlugin {
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
            const items = parseMovieCards($);
            const hasNextPage = $('a.next, .nav-previous a, .pagination a.next, a.nextpostslink').length > 0 ||
                $(`.page-numbers a:contains("${pageNum + 1}")`).length > 0;
            return {
                name: `Search: ${query}`,
                description: `Search results for "${query}"`,
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
            let categoryUrl = `${BASE_URL}/category/${category}/`;
            if (pageNum > 1) {
                categoryUrl += `page/${pageNum}/`;
            }
            const html = yield fetchHTML(categoryUrl);
            const $ = Cheerio.load(html);
            const items = parseMovieCards($);
            const hasNextPage = $('a.next, .nav-previous a, a.nextpostslink').length > 0;
            const categoryName = $('h1.page-title, h1.entry-title, .archive-title').first().text().trim() ||
                category.charAt(0).toUpperCase() + category.slice(1);
            return {
                name: categoryName,
                description: `Movies in the ${categoryName} category`,
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
            const html = yield fetchHTML(BASE_URL);
            const $ = Cheerio.load(html);
            const categories = [];
            // Latest movies from homepage
            const latestItems = parseMovieCards($);
            if (latestItems.length > 0) {
                categories.push({
                    name: 'Latest Movies & Shows',
                    description: 'Latest releases on MoviesMod',
                    url: BASE_URL,
                    isPaginated: true,
                    nextPageNumber: 2,
                    items: latestItems,
                });
            }
            // Navigation categories
            const navCategories = [];
            const seenCats = new Set();
            $('a[href*="/category/"]').each((_, el) => {
                const $el = $(el);
                const href = $el.attr('href') || '';
                const catName = $el.text().trim();
                const catMatch = href.match(/\/category\/([^/]+)\/?/);
                if (catMatch && catName && catName.length > 1 && !seenCats.has(catMatch[1])) {
                    seenCats.add(catMatch[1]);
                    navCategories.push({
                        id: catMatch[1],
                        name: catName,
                        imageUrl: '',
                        url: href.startsWith('http') ? href : BASE_URL + href,
                        type: 'Video',
                    });
                }
            });
            if (navCategories.length > 0) {
                categories.push({
                    name: 'Categories',
                    description: 'Browse by category',
                    url: BASE_URL,
                    isPaginated: false,
                    items: navCategories.slice(0, 25),
                });
            }
            return categories;
        });
    }
    // ─── Get Item Details ───────────────────────────────────────────────────────
    getItemDetails(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const detailUrl = `${BASE_URL}/${id}/`;
            const html = yield fetchHTML(detailUrl);
            const $ = Cheerio.load(html);
            // Title
            const rawTitle = $('h1.entry-title, h1.post-title, h1').first().text().trim() ||
                $('title').text().trim() ||
                id;
            const title = cleanTitle(rawTitle);
            // Poster image
            const imageUrl = $('meta[property="og:image"]').attr('content') ||
                $('.entry-content img, .post-content img, article img').first().attr('src') ||
                '';
            // Synopsis - look for "Storyline:" section
            let synopsis = '';
            $('h3, h4, strong, b, p').each((_, el) => {
                const text = $(el).text().trim().toLowerCase();
                if (text.includes('storyline') ||
                    text.includes('synopsis') ||
                    text.includes('plot')) {
                    // Get the text following this header
                    const nextText = $(el).next('p').text().trim() ||
                        $(el).parent().next('p').text().trim();
                    if (nextText && nextText.length > 30) {
                        synopsis = nextText;
                    }
                }
            });
            // Fallback: find the longest paragraph that isn't technical info
            if (!synopsis) {
                $('p').each((_, el) => {
                    const text = $(el).text().trim();
                    if (text.length > synopsis.length &&
                        text.length > 50 &&
                        !text.includes('Download') &&
                        !text.includes('480p') &&
                        !text.includes('720p') &&
                        !text.includes('1080p') &&
                        !text.includes('Movie Info')) {
                        synopsis = text;
                    }
                });
            }
            if (!synopsis) {
                synopsis =
                    $('meta[property="og:description"]').attr('content') ||
                        $('meta[name="description"]').attr('content') ||
                        '';
            }
            // Extract movie info
            let language = 'English';
            let releaseDate = '';
            $('p, li, div').each((_, el) => {
                const text = $(el).text().trim();
                // Language
                if (text.match(/Language\s*[:]/i)) {
                    const langMatch = text.match(/Language\s*[:]\s*(.+?)(?:\n|$)/i);
                    if (langMatch) {
                        language = langMatch[1].trim();
                    }
                }
                // Release year
                if (text.match(/Release\s*(Year|Date)\s*[:]/i)) {
                    const dateMatch = text.match(/Release\s*(?:Year|Date)\s*[:]\s*(.+?)(?:\n|$)/i);
                    if (dateMatch) {
                        releaseDate = dateMatch[1].trim();
                    }
                }
            });
            // Detect language from title
            if (rawTitle.toLowerCase().includes('hindi')) {
                language = 'Hindi-English';
            }
            else if (rawTitle.toLowerCase().includes('dual audio')) {
                language = 'Dual Audio (Hindi-English)';
            }
            else if (rawTitle.toLowerCase().includes('multi audio')) {
                language = 'Multi Audio';
            }
            // Download media items
            const media = [];
            let mediaCounter = 1;
            // Look for download quality sections
            // MoviesMod typically has text like "Download Movie (2025) 480p [300MB]"
            // followed by download buttons
            $('h4, h3, p strong, p b').each((_, el) => {
                const $el = $(el);
                const text = $el.text().trim();
                // Check if this is a quality header
                if (text.match(/\d+p/) &&
                    (text.toLowerCase().includes('download') || text.match(/\[\d+[MG]B\]/))) {
                    // Find download links near this header
                    const $next = $el.nextAll('p, div').first();
                    $next.find('a').each((_, linkEl) => {
                        const link = $(linkEl).attr('href') || '';
                        const linkText = $(linkEl).text().trim();
                        if (link && !link.includes('#') && !link.includes('javascript:')) {
                            media.push({
                                id: `${id}-${mediaCounter}`,
                                name: `${text} - ${linkText}`,
                                type: 1, // MediaType.RawVideo
                                url: link.startsWith('http') ? link : BASE_URL + link,
                                number: mediaCounter,
                            });
                            mediaCounter++;
                        }
                    });
                }
            });
            // Fallback: find any download-type buttons/links
            if (media.length === 0) {
                $('a').each((_, el) => {
                    const $el = $(el);
                    const link = $el.attr('href') || '';
                    const text = $el.text().trim().toLowerCase();
                    if ((text.includes('g-direct') ||
                        text.includes('hubcloud') ||
                        text.includes('gdrive') ||
                        text.includes('instant download') ||
                        text.includes('download link') ||
                        text.includes('download now')) &&
                        link &&
                        !link.includes('#') &&
                        !link.includes('javascript:') &&
                        link !== BASE_URL + '/') {
                        media.push({
                            id: `${id}-dl-${mediaCounter}`,
                            name: $el.text().trim(),
                            type: 1,
                            url: link.startsWith('http') ? link : BASE_URL + link,
                            number: mediaCounter,
                        });
                        mediaCounter++;
                    }
                });
            }
            // Genres
            const genres = [];
            $('a[rel="category tag"], a[href*="/category/"]').each((_, el) => {
                const $el = $(el);
                const genreName = $el.text().trim();
                const href = $el.attr('href') || '';
                const catMatch = href.match(/\/category\/([^/]+)\/?/);
                if (catMatch && genreName) {
                    genres.push({
                        id: catMatch[1],
                        name: genreName,
                        url: href.startsWith('http') ? href : BASE_URL + href,
                    });
                }
            });
            return {
                id: id,
                name: title,
                description: synopsis.substring(0, 200),
                imageUrl: imageUrl,
                url: detailUrl,
                type: 'Video',
                language: language,
                synopsis: synopsis,
                genres: genres,
                media: media,
                releaseDate: releaseDate || undefined,
            };
        });
    }
    // ─── Get Item Media ─────────────────────────────────────────────────────────
    getItemMedia(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const detailUrl = `${BASE_URL}/${id}/`;
            const html = yield fetchHTML(detailUrl);
            const $ = Cheerio.load(html);
            const mediaList = [];
            let counter = 1;
            // Look for quality sections with download buttons
            $('h4, h3, p strong, p b').each((_, el) => {
                const $el = $(el);
                const text = $el.text().trim();
                if (text.match(/\d+p/) &&
                    (text.toLowerCase().includes('download') || text.match(/\[\d+[MG]B\]/))) {
                    const $next = $el.nextAll('p, div').first();
                    $next.find('a').each((_, linkEl) => {
                        const link = $(linkEl).attr('href') || '';
                        const linkText = $(linkEl).text().trim();
                        if (link && !link.includes('#') && !link.includes('javascript:')) {
                            mediaList.push({
                                type: 1, // MediaType.RawVideo
                                url: link.startsWith('http') ? link : BASE_URL + link,
                                name: `${text} - ${linkText}`,
                            });
                            counter++;
                        }
                    });
                }
            });
            // Fallback: any download-like links
            if (mediaList.length === 0) {
                $('a').each((_, el) => {
                    const $el = $(el);
                    const link = $el.attr('href') || '';
                    const text = $el.text().trim().toLowerCase();
                    if ((text.includes('g-direct') ||
                        text.includes('hubcloud') ||
                        text.includes('gdrive') ||
                        text.includes('instant download') ||
                        text.includes('download link') ||
                        text.includes('download now')) &&
                        link &&
                        !link.includes('#') &&
                        !link.includes('javascript:') &&
                        link !== BASE_URL + '/') {
                        mediaList.push({
                            type: 1,
                            url: link.startsWith('http') ? link : BASE_URL + link,
                            name: $el.text().trim(),
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
    search: (query, page) => __awaiter(this, void 0, void 0, function* () { return new MoviesModPlugin().search(query, page); }),
    getCategory: (category, page) => __awaiter(this, void 0, void 0, function* () { return new MoviesModPlugin().getCategory(category, page); }),
    getHomeCategories: () => __awaiter(this, void 0, void 0, function* () { return new MoviesModPlugin().getHomeCategories(); }),
    getItemDetails: (id) => __awaiter(this, void 0, void 0, function* () { return new MoviesModPlugin().getItemDetails(id); }),
    getItemMedia: (id) => __awaiter(this, void 0, void 0, function* () { return new MoviesModPlugin().getItemMedia(id); }),
};
