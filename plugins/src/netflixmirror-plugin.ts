// @ts-nocheck
// Umbrella Plugin for NetflixMirror (https://net22.cc/)
// Modules available in sandbox: Cheerio, CryptoJS
// Built-in Node.js modules available via require()

const https = require('https');
const http = require('http');
const url = require('url');

const BASE_URL = 'https://net22.cc';

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
                'User-Agent':
                    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                Accept:
                    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                Referer: BASE_URL + '/',
            },
        };

        const req = client.request(options, (res) => {
            if (
                res.statusCode >= 300 &&
                res.statusCode < 400 &&
                res.headers.location
            ) {
                const redirectUrl = res.headers.location.startsWith('http')
                    ? res.headers.location
                    : `${parsedUrl.protocol}//${parsedUrl.hostname}${res.headers.location}`;
                fetchHTML(redirectUrl).then(resolve).catch(reject);
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

// ─── Helper: Fetch JSON from a URL ──────────────────────────────────────────
function fetchJSON(targetUrl) {
    return new Promise((resolve, reject) => {
        const parsedUrl = url.parse(targetUrl);
        const client = parsedUrl.protocol === 'https:' ? https : http;
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.path,
            method: 'GET',
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                Accept: 'application/json, text/plain, */*',
                Referer: BASE_URL + '/',
            },
        };

        const req = client.request(options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchJSON(res.headers.location).then(resolve).catch(reject);
                return;
            }
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    resolve(null);
                }
            });
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
    } catch {
        return itemUrl;
    }
}

