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
                'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
        };
        const req = https.request(options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchHTML(res.headers.location).then(resolve).catch(reject);
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
        req.end();
    });
}

async function main() {
    // Test 1: Check what the actual search URL structure is
    const html1 = await fetchHTML('https://animevilla.in/?s=naruto');
    const $1 = cheerio.load(html1);

    console.log('--- PAGE TITLE ---');
    console.log($1('title').text().trim());

    console.log('\n--- ALL ANCHOR TAGS with /anime/ ---');
    const animeLinks = [];
    $1('a[href*="/anime/"]').each((_, el) => {
        const $el = $1(el);
        const href = $el.attr('href') || '';
        const text = $el.text().trim();
        if (text && text.length > 3 && !href.includes('/genre/')) {
            animeLinks.push({ text: text.substring(0, 60), href: href.substring(0, 80) });
        }
    });
    console.log(`Found ${animeLinks.length} anime links`);
    animeLinks.slice(0, 5).forEach((l, i) => console.log(`  [${i}] "${l.text}" → ${l.href}`));

    // Test 2: Try the actual search keyword URL
    const html2 = await fetchHTML('https://animevilla.in/search/?s_keyword=naruto');
    const $2 = cheerio.load(html2);
    console.log('\n--- SEARCH with s_keyword=naruto (title) ---');
    console.log($2('title').text().trim());

    const animeLinks2 = [];
    $2('a[href*="/anime/"]').each((_, el) => {
        const $el = $2(el);
        const href = $el.attr('href') || '';
        const text = $el.text().trim();
        if (text && text.length > 3 && !href.includes('/genre/')) {
            animeLinks2.push({ text: text.substring(0, 60), href: href.substring(0, 80) });
        }
    });
    console.log(`Found ${animeLinks2.length} anime links with s_keyword`);
    animeLinks2.slice(0, 3).forEach((l, i) => console.log(`  [${i}] "${l.text}" → ${l.href}`));
}

main().catch(e => { console.log('FATAL:', e.message); });
