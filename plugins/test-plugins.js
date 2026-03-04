// Test script to simulate the Umbrella sandbox and verify plugins work
const cheerio = require('cheerio');
global.Cheerio = cheerio;

async function testPlugin(name, pluginPath) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TESTING: ${name}`);
    console.log('='.repeat(60));
    try {
        const plugin = require(pluginPath);
        console.log('\n[1] Testing getHomeCategories()...');
        const categories = await plugin.getHomeCategories();
        console.log(`  OK - Returned ${categories.length} categories`);
        categories.forEach((cat, i) => {
            console.log(`  Category ${i + 1}: "${cat.name}" - ${cat.items ? cat.items.length : 0} items`);
            if (cat.items && cat.items.length > 0) {
                console.log(`    First: "${cat.items[0].name}"`);
            }
        });

        const q = name === 'AnimeVilla' ? 'naruto' : 'avengers';
        console.log(`\n[2] Testing search("${q}")...`);
        const sr = await plugin.search(q);
        console.log(`  OK - Found ${sr.items ? sr.items.length : 0} results`);
        if (sr.items && sr.items.length > 0) {
            const testId = sr.items[0].id;
            console.log(`  First: "${sr.items[0].name}" (id: ${testId})`);

            console.log(`\n[3] Testing getItemDetails("${testId}")...`);
            const d = await plugin.getItemDetails(testId);
            console.log(`  OK - Title: "${d.name}"`);
            console.log(`  Language: ${d.language}`);
            console.log(`  Media: ${d.media ? d.media.length : 0} items`);

            console.log(`\n[4] Testing getItemMedia("${testId}")...`);
            const m = await plugin.getItemMedia(testId);
            console.log(`  OK - Found ${m.length} media links`);
        }
        console.log(`\nPASSED: ${name}`);
        return true;
    } catch (err) {
        console.log(`\nFAILED: ${name} - ${err.message}`);
        return false;
    }
}

async function main() {
    console.log('Umbrella Plugin Test Suite\n');
    const r = {};
    r['AnimeVilla'] = await testPlugin('AnimeVilla', './dist/animevilla-plugin.js');
    r['MoviesMod'] = await testPlugin('MoviesMod', './dist/moviesmod-plugin.js');
    r['VegaMovies'] = await testPlugin('VegaMovies', './dist/vegamovies-plugin.js');
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    Object.entries(r).forEach(([n, p]) => console.log(`  ${p ? 'PASS' : 'FAIL'} ${n}`));
}
main().catch(console.error);
