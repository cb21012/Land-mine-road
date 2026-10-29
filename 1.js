const $ = (id) => document.getElementById(id);

//Const
const ROWS = 13, VIEW_COLS = 33, INITIAL_GEN_LEN = 150, CHUNK_GEN_LEN = 50, AREA_LENGTH = 1600, CHECKPOINT_FREQ = 200;
const DISTRICTS_PER_SECTOR = 16;
const DZ_START_POS = 1550, DZ_END_POS = 1599, DZ_MINE_RATIO_MULT = 1.5;

MINE_RATIO_MAX = 0.24, HARD_LM_DMG = 1.79769e308;
const DISTRICT_MINE_RATIO = [
    1/16, 1/14, 1/12.5, 1/11.5, 1/11, 1/10.5, 1/10, 1/9.5, 1/9, 1/8.75,
    1/8.5, 1/8.25, 1/8, 1/7.8, 1/7.6, 1/7.4, 1/7.2, 1/7, 1/6.85, 1/6.7, 
    1/6.55, 1/6.4, 1/6.3, 1/6.2, 1/6.1, 1/6, 1/5.94, 1/5.88, 1/5.82, 1/5.76, 
    1/5.7, 1/5.65, 1/5.6, 1/5.55, 1/5.5, 1/5.45, 1/5.4, 1/5.35, 1/5.3, 1/5.25, 
    1/5.2, 1/5.15, 1/5.1, 1/5.06, 1/5.03, 1/5
];
const DISTRICT_MINE_DMG   = [128, 144, 160, 176, 192, 208, 224, 240, 256, 288, 320, 352, 384, 416, 448, 480, 512];

//Map
let maxGeneratedCol = 0;
let boardMap = new Map(); // Key: `${r},${c}` -> cell object
const progressSpeed = 15;

//Bools
let isFirstClick = true, isGameOver = false, isSliding = false, isFlagModeMobile = false;

//Game
let distance = 0, district = 1, mineRate = DISTRICT_MINE_RATIO[0], lmDmg = DISTRICT_MINE_DMG[0], clicksCount = 0, timerSeconds = 0;
let moveSpeed = 0, score = 0, timerInterval = null, lastUpdTime = 0;
let passedCheckpointCount = 0, selectedStartCheckpoint = 0, selectedStartDistrict = 1;
let startDistance = 0; // ゲーム開始時のdistance（スタート位置）
let gameRunId = 0;
let isRunStatsCommitted = false;

//player
let level = Number(localStorage.getItem('Lmr_level') ?? 0), xp = Number(localStorage.getItem('Lmr_xp') ?? 0);
let nextXp = 0;
let isScoreCommitted = false;
let lastGainedXp = 0;
let lastLevelUpCount = 0;
let mhp = 160, hp = 160, regen = 1.00;

// BGM Audio Controller
let currentBgmAudio = null;
let currentBgmTrack = null; // 'bgm1' or 'bgm_dz'
let pendingBgmTrack = null;
let bgmFadeInterval = null;
const activeBgmAudios = new Set();
let audioContext = null;
let bgmSwitchId = 0;
const audioBufferCache = new Map();
let nowPlayingUpdateInterval = null;
let nowPlayingStateKey = null;

//Config
const savedLang = localStorage.getItem('Lmr_lang');
let clang = savedLang === null ? 1 : Number(savedLang);
if (Number.isNaN(clang) || ![0, 1].includes(clang)) {
    clang = 1;
}
if (savedLang === null) {
    localStorage.setItem('Lmr_lang', String(clang));
}

const savedBackgroundMode = localStorage.getItem('Lmr_backgroundMode');
let backgroundMode = ['high', 'low', 'hidden'].includes(savedBackgroundMode)
    ? savedBackgroundMode
    : localStorage.getItem('Lmr_showBackground') === 'false' ? 'hidden' : 'low';
if (savedBackgroundMode === null) {
    localStorage.setItem('Lmr_backgroundMode', backgroundMode);
}

let seVolume = 60, bgmVolume = 60;
let isFooterTextHidden = localStorage.getItem('Lmr_footerTextHidden') === 'true';
let difficulty = localStorage.getItem('Lmr_diff') === '1' ? 1 : 0;
let isBgmFixed = localStorage.getItem('Lmr_bgmFixed') === 'true';
let fixedBgmId = Number.parseInt(localStorage.getItem('Lmr_fixedBgmId') ?? '1', 10);

/*
function generateRandomName() {
    const chars = ["H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne", "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca", "Ti", "V", "Cr", "Fe", "Ni", "Cu", "Zn", "Br", "Ag", "I", "W", "Pt", "Au", "Hg"];
    const nums = ["", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20"];
    let result = ''; const len = Math.floor(Math.random() * 4) + 1;
    for (let i = 0; i < len; i++) {
        let rand = Math.floor(Math.random() * chars.length);
        result += chars[rand]; chars.splice(rand, 1);
        result += nums[Math.floor(Math.random() * nums.length)];
    }
    return result;
}
*/

function generateRandomName() {
    const j = clang===1;
    const key1 = !j? [
            "Cynical", "Funny", "Foolish", "Ergonomic", "Introvert", "Extrovert", "Omnivert", "Original", "Replicated", "Perfect",
            "Immortal", "Epic", "Delusional", "Apeirophobic", "Random", "Suspicious", "Common", "Ancestral", "Geometric", "Cooked",
            "Distorted", "Baloney", "Binary", "Censored", "Schrödinger's", "Bad", "Heartless", "Golden", "Inexistent", "Japanese-made",
            "Lazy", "Intimidating", "Yandere", "A bucket of", "M0R1", "M6R5", "Compiled", "Clueless", "Sound-speed", "Sfw", 
            "Bugged", "Unclear", "Attic", "Vengeful", "Endangered", "Rugged", "Wild"
        ] : [
            "冷笑系", "面白い", "愚かな", "人間工学に基づいた", "内向的な", "外向的な", "両向的な", "独創的な", "複製体", "完全な",
            "不滅の", "すごい", "妄想の", "無限恐怖症の", "どこかの", "疑わしい", "ありふれた", "先祖代々の", "幾何学的な", "調理された", 
            "音割れ", "でたらめな", "バイナリ形式の", "検閲済みの", "シュレーディンガーの", "悪い", "心ない", "金の", "存在しない", "日本産の",
            "怠けた", "威圧的な", "ヤンデレな", "バケツ1杯の", "無凸餅の", "完凸", "コンパイルされた", "何も知らない", "音速の", "健全な",
            "バグった", "滑舌の悪い", "屋根裏の", "復讐心に燃える", "絶滅危惧種の", "無骨な", "野生の"
        ];
    const key2 = !j? [
            "Steve", "Alex", "Michael", "Mary", "John", "Sato", "Tanaka", "Suzuki", "Takahashi", "Ito",
            "Marmot", "Cat", "Dog", "Shark", "Hornet", "Arthropods", "Polar bear", "Pig", "Goat", "Cockroach", 
            "Hydrogen", "Sodium", "Xenon", "Zinc", "Plutonium", "Trans fatty acids", "Hydrochloric acid", "TNT", "Glucose",
            "Imposter", "Mirage", "Apple", "Landmine", "Fried rice", "Tomato", "Potato", "Lemon", "Tofu", "Almond",
            "Pull request", "Vibe coding", "JavaScript", "php", "Python", "Linux", "Commit", "Conflict", "404 Error", "User Interface",
            "Appraiser", "Traveler", "Rover", "Cb", "Hero", "Illusionist", "Saboteur", "Angel", "Idiot", "Barbarian",
            "Parallel isotope", "Dopamine brat", "Gunma Empire", "SCP", "Debater", "Commander", "Logician", "Architect", "Advocate", "Mediator", 
            "Protagonist", "Campaigner", "Logistician", "Defender", "Executive", "Consul", "Virtuoso", "Adventurer", "Entrepreneur", "Entertainer", 
            "Proxy", "Trailblazer"
        ] : [
            "スティーブ", "アレックス", "マイケル", "メアリー", "ジョン", "サトウ", "スズキ", "タナカ", "タカハシ", "イトウ", 
            "マーモット", "猫", "犬", "サメ", "雀蜂", "節足動物", "ホッキョクグマ", "豚", "山羊", "ゴキブリ", 
            "水素", "ナトリウム", "キセノン", "亜鉛", "プルトニウム", "トランス脂肪酸", "塩化水素", "トリニトロトルエン", "ぶどう糖",
            "詐欺師", "蜃気楼", "林檎", "地雷", "炒飯", "トマト", "ポテト", "檸檬", "豆腐", "アーモンド",
            "プルリクエスト", "バイブコーディング", "JavaScript", "php", "Python", "Linux", "コミット", "コンフリクト", "404エラー", "ユーザーインターフェース",
            "鑑定士", "旅人", "漂泊者", "勇者", "Cb", "イリュージョナー", "破壊工作員", "天使", "大馬鹿者", "野蛮人",
            "並行同位体", "ドパガキ", "グンマー帝国", "SCP", "討論者", "司令官", "論理学者", "建築家", "提唱者", "調停者", 
            "主人公", "運動家", "管理人", "守護者", "上司", "領事", "巨匠", "冒険家", "起業家", "エンターテイナー",
            "プロキシ", "開拓者"
        ];
    let result = '';
    result += key1[Math.floor(Math.random() * key1.length)];
    if (!j) result += " ";
    result += key2[Math.floor(Math.random() * key2.length)];
    return result;
}

