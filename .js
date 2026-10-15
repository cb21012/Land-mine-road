//Const
const ROWS = 13, VIEW_COLS = 33, INITIAL_GEN_LEN = 150, CHUNK_GEN_LEN = 50, AREA_LENGTH = 1600, CHECKPOINT_FREQ = 200;
const DZ_START_POS = 1500, DZ_END_POS = 1599, DZ_MINE_RATIO_MULT = 1.3;

MINE_RATIO_MAX = 0.24;
const DISTRICT_MINE_RATIO = [.05, .07, .085, .1, .113, .125, .132, .138, .144, .15, .156, .162, .167, .172, .176, .18, .184, .188, .191, .194, .197, .2];
const DISTRICT_MINE_DMG   = [64, 72, 80, 88, 96, 104, 112, 120, 128, 144, 160, 176, 192, 208, 224, 240, 256, 288, 320, 352, 384, 416, 448, 480, 512, 640, 768, 896, 1024];

//Map
let maxGeneratedCol = 0;
let boardMap = new Map(); // Key: `${r},${c}` -> cell object
const progressSpeed = 30;

//Bools
let isFirstClick = true, isGameOver = false, isSliding = false, isFlagModeMobile = false;

//Game
let distance = 0, district = 1, mineRate = DISTRICT_MINE_RATIO[0], lmDmg = DISTRICT_MINE_DMG[0], clicksCount = 0, timerSeconds = 0;
let moveSpeed = 0, score = 0, timerInterval = null, lastUpdTime = 0;
let passedCheckpointCount = 0, selectedStartCheckpoint = 0, selectedStartDistrict = 1;
let startDistance = 0; // ゲーム開始時のdistance（スタート位置）

//player
let level = Number(localStorage.getItem('Lmr_level') ?? 0), xp = Number(localStorage.getItem('Lmr_xp') ?? 0);
let nextXp = 0;
let isScoreCommitted = false;
let lastGainedXp = 0;
let lastLevelUpCount = 0;

function updatePlayerStats() {
    getPlayerNextXp();
    mhp = Math.floor(0.01*level**2 + level + 90);
    regen = Number((level*0.02 + 1).toFixed(2));
}

let mhp = 90, hp = 90, regen = 1.00;
updatePlayerStats();
hp = mhp;

//Config
let seVolume = 60, bgmVolume = 60, clang = (localStorage.getItem('Lmr_lang') ?? 0);

// BGM Audio Controller
let currentBgmAudio = null;
let currentBgmTrack = null; // 'bgm1' or 'bgm_dz'
let bgmFadeInterval = null;

function notatVal(val) {
    if (val<1e7) return val;
    const len = Math.floor(Math.log10(val) / 3);
    const sufi = ["", "", "M", "B", "T", "Qa", "Qi", "Sx", "Sp"][len];
    if (sufi == undefined) return (val / (1e3 ** len)).toFixed(2) + "e" + (len * 3);
    return (val / (1e3 ** len)).toFixed(2) + sufi;
}

function getPlayerNextXp() {
    nextXp = Math.ceil(1e-4*level**3 + 0.25*level**2 + level*16 + 48);
}

function commitScoreAsXp() {
    if (isScoreCommitted) return { gainedXp: 0, leveledUp: false, startLevel: level, endLevel: level };

    const gainedXp = Math.round(score);
    const startLevel = level;
    let leveledUp = false;

    if (gainedXp > 0) {
        xp += gainedXp;
        while (xp >= nextXp) {
            xp -= nextXp;
            level++;
            getPlayerNextXp();
            leveledUp = true;
        }
        updatePlayerStats();
        localStorage.setItem('Lmr_level', String(level));
        localStorage.setItem('Lmr_xp', String(xp));
    }

    isScoreCommitted = true;
    lastGainedXp = gainedXp;
    lastLevelUpCount = level - startLevel;

    updatePlayerDisplay();

    return {
        gainedXp,
        leveledUp,
        startLevel,
        endLevel: level
    };
}

function showLevelUpNotification(newLevel) {
    const notification = document.getElementById('levelup-notification');
    if (!notification) return;
    const ja = clang === 1;
    notification.textContent = ja ? `★ レベルアップ！ Lv.${newLevel}` : `★ LEVEL UP! Lv.${newLevel}`;
    notification.classList.remove('is-showing');
    void notification.offsetWidth;
    notification.classList.add('is-showing');
}

