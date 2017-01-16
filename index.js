const async = require('async');
const request = require('request');
const cheerio = require('cheerio');
const argv = require('optimist').argv;

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

        const title = $('.oktab2 span').text().replace(' Tarifi', '');

        // TODO fetch ingredients and description

        callback(null, {
            id,
            title,
            url: this.href // this refers to the current request
        });
    });
}

function getPage(id, callback) {
    const options = Object.assign({}, defaultOptions, {
        qs: {
            KATEGORIID: argv.category,
            sayfa: id
        }
    });

    async.waterfall([
        (next) => request(options, next),
        (response, body, next) => next(null, cheerio.load(body)),
        ($, next) => {
            const recipeIds = $('.l-ic.left > ul > li > p > a').toArray().map(el => $(el).attr('href')).map(extractRecipeId).filter(x => !!x);

            async.mapLimit(recipeIds, 5, getRecipe, (err, results) => err ? next(err) : next(null, [].concat.apply([], results)));
        },
        (recipes, next) => {

            console.log('ÜEÜ', recipes)
        }
    ], callback);
}

function doIt() {
    let dumpData = [];

    getPage(1, (e, r) => console.error(e, r));
}

console.log(doIt());
