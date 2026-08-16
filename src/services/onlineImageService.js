'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const UPLOADS_DIR = process.env.UPLOADS_PATH || path.resolve(__dirname, '../../uploads');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Fetch helper with redirect, timeout, and stream handling
 */
function fetchBuffer(url, maxRedirects = 5, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) return reject(new Error('Te veel omleidingen'));

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      return reject(new Error('Ongeldige URL'));
    }

    const client = parsedUrl.protocol === 'https:' ? https : http;

    const req = client.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site'
      },
      timeout: timeoutMs
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const nextUrl = new URL(res.headers.location, url).href;
        return resolve(fetchBuffer(nextUrl, maxRedirects - 1, timeoutMs));
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Server reageerde met statuscode ${res.statusCode}`));
      }

      const contentType = res.headers['content-type'] || 'image/jpeg';
      const chunks = [];
      let size = 0;
      const MAX_SIZE = 15 * 1024 * 1024; // 15MB limit

      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_SIZE) {
          req.destroy();
          return reject(new Error('Afbeelding is groter dan 15MB'));
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        resolve({
          buffer: Buffer.concat(chunks),
          contentType
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Verzoek time-out bij ophalen van afbeelding'));
    });
  });
}

/**
 * High-accuracy Web Food & Recipe Image Search
 * Queries web image indexes for authentic recipe photography
 */
async function searchWebFoodImages(query, limit = 36) {
  return new Promise((resolve) => {
    // Add food/recept keyword for culinary search precision
    const searchTerm = query.toLowerCase().includes('recept') || query.toLowerCase().includes('dish') || query.toLowerCase().includes('food')
      ? query
      : `${query} recept`;

    const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(searchTerm)}&form=HDRSC2&first=1&safeSearch=moderate`;

    https.get(searchUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const results = [];
        const regex = /m=\"(\{[^\"]+\})\"/g;
        let match;

        while ((match = regex.exec(data)) !== null && results.length < limit) {
          try {
            const raw = match[1].replace(/&quot;/g, '\"').replace(/&amp;/g, '&');
            const parsed = JSON.parse(raw);

            if (parsed.murl && (parsed.turl || parsed.murl)) {
              let domain = 'Web';
              if (parsed.purl) {
                try {
                  domain = new URL(parsed.purl).hostname.replace(/^www\./, '');
                } catch (e) {}
              }

              // Clean title
              let cleanTitle = parsed.t || query;
              cleanTitle = cleanTitle.replace(/[\r\n\t]+/g, ' ').trim();
              if (cleanTitle.length > 70) {
                cleanTitle = cleanTitle.substring(0, 67) + '...';
              }

              results.push({
                id: `web-${Buffer.from(parsed.murl).toString('base64url').substring(0, 16)}`,
                title: cleanTitle,
                thumbnail: parsed.turl || parsed.murl,
                full_url: parsed.murl,
                creator: domain,
                creator_url: parsed.purl || '',
                source: domain,
                license: 'Web resultaat'
              });
            }
          } catch (e) {}
        }

        resolve(results);
      });
    }).on('error', (err) => {
      console.error('Error in searchWebFoodImages:', err.message);
      resolve([]);
    });
  });
}

/**
 * Optional Unsplash API (if user configured UNSPLASH_ACCESS_KEY in .env)
 */
async function searchUnsplash(query, page = 1, perPage = 24) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}&client_id=${accessKey}`;
    const { buffer } = await fetchBuffer(url);
    const json = JSON.parse(buffer.toString('utf8'));

    if (!json.results) return [];

    return json.results.map(item => ({
      id: `unsplash-${item.id}`,
      title: item.description || item.alt_description || query,
      thumbnail: item.urls.small || item.urls.thumb || item.urls.regular,
      full_url: item.urls.regular || item.urls.full || item.urls.small,
      creator: item.user?.name || item.user?.username || 'Unsplash',
      creator_url: item.user?.links?.html || 'https://unsplash.com',
      source: 'Unsplash',
      license: 'Unsplash License'
    }));
  } catch (err) {
    console.error('Error searching Unsplash API:', err.message);
    return null;
  }
}

/**
 * Search online images across configured and web image engines
 */
async function searchOnlineImages(query, page = 1) {
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) return [];

  // 1. Try Unsplash first if key is present
  const unsplashResults = await searchUnsplash(cleanQuery, page);
  if (unsplashResults && unsplashResults.length > 0) {
    return unsplashResults;
  }

  // 2. High-accuracy web food search (Google/Bing food image index)
  const webResults = await searchWebFoodImages(cleanQuery, 32);
  if (webResults && webResults.length > 0) {
    return webResults;
  }

  return [];
}

/**
 * Download an online image (tries full URL first, fallbacks to thumbnail) and saves locally
 */
async function downloadAndSaveOnlineImage(imageUrl, fallbackUrl = null) {
  if (!imageUrl || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
    throw new Error('Ongeldige afbeeldings-URL opgegeven.');
  }

  let downloadResult;

  // Try full URL first
  try {
    downloadResult = await fetchBuffer(imageUrl);
  } catch (err) {
    // If full URL fails and fallback (thumbnail) is provided, download fallback
    if (fallbackUrl && fallbackUrl !== imageUrl) {
      try {
        downloadResult = await fetchBuffer(fallbackUrl);
      } catch (fallbackErr) {
        throw new Error(`Kon afbeelding niet downloaden: ${err.message}`);
      }
    } else {
      throw err;
    }
  }

  const { buffer, contentType } = downloadResult;

  // Determine file extension
  let ext = '.jpg';
  if (contentType.includes('png')) ext = '.png';
  else if (contentType.includes('webp')) ext = '.webp';
  else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';

  const filename = `online-${uuidv4()}${ext}`;
  const targetPath = path.join(UPLOADS_DIR, filename);

  // Ensure uploads directory exists
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  fs.writeFileSync(targetPath, buffer);

  return {
    filename,
    url: `/uploads/${filename}`
  };
}

module.exports = {
  fetchBuffer,
  searchOnlineImages,
  downloadAndSaveOnlineImage
};
