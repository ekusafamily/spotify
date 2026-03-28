const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Default Music Directory (Windows)
const MUSIC_DIR = process.env.MUSIC_DIR || 'C:\\Users\\Administrator\\Music';
const METADATA_FILE = path.join(__dirname, 'metadata.json');

app.use(cors());
app.use(express.json());

async function askOllama(prompt) {
    try {
        const response = await fetch('http://127.0.0.1:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'phi3',
                prompt: prompt,
                stream: false
            })
        });
        const data = await response.json();
        return data.response.trim();
    } catch (error) {
        console.error("Ollama Error:", error);
        return null; // Return null so we can fallback
    }
}

// Serve the frontend
app.use(express.static(path.join(__dirname, 'public')));

// Serve the music files as static to enable seeking/streaming easily
app.use('/music', express.static(MUSIC_DIR));

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

    const result = await askOllama(prompt);
    if (!result) return res.status(500).json({ error: 'AI server unreachable' });

    try {
        const jsonStr = result.substring(result.indexOf('['), result.lastIndexOf(']') + 1);
        const ids = JSON.parse(jsonStr);
        res.json({ recommended_ids: ids });
    } catch (e) {
        res.status(500).json({ error: 'AI failed to recommend valid IDs', raw: result });
    }
});

// AI Magic Playlist Naming
app.post('/api/ai/playlist-name', async (req, res) => {
    const { songs } = req.body;

    const prompt = `You are an expert playlist curator. Generate a short, catchy, and creative playlist name (2-4 words maximum) for a playlist containing the following songs:\n${songs.join('\n')}\n\nReturn ONLY the playlist name without any quotes or explanations.`;

    let result = await askOllama(prompt);
    if (result) {
        result = result.replace(/^"|"(.*)$/g, '$1').trim();
        res.json({ name: result });
    } else {
        res.status(500).json({ error: 'AI failed to generate name' });
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
        const result = await askOllama(prompt);
        if (result) {
            try {
                const jsonStr = result.substring(result.indexOf('{'), result.lastIndexOf('}') + 1);
                const metadata = JSON.parse(jsonStr);
                cache[file] = {
                    title: metadata.title || rawName,
                    artist: metadata.artist || 'Unknown Artist'
                };
                fs.writeFileSync(METADATA_FILE, JSON.stringify(cache, null, 2));
            } catch (e) {
                console.log(`Failed to parse JSON from AI for ${file}. Result: ${result}`);
            }
        }
    }
    console.log("AI Metadata Scan Complete.");
});

app.listen(PORT, () => {
    console.log(`Offline Spotify clone running at http://localhost:${PORT}`);
    console.log(`Serving music from: ${MUSIC_DIR}`);
});
