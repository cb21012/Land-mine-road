// Infinite Road Minesweeper Logic
const ROWS = 13;
const VIEW_COLS = 33;
const MINE_RATIO = 0.01;
const MINE_RATIO_MAX = 0.4;
const INITIAL_GEN_LEN = 100;
const CHUNK_GEN_LEN = 50;
const progressSpeed = 200;
const AREA_LENGTH = 200;
const DZ_START_POS = 150;
const DZ_END_POS = 199;
const DZ_MINE_RATIO_MULT = 5.5;

let distance = 0; // Current frontline column index (0-indexed meters)
let district = 1;
let maxGeneratedCol = 0;
let boardMap = new Map(); // Key: `${r},${c}` -> cell object
let isFirstClick = true;
let isGameOver = false;
let isSliding = false; // Lock flag during 0.1s/m slide animation
let clicksCount = 0;
let timerSeconds = 0;
let moveSpeed = 0; // km per hour
let score = 0;
let timerInterval = null;
let lastUpdTime = 0;
let isFlagModeMobile = false;
let seVolume = 60;
let bgmVolume = 60;
let clang = (localStorage.getItem('Lmr_lang') ?? 0);

// BGM Audio Controller
let currentBgmAudio = null;
let currentBgmTrack = null; // 'bgm1' or 'bgm_dz'
let bgmFadeInterval = null;

function getBgmTargetVolume(trackName) {
    // bgmInfosからトラックのvolumeを取得して設定値と掛け合わせる
    const info = getBgmInfoByName(trackName || currentBgmTrack);
    const trackVol = info ? info.volume : 1.0;
    return Math.min(1, (bgmVolume / 100) * 0.5 * trackVol);
}

function getBgmInfoByName(name) {
    if (!window.bgmInfos) return null;
    return Object.values(window.bgmInfos).find(b => b.name === name) || null;
}

function showBgmNotification(trackName) {
    const info = getBgmInfoByName(trackName);
    const notification = document.getElementById('bgm-notification');
    if (!info || !notification) return;

    notification.textContent = `♪${info.title} - ${info.author}`;
    notification.classList.remove('is-playing');
    void notification.offsetWidth;
    notification.classList.add('is-playing');
}

function getExpectedBgmTrack(dist) {
    if (isDzPos(dist)) return 'bgm_dz';
    // district番号のbgmが存在するか確認 (bgm{d})
    const trackName = `bgm${district}`;
    if (window.bgmInfos && getBgmInfoByName(trackName)) {
        return trackName;
    }
    return 'bgm1'; // フォールバック
}

function isDzPos(pos) {
    const mod = ((pos % AREA_LENGTH) + AREA_LENGTH) % AREA_LENGTH;
    return mod >= DZ_START_POS && mod <= DZ_END_POS;
}

function startOrUpdateBgm() {
    if (isGameOver) return;
    district = Math.floor(distance / AREA_LENGTH) +1;
    const track = getExpectedBgmTrack(distance);
    if (currentBgmTrack === track && currentBgmAudio) {
        return;
    }
    switchBgm(track);
}

function switchBgm(newTrack) {
    if (bgmFadeInterval) {
        clearInterval(bgmFadeInterval);
        bgmFadeInterval = null;
    }

    const oldAudio = currentBgmAudio;
    currentBgmTrack = newTrack;

    const info = getBgmInfoByName(newTrack);
    showBgmNotification(newTrack);
    const filePath = `sebgm/${info ? info.name : newTrack}.ogg`;
    const newAudio = new Audio(filePath);
    newAudio.loop = true;
    newAudio.volume = 0;
    currentBgmAudio = newAudio;

    const playPromise = newAudio.play();
    if (playPromise !== undefined) {
        playPromise.catch(() => {});
    }

    const fadeOutDuration = 1000;
    const fadeInDuration = 1000;
    const stepInterval = 40;
    const fadeOutSteps = fadeOutDuration / stepInterval;
    const fadeInSteps = fadeInDuration / stepInterval;

    let step = 0;
    const startOldVol = oldAudio ? oldAudio.volume : 0;

    bgmFadeInterval = setInterval(() => {
        step++;
        if (oldAudio && step <= fadeOutSteps) {
            const ratio = 1 - (step / fadeOutSteps);
            oldAudio.volume = Math.max(0, startOldVol * ratio);
            if (step === fadeOutSteps) {
                oldAudio.pause();
            }
        }

        if (step >= fadeOutSteps) {
            const inStep = step - fadeOutSteps;
            const target = getBgmTargetVolume(newTrack);
            const ratio = Math.min(1, inStep / fadeInSteps);
            newAudio.volume = Math.min(1, target * ratio);

            if (inStep >= fadeInSteps) {
                newAudio.volume = target;
                clearInterval(bgmFadeInterval);
                bgmFadeInterval = null;
            }
        }
    }, stepInterval);
}

