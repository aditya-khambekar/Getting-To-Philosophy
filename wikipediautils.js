const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

const debug = false;

const CACHE_FILE = path.join(__dirname, 'wiki_paths_cache.json');

function logDebug(str){
    if (debug) {console.log(str);}
}

async function loadPathCache() {
    try {
        const data = await fs.readFile(CACHE_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

// Save updated cache
async function savePathCache(cache) {
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

async function getFirstValidLinkInParagraph(wikipediaUrl) {
    try {
        const response = await axios.get(wikipediaUrl);
        const html = response.data;
        const $ = cheerio.load(html);
        const contentText = $('#mw-content-text');
        const paragraphs = contentText.find('.mw-parser-output > p');

        for (let i = 0; i < paragraphs.length; i++) {
            const paragraph = paragraphs[i];
            const links = $(paragraph).find('a');

            for (let j = 0; j < links.length; j++) {
                const link = links[j];
                const $link = $(link);

                let html = $.html(paragraph);
                const linkHtml = $.html(link);
                const linkIndex = html.indexOf(linkHtml);

                let openParenCount = 0;
                let closeParenCount = 0;

                for (let k = 0; k < linkIndex; k++) {
                    if (html[k] === '(') openParenCount++;
                    if (html[k] === ')') closeParenCount++;
                }

                if (openParenCount > closeParenCount) continue;
                if ($link.closest('i').length > 0) continue;
                const href = $link.attr('href');
                if (!href || href.startsWith('http') || href.startsWith('https')) continue;
                if ($link.hasClass('new')) continue;
                if (href.startsWith('#') || href.includes(':') || !href.startsWith('/wiki/')) continue;

                return `https://en.wikipedia.org${href}`;
            }
        }

        return null;
    } catch (error) {
        console.error('Error fetching or parsing the Wikipedia page:', error);
        return null;
    }
}

async function resolveRandomWiki() {
    try {
        const response = await axios.get('https://en.wikipedia.org/wiki/Special:Random', {
            maxRedirects: 0,
            validateStatus: status => status >= 200 && status < 400
        });

        if (response.request.res.responseUrl) {
            return response.request.res.responseUrl;
        }

        if (response.headers.location) {
            const locationUrl = response.headers.location;
            if (locationUrl.startsWith('/')) {
                return `https://en.wikipedia.org${locationUrl}`;
            }
            return locationUrl;
        }

        console.error('Could not resolve Random wiki to a specific article');
        return null;
    } catch (error) {
        if (error.response && error.response.headers.location) {
            const locationUrl = error.response.headers.location;
            if (locationUrl.startsWith('/')) {
                return `https://en.wikipedia.org${locationUrl}`;
            }
            return locationUrl;
        }

        console.error('Error resolving Random wiki:', error);
        return null;
    }
}

async function runLinkPath(startingLink, endingLink) {
    const pathCache = await loadPathCache();

    let visitedArticles = [];
    let visitedUrls = [];

    let currentLink = startingLink;
    if (startingLink.includes('Special:Random')) {
        currentLink = await resolveRandomWiki();
        logDebug(`Random article resolved to: ${currentLink}`);
    }

    const linkTitle = await getWikipediaArticleTitle(currentLink);
    logDebug(`Starting with article: ${linkTitle}`);

    if (pathCache[linkTitle] && pathCache[linkTitle].length > 0) {
        logDebug(`Found cached path for "${linkTitle}"`);
        return pathCache[linkTitle];
    }

    visitedArticles.push(linkTitle);
    visitedUrls.push(currentLink);

    while (currentLink !== endingLink) {
        try {
            const nextLink = await getFirstValidLinkInParagraph(currentLink);

            if (!nextLink) {
                logDebug("No next link found. Path terminated.");
                await saveSubpaths(visitedArticles, visitedUrls, [], pathCache);
                return visitedArticles;
            }

            const nextLinkTitle = await getWikipediaArticleTitle(nextLink);
            logDebug(`Next link: ${nextLinkTitle}`);

            if (pathCache[nextLinkTitle] && pathCache[nextLinkTitle].length > 0) {
                logDebug(`Found cached path from "${nextLinkTitle}" to destination`);
                const completePath = [...visitedArticles, ...pathCache[nextLinkTitle].slice(1)];

                await saveSubpaths(visitedArticles, visitedUrls, pathCache[nextLinkTitle], pathCache);

                return completePath;
            }

            if (visitedArticles.includes(nextLinkTitle)) {
                logDebug(`Loop detected at ${nextLinkTitle}. Path terminated.`);
                await saveSubpaths(visitedArticles, visitedUrls, [], pathCache);
                return visitedArticles;
            } else {
                visitedArticles.push(nextLinkTitle);
                visitedUrls.push(nextLink);
            }

            if (nextLink === endingLink) {
                logDebug("Reached target article. Path complete.");
                await saveSubpaths(visitedArticles, visitedUrls, [], pathCache);
                return visitedArticles;
            }

            currentLink = nextLink;

        } catch (error) {
            console.error('Error during the link-following process:', error);
            break;
        }
    }

    await saveSubpaths(visitedArticles, visitedUrls, [], pathCache);
    return visitedArticles;
}

async function saveSubpaths(visitedArticles, visitedUrls, cachedPathExtension, pathCache) {
    const fullPath = cachedPathExtension.length > 0
        ? [...visitedArticles, ...cachedPathExtension.slice(1)]
        : visitedArticles;

    for (let i = 0; i < visitedArticles.length; i++) {
        const articleTitle = visitedArticles[i];
        const subpath = fullPath.slice(i);

        if (subpath.length > 1) {
            pathCache[articleTitle] = subpath;
        }
    }

    await savePathCache(pathCache);
}

async function getWikipediaArticleTitle(wikipediaUrl) {
    try {
        const response = await axios.get(wikipediaUrl);
        const html = response.data;

        const $ = cheerio.load(html);

        const mainHeading = $('#firstHeading').text().trim();
        if (mainHeading) {
            return mainHeading;
        }

        const pageTitle = $('title').text().trim();
        if (pageTitle) {
            return pageTitle.replace(/ - Wikipedia$/, '');
        }

        if (wikipediaUrl.includes('/wiki/')) {
            const urlParts = wikipediaUrl.split('/wiki/');
            if (urlParts.length > 1) {
                return decodeURIComponent(urlParts[1].split('#')[0].replace(/_/g, ' '));
            }
        }

        return null;
    } catch (error) {
        console.error('Error fetching or parsing the Wikipedia page:', error);
        return null;
    }
}

// Original code to run a single test
if (require.main === module) {
    const wikipediaUrl = 'https://en.wikipedia.org/wiki/Special:Random';
    runLinkPath(wikipediaUrl, "https://en.wikipedia.org/wiki/Philosophy")
        .then(visitedArticles => {
            logDebug("\nFinal Path of Wikipedia articles:");
            visitedArticles.forEach((article) => {
                console.log(`${article}`);
            });
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

// Export functions for use in other modules
module.exports = {
    logDebug,
    loadPathCache,
    savePathCache,
    getFirstValidLinkInParagraph,
    resolveRandomWiki,
    runLinkPath,
    saveSubpaths,
    getWikipediaArticleTitle
};