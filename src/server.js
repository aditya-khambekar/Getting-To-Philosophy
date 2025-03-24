const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const path = require('path');
const { runLinkPath } = require('./gettingtophilosophy.js');

app.use(express.static('public'));
app.use(bodyParser.json());

app.post('/find-path', async (req, res) => {
    try {
        const { startingUrl, targetUrl } = req.body;
        console.log(`Finding path from ${startingUrl} to ${targetUrl}`);

        const visitedArticles = await runLinkPath(startingUrl, targetUrl);
        res.json({ path: visitedArticles });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to find path' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});