const express = require("express");
const cors = require("cors");
const Parser = require("rss-parser");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
const PORT = 5000;
const parser = new Parser();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("RSS Feed API is running!");
});

const fetchFavicon = async (feedUrl) => {
    try {
        const domain = new URL(feedUrl).origin;
        
        const response = await axios.get(domain, { 
            headers: { 
                "User-Agent": "Mozilla/5.0",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            },
            timeout: 5000
        });

        const $ = cheerio.load(response.data);

        const iconSelectors = [
            "link[rel='icon']",
            "link[rel='shortcut icon']", 
            "link[rel='apple-touch-icon']"
        ];

        for (const selector of iconSelectors) {
            const iconHref = $(selector).attr("href");
            if (iconHref) {
                try {
                    const fullUrl = iconHref.startsWith('http') ? iconHref : new URL(iconHref, domain).href;
                    const response = await axios.head(fullUrl, {
                        timeout: 3000,
                        validateStatus: status => status >= 200 && status < 300
                    });
                    if (response.status === 200) {
                        return fullUrl;
                    }
                } catch (error) {
                    continue;
                }
            }
        }

        const commonPaths = ['/favicon.ico', '/favicon.png'];
        for (const path of commonPaths) {
            try {
                const fullUrl = `${domain}${path}`;
                const response = await axios.head(fullUrl, {
                    timeout: 3000,
                    validateStatus: status => status >= 200 && status < 300
                });
                if (response.status === 200) {
                    return fullUrl;
                }
            } catch (error) {
                continue;
            }
        }

        return `https://www.google.com/s2/favicons?domain=${domain}`;

    } catch (error) {
        return `https://www.google.com/s2/favicons?domain=${new URL(feedUrl).hostname}`;
    }
};

app.post("/fetch-feeds", async (req, res) => {
    const { feeds } = req.body;

    if (!feeds || !Array.isArray(feeds) || feeds.length === 0) {
        return res.status(400).json({ error: "No feeds provided or invalid format" });
    }

    try {
        const results = await Promise.all(
            feeds.map(async (feedConfig) => {
                try {
                    const feed = await parser.parseURL(feedConfig.url);
                    const favicon = await fetchFavicon(feedConfig.url);

                    return {
                        url: feedConfig.url,
                        title: feed.title || "Unknown Source",
                        favicon,
                        items: feed.items.slice(0, feedConfig.articles).map(item => ({
                            title: item.title || "No title",
                            link: item.link || "#",
                            pubDate: item.pubDate || "Unknown date"
                        }))
                    };
                } catch (error) {
                    console.error(`Error fetching feed: ${feedConfig.url}`, error.message);
                    return { url: feedConfig.url, title: "Failed to fetch feed", favicon: "", items: [] };
                }
            })
        );

        res.json(results);
    } catch (error) {
        console.error("Server error while fetching feeds:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
