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
    const visualizerCanvas = document.getElementById('visualizer-canvas');
    const visualizerCtx = visualizerCanvas ? visualizerCanvas.getContext('2d') : null;
    const heroMainIcon = document.getElementById('hero-main-icon');

    function initVisualizer() {
        if (audioContext || !visualizerCanvas) return;
        visualizerCanvas.width = 232;
        visualizerCanvas.height = 232;
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        source1 = audioContext.createMediaElementSource(audio1);
        source2 = audioContext.createMediaElementSource(audio2);
        source1.connect(analyser);
        source2.connect(analyser);
        analyser.connect(audioContext.destination);
        analyser.fftSize = 64;
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        drawVisualizer();
    }

    function drawVisualizer() {
        requestAnimationFrame(drawVisualizer);
        if (!isPlaying) return;
        analyser.getByteFrequencyData(dataArray);
        const width = visualizerCanvas.width;
        const height = visualizerCanvas.height;
        visualizerCtx.clearRect(0, 0, width, height);
        const barWidth = (width / bufferLength) * 2.5;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            let barHeight = (dataArray[i] / 255) * height;
            const gradient = visualizerCtx.createLinearGradient(0, height, 0, 0);
            gradient.addColorStop(0, 'rgba(30, 215, 96, 0.8)');
            gradient.addColorStop(1, 'rgba(31, 223, 100, 1)');
            visualizerCtx.fillStyle = gradient;
            visualizerCtx.fillRect(x, height - barHeight, barWidth, barHeight);
            x += barWidth + 2;
        }
    }

    function getIconForId(id) {
        let hash = 0;
        for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
        return musicIcons[Math.abs(hash) % musicIcons.length];
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
    let currentSongIndex = -1; // Index against allSongs
    let isPlaying = false;
    let currentView = 'home'; // 'home', 'search', 'liked', 'playlist'
    let currentPlaylistId = null;
    let isQueueVisible = false;
    let recommendedQueue = [];
    let upcomingQueue = [];

    function updateQueueContext(displayedIdx) {
        upcomingQueue = displayedSongs.slice(displayedIdx + 1).map(s => s.id);
    }

    // LocalStorage State
    let likedSongs = JSON.parse(localStorage.getItem('likedSongs')) || [];
    let playlists = JSON.parse(localStorage.getItem('playlists')) || {};

    // Fetch songs from API
    fetch('/api/songs')
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                songsList.innerHTML = `<div class="loading">Error: ${data.error}. Path: ${data.path}</div>`;
                return;
            }
            allSongs = data.map((song, i) => ({ ...song, id: i.toString() }));
            displayedSongs = [...allSongs];
            renderSidebarPlaylists();
            renderView();
        })
        .catch(error => {
            songsList.innerHTML = '<div class="loading">Error connecting to local server. Make sure it is running.</div>';
        });

    function saveState() {
        localStorage.setItem('likedSongs', JSON.stringify(likedSongs));
        localStorage.setItem('playlists', JSON.stringify(playlists));
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

        saveState();
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
                saveState();
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
                        saveState();
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
            renderSongs(); // Update active row highlighting

            initVisualizer();
            if (heroMainIcon) heroMainIcon.style.display = 'none';
            if (visualizerCanvas) visualizerCanvas.style.display = 'block';

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
        if (upcomingQueue.length > 0) {
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
    });

    volumeBar.addEventListener('click', (e) => {
        const rect = volumeBar.getBoundingClientRect();
        globalVolume = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        if (!crossfadingAudio) {
            activeAudio.volume = globalVolume;
        }
        volume.style.width = `${globalVolume * 100}%`;
    });

    volume.style.width = `100%`;
    audio1.volume = 1;
    audio2.volume = 1;

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
});
