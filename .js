// Infinite Road Minesweeper Logic
const ROWS = 13;
const VIEW_COLS = 33;
const MINE_RATIO = 0.08;
const INITIAL_GEN_LEN = 100;
const CHUNK_GEN_LEN = 50;

let distance = 0; // Current frontline column index (0-indexed meters)
let maxGeneratedCol = 0;
let boardMap = new Map(); // Key: `${r},${c}` -> cell object
let isFirstClick = true;
let isGameOver = false;
let isSliding = false; // Lock flag during 0.1s/m slide animation
let clicksCount = 0;
let timerSeconds = 0;
let timerInterval = null;
let lastUpdTime = 0;
let isFlagModeMobile = false;
let seVolume = 60;

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
    const slider = document.getElementById('se-volume');
    const text = document.getElementById('volume-text');
    if (slider) slider.value = seVolume;
    if (text) text.innerText = `${seVolume}%`;
}

function updateVolume(val) {
    seVolume = parseInt(val, 10);
    localStorage.setItem('Lmr_seVol', seVolume);
    const text = document.getElementById('volume-text');
    if (text) text.innerText = `${seVolume}%`;
}

function playMineSe() {
    const audio = new Audio("sebgm/lm.mp3");
    audio.volume = 0.6 * seVolume / 100;
    audio.play();
}

function resetGame() {
    clearInterval(timerInterval);
    timerInterval = null;
    timerSeconds = 0;
    clicksCount = 0;
    distance = 0;
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
    const totalCellsInChunk = ROWS * (endC - startC);
    let minesToPlace = Math.floor(totalCellsInChunk * MINE_RATIO);
    let placed = 0;
    let attempts = 0;

    while (placed < minesToPlace && attempts < 10000) {
        attempts++;
        const r = Math.floor(Math.random() * ROWS);
        const c = startC + Math.floor(Math.random() * (endC - startC));

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

            // Frontline green line (left border of distance col)
            if (c === distance) {
                classList += ' cell-frontline';
            }
            // Checkline yellow line (right border of distance+4 col)
            if (c === distance + 4) {
                classList += ' cell-checkline';
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

    return openedCount >= 45 || (safeCellCount > 0 && openedSafeCount === safeCellCount);
}

async function checkAdvanceAnimated() {
    if (!canAdvanceNext()) return;

    isSliding = true;
    const boardEl = document.getElementById('board');
    if (boardEl) boardEl.classList.add('is-sliding');

    while (canAdvanceNext()) {
        await animateSlideStep();

        distance++;

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

            setTimeout(() => {
                boardEl.style.transition = 'none';
                boardEl.style.transform = 'translateX(0)';
                resolve();
            }, 100);
        } else {
            // Under 8m, wait 0.1s to lock input smoothly while advancing
            setTimeout(() => {
                resolve();
            }, 100);
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
    document.getElementById('distance-count').innerText = `${distance}m`;
    document.getElementById('clicks-count').innerText = String(clicksCount).padStart(3, '0');
    document.getElementById('timer').innerText = formatTime(timerSeconds);
}

function formatTime(seconds) {
    if (seconds>600) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds-hours*3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(hours)}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const deci = Math.floor((seconds * 100) % 100);
    return `${String(minutes)}:${String(secs).padStart(2, '0')}.${String(deci).padStart(2, '0')}`;
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
        text.innerText = 'Mode: Flag';
    } else {
        btn.classList.remove('flag-active');
        text.innerText = 'Mode: Dig';
    }
}

function triggerGameOver(explodedCell) {
    playMineSe();
    isGameOver = true;
    clearInterval(timerInterval);

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
    document.getElementById('final-clicks').innerText = clicksCount;

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