// ─── Helper: Parse cards from page ──────────────────────────────────────────
function parseCards($) {
    const items = [];
    const seen = new Set();

    // NetflixMirror card layouts
    $('a.post-data, .post-card, .card, .movie-card, .content-card, article').each((_, el) => {
        const $el = $(el);
        const $link = $el.is('a') ? $el : $el.find('a').first();
        const href = $link.attr('href') || '';

        if (!href || href === '#') return;
        if (href.includes('/category/') || href.includes('/tag/') || href.includes('/page/')) return;

        const slug = extractSlug(href);
        if (seen.has(slug)) return;
        seen.add(slug);

        const title = $el.find('.card-title, .title, h2, h3').text().trim() ||
            $el.find('img').attr('alt') ||
            $link.attr('title') || '';

        if (!title || title.length < 2) return;

        const img = $el.find('img').attr('src') ||
            $el.find('img').attr('data-src') || '';

        items.push({
            id: slug,
            name: title.replace(/^Download\s+/i, '').trim(),
            description: '',
            imageUrl: img.startsWith('http') ? img : (img ? BASE_URL + img : ''),
            url: href.startsWith('http') ? href : BASE_URL + href,
            type: 'Video',
        });
    });

    // Fallback for generic layouts
    if (items.length === 0) {
        $('a[href]').each((_, el) => {
            const $el = $(el);
            const href = $el.attr('href') || '';
            const img = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';

            if (!img || !href || href === '#') return;

            const slug = extractSlug(href);
            if (seen.has(slug)) return;
            seen.add(slug);

            const title = $el.find('img').attr('alt') || $el.attr('title') || '';
            if (!title || title.length < 2) return;

            items.push({
                id: slug,
                name: title.trim(),
                description: '',
                imageUrl: img.startsWith('http') ? img : BASE_URL + img,
                url: href.startsWith('http') ? href : BASE_URL + href,
                type: 'Video',
            });
        });
    }

    return items;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NetflixMirror Plugin Class
// ═══════════════════════════════════════════════════════════════════════════════
class NetflixMirrorPlugin {
    // ─── Search ─────────────────────────────────────────────────────────────────
    async search(query, page) {
        const pageNum = page || 1;

        // Try search API endpoint first
        try {
            const searchUrl = `${BASE_URL}/search.php?s=${encodeURIComponent(query)}&page=${pageNum}`;
            const json = await fetchJSON(searchUrl);
            if (json && Array.isArray(json)) {
                const items = json.map((item, idx) => ({
                    id: item.id || item.slug || `item-${idx}`,
                    name: (item.title || item.name || '').replace(/^Download\s+/i, ''),
                    description: item.description || '',
                    imageUrl: item.poster || item.image || item.thumbnail || '',
                    url: item.url || item.link || `${BASE_URL}/${item.slug || item.id}/`,
                    type: 'Video',
                })).filter(i => i.name.length > 0);

                return {
                    name: `Search: ${query}`,
                    description: `Results for "${query}"`,
                    url: searchUrl,
                    isPaginated: items.length >= 10,
                    nextPageNumber: items.length >= 10 ? pageNum + 1 : undefined,
                    previousPageNumber: pageNum > 1 ? pageNum - 1 : undefined,
                    items: items,
                };
            }
        } catch (e) {
            // Fallback to HTML search
        }

        // Fallback: HTML search
        const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
        const html = await fetchHTML(searchUrl);
        const $ = Cheerio.load(html);
        const items = parseCards($);

        return {
            name: `Search: ${query}`,
            description: `Results for "${query}"`,
            url: searchUrl,
            isPaginated: items.length >= 10,
            nextPageNumber: items.length >= 10 ? pageNum + 1 : undefined,
            previousPageNumber: pageNum > 1 ? pageNum - 1 : undefined,
            items: items,
        };
    }

    // ─── Get Category ───────────────────────────────────────────────────────────
    async getCategory(category, page) {
        const pageNum = page || 1;
        let categoryUrl = `${BASE_URL}/${category}/`;
        if (pageNum > 1) {
            categoryUrl += `page/${pageNum}/`;
        }

        const html = await fetchHTML(categoryUrl);
        const $ = Cheerio.load(html);
        const items = parseCards($);

        const categoryName = $('h1').first().text().trim() ||
            category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        return {
            name: categoryName,
            description: `Browse ${categoryName}`,
            url: categoryUrl,
            isPaginated: items.length >= 10,
            nextPageNumber: items.length >= 10 ? pageNum + 1 : undefined,
            previousPageNumber: pageNum > 1 ? pageNum - 1 : undefined,
            items: items,
        };
    }

    // ─── Get Home Categories ────────────────────────────────────────────────────
    async getHomeCategories() {
        const categories = [];

        const html = await fetchHTML(BASE_URL);
        const $ = Cheerio.load(html);

        const homeItems = parseCards($);
        if (homeItems.length > 0) {
            categories.push({
                name: 'Trending',
                description: 'Trending content',
                url: BASE_URL,
                isPaginated: true,
                nextPageNumber: 2,
                items: homeItems,
            });
        }

        // Try finding section-based categories on the page
        $('h2, h3, [class*="section-title"]').each((_, heading) => {
            const $heading = $(heading);
            const sectionName = $heading.text().trim();
            if (!sectionName || sectionName.length < 3 || sectionName.length > 50) return;

            const $container = $heading.next();
            const sectionItems = [];
            const sectionSeen = new Set();

            $container.find('a[href]').each((_, el) => {
                const $el = $(el);
                const href = $el.attr('href') || '';
                if (!href || href === '#') return;

                const slug = extractSlug(href);
                if (sectionSeen.has(slug)) return;
                sectionSeen.add(slug);

                const img = $el.find('img').attr('src') || '';
                const name = $el.find('img').attr('alt') || $el.text().trim() || '';
                if (!name || name.length < 2) return;

                sectionItems.push({
                    id: slug,
                    name: name,
                    imageUrl: img.startsWith('http') ? img : (img ? BASE_URL + img : ''),
                    url: href.startsWith('http') ? href : BASE_URL + href,
                    type: 'Video',
                });
            });

            if (sectionItems.length > 0) {
                categories.push({
                    name: sectionName,
                    url: BASE_URL,
                    isPaginated: false,
                    items: sectionItems,
                });
            }
        });

        return categories;
    }

    // ─── Get Item Details ───────────────────────────────────────────────────────
    async getItemDetails(id) {
        const detailUrl = id.startsWith('http') ? id : `${BASE_URL}/${id}/`;
        const html = await fetchHTML(detailUrl);
        const $ = Cheerio.load(html);

        const title = $('h1').first().text().trim() ||
            $('title').text().trim().replace(/\s*[-–|].*$/, '') || id;

        const imageUrl = $('meta[property="og:image"]').attr('content') ||
            $('img.poster, img.cover, .entry-content img').first().attr('src') || '';

        let synopsis = $('meta[property="og:description"]').attr('content') ||
            $('meta[name="description"]').attr('content') || '';

        if (!synopsis) {
            $('p').each((_, el) => {
                const text = $(el).text().trim();
                if (text.length > 60 && !synopsis) {
                    synopsis = text;
                }
            });
        }

        const genres = [];
        $('a[href*="/genre/"], a[href*="/category/"], .genre, .tag').each((_, el) => {
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

        // Extract episodes/seasons
        const media = [];
        let counter = 1;

        // Look for episode/season links
        $('a[href*="episode"], a[href*="watch"], a[href*="play"], a[href*="stream"]').each((_, el) => {
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

        // Fallback: any video/download related links
        if (media.length === 0) {
            $('a[href]').each((_, el) => {
                const link = $(el).attr('href') || '';
                const text = $(el).text().trim();
                if (link && link !== '#' &&
                    !link.includes(BASE_URL) &&
                    (text.toLowerCase().includes('watch') ||
                        text.toLowerCase().includes('play') ||
                        text.toLowerCase().includes('stream') ||
                        text.toLowerCase().includes('download'))) {
                    media.push({
                        id: `${id}-ep-${counter}`,
                        name: text || `Link ${counter}`,
                        type: 1,
                        url: link,
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
    }

    // ─── Get Item Media ─────────────────────────────────────────────────────────
    async getItemMedia(id) {
        const detailUrl = id.startsWith('http') ? id : `${BASE_URL}/${id}/`;
        const html = await fetchHTML(detailUrl);
        const $ = Cheerio.load(html);

        const mediaList = [];
        let counter = 1;

        $('a[href*="episode"], a[href*="watch"], a[href*="play"], a[href*="stream"]').each((_, el) => {
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

        if (mediaList.length === 0) {
            $('iframe[src], video source[src]').each((_, el) => {
                const src = $(el).attr('src') || '';
                if (src) {
                    mediaList.push({
                        type: 1,
                        url: src.startsWith('http') ? src : BASE_URL + src,
                        name: `Stream ${counter}`,
                    });
                    counter++;
                }
            });
        }

        return mediaList;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Export plugin methods (required by Umbrella sandbox)
// ═══════════════════════════════════════════════════════════════════════════════
module.exports = {
    search: async (query, page) => new NetflixMirrorPlugin().search(query, page),
    getCategory: async (category, page) =>
        new NetflixMirrorPlugin().getCategory(category, page),
    getHomeCategories: async () => new NetflixMirrorPlugin().getHomeCategories(),
    getItemDetails: async (id) => new NetflixMirrorPlugin().getItemDetails(id),
    getItemMedia: async (id) => new NetflixMirrorPlugin().getItemMedia(id),
};