function updatePlayerDisplay() {
    const levelEl = document.getElementById('level-value');
    const xpValueEl = document.getElementById('xp-value');
    const xpBarEl = document.getElementById('xp-bar');
    const regenValueEl = document.getElementById('regen-value');

    if (levelEl) levelEl.textContent = String(level);
    if (xpValueEl) xpValueEl.textContent = `${notatVal(Math.floor(xp))} / ${notatVal(nextXp)} XP`;
    if (xpBarEl) {
        const pct = nextXp > 0 ? Math.min(100, Math.max(0, (xp / nextXp) * 100)) : 0;
        xpBarEl.style.width = `${pct}%`;
    }
    if (regenValueEl) regenValueEl.textContent = `(+${regen.toFixed(2)}/m)`;
}

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

function getDistrictValueAtDistance(values, pos) {
    const districtIndex = Math.floor(pos / AREA_LENGTH);
    const lastDistrictIndex = values.length - 1;
    const startValue = values[districtIndex] ?? values[lastDistrictIndex];
    const endValue = values[districtIndex + 1] ?? startValue;
    const distanceInDistrict = Math.floor((pos - districtIndex * AREA_LENGTH) / CHECKPOINT_FREQ) * CHECKPOINT_FREQ;
    return startValue + (endValue - startValue) * (distanceInDistrict / AREA_LENGTH);
}

function getMineRateAtDistance(pos) {
    return getDistrictValueAtDistance(DISTRICT_MINE_RATIO, pos);
}

function updateMineRate() {
    mineRate = getMineRateAtDistance(distance);
    lmDmg = getDistrictValueAtDistance(DISTRICT_MINE_DMG, distance);
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
    document.getElementById("district-label").textContent = ja ? "地区" : "District";
    document.getElementById("mine-rate-label").textContent = ja ? "地雷率" : "Mine rate";
    document.getElementById("start-district-label").textContent = ja ? "地区" : "District";
    document.getElementById("start-checkpoint-label").textContent = ja ? "距離" : "Distance";
    document.querySelectorAll("#start-district option").forEach((option) => {
        option.textContent = `${ja ? "地区" : "District"} ${option.value}`;
    });
    const finalScoreLabel = document.getElementById("final-score-label");
    if (finalScoreLabel) finalScoreLabel.textContent = ja ? "スコア" : "SCORE";
    const finalDistLabel = document.getElementById("final-distance-label");
    if (finalDistLabel) finalDistLabel.textContent = ja ? "距離" : "DISTANCE";
    const modalLevelLabel = document.getElementById("modal-level-label");
    if (modalLevelLabel) modalLevelLabel.innerHTML = `${ja ? "レベル" : "LEVEL"} <span id="modal-level-val">${level}</span>`;
    const levelLabel = document.getElementById("level-label");
    if (levelLabel) levelLabel.textContent = ja ? "Lv" : "LV";
    document.getElementById("final-speed-label").textContent = ja ? "速度" : "SPEED";
    document.getElementById("modal-title").textContent = ja ? "死んだンゴ" : "You died!";
    document.getElementById("modal-desc").textContent = ja ? "うお" : "Oof";
    document.getElementById("retry-btn").textContent = ja ? "再試行" : "Try again";
    document.getElementById("lang-btn").textContent = ja ? "Ja" : "En";
    document.getElementById("footer-text").innerHTML = ja ? 
        `左クリック、掘削モード中のタップ : 掘る / 右クリック、旗モード中のタップ : 旗 / 前方5メートルの45/65マスを掘削して前に進もう<br>
        クレジット : 効果音 by 効果音ラボ (<a href="https://soundeffect-lab.info">https://soundeffect-lab.info</a>)` : 
        `Left-click, Dig-mode->Tap : dig / Right-click, Flag-mode->Tap : Flag / Clear 45/65 cells in front 5m to advance!<br>
        Credits: Sound effects by 効果音ラボ (<a href="https://soundeffect-lab.info">https://soundeffect-lab.info</a>)`;
    updatePlayerDisplay();
}

