import { CONFIG } from "./config.js";

/** @type {{token: string|null, expiresAt: number}} */
let _tokenCache = { token: null, expiresAt: 0 };

/**
 * Handles Crunchyroll API requests.
 * 
 * @param {Request} request - The incoming HTTP request.
 * @returns {Promise<Response>} - The processed response.
 */
export async function handleCrunchyroll(request) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
        const query = url.searchParams.get("q");
        if (!query) {
            return new Response(JSON.stringify({
                message: `${CONFIG.METADATA.POWERED_BY} Crunchyroll API`,
                usage: "/?q=Anime+Name",
                examples: [
                    "/?q=Jujutsu+Kaisen",
                    "/?q=One+Piece",
                    "/?q=https://www.crunchyroll.com/series/GY9PJ5KWR/naruto",
                    "/?q=GY9PJ5KWR"
                ]
            }, null, 2), { headers: { "Content-Type": "application/json" } });
        }

        try {
            const token = await loginAnonymously();
            const result = await fetchSeriesData(token, query);
            return new Response(JSON.stringify(result, null, 2), {
                headers: { "Content-Type": "application/json" }
            });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }, null, 2), {
                status: 500,
                headers: { "Content-Type": "application/json" }
            });
        }
    }

    return new Response(JSON.stringify({ error: "Not Found" }, null, 2), {
        status: 404,
        headers: { "Content-Type": "application/json" }
    });
}

/**
 * Sanitizes strings for response.
 * 
 * @param {string} value - The input string.
 * @param {string} [defaultValue=""] - The default value if input is empty.
 * @returns {string} - The sanitized string.
 */
