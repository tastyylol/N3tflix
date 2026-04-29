// ─── State ────────────────────────────────────────────────────────────────────
const state = {
    all: [],          // all items (series + videos)
    videos: [],       // standalone videos only
    series: [],       // series items only
    view: 'grid',
    filter: 'all',
    sort: 'newest',
    progress: {},
    currentVideo: null,     // current playing episode/video
    currentSeries: null,    // series context when playing episode
    currentEpIndex: null,   // flat episode index within series
    playerReady: false,
    controlsTimer: null,
    nextEpTimer: null,
    speeds: [0.5, 0.75, 1, 1.25, 1.5, 2],
    speedIndex: 2,
};

// ─── DOM ──────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const el = {
    loadingScreen:    $('loadingScreen'),
    navbar:           $('navbar'),
    searchToggle:     $('searchToggle'),
    searchBar:        $('searchBar'),
    closeSearch:      $('closeSearch'),
    searchInput:      $('searchInput'),
    refreshBtn:       $('refreshBtn'),
    sortBtn:          $('sortBtn'),
    sortDropdown:     $('sortDropdown'),
    videoGrid:        $('videoGrid'),
    continueWatching: $('continueWatching'),
    continueSection:  $('continueSection'),
    seriesSection:    $('seriesSection'),
    seriesRow:        $('seriesRow'),
    libraryTitle:     $('libraryTitle'),

    // Series modal
    seriesModal:       $('seriesModal'),
    seriesModalBackdrop: $('seriesModalBackdrop'),
    seriesModalPanel:  document.querySelector('.series-modal-panel'),
    seriesModalTitle:  $('seriesModalTitle'),
    seriesModalBody:   $('seriesModalBody'),
    seriesHeroCanvas:  $('seriesHeroCanvas'),
    seriesEpCount:     $('seriesEpCount'),
    seriesSeasonCount: $('seriesSeasonCount'),
    seriesSize:        $('seriesSize'),
    seriesPlayNextBtn: $('seriesPlayNextBtn'),
    seriesModalClose:  $('seriesModalClose'),

    // Video modal / player
    videoModal:       $('videoModal'),
    videoWrapper:     $('videoWrapper'),
    videoPlayer:      $('videoPlayer'),
    playerControls:   $('playerControls'),
    playPauseBtn:     $('playPauseBtn'),
    prevEpBtn:        $('prevEpBtn'),
    nextEpBtn:        $('nextEpBtn'),
    skipBackBtn:      $('skipBackBtn'),
    skipFwdBtn:       $('skipFwdBtn'),
    volumeBtn:        $('volumeBtn'),
    volumeSlider:     $('volumeSlider'),
    fullscreenBtn:    $('fullscreenBtn'),
    speedBtn:         $('speedBtn'),
    pipBtn:           $('pipBtn'),
    closePlayerBtn:   $('closePlayerBtn'),
    progressBarBg:    $('progressBarBg'),
    progressFill:     $('progressFill'),
    progressHover:    $('progressHover'),
    progressThumb:    $('progressThumb'),
    progressBuffered: $('progressBuffered'),
    progressTooltip:  $('progressTooltip'),
    currentTime:      $('currentTime'),
    duration:         $('duration'),
    modalVideoTitle:  $('modalVideoTitle'),
    videoTitleOverlay:$('videoTitleOverlay'),
    playerLoading:    $('playerLoading'),
    centerFlash:      $('centerFlash'),
    centerFlashIcon:  $('centerFlashIcon'),
    skipBackInd:      $('skipBack'),
    skipFwdInd:       $('skipFwd'),
    episodeLabelPlayer: $('episodeLabelPlayer'),
    nextEpCard:       $('nextEpCard'),
    nextEpTitle:      $('nextEpTitle'),
    nextEpPlayNow:    $('nextEpPlayNow'),
    nextEpDismiss:    $('nextEpDismiss'),
    nextEpCountdown:  $('nextEpCountdown'),

    toast:        $('toast'),
    totalVideos:  $('totalVideos'),
    totalSeries:  $('totalSeries'),
    totalSize:    $('totalSize'),
    videoCount:   $('videoCount'),
};

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    loadProgress();
    setupEventListeners();
    setupPlayerEventListeners();
    await loadVideos();
    setTimeout(() => {
        el.loadingScreen.style.opacity = '0';
        setTimeout(() => { el.loadingScreen.style.display = 'none'; }, 600);
    }, 800);
});