window.onload = () => {
    initVolume();
    updateTexts();
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
    if (!isScoreCommitted && score > 0) {
        const result = commitScoreAsXp();
        if (result.leveledUp) {
            showLevelUpNotification(result.endLevel);
        }
    }
    isScoreCommitted = false;
    lastGainedXp = 0;
    lastLevelUpCount = 0;

    stopBgmImmediately();
    clearInterval(timerInterval);
    timerInterval = null;
    timerSeconds = 0;
    clicksCount = 0;
    score = 0;
    updatePlayerStats();
    hp = mhp;
    const savedCheckpointCount = Number.parseInt(localStorage.getItem('Lmr_passedCP') ?? '0', 10);
    passedCheckpointCount = Number.isInteger(savedCheckpointCount) && savedCheckpointCount >= 0
        ? savedCheckpointCount
        : 0;
    selectedStartDistrict = Math.min(selectedStartDistrict, getMaxUnlockedDistrict());
    const firstCheckpoint = getDistrictFirstCheckpoint(selectedStartDistrict);
    const lastCheckpoint = getDistrictLastCheckpoint(selectedStartDistrict);
    selectedStartCheckpoint = Math.max(firstCheckpoint, Math.min(selectedStartCheckpoint, lastCheckpoint));
    distance = selectedStartCheckpoint * CHECKPOINT_FREQ;
    startDistance = distance; // スタート位置を記録
    updateMineRate();
    moveSpeed = 0;
    maxGeneratedCol = 0;
    boardMap.clear();
    isFirstClick = true;
    isGameOver = false;
    isSliding = false;

    const startCheckpointSelect = document.getElementById('start-checkpoint');
    const startDistrictSelect = document.getElementById('start-district');
    const startCheckpointControl = document.getElementById('start-checkpoint-control');
    if (startCheckpointControl) startCheckpointControl.hidden = false;
    if (startDistrictSelect) {
        startDistrictSelect.replaceChildren();
        for (let unlockedDistrict = 1; unlockedDistrict <= getMaxUnlockedDistrict(); unlockedDistrict++) {
            const option = document.createElement('option');
            option.value = String(unlockedDistrict);
            option.textContent = `${clang === 1 ? '地区' : 'District'} ${unlockedDistrict}`;
            startDistrictSelect.appendChild(option);
        }
        startDistrictSelect.value = String(selectedStartDistrict);
        startDistrictSelect.disabled = false;
    }
    if (startCheckpointSelect) {
        populateStartCheckpointOptions(startCheckpointSelect);
        startCheckpointSelect.value = String(selectedStartCheckpoint);
        startCheckpointSelect.disabled = false;
    }

    const boardEl = document.getElementById('board');
    if (boardEl) {
        boardEl.classList.remove('is-sliding');
        boardEl.style.transform = 'translateX(0)';
        boardEl.style.transition = 'none';
    }

    const generatedStartCol = getStartCol();
    generateColumns(generatedStartCol, INITIAL_GEN_LEN + distance - generatedStartCol);
    updateStatsDisplay();
    updatePlayerDisplay();
    renderBoard();
}

function getMaxUnlockedDistrict() {
    return Math.floor((passedCheckpointCount * CHECKPOINT_FREQ) / AREA_LENGTH) + 1;
}

function getDistrictFirstCheckpoint(districtNumber) {
    return Math.floor(((districtNumber - 1) * AREA_LENGTH) / CHECKPOINT_FREQ);
}

function getDistrictLastCheckpoint(districtNumber) {
    const lastDistanceInDistrict = districtNumber * AREA_LENGTH - CHECKPOINT_FREQ;
    return Math.min(Math.floor(lastDistanceInDistrict / CHECKPOINT_FREQ), passedCheckpointCount);
}

function populateStartCheckpointOptions(select) {
    select.replaceChildren();
    const firstCheckpoint = getDistrictFirstCheckpoint(selectedStartDistrict);
    const lastCheckpoint = getDistrictLastCheckpoint(selectedStartDistrict);
    for (let checkpoint = firstCheckpoint; checkpoint <= lastCheckpoint; checkpoint++) {
        const option = document.createElement('option');
        option.value = String(checkpoint);
        option.textContent = `${checkpoint * CHECKPOINT_FREQ}m`;
        select.appendChild(option);
    }
}

