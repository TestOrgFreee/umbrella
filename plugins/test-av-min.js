const cheerio = require('cheerio');
global.Cheerio = cheerio;

async function main() {
    try {
        const plugin = require('./dist/animevilla-plugin.js');

        // Test just getHomeCategories with full error detail
        const cats = await plugin.getHomeCategories();
        console.log('HOME_CATEGORIES_COUNT:', cats.length);

        const sr = await plugin.search('naruto');
        console.log('SEARCH_ITEMS:', sr.items ? sr.items.length : 0);
        if (!sr.items || sr.items.length === 0) {
            console.log('SEARCH_FAILED: no items');
            process.exit(1);
        }
        console.log('ALL_OK');
    } catch (e) {
        console.log('ERROR:', e.message);
        process.exit(1);
    }
}
main();
