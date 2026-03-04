const cheerio = require('cheerio');
global.Cheerio = cheerio;

async function testAnimeVilla() {
    console.log('Testing AnimeVilla plugin...');
    const plugin = require('./dist/animevilla-plugin.js');

    try {
        console.log('\n--- getHomeCategories ---');
        const cats = await plugin.getHomeCategories();
        console.log(`Categories: ${cats.length}`);
        cats.forEach((c, i) => {
            console.log(`  [${i}] "${c.name}" - ${c.items ? c.items.length : 0} items`);
            if (c.items && c.items[0]) console.log(`    First: "${c.items[0].name}" → ${c.items[0].url}`);
        });
    } catch (e) {
        console.log('getHomeCategories ERROR:', e.message);
    }

    try {
        console.log('\n--- search("naruto") ---');
        const sr = await plugin.search('naruto');
        console.log(`Results: ${sr.items ? sr.items.length : 0}`);
        if (sr.items) sr.items.slice(0, 3).forEach(i => console.log(`  "${i.name}" id=${i.id}`));
    } catch (e) {
        console.log('search ERROR:', e.message);
    }

    try {
        console.log('\n--- getItemDetails("naruto-hindi-dubbed") ---');
        const d = await plugin.getItemDetails('naruto-hindi-dubbed');
        console.log(`Title: "${d.name}"`);
        console.log(`Language: ${d.language}`);
        console.log(`Synopsis length: ${d.synopsis ? d.synopsis.length : 0}`);
        console.log(`Genres: ${d.genres ? d.genres.length : 0}`);
        console.log(`Media: ${d.media ? d.media.length : 0}`);
        if (d.media && d.media[0]) console.log(`  First media: "${d.media[0].name}" → ${d.media[0].url.substring(0, 80)}`);
    } catch (e) {
        console.log('getItemDetails ERROR:', e.message);
    }

    try {
        console.log('\n--- getItemMedia("naruto-hindi-dubbed") ---');
        const m = await plugin.getItemMedia('naruto-hindi-dubbed');
        console.log(`Media links: ${m.length}`);
        m.slice(0, 5).forEach((l, i) => console.log(`  [${i}] "${l.name}" → ${l.url.substring(0, 80)}`));
    } catch (e) {
        console.log('getItemMedia ERROR:', e.message);
    }
}

testAnimeVilla().catch(e => console.log('FATAL:', e.message, e.stack));
