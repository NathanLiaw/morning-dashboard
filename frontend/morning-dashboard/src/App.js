import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "./App.css";

function App() {
    const LOCAL_STORAGE_KEY = "customFeeds";
    const DEFAULT_FEEDS = [
        { url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", articles: 5 },
        { url: "https://feeds.theguardian.com/theguardian/world/rss", articles: 5 },
        { url: "https://engineering.fb.com/feed/", articles: 5 },
        { url: "https://blog.cloudflare.com/rss/", articles: 5 },
        { url: "https://stackoverflow.blog/feed/", articles: 5 }
    ];

    const [feeds, setFeeds] = useState([]);
    const [customFeeds, setCustomFeeds] = useState(() => {
        const savedFeeds = localStorage.getItem(LOCAL_STORAGE_KEY);
        return savedFeeds ? JSON.parse(savedFeeds) : DEFAULT_FEEDS;
    });
    const [newFeedUrl, setNewFeedUrl] = useState("");
    const [layout, setLayout] = useState("3x2");
    const [feedSortStates, setFeedSortStates] = useState({});
    const [showDropdown, setShowDropdown] = useState(null);
    const [refreshingFeeds, setRefreshingFeeds] = useState({});
    const [sortDirections, setSortDirections] = useState({});

    const fetchFeeds = useCallback(async () => {
        try {
            const response = await axios.post("http://localhost:5000/fetch-feeds", { feeds: customFeeds });
            setFeeds(response.data);
        } catch (error) {
            console.error("Error fetching feeds:", error);
        }
    }, [customFeeds]);

    useEffect(() => {
        fetchFeeds();
    }, [fetchFeeds]);

    useEffect(() => {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(customFeeds));
    }, [customFeeds]);

    const handleAddFeed = () => {
        const trimmedUrl = newFeedUrl.trim();
        if (trimmedUrl) {
            setCustomFeeds(prevFeeds => [...prevFeeds, { url: trimmedUrl, articles: 5 }]);
            setNewFeedUrl("");
        }
    };

    const handleRemoveFeed = (index) => {
        setCustomFeeds(prevFeeds => prevFeeds.filter((_, i) => i !== index));
    };

    const handleUpdateArticleCount = (index, articles) => {
        setCustomFeeds(prevFeeds => 
            prevFeeds.map((feed, i) => 
                i === index ? { ...feed, articles } : feed
            )
        );
    };

    const handleRefreshFeed = async (feedUrl) => {
        try {
            setRefreshingFeeds(prev => ({ ...prev, [feedUrl]: true }));
            const response = await axios.post("http://localhost:5000/fetch-feeds", { 
                feeds: [customFeeds.find(feed => feed.url === feedUrl)]
            });
            setFeeds(prevFeeds => prevFeeds.map(feed => 
                feed.url === feedUrl ? response.data[0] : feed
            ));
        } catch (error) {
            console.error("Error refreshing feed:", error);
        } finally {
            setRefreshingFeeds(prev => ({ ...prev, [feedUrl]: false }));
        }
    };

    const toggleDropdown = (index) => {
        setShowDropdown(showDropdown === index ? null : index);
    };

    const sortFeedItems = (items, sortType, index) => {
        const direction = sortDirections[index]?.[sortType] === 'asc' ? 1 : -1;
        
        return [...items].sort((a, b) => {
            if (sortType === 'title') {
                return direction * a.title.localeCompare(b.title);
            } else if (sortType === 'date') {
                const timestampA = new Date(a.timestamp).getTime();
                const timestampB = new Date(b.timestamp).getTime();
                return direction * (timestampB - timestampA);
            }
            return 0;
        });
    };

    const handleSort = (index, sortType) => {
        if (feedSortStates[index] === sortType) {
            setSortDirections(prev => ({
                ...prev,
                [index]: {
                    ...prev[index],
                    [sortType]: prev[index]?.[sortType] === 'asc' ? 'desc' : 'asc'
                }
            }));
        } else {
            setSortDirections(prev => ({
                ...prev,
                [index]: {
                    ...prev[index],
                    [sortType]: 'desc'
                }
            }));
        }

        setFeedSortStates(prev => ({
            ...prev,
            [index]: sortType
        }));
        setShowDropdown(null);
    };

    const getGridStyle = () => {
        const [cols] = layout.split("x").map(Number);
        return {
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: "20px"
        };
    };

    const renderFeedItem = (item, favicon, i) => (
        <li key={i} style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start',
            gap: '12px',
            padding: '4px 0'
        }}>
            <div style={{ 
                display: 'flex', 
                alignItems: 'flex-start',
                width: 'calc(100% - 100px)',
                minWidth: 0
            }}>
                <img 
                    src={favicon || "https://upload.wikimedia.org/wikipedia/en/d/d0/Dogecoin_Logo.png"} 
                    alt="favicon" 
                    style={{ 
                        width: 16, 
                        height: 16, 
                        marginRight: 5, 
                        flexShrink: 0,
                        marginTop: '4px'
                    }} 
                />
                <a href={item.link} 
                   target="_blank" 
                   rel="noopener noreferrer"
                   style={{
                       display: 'block',
                       wordBreak: 'break-word',
                       lineHeight: '1.4'
                   }}>
                    {item.title}
                </a>
            </div>
            <span style={{ 
                color: "#888", 
                fontSize: "0.9em",
                flexShrink: 0,
                width: '90px',
                textAlign: 'right'
            }}>
                {item.timeago}
            </span>
        </li>
    );

    const renderFeedCard = (feed, index) => {
        const sortType = feedSortStates[index];
        const sortedItems = sortType 
            ? sortFeedItems(feed.items, sortType, index)
            : feed.items;

        const isRefreshing = refreshingFeeds[feed.url];
        const currentSortDirection = sortDirections[index]?.[sortType];

        return (
            <div key={index} className="news-card">
                <div className="news-card-header">
                    <h2>
                        <img 
                            src={feed.favicon || "https://upload.wikimedia.org/wikipedia/en/d/d0/Dogecoin_Logo.png"} 
                            alt="favicon" 
                            style={{ width: 16, height: 16, marginRight: 8 }} 
                        />
                        {feed.title}
                    </h2>
                    <div className="news-card-controls">
                        <input 
                            type="number" 
                            value={customFeeds[index]?.articles || 5} 
                            min="1" 
                            max="10"
                            onChange={(e) => handleUpdateArticleCount(index, Number(e.target.value))} 
                        />
                        <button 
                            onClick={() => handleRefreshFeed(feed.url)}
                            className={`refresh-button ${isRefreshing ? 'refreshing' : ''}`}
                            title="Refresh feed"
                            disabled={isRefreshing}
                        >
                            ↻
                        </button>
                        <div className="dropdown">
                            <button 
                                onClick={() => toggleDropdown(index)}
                                className="dropdown-button"
                                title="More options"
                            >
                                ⋮
                            </button>
                            {showDropdown === index && (
                                <div className="dropdown-content">
                                    <button 
                                        onClick={() => handleSort(index, 'title')}
                                        className={sortType === 'title' ? 'active' : ''}
                                    >
                                        Sort by Title {sortType === 'title' && (currentSortDirection === 'asc' ? '↑' : '↓')}
                                    </button>
                                    <button 
                                        onClick={() => handleSort(index, 'date')}
                                        className={sortType === 'date' ? 'active' : ''}
                                    >
                                        Sort by Date {sortType === 'date' && (currentSortDirection === 'asc' ? '↑' : '↓')}
                                    </button>
                                    <button 
                                        onClick={() => {
                                            handleRemoveFeed(index);
                                            setShowDropdown(null);
                                        }}
                                        className="dropdown-remove-button"
                                    >
                                        Remove Feed
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <ul>
                    {sortedItems
                        .slice(0, customFeeds[index]?.articles || 5)
                        .map((item, i) => renderFeedItem(item, feed.favicon, i))}
                </ul>
            </div>
        );
    };

    return (
        <div className="dashboard">
            <h1>Morning News Dashboard</h1>
            <div className="controls">
                <input 
                    type="text" 
                    placeholder="Add RSS URL" 
                    value={newFeedUrl} 
                    onChange={(e) => setNewFeedUrl(e.target.value)} 
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddFeed(); }}
                />
                <button onClick={handleAddFeed}>Add Feed</button>
                <select value={layout} onChange={(e) => setLayout(e.target.value)}>
                    <option value="3x2">3x2</option>
                    <option value="2x4">2x4</option>
                    <option value="4x3">4x3</option>
                </select>
            </div>
            <div className="news-grid" style={getGridStyle()}>
                {feeds.map((feed, index) => renderFeedCard(feed, index))}
            </div>
        </div>
    );
}

export default App;