function stopBgmGameOver() {
    if (bgmFadeInterval) {
        clearInterval(bgmFadeInterval);
        bgmFadeInterval = null;
    }
    if (!currentBgmAudio) return;

    const audioToStop = currentBgmAudio;
    const initialVol = audioToStop.volume;
    const duration = 1000;
    const stepInterval = 40;
    const totalSteps = duration / stepInterval;
    let step = 0;

    bgmFadeInterval = setInterval(() => {
        step++;
        const ratio = 1 - (step / totalSteps);
        audioToStop.volume = Math.max(0, initialVol * ratio);
        if (step >= totalSteps) {
            audioToStop.pause();
            audioToStop.volume = 0;
            clearInterval(bgmFadeInterval);
            bgmFadeInterval = null;
            if (currentBgmAudio === audioToStop) {
                currentBgmAudio = null;
                currentBgmTrack = null;
            }
        }
    }, stepInterval);
}

function stopBgmImmediately() {
    if (bgmFadeInterval) {
        clearInterval(bgmFadeInterval);
        bgmFadeInterval = null;
    }
    if (currentBgmAudio) {
        currentBgmAudio.pause();
        currentBgmAudio = null;
    }
    currentBgmTrack = null;
    const notification = document.getElementById('bgm-notification');
    if (notification) notification.classList.remove('is-playing');
}

function toggleLang() {clang = clang===0 ? 1 : 0; updateTexts(); localStorage.setItem('Lmr_lang', clang)}

function updateTexts() {
    const ja = clang===1;
    document.getElementById("flag-mode-text").textContent = ja ? isFlagModeMobile ? "旗" : "掘削" : isFlagModeMobile ? "Mode : Flag" : "Mode : Dig";
    document.getElementById("restart-btn").textContent = ja ? "最初から" : "Restart";
    document.getElementById("final-speed-label").textContent = ja ? "速度" : "SPEED";
    document.getElementById("modal-title").textContent = ja ? "死んだンゴ" : "You died!";
    document.getElementById("modal-desc").textContent = ja ? "うお" : "Oof";
    document.getElementById("retry-btn").textContent = ja ? "再試行" : "Try again";
    document.getElementById("lang-btn").textContent = ja ? "Ja" : "En";
    document.getElementById("footer-text").innerHTML = ja ? 
        `左クリック、掘削モード中のタップ : 掘る / 右クリック、旗モード中のタップ : 旗 / 前方5メートルの45/65マスを掘削して前に進もう<br>
        クレジット : 効果音 by 効果音ラボ (<a href="https://soundeffect-lab.info">https://soundeffect-lab.info</a>)` : 
        `Left-click, Dig-mode->Tap : dig / Right-click, Flag-mode->Tap : Flag / Clear 45/65 cells in front 5m to advance!<br>
        Credits: Sound effects by 効果音ラボ (<a href="https://soundeffect-lab.info">https://soundeffect-lab.info</a>)`
}

window.onload = () => {
    initVolume();
    resetGame();
};

function initVolume() {
    const savedVol = localStorage.getItem('Lmr_seVol');
    if (savedVol !== null) {
        const parsed = parseInt(savedVol, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
            seVolume = parsed;
        }
    }
    const seSlider = document.getElementById('se-volume');
    const seText = document.getElementById('volume-text');
    if (seSlider) seSlider.value = seVolume;
    if (seText) seText.innerText = `${seVolume}%`;

    const savedBgmVol = localStorage.getItem('Lmr_bgmVol');
    if (savedBgmVol !== null) {
        const parsedBgm = parseInt(savedBgmVol, 10);
        if (!isNaN(parsedBgm) && parsedBgm >= 0 && parsedBgm <= 100) {
            bgmVolume = parsedBgm;
        }
    }
    const bgmSlider = document.getElementById('bgm-volume');
    const bgmText = document.getElementById('bgm-volume-text');
    if (bgmSlider) bgmSlider.value = bgmVolume;
    if (bgmText) bgmText.innerText = `${bgmVolume}%`;
}

