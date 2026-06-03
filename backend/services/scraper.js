const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeUrl(url) {
    if (!url) {
        throw new Error('URL is required.');
    }

    try {
        // Use a standard browser user-agent to bypass basic bot protection
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            maxRedirects: 5,
            timeout: 10000 // 10 second timeout
        });
        
        const $ = cheerio.load(response.data);
        // Remove scripts, styles, and nav to isolate pure content
        $('script, style, nav, footer, iframe').remove();
        let text = $('body').text().replace(/\s+/g, ' ').trim();
        
        // Truncate to ~3000 characters to prevent LLM token limit errors
        if (text.length > 3000) text = text.substring(0, 3000);
        if (!text) throw new Error("No readable content found on the page.");
        
        return text;
    } catch (error) {
        const status = error.response?.status ? `HTTP ${error.response.status}: ` : '';
        throw new Error(`Scraping failed: ${status}${error.message}`);
    }
}
module.exports = { scrapeUrl };
