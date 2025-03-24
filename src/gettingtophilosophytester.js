const fs = require('fs').promises;

const {
    runLinkPath,
    getWikipediaArticleTitle
} = require('./gettingtophilosophy');

async function testMultipleRandomPaths(count) {
    console.log(`Testing ${count} random Wikipedia articles for paths to Philosophy...\n`);

    const results = [];

    for (let i = 1; i <= count; i++) {
        try {
            console.log(`Test #${i} of ${count}:`);
            const wikipediaUrl = 'https://en.wikipedia.org/wiki/Special:Random';
            const visitedArticles = await runLinkPath(wikipediaUrl, "https://en.wikipedia.org/wiki/Philosophy");

            console.log(`Path ${i}: ${visitedArticles.join(' → ')}`);
            console.log(`Path length: ${visitedArticles.length} articles\n`);

            results.push({
                startArticle: visitedArticles[0],
                pathLength: visitedArticles.length,
                reachedPhilosophy: visitedArticles.includes('Philosophy'),
                fullPath: visitedArticles
            });

            await new Promise(resolve => setTimeout(resolve, 10));
        } catch (error) {
            console.error(`Error in test #${i}:`, error);
        }
    }

    console.log("=== SUMMARY STATISTICS ===");
    console.log(`Total paths tested: ${results.length}`);

    const successfulPaths = results.filter(r => r.reachedPhilosophy);
    console.log(`Paths that reached Philosophy: ${successfulPaths.length} (${(successfulPaths.length/results.length*100).toFixed(2)}%)`);

    if (successfulPaths.length > 0) {
        const pathLengths = successfulPaths.map(r => r.pathLength);
        const avgPathLength = pathLengths.reduce((sum, len) => sum + len, 0) / pathLengths.length;
        const shortestPath = Math.min(...pathLengths);
        const longestPath = Math.max(...pathLengths);

        console.log(`Average path length: ${avgPathLength.toFixed(2)} articles`);
        console.log(`Shortest path: ${shortestPath} articles`);
        console.log(`Longest path: ${longestPath} articles`);

        const articleCounts = {};
        results.forEach(result => {
            result.fullPath.forEach(article => {
                articleCounts[article] = (articleCounts[article] || 0) + 1;
            });
        });

        delete articleCounts['Philosophy'];

        const sortedArticles = Object.entries(articleCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        console.log("\nMost common articles in paths:");
        sortedArticles.forEach(([article, count], index) => {
            console.log(`${index + 1}. "${article}" appeared in ${count} paths`);
        });
    }
}

testMultipleRandomPaths(25);