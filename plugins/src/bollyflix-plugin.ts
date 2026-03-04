// @ts-nocheck
// Umbrella Plugin for BollyFlix (https://bollyflix.sarl/)
// Modules available in sandbox: Cheerio, CryptoJS
// Built-in Node.js modules available via require()

const https = require('https');
const http = require('http');
const url = require('url');

const BASE_URL = 'https://bollyflix.sarl';

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

// ─── Helper: Parse movie/series cards ────────────────────────────────────────
function parseCards($) {
    const items = [];
    const seen = new Set();

    // BollyFlix uses article cards in post grids
    $('div.post-cards > article, article.post-card, .movies-grid > a, .post-filter-item').each((_, el) => {
        const $el = $(el);
        const $link = $el.is('a') ? $el : $el.find('a').first();
        const href = $link.attr('href') || '';

        if (!href || href === '#') return;

        const slug = extractSlug(href);
        if (seen.has(slug)) return;
        seen.add(slug);

        const title = $link.attr('title') ||
            $el.find('h2, h3, .entry-title').text().trim() ||
            $link.text().trim() || '';

        if (!title || title.length < 2) return;

        const img = $el.find('img').attr('src') ||
            $el.find('img').attr('data-src') ||
            $el.find('img').attr('data-lazy-src') || '';

        const cleanTitle = title.replace(/^Download\s+/i, '').trim();

        items.push({
            id: slug,
            name: cleanTitle,
            description: '',
            imageUrl: img,
            url: href.startsWith('http') ? href : BASE_URL + href,
            type: 'Video',
        });
    });

    // Fallback: generic anchor-based parsing
    if (items.length === 0) {
        $('a[href]').each((_, el) => {
            const $el = $(el);
            const href = $el.attr('href') || '';
            if (!href.includes(BASE_URL) || href === BASE_URL + '/') return;
            if (href.includes('/category/') || href.includes('/tag/') || href.includes('/page/')) return;

            const slug = extractSlug(href);
            if (seen.has(slug)) return;
            seen.add(slug);

            const img = $el.find('img').attr('src') || '';
            if (!img) return;

            const title = $el.find('img').attr('alt') ||
                $el.attr('title') ||
                $el.text().trim() || '';

            if (!title || title.length < 3) return;

            items.push({
                id: slug,
                name: title.replace(/^Download\s+/i, '').trim(),
                description: '',
                imageUrl: img,
                url: href,
                type: 'Video',
            });
        });
    }

    return items;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BollyFlix Plugin Class
// ═══════════════════════════════════════════════════════════════════════════════
class BollyFlixPlugin {
    // ─── Search ─────────────────────────────────────────────────────────────────
    async search(query, page) {
        const pageNum = page || 1;
        const searchUrl = `${BASE_URL}/search/${encodeURIComponent(query)}/page/${pageNum}/`;

        const html = await fetchHTML(searchUrl);
        const $ = Cheerio.load(html);
        const items = parseCards($);

        const hasNextPage = items.length >= 10;

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
        let categoryUrl = `${BASE_URL}/${category}/`;
        if (pageNum > 1) {
            categoryUrl += `page/${pageNum}/`;
        }

        const html = await fetchHTML(categoryUrl);
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
    }

    // ─── Get Home Categories ────────────────────────────────────────────────────
    async getHomeCategories() {
        const categories = [];

        // Fetch home page
        const html = await fetchHTML(BASE_URL);
        const $ = Cheerio.load(html);

        // Latest/Home items
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

        // Predefined categories from CSX BollyFlix provider
        const categoryPages = [
            { slug: 'movies/bollywood', name: 'Bollywood Movies' },
            { slug: 'movies/hollywood', name: 'Hollywood Movies' },
            { slug: 'web-series', name: 'Web Series' },
            { slug: 'anime', name: 'Anime' },
        ];

        for (const cat of categoryPages) {
            try {
                const catHtml = await fetchHTML(`${BASE_URL}/${cat.slug}/`);
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
            } catch (e) {
                // Skip category on error
            }
        }

        return categories;
    }

    // ─── Get Item Details ───────────────────────────────────────────────────────
    async getItemDetails(id) {
        const detailUrl = id.startsWith('http') ? id : `${BASE_URL}/${id}/`;
        const html = await fetchHTML(detailUrl);
        const $ = Cheerio.load(html);

        const title = ($('title').first().text().trim() || id)
            .replace(/^Download\s+/i, '')
            .replace(/\s*[-–|].*$/, '');

        const imageUrl = $('meta[property="og:image"]').attr('content') ||
            $('p > img, .entry-content img').first().attr('src') || '';

        let synopsis = $('span#summary').text().trim() ||
            $('meta[property="og:description"]').attr('content') ||
            $('meta[name="description"]').attr('content') || '';

        // Detect type
        const isSeries = title.toLowerCase().includes('series') ||
            detailUrl.includes('web-series');

        // Extract genres from tags
        const genres = [];
        $('a[href*="/category/"], a[href*="/genre/"], .genre-tag').each((_, el) => {
            const $el = $(el);
            const name = $el.text().trim();
            const href = $el.attr('href') || '';
            if (name && name.length > 1 && !genres.find(g => g.name === name)) {
                genres.push({
                    id: extractSlug(href),
                    name: name,
                    url: href.startsWith('http') ? href : BASE_URL + href,
                });
            }
        });

        // Extract IMDB info
        const imdbUrl = $('a[href*="imdb.com"]').attr('href') || '';

        // Extract download/episode links
        const media = [];
        let counter = 1;

        $('a[href*="hubcloud"], a[href*="gdflix"], a[href*="links"]').each((_, el) => {
            const $el = $(el);
            const link = $el.attr('href') || '';
            const name = $el.text().trim() || `Link ${counter}`;

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

        // Also check heading-based download sections
        if (media.length === 0) {
            $('h3, h4, h5').each((_, heading) => {
                const $heading = $(heading);
                const headingText = $heading.text().trim();
                if (headingText.toLowerCase().includes('download') ||
                    headingText.toLowerCase().includes('links')) {
                    $heading.nextAll('a, p a').each((_, el) => {
                        const link = $(el).attr('href') || '';
                        const name = $(el).text().trim() || `Link ${counter}`;
                        if (link && link !== '#' && !link.includes('imdb.com')) {
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
            status: isSeries ? 'Series' : 'Movie',
        };
    }

    // ─── Get Item Media ─────────────────────────────────────────────────────────
    async getItemMedia(id) {
        const detailUrl = id.startsWith('http') ? id : `${BASE_URL}/${id}/`;
        const html = await fetchHTML(detailUrl);
        const $ = Cheerio.load(html);

        const mediaList = [];
        let counter = 1;

        // Primary: hubcloud/gdflix links
        $('a[href*="hubcloud"], a[href*="gdflix"], a[href*="links"]').each((_, el) => {
            const $el = $(el);
            const link = $el.attr('href') || '';
            const name = $el.text().trim() || `Link ${counter}`;

            if (link && link !== '#') {
                mediaList.push({
                    type: 1,
                    url: link,
                    name: name,
                });
                counter++;
            }
        });

        // Fallback
        if (mediaList.length === 0) {
            $('a[href]').each((_, el) => {
                const $el = $(el);
                const link = $el.attr('href') || '';
                const name = $el.text().trim() || '';

                if (link && link !== '#' &&
                    !link.includes(BASE_URL) &&
                    !link.includes('imdb.com') &&
                    !link.includes('facebook') &&
                    !link.includes('twitter') &&
                    !link.includes('instagram') &&
                    (name.toLowerCase().includes('download') ||
                        name.toLowerCase().includes('watch') ||
                        name.toLowerCase().includes('480p') ||
                        name.toLowerCase().includes('720p') ||
                        name.toLowerCase().includes('1080p'))) {
                    mediaList.push({
                        type: 1,
                        url: link,
                        name: name || `Link ${counter}`,
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
    search: async (query, page) => new BollyFlixPlugin().search(query, page),
    getCategory: async (category, page) =>
        new BollyFlixPlugin().getCategory(category, page),
    getHomeCategories: async () => new BollyFlixPlugin().getHomeCategories(),
    getItemDetails: async (id) => new BollyFlixPlugin().getItemDetails(id),
    getItemMedia: async (id) => new BollyFlixPlugin().getItemMedia(id),
};
