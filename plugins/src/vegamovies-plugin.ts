// @ts-nocheck
// Umbrella Plugin for VegaMovies (https://vegamovies.mobile/)
// Modules available in sandbox: Cheerio, CryptoJS
// Built-in Node.js modules available via require()

const https = require('https');
const http = require('http');
const url = require('url');

const BASE_URL = 'https://vegamovies.mobile';

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
    // Handle URLs like /download-movie-name-480p-720p-1080p/
    const match = itemUrl.match(/\/([^/]+)\/?$/);
    return match ? match[1] : itemUrl;
}

// ─── Helper: Clean title text ───────────────────────────────────────────────
function cleanTitle(rawTitle) {
    // Remove "Download" prefix and quality/size info
    return rawTitle
        .replace(/^Download\s+/i, '')
        .replace(/\s*\(?\d+p\s*\[.*?\]\s*(\|\|.*?)?\)?/g, '')
        .replace(/\s*WEB-DL.*$/i, '')
        .replace(/\s*WeB-DL.*$/i, '')
        .replace(/\s*BluRay.*$/i, '')
        .replace(/\s*HDRip.*$/i, '')
        .trim();
}

// ─── Helper: Parse movie cards from listing pages ───────────────────────────
function parseMovieCards($) {
    const items = [];
    const seen = new Set();

    // WordPress article-based posts
    $('article, .post, .blog-post, .entry').each((_, el) => {
        const $el = $(el);

        // Get the title link
        const $titleLink =
            $el.find('h2 a, h3 a, .entry-title a, .post-title a').first();
        let href = $titleLink.attr('href') || '';
        let name = $titleLink.text().trim();

        // Fallback: try any prominent link
        if (!href) {
            const $link = $el.find('a[href*="download"], a[href*="vegamovies"]').first();
            href = $link.attr('href') || '';
            name = name || $link.text().trim();
        }

        if (!href || !name) return;

        const slug = extractSlug(href);
        if (seen.has(slug)) return;
        seen.add(slug);

        // Clean up the title
        const cleanedName = cleanTitle(name);

        // Get image
        const img =
            $el.find('img').first().attr('src') ||
            $el.find('img').first().attr('data-lazy-src') ||
            $el.find('img').first().attr('data-src') ||
            '';

        // Get description/excerpt
        const description =
            $el.find('.entry-content p, .post-content p, .excerpt').first().text().trim() || '';

        items.push({
            id: slug,
            name: cleanedName || name,
            description: description.substring(0, 200),
            imageUrl: img,
            url: href.startsWith('http') ? href : BASE_URL + href,
            type: 'Video',
        });
    });

    // Fallback: if no articles found, try generic link patterns
    if (items.length === 0) {
        $('a[href*="/download-"]').each((_, el) => {
            const $el = $(el);
            const href = $el.attr('href') || '';
            const name = $el.text().trim();

            if (!href || !name || name.length < 5) return;

            const slug = extractSlug(href);
            if (seen.has(slug)) return;
            seen.add(slug);

            const img =
                $el.find('img').attr('src') ||
                $el.closest('article, .post, div').find('img').first().attr('src') ||
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
// VegaMovies Plugin Class
// ═══════════════════════════════════════════════════════════════════════════════
class VegaMoviesPlugin {
    // ─── Search ─────────────────────────────────────────────────────────────────
    async search(query, page) {
        const pageNum = page || 1;
        let searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
        if (pageNum > 1) {
            searchUrl = `${BASE_URL}/page/${pageNum}/?s=${encodeURIComponent(query)}`;
        }

        const html = await fetchHTML(searchUrl);
        const $ = Cheerio.load(html);

        const items = parseMovieCards($);

        // Check for next page
        const hasNextPage =
            $('a.next, .nav-previous a, .pagination a.next, a:contains("Next")').length > 0 ||
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

        const items = parseMovieCards($);

        const hasNextPage =
            $('a.next, .nav-previous a, .pagination a.next').length > 0;

        const categoryName =
            $('h1.page-title, h1.entry-title, .archive-title').first().text().trim() ||
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
    }

    // ─── Get Home Categories ────────────────────────────────────────────────────
    async getHomeCategories() {
        const html = await fetchHTML(BASE_URL);
        const $ = Cheerio.load(html);

        const categories = [];

        // Get latest movies from homepage
        const latestItems = parseMovieCards($);
        if (latestItems.length > 0) {
            categories.push({
                name: 'Latest Movies',
                description: 'Latest movie releases',
                url: BASE_URL,
                isPaginated: true,
                nextPageNumber: 2,
                items: latestItems,
            });
        }

        // Extract navigation categories
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
    }

    // ─── Get Item Details ───────────────────────────────────────────────────────
    async getItemDetails(id) {
        const detailUrl = `${BASE_URL}/${id}/`;
        const html = await fetchHTML(detailUrl);
        const $ = Cheerio.load(html);

        // Title
        const rawTitle =
            $('h1.entry-title, h1.post-title, h1').first().text().trim() ||
            $('title').text().trim() ||
            id;
        const title = cleanTitle(rawTitle);

        // Image/Poster
        const imageUrl =
            $('meta[property="og:image"]').attr('content') ||
            $('.entry-content img, .post-content img, article img').first().attr('src') ||
            '';

        // Synopsis/Description
        let synopsis = '';
        // Look for "Storyline" or "Synopsis" section
        $('p, h3, h4, strong').each((_, el) => {
            const text = $(el).text().trim().toLowerCase();
            if (text.includes('storyline') || text.includes('synopsis') || text.includes('plot')) {
                const nextText = $(el).next('p').text().trim() ||
                    $(el).parent().next('p').text().trim();
                if (nextText && nextText.length > 30) {
                    synopsis = nextText;
                }
            }
        });

        // Fallback: get the longest paragraph as synopsis
        if (!synopsis) {
            $('p').each((_, el) => {
                const text = $(el).text().trim();
                if (
                    text.length > synopsis.length &&
                    text.length > 50 &&
                    !text.includes('Download') &&
                    !text.includes('480p') &&
                    !text.includes('720p')
                ) {
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

        // Extract movie info (language, quality, etc.)
        let language = 'Hindi';
        $('p, li, span').each((_, el) => {
            const text = $(el).text().trim();
            if (text.match(/Language\s*[:]/i)) {
                const langMatch = text.match(/Language\s*[:]\s*(.+)/i);
                if (langMatch) {
                    language = langMatch[1].trim().split(/[,\n]/)[0].trim();
                }
            }
        });

        // Media items (download quality options)
        const media = [];
        let mediaCounter = 1;

        // Look for quality-labeled download links
        $('a.v-button, a[class*="button"], a[style*="background"]').each((_, el) => {
            const $el = $(el);
            const link = $el.attr('href') || '';
            const label = $el.text().trim();

            if (link && label && !link.includes('#') && !link.includes('javascript:')) {
                media.push({
                    id: `${id}-quality-${mediaCounter}`,
                    name: label || `Download ${mediaCounter}`,
                    type: 1, // MediaType.RawVideo
                    url: link.startsWith('http') ? link : BASE_URL + link,
                    number: mediaCounter,
                });
                mediaCounter++;
            }
        });

        // Fallback: look for G-Direct or HubCloud links
        if (media.length === 0) {
            $('a').each((_, el) => {
                const $el = $(el);
                const link = $el.attr('href') || '';
                const text = $el.text().trim().toLowerCase();

                if (
                    (text.includes('g-direct') ||
                        text.includes('hubcloud') ||
                        text.includes('gdrive') ||
                        text.includes('instant download') ||
                        text.includes('download link')) &&
                    link &&
                    !link.includes('#')
                ) {
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

        // Genres/categories
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

        // Release date
        let releaseDate = '';
        $('time, .entry-date, .post-date').each((_, el) => {
            const dateText =
                $(el).attr('datetime') || $(el).text().trim();
            if (dateText && !releaseDate) {
                releaseDate = dateText;
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
    }

    // ─── Get Item Media ─────────────────────────────────────────────────────────
    async getItemMedia(id) {
        const detailUrl = `${BASE_URL}/${id}/`;
        const html = await fetchHTML(detailUrl);
        const $ = Cheerio.load(html);

        const mediaList = [];
        let counter = 1;

        // Primary: styled download buttons
        $('a.v-button, a[class*="button"]').each((_, el) => {
            const $el = $(el);
            const link = $el.attr('href') || '';
            const name = $el.text().trim();

            if (link && name && !link.includes('#') && !link.includes('javascript:')) {
                mediaList.push({
                    type: 1, // MediaType.RawVideo
                    url: link.startsWith('http') ? link : BASE_URL + link,
                    name: name,
                });
                counter++;
            }
        });

        // Fallback: G-Direct / HubCloud / download links
        if (mediaList.length === 0) {
            $('a').each((_, el) => {
                const $el = $(el);
                const link = $el.attr('href') || '';
                const text = $el.text().trim().toLowerCase();

                if (
                    (text.includes('g-direct') ||
                        text.includes('hubcloud') ||
                        text.includes('gdrive') ||
                        text.includes('instant download') ||
                        text.includes('download')) &&
                    link &&
                    !link.includes('#') &&
                    !link.includes('javascript:') &&
                    link !== BASE_URL + '/'
                ) {
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
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Export plugin methods (required by Umbrella sandbox)
// ═══════════════════════════════════════════════════════════════════════════════
module.exports = {
    search: async (query, page) => new VegaMoviesPlugin().search(query, page),
    getCategory: async (category, page) =>
        new VegaMoviesPlugin().getCategory(category, page),
    getHomeCategories: async () => new VegaMoviesPlugin().getHomeCategories(),
    getItemDetails: async (id) => new VegaMoviesPlugin().getItemDetails(id),
    getItemMedia: async (id) => new VegaMoviesPlugin().getItemMedia(id),
};
