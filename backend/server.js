require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { scrapeUrl } = require('./services/scraper');
const { analyzeContent } = require('./services/llm');
const { generateImage } = require('./services/vision');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || 'https://marketing-ai-tan.vercel.app,http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.disable('x-powered-by');
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(express.json({ limit: '64kb' }));

const isValidHttpUrl = (value) => {
    try {
        const parsedUrl = new URL(value);
        return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
        return false;
    }
};

app.post('/api/generate', async (req, res) => {
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!url) return res.status(400).json({ error: "URL is required" });
    if (!isValidHttpUrl(url)) {
        return res.status(400).json({ error: "Please provide a valid http or https URL." });
    }

    try {
        console.log(`[1/4] Scraping URL: ${url}`);
        const text = await scrapeUrl(url);

        console.log(`[2/4] Synthesizing Content via Groq...`);
        const llmResult = await analyzeContent(text);

        console.log(`[3/4] Generating Vision Graphic via HuggingFace...`);
        const imageBase64 = await generateImage(llmResult.imagePrompt);

        console.log(`[4/4] Pipeline Complete!`);
        res.json({
            caption: llmResult.caption,
            imagePrompt: llmResult.imagePrompt,
            tips: llmResult.tips,
            image: imageBase64
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || "An unexpected error occurred in the pipeline." });
    }
});

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => console.log(`Pipeline API running on port ${PORT}`));
}

module.exports = app;