function loadPlayerName() {
    const savedName = localStorage.getItem('Lmr_playerName');
    if (savedName && savedName.trim() && savedName.length <= 32) return savedName;

    const generatedName = generateRandomName();
    localStorage.setItem('Lmr_playerName', generatedName);
    return generatedName;
}

let playerName = loadPlayerName();

function savePlayerName(value) {
    const normalizedName = value.trim().slice(0, 32);
    playerName = normalizedName || generateRandomName();
    localStorage.setItem('Lmr_playerName', playerName);
    $('player-name').value = playerName;
}

function randomizePlayerName() {
    savePlayerName(generateRandomName());
}

function loadGameStat(key) {
    const value = Number(localStorage.getItem(key) ?? '0');
    return Number.isFinite(value) && value >= 0 ? value : 0;
}

const gameStats = {
    totalTime: loadGameStat('Lmr_totalTime'),
    maxDist: loadGameStat('Lmr_maxDist'),
    hiDist: loadGameStat('Lmr_hiDist'),
    totalDist: loadGameStat('Lmr_totalDist'),
    hiScore: loadGameStat('Lmr_hiScore'),
    totalScore: loadGameStat('Lmr_totalScore'),
    usedFlags: loadGameStat('Lmr_usedFlags'),
    trueFlags: loadGameStat('Lmr_totalTf')
};

function saveGameStats() {
    localStorage.setItem('Lmr_totalTime', String(gameStats.totalTime));
    localStorage.setItem('Lmr_maxDist', String(gameStats.maxDist));
    localStorage.setItem('Lmr_hiDist', String(gameStats.hiDist));
    localStorage.setItem('Lmr_totalDist', String(gameStats.totalDist));
    localStorage.setItem('Lmr_hiScore', String(gameStats.hiScore));
    localStorage.setItem('Lmr_totalScore', String(gameStats.totalScore));
    localStorage.setItem('Lmr_usedFlags', String(gameStats.usedFlags));
    localStorage.setItem('Lmr_totalTf', String(gameStats.trueFlags));
}

function finalizeGameStats() {
    if (isFirstClick || isRunStatsCommitted) return;

    if (timerInterval) {
        timerSeconds += (Date.now() - lastUpdTime) / 1000;
        clearInterval(timerInterval);
        timerInterval = null;
    }

    const traveledDistance = Math.max(0, distance - startDistance);
    const finalScore = Math.round(score);
    gameStats.totalTime += timerSeconds;
    gameStats.maxDist = Math.max(gameStats.maxDist, distance);
    gameStats.hiDist = Math.max(gameStats.hiDist, traveledDistance);
    gameStats.totalDist += traveledDistance;
    gameStats.hiScore = Math.max(gameStats.hiScore, finalScore);
    gameStats.totalScore += finalScore;
    for (const cell of boardMap.values()) {
        if (!cell.isFlagged) continue;
        gameStats.usedFlags++;
        if (cell.isMine) gameStats.trueFlags++;
    }
    isRunStatsCommitted = true;
    saveGameStats();
    renderStatsModal();
}

function updatePlayerStats() {
    getPlayerNextXp();
    const lowLv = Math.min(1000, level), hiLv = Math.max(0, level-1000);
    mhp = Math.floor(0.015*(lowLv)**2 + level + 160 + 31.5*hiLv);
    regen = level*.0167 + .84 + mhp/1000;
}

function calcLmDmgAfter16(d) {
    let A = 512, add = 32;
    for (let i = 0; i < d; i++) {A += add;if ((A & (A - 1)) === 0) {add = A / 16;}}
    return Math.min(A, Math.max(32768, d*2048-163840));
}
updatePlayerStats();
hp = mhp;


function notatVal(val) {
    if (val<1e7) return Math.floor(val);
    const len = Math.floor(Math.log10(val) / 3);
    const sufi = ["", "", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No"][len];
    if (sufi == undefined) return (val / (1e3 ** len)).toFixed(2) + "e" + (len * 3);
    return (val / (1e3 ** len)).toFixed(2) + sufi;
}

function formatMoveSpeed() {
    const traveledDistance = distance - startDistance;
    moveSpeed = timerSeconds > 0 ? traveledDistance * 3.6 / timerSeconds : 0;
    return moveSpeed>1 ? `${moveSpeed.toFixed(2)} km/h` : `${(moveSpeed*1e3).toFixed(1)} m/h`
}

function formatTime(seconds, short=true) {
    const s = short, j = clang===1;
    const Y = s ? "y" : j ? "年" : "years, ", D = s ? "d" : j ? "日" : "day", H = s ? "h" : j ? "時間" : "hr ", M = s ? "m" : j ? "分" : "min ", S = s ? "s" : j ? "秒" : "sec";
    if (seconds>31536e4) return `${Math.floor(seconds / 31536e3)}${Y}${Math.floor((seconds % 31536e3) / 86400)}${D}${!j?((seconds % 31536e3)/86400)>2?"s":"":""}`;
    if (seconds>864e3) return `${Math.floor(seconds / 86400)}${D}${j?"":"s "}${String(Math.floor((seconds % 86400) / 3600)).padStart(2, '0')}${H}`;
    if (seconds>36e3) return `${Math.floor(seconds / 3600)}${H}${String(Math.floor((seconds/60) % 60)).padStart(2, '0')}${M}`;
    if (seconds>600) return `${Math.floor(seconds / 60)}${M}${String(Math.floor(seconds % 60)).padStart(2, '0')}${S}`;
    if (seconds>10) return `${Math.floor(seconds)}.${String(Math.floor((seconds * 100)%100)).padStart(2, '0')}${S}`;
    return `${Math.floor(seconds*1000)}ms`;
}

function formatDist(meter) {
    const j = clang===1, lightDist = meter/299792458;
    const LS = j ? "光秒" : "ls", LD = j ? "光日" : "ld", LY = j ? "光年" : "ly";
    if (lightDist>31536e4) return `${(lightDist/31536e3).toFixed(2)}${LY}`;
    if (lightDist>864e3) return `${(lightDist/86400).toFixed(2)}${LD}`;
    if (lightDist>10) return `${lightDist.toFixed(2)}${LS}`;
    if (meter>1e6) return `${(meter/1e3).toFixed(0)}km`;
    if (meter>1e4) return `${(meter/1e3).toFixed(1)}km`;
    return `${meter}m`
}

function getPlayerNextXp() {
    nextXp = Math.min(1e300, Math.ceil((3e-6*level**3 + 0.01*level**2 + level*1.25 + 9) * (level>100 ? 2 : 1) * (level>400 ? 4 : 1) * 1.001**level));
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
    const notification = $('levelup-notification');
    if (!notification) return;
    const ja = clang === 1;
    notification.textContent = ja ? `レベルアップ！ Lv.${newLevel}` : `LEVEL UP! Lv.${newLevel}`;
    notification.classList.remove('is-showing');
    void notification.offsetWidth;
    notification.classList.add('is-showing');
    playSoundEffect('sebgm/lu.mp3');
}

function getAudioContext() {
    if (!audioContext) {
        const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextConstructor) {
            throw new Error('Web Audio API is not supported by this browser.');
        }
        audioContext = new AudioContextConstructor();
    }
    return audioContext;
}

