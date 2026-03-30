require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const ip = require('ip');
const qrcode = require('qrcode-terminal');

const app = express();
const PORT = 3000;

// Default Music Directory (Windows)
const MUSIC_DIR = process.env.MUSIC_DIR || 'C:\\Users\\Administrator\\Music';
const METADATA_FILE = path.join(__dirname, 'metadata.json');
const USERDATA_FILE = path.join(__dirname, 'userdata.json');

// Real-time Playback Sync State
let playbackState = {
    songId: null,
    position: 0,
    isPlaying: false,
    isShuffle: false,
    volume: 1.0,
    command: null // 'PLAY', 'PAUSE', 'NEXT', 'PREV'
};

app.use(cors());
app.use(express.json());

async function askAI(prompt) {
    try {
        const response = await fetch('http://127.0.0.1:11434/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: process.env.OPENROUTER_MODEL || 'phi3',
                messages: [{ role: 'user', content: prompt }]
            })
        });

        const data = await response.json();
        if (response.ok && data.choices && data.choices.length > 0) {
            return { success: true, content: data.choices[0].message.content.trim() };
        }
        return { success: false, status: response.status, error: data.error || 'Unknown error' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Serve the frontend
app.use(express.static(path.join(__dirname, 'public')));

// Serve the music files as static to enable seeking/streaming easily
app.use('/music', express.static(MUSIC_DIR));

// Server-Side Persistent Storage (Playlists and Liked Songs)
app.get('/api/userdata', (req, res) => {
    if (fs.existsSync(USERDATA_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(USERDATA_FILE, 'utf8'));
            res.json(data);
        } catch (e) {
            res.json({ likedSongs: [], playlists: {} });
        }
    } else {
        res.json({ likedSongs: [], playlists: {} });
    }
});

app.post('/api/userdata', (req, res) => {
    try {
        fs.writeFileSync(USERDATA_FILE, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to save userdata' });
    }
});

// Real-sync API
app.get('/api/sync/state', (req, res) => {
    res.json(playbackState);
});

app.post('/api/sync/state', (req, res) => {
    playbackState = { ...playbackState, ...req.body };
    res.json({ success: true });
});

app.post('/api/sync/command', (req, res) => {
    playbackState.command = req.body; // Store full object { command: 'SEEK', value: 123 }
    res.json({ success: true });
});

app.get('/api/sync/command', (req, res) => {
    const cmd = playbackState.command;
    playbackState.command = null; // Consume command
    res.json(cmd || { command: null });
});

// API to list all songs (supports cached AI Metadata)
app.get('/api/songs', (req, res) => {
    if (!fs.existsSync(MUSIC_DIR)) {
        return res.status(404).json({ error: 'Music directory not found', path: MUSIC_DIR });
    }

    let cache = {};
    if (fs.existsSync(METADATA_FILE)) {
        try {
            cache = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
        } catch (e) { }
    }

    fs.readdir(MUSIC_DIR, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to read directory' });
        }

        const validExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.ogg'];
        const songs = files
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return validExtensions.includes(ext);
            })
            .map((file, index) => {
                const url = `/music/${encodeURIComponent(file)}`;
                if (cache[file]) {
                    return {
                        id: index,
                        filename: file,
                        title: cache[file].title,
                        artist: cache[file].artist,
                        url
                    };
                }
                return {
                    id: index,
                    title: file.replace(path.extname(file), ''),
                    artist: 'Local Audio',
                    filename: file,
                    url
                };
            });

        res.json(songs);
    });
});

// AI DJ: Contextual Recommendations
app.post('/api/ai/recommend', async (req, res) => {
    const { playedSongs, allSongsPreview } = req.body;

    const listStr = allSongsPreview.map(s => `${s.id}: ${s.label}`).join('\n');
    const prompt = `You are an expert AI DJ. The user just listened to these songs:\n${playedSongs.join('\n')}\n\nBased on the vibe of those songs, pick exactly 5 similar or fitting songs from the user's local library list below.\nLocal Library:\n${listStr}\n\nReturn ONLY a JSON array of the 5 integer IDs you choose, like [4, 7, 12, 2, 8]. Do not explain your choices.`;

    const result = await askAI(prompt);
    if (!result.success) return res.status(500).json({ error: 'AI server unreachable', detail: result.error });

    try {
        const content = result.content;
        const jsonStr = content.substring(content.indexOf('['), content.lastIndexOf(']') + 1);
        const ids = JSON.parse(jsonStr);
        res.json({ recommended_ids: ids });
    } catch (e) {
        res.status(500).json({ error: 'AI failed to recommend valid IDs', raw: result.content });
    }
});

