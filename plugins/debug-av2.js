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
                Referer: 'https://animevilla.in/',
            },
        };
        const req = https.request(options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchHTML(res.headers.location).then(resolve).catch(reject); return;
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

    console.log('Title:', $('title').text().trim());

    // Show ALL href patterns on the page
    const hrefs = new Set();
    $('a[href]').each((_, el) => {
        const h = $(el).attr('href');
        if (h && h.includes('animevilla')) {
            const parts = h.split('/');
            if (parts.length > 3) hrefs.add('/' + parts.slice(3, 5).join('/') + '/...');
        }
    });
    console.log('\nURL patterns on page:');
    [...hrefs].forEach(h => console.log(' ', h));

    // What does the structure look like for search results?
    console.log('\nAll a tags with text > 5 chars:');
    let cnt = 0;
    $('a').each((_, el) => {
        const $el = $(el);
        const t = $el.text().trim();
        const h = $el.attr('href') || '';
        if (t.length > 5 && t.length < 80 && h.includes('animevilla.in')) {
            console.log(`  "${t}" → ${h}`);
            cnt++;
            if (cnt >= 15) return false;
        }
    });
}
main().catch(e => console.log('ERR:', e.message));
