const cheerio = require('cheerio');
const https = require('https');
const url = require('url');

function fetchHTML(targetUrl) {
    return new Promise((resolve, reject) => {
        const parsedUrl = url.parse(targetUrl);
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.path,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                Referer: 'https://animevilla.in/',
            },
        };
        const req = https.request(options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchHTML(res.headers.location).then(resolve).catch(reject);
                return;
            }
            let data = '';
            res.on('data', ch => data += ch);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
        req.end();
    });
}

async function main() {
    const html = await fetchHTML('https://animevilla.in/?s=naruto');
    const $ = cheerio.load(html);

    // Get all href patterns
    const allLinks = [];
    $('a[href]').each((_, el) => {
        const h = $(el).attr('href') || '';
        const t = $(el).text().trim();
        // Only animevilla links with real text
        if (h.includes('animevilla.in') && t.length > 3 && !h.includes('#')) {
            allLinks.push(`"${t.substring(0, 50)}" => ${h}`);
        }
    });

    // Write all to console
    allLinks.slice(0, 30).forEach(l => console.log(l));

    // Also print the search result articles or post elements
    console.log('\n--- Article/Post elements ---');
    $('article, .post, .entry, .anime-item, .film-item, .item').each((i, el) => {
        if (i >= 5) return false;
        const $el = $(el);
        console.log(`Element ${i}: tag=${el.tagName} class="${$el.attr('class') || ''}" children=${$el.children().length}`);
        const link = $el.find('a').first();
        console.log(`  First link: "${link.text().trim().substring(0, 50)}" => ${link.attr('href') || 'none'}`);
    });
}
main().catch(e => console.log('ERR:', e.message));
