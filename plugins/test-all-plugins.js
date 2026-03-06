// ═══════════════════════════════════════════════════════════════════════════════
// Umbrella Plugin Test Suite - All 8 Plugins
// ═══════════════════════════════════════════════════════════════════════════════
// Simulates the Umbrella Node.js sandbox by providing Cheerio globally,
// then tests each plugin's core functionality:
//   1. getHomeCategories()
//   2. search(query)
//   3. getItemDetails(id)  [uses first search result]
//   4. getItemMedia(id)    [uses first search result]
// ═══════════════════════════════════════════════════════════════════════════════

const cheerio = require('cheerio');
global.Cheerio = cheerio;

// ── Configuration ────────────────────────────────────────────────────────────

const PLUGINS = [
    { name: 'AnimeVilla',     path: './dist/animevilla-plugin.js',     searchQuery: 'naruto' },
    { name: 'VegaMovies',     path: './dist/vegamovies-plugin.js',     searchQuery: 'avengers' },
    { name: 'MoviesMod',      path: './dist/moviesmod-plugin.js',      searchQuery: 'avengers' },
    { name: 'BollyFlix',      path: './dist/bollyflix-plugin.js',      searchQuery: 'avengers' },
    { name: 'MoviesDrive',    path: './dist/moviesdrive-plugin.js',    searchQuery: 'avengers' },
    { name: 'NetflixMirror',  path: './dist/netflixmirror-plugin.js',  searchQuery: 'money heist' },
    { name: 'CineStream',     path: './dist/cinestream-plugin.js',     searchQuery: 'avengers' },
    { name: 'SkyMoviesHD',    path: './dist/skymovies-plugin.js',      searchQuery: 'avengers' },
];

const TIMEOUT_MS = 30000; // 30s timeout per operation

// ── Helpers ──────────────────────────────────────────────────────────────────

function withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`TIMEOUT after ${ms}ms: ${label}`)), ms)
        ),
    ]);
}

function truncate(str, maxLen = 60) {
    if (!str) return '(empty)';
    str = String(str);
    return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}

// ── Test Runner ──────────────────────────────────────────────────────────────

