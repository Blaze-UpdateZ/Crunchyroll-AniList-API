import { CONFIG } from "./config.js";

const MEDIA_QUERY = `
query ($id: Int, $search: String, $type: MediaType) {
  Media (id: $id, search: $search, type: $type, sort: SEARCH_MATCH) {
    id
    title {
      romaji
      english
      native
    }
    description
    type
    format
    episodes
    chapters
    volumes
    averageScore
    status
    season
    seasonYear
    studios(isMain: true) {
      nodes {
        name
      }
    }
    coverImage {
      extraLarge
      color
    }
    bannerImage
    genres
    rankings {
      rank
      type
      allTime
      context
    }
    characters(role: MAIN, perPage: 4, sort: FAVOURITES_DESC) {
      edges {
        node {
          name {
            full
          }
          image {
            large
            medium
          }
          description
        }
        role
      }
    }
    supportingCharacters: characters(role: SUPPORTING, perPage: 4, sort: FAVOURITES_DESC) {
      edges {
        node {
          name {
            full
          }
          image {
            large
            medium
          }
        }
      }
    }
  }
}
`;

/** @type {{token: string|null, expiresAt: number}} */
let _authCache = { token: null, expiresAt: 0 };

/**
 * Handles AniList API requests.
 * 
 * @param {Request} request - The incoming HTTP request.
 * @param {Object} env - The environment variables.
 * @param {Object} ctx - The execution context.
 * @returns {Promise<Response>} - The processed response.
 */
export async function handleAniList(request, env, ctx) {
    const url = new URL(request.url);
    const cache = caches.default;

    let response = await cache.match(request);
    if (response) {
        return response;
    }

    if (url.pathname === "/") {
        const query = url.searchParams.get("q");

        if (!query) {
            return new Response(JSON.stringify({
                message: `${CONFIG.METADATA.POWERED_BY} AniList API`,
                usage: "/?q=Query&type=anime|manga",
                examples: [
                    "/?q=Naruto",
                    "/?q=One+Piece&type=manga",
                    "/?q=Bleach&t=m",
                    "/?q=21",
                    "/?q=https://anilist.co/anime/178025/Gachiakuta/"
                ]
            }, null, 2), { headers: { "Content-Type": "application/json" } });
        }

        const typeParam = url.searchParams.get("type");
        const shortType = url.searchParams.get("t");

        let mediaType = "ANIME";
        if (typeParam?.toLowerCase() === "manga" || shortType?.toLowerCase() === "m") {
            mediaType = "MANGA";
        }

        try {
            let token = null;
            if (env.ANILIST_CLIENT_ID && env.ANILIST_CLIENT_SECRET) {
                try {
                    token = await getAccessToken(env);
                } catch (authError) {
                    console.error("AniList Auth Failed:", authError);
                }
            }

            const data = await fetchAniListData(query, mediaType, token);
            if (!data) {
                return new Response(JSON.stringify({ error: "Not Found" }, null, 2), {
                    status: 404,
                    headers: { "Content-Type": "application/json" }
                });
            }

            const finalResponse = new Response(JSON.stringify(data, null, 2), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": `public, max-age=${CONFIG.CACHE.MAX_AGE}`
                }
            });

            if (ctx?.waitUntil) {
                ctx.waitUntil(cache.put(request, finalResponse.clone()));
            }
            return finalResponse;

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
 * Retrieves an OAuth2 access token for AniList.
 * 
 * @param {Object} env - The environment variables.
 * @returns {Promise<string|null>} - The access token or null.
 */
async function getAccessToken(env) {
    if (_authCache.token && Date.now() < _authCache.expiresAt) {
        return _authCache.token;
    }

    const response = await fetch(CONFIG.ANILIST.OAUTH_TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({
            grant_type: "client_credentials",
            client_id: env.ANILIST_CLIENT_ID,
            client_secret: env.ANILIST_CLIENT_SECRET
        })
    });

    if (!response.ok) {
        throw new Error(`Auth Error: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.access_token) {
        _authCache.token = data.access_token;
        _authCache.expiresAt = Date.now() + (data.expires_in * 1000) - 60000;
        return data.access_token;
    }
    return null;
}

/**
 * Fetches data from AniList GraphQL API.
 * 
 * @param {string} query - The search query or ID.
 * @param {string} [mediaType="ANIME"] - "ANIME" or "MANGA".
 * @param {string|null} [token=null] - Optional OAuth token.
 * @returns {Promise<Object|null>} - The processed data or null.
 */
async function fetchAniListData(query, mediaType = "ANIME", token = null) {
    const variables = { type: mediaType.toUpperCase() };

    if (/^\d+$/.test(query)) {
        variables.id = parseInt(query, 10);
    } else if (query.includes("anilist.co")) {
        const match = query.match(/anilist\.co\/(?:anime|manga)\/(\d+)/);
        if (match) {
            variables.id = parseInt(match[1], 10);
        } else {
            variables.search = query;
        }
    } else {
        variables.search = query;
    }

    const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(CONFIG.ANILIST.API_URL, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
            query: MEDIA_QUERY,
            variables: variables
        })
    });

    if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitTimeSeconds = retryAfter ? parseInt(retryAfter, 10) : 2;
        return {
            status: "waiting",
            message: "Rate limited by AniList.",
            retry_after: waitTimeSeconds,
            ...CONFIG.METADATA
        };
    }

    if (!response.ok) {
        throw new Error(`AniList API Error: ${response.statusText}`);
    }

    const json = await response.json();
    if (json.data && json.data.Media) {
        return processData(json.data.Media);
    }
    return null;
}

/**
 * Processes and cleans the data returned by AniList.
 * 
 * @param {Object} media - The raw media object from AniList.
 * @returns {Object} - The processed media object.
 */
function processData(media) {
    if (media.description) {
        media.description = media.description
            .replace(/<br>/g, "")
            .replace(/<i>/g, "")
            .replace(/<\/i>/g, "");
    }
    return {
        ...media,
        powered_by: CONFIG.METADATA.POWERED_BY,
        created_by: CONFIG.METADATA.CREATED_BY
    };
}