// ─── Load ─────────────────────────────────────────────────────────────────────
async function loadVideos() {
    try {
        const res = await fetch('list_videos.php');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        state.all = data.map(item => {
            if (item.type === 'series') {
                // Attach progress to each episode
                item.seasons.forEach(s => {
                    s.episodes.forEach(ep => {
                        ep.progress = state.progress[ep.id] ?? 0;
                    });
                });
                return item;
            }
            return { ...item, progress: state.progress[item.id] ?? 0 };
        });

        state.videos = state.all.filter(i => i.type === 'video');
        state.series = state.all.filter(i => i.type === 'series');

        renderAll();
        updateStats();
        showToast(`Biblioteca carregada: ${state.videos.length} vídeo(s), ${state.series.length} série(s)`, 'success');
    } catch (err) {
        console.error(err);
        showToast('Erro ao carregar. Verifique o servidor PHP.', 'error');
        el.videoGrid.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Erro de conexão</h3><p>Certifique-se de que o servidor PHP está rodando.</p></div>`;
    }
}

// ─── Progress ─────────────────────────────────────────────────────────────────
function loadProgress() {
    try { state.progress = JSON.parse(localStorage.getItem('n3tflix_progress') || '{}'); }
    catch { state.progress = {}; }
}

function saveProgress() {
    try { localStorage.setItem('n3tflix_progress', JSON.stringify(state.progress)); }
    catch {}
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function updateStats() {
    const bytes = state.all.reduce((acc, i) => acc + (i.sizeBytes || 0), 0);
    el.totalVideos.textContent = state.videos.length;
    el.totalSeries.textContent = state.series.length;
    el.totalSize.textContent = formatSize(bytes);
    el.videoCount.textContent = state.all.length;
}

function formatSize(b) {
    if (b >= 1073741824) return (b/1073741824).toFixed(1)+' GB';
    if (b >= 1048576)    return (b/1048576).toFixed(1)+' MB';
    return (b/1024).toFixed(0)+' KB';
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderAll() {
    const term = el.searchInput.value.trim().toLowerCase();

    // Build filtered lists
    let filteredVideos = [...state.videos];
    let filteredSeries = [...state.series];

    if (state.filter === 'series') {
        filteredVideos = [];
    } else if (state.filter === 'recent') {
        filteredVideos = filteredVideos.slice(0, 12);
        filteredSeries = filteredSeries.slice(0, 6);
    } else if (state.filter === 'watched') {
        filteredVideos = filteredVideos.filter(v => v.progress > 0);
        filteredSeries = filteredSeries.filter(s => {
            return getAllEpisodes(s).some(ep => ep.progress > 0);
        });
    }

    if (term) {
        filteredVideos = filteredVideos.filter(v => v.title.toLowerCase().includes(term) || v.filename.toLowerCase().includes(term));
        filteredSeries = filteredSeries.filter(s => s.title.toLowerCase().includes(term));
    }

    // Sort
    const sortFn = {
        newest: (a,b) => b.lastModified - a.lastModified,
        oldest: (a,b) => a.lastModified - b.lastModified,
        title:  (a,b) => a.title.localeCompare(b.title, 'pt'),
        size:   (a,b) => b.sizeBytes - a.sizeBytes,
    }[state.sort] || ((a,b) => b.lastModified - a.lastModified);

    filteredVideos.sort(sortFn);
    filteredSeries.sort(sortFn);

    // Update library title
    el.libraryTitle.textContent = state.filter === 'series' ? 'Séries' : 'Minha Biblioteca';

    // ── Continue Watching row ─────────────────────────────────────────────────
    const continueItems = [];

    // In-progress standalone videos
    filteredVideos.filter(v => v.progress > 0 && v.progress < 95).forEach(v => {
        continueItems.push({ type: 'video', item: v });
    });

    // In-progress series (next episode to watch)
    filteredSeries.forEach(s => {
        const next = getNextEpisode(s);
        if (next) continueItems.push({ type: 'series_ep', item: next, series: s });
    });

    if (continueItems.length > 0) {
        el.continueWatching.innerHTML = continueItems.map(c => {
            if (c.type === 'video') return createVideoCardHTML(c.item);
            return createEpContinueCardHTML(c.series, c.item);
        }).join('');
        el.continueSection.style.display = 'block';
    } else {
        el.continueSection.style.display = 'none';
    }

    // ── Series row ────────────────────────────────────────────────────────────
    if (filteredSeries.length > 0) {
        el.seriesRow.innerHTML = filteredSeries.map(createSeriesCardHTML).join('');
        el.seriesSection.style.display = state.filter === 'series' ? 'none' : 'block';
    } else {
        el.seriesSection.style.display = 'none';
    }

    // ── Main grid ─────────────────────────────────────────────────────────────
    const gridItems = state.filter === 'series'
        ? filteredSeries
        : [...filteredSeries, ...filteredVideos];

    if (gridItems.length > 0) {
        el.videoGrid.className = `videos-container${state.view === 'list' ? ' list-view' : ''}`;
        el.videoGrid.innerHTML = gridItems.map(item =>
            item.type === 'series' ? createSeriesCardHTML(item) : createVideoCardHTML(item)
        ).join('');
    } else {
        el.videoGrid.className = 'videos-container';
        el.videoGrid.innerHTML = `<div class="empty-state"><i class="fas fa-video-slash"></i><h3>Nenhum conteúdo encontrado</h3><p>Coloque vídeos na pasta <code>videos/</code> ou subpastas para séries, e clique em atualizar.</p></div>`;
    }

    attachCardListeners();
    generateThumbnails();
}

// ─── Card HTML ────────────────────────────────────────────────────────────────
function createVideoCardHTML(video) {
    const p = video.progress || 0;
    const watched = p >= 95;
    return `
        <div class="video-card" data-id="${video.id}" data-type="video" tabindex="0" role="listitem">
            <div class="card-thumbnail">
                <div class="thumb-placeholder"><i class="fas fa-film"></i></div>
                <canvas class="thumb-canvas" data-src="${esc(video.file)}" style="opacity:0"></canvas>
                ${video.duration ? `<span class="duration-badge">${esc(video.duration)}</span>` : ''}
                ${watched ? `<span class="watched-badge"><i class="fas fa-check"></i> Assistido</span>` : ''}
                ${p > 0 && !watched ? `<div class="progress-indicator" style="width:${p.toFixed(1)}%"></div>` : ''}
                <div class="card-overlay" aria-hidden="true"><div class="play-overlay"><i class="fas fa-play"></i></div></div>
            </div>
            <div class="card-info">
                <div class="card-title" title="${esc(video.title)}">${esc(video.title)}</div>
                <div class="card-meta">
                    <span><i class="fas fa-hdd"></i>${video.size}</span>
                    ${p > 0 && !watched ? `<span class="progress-text">${Math.round(p)}%</span>` : ''}
                    ${watched ? `<span class="progress-text"><i class="fas fa-check-circle"></i> Concluído</span>` : ''}
                </div>
            </div>
        </div>`;
}

function createSeriesCardHTML(series) {
    const epsDone = getAllEpisodes(series).filter(ep => ep.progress >= 95).length;
    const total   = series.episodeCount;
    const hasProg = getAllEpisodes(series).some(ep => ep.progress > 0);
    const pct     = total > 0 ? (epsDone / total) * 100 : 0;

    return `
        <div class="video-card series-card" data-id="${series.id}" data-type="series" tabindex="0" role="listitem">
            <div class="card-thumbnail">
                <div class="thumb-placeholder"><i class="fas fa-tv"></i></div>
                <canvas class="thumb-canvas" data-src="${esc(series.sampleFile)}" style="opacity:0"></canvas>
                <span class="series-type-badge"><i class="fas fa-tv"></i> Série</span>
                <span class="series-ep-count">${total} ep${total !== 1 ? 's' : ''}</span>
                ${hasProg ? `<div class="progress-indicator" style="width:${pct.toFixed(1)}%"></div>` : ''}
                <div class="card-overlay" aria-hidden="true"><div class="play-overlay"><i class="fas fa-folder-open"></i></div></div>
            </div>
            <div class="card-info">
                <div class="card-title" title="${esc(series.title)}">${esc(series.title)}</div>
                <div class="card-meta">
                    <span><i class="fas fa-layer-group"></i>${series.seasonCount} temp.</span>
                    <span><i class="fas fa-hdd"></i>${series.size}</span>
                </div>
            </div>
        </div>`;
}

function createEpContinueCardHTML(series, ep) {
    const p = ep.progress || 0;
    return `
        <div class="video-card" data-id="${series.id}" data-type="series-ep" data-ep-id="${ep.id}" tabindex="0" role="listitem">
            <div class="card-thumbnail">
                <div class="thumb-placeholder"><i class="fas fa-tv"></i></div>
                <canvas class="thumb-canvas" data-src="${esc(ep.file)}" style="opacity:0"></canvas>
                ${ep.duration ? `<span class="duration-badge">${esc(ep.duration)}</span>` : ''}
                ${p > 0 ? `<div class="progress-indicator" style="width:${p.toFixed(1)}%"></div>` : ''}
                <div class="card-overlay" aria-hidden="true"><div class="play-overlay"><i class="fas fa-play"></i></div></div>
            </div>
            <div class="card-info">
                <div class="card-title">${esc(series.title)}</div>
                <div class="card-meta">
                    <span style="color:#a89cff"><i class="fas fa-tv"></i> ${ep.episodeCode || 'Ep'}</span>
                    ${p > 0 ? `<span class="progress-text">${Math.round(p)}%</span>` : ''}
                </div>
            </div>
        </div>`;
}

function esc(text) {
    const d = document.createElement('div'); d.textContent = text; return d.innerHTML;
}

// ─── Series helpers ───────────────────────────────────────────────────────────
function getAllEpisodes(series) {
    return series.seasons.flatMap(s => s.episodes);
}

function getNextEpisode(series) {
    const eps = getAllEpisodes(series);
    // First episode with progress > 0 and < 95
    const inProg = eps.find(ep => ep.progress > 0 && ep.progress < 95);
    if (inProg) return inProg;
    // First episode with 0 progress
    const unwatched = eps.find(ep => !ep.progress || ep.progress === 0);
    return unwatched || null;
}

function getEpisodeFlatIndex(series, epId) {
    const eps = getAllEpisodes(series);
    return eps.findIndex(ep => ep.id === epId);
}

// ─── Card Listeners ───────────────────────────────────────────────────────────
function attachCardListeners() {
    document.querySelectorAll('.video-card[data-id]').forEach(card => {
        const type  = card.dataset.type;
        const id    = card.dataset.id;
        const epId  = card.dataset.epId;

        const handler = () => {
            if (type === 'series') {
                openSeriesModal(id);
            } else if (type === 'series-ep') {
                const series = state.series.find(s => s.id === id);
                if (series) {
                    const ep = getAllEpisodes(series).find(e => e.id === epId)
                            || getNextEpisode(series);
                    if (ep) openPlayerWithEpisode(series, ep);
                }
            } else {
                openPlayerStandalone(id);
            }
        };

        card.addEventListener('click', handler);
        card.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
        });
    });
}

// ─── Thumbnail generation ────────────────────────────────────────────────────
function generateThumbnails() {
    const canvases = [...document.querySelectorAll('.thumb-canvas')].slice(0, 24);
    canvases.forEach(canvas => {
        if (canvas.dataset.loaded) return;
        canvas.dataset.loaded = '1';
        const src = canvas.dataset.src;
        if (!src) return;
        const vid = document.createElement('video');
        vid.src = src; vid.muted = true; vid.preload = 'metadata'; vid.crossOrigin = 'anonymous';
        vid.addEventListener('loadedmetadata', () => { vid.currentTime = Math.min(5, vid.duration * 0.1); });
        vid.addEventListener('seeked', () => {
            try {
                canvas.width = 320; canvas.height = 180;
                canvas.getContext('2d').drawImage(vid, 0, 0, 320, 180);
                canvas.style.opacity = '1';
            } catch {}
            vid.src = '';
        }, { once: true });
        vid.load();
    });
}

// ─── Series Modal ─────────────────────────────────────────────────────────────
function openSeriesModal(seriesId) {
    const series = state.series.find(s => s.id === seriesId);
    if (!series) return;
    state.currentSeries = series;

    el.seriesModalTitle.textContent = series.title;
    el.seriesEpCount.innerHTML = `<i class="fas fa-list-ol"></i> ${series.episodeCount} episódio${series.episodeCount !== 1 ? 's' : ''}`;
    el.seriesSeasonCount.innerHTML = `<i class="fas fa-layer-group"></i> ${series.seasonCount} temporada${series.seasonCount !== 1 ? 's' : ''}`;
    el.seriesSize.innerHTML = `<i class="fas fa-hdd"></i> ${series.size}`;

    // Generate hero thumbnail from first episode
    generateCanvasThumbnail(el.seriesHeroCanvas, series.sampleFile, 480, 270);

    // Build episodes list
    buildSeriesEpisodeList(series);

    el.seriesModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    el.seriesModalClose.focus();
}

function closeSeriesModal() {
    el.seriesModal.style.display = 'none';
    document.body.style.overflow = '';
    state.currentSeries = null;
}

function buildSeriesEpisodeList(series) {
    const eps = getAllEpisodes(series);
    const currentlyPlayingId = state.currentVideo?.id;

    el.seriesModalBody.innerHTML = series.seasons.map(season => {
        // Auto-open season with in-progress or next episode
        const hasActive = season.episodes.some(ep =>
            ep.id === currentlyPlayingId || (ep.progress > 0 && ep.progress < 95)
        );
        const isOpen = series.seasons.length === 1 || hasActive || season === series.seasons[0];

        return `
            <div class="season-group" data-season="${season.season}">
                <div class="season-header" onclick="toggleSeason(this)">
                    <div class="season-header-left">
                        <span class="season-title">Temporada ${season.season}</span>
                        <span class="season-ep-count">${season.episodes.length} eps</span>
                    </div>
                    <i class="fas fa-chevron-down season-chevron ${isOpen ? 'open' : ''}"></i>
                </div>
                <div class="episode-list ${isOpen ? 'open' : ''}">
                    ${season.episodes.map((ep, idx) => createEpisodeRowHTML(ep, series, idx)).join('')}
                </div>
            </div>`;
    }).join('');

    // Generate thumbnails for visible episodes
    setTimeout(() => {
        const epCanvases = [...el.seriesModalBody.querySelectorAll('.ep-thumb canvas')].slice(0, 16);
        epCanvases.forEach(canvas => {
            if (canvas.dataset.loaded) return;
            canvas.dataset.loaded = '1';
            generateCanvasThumbnail(canvas, canvas.dataset.src, 240, 135);
        });
    }, 100);
}

function createEpisodeRowHTML(ep, series, idx) {
    const p = ep.progress || 0;
    const watched = p >= 95;
    const isPlaying = state.currentVideo?.id === ep.id;

    return `
        <div class="episode-row ${isPlaying ? 'playing' : ''}"
             onclick="playEpisodeFromModal('${series.id}','${ep.id}')"
             tabindex="0"
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();playEpisodeFromModal('${series.id}','${ep.id}');}">
            <div class="ep-number">${ep.episode < 999 ? ep.episode : idx+1}</div>
            <div class="ep-thumb">
                <div class="ep-thumb-placeholder"><i class="fas fa-film"></i></div>
                <canvas data-src="${esc(ep.file)}" width="240" height="135" style="opacity:0;position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"></canvas>
                ${p > 0 ? `<div class="ep-progress-bar"><div class="ep-progress-fill" style="width:${p.toFixed(1)}%"></div></div>` : ''}
                <div class="ep-play-overlay">
                    <i class="fas ${isPlaying ? 'fa-pause' : 'fa-play'}"></i>
                </div>
            </div>
            <div class="ep-info">
                ${ep.episodeCode ? `<div class="ep-code">${esc(ep.episodeCode)}</div>` : ''}
                <div class="ep-title">${esc(ep.title || 'Episódio ' + ep.episode)}</div>
                <div class="ep-meta">
                    ${ep.duration ? `<span><i class="fas fa-clock"></i> ${esc(ep.duration)}</span>` : ''}
                    ${ep.size ? `<span>${esc(ep.size)}</span>` : ''}
                    ${p > 0 && !watched ? `<span class="ep-progress-text">${Math.round(p)}% assistido</span>` : ''}
                </div>
            </div>
            ${watched ? `<div class="ep-watched-icon"><i class="fas fa-check"></i></div>` : ''}
        </div>`;
}

function toggleSeason(header) {
    const list = header.nextElementSibling;
    const chevron = header.querySelector('.season-chevron');
    const isOpen = list.classList.toggle('open');
    chevron.classList.toggle('open', isOpen);
}

// Called from inline onclick in HTML
function playEpisodeFromModal(seriesId, epId) {
    const series = state.series.find(s => s.id === seriesId);
    if (!series) return;
    const ep = getAllEpisodes(series).find(e => e.id === epId);
    if (!ep) return;
    closeSeriesModal();
    openPlayerWithEpisode(series, ep);
}

// ─── Player ───────────────────────────────────────────────────────────────────
function openPlayerStandalone(videoId) {
    const video = state.videos.find(v => v.id === videoId);
    if (!video) return;
    state.currentSeries = null;
    state.currentEpIndex = null;
    _startPlayer(video);
    updateEpNavButtons();
}

function openPlayerWithEpisode(series, ep) {
    state.currentSeries = series;
    state.currentEpIndex = getEpisodeFlatIndex(series, ep.id);
    _startPlayer(ep);
    updateEpNavButtons();

    // Show episode label in controls
    el.episodeLabelPlayer.textContent = ep.episodeCode
        ? `${series.title} · ${ep.episodeCode}`
        : series.title;
}

function _startPlayer(videoItem) {
    state.currentVideo = videoItem;
    el.videoModal.style.display = 'block';
    el.modalVideoTitle.textContent = videoItem.title;

    el.videoPlayer.src = videoItem.file;
    el.videoPlayer.load();

    if (videoItem.progress > 0 && videoItem.progress < 95) {
        const resume = () => {
            el.videoPlayer.currentTime = (videoItem.progress / 100) * el.videoPlayer.duration;
            el.videoPlayer.removeEventListener('loadedmetadata', resume);
        };
        el.videoPlayer.addEventListener('loadedmetadata', resume);
    }

    const savedVol = parseFloat(localStorage.getItem('n3tflix_volume') ?? '1');
    el.videoPlayer.volume = savedVol;
    el.volumeSlider.value = Math.round(savedVol * 100);
    updateVolumeIcon(savedVol);

    el.videoPlayer.playbackRate = state.speeds[state.speedIndex];
    el.speedBtn.querySelector('.speed-label').textContent = fmtSpeed(state.speeds[state.speedIndex]);

    el.nextEpCard.style.display = 'none';
    clearNextEpTimer();

    el.videoPlayer.play().catch(() => {});
    showControls();
    document.body.style.overflow = 'hidden';
}

function closePlayer() {
    el.videoPlayer.pause();
    el.videoPlayer.src = '';
    el.videoModal.style.display = 'none';
    document.body.style.overflow = '';
    clearControlsTimer();
    clearNextEpTimer();
    el.nextEpCard.style.display = 'none';
    state.currentVideo = null;
    // Refresh series modal if it was open
    if (state.currentSeries) {
        buildSeriesEpisodeList(state.currentSeries);
    }
}

function updateEpNavButtons() {
    const hasSeries = !!state.currentSeries;
    const eps = hasSeries ? getAllEpisodes(state.currentSeries) : [];
    el.prevEpBtn.style.display = hasSeries ? '' : 'none';
    el.nextEpBtn.style.display = hasSeries ? '' : 'none';
    el.episodeLabelPlayer.style.display = hasSeries ? '' : 'none';
    if (hasSeries) {
        el.prevEpBtn.disabled = state.currentEpIndex === 0;
        el.nextEpBtn.disabled = state.currentEpIndex >= eps.length - 1;
        el.prevEpBtn.style.opacity = el.prevEpBtn.disabled ? '0.3' : '1';
        el.nextEpBtn.style.opacity = el.nextEpBtn.disabled ? '0.3' : '1';
    }
}

function playNextEpisode() {
    if (!state.currentSeries) return;
    const eps = getAllEpisodes(state.currentSeries);
    const nextIdx = state.currentEpIndex + 1;
    if (nextIdx >= eps.length) return;
    openPlayerWithEpisode(state.currentSeries, eps[nextIdx]);
}

function playPrevEpisode() {
    if (!state.currentSeries) return;
    const eps = getAllEpisodes(state.currentSeries);
    const prevIdx = state.currentEpIndex - 1;
    if (prevIdx < 0) return;
    openPlayerWithEpisode(state.currentSeries, eps[prevIdx]);
}

function peekNextEpisode() {
    if (!state.currentSeries) return null;
    const eps = getAllEpisodes(state.currentSeries);
    const nextIdx = state.currentEpIndex + 1;
    return nextIdx < eps.length ? eps[nextIdx] : null;
}

// ─── Next Episode countdown ──────────────────────────────────────────────────
let nextEpCountdownInterval = null;

function showNextEpCard() {
    const next = peekNextEpisode();
    if (!next) return;

    el.nextEpTitle.textContent = next.episodeCode
        ? `${next.episodeCode} — ${next.title}`
        : next.title;
    el.nextEpCard.style.display = 'block';

    let secs = 10;
    el.nextEpCountdown.textContent = `Próximo episódio em ${secs}s`;

    clearNextEpTimer();
    nextEpCountdownInterval = setInterval(() => {
        secs--;
        if (secs <= 0) {
            clearNextEpTimer();
            el.nextEpCard.style.display = 'none';
            playNextEpisode();
        } else {
            el.nextEpCountdown.textContent = `Próximo episódio em ${secs}s`;
        }
    }, 1000);
}

function clearNextEpTimer() {
    if (nextEpCountdownInterval) {
        clearInterval(nextEpCountdownInterval);
        nextEpCountdownInterval = null;
    }
}

// ─── Player Event Listeners (once) ────────────────────────────────────────────
function setupPlayerEventListeners() {
    const p = el.videoPlayer;

    el.playPauseBtn.addEventListener('click', togglePlayPause);
    el.prevEpBtn.addEventListener('click', playPrevEpisode);
    el.nextEpBtn.addEventListener('click', playNextEpisode);
    el.nextEpPlayNow.addEventListener('click', () => { clearNextEpTimer(); el.nextEpCard.style.display='none'; playNextEpisode(); });
    el.nextEpDismiss.addEventListener('click', () => { clearNextEpTimer(); el.nextEpCard.style.display='none'; });
    el.skipBackBtn.addEventListener('click', () => skipBy(-10));
    el.skipFwdBtn.addEventListener('click', () => skipBy(10));

    el.volumeSlider.addEventListener('input', () => {
        const vol = el.volumeSlider.value / 100;
        p.volume = vol;
        updateVolumeIcon(vol);
        localStorage.setItem('n3tflix_volume', vol);
    });

    el.volumeBtn.addEventListener('click', () => {
        if (p.volume > 0) { p.dataset.prevVol = p.volume; p.volume = 0; el.volumeSlider.value = 0; }
        else { const pv = parseFloat(p.dataset.prevVol||'1'); p.volume=pv; el.volumeSlider.value=Math.round(pv*100); }
        updateVolumeIcon(p.volume);
    });

    el.speedBtn.addEventListener('click', () => {
        state.speedIndex = (state.speedIndex + 1) % state.speeds.length;
        const spd = state.speeds[state.speedIndex];
        p.playbackRate = spd;
        el.speedBtn.querySelector('.speed-label').textContent = fmtSpeed(spd);
        showToast(`Velocidade: ${fmtSpeed(spd)}`, 'info');
    });

    el.pipBtn.addEventListener('click', async () => {
        try {
            document.pictureInPictureElement ? await document.exitPictureInPicture() : await p.requestPictureInPicture();
        } catch { showToast('PiP não suportado neste navegador', 'error'); }
    });

    el.fullscreenBtn.addEventListener('click', toggleFullscreen);
    el.closePlayerBtn.addEventListener('click', closePlayer);

    // Progress seek (click)
    el.progressBarBg.addEventListener('click', e => {
        const rect = el.progressBarBg.getBoundingClientRect();
        seekTo((e.clientX - rect.left) / rect.width);
    });

    // Progress seek (drag)
    el.progressBarBg.addEventListener('mousedown', e => {
        p.pause();
        const move = ev => {
            const rect = el.progressBarBg.getBoundingClientRect();
            seekTo(Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)));
        };
        const up = () => { p.play(); document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
        move(e);
    });

    // Progress tooltip
    el.progressBarBg.addEventListener('mousemove', e => {
        const rect = el.progressBarBg.getBoundingClientRect();
        const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        el.progressHover.style.width = `${frac*100}%`;
        el.progressThumb.style.left = `${frac*100}%`;
        if (p.duration) {
            el.progressTooltip.textContent = formatTime(frac * p.duration);
            el.progressTooltip.style.left = `${frac*100}%`;
        }
    });

    el.progressBarBg.addEventListener('mouseleave', () => { el.progressHover.style.width = '0'; });

    // Video events
    p.addEventListener('play',  updatePlayPauseIcon);
    p.addEventListener('pause', updatePlayPauseIcon);

    p.addEventListener('timeupdate', () => {
        if (!p.duration) return;
        const frac = p.currentTime / p.duration;
        el.progressFill.style.width = `${frac*100}%`;
        el.progressThumb.style.left = `${frac*100}%`;
        el.currentTime.textContent = formatTime(p.currentTime);

        if (state.currentVideo) {
            const pct = frac * 100;
            state.currentVideo.progress = pct;
            state.progress[state.currentVideo.id] = pct;
            saveProgress();

            // Update card progress bar if visible
            const bar = document.querySelector(`.video-card[data-id] .progress-indicator`);
            // (best-effort; series cards may not have exact match)

            // Show next-ep prompt at 90% for series
            if (state.currentSeries && pct >= 90 && el.nextEpCard.style.display === 'none') {
                const hasNext = peekNextEpisode();
                if (hasNext) showNextEpCard();
            }
        }
    });

    p.addEventListener('loadedmetadata', () => { el.duration.textContent = formatTime(p.duration); });

    p.addEventListener('progress', () => {
        if (p.duration && p.buffered.length) {
            el.progressBuffered.style.width = `${(p.buffered.end(p.buffered.length-1)/p.duration)*100}%`;
        }
    });

    p.addEventListener('waiting', () => el.playerLoading.classList.add('visible'));
    p.addEventListener('canplay', () => el.playerLoading.classList.remove('visible'));

    p.addEventListener('ended', () => {
        if (state.currentVideo) {
            state.progress[state.currentVideo.id] = 100;
            state.currentVideo.progress = 100;
            saveProgress();
        }
        // If in series and next ep card not already showing, trigger it
        if (state.currentSeries) {
            clearNextEpTimer();
            el.nextEpCard.style.display = 'none';
            showNextEpCard();
        } else {
            showToast('Vídeo concluído!', 'success');
        }
    });

    // Auto-hide controls
    el.videoWrapper.addEventListener('mousemove', showControls);
    el.videoWrapper.addEventListener('touchstart', showControls, { passive: true });

    el.videoWrapper.addEventListener('dblclick', e => {
        if (e.target.closest('.player-controls')) return;
        toggleFullscreen();
    });

    el.videoWrapper.addEventListener('click', e => {
        if (e.target.closest('.player-controls, .progress-container, .next-ep-card')) return;
        togglePlayPause();
    });

    document.addEventListener('fullscreenchange', () => {
        el.fullscreenBtn.querySelector('i').className = document.fullscreenElement ? 'fas fa-compress' : 'fas fa-expand';
    });
}

// ─── Player helpers ───────────────────────────────────────────────────────────
function togglePlayPause() {
    const p = el.videoPlayer;
    if (p.paused) { p.play(); flashCenter('fa-play'); }
    else          { p.pause(); flashCenter('fa-pause'); }
}

function skipBy(secs) {
    el.videoPlayer.currentTime = Math.max(0, Math.min(el.videoPlayer.duration||0, el.videoPlayer.currentTime+secs));
    flashSkip(secs < 0 ? 'back' : 'fwd');
}

function seekTo(frac) {
    if (el.videoPlayer.duration) el.videoPlayer.currentTime = frac * el.videoPlayer.duration;
}

function updatePlayPauseIcon() {
    el.playPauseBtn.querySelector('i').className = el.videoPlayer.paused ? 'fas fa-play' : 'fas fa-pause';
    el.playPauseBtn.setAttribute('aria-label', el.videoPlayer.paused ? 'Reproduzir' : 'Pausar');
}

function updateVolumeIcon(vol) {
    el.volumeBtn.querySelector('i').className = vol === 0 ? 'fas fa-volume-mute' : vol < 0.5 ? 'fas fa-volume-low' : 'fas fa-volume-up';
}

function toggleFullscreen() {
    document.fullscreenElement ? document.exitFullscreen?.() : el.videoModal.requestFullscreen?.();
}

function flashCenter(iconClass) {
    el.centerFlashIcon.className = `fas ${iconClass}`;
    el.centerFlash.classList.remove('flash');
    void el.centerFlash.offsetWidth;
    el.centerFlash.classList.add('flash');
}

function flashSkip(dir) {
    const ind = dir === 'back' ? el.skipBackInd : el.skipFwdInd;
    ind.classList.add('flash');
    setTimeout(() => ind.classList.remove('flash'), 700);
}

let controlsTimer = null;
function showControls() {
    el.videoWrapper.classList.add('controls-visible');
    clearControlsTimer();
    controlsTimer = setTimeout(() => {
        if (!el.videoPlayer.paused) el.videoWrapper.classList.remove('controls-visible');
    }, 3000);
}
function clearControlsTimer() { if (controlsTimer) { clearTimeout(controlsTimer); controlsTimer = null; } }

function fmtSpeed(s) { return s === 1 ? '1×' : `${s}×`; }
function formatTime(secs) {
    if (isNaN(secs)||secs<0) return '0:00';
    const h=Math.floor(secs/3600), m=Math.floor((secs%3600)/60), s=Math.floor(secs%60);
    return h>0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
function pad(n) { return String(n).padStart(2,'0'); }

// ─── Canvas thumbnail helper ──────────────────────────────────────────────────
function generateCanvasThumbnail(canvas, src, w, h) {
    if (!src || canvas.dataset.loaded) return;
    canvas.dataset.loaded = '1';
    const vid = document.createElement('video');
    vid.src = src; vid.muted = true; vid.preload = 'metadata'; vid.crossOrigin = 'anonymous';
    vid.addEventListener('loadedmetadata', () => { vid.currentTime = Math.min(5, vid.duration * 0.1); });
    vid.addEventListener('seeked', () => {
        try {
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(vid, 0, 0, w, h);
            canvas.style.opacity = '1';
        } catch {}
        vid.src = '';
    }, { once: true });
    vid.load();
}

// ─── UI Setup ─────────────────────────────────────────────────────────────────
function setupEventListeners() {
    // Search
    el.searchToggle.addEventListener('click', () => {
        const open = el.searchBar.classList.toggle('active');
        el.searchBar.setAttribute('aria-hidden', String(!open));
        el.searchToggle.setAttribute('aria-expanded', String(open));
        if (open) el.searchInput.focus();
    });

    el.closeSearch.addEventListener('click', () => {
        el.searchBar.classList.remove('active');
        el.searchBar.setAttribute('aria-hidden','true');
        el.searchInput.value = '';
        renderAll();
    });

    el.searchInput.addEventListener('input', debounce(renderAll, 200));

    // Refresh
    el.refreshBtn.addEventListener('click', async () => {
        el.refreshBtn.disabled = true;
        el.refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        await loadVideos();
        el.refreshBtn.disabled = false;
        el.refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
    });

    // Sort
    el.sortBtn.addEventListener('click', e => {
        e.stopPropagation();
        el.sortDropdown.classList.toggle('open');
    });
    document.addEventListener('click', e => {
        if (!el.sortDropdown.contains(e.target) && e.target !== el.sortBtn)
            el.sortDropdown.classList.remove('open');
    });
    document.querySelectorAll('.sort-option').forEach(btn => {
        btn.addEventListener('click', () => {
            state.sort = btn.dataset.sort;
            document.querySelectorAll('.sort-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            el.sortDropdown.classList.remove('open');
            renderAll();
        });
    });

    // Nav
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            state.filter = link.dataset.filter;
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            renderAll();
        });
    });

    // View
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.view = btn.dataset.view;
            document.querySelectorAll('.view-btn').forEach(b => {
                b.classList.toggle('active', b===btn);
                b.setAttribute('aria-pressed', String(b===btn));
            });
            renderAll();
        });
    });

    // Section scroll
    $('continuePrev')?.addEventListener('click', () => scrollRow(-1, 'continueWatching'));
    $('continueNext')?.addEventListener('click', () => scrollRow(1, 'continueWatching'));
    $('seriesPrev')?.addEventListener('click', () => scrollRow(-1, 'seriesRow'));
    $('seriesNext')?.addEventListener('click', () => scrollRow(1, 'seriesRow'));

    // Series modal close
    el.seriesModalClose.addEventListener('click', closeSeriesModal);
    el.seriesModalBackdrop.addEventListener('click', closeSeriesModal);

    // "Play Next / Continue" button in series modal
    el.seriesPlayNextBtn.addEventListener('click', () => {
        if (!state.currentSeries) return;
        const next = getNextEpisode(state.currentSeries);
        if (next) {
            closeSeriesModal();
            openPlayerWithEpisode(state.currentSeries, next);
        }
    });

    // Navbar hide on scroll
    let lastScroll = 0, scrollTicking = false;
    window.addEventListener('scroll', () => {
        if (!scrollTicking) {
            requestAnimationFrame(() => {
                const cur = window.scrollY;
                el.navbar.style.transform = (cur > lastScroll && cur > 80) ? 'translateY(-100%)' : 'translateY(0)';
                lastScroll = cur; scrollTicking = false;
            });
            scrollTicking = true;
        }
    }, { passive: true });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
        // Series modal
        if (el.seriesModal.style.display !== 'none') {
            if (e.key === 'Escape') closeSeriesModal();
            return;
        }
        // Player
        if (el.videoModal.style.display !== 'block') return;
        if (e.target.tagName === 'INPUT') return;
        switch (e.key) {
            case ' ': case 'k': e.preventDefault(); togglePlayPause(); break;
            case 'f': toggleFullscreen(); break;
            case 'ArrowLeft':  e.preventDefault(); skipBy(-10); break;
            case 'ArrowRight': e.preventDefault(); skipBy(10);  break;
            case 'ArrowUp':    e.preventDefault();
                el.videoPlayer.volume = Math.min(1, el.videoPlayer.volume + 0.1);
                el.volumeSlider.value = Math.round(el.videoPlayer.volume * 100);
                updateVolumeIcon(el.videoPlayer.volume); break;
            case 'ArrowDown':  e.preventDefault();
                el.videoPlayer.volume = Math.max(0, el.videoPlayer.volume - 0.1);
                el.volumeSlider.value = Math.round(el.videoPlayer.volume * 100);
                updateVolumeIcon(el.videoPlayer.volume); break;
            case 'm': el.volumeBtn.click(); break;
            case 'n': if (state.currentSeries) playNextEpisode(); break;
            case 'p': if (state.currentSeries) playPrevEpisode(); break;
            case 'Escape':
                document.fullscreenElement ? document.exitFullscreen() : closePlayer(); break;
        }
    });
}

// ─── Scroll row ───────────────────────────────────────────────────────────────
function scrollRow(dir, rowId) { $(rowId).scrollBy({ left: dir*280, behavior:'smooth' }); }

// ─── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = 'info') {
    el.toast.textContent = msg;
    el.toast.className = `toast ${type}`;
    void el.toast.offsetWidth;
    el.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 3500);
}

// ─── Debounce ─────────────────────────────────────────────────────────────────
function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