function updateVolume(val) {
    seVolume = parseInt(val, 10);
    localStorage.setItem('Lmr_seVol', seVolume);
    const text = document.getElementById('volume-text');
    if (text) text.innerText = `${seVolume}%`;
}

function updateBgmVolume(val) {
    bgmVolume = parseInt(val, 10);
    localStorage.setItem('Lmr_bgmVol', bgmVolume);
    const text = document.getElementById('bgm-volume-text');
    if (text) text.innerText = `${bgmVolume}%`;
    if (currentBgmAudio && !bgmFadeInterval) {
        currentBgmAudio.volume = getBgmTargetVolume(currentBgmTrack);
    }
}

function playMineSe() {
    const audio = new Audio("sebgm/lm.mp3");
    audio.volume = 0.6 * seVolume / 100;
    audio.play();
}

function resetGame() {
    stopBgmImmediately();
    clearInterval(timerInterval);
    timerInterval = null;
    timerSeconds = 0;
    clicksCount = 0;
    distance = 0;
    moveSpeed = 0;
    maxGeneratedCol = 0;
    boardMap.clear();
    isFirstClick = true;
    isGameOver = false;
    isSliding = false;

    const boardEl = document.getElementById('board');
    if (boardEl) {
        boardEl.classList.remove('is-sliding');
        boardEl.style.transform = 'translateX(0)';
        boardEl.style.transition = 'none';
    }

    // Generate initial 100m (columns 0..99)
    generateColumns(0, INITIAL_GEN_LEN);

    updateStatsDisplay();
    renderBoard();
}

function getCell(r, c) {
    return boardMap.get(`${r},${c}`);
}

function generateColumns(startC, count) {
    const endC = startC + count;
    for (let c = startC; c < endC; c++) {
        for (let r = 0; r < ROWS; r++) {
            boardMap.set(`${r},${c}`, {
                r, c,
                isMine: false,
                isOpen: false,
                isFlagged: false,
                neighborMines: 0,
                justOpened: false,
                justExploded: false
            });
        }
    }
    maxGeneratedCol = Math.max(maxGeneratedCol, endC);

    if (!isFirstClick) {
        placeMinesInChunk(startC, endC);
        recalculateNeighborMines(startC - 1, endC + 1);
    }
}

function placeMinesInChunk(startC, endC, safeR = -1, safeC = -1) {
    if (startC >= endC) return;

    let curStart = startC;
    while (curStart < endC) {
        const isDz = isDzPos(curStart);
        let curEnd = curStart + 1;
        while (curEnd < endC && isDzPos(curEnd) === isDz) {
            curEnd++;
        }
        placeMinesInRange(curStart, curEnd, isDz, safeR, safeC);
        curStart = curEnd;
    }
}

function placeMinesInRange(rangeStartC, rangeEndC, isDz, safeR = -1, safeC = -1) {
    const totalCells = ROWS * (rangeEndC - rangeStartC);
    const ratio = isDz
        ? Math.min(MINE_RATIO_MAX, MINE_RATIO * DZ_MINE_RATIO_MULT)
        : MINE_RATIO;
    let minesToPlace = Math.floor(totalCells * ratio);
    let placed = 0;
    let attempts = 0;

    while (placed < minesToPlace && attempts < 10000) {
        attempts++;
        const r = Math.floor(Math.random() * ROWS);
        const c = rangeStartC + Math.floor(Math.random() * (rangeEndC - rangeStartC));

        const cell = getCell(r, c);
        if (!cell || cell.isMine) continue;

        // Safe Zone for initial click
        if (safeR >= 0 && safeC >= 0) {
            if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
        }

        cell.isMine = true;
        placed++;
    }
}

