const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'openai/gpt-oss-20b', // Fast and JSON-capable
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
            tips: Array.isArray(parsed.tips) ? parsed.tips.join('\n') : (parsed.tips || '')
        };
    } catch (error) {
        throw new Error(`Groq LLM failed: ${error.message}`);
    }
}
module.exports = { analyzeContent };
