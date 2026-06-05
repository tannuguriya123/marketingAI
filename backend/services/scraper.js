const axios = require('axios');
const cheerio = require('cheerio');
const dns = require('dns').promises;
const net = require('net');

const MAX_RESPONSE_BYTES = Number(process.env.SCRAPE_MAX_BYTES || 1024 * 1024);
const MAX_TEXT_LENGTH = Number(process.env.SCRAPE_TEXT_LIMIT || 3000);
const REQUEST_TIMEOUT_MS = Number(process.env.SCRAPE_TIMEOUT_MS || 10000);

function isPrivateIp(address) {
    if (!address) return true;

    if (address.startsWith('::ffff:')) {
        return isPrivateIp(address.slice(7));
    }

    if (net.isIP(address) === 4) {
        const parts = address.split('.').map(Number);
        const [first, second] = parts;

        return first === 0
            || first === 10
            || first === 127
            || (first === 100 && second >= 64 && second <= 127)
            || (first === 169 && second === 254)
            || (first === 172 && second >= 16 && second <= 31)
            || (first === 192 && second === 168)
            || first >= 224;
    }

    if (net.isIP(address) === 6) {
        const normalized = address.toLowerCase();
        return normalized === '::1'
            || normalized === '::'
            || normalized.startsWith('fc')
            || normalized.startsWith('fd')
            || normalized.startsWith('fe80:');
    }

    return true;
}

async function assertPublicHostname(hostname) {
    if (net.isIP(hostname)) {
        if (isPrivateIp(hostname)) {
            throw new Error('Private or local network URLs are not allowed.');
        }
        return;
    }

    const addresses = await dns.lookup(hostname, { all: true, verbatim: false });
    if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
        throw new Error('Private or local network URLs are not allowed.');
    }
}

function createSafeLookup() {
    return async (hostname, _options, callback) => {
        try {
            const addresses = await dns.lookup(hostname, { all: true, verbatim: false });
            if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
                return callback(new Error('Private or local network URLs are not allowed.'));
            }

            const publicAddress = addresses[0];
            return callback(null, publicAddress.address, publicAddress.family);
        } catch (error) {
            return callback(error);
        }
    };
}

async function scrapeUrl(url) {
    if (!url) {
        throw new Error('URL is required.');
    }

    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            throw new Error('Only http and https URLs are supported.');
        }
        await assertPublicHostname(parsedUrl.hostname);

        // Use a standard browser user-agent to bypass basic bot protection
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            maxRedirects: 5,
            timeout: REQUEST_TIMEOUT_MS,
            responseType: 'text',
            transformResponse: [(data) => data],
            maxContentLength: MAX_RESPONSE_BYTES,
            maxBodyLength: MAX_RESPONSE_BYTES,
            lookup: createSafeLookup()
        });

        const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
        if (contentType && !contentType.includes('text/html') && !contentType.includes('text/plain')) {
            throw new Error('URL did not return readable HTML or text content.');
        }
        
        const $ = cheerio.load(response.data);
        // Remove scripts, styles, and nav to isolate pure content
        $('script, style, nav, footer, iframe').remove();
        let text = $('body').text().replace(/\s+/g, ' ').trim();
        
        if (text.length > MAX_TEXT_LENGTH) text = text.substring(0, MAX_TEXT_LENGTH);
        if (!text) throw new Error("No readable content found on the page.");
        
        return text;
    } catch (error) {
        const status = error.response?.status ? `HTTP ${error.response.status}: ` : '';
        throw new Error(`Scraping failed: ${status}${error.message}`);
    }
}
module.exports = { scrapeUrl };
