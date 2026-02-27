import { handleCrunchyroll } from "./crunchyroll.js";
import { handleAniList } from "./anilist.js";
import { CONFIG } from "./config.js";

/**
 * Main fetch handler for the Cloudflare Worker.
 * Routes requests to AniList or Crunchyroll handlers based on environment variables.
 * 
 * @param {Request} request - The incoming HTTP request.
 * @param {Object} env - The environment variables provided by Cloudflare.
 * @param {Object} ctx - The execution context.
 * @returns {Promise<Response>} - The HTTP response.
 */
export default {
    async fetch(request, env, ctx) {
        const apiType = env.API_SELECTOR || CONFIG.DEFAULT_API;

        if (apiType.toLowerCase() === "anilist") {
            return handleAniList(request, env, ctx);
        }

        return handleCrunchyroll(request, env, ctx);
    }
};