function changeStartDistrict(value) {
    if (!isFirstClick || isGameOver || isSliding) return;
    const newDistrict = Number.parseInt(value, 10);
    if (!Number.isInteger(newDistrict) || newDistrict < 1 || newDistrict > getMaxUnlockedDistrict()) return;
    selectedStartDistrict = newDistrict;
    selectedStartCheckpoint = getDistrictFirstCheckpoint(newDistrict);
    resetGame();
}

function changeStartCheckpoint(value) {
    if (!isFirstClick || isGameOver || isSliding) return;
    const checkpoint = Number.parseInt(value, 10);
    if (!Number.isInteger(checkpoint)
        || checkpoint < getDistrictFirstCheckpoint(selectedStartDistrict)
        || checkpoint > getDistrictLastCheckpoint(selectedStartDistrict)) return;
    selectedStartCheckpoint = checkpoint;
    resetGame();
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
    for (let c = rangeStartC; c < rangeEndC; c++) {
        const columnMineRate = getMineRateAtDistance(c);
        const ratio = isDz
            ? Math.min(MINE_RATIO_MAX, columnMineRate * DZ_MINE_RATIO_MULT)
            : columnMineRate;

        for (let r = 0; r < ROWS; r++) {
            const cell = getCell(r, c);
            if (!cell || cell.isMine) continue;

            if (safeR >= 0 && safeC >= 0
                && Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;

            if (Math.random() < ratio) {
                cell.isMine = true;
            }
        }
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
            if (c > 0 && c % CHECKPOINT_FREQ === 0) {
                const checkpointMarker = document.createElement('span');
                checkpointMarker.className = 'line-marker checkpoint-marker';
                cellBtn.appendChild(checkpointMarker);
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
                if (c > 0 && c % CHECKPOINT_FREQ === 0) {
                    const badge = document.createElement('span');
                    badge.className = 'line-badge badge-checkpoint';
                    badge.innerText = `${c}m`;
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
        document.getElementById('start-checkpoint-control').hidden = true;
        document.getElementById('start-checkpoint').disabled = true;
        document.getElementById('start-district').disabled = true;
        startTimer();
        startOrUpdateBgm();
        const generatedStartCol = getStartCol();
        placeMinesInChunk(generatedStartCol, maxGeneratedCol, r, c);
        recalculateNeighborMines(generatedStartCol, maxGeneratedCol);
    }

    if (cell.isOpen) {
        await handleChordAction(r, c);
        return;
    }

    if (cell.isOpen) {
        if (!cell.isMine) await handleChordAction(r, c);
        return;
    }

    if (cell.isMine) {
        damageMine(cell);
        if (!isGameOver) renderBoard();
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
    const cellDistrict = Math.floor(cell.c / AREA_LENGTH) + 1;
    score += (cellDistrict + 2) / 3;

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
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const neighbor = getCell(r + dr, c + dc);
                if (neighbor && !neighbor.isOpen && !neighbor.isFlagged) {
                    if (neighbor.isMine) {
                        damageMine(neighbor);
                        if (isGameOver) return;
                    } else {
                        openCell(r + dr, c + dc);
                    }
                }
            }
        }

        renderBoard();
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
        hp = Math.min(mhp, hp + regen);
        if (distance % CHECKPOINT_FREQ === 0) updateMineRate();
        if (distance % CHECKPOINT_FREQ === 0 && distance / CHECKPOINT_FREQ > passedCheckpointCount) {
            passedCheckpointCount = distance / CHECKPOINT_FREQ;
            selectedStartDistrict = Math.floor(distance / AREA_LENGTH) + 1;
            selectedStartCheckpoint = passedCheckpointCount;
            localStorage.setItem('Lmr_passedCP', String(passedCheckpointCount));
            const startDistrictSelect = document.getElementById('start-district');
            if (startDistrictSelect && !Array.from(startDistrictSelect.options)
                .some((option) => Number.parseInt(option.value, 10) === selectedStartDistrict)) {
                const option = document.createElement('option');
                option.value = String(selectedStartDistrict);
                option.textContent = `${clang === 1 ? '地区' : 'District'} ${selectedStartDistrict}`;
                startDistrictSelect.appendChild(option);
            }
            if (startDistrictSelect) startDistrictSelect.value = String(selectedStartDistrict);
            const startCheckpointSelect = document.getElementById('start-checkpoint');
            if (startCheckpointSelect) {
                populateStartCheckpointOptions(startCheckpointSelect);
                startCheckpointSelect.value = String(selectedStartCheckpoint);
            }
        }
        startOrUpdateBgm();

        if (distance + (INITIAL_GEN_LEN-CHUNK_GEN_LEN) > maxGeneratedCol) {
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
    district = Math.floor(distance / AREA_LENGTH) + 1;
    const traveledDistance = distance - startDistance;
    document.getElementById('distance-count').innerHTML = `<i class="stat-icon fa-solid fa-person-walking text-emerald-400"></i> ${traveledDistance}m`;
    document.getElementById('clicks-count').innerHTML = `<i class="stat-icon fa-solid fa-arrow-pointer text-amber-400"></i> ${clicksCount}`;
    document.getElementById('timer').innerHTML = `<i class="stat-icon fa-regular fa-clock text-cyan-400"></i> ${formatTime(timerSeconds)}`;
    document.getElementById('move-speed').innerHTML = `<i class="stat-icon fa-solid fa-gauge-high text-rose-400"></i> ${formatMoveSpeed()}`;
    document.getElementById('district-count').textContent = String(district);
    document.getElementById('mine-rate').textContent = `${(mineRate * 100 * (isDzPos(distance) ? DZ_MINE_RATIO_MULT : 1)).toFixed(2)}%`;
    const displayedHp = document.getElementById('hp-value');
    const hpBar = document.getElementById('hp-bar');
    const hpGauge = document.getElementById('hp-gauge');
    if (displayedHp) displayedHp.textContent = `${hp.toFixed(2)} / ${mhp}`;
    if (hpBar) hpBar.style.width = `${Math.max(0, Math.min(100, hp / mhp * 100))}%`;
    if (hpGauge) {
        hpGauge.setAttribute('aria-valuemax', String(mhp));
        hpGauge.setAttribute('aria-valuenow', String(Math.max(0, Math.min(mhp, hp))));
        hpGauge.setAttribute('aria-valuetext', `${hp.toFixed(2)} / ${mhp}`);
    }
}

function formatMoveSpeed() {
    const traveledDistance = distance - startDistance;
    moveSpeed = timerSeconds > 0 ? traveledDistance * 3.6 / timerSeconds : 0;
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

function damageMine(cell) {
    hp -= lmDmg;
    cell.isOpen = true;
    cell.justExploded = true;
    playMineSe();
    updateStatsDisplay();
    if (hp < 0) triggerGameOver(cell);
}

function triggerGameOver(explodedCell) {
    stopBgmGameOver();
    isGameOver = true;
    clearInterval(timerInterval);
    score = Math.round(score);
    commitScoreAsXp();
    updateStatsDisplay();

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

    const modalXpGain = document.getElementById('modal-xp-gain');
    if (modalXpGain) {
        modalXpGain.innerText = `+${lastGainedXp} XP`;
    }
    const modalLevelVal = document.getElementById('modal-level-val');
    if (modalLevelVal) {
        modalLevelVal.innerText = String(level);
    }
    const modalXpBar = document.getElementById('modal-xp-bar');
    if (modalXpBar) {
        const pct = nextXp > 0 ? Math.min(100, Math.max(0, (xp / nextXp) * 100)) : 0;
        modalXpBar.style.width = `${pct}%`;
    }
    const modalXpSubText = document.getElementById('modal-xp-sub-text');
    if (modalXpSubText) {
        modalXpSubText.innerText = `${notatVal(Math.floor(xp))} / ${notatVal(nextXp)} XP`;
    }
    const levelUpBadge = document.getElementById('modal-level-up-badge');
    if (levelUpBadge) {
        if (lastLevelUpCount > 0) {
            levelUpBadge.style.display = 'inline-block';
            levelUpBadge.innerText = clang === 1 
                ? (lastLevelUpCount > 1 ? `レベル+${lastLevelUpCount} UP!` : 'レベルアップ！') 
                : (lastLevelUpCount > 1 ? `LEVEL +${lastLevelUpCount} UP!` : 'LEVEL UP!');
        } else {
            levelUpBadge.style.display = 'none';
        }
    }

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

resetGame()
updateTexts()
