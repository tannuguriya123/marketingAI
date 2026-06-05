const Groq = require('groq-sdk');
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';

function normalizeTips(tips) {
    if (Array.isArray(tips)) {
        return tips.map((tip) => String(tip).trim()).filter(Boolean);
    }

    return String(tips || '')
        .split(/\n+/)
        .map((tip) => tip.replace(/^[-*•]\s*/, '').trim())
        .filter(Boolean);
}

async function analyzeContent(text) {
    if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY is missing in backend/.env');
    }
    if (!text) {
        throw new Error('Text content is required for analysis.');
    }

    const prompt = `
    Analyze this website text: "${text}"
    Respond strictly in JSON format with exactly these three keys:
    1. "caption": A punchy, 2-sentence marketing caption.
    2. "imagePrompt": A highly detailed, descriptive prompt for an AI image generator (Stable Diffusion) to create an attractive marketing graphic matching the brand tone. Do not include text in the image prompt.
    3. "tips": 3 bullet points of marketing advice based on the product.
    `;

    try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
            response_format: { type: 'json_object' },
            temperature: 0.7,
        });

        const content = chatCompletion.choices[0]?.message?.content;
        if (!content) {
            throw new Error('Empty response from Groq.');
        }

        const parsed = JSON.parse(content);
        return {
            caption: parsed.caption || '',
            imagePrompt: parsed.imagePrompt || '',
            tips: normalizeTips(parsed.tips)
        };
    } catch (error) {
        throw new Error(`Groq LLM failed: ${error.message}`);
    }
}
module.exports = { analyzeContent };
