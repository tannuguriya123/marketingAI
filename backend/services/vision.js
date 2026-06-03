const DEFAULT_IMAGE_MODEL = 'stabilityai/stable-diffusion-2';
const FALLBACK_IMAGE_MODEL = 'stabilityai/stable-diffusion-xl-base-1.0';
const IMAGE_TIMEOUT_MS = 120000;

function getHuggingFaceToken() {
    return process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN;
}

function normalizePrompt(prompt) {
    return String(prompt || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 1200);
}

function getReadableError(error) {
    const message = error?.message || String(error);
    const status = error?.response?.status || error?.status || error?.cause?.status;
    const body = error?.response?.data || error?.data || error?.cause?.data;
    const bodyText = typeof body === 'string'
        ? body
        : body
            ? JSON.stringify(body)
            : '';

    const details = [status ? `HTTP ${status}` : '', bodyText || message]
        .filter(Boolean)
        .join(': ');

    if (/401|unauthorized|invalid token/i.test(details)) {
        return 'Invalid HuggingFace token. Create a token with Inference Providers permission and update backend/.env.';
    }
    if (/403|forbidden|permission|scope/i.test(details)) {
        return 'HuggingFace token is missing permission for Inference Providers, or the selected model/provider is not allowed for this account.';
    }
    if (/402|payment|required|billing|quota|credit|rate limit|429/i.test(details)) {
        return 'HuggingFace quota, billing, or rate limit blocked the image request.';
    }
    if (/404|not found|model.*not.*found|provider.*not.*available/i.test(details)) {
        return 'The selected HuggingFace image model/provider is unavailable. Try a different HUGGINGFACE_IMAGE_MODEL.';
    }
    if (/timeout|aborted|The operation was aborted/i.test(details)) {
        return 'HuggingFace image generation timed out. Try again or use a faster model.';
    }

    return details || 'Unknown HuggingFace image generation error.';
}

function detectImageMime(buffer, fallback = 'image/png') {
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return 'image/png';
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'image/jpeg';
    }
    if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
        return 'image/webp';
    }

    return fallback;
}

async function generateWithModel(client, model, prompt) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);

    try {
        const imageBlob = await client.textToImage({
            model,
            provider: process.env.HUGGINGFACE_PROVIDER || 'auto',
            inputs: prompt,
            parameters: {
                width: 768,
                height: 768,
                num_inference_steps: model.includes('FLUX') ? 4 : 25,
            },
        }, {
            signal: controller.signal,
        });

        const buffer = Buffer.from(await imageBlob.arrayBuffer());

        if (!buffer.length) {
            throw new Error('HuggingFace returned an invalid image response.');
        }

        const contentType = detectImageMime(buffer, imageBlob.type);
        return `data:${contentType};base64,${buffer.toString('base64')}`;
    } finally {
        clearTimeout(timeout);
    }
}

async function generateImage(prompt) {
    const token = getHuggingFaceToken();
    const cleanPrompt = normalizePrompt(prompt);

    if (!token) {
        throw new Error('HUGGINGFACE_API_KEY is missing in backend/.env');
    }
    if (!cleanPrompt) {
        throw new Error('Image prompt is required.');
    }

    const { InferenceClient } = await import('@huggingface/inference');
    const client = new InferenceClient(token);
    const primaryModel = process.env.HUGGINGFACE_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
    const fallbackModel = process.env.HUGGINGFACE_FALLBACK_IMAGE_MODEL || FALLBACK_IMAGE_MODEL;

    try {
        return await generateWithModel(client, primaryModel, cleanPrompt);
    } catch (error) {
        if (fallbackModel && fallbackModel !== primaryModel) {
            try {
                return await generateWithModel(client, fallbackModel, cleanPrompt);
            } catch (fallbackError) {
                throw new Error(`Vision API failed: ${getReadableError(fallbackError)} Primary model also failed: ${getReadableError(error)}`);
            }
        }

        throw new Error(`Vision API failed: ${getReadableError(error)}`);
    }
}

module.exports = { generateImage };