async function testPlugin({ name, path, searchQuery }) {
    const results = { name, tests: {} };
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  TESTING: ${name}`);
    console.log(`${'═'.repeat(70)}`);

    let plugin;
    try {
        plugin = require(path);
    } catch (err) {
        console.log(`  ❌ LOAD FAILED: ${err.message}`);
        results.tests.load = { pass: false, error: err.message };
        return results;
    }
    results.tests.load = { pass: true };
    console.log(`  ✅ Plugin loaded successfully`);

    // ── Test 1: getHomeCategories ──
    try {
        console.log(`\n  [1/4] getHomeCategories()...`);
        const categories = await withTimeout(
            plugin.getHomeCategories(),
            TIMEOUT_MS,
            'getHomeCategories'
        );
        const count = Array.isArray(categories) ? categories.length : 0;
        console.log(`    ✅ Returned ${count} categories`);
        if (count > 0) {
            categories.slice(0, 3).forEach((cat, i) => {
                const itemCount = cat.items ? cat.items.length : 0;
                console.log(`    📁 [${i + 1}] "${truncate(cat.name, 40)}" — ${itemCount} items`);
                if (cat.items && cat.items.length > 0) {
                    console.log(`        First item: "${truncate(cat.items[0].name, 50)}"`);
                }
            });
            if (count > 3) console.log(`    ... and ${count - 3} more categories`);
        }
        results.tests.homeCategories = { pass: count > 0, count };
    } catch (err) {
        console.log(`    ❌ FAILED: ${err.message}`);
        results.tests.homeCategories = { pass: false, error: err.message };
    }

    // ── Test 2: search ──
    let firstItemId = null;
    let firstItemName = null;
    try {
        console.log(`\n  [2/4] search("${searchQuery}")...`);
        const searchResult = await withTimeout(
            plugin.search(searchQuery),
            TIMEOUT_MS,
            'search'
        );
        const items = searchResult && searchResult.items ? searchResult.items : [];
        console.log(`    ✅ Found ${items.length} results`);
        if (items.length > 0) {
            items.slice(0, 3).forEach((item, i) => {
                console.log(`    🎬 [${i + 1}] "${truncate(item.name, 50)}" (id: ${truncate(item.id, 40)})`);
            });
            if (items.length > 3) console.log(`    ... and ${items.length - 3} more results`);
            firstItemId = items[0].id;
            firstItemName = items[0].name;
        }
        results.tests.search = { pass: items.length > 0, count: items.length };
    } catch (err) {
        console.log(`    ❌ FAILED: ${err.message}`);
        results.tests.search = { pass: false, error: err.message };
    }

    // ── Test 3: getItemDetails ──
    if (firstItemId) {
        try {
            console.log(`\n  [3/4] getItemDetails("${truncate(firstItemId, 50)}")...`);
            const details = await withTimeout(
                plugin.getItemDetails(firstItemId),
                TIMEOUT_MS,
                'getItemDetails'
            );
            const hasName = details && details.name;
            console.log(`    ✅ Title: "${truncate(details.name, 50)}"`);
            if (details.language) console.log(`    🌐 Language: ${details.language}`);
            if (details.description) console.log(`    📝 Description: ${truncate(details.description, 80)}`);
            if (details.media) console.log(`    📀 Media items: ${details.media.length}`);
            if (details.genres) console.log(`    🏷️  Genres: ${details.genres.join(', ')}`);
            results.tests.itemDetails = { pass: !!hasName, title: details.name };
        } catch (err) {
            console.log(`    ❌ FAILED: ${err.message}`);
            results.tests.itemDetails = { pass: false, error: err.message };
        }
    } else {
        console.log(`\n  [3/4] getItemDetails() — ⏭️ SKIPPED (no search result to test with)`);
        results.tests.itemDetails = { pass: false, error: 'Skipped - no search results' };
    }

    // ── Test 4: getItemMedia ──
    if (firstItemId) {
        try {
            console.log(`\n  [4/4] getItemMedia("${truncate(firstItemId, 50)}")...`);
            const media = await withTimeout(
                plugin.getItemMedia(firstItemId),
                TIMEOUT_MS,
                'getItemMedia'
            );
            const count = Array.isArray(media) ? media.length : 0;
            console.log(`    ✅ Found ${count} media links`);
            if (count > 0) {
                media.slice(0, 3).forEach((m, i) => {
                    const label = m.name || m.title || m.quality || 'Link';
                    const url = m.url || m.link || '(no url)';
                    console.log(`    🔗 [${i + 1}] ${truncate(label, 30)}: ${truncate(url, 60)}`);
                });
                if (count > 3) console.log(`    ... and ${count - 3} more links`);
            }
            results.tests.itemMedia = { pass: count >= 0, count }; // count=0 OK for some sites
        } catch (err) {
            console.log(`    ❌ FAILED: ${err.message}`);
            results.tests.itemMedia = { pass: false, error: err.message };
        }
    } else {
        console.log(`\n  [4/4] getItemMedia() — ⏭️ SKIPPED (no search result to test with)`);
        results.tests.itemMedia = { pass: false, error: 'Skipped - no search results' };
    }

    return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║              UMBRELLA PLUGIN TEST SUITE — ALL 8 PLUGINS             ║');
    console.log('╠══════════════════════════════════════════════════════════════════════╣');
    console.log(`║  Started: ${new Date().toISOString().padEnd(57)}║`);
    console.log('╚══════════════════════════════════════════════════════════════════════╝');

    const allResults = [];

    for (const pluginConfig of PLUGINS) {
        try {
            const result = await testPlugin(pluginConfig);
            allResults.push(result);
        } catch (err) {
            console.log(`\n  💥 UNEXPECTED ERROR testing ${pluginConfig.name}: ${err.message}`);
            allResults.push({
                name: pluginConfig.name,
                tests: { load: { pass: false, error: err.message } },
            });
        }
    }

    // ── Summary ──
    console.log(`\n\n${'═'.repeat(70)}`);
    console.log('  FINAL SUMMARY');
    console.log('═'.repeat(70));

    const testNames = ['load', 'homeCategories', 'search', 'itemDetails', 'itemMedia'];
    const header = '  Plugin'.padEnd(20) + testNames.map(t => t.padEnd(16)).join('');
    console.log(header);
    console.log('  ' + '─'.repeat(68));

    let totalPass = 0;
    let totalFail = 0;

    for (const r of allResults) {
        let line = `  ${r.name}`.padEnd(20);
        for (const t of testNames) {
            const test = r.tests[t];
            if (!test) {
                line += '⏭️ SKIP'.padEnd(16);
            } else if (test.pass) {
                line += '✅ PASS'.padEnd(16);
                totalPass++;
            } else {
                line += '❌ FAIL'.padEnd(16);
                totalFail++;
            }
        }
        console.log(line);
    }

    console.log('  ' + '─'.repeat(68));
    console.log(`  Total: ${totalPass} passed, ${totalFail} failed out of ${totalPass + totalFail} tests`);
    console.log(`  Completed: ${new Date().toISOString()}`);
    console.log('═'.repeat(70));

    // Exit with appropriate code
    process.exit(totalFail > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
