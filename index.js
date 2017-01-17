const async = require('async');
const request = require('request');
const cheerio = require('cheerio');
const argv = require('optimist').argv;
const parallelism = argv.parallelism || 16;

if (!argv.category) {
    throw new Error('Please specify a category using --category');
}

const baseUrl = 'http://www.oktayustam.com/site/detay.aspx';

const defaultOptions = {
    url: baseUrl,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:50.0) Gecko/20100101 Firefox/50.0'
    }
};

function extractRecipeId(el) {
    const r = /tarifler\/(\d+).*/ig.exec(el);
    return (r && r[1]) || null;
}

function getRecipe(id, callback) {
    const options = Object.assign({}, defaultOptions, {
        qs: {
            ICERIKID: id
        }
    });

    request(options, function(err, response, body) {
        if (err) {
            return callback(err);
        }

        const $ = cheerio.load(body);

        const possibleSelectors = [
            'div.style4 > div:nth-child(1) > div:nth-child(1)',
            'div.style4 > div:nth-child(1) > p:nth-child(1)',
            'td.style5',
            '.OktayUstaTarif'
        ];

        const title = $('.oktab2 span').text().replace(' Tarifi', '');
        const instructions = possibleSelectors.reduce((acc, sel) => acc || (acc = $(sel).text().trim()), '');

        callback(null, {
            id,
            title,
            url: this.href, // this refers to the current request
            instructions
        });
    });
}

function getPage(categoryId, pageId, callback) {
    const options = Object.assign({}, defaultOptions, {
        qs: {
            KATEGORIID: categoryId,
            sayfa: pageId
        }
    });

    request(options, (err, response, body) => {
        if (err) {
            return callback(err);
        }

        const $ = cheerio.load(body);

        const hasResults = $('.l-ic.left').length > 0;

        if (!hasResults) {
            return callback(null, false);
        }

        const recipeIds = $('.l-ic.left > ul > li > p > a').toArray().map(el => $(el).attr('href')).map(extractRecipeId).filter(x => !!x);
        callback(null, recipeIds);
    });
}

function getRecipeIds(categoryId, callback) {
    let recipeIds = [];
    let canKeepGoing = true;
    let currentPage = 1;

    async.doWhilst((next) => {
        getPage(categoryId, currentPage, (e, ids) => {
            if (e) {
                return next(e);
            }

            canKeepGoing = !!ids;

            if (canKeepGoing) {
                recipeIds = recipeIds.concat(ids);
                currentPage++;
            }

            next();
        });
    }, () => canKeepGoing, (err) => callback(err, recipeIds));
}

function getCategory(categoryId, callback) {
    async.waterfall([
        (next) => getRecipeIds(categoryId, next),
        (recipeIds, next) => async.mapLimit(recipeIds, parallelism, getRecipe, next)
    ], callback);
}

getCategory(argv.category, function(err, result) {
    if (err) {
        console.error(err);
        process.exit(-1);
    }

    console.log(JSON.stringify(result, null, 4));
    process.exit(0);
});
