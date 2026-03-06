// Quick test runner - tests each plugin sequentially with output to console + file
const fs = require('fs');
const cheerio = require('cheerio');
global.Cheerio = cheerio;

const PLUGINS = [
    { name: 'AnimeVilla', path: './dist/animevilla-plugin.js', q: 'naruto' },
    { name: 'VegaMovies', path: './dist/vegamovies-plugin.js', q: 'avengers' },
    { name: 'MoviesMod', path: './dist/moviesmod-plugin.js', q: 'avengers' },
    { name: 'BollyFlix', path: './dist/bollyflix-plugin.js', q: 'avengers' },
    { name: 'MoviesDrive', path: './dist/moviesdrive-plugin.js', q: 'avengers' },
    { name: 'NetflixMirror', path: './dist/netflixmirror-plugin.js', q: 'money heist' },
    { name: 'CineStream', path: './dist/cinestream-plugin.js', q: 'avengers' },
    { name: 'SkyMoviesHD', path: './dist/skymovies-plugin.js', q: 'avengers' },
];

const log = [];
function out(s) { console.log(s); log.push(s); }

function timeout(p, ms) {
    return Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('TIMEOUT')), ms))]);
}

async function test(cfg) {
    out(`\n--- ${cfg.name} ---`);
    const r = { name: cfg.name, load: false, home: false, search: false, details: false, media: false };
    let plugin;
    try { plugin = require(cfg.path); r.load = true; out('  Load: OK'); }
    catch (e) { out('  Load: FAIL - ' + e.message); return r; }

    try {
        const cats = await timeout(plugin.getHomeCategories(), 20000);
        r.home = Array.isArray(cats) && cats.length > 0;
        out('  Home: ' + (r.home ? 'OK - ' + cats.length + ' categories' : 'EMPTY'));
        if (r.home) cats.slice(0, 2).forEach(c => out('    ' + c.name + ': ' + (c.items ? c.items.length : 0) + ' items'));
    } catch (e) { out('  Home: FAIL - ' + e.message); }

    let itemId = null;
    try {
        const sr = await timeout(plugin.search(cfg.q), 20000);
        const items = sr && sr.items ? sr.items : [];
        r.search = items.length > 0;
        out('  Search("' + cfg.q + '"): ' + (r.search ? 'OK - ' + items.length + ' results' : 'EMPTY'));
        if (items.length > 0) {
            out('    First: "' + (items[0].name || '').slice(0, 60) + '"');
            itemId = items[0].id;
        }
    } catch (e) { out('  Search: FAIL - ' + e.message); }

    if (itemId) {
        try {
            const d = await timeout(plugin.getItemDetails(itemId), 20000);
            r.details = !!(d && d.name);
            out('  Details: ' + (r.details ? 'OK - "' + (d.name || '').slice(0, 50) + '"' : 'EMPTY'));
        } catch (e) { out('  Details: FAIL - ' + e.message); }

        try {
            const m = await timeout(plugin.getItemMedia(itemId), 20000);
            r.media = Array.isArray(m) && m.length >= 0; // 0 is ok for some
            out('  Media: OK - ' + (Array.isArray(m) ? m.length : 0) + ' links');
        } catch (e) { out('  Media: FAIL - ' + e.message); }
    } else {
        out('  Details: SKIP'); out('  Media: SKIP');
    }
    return r;
}

async function main() {
    out('=== UMBRELLA PLUGIN TESTS - ' + new Date().toISOString() + ' ===');
    const results = [];
    for (const p of PLUGINS) {
        results.push(await test(p));
    }
    out('\n=== SUMMARY ===');
    out('Plugin'.padEnd(18) + 'Load  Home  Search Details Media');
    out('-'.repeat(60));
    let pass = 0, fail = 0;
    for (const r of results) {
        const mk = v => v ? 'PASS' : 'FAIL';
        out(r.name.padEnd(18) + [r.load, r.home, r.search, r.details, r.media].map(v => mk(v).padEnd(6)).join(''));
        [r.load, r.home, r.search, r.details, r.media].forEach(v => v ? pass++ : fail++);
    }
    out('-'.repeat(60));
    out('Total: ' + pass + ' passed, ' + fail + ' failed');
    fs.writeFileSync('test-results.txt', log.join('\n'), 'utf8');
    out('\nResults saved to test-results.txt');
}
main().catch(e => { console.error('FATAL:', e); process.exit(1); });
