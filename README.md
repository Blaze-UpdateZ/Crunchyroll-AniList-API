# Blaze Anime Data APIs

A powerful and efficient API suite for fetching anime and manga data from popular sources like **AniList** and **Crunchyroll**. Built on Cloudflare Workers for global low-latency performance and robust caching.

---

## 📋 Table of Contents

- [Features](#-features)
- [Deployment Guide](#-deployment-guide)
  - [Prerequisites](#prerequisites)
  - [Steps](#step-1-clone-the-repository)
- [Configuration](#-configuration)
- [API Usage](#-api-usage)
- [Credits](#-credits)

---

## ✨ Features

- **Multi-Source Logic**: Seamlessly toggle between AniList and Crunchyroll.
- **Advanced AniList Support**: Support for anime/manga search, ID lookup, and deep character data.
- **Crunchyroll Integration**: Automated anonymous auth and fuzzy search for series metadata.
- **Edge Caching**: Leveraging Cloudflare Cache API for lightning-fast repeated requests.
- **Clean Architecture**: Centralized configuration and professional code structure.

## 🚀 Deployment Guide

### Prerequisites

1. [Node.js](https://nodejs.org/) installed.
2. [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed and authenticated.
3. A Cloudflare account.

### Step 1: Clone the Repository

```bash
git clone https://github.com/Blaze-UpdateZ/anime-data-apis.git
cd anime-data-apis
```

### Step 2: Configure Secrets

This project uses Cloudflare Worker secrets for sensitive credentials.

#### AniList Secrets (Optional but Recommended)

If you have AniList API credentials, add them to avoid rate limits:

```bash
wrangler secret put ANILIST_CLIENT_ID
wrangler secret put ANILIST_CLIENT_SECRET
```

### Step 3: Configure Environment Variables

Edit `wrangler.toml` if you wish to change the default API provider:

```toml
[vars]
API_SELECTOR = "anilist" # or "crunchyroll"
```

### Step 4: Local Development

Run the following command to start a local development server:

```bash
wrangler dev
```

### Step 5: Deploy to Cloudflare

Deploy your worker to the edge:

```bash
wrangler deploy
```

## 🛠️ Configuration

All non-sensitive constants are located in `src/config.js`. You can modify `DEFAULT_API`, `CACHE.MAX_AGE`, and service-specific URLs there.

## 📖 API Usage

### AniList

- **Search**: `/?q=Naruto`
- **Manga Toggle**: `/?q=Bleach&type=manga`
- **ID Lookup**: `/?q=21`

### Crunchyroll

- **Search**: `/?q=Jujutsu+Kaisen`
- **Direct URL**: `/?q=https://www.crunchyroll.com/series/GY9PJ5KWR/naruto`
- **ID Lookup**: `/?q=GY9PJ5KWR`

## 🤝 Credits

- **Powered by**: [@Blaze_Updatez](https://t.me/Blaze_Updatez)
- **Created by**: [@Bharath_boy](https://t.me/Bharath_boy)

---

_Disclaimer: This project is for educational purposes only. Use responsibly and respect the Terms of Service of the respective data providers._
