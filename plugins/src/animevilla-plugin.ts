// @ts-nocheck
// Umbrella Plugin for AnimeVilla (https://animevilla.in/)
// Modules available in sandbox: Cheerio, CryptoJS
// Built-in Node.js modules available via require()

const https = require('https');
const http = require('http');
const url = require('url');

const BASE_URL = 'https://animevilla.in';

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
            // Follow redirects
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
    const match = itemUrl.match(/\/anime\/([^/]+)\/?$/);
    return match ? match[1] : itemUrl;
}

// ─── Helper: Parse anime cards from a Cheerio context ───────────────────────
function parseAnimeCards($, container) {
    const items = [];

    // AnimeVilla uses a grid layout with anchor tags containing anime info
    // Each card has an image and a title link
    $(container)
        .find('a[href*="/anime/"]')
        .each((_, el) => {
            const $el = $(el);
            const href = $el.attr('href') || '';

            // Skip if not a valid anime link
            if (!href.includes('/anime/') || href.includes('/genre/')) return;

            const name = $el.text().trim();
            const img =
                $el.find('img').attr('src') ||
                $el.find('img').attr('data-src') ||
                $el.parent().find('img').attr('src') ||
                '';

            // Skip navigation links and very short text
            if (!name || name.length < 3) return;

            const slug = extractSlug(href);

            // Avoid duplicates
            const existing = items.find((i) => i.id === slug);
            if (existing) return;

            items.push({
                id: slug,
                name: name,
                description: '',
                imageUrl: img,
                url: href.startsWith('http') ? href : BASE_URL + href,
                type: 'Video',
            });
        });

    return items;
}

