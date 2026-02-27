/**
 * Project: Blaze Anime Data APIs
 * Purpose: Centralized configuration and constants.
 */

export const CONFIG = {
    // API Selector: 'anilist' or 'crunchyroll'
    DEFAULT_API: "anilist",

    // AniList Configuration
    ANILIST: {
        API_URL: "https://graphql.anilist.co",
        OAUTH_TOKEN_URL: "https://anilist.co/api/v2/oauth/token"
    },

    // Crunchyroll Configuration
    CRUNCHYROLL: {
        ANONYMOUS_AUTH_TOKEN: "dC1rZGdwMmg4YzNqdWI4Zm4wZnE6eWZMRGZNZnJZdktYaDRKWFMxTEVJMmNDcXUxdjVXYW4=",
        USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        BASE_URL: "https://www.crunchyroll.com",
        STATIC_URL: "https://static.crunchyroll.com",
        DEFAULT_LOCALE: "en-US",
        TOKEN_EXPIRY_MS: 10 * 365 * 24 * 60 * 60 * 1000 // 10 years
    },

    // Default branding metadata
    METADATA: {
        POWERED_BY: "@Blaze_Updatez",
        CREATED_BY: "@Bharath_boy"
    },

    // Cache settings
    CACHE: {
        MAX_AGE: 3600 // 1 Hour in seconds
    }
};