function recalculateNeighborMines(startC, endC) {
    for (let c = Math.max(0, startC); c < endC; c++) {
        for (let r = 0; r < ROWS; r++) {
            const cell = getCell(r, c);
            if (cell && !cell.isMine) {
                cell.neighborMines = countNeighbors(r, c);
            }
        }
    }
}

function countNeighbors(r, c) {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const neighbor = getCell(r + dr, c + dc);
            if (neighbor && neighbor.isMine) count++;
        }
    }
    return count;
}

function getStartCol() {
    return distance <= 8 ? 0 : distance - 8;
}

function renderBoard() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';

    const startCol = getStartCol();
    const endCol = startCol + VIEW_COLS;

    // Count opened cells in current evaluation zone [distance .. distance + 4]
    let currentCheckOpened = 0;
    for (let c = distance; c <= distance + 4; c++) {
        for (let r = 0; r < ROWS; r++) {
            const cell = getCell(r, c);
            if (cell && cell.isOpen) currentCheckOpened++;
        }
    }

    for (let r = 0; r < ROWS; r++) {
        for (let c = startCol; c < endCol; c++) {
            const cell = getCell(r, c);
            const cellBtn = document.createElement('button');
            cellBtn.id = `cell-${r}-${c}`;
            
            let classList = 'cell-btn cell-unopened';
            if (isDzPos(c)) {
                classList += ' dz';
            }

            // Frontline indicator (left vertical continuous line)
            if (c === distance) {
                const lineIndicator = document.createElement('span');
                lineIndicator.className = 'line-marker frontline-marker';
                cellBtn.appendChild(lineIndicator);
            }
            // Checkline indicator (right vertical continuous line)
            if (c === distance + 4) {
                const lineIndicator = document.createElement('span');
                lineIndicator.className = 'line-marker checkline-marker';
                cellBtn.appendChild(lineIndicator);
            }

            cellBtn.className = classList;

            // Badges on top row (r === 0)
            if (r === 0) {
                if (c === distance) {
                    const badge = document.createElement('span');
                    badge.className = 'line-badge badge-frontline';
                    badge.innerText = `${distance}m`;
                    cellBtn.appendChild(badge);
                }
                if (c === distance + 4) {
                    const badge = document.createElement('span');
                    badge.className = 'line-badge badge-checkline';
                    badge.innerText = `${currentCheckOpened}/65`;
                    cellBtn.appendChild(badge);
                }
            }

            if (cell) {
                updateCellUIElement(cellBtn, cell);
            } else {
                cellBtn.classList.replace('cell-unopened', 'cell-opened');
            }

            cellBtn.addEventListener('click', () => handleCellClick(r, c));
            cellBtn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                handleRightClick(r, c);
            });

            boardEl.appendChild(cellBtn);
        }
    }
}

function updateCellUIElement(cellBtn, cell) {
    if (cell.isOpen) {
        cellBtn.classList.replace('cell-unopened', 'cell-opened');
        if (cell.justOpened) {
            cellBtn.classList.add('cell-just-opened');
            cell.justOpened = false;
        }
        if (cell.justExploded) {
            cellBtn.classList.add('cell-just-exploded');
            cell.justExploded = false;
        }
        if (cell.isMine) {
            cellBtn.innerHTML += '<i class="fa-solid fa-bomb bomb-icon"></i>';
        } else if (cell.neighborMines > 0) {
            cellBtn.innerHTML += `<span class="num-${cell.neighborMines}">${cell.neighborMines}</span>`;
        }
    } else if (cell.isFlagged) {
        cellBtn.innerHTML += '<i class="fa-solid fa-flag flag-icon"></i>';
    }
}

async function handleCellClick(r, c) {
    if (isGameOver || isSliding) return;

    const cell = getCell(r, c);
    if (!cell) return;

    if (isFlagModeMobile && !cell.isOpen) {
        handleRightClick(r, c);
        return;
    }

    if (cell.isFlagged) return;

    incrementClick();

    if (isFirstClick) {
        isFirstClick = false;
        startTimer();
        startOrUpdateBgm();
        placeMinesInChunk(0, maxGeneratedCol, r, c);
        recalculateNeighborMines(0, maxGeneratedCol);
    }

    if (cell.isOpen) {
        await handleChordAction(r, c);
        return;
    }

    if (cell.isMine) {
        triggerGameOver(cell);
        return;
    }

    openCell(r, c);
    renderBoard();
    await checkAdvanceAnimated();
}

