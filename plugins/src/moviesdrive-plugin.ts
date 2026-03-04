// @ts-nocheck
// Umbrella Plugin for MoviesDrive (https://new1.moviesdrive.surf/)
// Modules available in sandbox: Cheerio, CryptoJS
// Built-in Node.js modules available via require()

const https = require('https');
const http = require('http');
const url = require('url');

const BASE_URL = 'https://new1.moviesdrive.surf';

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
    try {
        const path = url.parse(itemUrl).pathname || '';
        const segments = path.split('/').filter(Boolean);
        return segments[segments.length - 1] || itemUrl;
    } catch {
        return itemUrl;
    }
}

// ─── Helper: Parse movie cards from WordPress-style page ─────────────────────
function parseCards($) {
    const items = [];
    const seen = new Set();

    // MoviesDrive uses WordPress themes with post grids
    $('article, .post-item, .movies-grid > a, .result-item, .post').each((_, el) => {
        const $el = $(el);
        const $link = $el.is('a') ? $el : $el.find('a').first();
        const href = $link.attr('href') || '';

        if (!href || href === '#') return;
        if (href.includes('/category/') || href.includes('/tag/') || href.includes('/page/')) return;

        const slug = extractSlug(href);
        if (seen.has(slug)) return;
        seen.add(slug);

        const title = $el.find('.entry-title, h2, h3').text().trim() ||
            $link.attr('title') ||
            $el.find('img').attr('alt') ||
            $link.text().trim() || '';

        if (!title || title.length < 3) return;

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

    // Fallback: anchor + image based
    if (items.length === 0) {
        $('a[href]').each((_, el) => {
            const $el = $(el);
            const href = $el.attr('href') || '';
            const img = $el.find('img').attr('src') || '';

            if (!img || !href || href === '#') return;
            if (href.includes('/category/') || href.includes('/tag/') || href.includes('/page/')) return;

            const slug = extractSlug(href);
            if (seen.has(slug)) return;
            seen.add(slug);

            const title = $el.find('img').attr('alt') ||
                $el.attr('title') || '';

            if (!title || title.length < 3) return;

            items.push({
                id: slug,
                name: title.replace(/^Download\s+/i, '').trim(),
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
// MoviesDrive Plugin Class
// ═══════════════════════════════════════════════════════════════════════════════
class MoviesDrivePlugin {
    // ─── Search ─────────────────────────────────────────────────────────────────
    async search(query, page) {
        const pageNum = page || 1;
        let searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
        if (pageNum > 1) {
            searchUrl = `${BASE_URL}/page/${pageNum}/?s=${encodeURIComponent(query)}`;
        }

        const html = await fetchHTML(searchUrl);
        const $ = Cheerio.load(html);
        const items = parseCards($);

        const hasNextPage = $('a.next, a.nextpostslink, .pagination a:contains("Next")').length > 0 ||
            items.length >= 10;

        return {
            name: `Search: ${query}`,
            description: `Search results for "${query}"`,
            url: searchUrl,
            isPaginated: hasNextPage,
            nextPageNumber: hasNextPage ? pageNum + 1 : undefined,
            previousPageNumber: pageNum > 1 ? pageNum - 1 : undefined,
            items: items,
        };
    }

    // ─── Get Category ───────────────────────────────────────────────────────────
    async getCategory(category, page) {
        const pageNum = page || 1;
        let categoryUrl = `${BASE_URL}/category/${category}/`;
        if (pageNum > 1) {
            categoryUrl += `page/${pageNum}/`;
        }

        const html = await fetchHTML(categoryUrl);
        const $ = Cheerio.load(html);
        const items = parseCards($);

        const hasNextPage = $('a.next, .pagination a:contains("Next")').length > 0 ||
            items.length >= 10;

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
    }

    // ─── Get Home Categories ────────────────────────────────────────────────────
    async getHomeCategories() {
        const categories = [];

        const html = await fetchHTML(BASE_URL);
        const $ = Cheerio.load(html);

        const homeItems = parseCards($);
        if (homeItems.length > 0) {
            categories.push({
                name: 'Latest',
                description: 'Latest releases',
                url: BASE_URL,
                isPaginated: true,
                nextPageNumber: 2,
                items: homeItems,
            });
        }

        // Predefined categories
        const categoryPages = [
            { slug: 'bollywood', name: 'Bollywood Movies' },
            { slug: 'hollywood', name: 'Hollywood Movies' },
            { slug: 'web-series', name: 'Web Series' },
            { slug: 'south-indian', name: 'South Indian Movies' },
        ];

        for (const cat of categoryPages) {
            try {
                const catHtml = await fetchHTML(`${BASE_URL}/category/${cat.slug}/`);
                const $cat = Cheerio.load(catHtml);
                const catItems = parseCards($cat);
                if (catItems.length > 0) {
                    categories.push({
                        name: cat.name,
                        description: `Browse ${cat.name}`,
                        url: `${BASE_URL}/category/${cat.slug}/`,
                        isPaginated: true,
                        nextPageNumber: 2,
                        items: catItems.slice(0, 15),
                    });
                }
            } catch (e) {
                // Skip
            }
        }

        return categories;
    }

    // ─── Get Item Details ───────────────────────────────────────────────────────
    async getItemDetails(id) {
        const detailUrl = id.startsWith('http') ? id : `${BASE_URL}/${id}/`;
        const html = await fetchHTML(detailUrl);
        const $ = Cheerio.load(html);

        const title = ($('h1.entry-title, h1').first().text().trim() ||
            $('title').text().trim() || id)
            .replace(/^Download\s+/i, '')
            .replace(/\s*[-–|].*MoviesDrive.*$/i, '');

        const imageUrl = $('meta[property="og:image"]').attr('content') ||
            $('.entry-content img, article img').first().attr('src') || '';

        let synopsis = $('meta[property="og:description"]').attr('content') ||
            $('meta[name="description"]').attr('content') || '';

        // Look for proper synopsis in content
        $('.entry-content p').each((_, el) => {
            const text = $(el).text().trim();
            if (text.length > 80 && !synopsis) {
                synopsis = text;
            }
        });

        // Extract genres
        const genres = [];
        $('a[rel="tag"], a[href*="/category/"], a[href*="/genre/"]').each((_, el) => {
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

        // Extract download links
        const media = [];
        let counter = 1;

        // Look for GoogleDrive, hubcloud, gdflix type links
        $('a[href*="gdflix"], a[href*="hubcloud"], a[href*="drive"], a[href*="links"]').each((_, el) => {
            const link = $(el).attr('href') || '';
            const name = $(el).text().trim() || `Link ${counter}`;

            if (link && link !== '#') {
                media.push({
                    id: `${id}-link-${counter}`,
                    name: name,
                    type: 1,
                    url: link,
                    number: counter,
                });
                counter++;
            }
        });

        // Fallback: download-related links
        if (media.length === 0) {
            $('a[href]').each((_, el) => {
                const link = $(el).attr('href') || '';
                const text = $(el).text().trim();
                if (link && link !== '#' &&
                    !link.includes(BASE_URL) &&
                    !link.includes('imdb') &&
                    (text.toLowerCase().includes('download') ||
                        text.toLowerCase().includes('480p') ||
                        text.toLowerCase().includes('720p') ||
                        text.toLowerCase().includes('1080p') ||
                        text.toLowerCase().includes('gdrive'))) {
                    media.push({
                        id: `${id}-link-${counter}`,
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

        $('a[href*="gdflix"], a[href*="hubcloud"], a[href*="drive"], a[href*="links"]').each((_, el) => {
            const link = $(el).attr('href') || '';
            const name = $(el).text().trim() || `Link ${counter}`;

            if (link && link !== '#') {
                mediaList.push({
                    type: 1,
                    url: link,
                    name: name,
                });
                counter++;
            }
        });

        if (mediaList.length === 0) {
            $('a[href]').each((_, el) => {
                const link = $(el).attr('href') || '';
                const text = $(el).text().trim();
                if (link && link !== '#' &&
                    !link.includes(BASE_URL) &&
                    !link.includes('imdb') &&
                    !link.includes('facebook') &&
                    !link.includes('twitter') &&
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
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Export plugin methods (required by Umbrella sandbox)
// ═══════════════════════════════════════════════════════════════════════════════
module.exports = {
    search: async (query, page) => new MoviesDrivePlugin().search(query, page),
    getCategory: async (category, page) =>
        new MoviesDrivePlugin().getCategory(category, page),
    getHomeCategories: async () => new MoviesDrivePlugin().getHomeCategories(),
    getItemDetails: async (id) => new MoviesDrivePlugin().getItemDetails(id),
    getItemMedia: async (id) => new MoviesDrivePlugin().getItemMedia(id),
};