// AI Magic Playlist Naming
app.post('/api/ai/playlist-name', async (req, res) => {
    const { songs } = req.body;

    const prompt = `You are an expert playlist curator. Generate a short, catchy, and creative playlist name (2-4 words maximum) for a playlist containing the following songs:\n${songs.join('\n')}\n\nReturn ONLY the playlist name without any quotes or explanations.`;

    let result = await askAI(prompt);
    if (result.success) {
        let content = result.content.replace(/^"|"(.*)$/g, '$1').trim();
        res.json({ name: content });
    } else {
        res.status(500).json({ error: 'AI failed to generate name', detail: result.error });
    }
});

// AI Metadata Extractor (Background Process)
app.post('/api/ai/metadata', async (req, res) => {
    res.json({ status: 'Processing started in background' });

    let cache = {};
    if (fs.existsSync(METADATA_FILE)) {
        try { cache = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8')); } catch (e) { }
    }

    const files = fs.readdirSync(MUSIC_DIR);
    const validExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.ogg'];
    const unprocessed = files.filter(f => validExtensions.includes(path.extname(f).toLowerCase()) && !cache[f]);

    for (const file of unprocessed) {
        const rawName = file.replace(path.extname(file), '');
        const prompt = `You are a music metadata extractor. Extract the real artist name and track title from this messy filename: "${rawName}". \nRespond ONLY with a valid JSON strictly in this exact format: {"artist": "ArtistName", "title": "TrackTitle"}. \nDo not include any other conversational text. If you cannot extract the artist, put "Unknown Artist".\n\nFilename: ${rawName}\nJSON:`;

        console.log(`Analyzing: ${rawName}`);

        let attempts = 0;
        let success = false;

        while (attempts < 3 && !success) {
            const result = await askAI(prompt);

            if (result.success) {
                try {
                    const content = result.content;
                    const jsonStr = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
                    const metadata = JSON.parse(jsonStr);
                    cache[file] = {
                        title: metadata.title || rawName,
                        artist: metadata.artist || 'Unknown Artist'
                    };
                    fs.writeFileSync(METADATA_FILE, JSON.stringify(cache, null, 2));
                    success = true;
                } catch (e) {
                    console.log(`Failed to parse JSON for ${file}. Result: ${result.content}`);
                    success = true; // Don't retry on parse failure
                }
            } else if (result.status === 429) {
                attempts++;
                const delay = Math.pow(2, attempts) * 5000; // 10s, 20s, 40s
                console.warn(`Rate-limited! Waiting ${delay / 1000}s before retry ${attempts}/3...`);
                await sleep(delay);
            } else {
                console.error(`AI Error for ${file}:`, result.error);
                success = true; // Stop retrying on other errors
            }
        }

        // Mandatory wait between successful/failed calls to be kind to free tier
        await sleep(3000);
    }
    console.log("AI Metadata Scan Complete.");
});

app.listen(PORT, '0.0.0.0', () => {
    const localIp = ip.address();
    const localUrl = `http://localhost:${PORT}`;
    const remoteUrl = `http://${localIp}:${PORT}`;

    console.log('\n' + '='.repeat(50));
    console.log('🚀  OFFLINE SPOTIFY SERVER IS RUNNING');
    console.log('='.repeat(50));
    console.log(`\n💻  Host Control:   ${localUrl}`);
    console.log(`📱  Mobile Remote:  ${remoteUrl}`);
    console.log('\nScan this QR code with your phone to connect:');

    qrcode.generate(remoteUrl, { small: true });

    console.log('='.repeat(50) + '\n');
    console.log(`Serving music from: ${MUSIC_DIR}`);
});