// ─── Helper: Parse items from a listing page ────────────────────────────────
function parseListingPage($) {
    const items = [];
    const seen = new Set();

    // Try finding cards in the main content grid
    $('a[href*="/anime/"]').each((_, el) => {
        const $el = $(el);
        const href = $el.attr('href') || '';

        if (!href.includes('/anime/')) return;
        if (href.includes('/genre/') || href.includes('/category/')) return;

        const slug = extractSlug(href);
        if (seen.has(slug)) return;
        seen.add(slug);

        // Look for the image inside the link or in the parent container
        let img =
            $el.find('img').attr('src') ||
            $el.find('img').attr('data-src') ||
            '';

        // If no image in the link itself, check the parent
        if (!img) {
            const $parent = $el.closest('div');
            img =
                $parent.find('img').attr('src') ||
                $parent.find('img').attr('data-src') ||
                '';
        }

        // Get the title - either from the link text or from nearby heading
        let name = $el.text().trim();
        if (!name || name.length < 3) {
            name = $el.attr('title') || '';
        }
        if (!name || name.length < 3) return;

        items.push({
            id: slug,
            name: name,
            description: '',
            imageUrl: img,
            url: href.startsWith('http') ? href : BASE_URL + href,
            type: 'Video',
        });
    });

    return items;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AnimeVilla Plugin Class
// ═══════════════════════════════════════════════════════════════════════════════
class AnimeVillaPlugin {
    // ─── Search ─────────────────────────────────────────────────────────────────
    async search(query, page) {
        const pageNum = page || 1;
        let searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
        if (pageNum > 1) {
            searchUrl += `&paged=${pageNum}`;
        }

        const html = await fetchHTML(searchUrl);
        const $ = Cheerio.load(html);

        const items = parseListingPage($);

        // Check for next page
        const hasNextPage =
            $('a.next, a.nextpostslink, .pagination a:contains("Next")').length > 0;

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
        let categoryUrl = `${BASE_URL}/genre/${category}/`;
        if (pageNum > 1) {
            categoryUrl += `page/${pageNum}/`;
        }

        const html = await fetchHTML(categoryUrl);
        const $ = Cheerio.load(html);

        const items = parseListingPage($);

        // Check for next page
        const hasNextPage =
            $('a.next, a.nextpostslink, .pagination a:contains("Next")').length > 0;

        // Get category name from page
        const categoryName =
            $('h1').first().text().trim() ||
            category.charAt(0).toUpperCase() + category.slice(1);

        return {
            name: categoryName,
            description: `Anime in the ${categoryName} genre`,
            url: categoryUrl,
            isPaginated: hasNextPage,
            nextPageNumber: hasNextPage ? pageNum + 1 : undefined,
            previousPageNumber: pageNum > 1 ? pageNum - 1 : undefined,
            items: items,
        };
    }

    // ─── Get Home Categories ────────────────────────────────────────────────────
    async getHomeCategories() {
        const html = await fetchHTML(BASE_URL);
        const $ = Cheerio.load(html);

        const categories = [];

        // Extract Trending section
        const trendingItems = [];
        const seen = new Set();

        // Find section headers and their content
        $('h2, h3, .section-title, [class*="heading"]').each((_, heading) => {
            const $heading = $(heading);
            const sectionName = $heading.text().trim();

            if (!sectionName || sectionName.length < 3) return;

            // Find the container after this heading
            const $container =
                $heading.next() || $heading.parent().next() || $heading.closest('section');

            const sectionItems = [];
            const sectionSeen = new Set();

            // Get anime links from this section
            $container.find('a[href*="/anime/"]').each((_, el) => {
                const $el = $(el);
                const href = $el.attr('href') || '';
                if (!href.includes('/anime/')) return;

                const slug = extractSlug(href);
                if (sectionSeen.has(slug)) return;
                sectionSeen.add(slug);

                const name = $el.text().trim() || $el.attr('title') || '';
                const img =
                    $el.find('img').attr('src') ||
                    $el.find('img').attr('data-src') ||
                    '';

                if (!name || name.length < 3) return;

                sectionItems.push({
                    id: slug,
                    name: name,
                    imageUrl: img,
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

        // If the heading-based approach didn't find categories,
        // fallback to extracting all items as one category
        if (categories.length === 0) {
            const allItems = parseListingPage($);
            if (allItems.length > 0) {
                categories.push({
                    name: 'Latest Anime',
                    description: 'Latest anime releases',
                    url: BASE_URL,
                    isPaginated: true,
                    nextPageNumber: 2,
                    items: allItems,
                });
            }
        }

        // Add genre categories for navigation
        const genres = [];
        $('a[href*="/genre/"]').each((_, el) => {
            const $el = $(el);
            const href = $el.attr('href') || '';
            const genreName = $el.text().trim();
            const genreMatch = href.match(/\/genre\/([^/]+)\/?$/);

            if (genreMatch && genreName && !genres.find((g) => g.name === genreName)) {
                genres.push({
                    id: genreMatch[1],
                    name: genreName,
                    url: href.startsWith('http') ? href : BASE_URL + href,
                });
            }
        });

        if (genres.length > 0) {
            categories.push({
                name: 'Genres',
                description: 'Browse by genre',
                url: BASE_URL,
                isPaginated: false,
                items: genres.slice(0, 20).map((g) => ({
                    id: g.id,
                    name: g.name,
                    imageUrl: '',
                    url: g.url,
                    type: 'Video',
                })),
            });
        }

        return categories;
    }

    // ─── Get Item Details ───────────────────────────────────────────────────────
    async getItemDetails(id) {
        const detailUrl = `${BASE_URL}/anime/${id}/`;
        const html = await fetchHTML(detailUrl);
        const $ = Cheerio.load(html);

        // Title
        const title =
            $('h1').first().text().trim() || $('title').text().trim() || id;

        // Image/Poster
        const imageUrl =
            $('img.object-cover').first().attr('src') ||
            $('meta[property="og:image"]').attr('content') ||
            $('img[class*="poster"]').first().attr('src') ||
            $('article img').first().attr('src') ||
            '';

        // Synopsis/Description
        let synopsis = '';
        $('p, div[class*="synopsis"], div[class*="description"], .entry-content p').each(
            (_, el) => {
                const text = $(el).text().trim();
                if (text.length > 50 && !synopsis) {
                    synopsis = text;
                }
            }
        );
        if (!synopsis) {
            synopsis =
                $('meta[property="og:description"]').attr('content') ||
                $('meta[name="description"]').attr('content') ||
                '';
        }

        // Genres
        const genres = [];
        $('a[href*="/genre/"]').each((_, el) => {
            const $el = $(el);
            const href = $el.attr('href') || '';
            const genreName = $el.text().trim();
            const genreMatch = href.match(/\/genre\/([^/]+)\/?$/);

            if (genreMatch && genreName) {
                genres.push({
                    id: genreMatch[1],
                    name: genreName,
                    url: href.startsWith('http') ? href : BASE_URL + href,
                });
            }
        });

        // Episodes/Media items from download section
        const media = [];
        let episodeCounter = 1;

        // Look for download section items
        $('.download-section-item, [class*="download-section"] a, .download-section-item-link').each(
            (_, el) => {
                const $el = $(el);
                const episodeName =
                    $el.find('.download-section-item-title').text().trim() ||
                    $el.text().trim() ||
                    `Episode ${episodeCounter}`;
                const link = $el.attr('href') || $el.find('a').attr('href') || '';

                if (link) {
                    media.push({
                        id: `${id}-ep-${episodeCounter}`,
                        name: episodeName,
                        type: 1, // MediaType.RawVideo
                        url: link.startsWith('http') ? link : BASE_URL + link,
                        number: episodeCounter,
                    });
                    episodeCounter++;
                }
            }
        );

        // If no download section items found, try other patterns
        if (media.length === 0) {
            $('a[href*="hsalinks"], a[href*="download"], a[class*="download"]').each(
                (_, el) => {
                    const $el = $(el);
                    const link = $el.attr('href') || '';
                    const name = $el.text().trim() || `Episode ${episodeCounter}`;

                    if (link) {
                        media.push({
                            id: `${id}-ep-${episodeCounter}`,
                            name: name,
                            type: 1, // MediaType.RawVideo
                            url: link.startsWith('http') ? link : BASE_URL + link,
                            number: episodeCounter,
                        });
                        episodeCounter++;
                    }
                }
            );
        }

        // Status
        let status = '';
        $('span, div').each((_, el) => {
            const text = $(el).text().trim().toLowerCase();
            if (text === 'completed' || text === 'ongoing' || text === 'upcoming') {
                status = text.charAt(0).toUpperCase() + text.slice(1);
            }
        });

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
            status: status || undefined,
        };
    }

    // ─── Get Item Media ─────────────────────────────────────────────────────────
    async getItemMedia(id) {
        const detailUrl = `${BASE_URL}/anime/${id}/`;
        const html = await fetchHTML(detailUrl);
        const $ = Cheerio.load(html);

        const mediaList = [];
        let counter = 1;

        // Primary: download section items
        $('.download-section-item-link, .download-section-item a').each((_, el) => {
            const $el = $(el);
            const link = $el.attr('href') || '';
            const name =
                $el.closest('.download-section-item').find('.download-section-item-title').text().trim() ||
                $el.text().trim() ||
                `Episode ${counter}`;

            if (link) {
                mediaList.push({
                    type: 1, // MediaType.RawVideo
                    url: link.startsWith('http') ? link : BASE_URL + link,
                    name: name,
                });
                counter++;
            }
        });

        // Fallback: any download-related links
        if (mediaList.length === 0) {
            $('a[href*="hsalinks"], a[href*="download"], a[class*="download"]').each(
                (_, el) => {
                    const $el = $(el);
                    const link = $el.attr('href') || '';
                    const name = $el.text().trim() || `Episode ${counter}`;

                    if (link && !link.includes('#')) {
                        mediaList.push({
                            type: 1, // MediaType.RawVideo
                            url: link.startsWith('http') ? link : BASE_URL + link,
                            name: name,
                        });
                        counter++;
                    }
                }
            );
        }

        return mediaList;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Export plugin methods (required by Umbrella sandbox)
// ═══════════════════════════════════════════════════════════════════════════════
module.exports = {
    search: async (query, page) => new AnimeVillaPlugin().search(query, page),
    getCategory: async (category, page) =>
        new AnimeVillaPlugin().getCategory(category, page),
    getHomeCategories: async () => new AnimeVillaPlugin().getHomeCategories(),
    getItemDetails: async (id) => new AnimeVillaPlugin().getItemDetails(id),
    getItemMedia: async (id) => new AnimeVillaPlugin().getItemMedia(id),
};