async function getAudioBuffer(filePath) {
    let bufferPromise = audioBufferCache.get(filePath);
    if (!bufferPromise) {
        bufferPromise = fetch(filePath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load audio: ${filePath} (${response.status})`);
                }
                return response.arrayBuffer();
            })
            .then(data => getAudioContext().decodeAudioData(data));
        audioBufferCache.set(filePath, bufferPromise);
    }

    try {
        return await bufferPromise;
    } catch (error) {
        if (audioBufferCache.get(filePath) === bufferPromise) {
            audioBufferCache.delete(filePath);
        }
        throw error;
    }
}

async function playSoundEffect(filePath) {
    try {
        const context = getAudioContext();
        await context.resume();
        const buffer = await getAudioBuffer(filePath);
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        gain.gain.value = seVolume / 100;
        source.connect(gain);
        gain.connect(context.destination);
        source.addEventListener('ended', () => {
            source.disconnect();
            gain.disconnect();
        }, {once: true});
        source.start();
    } catch (error) {
        console.error(`Unable to play sound effect "${filePath}".`, error);
    }
}

function updatePlayerDisplay() {
    const levelEl = $('level-value');
    const xpValueEl = $('xp-value');
    const xpBarEl = $('xp-bar');
    const regenValueEl = $('regen-value');

    if (levelEl) levelEl.textContent = String(level);
    if (xpValueEl) xpValueEl.textContent = `${notatVal(Math.floor(xp))} / ${notatVal(nextXp)} XP`;
    if (xpBarEl) {
        const pct = nextXp > 0 ? Math.min(100, Math.max(0, (xp / nextXp) * 100)) : 0;
        xpBarEl.style.width = `${pct}%`;
    }
    if (regenValueEl) regenValueEl.textContent = `(+${regen>1e3 ? notatVal(regen) : regen.toFixed(2)}/m)`;
}

function getBgmTargetVolume(trackName) {
    // bgmInfosからトラックのvolumeを取得して設定値と掛け合わせる
    const info = getBgmInfoByName(trackName || currentBgmTrack);
    const trackVol = info ? info.volume : 1.0;
    return Math.min(4, (bgmVolume / 100) * 0.5 * trackVol);
}

function getBgmInfoByName(name) {
    if (!window.bgmInfos) return null;
    return Object.values(window.bgmInfos).find(b => b.name === name) || null;
}

function getBgmInfoById(id) {
    return window.bgmInfos ? window.bgmInfos[id] || null : null;
}

function showBgmNotification(trackName) {
    const info = getBgmInfoByName(trackName);
    const notification = $('bgm-notification');
    if (!info || !notification) return;

    notification.textContent = `♪${info.title} - ${info.author}`;
    notification.classList.remove('is-playing');
    void notification.offsetWidth;
    notification.classList.add('is-playing');
}

function getExpectedBgmTrack(dist) {
    const fixedBgm = getBgmInfoById(fixedBgmId);
    if (isBgmFixed && fixedBgm && isBgmIdSelectable(fixedBgmId)) {
        return fixedBgm.name;
    }
    if (isDzPos(dist)) return 'bgm_dz';
    const currentDistrict = Math.floor(dist / AREA_LENGTH) + 1;
    const bgmIds = window.bgmInfos
        ? Object.keys(window.bgmInfos)
            .map(Number)
            .filter(id => Number.isInteger(id) && id > 0 && id < 1000)
        : [];
    const maxBgmId = Math.max(0, ...bgmIds);
    const bgmId = maxBgmId > 0
        ? ((currentDistrict - 1) % maxBgmId) + 1
        : currentDistrict;
    const trackName = `bgm${bgmId}`;
    if (window.bgmInfos && getBgmInfoByName(trackName)) {
        return trackName;
    }
    return 'bgm1'; // フォールバック
}

function isBgmIdSelectable(id) {
    if (!getBgmInfoById(id)) return false;
    if (id === 0 || id >= 1000) return id === 0 || isBgmFixed;
    return id <= getMaxUnlockedDistrict();
}

function updateBgmFixedControls() {
    const toggle = $('bgm-fixed-toggle');
    const listButton = $('bgm-list-open-btn');
    if (toggle) toggle.checked = isBgmFixed;
    if (listButton) listButton.hidden = !isBgmFixed;
}

function toggleBgmFixed(isFixed) {
    isBgmFixed = isFixed;
    localStorage.setItem('Lmr_bgmFixed', String(isBgmFixed));
    updateBgmFixedControls();
    if (isBgmFixed && !isBgmIdSelectable(fixedBgmId)) {
        const currentInfo = getBgmInfoByName(getExpectedBgmTrack(distance));
        const currentEntry = currentInfo && Object.entries(window.bgmInfos)
            .find(([, info]) => info === currentInfo);
        fixedBgmId = currentEntry ? Number(currentEntry[0]) : 1;
        localStorage.setItem('Lmr_fixedBgmId', String(fixedBgmId));
    }
    if (!isFirstClick && !isGameOver) startOrUpdateBgm();
}

function openBgmListModal() {
    if (!isBgmFixed) return;
    renderBgmList();
    const modal = $('bgm-list-modal');
    if (!modal) return;
    modal.classList.add('visible');
    const closeButton = modal.querySelector('.bgm-list-close-btn');
    if (closeButton) closeButton.focus();
}

function closeBgmListModal() {
    const modal = $('bgm-list-modal');
    if (!modal) return;
    modal.classList.remove('visible');
    const openButton = $('bgm-list-open-btn');
    if (openButton) openButton.focus();
}

function openCreditsModal() {
    const modal = $('credits-modal');
    if (!modal) return;
    modal.classList.add('visible');
    const closeButton = modal.querySelector('.credits-close-btn');
    if (closeButton) closeButton.focus();
}

function closeCreditsModal() {
    const modal = $('credits-modal');
    if (!modal) return;
    modal.classList.remove('visible');
    const openButton = $('credits-open-btn');
    if (openButton) openButton.focus();
}

function openStatsModal() {
    renderStatsModal();
    const modal = $('stats-modal');
    if (!modal) return;
    modal.classList.add('visible');
    const closeButton = modal.querySelector('.stats-close-btn');
    if (closeButton) closeButton.focus();
}

function closeStatsModal() {
    const modal = $('stats-modal');
    if (!modal) return;
    modal.classList.remove('visible');
    const openButton = $('stats-open-btn');
    if (openButton) openButton.focus();
}

function renderStatsModal() {
    const activeTime = gameStats.totalTime + (timerInterval ? timerSeconds : 0);
    const values = {
        'stat-total-time': formatTime(activeTime, false),
        'stat-district': String(getMaxUnlockedDistrict()),
        'stat-max-dist': formatDist(gameStats.maxDist),
        'stat-hi-dist': formatDist(gameStats.hiDist),
        'stat-total-dist': formatDist(gameStats.totalDist),
        'stat-hi-score': notatVal(gameStats.hiScore),
        'stat-total-score': notatVal(gameStats.totalScore),
        'stat-used-flags': String(gameStats.usedFlags),
        'stat-true-flags': String(gameStats.trueFlags)
    };
    Object.entries(values).forEach(([id, value]) => {
        const element = $(id);
        if (element) element.textContent = value;
    });
}

async function copyPlayerStats() {
    const status = $('stats-copy-status');
    const ja = clang === 1;
    const xpProgress = nextXp > 0 ? (xp / nextXp * 100).toFixed(2) : '0.00';
    const shareText = ja
        ? `${playerName} Lvl. ${level} は${getMaxUnlockedDistrict()}区(${gameStats.maxDist}m)まで到達した! -> Landmine road : https://land-mine-road.vercel.app/`
        : `${playerName} Lvl. ${level} reached district ${getMaxUnlockedDistrict()} (${gameStats.maxDist}m)! -> Landmine road : https://land-mine-road.vercel.app/`;

    status.textContent = '';
    try {
        if (!navigator.clipboard) throw new Error('Clipboard API is unavailable');
        await navigator.clipboard.writeText(shareText);
        status.textContent = ja ? 'コピーしました' : 'Copied to clipboard';
    } catch (error) {
        console.error('Failed to copy player stats:', error);
        status.textContent = ja ? 'コピーに失敗しました' : 'Unable to copy to clipboard';
    }
}

function renderBgmList() {
    const list = $('bgm-list');
    if (!list || !window.bgmInfos) return;
    if (!isBgmIdSelectable(fixedBgmId)) {
        const currentInfo = getBgmInfoByName(getExpectedBgmTrack(distance));
        const currentEntry = currentInfo && Object.entries(window.bgmInfos)
            .find(([, info]) => info === currentInfo);
        fixedBgmId = currentEntry ? Number(currentEntry[0]) : 1;
        localStorage.setItem('Lmr_fixedBgmId', String(fixedBgmId));
    }

    list.replaceChildren();
    Object.entries(window.bgmInfos)
        .sort(([left], [right]) => Number(left) - Number(right))
        .forEach(([idText, info]) => {
            const id = Number(idText);
            const row = document.createElement('tr');
            const radioCell = document.createElement('td');
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'fixed-bgm';
            radio.value = idText;
            radio.checked = id === fixedBgmId;
            radio.disabled = !isBgmIdSelectable(id);
            if (radio.disabled) row.classList.add('bgm-locked-row');
            radio.setAttribute('aria-label', `${id}: ${info.title}`);
            radio.addEventListener('change', () => selectFixedBgm(id));
            radioCell.appendChild(radio);
            if (!radio.disabled) {
                row.classList.add('bgm-selectable-row');
                row.addEventListener('click', (event) => {
                    if (event.target !== radio) radio.click();
                });
            }

            const idCell = document.createElement('td');
            idCell.textContent = idText;
            const titleCell = document.createElement('td');
            titleCell.textContent = info.title;
            const authorCell = document.createElement('td');
            authorCell.textContent = info.author;
            row.append(radioCell, idCell, titleCell, authorCell);
            list.appendChild(row);
        });
}

function selectFixedBgm(id) {
    if (!isBgmFixed || !isBgmIdSelectable(id)) return;
    fixedBgmId = id;
    localStorage.setItem('Lmr_fixedBgmId', String(fixedBgmId));
    if (!isFirstClick && !isGameOver) startOrUpdateBgm();
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
    if (difficulty === 1) {
        lmDmg = HARD_LM_DMG;
        return;
    }
    const currentDistrict = Math.floor(distance / AREA_LENGTH) + 1;
    lmDmg = currentDistrict > DISTRICT_MINE_DMG.length
        ? calcLmDmgAfter16(currentDistrict - DISTRICT_MINE_DMG.length)
        : getDistrictValueAtDistance(DISTRICT_MINE_DMG, distance);
}

function startOrUpdateBgm() {
    if (isGameOver) return;
    district = Math.floor(distance / AREA_LENGTH) +1;
    const track = getExpectedBgmTrack(distance);
    if (pendingBgmTrack === track) return;
    if (currentBgmTrack === track && currentBgmAudio) {
        if (pendingBgmTrack) {
            bgmSwitchId++;
            pendingBgmTrack = null;
        }
        return;
    }
    switchBgm(track);
}

function switchBgm(newTrack) {
    if (bgmFadeInterval) {
        clearInterval(bgmFadeInterval);
        bgmFadeInterval = null;
    }
    const switchId = ++bgmSwitchId;

    for (const audio of activeBgmAudios) {
        if (audio !== currentBgmAudio) {
            stopBgmAudio(audio);
            activeBgmAudios.delete(audio);
        }
    }

    pendingBgmTrack = newTrack;
    const info = getBgmInfoByName(newTrack);
    showBgmNotification(newTrack);
    const filePath = `sebgm/${info ? info.name : newTrack}.ogg`;
    void startBgmPlayback(newTrack, filePath, switchId);
}

async function startBgmPlayback(track, filePath, switchId) {
    try {
        const context = getAudioContext();
        await context.resume();
        const buffer = await getAudioBuffer(filePath);
        if (switchId !== bgmSwitchId || isGameOver) return;

        const oldAudio = currentBgmAudio;
        const source = context.createBufferSource();
        const gain = context.createGain();
        const newAudio = {source, gain, track, buffer, startedAt: context.currentTime};
        source.buffer = buffer;
        source.loop = true;
        gain.gain.value = 0;
        source.connect(gain);
        gain.connect(context.destination);
        source.addEventListener('ended', () => {
            activeBgmAudios.delete(newAudio);
            source.disconnect();
            gain.disconnect();
        }, {once: true});
        source.start();
        currentBgmAudio = newAudio;
        currentBgmTrack = track;
        pendingBgmTrack = null;
        activeBgmAudios.add(newAudio);
        updateNowPlayingBgm();

        const duration = 1000;
        const stepInterval = 40;
        const totalSteps = duration / stepInterval;
        let step = 0;
        const oldVolume = oldAudio ? oldAudio.gain.gain.value : 0;

        bgmFadeInterval = setInterval(() => {
            step++;
            const progress = Math.min(1, step / totalSteps);
            if (oldAudio) {
                oldAudio.gain.gain.value = oldVolume * (1 - progress);
                if (step >= totalSteps) {
                    stopBgmAudio(oldAudio);
                }
            }
            gain.gain.value = getBgmTargetVolume(track) * progress;
            if (step >= totalSteps) {
                clearInterval(bgmFadeInterval);
                bgmFadeInterval = null;
            }
        }, stepInterval);
    } catch (error) {
        if (switchId === bgmSwitchId) pendingBgmTrack = null;
        console.error(`Unable to play background music "${track}".`, error);
    }
}

function stopBgmAudio(audio) {
    audio.source.stop();
}

function stopBgmGameOver() {
    if (bgmFadeInterval) {
        clearInterval(bgmFadeInterval);
        bgmFadeInterval = null;
    }
    bgmSwitchId++;
    pendingBgmTrack = null;
    if (!currentBgmAudio) return;

    const audioToStop = currentBgmAudio;
    for (const audio of activeBgmAudios) {
        if (audio !== audioToStop) {
            stopBgmAudio(audio);
            activeBgmAudios.delete(audio);
        }
    }
    const initialVol = audioToStop.gain.gain.value;
    const duration = 1000;
    const stepInterval = 40;
    const totalSteps = duration / stepInterval;
    let step = 0;

    bgmFadeInterval = setInterval(() => {
        step++;
        const ratio = 1 - (step / totalSteps);
        audioToStop.gain.gain.value = Math.max(0, initialVol * ratio);
        if (step >= totalSteps) {
            stopBgmAudio(audioToStop);
            activeBgmAudios.delete(audioToStop);
            clearInterval(bgmFadeInterval);
            bgmFadeInterval = null;
            if (currentBgmAudio === audioToStop) {
                currentBgmAudio = null;
                currentBgmTrack = null;
                updateNowPlayingBgm();
            }
        }
    }, stepInterval);
}

function stopBgmImmediately() {
    if (bgmFadeInterval) {
        clearInterval(bgmFadeInterval);
        bgmFadeInterval = null;
    }
    bgmSwitchId++;
    pendingBgmTrack = null;
    for (const audio of activeBgmAudios) {
        stopBgmAudio(audio);
    }
    activeBgmAudios.clear();
    currentBgmAudio = null;
    currentBgmTrack = null;
    updateNowPlayingBgm();
    const notification = $('bgm-notification');
    if (notification) notification.classList.remove('is-playing');
}

function toggleLang() {clang = clang===0 ? 1 : 0; updateTexts(); localStorage.setItem('Lmr_lang', clang)}

function setDifficulty(value) {
    difficulty = Number(value) === 1 ? 1 : 0;
    localStorage.setItem('Lmr_diff', String(difficulty));
    updateMineRate();
}

function openSettingsModal() {
    const modal = $('settings-modal');
    if (!modal) return;
    $('player-name').value = playerName;
    modal.classList.add('visible');
    startNowPlayingUpdates();
    const closeButton = modal.querySelector('.settings-close-btn');
    if (closeButton) closeButton.focus();
}

function closeSettingsModal() {
    const modal = $('settings-modal');
    if (!modal) return;
    modal.classList.remove('visible');
    if (nowPlayingUpdateInterval) {
        clearInterval(nowPlayingUpdateInterval);
        nowPlayingUpdateInterval = null;
    }
    const openButton = $('settings-open-btn');
    if (openButton) openButton.focus();
}

function updateNowPlayingBgm() {
    const section = $('now-playing');
    const audio = currentBgmAudio;
    if (!section) return;

    const isPlaying = audio && audioContext.state === 'running' && bgmVolume > 0;
    const stateKey = `${isPlaying ? currentBgmTrack : 'None'}:${clang}`;
    if (stateKey === nowPlayingStateKey) return;
    nowPlayingStateKey = stateKey;

    const track = $('now-playing-track');
    const credits = $('now-playing-credits');
    if (!isPlaying) {
        track.textContent = 'None';
        credits.textContent = '---';
        $('now-playing-time').textContent = '---';
        $('now-playing-progress').value = 0;
        section.hidden = false;
        return;
    }

    const entries = window.bgmInfos ? Object.entries(window.bgmInfos) : [];
    const entry = entries.find(([, info]) => info.name === currentBgmTrack);
    const info = entry && entry[1];
    const ja = clang === 1;
    $('now-playing-title').textContent = ja ? '再生中のBGM' : 'Now playing';
    credits.replaceChildren();
    if (!info) {
        track.textContent = 'None';
        credits.textContent = '---';
    } else {
        track.textContent = `${entry[0]} - ${info.title}`;

        const authorUrl = window.authorUrls && window.authorUrls[info.author];
        if (authorUrl) {
            const authorLink = document.createElement('a');
            authorLink.href = authorUrl;
            authorLink.target = '_blank';
            authorLink.rel = 'noopener noreferrer';
            authorLink.textContent = info.author;
            credits.append(authorLink);
        } else {
            credits.append(document.createTextNode(info.author));
        }
        credits.append(document.createTextNode(' ('));

        const licenseUrls = window.licenseUrls && window.licenseUrls[info.license];
        const licenseUrl = licenseUrls && (licenseUrls[ja ? 'ja' : 'en'] || licenseUrls.en);
        if (licenseUrl) {
            const licenseLink = document.createElement('a');
            licenseLink.href = licenseUrl;
            licenseLink.target = '_blank';
            licenseLink.rel = 'noopener noreferrer';
            licenseLink.textContent = info.license;
            credits.append(licenseLink);
        } else {
            credits.append(document.createTextNode(info.license));
        }
        credits.append(document.createTextNode(')'));
    }

    section.hidden = false;
    updateNowPlayingTime();
}

function updateNowPlayingTime() {
    const time = $('now-playing-time');
    const progress = $('now-playing-progress');
    if (!time) return;

    const audio = currentBgmAudio;
    const isPlaying = audio && audioContext.state === 'running' && bgmVolume > 0;
    const hasTrackInfo = window.bgmInfos &&
        Object.values(window.bgmInfos).some(info => info.name === currentBgmTrack);
    const hasValidDuration = isPlaying && hasTrackInfo &&
        Number.isFinite(audio.buffer.duration) && audio.buffer.duration > 0;
    if (!hasValidDuration) {
        time.textContent = '---';
        if (progress) progress.value = 0;
        return;
    }

    const duration = audio.buffer.duration;
    const currentTime = (audioContext.currentTime - audio.startedAt) % duration;
    time.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    if (progress) {
        progress.max = duration;
        progress.value = currentTime;
        progress.setAttribute('aria-valuetext', `${formatTime(currentTime)} / ${formatTime(duration)}`);
    }
}

function renderCredits() {
    const bgmCredits = $('bgm-credits-list');
    const seCredits = $('se-credits-list');
    if (!bgmCredits || !seCredits) return;

    bgmCredits.replaceChildren();
    seCredits.replaceChildren();
    Object.entries(window.authorUrls || {}).forEach(([author, url]) => {
        const entry = document.createElement('div');
        entry.className = 'credit-entry';
        const name = document.createElement('div');
        name.textContent = `${author}:`;
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = url;
        entry.append(name, link);
        (["rubberduck", "WobbleBoxx Workshop"].includes(author) ? seCredits : bgmCredits).append(entry);
    });
}

function startNowPlayingUpdates() {
    updateNowPlayingBgm();
    updateNowPlayingTime();
    if (!nowPlayingUpdateInterval) {
        nowPlayingUpdateInterval = setInterval(updateNowPlayingTime, 16.67);
    }
}

document.addEventListener('keydown', (event) => {
    const bgmModal = $('bgm-list-modal');
    const creditsModal = $('credits-modal');
    const statsModal = $('stats-modal');
    const modal = $('settings-modal');
    if (event.key === 'Escape' && bgmModal && bgmModal.classList.contains('visible')) {
        closeBgmListModal();
        return;
    }
    if (event.key === 'Escape' && creditsModal && creditsModal.classList.contains('visible')) {
        closeCreditsModal();
        return;
    }
    if (event.key === 'Escape' && statsModal && statsModal.classList.contains('visible')) {
        closeStatsModal();
        return;
    }
    if (event.key === 'Escape' && modal && modal.classList.contains('visible')) {
        closeSettingsModal();
    }
});

function setBackgroundMode(mode) {
    backgroundMode = mode;
    applyBackgroundVisibility();
    localStorage.setItem('Lmr_backgroundMode', backgroundMode);
}

function setFooterTextHidden(hidden) {
    isFooterTextHidden = hidden;
    localStorage.setItem('Lmr_footerTextHidden', String(hidden));
    applyFooterTextVisibility();
}

function applyFooterTextVisibility() {
    const footerText = $('footer-text');
    const toggle = $('footer-text-hidden-toggle');
    if (footerText) footerText.hidden = isFooterTextHidden;
    if (toggle) toggle.checked = isFooterTextHidden;
}

function applyBackgroundVisibility() {
    const background = $('district-background');
    const select = $('background-mode');
    const isVisible = backgroundMode !== 'hidden';
    if (background) {
        background.classList.toggle('background-hidden', !isVisible);
        if (!isVisible) {
            background.querySelectorAll('[data-background-layer]').forEach((layer) => {
                layer.style.backgroundImage = 'none';
                layer.classList.remove('is-active');
            });
            background.dataset.activeLayer = '0';
            background.dataset.district = '';
            background.dataset.quality = '';
        }
    }
    if (select) select.value = backgroundMode;
    if (isVisible) updateDistrictBackground();
}

function updateTexts() {
    const ja = clang===1;
    $("flag-mode-text").textContent = ja ? isFlagModeMobile ? "旗" : "掘削" : isFlagModeMobile ? "Mode : Flag" : "Mode : Dig";
    $("district-stats-bar").innerHTML = 
        ja ? `<b id="district-count" class="stat-value district-value">${district}</b> 区<br>地雷率 : <b id="mine-rate" class="stat-value mine-rate-value">${(mineRate*100).toFixed(2)}%</b>` 
        : `District  <b id="district-count" class="stat-value district-value">${district}</b><br>Mine rate : <b id="mine-rate" class="stat-value mine-rate-value">${(mineRate*100).toFixed(2)}%</b>`;
    
    document.querySelectorAll("#start-district option").forEach((option) => {
        option.textContent = ja ? `${option.value}区` : `District ${option.value}`;
    });
    document.querySelectorAll("#start-sector option").forEach((option) => {
        option.textContent = ja ? `セクタ${option.value}` : `Sector ${option.value}`;
    });
    const finalScoreLabel = $("final-score-label");
    if (finalScoreLabel) finalScoreLabel.textContent = ja ? "スコア" : "SCORE";
    const finalDistLabel = $("final-distance-label");
    if (finalDistLabel) finalDistLabel.textContent = ja ? "距離" : "DISTANCE";
    $("final-speed-label").textContent = ja ? "速度" : "SPEED";
    $("modal-title").textContent = ja ? "死んだンゴ" : "You died!";
    $("modal-desc").textContent = ja ? "うお" : "Oof";
    $("retry-btn").textContent = ja ? "再試行" : "Try again";
    $("lang-btn").textContent = ja ? "Ja" : "En";
    $("settings-title").textContent = ja ? "設定" : "Settings";
    $("player-name-label").textContent = ja ? "名前" : "Name";
    $("player-name").value = playerName;
    $("stats-title").textContent = ja ? "統計" : "Statistics";
    $("stats-copy-btn-label").textContent = ja ? "シェア情報をコピー" : "Copy share info";
    $("stats-copy-status").textContent = "";
    $("stat-total-time-label").textContent = ja ? "合計時間" : "Total time";
    $("stat-district-label").textContent = ja ? "地区" : "District";
    $("stat-max-dist-label").textContent = ja ? "最大到達距離" : "Max distance";
    $("stat-hi-dist-label").textContent = ja ? "最長移動距離" : "Longest distance";
    $("stat-total-dist-label").textContent = ja ? "合計移動距離" : "Total distance";
    $("stat-hi-score-label").textContent = ja ? "最高点" : "Highest score";
    $("stat-total-score-label").textContent = ja ? "合計点" : "Total score";
    $("stat-used-flags-label").textContent = ja ? "旗を刺した数" : "Used flags";
    $("stat-true-flags-label").textContent = ja ? "正しく利用された旗" : "True flags";
    document.querySelector(".stats-close-btn").setAttribute("aria-label", ja ? "統計を閉じる" : "Close statistics");
    $("bgm-volume-label").textContent = ja ? "BGM音量" : "BGM volume";
    $("se-volume-label").textContent = ja ? "効果音音量" : "SE volume";
    $("language-label").textContent = ja ? "言語" : "Language";
    $("difficulty-label").textContent = ja ? "難易度" : "Difficulty";
    $("difficulty-select").value = String(difficulty);
    $("background-label").textContent = ja ? "背景画質" : "Background quality";
    $("background-high-option").textContent = ja ? "高画質" : "High quality";
    $("background-low-option").textContent = ja ? "低画質" : "Low quality";
    $("background-hidden-option").textContent = ja ? "非表示" : "Hidden";
    $("background-mode").value = backgroundMode;
    $("bgm-fixed-label").textContent = ja ? "BGMを固定" : "Fix BGM";
    $("footer-text-label").textContent = ja ? "フッターの説明を非表示" : "Hide footer text";
    $("bgm-list-open-label").textContent = ja ? "BGM一覧" : "BGM list";
    $("bgm-list-title").textContent = ja ? "BGM一覧" : "BGM list";
    $("credits-title").textContent = ja ? "クレジット" : "Credits";
    $("credits-open-label").textContent = ja ? "クレジット" : "Credits";
    $("bgm-list-radio-heading").textContent = ja ? "選択" : "Select";
    $("bgm-list-id-heading").textContent = "ID";
    $("bgm-list-track-heading").textContent = ja ? "BGM" : "BGM";
    $("bgm-list-author-heading").textContent = ja ? "作者" : "Author";
    document.querySelector(".bgm-list-close-btn").setAttribute("aria-label", ja ? "BGM一覧を閉じる" : "Close BGM list");
    document.querySelector(".credits-close-btn").setAttribute("aria-label", ja ? "クレジットを閉じる" : "Close credits");
    updateBgmFixedControls();
    if ($('bgm-list-modal').classList.contains('visible')) renderBgmList();
    updateNowPlayingBgm();
    document.querySelector(".settings-close-btn").setAttribute("aria-label", ja ? "設定を閉じる" : "Close settings");
    $("footer-text").innerHTML = ja ? 
        `左クリック、掘削モード中のタップ : 掘る / 右クリック、旗モード中のタップ : 旗<br>
        数字が周囲の旗の数と一致しているとき、その数字をクリックする : コーディング<br>
        前方5メートルの45/65マスを掘削して前に進もう` : 
        `Left-click, Dig-mode->Tap : dig / Right-click, Flag-mode->Tap : Flag<br>
        Click on number if number equals to flags amount : Chord<br>
        Clear 45/65 cells in front 5m to advance!`;
    updatePlayerDisplay();
    renderStatsModal();
}

window.onload = () => {
    initVolume();
    applyBackgroundVisibility();
    applyFooterTextVisibility();
    updateBgmFixedControls();
    renderCredits();
    updateTexts();
    resetGame();
};

function initVolume() {
    const savedVol = localStorage.getItem('Lmr_seVol');
    if (savedVol !== null) {
        const parsed = parseInt(savedVol, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 200) {
            seVolume = parsed;
        }
    }
    const seSlider = $('se-volume');
    const seText = $('volume-text');
    if (seSlider) seSlider.value = seVolume;
    if (seText) seText.innerText = `${seVolume}%`;

    const savedBgmVol = localStorage.getItem('Lmr_bgmVol');
    if (savedBgmVol !== null) {
        const parsedBgm = parseInt(savedBgmVol, 10);
        if (!isNaN(parsedBgm) && parsedBgm >= 0 && parsedBgm <= 200) {
            bgmVolume = parsedBgm;
        }
    }
    const bgmSlider = $('bgm-volume');
    const bgmText = $('bgm-volume-text');
    if (bgmSlider) bgmSlider.value = bgmVolume;
    if (bgmText) bgmText.innerText = `${bgmVolume}%`;
}

function updateVolume(val) {
    seVolume = parseInt(val, 10);
    localStorage.setItem('Lmr_seVol', seVolume);
    const text = $('volume-text');
    if (text) text.innerText = `${seVolume}%`;
}

function updateBgmVolume(val) {
    bgmVolume = parseInt(val, 10);
    localStorage.setItem('Lmr_bgmVol', bgmVolume);
    const text = $('bgm-volume-text');
    if (text) text.innerText = `${bgmVolume}%`;
    if (currentBgmAudio && !bgmFadeInterval) {
        currentBgmAudio.gain.gain.value = getBgmTargetVolume(currentBgmTrack);
    }
}

function playMineSe() {
    playSoundEffect('sebgm/lm.mp3');
}

function resetGame() {
    finalizeGameStats();
    gameRunId++;
    if (!isScoreCommitted && score > 0) {
        const result = commitScoreAsXp();
        if (result.leveledUp) {
            showLevelUpNotification(result.endLevel);
        }
    }
    isScoreCommitted = false;
    isRunStatsCommitted = false;
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

    const startCheckpointSelect = $('start-checkpoint');
    const startCheckpointControl = $('start-checkpoint-control');
    if (startCheckpointControl) startCheckpointControl.hidden = false;
    updateStartLocationOptions();
    if (startCheckpointSelect) {
        populateStartCheckpointOptions(startCheckpointSelect);
        startCheckpointSelect.value = String(selectedStartCheckpoint);
        startCheckpointSelect.disabled = false;
    }

    const boardEl = $('board');
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

function getSectorForDistrict(districtNumber) {
    return Math.floor((districtNumber - 1) / DISTRICTS_PER_SECTOR) + 1;
}

function getSectorFirstDistrict(sectorNumber) {
    return (sectorNumber - 1) * DISTRICTS_PER_SECTOR + 1;
}

function updateStartLocationOptions() {
    const sectorSelect = $('start-sector');
    const districtSelect = $('start-district');
    const maxUnlockedDistrict = getMaxUnlockedDistrict();
    const selectedSector = getSectorForDistrict(selectedStartDistrict);

    if (sectorSelect) {
        sectorSelect.replaceChildren();
        const maxUnlockedSector = getSectorForDistrict(maxUnlockedDistrict);
        for (let sector = 1; sector <= maxUnlockedSector; sector++) {
            const option = document.createElement('option');
            option.value = String(sector);
            option.textContent = clang === 1 ? `セクタ${sector}` : `Sector ${sector}`;
            sectorSelect.appendChild(option);
        }
        sectorSelect.value = String(selectedSector);
        sectorSelect.disabled = !isFirstClick;
    }

    if (districtSelect) {
        districtSelect.replaceChildren();
        const firstDistrict = getSectorFirstDistrict(selectedSector);
        const lastDistrict = Math.min(selectedSector * DISTRICTS_PER_SECTOR, maxUnlockedDistrict);
        for (let unlockedDistrict = firstDistrict; unlockedDistrict <= lastDistrict; unlockedDistrict++) {
            const option = document.createElement('option');
            option.value = String(unlockedDistrict);
            option.textContent = clang === 1 ? `${unlockedDistrict}区` : `District ${unlockedDistrict}`;
            districtSelect.appendChild(option);
        }
        districtSelect.value = String(selectedStartDistrict);
        districtSelect.disabled = !isFirstClick;
    }
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

function changeStartSector(value) {
    if (!isFirstClick || isGameOver || isSliding) return;
    const newSector = Number.parseInt(value, 10);
    const maxUnlockedSector = getSectorForDistrict(getMaxUnlockedDistrict());
    if (!Number.isInteger(newSector) || newSector < 1 || newSector > maxUnlockedSector) return;
    selectedStartDistrict = getSectorFirstDistrict(newSector);
    selectedStartCheckpoint = getDistrictFirstCheckpoint(selectedStartDistrict);
    resetGame();
}

function changeStartDistrict(value) {
    if (!isFirstClick || isGameOver || isSliding) return;
    const newDistrict = Number.parseInt(value, 10);
    if (!Number.isInteger(newDistrict)
        || newDistrict < 1
        || newDistrict > getMaxUnlockedDistrict()
        || getSectorForDistrict(newDistrict) !== getSectorForDistrict(selectedStartDistrict)) return;
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
                justExploded: false,
                isExploded: false
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
    const boardEl = $('board');
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
        if (cell.isExploded) {
            cellBtn.classList.add('cell-exploded');
        }
        if (cell.isMine) {
            cellBtn.innerHTML += '<i class="fa-solid fa-bomb bomb-icon"></i>';
        } else if (cell.neighborMines > 0) {
            cellBtn.innerHTML += `<span class="num-${cell.neighborMines}">${cell.neighborMines}</span>`;
        }
    } else if (cell.isFlagged) {
        if (isGameOver && !cell.isMine) {
            cellBtn.innerHTML += '<i class="fa-solid fa-xmark wrong-flag-icon"></i>';
        } else {
            cellBtn.innerHTML += '<i class="fa-solid fa-flag flag-icon"></i>';
        }
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
        $('start-checkpoint-control').hidden = true;
        $('start-checkpoint').disabled = true;
        $('start-sector').disabled = true;
        $('start-district').disabled = true;
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
    score += Math.min(1e298, ((cellDistrict+1)**2.4 * 0.004 * 1.05**cellDistrict));

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
    const runId = gameRunId;
    if (!canAdvanceNext()) return;

    isSliding = true;
    const boardEl = $('board');
    if (boardEl) boardEl.classList.add('is-sliding');

    while (canAdvanceNext()) {
        await animateSlideStep(runId);
        if (runId !== gameRunId) return;

        distance++;
        hp = Math.min(mhp, hp + regen);
        if (distance % CHECKPOINT_FREQ === 0) updateMineRate();
        if (distance % CHECKPOINT_FREQ === 0 && distance / CHECKPOINT_FREQ > passedCheckpointCount) {
            passedCheckpointCount = distance / CHECKPOINT_FREQ;
            selectedStartDistrict = Math.floor(distance / AREA_LENGTH) + 1;
            selectedStartCheckpoint = passedCheckpointCount;
            localStorage.setItem('Lmr_passedCP', String(passedCheckpointCount));
            updateStartLocationOptions();
            const startCheckpointSelect = $('start-checkpoint');
            if (startCheckpointSelect) {
                populateStartCheckpointOptions(startCheckpointSelect);
                startCheckpointSelect.value = String(selectedStartCheckpoint);
            }
            const bgmModal = $('bgm-list-modal');
            if (bgmModal && bgmModal.classList.contains('visible')) renderBgmList();
        }
        startOrUpdateBgm();

        if (distance + (INITIAL_GEN_LEN-CHUNK_GEN_LEN) > maxGeneratedCol) {
            generateColumns(maxGeneratedCol, CHUNK_GEN_LEN);
        }

        cleanupOldColumns(distance - 12);
        updateStatsDisplay();
        renderBoard();
    }

    if (runId === gameRunId) {
        if (boardEl) boardEl.classList.remove('is-sliding');
        isSliding = false;
    }
}

function animateSlideStep(runId) {
    return new Promise((resolve) => {
        const boardEl = $('board');
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
                if (runId === gameRunId) {
                    boardEl.style.transition = 'none';
                    boardEl.style.transform = 'translateX(0)';
                }
                resolve();
            }, 1000/progressSpeed);
        } else {
            setTimeout(() => {resolve();}, 1000/progressSpeed);
        }
    });
}

function cleanupOldColumns(cutoffCol) {
    let removedFlags = false;
    for (let [key, cell] of boardMap.entries()) {
        if (cell.c < cutoffCol) {
            if (cell.isFlagged) {
                gameStats.usedFlags++;
                if (cell.isMine) gameStats.trueFlags++;
                removedFlags = true;
            }
            boardMap.delete(key);
        }
    }
    if (removedFlags) {
        saveGameStats();
        renderStatsModal();
    }
}

function incrementClick() {
    clicksCount++;
    updateStatsDisplay();
}

function updateStatsDisplay() {
    district = Math.floor(distance / AREA_LENGTH) + 1;
    updateDistrictBackground();
    const traveledDistance = distance - startDistance;
    $('distance-count').innerHTML = `<i class="stat-icon fa-solid fa-person-walking"></i> ${traveledDistance}m`;
    $('clicks-count').innerHTML = `<i class="stat-icon fa-solid fa-arrow-pointer"></i> ${clicksCount}`;
    $('timer').innerHTML = `<i class="stat-icon fa-regular fa-clock"></i> ${formatTime(timerSeconds)}`;
    $('move-speed').innerHTML = `<i class="stat-icon fa-solid fa-gauge-high"></i> ${formatMoveSpeed()}`;
    $('district-count').textContent = String(district);
    $('mine-rate').textContent = `${(mineRate * 100 * (isDzPos(distance) ? DZ_MINE_RATIO_MULT : 1)).toFixed(2)}%`;
    const displayedHp = $('hp-value');
    const hpBar = $('hp-bar');
    const hpGauge = $('hp-gauge');
    if (displayedHp) displayedHp.textContent = `${notatVal(Math.ceil(hp))} / ${notatVal(mhp)}`;
    if (hpBar) hpBar.style.width = `${Math.max(0, Math.min(100, hp / mhp * 100))}%`;
    if (hpGauge) {
        hpGauge.setAttribute('aria-valuemax', String(mhp));
        hpGauge.setAttribute('aria-valuenow', String(Math.max(0, Math.min(mhp, hp))));
    }
}

function updateDistrictBackground() {
    if (backgroundMode === 'hidden') return;
    const background = $('district-background');
    if (!background) return;

    const districtValue = String(district);
    if (background.dataset.district !== districtValue || background.dataset.quality !== backgroundMode) {
        const extension = backgroundMode === 'low' ? 'jpg' : 'png';
        const layers = background.querySelectorAll('[data-background-layer]');
        if (layers.length !== 2) return;

        const activeLayerIndex = Number(background.dataset.activeLayer ?? 0);
        const activeLayer = layers[activeLayerIndex];
        const nextLayerIndex = activeLayer.style.backgroundImage === '' ? activeLayerIndex : 1 - activeLayerIndex;
        const nextLayer = layers[nextLayerIndex];
        nextLayer.style.backgroundImage = `url("bg/${district}.${extension}")`;
        nextLayer.classList.add('is-active');
        if (nextLayer !== activeLayer) {
            activeLayer.classList.remove('is-active');
        }
        background.dataset.activeLayer = String(nextLayerIndex);
        background.dataset.district = districtValue;
        background.dataset.quality = backgroundMode;
    }
}

$('district-background').addEventListener('transitionend', (event) => {
    if (event.propertyName !== 'opacity') return;
    const background = event.currentTarget;
    const activeLayerIndex = Number(background.dataset.activeLayer ?? 0);
    background.querySelectorAll('[data-background-layer]').forEach((layer, index) => {
        if (index !== activeLayerIndex && !layer.classList.contains('is-active')) {
            layer.style.backgroundImage = 'none';
        }
    });
});

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
    const btn = $('mobile-flag-btn');
    const text = $('flag-mode-text');
    if (isFlagModeMobile) {
        btn.classList.add('flag-active');
    } else {
        btn.classList.remove('flag-active');
    }
    $("flag-mode-text").textContent = clang===1 ? isFlagModeMobile ? "旗" : "掘削" : isFlagModeMobile ? "Mode : Flag" : "Mode : Dig";
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
    score = Math.round(score);
    finalizeGameStats();
    clearInterval(timerInterval);
    const result = commitScoreAsXp();
    if (result.leveledUp) {
        showLevelUpNotification(result.endLevel);
    }
    updateStatsDisplay();

    if (explodedCell) {
        explodedCell.justExploded = true;
        explodedCell.isExploded = true;
    }

    // Reveal visible mines & wrong flags
    const startCol = getStartCol();
    const endCol = startCol + VIEW_COLS;

    for (let r = 0; r < ROWS; r++) {
        for (let c = startCol; c < endCol; c++) {
            const cell = getCell(r, c);
            if (!cell) continue;
            if (cell.isMine) {
                cell.isOpen = true;
            }
        }
    }
    renderBoard();

    for (let r = 0; r < ROWS; r++) {
        for (let c = startCol; c < endCol; c++) {
            const cell = getCell(r, c);
            const cellBtn = $(`cell-${r}-${c}`);
            if (!cell || !cellBtn) continue;
            if (cell.isMine) {
                if (cell === explodedCell) {
                    cellBtn.classList.add('cell-exploded');
                }
            } else if (cell.isFlagged && !cell.isMine) {
                const flagIcon = cellBtn.querySelector('.flag-icon');
                if (flagIcon) {
                    flagIcon.className = 'fa-solid fa-xmark wrong-flag-icon';
                } else if (!cellBtn.querySelector('.wrong-flag-icon')) {
                    cellBtn.innerHTML += '<i class="fa-solid fa-xmark wrong-flag-icon"></i>';
                }
            }
        }
    }
    setTimeout(()=>{showModal();}, 300);
}

function showModal() {
    const modal = $('modal');
    const modalCard = $('modal-card');

    $('final-distance').innerText = `${distance}m`;
    $('final-speed').innerText = String(formatMoveSpeed());
    $('final-score').innerText = String(notatVal(score));

    modal.classList.add('visible');
    setTimeout(() => {
        modal.classList.add('show');
        modalCard.classList.add('show');
    }, 10);
}

function closeModalAndReset() {
    const modal = $('modal');
    const modalCard = $('modal-card');

    modal.classList.remove('show');
    modalCard.classList.remove('show');

    setTimeout(() => {
        modal.classList.remove('visible');
        resetGame();
    }, 300);
}