function handleRightClick(r, c) {
    if (isGameOver || isSliding) return;
    const cell = getCell(r, c);
    if (!cell || cell.isOpen) return;

    if (!isFirstClick) {
        incrementClick();
    }

    cell.isFlagged = !cell.isFlagged;
    updateStatsDisplay();
    renderBoard();
}

function openCell(r, c) {
    if (r < 0 || r >= ROWS) return;
    const cell = getCell(r, c);
    if (!cell || cell.isOpen || cell.isFlagged) return;

    cell.isOpen = true;
    cell.justOpened = true;

    // Recursive flood fill if 0 neighbor mines
    if (cell.neighborMines === 0 && !cell.isMine) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr !== 0 || dc !== 0) {
                    openCell(r + dr, c + dc);
                }
            }
        }
    }
}

async function handleChordAction(r, c) {
    const cell = getCell(r, c);
    if (!cell || !cell.isOpen || cell.neighborMines === 0) return;

    let flagCount = 0;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const neighbor = getCell(r + dr, c + dc);
            if (neighbor && neighbor.isFlagged) flagCount++;
        }
    }

    if (flagCount === cell.neighborMines) {
        let hitMine = false;
        let explodedCell = null;

        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const neighbor = getCell(r + dr, c + dc);
                if (neighbor && !neighbor.isOpen && !neighbor.isFlagged) {
                    if (neighbor.isMine) {
                        hitMine = true;
                        explodedCell = neighbor;
                    } else {
                        openCell(r + dr, c + dc);
                    }
                }
            }
        }

        renderBoard();

        if (hitMine) {
            triggerGameOver(explodedCell);
            return;
        }

        await checkAdvanceAnimated();
    }
}

function canAdvanceNext() {
    if (distance + 5 > maxGeneratedCol) {
        generateColumns(maxGeneratedCol, CHUNK_GEN_LEN);
    }

    let openedCount = 0;
    let safeCellCount = 0;
    let openedSafeCount = 0;

    for (let c = distance; c <= distance + 4; c++) {
        for (let r = 0; r < ROWS; r++) {
            const cell = getCell(r, c);
            if (!cell) continue;
            if (cell.isOpen) openedCount++;
            if (!cell.isMine) {
                safeCellCount++;
                if (cell.isOpen) openedSafeCount++;
            }
        }
    }

    return openedCount >= 45 || (openedSafeCount === safeCellCount);
}

async function checkAdvanceAnimated() {
    if (!canAdvanceNext()) return;

    isSliding = true;
    const boardEl = document.getElementById('board');
    if (boardEl) boardEl.classList.add('is-sliding');

    while (canAdvanceNext()) {
        await animateSlideStep();

        distance++;
        startOrUpdateBgm();

        if (distance + 50 > maxGeneratedCol) {
            generateColumns(maxGeneratedCol, CHUNK_GEN_LEN);
        }

        cleanupOldColumns(distance - 12);
        updateStatsDisplay();
        renderBoard();
    }

    if (boardEl) boardEl.classList.remove('is-sliding');
    isSliding = false;
}

function animateSlideStep() {
    return new Promise((resolve) => {
        const boardEl = document.getElementById('board');
        if (!boardEl) {
            resolve();
            return;
        }

        // Calculate step width for 1 cell (32px width + 4px gap = 36px)
        const stepPx = 36;

        if (distance >= 8) {
            boardEl.style.transition = 'transform 0.1s linear';
            boardEl.style.transform = `translateX(-${stepPx}px)`;
            setTimeout(() => {boardEl.style.transition = 'none'; boardEl.style.transform = 'translateX(0)'; resolve();}, 1000/progressSpeed);
        } else {
            setTimeout(() => {resolve();}, 1000/progressSpeed);
        }
    });
}

function cleanupOldColumns(cutoffCol) {
    for (let [key, cell] of boardMap.entries()) {
        if (cell.c < cutoffCol) {
            boardMap.delete(key);
        }
    }
}

function incrementClick() {
    clicksCount++;
    updateStatsDisplay();
}