function sanitizeString(value, defaultValue = "") {
    if (!value) return defaultValue;
    let str = String(value);
    const htmlEntities = {
        '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' '
    };
    str = str.replace(/&[a-z0-9#]+;/gi, (entity) => htmlEntities[entity] || entity);
    str = str.replace(/\s+/g, ' ').trim();
    return str || defaultValue;
}

/**
 * Sanitizes URLs.
 * 
 * @param {string} url - The URL to sanitize.
 * @returns {string|null} - The sanitized URL or null.
 */
function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return null;
    url = url.trim();
    return (url.startsWith('http://') || url.startsWith('https://')) ? url : null;
}

/**
 * Sanitizes integers.
 * 
 * @param {any} value - The input value.
 * @param {number} [defaultValue=0] - The default value.
 * @returns {number} - The sanitized integer.
 */
function sanitizeInteger(value, defaultValue = 0) {
    if (value === null || value === undefined) return defaultValue;
    const items = parseInt(value, 10);
    return isNaN(items) ? defaultValue : items;
}

/**
 * Ensures value is an array.
 * 
 * @param {any} value - The input value.
 * @returns {Array} - The resulting array.
 */
function sanitizeList(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

/**
 * Performs an anonymous login to Crunchyroll to retrieve an access token.
 * 
 * @returns {Promise<string>} - The access token.
 */
async function loginAnonymously() {
    if (_tokenCache.token && Date.now() < _tokenCache.expiresAt) {
        return _tokenCache.token;
    }

    await fetch(`${CONFIG.CRUNCHYROLL.BASE_URL}/`, {
        headers: { "User-Agent": CONFIG.CRUNCHYROLL.USER_AGENT }
    });

    const tokenUrl = `${CONFIG.CRUNCHYROLL.BASE_URL}/auth/v1/token`;
    const deviceId = crypto.randomUUID();

    const formData = new URLSearchParams();
    formData.append("grant_type", "client_id");
    formData.append("scope", "offline_access");
    formData.append("device_id", deviceId);
    formData.append("device_type", "ANDROIDTV");

    const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
            "Authorization": `Basic ${CONFIG.CRUNCHYROLL.ANONYMOUS_AUTH_TOKEN}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "ETP-Anonymous-ID": deviceId,
            "User-Agent": CONFIG.CRUNCHYROLL.USER_AGENT
        },
        body: formData
    });

    if (!response.ok) {
        throw new Error("Crunchyroll login failed");
    }

    const data = await response.json();
    if (!data.access_token) {
        throw new Error("No access token in response");
    }

    _tokenCache.token = data.access_token;
    _tokenCache.expiresAt = Date.now() + CONFIG.CRUNCHYROLL.TOKEN_EXPIRY_MS;
    return data.access_token;
}

/**
 * Calculates Levenshtein ratio between two strings for fuzzy matching.
 */
function levenshteinRatio(s, t) {
    if (!s || !t) return 0;
    const m = s.length, n = t.length;
    const d = Array.from(Array(m + 1), () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) d[i][0] = i;
    for (let j = 0; j <= n; j++) d[0][j] = j;

    for (let j = 1; j <= n; j++) {
        for (let i = 1; i <= m; i++) {
            const cost = s[i - 1] === t[j - 1] ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        }
    }
    const maxLen = Math.max(m, n);
    return maxLen === 0 ? 1.0 : 1.0 - (d[m][n] / maxLen);
}

/**
 * Fetches series data from Crunchyroll.
 */
async function fetchSeriesData(token, query) {
    let headers = {
        "Authorization": `Bearer ${token}`,
        "User-Agent": CONFIG.CRUNCHYROLL.USER_AGENT
    };
    query = sanitizeString(query);
    if (!query) return { error: "Empty query" };

    let seriesId = null;
    let initialSearchPromise = null;

    if (/^[A-Z0-9]{9}$/.test(query)) {
        seriesId = query;
        const searchUrl = new URL(`${CONFIG.CRUNCHYROLL.BASE_URL}/content/v2/discover/search`);
        const params = { "q": query, "type": "series", "limit": "1", "locale": CONFIG.CRUNCHYROLL.DEFAULT_LOCALE, "ratings": "true" };
        searchUrl.search = new URLSearchParams(params).toString();
        initialSearchPromise = fetch(searchUrl, { headers }).then(r => r.ok ? r.json() : null);
    }
    else if (query.includes("crunchyroll.com/")) {
        const match = query.match(/\/series\/([A-Z0-9]{9})/);
        if (match) {
            seriesId = match[1];
            const searchUrl = new URL(`${CONFIG.CRUNCHYROLL.BASE_URL}/content/v2/discover/search`);
            const params = { "q": seriesId, "type": "series", "limit": "1", "locale": CONFIG.CRUNCHYROLL.DEFAULT_LOCALE, "ratings": "true" };
            searchUrl.search = new URLSearchParams(params).toString();
            initialSearchPromise = fetch(searchUrl, { headers }).then(r => r.ok ? r.json() : null);
        }
    }

    if (!seriesId) {
        const searchUrl = new URL(`${CONFIG.CRUNCHYROLL.BASE_URL}/content/v2/discover/search`);
        const params = { "q": query, "type": "series", "limit": "3", "locale": CONFIG.CRUNCHYROLL.DEFAULT_LOCALE, "ratings": "true" };
        searchUrl.search = new URLSearchParams(params).toString();

        let searchResp = await fetch(searchUrl, { headers });
        if (searchResp.status === 401) {
            token = await loginAnonymously();
            headers["Authorization"] = `Bearer ${token}`;
            searchResp = await fetch(searchUrl, { headers });
        }

        const searchData = await searchResp.json();
        let bestRatio = 0.0, bestCandidate = null;
        const queryLower = query.toLowerCase();

        const items = searchData.data ? searchData.data.reduce((acc, val) => acc.concat(val.items), []) : [];
        for (const item of items) {
            if (item.type === 'series') {
                const title = item.title?.toLowerCase() || "";
                const ratio = levenshteinRatio(queryLower, title);
                if (ratio > bestRatio) {
                    bestRatio = ratio;
                    bestCandidate = item;
                }
            }
        }

        if (bestCandidate && bestRatio >= 0.8) {
            seriesId = bestCandidate.id;
            initialSearchPromise = Promise.resolve({ data: [{ items: [bestCandidate] }] });
        } else {
            const slug = query.toLowerCase().replace(/\s+/g, "-");
            const directUrl = `${CONFIG.CRUNCHYROLL.BASE_URL}/${slug}`;
            try {
                const webResp = await fetch(directUrl, {
                    headers: { "User-Agent": CONFIG.CRUNCHYROLL.USER_AGENT },
                    redirect: "follow"
                });
                const urlMatch = webResp.url.match(/\/series\/([A-Z0-9]+)/);
                if (urlMatch) seriesId = urlMatch[1];
                if (!seriesId) return { error: "Series not found" };
            } catch (e) {
                return { error: "Series not found", details: e.message };
            }
        }
    }

    if (!seriesId) return { error: "Invalid Series ID or Name" };

    const cmsPromise = (async () => {
        const cmsUrl = new URL(`${CONFIG.CRUNCHYROLL.BASE_URL}/content/v2/cms/series/${seriesId}`);
        cmsUrl.searchParams.set("locale", CONFIG.CRUNCHYROLL.DEFAULT_LOCALE);
        const resp = await fetch(cmsUrl, { headers });
        return resp.ok ? resp.json() : null;
    })();

    const genresPromise = fetchCategories(token, seriesId);
    const copyrightPromise = fetchCopyright(seriesId);

    const [cmsData, genresRaw, copyrightText, searchResult] = await Promise.all([
        cmsPromise, genresPromise, copyrightPromise, initialSearchPromise
    ]);

    let searchItem = null;
    if (searchResult?.data) {
        const items = searchResult.data.flatMap(d => d.items || []);
        searchItem = items.find(i => i.id === seriesId) || items[0];
    }

    if (!cmsData?.data?.length) return { error: "Series details not found" };
    const fullData = cmsData.data[0];

    let genres = genresRaw || [];
    if (!genres.length) {
        for (const cat of (fullData.tenant_categories || [])) {
            const genreName = typeof cat === 'string' ? cat : (cat.display_value || cat.label || cat.id);
            if (genreName) genres.push(sanitizeString(genreName));
        }
    }

    const images = fullData.images || {};
    const landscapePoster = getBestImage(images, "poster_wide");
    const portraitPoster = getBestImage(images, "poster_tall");
    const backdropUrl = `https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=cover,format=auto,quality=100,width=1920/keyart/${seriesId}-backdrop_wide`;

    let starRating = "N/A", reviewCount = "N/A";
    const ratingBreakdown = {};

    if (searchItem?.rating) {
        starRating = searchItem.rating.average || "N/A";
        reviewCount = searchItem.rating.total || "N/A";
        ["5s", "4s", "3s", "2s", "1s"].forEach(key => {
            const starData = searchItem.rating[key];
            if (starData) ratingBreakdown[key] = String(starData.displayed || "0");
        });
    }

    const awards = (fullData.awards || []).map(award => ({
        text: sanitizeString(award.text),
        icon_url: sanitizeUrl(award.icon_url),
        is_winner: !!award.is_winner
    }));

    return {
        id: sanitizeString(seriesId),
        title: sanitizeString(fullData.title),
        slug: sanitizeString(fullData.slug_title),
        year: fullData.series_launch_year,
        description: sanitizeString(fullData.description),
        extended_description: sanitizeString(fullData.extended_description),
        images: { landscape_poster: landscapePoster, portrait_poster: portraitPoster, banner_backdrop: backdropUrl },
        stats: {
            episode_count: sanitizeInteger(fullData.episode_count),
            season_count: sanitizeInteger(fullData.season_count),
            is_simulcast: !!fullData.is_simulcast,
            is_dubbed: !!fullData.is_dubbed,
            is_subbed: !!fullData.is_subbed
        },
        languages: {
            audio: sanitizeList(fullData.audio_locales),
            subtitles: sanitizeList(fullData.subtitle_locales)
        },
        metadata: {
            rating: { stars: starRating, count: reviewCount, breakdown: ratingBreakdown },
            maturity: { age_rating: sanitizeList(fullData.maturity_ratings), advisory: sanitizeList(fullData.content_descriptors) },
            genres,
            keywords: sanitizeList(fullData.keywords),
            release_year: sanitizeInteger(fullData.series_launch_year) || null,
            publisher: sanitizeString(fullData.content_provider),
            copyright: copyrightText,
            awards
        },
        powered_by: CONFIG.METADATA.POWERED_BY,
        created_by: CONFIG.METADATA.CREATED_BY
    };
}

/**
 * Fetches categories for a series.
 */
async function fetchCategories(token, seriesId) {
    const url = new URL(`${CONFIG.CRUNCHYROLL.BASE_URL}/content/v2/discover/categories`);
    url.searchParams.set("guid", seriesId);
    url.searchParams.set("locale", CONFIG.CRUNCHYROLL.DEFAULT_LOCALE);
    try {
        const resp = await fetch(url, {
            headers: { "Authorization": `Bearer ${token}`, "User-Agent": CONFIG.CRUNCHYROLL.USER_AGENT }
        });
        if (!resp.ok) return [];
        const data = await resp.json();
        return (data.data || []).filter(item => item.localization?.title).map(item => sanitizeString(item.localization.title));
    } catch (e) { return []; }
}

/**
 * Fetches copyright information for a series.
 */
async function fetchCopyright(seriesId) {
    const url = `${CONFIG.CRUNCHYROLL.STATIC_URL}/copyright/${seriesId}.json`;
    try {
        const resp = await fetch(url, { headers: { "User-Agent": CONFIG.CRUNCHYROLL.USER_AGENT } });
        if (resp.ok) {
            const data = await resp.json();
            return sanitizeString(data.longCopyright || data.shortCopyright, "N/A");
        }
    } catch (e) { }
    return "N/A";
}

/**
 * Extracts the best image URL from Crunchyroll's image metadata.
 */
function getBestImage(images, typeKey) {
    if (!images) return null;
    const flat = (images[typeKey] || []).flat();
    if (flat.length > 0) {
        const last = flat[flat.length - 1];
        if (last?.source) return sanitizeUrl(last.source);
    }
    return null;
}
