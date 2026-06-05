import { useState } from 'react';
import axios from 'axios';

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const API_TIMEOUT_MS = 180000;

function getApiBaseUrl() {
  if (
    typeof window !== 'undefined'
    && window.location.hostname.endsWith('.vercel.app')
    && configuredApiBaseUrl.includes('onrender.com')
  ) {
    return '';
  }

  return configuredApiBaseUrl;
}

const API_BASE_URL = getApiBaseUrl();

function getImageExtension(dataUrl) {
  const mime = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,/i)?.[1];
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  return 'png';
}

function normalizeTips(tips) {
  if (Array.isArray(tips)) return tips.filter(Boolean);
  return String(tips || '')
    .split(/\n+/)
    .map((tip) => tip.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);
}

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const generateCampaign = async (e) => {
    e.preventDefault();
    const cleanUrl = url.trim();

    if (!cleanUrl) {
      setError('Please enter a website URL.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/generate`, { url: cleanUrl }, {
        timeout: API_TIMEOUT_MS,
      });
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to connect to the pipeline server.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result?.image) return;
    
    // Download Image
    const link = document.createElement('a');
    link.href = result.image;
    link.download = `marketing-graphic.${getImageExtension(result.image)}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Download Text Content
    const tips = normalizeTips(result.tips).join('\n');
    const textContent = `CAPTION:\n${result.caption}\n\nTIPS:\n${tips || ''}`;
    const blob = new Blob([textContent], { type: 'text/plain' });
    const textLink = document.createElement('a');
    const textUrl = URL.createObjectURL(blob);
    textLink.href = textUrl;
    textLink.download = 'marketing-copy.txt';
    document.body.appendChild(textLink);
    textLink.click();
    document.body.removeChild(textLink);
    URL.revokeObjectURL(textUrl);
  };

  const tips = normalizeTips(result?.tips);

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-800">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header & Input */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Marketing Orchestrator</h1>
          <p className="text-gray-500 mb-6">Drop a link, and our pipeline will scrape, synthesize, and generate your assets.</p>
          
          <form onSubmit={generateCampaign} className="flex gap-4 max-w-2xl mx-auto">
            <input 
              type="url" 
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-product-page.com" 
              disabled={loading}
              autoComplete="url"
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none transition"
            />
            <button 
              type="submit" 
              disabled={loading || !url.trim()}
              className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {loading ? 'Orchestrating...' : 'Generate'}
            </button>
          </form>
          {error && <p className="text-red-500 mt-4 bg-red-50 py-2 rounded">{error}</p>}
        </div>

        {/* Results Pipeline */}
        {result && (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Visuals */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold mb-4">Generated Graphic</h2>
              <img src={result.image} alt="Generated marketing" className="w-full rounded-lg shadow-sm mb-4" />
              <button 
                onClick={handleDownload}
                className="w-full bg-gray-900 text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition"
              >
                Download Assets (Image + Copy)
              </button>
            </div>

            {/* Copy & Tips */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-4">Marketing Caption</h2>
                <p className="text-lg text-gray-700 italic border-l-4 border-indigo-500 pl-4 py-2">
                  "{result.caption}"
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-4">Strategy Tips</h2>
                <ul className="list-disc space-y-2 pl-5 text-gray-600">
                  {tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
              
              <div className="bg-gray-100 p-4 rounded-xl text-sm text-gray-500">
                <strong>Prompt used:</strong> {result.imagePrompt}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