function updateStatsDisplay() {
    document.getElementById('distance-count').innerHTML = `<i class="stat-icon fa-solid fa-person-walking text-emerald-400"></i> ${distance}m`;
    document.getElementById('clicks-count').innerHTML = `<i class="stat-icon fa-solid fa-arrow-pointer text-amber-400"></i> ${clicksCount}`;
    document.getElementById('timer').innerHTML = `<i class="stat-icon fa-regular fa-clock text-cyan-400"></i> ${formatTime(timerSeconds)}`;
    document.getElementById('move-speed').innerHTML = `<i class="stat-icon fa-solid fa-gauge-high text-rose-400"></i> ${formatMoveSpeed()}`;
}

function formatMoveSpeed() {
    moveSpeed = timerSeconds > 0 ? distance * 3.6 / timerSeconds : 0;
    return moveSpeed>1 ? `${moveSpeed.toFixed(2)} km/h` : `${(moveSpeed*1e3).toFixed(1)} m/h`
}

function formatTime(seconds) {
    if (seconds>36000) return `${Math.floor(seconds / 3600)}h${String(Math.floor((seconds/60) % 60)).padStart(2, '0')}m`
    if (seconds>600) return `${Math.floor(seconds / 60)}m${String(Math.floor(seconds % 60)).padStart(2, '0')}s`
    if (seconds>10) return `${Math.floor(seconds)}.${String(Math.floor((seconds * 100)%100)).padStart(2, '0')}s`
    return `${Math.floor(seconds*1000)}ms`

}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    lastUpdTime = Date.now();
    timerInterval = setInterval(() => {
        const nowTime = Date.now();
        timerSeconds += (nowTime - lastUpdTime) / 1000;
        lastUpdTime = nowTime;
        updateStatsDisplay();
    }, 1000 / 60);
}

function toggleFlagMode() {
    if (isSliding) return;
    isFlagModeMobile = !isFlagModeMobile;
    const btn = document.getElementById('mobile-flag-btn');
    const text = document.getElementById('flag-mode-text');
    if (isFlagModeMobile) {
        btn.classList.add('flag-active');
    } else {
        btn.classList.remove('flag-active');
    }
    document.getElementById("flag-mode-text").textContent = clang===1 ? isFlagModeMobile ? "旗" : "掘削" : isFlagModeMobile ? "Mode : Flag" : "Mode : Dig";
}

function triggerGameOver(explodedCell) {
    playMineSe();
    stopBgmGameOver();
    isGameOver = true;
    clearInterval(timerInterval);
    updateStatsDisplay();
    score = Math.round(moveSpeed*distance);

    if (explodedCell) {
        explodedCell.justExploded = true;
    }

    // Reveal visible mines & wrong flags
    const startCol = getStartCol();
    const endCol = startCol + VIEW_COLS;

    for (let r = 0; r < ROWS; r++) {
        for (let c = startCol; c < endCol; c++) {
            const cell = getCell(r, c);
            const cellBtn = document.getElementById(`cell-${r}-${c}`);
            if (!cell || !cellBtn) continue;
            if (cell.isMine) {
                cell.isOpen = true;
                if (cell === explodedCell) {
                    cellBtn.classList.add('cell-exploded');
                }
            } else if (cell.isFlagged && !cell.isMine) {
                cellBtn.innerHTML = '<i class="fa-solid fa-xmark wrong-flag-icon"></i>';
            }
        }
    }
    renderBoard();
    setTimeout(()=>{showModal();}, 300);
}

function showModal() {
    const modal = document.getElementById('modal');
    const modalCard = document.getElementById('modal-card');

    document.getElementById('final-distance').innerText = `${distance}m`;
    document.getElementById('final-speed').innerText = String(formatMoveSpeed());
    document.getElementById('final-score').innerText = String(score);

    modal.classList.add('visible');
    setTimeout(() => {
        modal.classList.add('show');
        modalCard.classList.add('show');
    }, 10);
}

function closeModalAndReset() {
    const modal = document.getElementById('modal');
    const modalCard = document.getElementById('modal-card');

    modal.classList.remove('show');
    modalCard.classList.remove('show');

    setTimeout(() => {
        modal.classList.remove('visible');
        resetGame();
    }, 300);
}

updateTexts()
