document.addEventListener('DOMContentLoaded', () => {
    // Media Player Elements
    const audio1 = document.getElementById('audio-element-1');
    const audio2 = document.getElementById('audio-element-2');
    let activeAudio = audio1;
    let crossfadingAudio = null;
    let fadeInterval = null;
    let globalVolume = 1;
    const playPauseBtn = document.getElementById('play-pause-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const progressBar = document.getElementById('progress-bar');
    const progress = document.getElementById('progress');
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');
    const volumeBar = document.getElementById('volume-bar');
    const volume = document.getElementById('volume');
    const currentTrackName = document.getElementById('current-track-name');
    const heartNowPlaying = document.getElementById('heart-now-playing');
    let isRemote = false;

    // UI Elements
    const songsList = document.getElementById('songs-list');
    const heroTitle = document.getElementById('hero-title');
    const heroDesc = document.getElementById('hero-desc');
    const heroPlayBtn = document.getElementById('hero-play-btn');
    const searchContainer = document.getElementById('search-container');
    const searchInput = document.getElementById('search-input');
    const customPlaylistsList = document.getElementById('custom-playlists');

    // Queue Elements
    const queueToggleBtn = document.getElementById('queue-toggle-btn');
    const queuePanel = document.getElementById('queue-panel');
    const closeQueueBtn = document.getElementById('close-queue-btn');
    const queueContent = document.getElementById('queue-content');

    // Visualizer Setup
    const musicIcons = ['fa-music', 'fa-headphones', 'fa-compact-disc', 'fa-record-vinyl', 'fa-guitar', 'fa-microphone', 'fa-radio', 'fa-drum'];
    let audioContext;
    let analyser;
    let source1, source2;
    let dataArray;
    let bufferLength;
    let eqBands = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    let filters = [];
    let masterGain = null;
    const visualizerCanvas = document.getElementById('visualizer-canvas');
    const visualizerCtx = visualizerCanvas ? visualizerCanvas.getContext('2d') : null;
    const heroMainIcon = document.getElementById('hero-main-icon');

    function initVisualizer() {
        if (audioContext || !visualizerCanvas) return;
        visualizerCanvas.width = 232;
        visualizerCanvas.height = 232;
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();

        masterGain = audioContext.createGain();
        masterGain.gain.value = 1;

        // Create EQ filter chain
        let prevNode = analyser;
        eqBands.forEach(freq => {
            let filter = audioContext.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = freq;
            filter.Q.value = 1.4; // Slightly tighter Q for 10-band
            filter.gain.value = 0;
            filters.push(filter);
            prevNode.connect(filter);
            prevNode = filter;
        });

        prevNode.connect(masterGain);
        masterGain.connect(audioContext.destination);

        source1 = audioContext.createMediaElementSource(audio1);
        source2 = audioContext.createMediaElementSource(audio2);
        source1.connect(analyser);
        source2.connect(analyser);

        analyser.fftSize = 64;
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        drawVisualizer();
    }

    function drawVisualizer() {
        requestAnimationFrame(drawVisualizer);
        if (!isPlaying || !visualizerCtx) return;
        analyser.getByteFrequencyData(dataArray);
        const width = visualizerCanvas.width;
        const height = visualizerCanvas.height;
        visualizerCtx.clearRect(0, 0, width, height);

        if (visualizerMode === 'bars') {
            const barWidth = (width / bufferLength) * 2.5;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
                let barHeight = (dataArray[i] / 255) * height;
                const gradient = visualizerCtx.createLinearGradient(0, height, 0, 0);
                gradient.addColorStop(0, 'rgba(30, 215, 96, 0.4)');
                gradient.addColorStop(1, 'rgba(31, 223, 100, 1)');
                visualizerCtx.fillStyle = gradient;
                visualizerCtx.fillRect(x, height - barHeight, barWidth, barHeight);
                x += barWidth + 2;
            }
        } else if (visualizerMode === 'pulse') {
            const centerX = width / 2;
            const centerY = height / 2;
            const radius = 60;
            visualizerCtx.beginPath();
            visualizerCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            visualizerCtx.strokeStyle = 'rgba(30, 215, 96, 0.2)';
            visualizerCtx.stroke();

            for (let i = 0; i < bufferLength; i++) {
                const angle = (i / bufferLength) * (Math.PI * 2);
                const amplitude = (dataArray[i] / 255) * 40;
                const x1 = centerX + Math.cos(angle) * (radius);
                const y1 = centerY + Math.sin(angle) * (radius);
                const x2 = centerX + Math.cos(angle) * (radius + amplitude);
                const y2 = centerY + Math.sin(angle) * (radius + amplitude);

                visualizerCtx.beginPath();
                visualizerCtx.moveTo(x1, y1);
                visualizerCtx.lineTo(x2, y2);
                visualizerCtx.strokeStyle = `hsla(${i * 10}, 80%, 60%, 0.8)`;
                visualizerCtx.lineWidth = 2;
                visualizerCtx.stroke();
            }
        } else if (visualizerMode === 'wave') {
            visualizerCtx.beginPath();
            visualizerCtx.moveTo(0, height / 2);
            for (let i = 0; i < bufferLength; i++) {
                const x = (i / bufferLength) * width;
                const y = (height / 2) + Math.sin(i * 0.5 + Date.now() * 0.01) * (dataArray[i] / 255) * 50;
                visualizerCtx.lineTo(x, y);
            }
            visualizerCtx.strokeStyle = '#1ed760';
            visualizerCtx.lineWidth = 3;
            visualizerCtx.stroke();
        }
    }

    function getIconForId(id) {
        let hash = 0;
        for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
        return musicIcons[Math.abs(hash) % musicIcons.length];
    }

    const iconThemes = {
        'fa-music': 'linear-gradient(135deg, #1e1e1e 0%, #1ed760 100%)',
        'fa-headphones': 'linear-gradient(135deg, #1e1e1e 0%, #2e91d6 100%)',
        'fa-guitar': 'linear-gradient(135deg, #1e1e1e 0%, #ff8a00 100%)',
        'fa-drum': 'linear-gradient(135deg, #1e1e1e 0%, #ff4b2b 100%)',
        'fa-microphones': 'linear-gradient(135deg, #1e1e1e 0%, #a8e063 100%)',
        'fa-compact-disc': 'linear-gradient(135deg, #1e1e1e 0%, #8e2de2 100%)',
        'fa-radio': 'linear-gradient(135deg, #1e1e1e 0%, #f7971e 100%)',
        'fa-sliders': 'linear-gradient(135deg, #1e1e1e 0%, #00c6ff 100%)',
        'fa-volume-high': 'linear-gradient(135deg, #1e1e1e 0%, #0072ff 100%)',
        'fa-record-vinyl': 'linear-gradient(135deg, #1e1e1e 0%, #111 100%)',
        'fa-trumpet': 'linear-gradient(135deg, #1e1e1e 0%, #f4c4f3 100%)',
        'fa-saxophone': 'linear-gradient(135deg, #1e1e1e 0%, #fc67fa 100%)',
        'fa-violin': 'linear-gradient(135deg, #1e1e1e 0%, #6a11cb 100%)',
        'fa-piano': 'linear-gradient(135deg, #1e1e1e 0%, #4facfe 100%)',
        'fa-banjo': 'linear-gradient(135deg, #1e1e1e 0%, #00f2fe 100%)',
        'fa-accordion': 'linear-gradient(135deg, #1e1e1e 0%, #76b852 100%)',
        'fa-guitar-electric': 'linear-gradient(135deg, #1e1e1e 0%, #c0392b 100%)',
        'fa-turntable': 'linear-gradient(135deg, #1e1e1e 0%, #2c3e50 100%)'
    };

    function applyDynamicTheme(id) {
        if (id === null || id === undefined) return;
        const icon = getIconForId(id.toString());
        const theme = iconThemes[icon] || 'linear-gradient(135deg, #121212 0%, #1ed760 100%)';

        const target = isRemote ? document.getElementById('remote-control-view') : document.querySelector('.app-container');
        if (target) {
            target.style.background = theme;
            target.style.transition = 'background 1.5s ease-in-out';
        }
    }

    // Sidebar Links
    const navHome = document.getElementById('nav-home');
    const navSearch = document.getElementById('nav-search');
    const navLibrary = document.getElementById('nav-library');
    const navLikedSongs = document.getElementById('nav-liked-songs');
    const navCreatePlaylist = document.getElementById('nav-create-playlist');

    // Modal
    const playlistModal = document.getElementById('playlist-modal');
    const modalPlaylistList = document.getElementById('modal-playlist-list');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    // State
    let allSongs = [];
    let displayedSongs = [];
    let currentSongIndex = -1;
    let isPlaying = false;
    let currentView = 'home';
    let currentPlaylistId = null;
    let isQueueVisible = false;
    let recommendedQueue = [];
    let upcomingQueue = [];
    let isShuffle = false;
    let isMuted = false;
    let prevVolume = 1.0;
    let sleepTimerEnd = null;
    let sleepTimerInterval = null;
    let visualizerMode = 'bars'; // bars, pulse, wave
    let remoteSongs = []; // Cache for remote search

    const shuffleBtn = document.getElementById('shuffle-btn');
    const muteBtn = document.getElementById('mute-btn');

    function updateQueueContext(displayedIdx) {
        upcomingQueue = displayedSongs.slice(displayedIdx + 1).map(s => s.id);
    }

    // Remote Server State (Replaces LocalStorage)
    let likedSongs = [];
    let playlists = {};

    // Fetch User Data from Server First
    fetch('/api/userdata')
        .then(response => response.json())
        .then(userData => {
            likedSongs = userData.likedSongs || [];
            playlists = userData.playlists || {};
            return fetch('/api/songs').then(r => r.json()).then(data => ({ data, userData }));
        })
        .then(({ data, userData }) => {
            if (data.error) {
                songsList.innerHTML = `<div class="loading">Error: ${data.error}. Path: ${data.path}</div>`;
                return;
            }
            allSongs = data.map((song, i) => ({ ...song, id: i.toString() }));
            displayedSongs = [...allSongs];
            renderSidebarPlaylists();
            renderView();

            // Restore session state
            const session = userData.session;
            if (session) {
                // Restore shuffle
                if (session.isShuffle) {
                    isShuffle = true;
                    shuffleBtn.classList.add('active');
                }

                // Restore volume
                if (typeof session.volume === 'number') {
                    globalVolume = session.volume;
                    const clickRatio = globalVolume / 2.0;
                    volume.style.width = `${clickRatio * 100}%`;
                    audio1.volume = Math.min(1.0, globalVolume);
                    audio2.volume = Math.min(1.0, globalVolume);
                    if (globalVolume > 1.0) volume.style.backgroundColor = '#ff4d4d';
                }

                // Restore EQ gains
                if (Array.isArray(session.eqGains)) {
                    session.eqGains.forEach((gain, i) => {
                        if (filters[i]) filters[i].gain.value = gain;
                        // Update slider display if sliders already exist
                        const slider = eqSlidersContainer && eqSlidersContainer.querySelectorAll('input')[i];
                        if (slider) slider.value = gain;
                    });
                }

                // Restore current song (paused, not playing)
                if (session.songId !== null && session.songId !== undefined) {
                    const idx = allSongs.findIndex(s => s.id === session.songId.toString());
                    if (idx !== -1) {
                        currentSongIndex = idx;
                        const song = allSongs[idx];
                        activeAudio.src = song.url;
                        currentTrackName.textContent = song.title;
                        currentTrackName.title = song.title;
                        heartNowPlaying.style.display = 'block';
                        updateNowPlayingHeart();
                        const dynIcon = getIconForId(song.id);
                        const playerArt = document.querySelector('.album-art i');
                        if (playerArt) playerArt.className = `fa-solid ${dynIcon}`;
                        // Seek to saved position when audio is ready
                        activeAudio.addEventListener('loadedmetadata', () => {
                            if (session.position && !isNaN(session.position)) {
                                activeAudio.currentTime = session.position;
                                totalTimeEl.textContent = formatTime(activeAudio.duration);
                            }
                        }, { once: true });
                        updateDocumentTitle();
                        renderSongs();
                    }
                }
            }
        })
        .catch(error => {
            songsList.innerHTML = '<div class="loading">Error connecting to local server or parsing data. Make sure Node server is running.</div>';
        });

    function saveState() {
        // Build session object – position, song, volume, EQ, shuffle
        const sessionSongId = (currentSongIndex !== -1) ? allSongs[currentSongIndex].id : null;
        const sessionPosition = (activeAudio && !isNaN(activeAudio.currentTime)) ? activeAudio.currentTime : 0;
        const sessionVolume = globalVolume;
        const sessionEQ = filters.map(f => f ? f.gain.value : 0);

        fetch('/api/userdata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                likedSongs,
                playlists,
                session: {
                    songId: sessionSongId,
                    position: sessionPosition,
                    volume: sessionVolume,
                    eqGains: sessionEQ,
                    isShuffle
                }
            })
        }).catch(err => console.error('Failed to save persistent state:', err));
    }

    // Remote Sync Logic
    async function initRemoteControl() {
        isRemote = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

        if (isRemote) {
            document.querySelector('.app-container').style.display = 'none';
            document.getElementById('remote-control-view').style.display = 'flex';
            startRemotePolling();
            setupRemoteListeners();
        } else {
            startHostSync();
        }
    }

    function setupRemoteListeners() {
        const remoteNavItems = document.querySelectorAll('.remote-nav-item');
        const remoteViews = {
            'main': document.getElementById('remote-main-view'),
            'library': document.getElementById('remote-library-view'),
            'queue': document.getElementById('remote-queue-view')
        };
        const remoteLibContent = document.getElementById('remote-library-content');
        const remoteLibSearch = document.getElementById('remote-library-search');

        function switchRemoteView(viewId) {
            Object.keys(remoteViews).forEach(key => {
                if (remoteViews[key]) remoteViews[key].style.display = (key === viewId) ? 'flex' : 'none';
            });
            remoteNavItems.forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-view') === viewId);
            });

            if (viewId === 'library') {
                if (remoteSongs.length === 0) {
                    fetch('/api/songs').then(r => r.json()).then(data => {
                        remoteSongs = data;
                        renderRemoteLibrary(remoteSongs);
                    });
                } else {
                    renderRemoteLibrary(remoteSongs);
                }
            }
        }

        function renderRemoteLibrary(songs) {
            if (!remoteLibContent) return;
            let html = '';
            songs.forEach(song => {
                html += `
                    <div class="remote-queue-item" data-id="${song.id}">
                        <div class="remote-queue-img"><i class="fa-solid ${getIconForId(song.id.toString())}"></i></div>
                        <div class="remote-queue-info">
                            <div class="remote-queue-title">${song.title}</div>
                            <div class="remote-queue-artist">${song.artist}</div>
                        </div>
                    </div>
                `;
            });
            remoteLibContent.innerHTML = html;
            remoteLibContent.querySelectorAll('.remote-queue-item').forEach(item => {
                item.onclick = () => {
                    sendRemoteCommand({ command: 'PLAY_QUEUE_ID', id: item.getAttribute('data-id') });
                    switchRemoteView('main');
                };
            });
        }

        remoteNavItems.forEach(item => {
            item.onclick = () => switchRemoteView(item.getAttribute('data-view'));
        });

        if (remoteLibSearch) {
            remoteLibSearch.oninput = (e) => {
                const query = e.target.value.toLowerCase();
                const filtered = remoteSongs.filter(s =>
                    s.title.toLowerCase().includes(query) ||
                    s.artist.toLowerCase().includes(query)
                );
                renderRemoteLibrary(filtered);
            };
        }

        // Remote Sleep Dropdown Listeners
        const remoteSleepItems = document.querySelectorAll('#remote-sleep-dropdown div');
        remoteSleepItems.forEach(item => {
            item.onclick = () => {
                const val = parseInt(item.innerText) || 0;
                sendRemoteCommand({ command: 'SLEEP', value: val });
            };
        });

        // Remote Visualizer Overlay
        const remoteVizOverlay = document.querySelector('.remote-visualizer-overlay');
        if (remoteVizOverlay) {
            remoteVizOverlay.querySelectorAll('button').forEach(btn => {
                btn.onclick = () => {
                    const mode = btn.getAttribute('data-mode');
                    sendRemoteCommand({ command: 'VISUALIZER', value: mode });
                };
            });
        }

        document.getElementById('remote-play-pause').onclick = () => sendRemoteCommand({ command: 'TOGGLE' });
        document.getElementById('remote-next').onclick = () => sendRemoteCommand({ command: 'NEXT' });
        document.getElementById('remote-prev').onclick = () => sendRemoteCommand({ command: 'PREV' });
        document.getElementById('remote-shuffle').onclick = () => sendRemoteCommand({ command: 'SHUFFLE' });
        document.getElementById('remote-repeat').onclick = () => sendRemoteCommand({ command: 'REPEAT' });
        document.getElementById('remote-mute').onclick = () => sendRemoteCommand({ command: 'MUTE' });
        document.getElementById('remote-sleep-toggle').onclick = () => {
            const dropdown = document.getElementById('remote-sleep-dropdown');
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        };
        document.getElementById('remote-like').onclick = () => {
            const sid = document.getElementById('remote-track-name').getAttribute('data-id');
            if (sid) {
                toggleLike(sid);
                sendRemoteCommand({ command: 'SYNC_USERDATA' });
            }
        };

        const remoteProgressBar = document.getElementById('remote-progress-bar');
        remoteProgressBar.onclick = (e) => {
            const rect = remoteProgressBar.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            const total = parseInt(remoteProgressBar.getAttribute('data-duration') || 0);
            if (total > 0) {
                sendRemoteCommand({ command: 'SEEK', value: pos * total });
            }
        };

        const remoteVolumeBar = document.getElementById('remote-volume-bar');
        remoteVolumeBar.onclick = (e) => {
            const rect = remoteVolumeBar.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            sendRemoteCommand({ command: 'VOLUME', value: pos * 2.0 });
        };
    }

    async function sendRemoteCommand(cmdObj) {
        await fetch('/api/sync/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cmdObj)
        });
    }

    function startRemotePolling() {
        setInterval(async () => {
            try {
                const res = await fetch('/api/sync/state');
                const state = await res.json();
                state.upcomingQueue = state.upcomingQueue || [];
                state.recommendedQueue = state.recommendedQueue || [];
                updateRemoteUI(state);
            } catch (e) {
                console.error("Remote Sync Failed", e);
            }
        }, 1000);
    }

    function updateRemoteUI(state) {
        if (!state.songId) return;

        const trackName = document.getElementById('remote-track-name');
        const artistName = document.getElementById('remote-artist-name');
        const playBtn = document.getElementById('remote-play-pause');
        const shuffleBtn = document.getElementById('remote-shuffle');
        const muteBtnRemote = document.getElementById('remote-mute');
        const likeBtn = document.getElementById('remote-like');
        const progressFill = document.getElementById('remote-progress-fill');
        const volumeFill = document.getElementById('remote-volume-fill');
        const currentTimeEl = document.getElementById('remote-current-time');
        const totalTimeEl = document.getElementById('remote-total-time');
        const progressBar = document.getElementById('remote-progress-bar');

        trackName.innerText = state.title || "Playing...";
        trackName.setAttribute('data-id', state.songId);
        artistName.innerText = state.artist || "Local PC";

        playBtn.innerHTML = state.isPlaying ? '<i class="fa-solid fa-circle-pause"></i>' : '<i class="fa-solid fa-circle-play"></i>';

        shuffleBtn.classList.toggle('active', !!state.isShuffle);

        // Update Mute Status
        muteBtnRemote.classList.toggle('muted', !!state.isMuted);
        muteBtnRemote.innerHTML = state.isMuted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-low"></i>';

        // Update Liked Status
        const isLiked = likedSongs.includes(state.songId.toString());
        likeBtn.classList.toggle('liked', isLiked);
        likeBtn.innerHTML = isLiked ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';

        // Update Progress
        if (state.duration) {
            const percent = (state.position / state.duration) * 100;
            progressFill.style.width = `${percent}%`;
            currentTimeEl.textContent = formatTime(state.position);
            totalTimeEl.textContent = formatTime(state.duration);
            progressBar.setAttribute('data-duration', state.duration);
        }

        // Update Volume (Host volume is 0.0 - 2.0, Bar should show 0-100% of that range)
        const volPercent = (state.volume / 2.0) * 100;
        volumeFill.style.width = `${volPercent}%`;
        if (state.volume > 1.0) volumeFill.style.backgroundColor = '#ff4d4d';
        else volumeFill.style.backgroundColor = '#1ed760';

        // Update Art Placeholder
        const dynIcon = getIconForId(state.songId.toString());
        const remoteArtI = document.querySelector('.remote-art i');
        if (remoteArtI) remoteArtI.className = `fa-solid ${dynIcon}`;

        // Update Sleep Timer
        const remoteSleepBtn = document.getElementById('remote-sleep-toggle');
        const remoteSleepCountdown = document.getElementById('remote-sleep-countdown');
        if (state.sleepTimerLeft !== null) {
            remoteSleepBtn.classList.add('active');
            const mins = Math.floor(state.sleepTimerLeft / 60);
            const secs = state.sleepTimerLeft % 60;
            remoteSleepCountdown.innerText = `${mins}:${secs.toString().padStart(2, '0')}`;
        } else {
            remoteSleepBtn.classList.remove('active');
            remoteSleepCountdown.innerText = '';
        }

        applyDynamicTheme(state.songId);

        // Render Remote Queue
        renderRemoteQueue(state);
    }

    function renderRemoteQueue(state) {
        const queueContent = document.getElementById('remote-queue-content');
        if (!queueContent || !state.upcomingQueue) return;

        let html = '';
        if (state.upcomingQueue.length > 0) {
            html += '<div class="remote-queue-section-title">Next Up</div>';
            state.upcomingQueue.forEach((song, idx) => {
                html += `
                    <div class="remote-queue-item" data-id="${song.id}">
                        <div class="remote-queue-img"><i class="fa-solid ${getIconForId(song.id.toString())}"></i></div>
                        <div class="remote-queue-info">
                            <div class="remote-queue-title">${song.title}</div>
                            <div class="remote-queue-artist">${song.artist}</div>
                        </div>
                    </div>
                `;
            });
        } else {
            html += '<div style="color: #b3b3b3; text-align: center; margin-top: 40px; font-size: 14px;">The queue is currently empty.</div>';
        }

        if (state.recommendedQueue && state.recommendedQueue.length > 0) {
            html += '<div class="remote-queue-section-title">Recommended</div>';
            state.recommendedQueue.forEach(song => {
                html += `
                    <div class="remote-queue-item" data-id="${song.id}">
                        <div class="remote-queue-img"><i class="fa-solid ${getIconForId(song.id.toString())}"></i></div>
                        <div class="remote-queue-info">
                            <div class="remote-queue-title">${song.title}</div>
                            <div class="remote-queue-artist">${song.artist}</div>
                        </div>
                    </div>
                `;
            });
        }

        queueContent.innerHTML = html;

        // Attach listeners via delegation or directly
        const items = queueContent.querySelectorAll('.remote-queue-item');
        items.forEach(item => {
            item.onclick = () => {
                const id = item.getAttribute('data-id');
                sendRemoteCommand({ command: 'PLAY_QUEUE_ID', id: id });
            };
        });
    }

    function startHostSync() {
        // Host pushes state and consumes commands
        setInterval(async () => {
            const currentSong = allSongs[currentSongIndex];

            // Push State
            fetch('/api/sync/state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    songId: currentSong ? currentSong.id : null,
                    title: currentSong ? currentSong.title : "No track",
                    artist: currentSong ? currentSong.artist : "Local host",
                    position: activeAudio.currentTime,
                    duration: activeAudio.duration,
                    isPlaying: isPlaying,
                    isShuffle: isShuffle,
                    isMuted: isMuted,
                    volume: globalVolume,
                    upcomingQueue: upcomingQueue.map(id => {
                        const s = allSongs.find(x => String(x.id) === String(id));
                        return s ? { id: s.id, title: s.title, artist: s.artist } : { id: id, title: "Track " + id, artist: "Unknown" };
                    }),
                    recommendedQueue: recommendedQueue.map(s => ({ id: s.id, title: s.title, artist: s.artist })),
                    sleepTimerLeft: sleepTimerEnd ? Math.max(0, Math.floor((sleepTimerEnd - Date.now()) / 1000)) : null
                })
            }).catch(() => { });

            // Pull Commands
            try {
                const cmdRes = await fetch('/api/sync/command');
                const cmdData = await cmdRes.json();
                const { command, value } = cmdData;

                if (command) {
                    if (command === 'TOGGLE') togglePlayPause();
                    if (command === 'NEXT') playNextCrossfade(1000);
                    if (command === 'PREV') prevBtn.click();
                    if (command === 'MUTE') toggleMute();
                    if (command === 'SHUFFLE') {
                        isShuffle = !isShuffle;
                        shuffleBtn.classList.toggle('active', isShuffle);
                    }
                    if (command === 'REPEAT') {
                        // Optional repeat toggle logic
                        const repeatBtn = document.getElementById('repeat-btn');
                        if (repeatBtn) repeatBtn.click();
                    }
                    if (command === 'SEEK' && typeof value === 'number') {
                        activeAudio.currentTime = value;
                    }
                    if (command === 'VOLUME' && typeof value === 'number') {
                        setGlobalVolume(value);
                    }
                    if (command === 'PLAY_QUEUE_ID') {
                        const targetId = cmdData.id;
                        const idx = allSongs.findIndex(s => String(s.id) === String(targetId));
                        if (idx !== -1) {
                            playSong(idx, 1000);
                        } else {
                            console.warn("Remote tried to play unknown song ID:", targetId);
                        }
                    }
                    if (command === 'SYNC_USERDATA') {
                        // Reload userdata
                        fetch('/api/userdata')
                            .then(r => r.json())
                            .then(data => {
                                likedSongs = data.likedSongs || [];
                                playlists = data.playlists || {};
                                renderView();
                                renderSidebarPlaylists();
                                updateNowPlayingHeart();
                            });
                    }
                    if (command === 'VISUALIZER') {
                        visualizerMode = value;
                    }
                    if (command === 'SLEEP') {
                        setSleepTimer(value);
                    }
                }
            } catch (e) { }
        }, 1000);
    }

    function setSleepTimer(minutes) {
        if (sleepTimerInterval) clearInterval(sleepTimerInterval);
        const hostBtn = document.getElementById('sleep-timer-btn');
        const hostCountdown = document.getElementById('sleep-timer-countdown');

        if (minutes === 0) {
            sleepTimerEnd = null;
            if (hostBtn) hostBtn.classList.remove('active');
            if (hostCountdown) hostCountdown.innerText = '';
            document.getElementById('remote-sleep-dropdown').style.display = 'none';
            return;
        }

        sleepTimerEnd = Date.now() + minutes * 60000;
        if (hostBtn) hostBtn.classList.add('active');
        document.getElementById('remote-sleep-dropdown').style.display = 'none';

        sleepTimerInterval = setInterval(() => {
            const left = Math.max(0, Math.floor((sleepTimerEnd - Date.now()) / 1000));
            if (hostCountdown) {
                const minsLeft = Math.floor(left / 60);
                const secsLeft = left % 60;
                hostCountdown.innerText = ` ${minsLeft}:${secsLeft.toString().padStart(2, '0')}`;
            }

            if (left <= 30 && left > 0) {
                // Fade out volume in last 30 seconds
                const fadeRatio = left / 30;
                setGlobalVolume(prevVolume * fadeRatio, true);
            }

            if (left <= 0) {
                clearInterval(sleepTimerInterval);
                activeAudio.pause();
                isPlaying = false;
                updatePlayPauseIcons();
                setSleepTimer(0);
            }
        }, 1000);
    }

    // Initialize library
    initRemoteControl();

    // Host Sleep Dropdown Listeners
    const sleepTimerDropdown = document.getElementById('sleep-timer-dropdown');
    if (sleepTimerDropdown) {
        const sleepItems = sleepTimerDropdown.querySelectorAll('div');
        sleepItems.forEach(item => {
            item.onclick = () => {
                const val = parseInt(item.innerText) || 0;
                setSleepTimer(val);
            };
        });
    }

    // Navigation and Rendering
    function updateActiveNav(activeElement) {
        [navHome, navSearch, navLibrary, navLikedSongs].forEach(el => el.classList.remove('active'));
        const dynamicPlaylists = document.querySelectorAll('.custom-playlist-link');
        dynamicPlaylists.forEach(el => el.classList.remove('active'));

        if (activeElement) {
            activeElement.classList.add('active');
        }
    }

    function renderView() {
        searchContainer.style.display = currentView === 'search' ? 'flex' : 'none';

        if (currentView === 'home' || currentView === 'library') {
            heroTitle.textContent = currentView === 'home' ? 'Good Evening' : 'Your Library';
            heroDesc.textContent = 'Pick up where you left off offline.';
            displayedSongs = [...allSongs];
            updateActiveNav(currentView === 'home' ? navHome : navLibrary);
        } else if (currentView === 'search') {
            heroTitle.textContent = 'Browse all';
            heroDesc.textContent = 'Find your favorite local tracks.';
            const query = searchInput.value.toLowerCase();
            displayedSongs = query ? allSongs.filter(s => s.title.toLowerCase().includes(query)) : allSongs;
            updateActiveNav(navSearch);
        } else if (currentView === 'liked') {
            heroTitle.textContent = 'Liked Songs';
            heroDesc.textContent = `<i class="fa-solid fa-thumbtack" style="color:#1ed760;"></i> Playlist • ${likedSongs.length} songs`;
            displayedSongs = allSongs.filter(s => likedSongs.includes(s.id));
            updateActiveNav(navLikedSongs);
        } else if (currentView === 'playlist') {
            const plist = playlists[currentPlaylistId] || [];
            heroTitle.textContent = currentPlaylistId;
            heroDesc.textContent = `Custom Playlist • ${plist.length} songs`;
            displayedSongs = allSongs.filter(s => plist.includes(s.id));
        }

        renderSongs();
    }

    function renderSongs() {
        if (displayedSongs.length === 0) {
            songsList.innerHTML = '<div class="loading">No songs found.</div>';
            return;
        }

        songsList.innerHTML = '';
        displayedSongs.forEach((song, idx) => {
            const isLiked = likedSongs.includes(song.id);
            const isRowPlaying = currentSongIndex !== -1 && allSongs[currentSongIndex].id === song.id;

            const row = document.createElement('div');
            row.className = `song-row ${isRowPlaying ? 'active' : ''}`;

            const originalIndex = allSongs.findIndex(s => s.id === song.id);

            row.innerHTML = `
                <div class="row-index">
                    <span>${idx + 1}</span>
                    <i class="fa-solid fa-play row-play-icon"></i>
                </div>
                <div class="row-info">
                    <div class="row-img"><i class="fa-solid ${getIconForId(song.id)}"></i></div>
                    <div class="row-text">
                        <span class="row-title" title="${song.title}">${song.title}</span>
                        <span class="row-artist">Local Audio</span>
                    </div>
                </div>
                <div class="row-album">Local Directory</div>
                <div class="row-actions">
                    <button class="row-heart-btn ${isLiked ? 'liked' : ''}" data-id="${song.id}" title="Save to your Liked Songs">
                        <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                    </button>
                    <div class="row-time"><i class="fa-solid fa-ellipsis row-add-btn" style="cursor:pointer;" title="Add to playlist"></i></div>
                </div>
            `;

            row.addEventListener('click', () => {
                updateQueueContext(idx);
                playSong(originalIndex, 1000);
            });

            row.querySelector('.row-heart-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleLike(song.id, row.querySelector('.row-heart-btn'));
            });

            row.querySelector('.row-add-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                openPlaylistModal(song.id);
            });

            songsList.appendChild(row);
        });
    }

    function renderSidebarPlaylists() {
        customPlaylistsList.innerHTML = '';
        Object.keys(playlists).forEach(name => {
            const a = document.createElement('a');
            a.href = '#';
            a.className = 'library-item';
            a.innerHTML = `
                <div class="playlist-icon"><i class="fa-solid fa-music"></i></div>
                <div class="library-item-info">
                    <span class="library-item-title">${name}</span>
                    <span class="library-item-subtitle">Playlist • You</span>
                </div>
            `;
            if (currentView === 'playlist' && currentPlaylistId === name) {
                a.classList.add('active');
            }
            a.addEventListener('click', (e) => {
                e.preventDefault();
                currentView = 'playlist';
                currentPlaylistId = name;
                renderView();
                updateActiveNav(); // Reset others
                a.classList.add('active');
            });
            customPlaylistsList.appendChild(a);
        });
    }

    function toggleLike(songId, btnEl = null) {
        if (likedSongs.includes(songId)) {
            likedSongs = likedSongs.filter(id => id !== songId);
            if (btnEl) {
                btnEl.classList.remove('liked');
                btnEl.innerHTML = '<i class="fa-regular fa-heart"></i>';
            }
        } else {
            likedSongs.push(songId);
            if (btnEl) {
                btnEl.classList.add('liked');
                btnEl.innerHTML = '<i class="fa-solid fa-heart"></i>';
            }
        }

        if (currentSongIndex !== -1 && allSongs[currentSongIndex].id === songId) {
            updateNowPlayingHeart();
        }

        if (!isRemote) saveState();
        if (currentView === 'liked') renderView();
    }

    // Sidebar Events
    navHome.addEventListener('click', (e) => { e.preventDefault(); currentView = 'home'; renderView(); });
    navSearch.addEventListener('click', (e) => { e.preventDefault(); currentView = 'search'; renderView(); searchInput.focus(); });
    navLibrary.addEventListener('click', (e) => { e.preventDefault(); currentView = 'library'; renderView(); });
    navLikedSongs.addEventListener('click', (e) => { e.preventDefault(); currentView = 'liked'; renderView(); });

    searchInput.addEventListener('input', () => {
        if (currentView === 'search') renderView();
    });

    searchInput.addEventListener('focus', () => searchContainer.classList.add('focus'));
    searchInput.addEventListener('blur', () => searchContainer.classList.remove('focus'));

    // Create Playlist Modal Elements
    const createPlaylistModal = document.getElementById('create-playlist-modal');
    const newPlaylistInput = document.getElementById('new-playlist-input');
    const createPlaylistSaveBtn = document.getElementById('create-playlist-save');
    const createPlaylistCancelBtn = document.getElementById('create-playlist-cancel');

    navCreatePlaylist.addEventListener('click', (e) => {
        e.preventDefault();
        newPlaylistInput.value = '';
        createPlaylistModal.style.display = 'flex';
        newPlaylistInput.focus();
    });

    createPlaylistCancelBtn.addEventListener('click', () => {
        createPlaylistModal.style.display = 'none';
    });

    createPlaylistSaveBtn.addEventListener('click', () => {
        const name = newPlaylistInput.value.trim();
        if (name) {
            if (!playlists[name]) {
                playlists[name] = [];
                if (!isRemote) saveState();
                renderSidebarPlaylists();
                createPlaylistModal.style.display = 'none';
            } else {
                alert('Playlist already exists!');
            }
        }
    });

    createPlaylistModal.addEventListener('click', (e) => {
        if (e.target === createPlaylistModal) createPlaylistModal.style.display = 'none';
    });

    // Playlist Modal Logic
    function openPlaylistModal(songId) {
        let songToAddToPlaylist = songId;
        modalPlaylistList.innerHTML = '';

        const names = Object.keys(playlists);
        if (names.length === 0) {
            modalPlaylistList.innerHTML = '<p class="loading">No playlists. Create one first!</p>';
        } else {
            names.forEach(name => {
                const btn = document.createElement('button');
                btn.className = 'modal-playlist-btn';
                btn.textContent = name;
                btn.addEventListener('click', () => {
                    if (!playlists[name].includes(songId)) {
                        playlists[name].push(songId);
                        if (!isRemote) saveState();
                        alert(`Added to ${name}`);
                    }
                    playlistModal.style.display = 'none';
                    if (currentView === 'playlist' && currentPlaylistId === name) renderView();
                });
                modalPlaylistList.appendChild(btn);
            });
        }

        playlistModal.style.display = 'flex';
    }

    modalCloseBtn.addEventListener('click', () => { playlistModal.style.display = 'none'; });
    playlistModal.addEventListener('click', (e) => { if (e.target === playlistModal) playlistModal.style.display = 'none'; });

    // Hero Play Button
    heroPlayBtn.addEventListener('click', () => {
        if (displayedSongs.length > 0) {
            updateQueueContext(0);
            const firstId = displayedSongs[0].id;
            const originalIndex = allSongs.findIndex(s => s.id === firstId);
            playSong(originalIndex, 1000);
        }
    });

    // Queue & Recommendation Logic
    function generateRecommendations() {
        recommendedQueue = [];
        const pool = allSongs.filter(s => currentSongIndex === -1 || s.id !== allSongs[currentSongIndex].id);
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        recommendedQueue = pool.slice(0, 15);
    }

    function renderQueue() {
        if (!isQueueVisible) return;

        if (currentSongIndex === -1) {
            queueContent.innerHTML = '<div class="loading">No song playing.</div>';
            return;
        }

        const currentSong = allSongs[currentSongIndex];
        let html = `
            <div class="queue-section-title">Now Playing</div>
            <div class="queue-item active">
                <div class="queue-item-img"><i class="fa-solid ${getIconForId(currentSong.id)}"></i></div>
                <div class="queue-item-info">
                    <div class="queue-item-title">${currentSong.title}</div>
                    <div class="queue-item-artist">Local Audio</div>
                </div>
                <i class="fa-solid fa-volume-high" style="color: var(--accent-color); font-size: 12px;"></i>
            </div>
        `;

        if (upcomingQueue.length > 0) {
            html += `<div class="queue-section-title">Next Up</div><div id="next-up-container">`;
            upcomingQueue.slice(0, 15).forEach((songId, index) => {
                const song = allSongs.find(s => s.id === songId);
                if (!song) return;
                html += `
                    <div class="queue-item draggable" draggable="true" data-index="${index}" data-id="${song.id}">
                        <div class="drag-handle"><i class="fa-solid fa-grip-lines"></i></div>
                        <div class="queue-item-img"><i class="fa-solid ${getIconForId(song.id)}"></i></div>
                        <div class="queue-item-info">
                            <div class="queue-item-title">${song.title}</div>
                            <div class="queue-item-artist">Local Audio</div>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        if (recommendedQueue.length === 0) generateRecommendations();

        html += `<div class="queue-section-title">Autoplay Recommendations</div>`;
        recommendedQueue.forEach(song => {
            html += `
                <div class="queue-item" data-id="${song.id}">
                    <div class="queue-item-img"><i class="fa-solid ${getIconForId(song.id)}"></i></div>
                    <div class="queue-item-info">
                        <div class="queue-item-title">${song.title}</div>
                        <div class="queue-item-artist">Local Audio</div>
                    </div>
                </div>
            `;
        });

        queueContent.innerHTML = html;

        // Drag and Drop Logic
        const nextUpContainer = document.getElementById('next-up-container');
        if (nextUpContainer) {
            let draggedItem = null;

            const items = nextUpContainer.querySelectorAll('.queue-item.draggable');
            items.forEach(item => {
                item.addEventListener('dragstart', (e) => {
                    draggedItem = item;
                    setTimeout(() => item.classList.add('dragging'), 0);
                    e.dataTransfer.effectAllowed = 'move';
                });

                item.addEventListener('dragend', () => {
                    if (draggedItem) draggedItem.classList.remove('dragging');
                    draggedItem = null;
                });

                item.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    if (!draggedItem) return;
                    const hoverItem = e.target.closest('.queue-item.draggable');
                    if (hoverItem && hoverItem !== draggedItem) {
                        const hoverRect = hoverItem.getBoundingClientRect();
                        const hoverMiddle = hoverRect.top + hoverRect.height / 2;
                        if (e.clientY < hoverMiddle) {
                            nextUpContainer.insertBefore(draggedItem, hoverItem);
                        } else {
                            nextUpContainer.insertBefore(draggedItem, hoverItem.nextSibling);
                        }
                    }
                });

                item.addEventListener('drop', (e) => {
                    e.preventDefault();
                    if (!draggedItem) return;
                    const newIndices = Array.from(nextUpContainer.children).map(el => parseInt(el.getAttribute('data-index')));
                    const sliceSize = Math.min(15, upcomingQueue.length);
                    const oldUpcoming = [...upcomingQueue];
                    const slicedItems = newIndices.map(oldIdx => oldUpcoming[oldIdx]);
                    const tail = oldUpcoming.slice(sliceSize);

                    upcomingQueue = [...slicedItems, ...tail];
                    renderQueue();
                });
            });
        }

        queueContent.querySelectorAll('.queue-item').forEach(el => {
            const handle = el.querySelector('.drag-handle');
            if (handle) handle.addEventListener('click', (e) => e.stopPropagation());

            if (el.classList.contains('active')) return;
            el.addEventListener('click', () => {
                const sid = el.getAttribute('data-id');
                const origIdx = allSongs.findIndex(s => s.id === sid);

                const upIdx = upcomingQueue.indexOf(sid);
                if (upIdx !== -1) {
                    upcomingQueue.splice(0, upIdx + 1);
                } else if (recommendedQueue.find(r => r.id === sid)) {
                    recommendedQueue = recommendedQueue.filter(r => r.id !== sid);
                }
                if (origIdx !== -1) playSong(origIdx, 1000);
            });
        });
    }

    queueToggleBtn.addEventListener('click', () => {
        isQueueVisible = !isQueueVisible;
        if (isQueueVisible) {
            queuePanel.style.display = 'flex';
            queueToggleBtn.classList.add('active');
            renderQueue();
        } else {
            queuePanel.style.display = 'none';
            queueToggleBtn.classList.remove('active');
        }
    });

    closeQueueBtn.addEventListener('click', () => {
        isQueueVisible = false;
        queuePanel.style.display = 'none';
        queueToggleBtn.classList.remove('active');
    });

    // Media Player Logic
    function startCrossfade(fadeOutAudio, fadeInAudio, durationMs) {
        crossfadingAudio = fadeOutAudio;
        activeAudio = fadeInAudio;

        fadeInAudio.volume = 0;
        let fadeOutVol = globalVolume;
        let fadeInVol = 0;

        const steps = 50;
        const stepTime = durationMs / steps;
        const volStep = globalVolume / steps;

        if (fadeInterval) clearInterval(fadeInterval);

        fadeInterval = setInterval(() => {
            if (!isPlaying) return; // Pause crossfader if playback is paused

            fadeOutVol = Math.max(0, fadeOutVol - volStep);
            fadeInVol = Math.min(globalVolume, fadeInVol + volStep);

            fadeOutAudio.volume = fadeOutVol;
            fadeInAudio.volume = fadeInVol;

            if (fadeOutVol <= 0) {
                clearInterval(fadeInterval);
                fadeOutAudio.pause();
                fadeOutAudio.volume = globalVolume;
                crossfadingAudio = null;
            }
        }, stepTime);
    }

    function playSong(index, fadeDurationMs = 0) {
        if (index < 0 || index >= allSongs.length) return;

        currentSongIndex = index;
        const song = allSongs[currentSongIndex];

        const nextAudio = activeAudio === audio1 ? audio2 : audio1;

        nextAudio.src = song.url;
        currentTrackName.textContent = song.title;
        currentTrackName.title = song.title;

        // Update hero and bottom album art
        const dynIcon = getIconForId(song.id);
        const playerArt = document.querySelector('.album-art i');
        if (playerArt) playerArt.className = `fa-solid ${dynIcon}`;

        heartNowPlaying.style.display = 'block';
        updateNowPlayingHeart();

        nextAudio.play().then(() => {
            isPlaying = true;
            updatePlayPauseIcon();
            updateDocumentTitle();
            renderQueue();
            renderSongs();
            if (!isRemote) saveState(); // Autosave newly started song

            initVisualizer();
            if (heroMainIcon) heroMainIcon.style.display = 'none';
            if (visualizerCanvas) visualizerCanvas.style.display = 'block';

            applyDynamicTheme(song.id);

            if (fadeDurationMs > 0 && !activeAudio.paused && activeAudio.src && activeAudio !== nextAudio) {
                startCrossfade(activeAudio, nextAudio, fadeDurationMs);
            } else {
                if (crossfadingAudio) {
                    clearInterval(fadeInterval);
                    crossfadingAudio.pause();
                    crossfadingAudio.volume = globalVolume;
                    crossfadingAudio = null;
                }
                activeAudio.pause();
                nextAudio.volume = globalVolume;
                activeAudio = nextAudio;
            }
        }).catch(err => {
            console.error(err);
        });
    }

    function togglePlayPause() {
        if (currentSongIndex === -1 && displayedSongs.length > 0) {
            const firstSongOriginalIndex = allSongs.findIndex(s => s.id === displayedSongs[0].id);
            playSong(firstSongOriginalIndex, 1000);
            return;
        }

        if (activeAudio.paused) {
            activeAudio.play();
            if (crossfadingAudio) crossfadingAudio.play();
            isPlaying = true;
        } else {
            activeAudio.pause();
            if (crossfadingAudio) crossfadingAudio.pause();
            isPlaying = false;
        }
        updatePlayPauseIcon();
    }

    function updatePlayPauseIcon() {
        if (isPlaying) {
            playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        } else {
            playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
    }

    function updateDocumentTitle() {
        if (currentSongIndex !== -1) {
            document.title = `${allSongs[currentSongIndex].title} - Offline Player`;
        }
    }

    function updateNowPlayingHeart() {
        if (currentSongIndex === -1) return;
        const songId = allSongs[currentSongIndex].id;
        const isLiked = likedSongs.includes(songId);
        heartNowPlaying.classList.toggle('liked', isLiked);
        heartNowPlaying.innerHTML = isLiked ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
    }

    heartNowPlaying.addEventListener('click', () => {
        if (currentSongIndex !== -1) {
            toggleLike(allSongs[currentSongIndex].id);
        }
    });

    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    playPauseBtn.addEventListener('click', togglePlayPause);

    function playNextCrossfade(fadeMs = 7000) {
        if (isShuffle && allSongs.length > 0) {
            // Pick a random song that isn't the current one
            const pool = allSongs.filter((_, i) => i !== currentSongIndex);
            const pick = pool[Math.floor(Math.random() * pool.length)];
            const idx = allSongs.findIndex(s => s.id === pick.id);
            playSong(idx, fadeMs);
        } else if (upcomingQueue.length > 0) {
            const nextId = upcomingQueue.shift();
            const originalIndex = allSongs.findIndex(s => s.id === nextId);
            if (originalIndex !== -1) playSong(originalIndex, fadeMs);
        } else {
            if (recommendedQueue.length === 0) generateRecommendations();
            if (recommendedQueue.length > 0) {
                const recSong = recommendedQueue.shift();
                const newOriginalIndex = allSongs.findIndex(s => s.id === recSong.id);
                playSong(newOriginalIndex, fadeMs);
            }
        }
    }

    prevBtn.addEventListener('click', () => {
        if (currentSongIndex === -1) return;
        const currentId = allSongs[currentSongIndex].id;
        let displayedIdx = displayedSongs.findIndex(s => s.id === currentId);

        if (displayedIdx > 0) {
            displayedIdx--;
        } else {
            displayedIdx = displayedSongs.length - 1;
        }

        updateQueueContext(displayedIdx);
        const newOriginalIndex = allSongs.findIndex(s => s.id === displayedSongs[displayedIdx].id);
        playSong(newOriginalIndex, 1000);
    });

    nextBtn.addEventListener('click', () => {
        playNextCrossfade(1000);
    });

    // Shuffle Button
    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', () => {
            isShuffle = !isShuffle;
            shuffleBtn.classList.toggle('active', isShuffle);
            if (isShuffle) {
                // Shuffle the upcoming queue
                for (let i = upcomingQueue.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [upcomingQueue[i], upcomingQueue[j]] = [upcomingQueue[j], upcomingQueue[i]];
                }
            }
            if (!isRemote) saveState();
        });
    }

    [audio1, audio2].forEach(a => {
        a.addEventListener('timeupdate', () => {
            if (a !== activeAudio) return;

            // Trigger natural crossfade near the end (7 seconds left)
            if (a.duration && a.currentTime >= a.duration - 7 && !crossfadingAudio) {
                playNextCrossfade(7000);
            }

            const percent = (a.currentTime / a.duration) * 100;
            progress.style.width = `${percent}%`;
            currentTimeEl.textContent = formatTime(a.currentTime);
        });

        a.addEventListener('loadedmetadata', () => {
            if (a === activeAudio) {
                totalTimeEl.textContent = formatTime(a.duration);
            }
        });

        a.addEventListener('ended', () => {
            if (a === activeAudio && !crossfadingAudio) {
                nextBtn.click();
            }
        });
    });

    progressBar.addEventListener('click', (e) => {
        if (!activeAudio.duration) return;
        const rect = progressBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        activeAudio.currentTime = pos * activeAudio.duration;
        if (!isRemote) saveState(); // Autosave seek position
    });

    function setGlobalVolume(val, fromMute = false) {
        if (!fromMute && isMuted && val > 0) {
            isMuted = false;
            if (muteBtn) muteBtn.classList.remove('muted');
        }

        globalVolume = Math.max(0, Math.min(2.0, val));

        let audioVol = isMuted ? 0 : Math.min(1.0, globalVolume);
        let boostVol = isMuted ? 1.0 : Math.max(1.0, globalVolume);

        if (!crossfadingAudio) {
            activeAudio.volume = audioVol;
        }
        if (masterGain) {
            masterGain.gain.value = boostVol;
        }

        // Update UI
        const clickRatio = globalVolume / 2.0;
        volume.style.width = `${clickRatio * 100}%`;
        if (globalVolume > 1.0) {
            volume.style.backgroundColor = '#ff4d4d';
        } else {
            volume.style.backgroundColor = '#fff';
        }

        if (!isRemote) saveState(); // Autosave volume
    }

    function toggleMute() {
        isMuted = !isMuted;
        if (isMuted) {
            prevVolume = globalVolume;
            setGlobalVolume(0, true);
            if (muteBtn) {
                muteBtn.classList.add('muted');
                muteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
            }
        } else {
            setGlobalVolume(prevVolume || 1.0, true);
            if (muteBtn) {
                muteBtn.classList.remove('muted');
                muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
            }
        }
    }

    if (muteBtn) {
        muteBtn.addEventListener('click', toggleMute);
    }

    volumeBar.addEventListener('click', (e) => {
        const rect = volumeBar.getBoundingClientRect();
        const clickRatio = (e.clientX - rect.left) / rect.width;
        setGlobalVolume(clickRatio * 2.0);
    });

    volume.style.width = `50%`; // Visually 50% = 1.0 actual volume
    audio1.volume = 1;
    audio2.volume = 1;

    // Equalizer UI Logic
    const eqToggleBtn = document.getElementById('eq-toggle-btn');
    const eqPanel = document.getElementById('eq-panel');
    const closeEqBtn = document.getElementById('close-eq-btn');
    const eqSlidersContainer = document.getElementById('eq-sliders');
    const eqLabelsContainer = document.getElementById('eq-labels');

    if (eqToggleBtn) {
        eqToggleBtn.addEventListener('click', () => {
            initVisualizer();
            eqPanel.style.display = eqPanel.style.display === 'none' ? 'block' : 'none';
        });
        closeEqBtn.addEventListener('click', () => eqPanel.style.display = 'none');

        eqBands.forEach((freq, index) => {
            const sliderWrapper = document.createElement('div');
            sliderWrapper.style.display = 'flex';
            sliderWrapper.style.flexDirection = 'column';
            sliderWrapper.style.alignItems = 'center';
            sliderWrapper.style.height = '100%';

            const valueDisplay = document.createElement('span');
            valueDisplay.style.fontSize = '9px';
            valueDisplay.style.color = '#1ed760';
            valueDisplay.style.marginBottom = '5px';
            valueDisplay.textContent = '0db';

            const input = document.createElement('input');
            input.type = 'range';
            input.min = -12;
            input.max = 12;
            input.value = 0;
            input.step = 0.5;
            input.className = 'eq-slider-vertical';

            input.addEventListener('input', (e) => {
                initVisualizer();
                const val = parseFloat(e.target.value);
                valueDisplay.textContent = `${val > 0 ? '+' : ''}${val}db`;
                if (filters[index]) {
                    filters[index].gain.value = val;
                }
            });

            const sliderContainer = document.createElement('div');
            sliderContainer.className = 'slider-container';
            sliderContainer.appendChild(input);

            sliderWrapper.appendChild(valueDisplay);
            sliderWrapper.appendChild(sliderContainer);
            eqSlidersContainer.appendChild(sliderWrapper);

            const label = document.createElement('div');
            label.textContent = freq >= 1000 ? `${freq / 1000}k` : freq;
            label.style.width = '24px';
            eqLabelsContainer.appendChild(label);
        });
    }

    // AI Integration Logic
    const navEnhanceLibrary = document.getElementById('nav-enhance-library');
    if (navEnhanceLibrary) {
        navEnhanceLibrary.addEventListener('click', async () => {
            const icon = navEnhanceLibrary.querySelector('i');
            icon.className = 'fa-solid fa-spinner fa-spin';
            try {
                await fetch('/api/ai/metadata', { method: 'POST' });
                alert("Local AI (Phi-3) is processing your library in the background! Refresh the page in a few minutes.");
            } catch (e) {
                console.error(e);
                alert("Failed to start AI enhance.");
            }
            icon.className = 'fa-solid fa-wand-magic-sparkles';
        });
    }

    const aiPlaylistNameBtn = document.getElementById('ai-playlist-name-btn');
    if (aiPlaylistNameBtn) {
        aiPlaylistNameBtn.addEventListener('click', async () => {
            const aiIcon = aiPlaylistNameBtn.querySelector('i');
            aiIcon.className = 'fa-solid fa-spinner fa-spin';

            // Build context from whatever songs are displaying
            const songContext = displayedSongs.slice(0, 5).map(s => `${s.artist} - ${s.title}`);
            if (songContext.length === 0) songContext.push("Random Local Audio");

            try {
                const res = await fetch('/api/ai/playlist-name', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ songs: songContext })
                });
                const data = await res.json();
                if (data.name) {
                    document.getElementById('new-playlist-input').value = data.name;
                }
            } catch (e) {
                console.error(e);
            }
            aiIcon.className = 'fa-solid fa-wand-magic-sparkles';
        });
    }

    const aiDjBtn = document.getElementById('ai-dj-btn');
    if (aiDjBtn) {
        aiDjBtn.addEventListener('click', async () => {
            const aiIcon = aiDjBtn.querySelector('i');
            aiIcon.className = 'fa-solid fa-spinner fa-spin';

            const playedContext = [];
            if (currentSongIndex !== -1) {
                playedContext.push(`${allSongs[currentSongIndex].artist} - ${allSongs[currentSongIndex].title}`);
            } else {
                playedContext.push("Any awesome music");
            }

            const pool = [...allSongs].sort(() => 0.5 - Math.random()).slice(0, 50);
            const preview = pool.map(s => ({ id: s.id, label: `${s.artist} - ${s.title}` }));

            try {
                const res = await fetch('/api/ai/recommend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        playedSongs: playedContext,
                        allSongsPreview: preview
                    })
                });
                const data = await res.json();
                if (data.recommended_ids && Array.isArray(data.recommended_ids)) {
                    upcomingQueue = data.recommended_ids.map(id => id.toString());
                    renderQueue();
                } else {
                    alert("AI DJ failed to recommend tracks.");
                }
            } catch (e) {
                console.error(e);
                alert("AI DJ error: Is Ollama running?");
            }
            aiIcon.className = 'fa-solid fa-wand-magic-sparkles';
        });
    }
    function setVisualizerMode(mode) {
        visualizerMode = mode;
        saveState();
    }

    // Host Visualizer Selector
    const vizSelector = document.getElementById('visualizer-selector');
    if (vizSelector) {
        const vizBtns = vizSelector.querySelectorAll('button');
        vizBtns.forEach(btn => {
            btn.onclick = () => setVisualizerMode(btn.getAttribute('data-mode'));
        });
    }

    // Remote Search Toggle
    const remoteSearchToggle = document.getElementById('remote-search-toggle');
    const remoteSearchContainer = document.getElementById('remote-search-container');
    const remoteSearchResults = document.getElementById('remote-search-results');
    const remoteArtContainer = document.getElementById('remote-art-container');
    const remoteSearchInput = document.getElementById('remote-search-input');
    const remoteInfo = document.querySelector('.remote-info');

    if (remoteSearchToggle && remoteSearchContainer && remoteSearchResults && remoteArtContainer && remoteInfo) {
        remoteSearchToggle.onclick = () => {
            const isSearchOpen = remoteSearchContainer.style.display === 'block';
            remoteSearchContainer.style.display = isSearchOpen ? 'none' : 'block';
            remoteSearchResults.style.display = isSearchOpen ? 'none' : 'block';

            // Hide other elements to make room for search
            remoteArtContainer.style.display = isSearchOpen ? 'flex' : 'none';
            remoteInfo.style.display = isSearchOpen ? 'block' : 'none';

            // Optional: Hide progress and controls if screen is small
            const remoteProgress = document.querySelector('.remote-progress-section');
            const remoteControls = document.querySelector('.remote-controls');
            if (remoteProgress) remoteProgress.style.display = isSearchOpen ? 'block' : 'none';
            if (remoteControls) remoteControls.style.display = isSearchOpen ? 'flex' : 'none';

            remoteSearchToggle.classList.toggle('active', !isSearchOpen);
            if (!isSearchOpen) {
                remoteSearchInput.focus();
                if (remoteSongs.length === 0) {
                    fetch('/api/songs').then(r => r.json()).then(data => remoteSongs = data);
                }
            }
        };
    }

    if (remoteSearchInput) {
        remoteSearchInput.oninput = (e) => {
            const query = e.target.value.toLowerCase();
            if (!query) {
                remoteSearchResults.innerHTML = '';
                return;
            }
            const filtered = remoteSongs.filter(s =>
                s.title.toLowerCase().includes(query) ||
                s.artist.toLowerCase().includes(query)
            ).slice(0, 20);

            let html = '';
            filtered.forEach(song => {
                html += `
                    <div class="remote-queue-item" data-id="${song.id}">
                        <div class="remote-queue-img"><i class="fa-solid ${getIconForId(song.id.toString())}"></i></div>
                        <div class="remote-queue-info">
                            <div class="remote-queue-title">${song.title}</div>
                            <div class="remote-queue-artist">${song.artist}</div>
                        </div>
                    </div>
                `;
            });
            remoteSearchResults.innerHTML = html;
            remoteSearchResults.querySelectorAll('.remote-queue-item').forEach(item => {
                item.onclick = () => {
                    sendRemoteCommand({ command: 'PLAY_QUEUE_ID', id: item.getAttribute('data-id') });
                };
            });
        };
    }

    // Initialize library
    initRemoteControl();

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        // Don't trigger if user is typing in search/input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.key.toLowerCase()) {
            case ' ':
                e.preventDefault();
                togglePlayPause();
                break;
            case 'n':
            case 'mediatracknext':
                playNextCrossfade(1000);
                break;
            case 'p':
            case 'mediatrackprevious':
                prevBtn.click();
                break;
            case 'l':
                const cur = allSongs[currentSongIndex];
                if (cur) toggleLike(cur.id);
                break;
            case 'm':
                toggleMute();
                break;
            case 's':
                shuffleBtn.click();
                break;
            case 'r':
                const rep = document.getElementById('repeat-btn');
                if (rep) rep.click();
                break;
            case 'q':
                const qbt = document.getElementById('queue-toggle-btn');
                if (qbt) qbt.click();
                break;
            case 'e':
                const eqt = document.getElementById('eq-toggle-btn');
                if (eqt) eqt.click();
                break;
        }

        // Handle Media Keys explicitly for older browsers if needed
        if (e.key === 'MediaPlayPause') {
            togglePlayPause();
        }
    });
});
