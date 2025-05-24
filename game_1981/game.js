// Game variables
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const scoreDisplay = document.getElementById('score');
const livesDisplay = document.getElementById('lives');
const levelDisplay = document.getElementById('level');

// 전역 타이머 변수
let nextLevelTimer = null;

// Game state enumeration
const GAME_STATE = {
    MENU: 'menu',
    PLAYING: 'playing',
    LEVEL_COMPLETE: 'levelComplete',
    GAME_OVER: 'gameOver'
};

// Game settings
const GAME_WIDTH = 600;
const GAME_HEIGHT = 800;
let gameActive = false;
let gameLoopId;
let score = 0;
let lives = 3;
let level = 1;
let gameState = GAME_STATE.MENU;
let victoryMusicPlaying = false;
let levelCompleteTime = 0; // 레벨 완료 시점의 시간 (밀리초)
let levelCompleteDuration = 5000; // 레벨 완료 화면 표시 지속 시간 (밀리초)
let showingLevelComplete = false;

// 캔버스 크기 조정을 위한 변수
let canvasScale = 1;

// Game title 
const GAME_TITLE = '톱니바꿈의 겔러그 소환';

// Weapon types
const WEAPON_TYPES = {
    SINGLE: 'single',  // Default single bullet
    DOUBLE: 'double',  // Two bullets side by side
    TRIPLE: 'triple',  // Three bullets in a spread
    LASER: 'laser',    // Continuous laser beam
    SPREAD: 'spread'   // Five bullets in a wide spread
};

// Set canvas dimensions
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

// 캔버스 크기 조정 함수
function resizeCanvas() {
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    
    // 표시 크기와 실제 캔버스 크기 비율 계산
    canvasScale = Math.min(displayWidth / GAME_WIDTH, displayHeight / GAME_HEIGHT);
    
    console.log(`Canvas resized: display size ${displayWidth}x${displayHeight}, scale: ${canvasScale}`);
}

// YouTube victory music
const victoryVideoId = '1R0AXWJuhHM';
let victoryAudio = null;

// Player settings
const player = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT - 70,
    width: 50,
    height: 40,
    speed: 8,
    color: '#0ff',
    bullets: [],
    bulletSpeed: 10,
    canShoot: true,
    shootCooldown: 150, // milliseconds
    lastShot: 0,
    weaponType: WEAPON_TYPES.SINGLE, // Default weapon
    weaponLevel: 1,
    weaponDuration: 0 // Duration for special weapons
};

// Enemies
const enemies = [];
const ENEMY_ROWS = 4;
const ENEMY_COLS = 8;
const ENEMY_WIDTH = 40;
const ENEMY_HEIGHT = 30;
const ENEMY_PADDING = 20;
const ENEMY_SPEED = 1;
const ENEMY_DROP = 30;
let enemyDirection = 1; // 1 for right, -1 for left
let enemyMoveDown = false;

// Bonus enemy
let bonusEnemy = null;
const BONUS_WIDTH = 60;
const BONUS_HEIGHT = 40;
const BONUS_SPEED = 3;
const BONUS_SCORE = 150;
let bonusEnemyTimer = 0;
const BONUS_ENEMY_INTERVAL = 7000; // 7초마다 생성 (이전에는 10000 또는 20000)

// Enemy bullets
const enemyBullets = [];
const ENEMY_BULLET_SPEED = 5;
const ENEMY_SHOOTING_CHANCE = 0.005; // Chance of enemy shooting per frame

// Audio context for sound effects
let audioContext;
try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
} catch (e) {
    console.error('Web Audio API not supported.', e);
}

// Sound effects
let backgroundMusic;
let soundsEnabled = true;

// Function to create sound effects using the Web Audio API
function createSoundEffect(type) {
    if (!audioContext || !soundsEnabled) return;
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        switch(type) {
            case 'shoot':
                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.15);
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.15);
                break;
            case 'explosion':
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.3);
                gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.3);
                break;
            case 'gameOver':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 1.5);
                gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.5);
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 1.5);
                break;
        }
        
        // Cleanup connections after playing sound
        oscillator.onended = function() {
            oscillator.disconnect();
            gainNode.disconnect();
        };
    } catch (e) {
        console.error('Error creating sound effect:', e);
        // If we encounter too many errors, disable sounds
        soundsEnabled = false;
    }
}

// Play a sound effect
function playSound(type) {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    createSoundEffect(type);
}

// Initialize background music
function initBackgroundMusic() {
    if (!audioContext) return { start: function() {}, stop: function() {} };
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
        
        // Create a simple arpeggio pattern
        const intervalId = setInterval(() => {
            if (gameActive && !oscillator.stopped) {
                try {
                    oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
                    setTimeout(() => {
                        try {
                            oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
                        } catch (e) {}
                    }, 250);
                    setTimeout(() => {
                        try {
                            oscillator.frequency.setValueAtTime(250, audioContext.currentTime);
                        } catch (e) {}
                    }, 500);
                    setTimeout(() => {
                        try {
                            oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
                        } catch (e) {}
                    }, 750);
                } catch (e) {
                    clearInterval(intervalId);
                }
            }
        }, 1000);
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        oscillator.start();
        
        return {
            start: function() {
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                oscillator.stopped = false;
            },
            stop: function() {
                gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                oscillator.stopped = true;
            }
        };
    } catch (e) {
        console.error('Background music could not be initialized', e);
        return {
            start: function() {},
            stop: function() {}
        };
    }
}

// Play victory music
function playVictoryMusic() {
    if (victoryMusicPlaying) return;
    
    // First try to create a synthetic victory music
    if (audioContext) {
        try {
            createVictorySynth();
            victoryMusicPlaying = true;
            return;
        } catch (e) {
            console.error('Failed to create synthetic victory music:', e);
        }
    }
    
    // Fallback: Try to load the YouTube audio as a last resort
    try {
        // Create a hidden iframe for YouTube video (audio only)
        if (!victoryAudio) {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = `https://www.youtube.com/embed/${victoryVideoId}?autoplay=1&controls=0`;
            iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope";
            
            document.body.appendChild(iframe);
            victoryAudio = iframe;
            
            // Remove the iframe after 5 seconds to stop the audio
            setTimeout(() => {
                try {
                    document.body.removeChild(iframe);
                    victoryAudio = null;
                    victoryMusicPlaying = false;
                } catch (e) {}
            }, 5000);
        }
        victoryMusicPlaying = true;
    } catch (e) {
        console.error('Failed to play YouTube victory music:', e);
    }
}

// Create synthetic victory music using Web Audio API
function createVictorySynth() {
    if (!audioContext) return;
    
    const now = audioContext.currentTime;
    
    // Create oscillators for melody
    const melody = audioContext.createOscillator();
    const melodyGain = audioContext.createGain();
    
    melody.type = 'square';
    melody.connect(melodyGain);
    melodyGain.connect(audioContext.destination);
    
    // Create oscillator for bass
    const bass = audioContext.createOscillator();
    const bassGain = audioContext.createGain();
    
    bass.type = 'triangle';
    bass.connect(bassGain);
    bassGain.connect(audioContext.destination);
    
    // Set initial gains
    melodyGain.gain.setValueAtTime(0.2, now);
    bassGain.gain.setValueAtTime(0.2, now);
    
    // Victory melody sequence (happy tune)
    const victoryNotes = [
        { note: 523.25, time: 0.0 },    // C5
        { note: 587.33, time: 0.2 },    // D5
        { note: 659.25, time: 0.4 },    // E5
        { note: 698.46, time: 0.6 },    // F5
        { note: 783.99, time: 0.8 },    // G5
        { note: 880.00, time: 1.0 },    // A5
        { note: 987.77, time: 1.2 },    // B5
        { note: 1046.50, time: 1.4 },   // C6 (high)
        { note: 1046.50, time: 1.7 },   // C6 hold
        { note: 987.77, time: 2.0 },    // B5
        { note: 880.00, time: 2.2 },    // A5
        { note: 783.99, time: 2.4 },    // G5
        { note: 659.25, time: 2.6 },    // E5
        { note: 523.25, time: 2.8 },    // C5
        { note: 659.25, time: 3.0 },    // E5
        { note: 783.99, time: 3.2 },    // G5
        { note: 1046.50, time: 3.4 },   // C6 (final)
        { note: 1046.50, time: 4.0 }    // Long hold
    ];
    
    // Bass line
    const bassNotes = [
        { note: 130.81, time: 0.0 },    // C3
        { note: 130.81, time: 0.8 },    // C3
        { note: 146.83, time: 1.6 },    // D3
        { note: 196.00, time: 2.4 },    // G3
        { note: 130.81, time: 3.2 },    // C3
        { note: 130.81, time: 4.0 }     // C3
    ];
    
    // Schedule melody notes
    victoryNotes.forEach(note => {
        melody.frequency.setValueAtTime(note.note, now + note.time);
    });
    
    // Schedule bass notes
    bassNotes.forEach(note => {
        bass.frequency.setValueAtTime(note.note, now + note.time);
    });
    
    // Start and stop
    melody.start(now);
    bass.start(now);
    
    melody.stop(now + 5);
    bass.stop(now + 5);
    
    // Clean up after playing
    setTimeout(() => {
        try {
            melody.disconnect();
            bass.disconnect();
            melodyGain.disconnect();
            bassGain.disconnect();
            victoryMusicPlaying = false;
        } catch (e) {}
    }, 5000);
}

// Game initialization
function initGame() {
    // Reset game state
    score = 0;
    lives = 3;
    level = 1;
    gameActive = true;
    gameState = GAME_STATE.PLAYING;
    showingLevelComplete = false;
    levelCompleteTime = 0;
    player.bullets = [];
    enemies.length = 0;
    enemyBullets.length = 0;
    player.x = GAME_WIDTH / 2;
    victoryMusicPlaying = false;
    bonusEnemy = null;
    bonusEnemyTimer = 0;
    explosions.length = 0; // 폭발 효과 초기화 추가
    
    // Reset player weapon
    player.weaponType = WEAPON_TYPES.SINGLE;
    player.weaponLevel = 1;
    player.weaponDuration = 0;
    
    // Update display
    scoreDisplay.textContent = score;
    livesDisplay.textContent = lives;
    levelDisplay.textContent = level;
    
    // Create enemies
    createEnemyGrid();
    
    // Start game loop
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    gameLoopId = null; // gameLoopId 초기화 명시적으로 추가
    gameLoop();
    
    // Resume audio context if suspended
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    // Start background music
    if (!backgroundMusic) {
        backgroundMusic = initBackgroundMusic();
    }
    backgroundMusic.start();
    
    // 게임 시작 후 3초 뒤에 보너스 적 생성 (이전에는 2초)
    console.log("Game initialized, scheduling bonus enemy spawn");
    setTimeout(() => {
        if (gameState === GAME_STATE.PLAYING && !bonusEnemy) {
            console.log("Spawning first bonus enemy");
            spawnBonusEnemy();
        }
    }, 3000);
    
    // 보너스 적을 더 짧은 주기(5초)로 체크해서 생성 (이전에는 8초)
    setInterval(() => {
        if (gameState === GAME_STATE.PLAYING && !bonusEnemy) {
            console.log("Periodic check: No bonus enemy, spawning one");
            spawnBonusEnemy();
        }
    }, 5000);
}

// Create enemy grid
function createEnemyGrid() {
    enemies.length = 0; // 기존 적 제거
    
    console.log(`레벨 ${level} 적 생성 시작`);
    
    // 단순하게 고정된 그리드로 적 생성 (복잡한 패턴 제거)
    const rows = 4;
    const cols = 6;
    
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            // 모든 위치에 적 생성 (패턴 무시)
            let enemyType = 'regular';
            let color = '#00f';
            let health = 1;
            
            if (row === 0) {
                enemyType = 'boss';
                color = '#f00';
                health = 2;
            } else if (row === 1) {
                enemyType = 'elite';
                color = '#f0f';
                health = 1;
            }
            
            const enemy = {
                x: col * (ENEMY_WIDTH + ENEMY_PADDING) + 60,
                y: row * (ENEMY_HEIGHT + ENEMY_PADDING) + 50,
                width: ENEMY_WIDTH,
                height: ENEMY_HEIGHT,
                color: color,
                type: enemyType,
                alive: true,
                animationFrame: 0,
                animationCounter: 0,
                health: health
            };
            
            enemies.push(enemy);
            console.log(`적 생성: 행${row} 열${col}, 위치(${enemy.x}, ${enemy.y}), 타입: ${enemyType}`);
        }
    }
    
    console.log(`레벨 ${level} 적 생성 완료: 총 ${enemies.length}개`);
    
    // 생성된 적들의 정보 출력
    enemies.forEach((enemy, index) => {
        if (index < 3) { // 처음 3개만 출력
            console.log(`적 ${index}: x=${enemy.x}, y=${enemy.y}, alive=${enemy.alive}, type=${enemy.type}`);
        }
    });
}

// Game loop
function gameLoop() {
    // 게임 상태에 따라 처리
    if (gameState === GAME_STATE.GAME_OVER) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null;
        return; // 게임 오버 상태면 루프 종료
    }
    
    // Clear canvas
    ctx.fillStyle = '#0f0f1b';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Draw stars in background
    drawStars();
    
    // 레벨 완료 화면 표시
    if (gameState === GAME_STATE.LEVEL_COMPLETE) {
        // 경과 시간 계산 (밀리초)
        const elapsedTime = Date.now() - levelCompleteTime;
        // 남은 시간 계산 (초)
        const remainingTime = Math.ceil((levelCompleteDuration - elapsedTime) / 1000);
        
        console.log(`레벨 완료 화면 표시 중, 남은 시간: ${remainingTime}초, 경과 시간: ${elapsedTime}ms, 레벨 타이머: ${levelCompleteTime}`);
        
        // 타이머가 0 이하면 즉시 다음 레벨로 전환 (2단계 백업 안전장치)
        if (remainingTime <= 0) {
            console.log("gameLoop에서 감지: 카운트다운 종료, 즉시 다음 레벨로 전환");
            
            // 타이머 정리
            if (nextLevelTimer) {
                clearTimeout(nextLevelTimer);
                nextLevelTimer = null;
            }
            
            // 게임 상태 강제 초기화
            gameState = GAME_STATE.PLAYING;
            showingLevelComplete = false;
            gameActive = true;
            levelCompleteTime = 0;
            
            // 즉시 다음 레벨 시작
            startNextLevel();
            return;
        }
        
        // 레벨 완료 화면 표시
        drawLevelComplete(remainingTime);
        
        // 다음 프레임 예약
        gameLoopId = requestAnimationFrame(gameLoop);
        return;
    }
    
    // 게임 플레이 중이 아니면 여기서 중단
    if (gameState !== GAME_STATE.PLAYING) {
        gameLoopId = requestAnimationFrame(gameLoop);
        return;
    }
    
    // 여기서부터는 PLAYING 상태의 게임 로직
    
    // Update and draw player
    drawPlayer();
    
    // Update weapon duration
    updateWeaponDuration();
    
    // Update bonus enemy timer
    bonusEnemyTimer += 16.67; // Approximate time between frames
    
    // 디버깅용 타이머 출력 (1초마다)
    if (Math.floor(bonusEnemyTimer / 1000) !== Math.floor((bonusEnemyTimer - 16.67) / 1000)) {
        console.log(`현재 레벨: ${level}, 보너스 타이머: ${Math.floor(bonusEnemyTimer)}, 기준값: ${BONUS_ENEMY_INTERVAL}`);
    }
    
    // 보너스 적이 없을 때만 타이머 체크 추가
    if (!bonusEnemy && bonusEnemyTimer >= BONUS_ENEMY_INTERVAL) {
        console.log(`레벨 ${level}에서 보너스 적 생성. 타이머: ${bonusEnemyTimer}`);
        spawnBonusEnemy();
        bonusEnemyTimer = 0;
    }
    
    // Update and draw bonus enemy
    if (bonusEnemy && bonusEnemy.active) {
        updateBonusEnemy();
    }
    
    // 보너스 적을 화면에 그리기
    if (bonusEnemy && bonusEnemy.active) {
        drawBonusEnemy();
    }
    
    // Update and draw bullets
    updateBullets();
    drawBullets();
    
    // Update and draw enemies
    updateEnemies();
    drawEnemies();
    
    // Enemy shooting logic
    enemyShooting();
    
    // Update and draw enemy bullets
    updateEnemyBullets();
    drawEnemyBullets();
    
    // Check for collisions
    checkCollisions();
    
    // Update explosions
    updateExplosions();
    
    // Check for game over or level complete conditions
    const gameEnded = checkGameOver();
    
    // Continue loop
    gameLoopId = requestAnimationFrame(gameLoop);
}

// Draw stars in background
function drawStars() {
    // Create a gradient background with stars
    // 레벨에 따라 배경 색상 변화
    const bgColors = [
        {r: 15, g: 15, b: 27},    // 레벨 1: 어두운 파란색
        {r: 20, g: 10, b: 30},    // 레벨 2: 보라색 계열
        {r: 30, g: 10, b: 20},    // 레벨 3: 자주색 계열
        {r: 25, g: 5, b: 15}      // 레벨 4: 와인색 계열
    ];
    
    const colorIndex = Math.min(level - 1, bgColors.length - 1);
    const bgColor = bgColors[colorIndex];
    
    // 배경에 그라데이션 효과 추가
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, `rgba(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, 1)`);
    gradient.addColorStop(1, `rgba(${bgColor.r/2}, ${bgColor.g/2}, ${bgColor.b/2}, 1)`);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Generate stars based on level
    const starCount = 80 + level * 20; // 레벨에 따라 별 수 증가
    
    for (let i = 0; i < starCount; i++) {
        const x = Math.sin(i * 927) * GAME_WIDTH;
        const y = (Math.cos(i * 427) * GAME_HEIGHT + Date.now() * (0.02 + level * 0.005)) % GAME_HEIGHT;
        const size = Math.sin(i) * 2 + 1;
        
        // Draw star with color based on level
        const alpha = 0.5 + Math.sin(Date.now() * 0.001 + i) * 0.5;
        
        // 레벨에 따라 별 색상 변화
        let starColor;
        if (level === 1) {
            starColor = `rgba(255, 255, 255, ${alpha})`;  // 흰색 별
        } else if (level === 2) {
            starColor = `rgba(200, 255, 255, ${alpha})`;  // 푸른 별
        } else if (level === 3) {
            starColor = `rgba(255, 230, 200, ${alpha})`;  // 황색 별
        } else {
            starColor = `rgba(255, 200, 220, ${alpha})`;  // 분홍 별
        }
        
        ctx.fillStyle = starColor;
        ctx.fillRect(x, y, size, size);
    }
    
    // Draw nebulas based on level
    if (level === 1) {
        drawNebula(100, 200, 150, 'rgba(106, 17, 203, 0.1)');
        drawNebula(400, 400, 200, 'rgba(37, 117, 252, 0.1)');
    } else if (level === 2) {
        drawNebula(150, 300, 200, 'rgba(86, 57, 223, 0.1)');
        drawNebula(350, 200, 180, 'rgba(17, 157, 203, 0.1)');
    } else if (level === 3) {
        drawNebula(120, 250, 180, 'rgba(203, 17, 106, 0.1)');
        drawNebula(450, 350, 220, 'rgba(223, 107, 37, 0.1)');
    } else {
        drawNebula(200, 200, 200, 'rgba(223, 37, 177, 0.1)');
        drawNebula(400, 600, 250, 'rgba(223, 27, 37, 0.1)');
    }
}

// Draw a nebula effect
function drawNebula(x, y, size, color) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(x - size, y - size, size * 2, size * 2);
}

// Draw player
function drawPlayer() {
    // Draw player ship (modern design)
    const x = player.x;
    const y = player.y;
    const w = player.width;
    const h = player.height;
    
    // Create glow effect
    const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, w);
    glowGradient.addColorStop(0, 'rgba(0, 255, 255, 0.2)');
    glowGradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
    
    ctx.fillStyle = glowGradient;
    ctx.fillRect(x - w, y - h, w * 2, h * 2);
    
    // Ship body - futuristic design
    ctx.fillStyle = '#2575fc';
    ctx.beginPath();
    ctx.moveTo(x - w/2, y + h/2); // Bottom left
    ctx.lineTo(x - w/4, y - h/4); // Mid left
    ctx.lineTo(x, y - h/2); // Top center
    ctx.lineTo(x + w/4, y - h/4); // Mid right
    ctx.lineTo(x + w/2, y + h/2); // Bottom right
    ctx.closePath();
    ctx.fill();
    
    // Ship details with gradient
    const bodyGradient = ctx.createLinearGradient(x, y - h/2, x, y + h/2);
    bodyGradient.addColorStop(0, '#6a11cb');
    bodyGradient.addColorStop(1, '#2575fc');
    
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.moveTo(x - w/3, y + h/3); // Bottom left inner
    ctx.lineTo(x - w/6, y - h/6); // Mid left inner
    ctx.lineTo(x, y - h/3); // Top center inner
    ctx.lineTo(x + w/6, y - h/6); // Mid right inner
    ctx.lineTo(x + w/3, y + h/3); // Bottom right inner
    ctx.closePath();
    ctx.fill();
    
    // Cockpit
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.ellipse(x, y - h/6, w/10, h/8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Thrusters with animated flame
    const flameHeight = 10 + Math.random() * 5;
    
    // Left thruster flame
    const flameGradient1 = ctx.createLinearGradient(x - w/4, y + h/2, x - w/4, y + h/2 + flameHeight);
    flameGradient1.addColorStop(0, '#ff6');
    flameGradient1.addColorStop(0.7, '#f80');
    flameGradient1.addColorStop(1, 'rgba(255, 136, 0, 0)');
    
    ctx.fillStyle = flameGradient1;
    ctx.beginPath();
    ctx.moveTo(x - w/3, y + h/2);
    ctx.lineTo(x - w/4, y + h/2 + flameHeight);
    ctx.lineTo(x - w/6, y + h/2);
    ctx.fill();
    
    // Right thruster flame
    const flameGradient2 = ctx.createLinearGradient(x + w/4, y + h/2, x + w/4, y + h/2 + flameHeight);
    flameGradient2.addColorStop(0, '#ff6');
    flameGradient2.addColorStop(0.7, '#f80');
    flameGradient2.addColorStop(1, 'rgba(255, 136, 0, 0)');
    
    ctx.fillStyle = flameGradient2;
    ctx.beginPath();
    ctx.moveTo(x + w/3, y + h/2);
    ctx.lineTo(x + w/4, y + h/2 + flameHeight);
    ctx.lineTo(x + w/6, y + h/2);
    ctx.fill();
    
    // Add shield effect if player has a special weapon
    if (player.weaponType !== WEAPON_TYPES.SINGLE) {
        const shieldColors = {
            [WEAPON_TYPES.DOUBLE]: 'rgba(0, 255, 255, 0.2)',
            [WEAPON_TYPES.TRIPLE]: 'rgba(0, 255, 0, 0.2)',
            [WEAPON_TYPES.LASER]: 'rgba(255, 0, 255, 0.2)',
            [WEAPON_TYPES.SPREAD]: 'rgba(255, 136, 0, 0.2)'
        };
        
        ctx.fillStyle = shieldColors[player.weaponType];
        ctx.beginPath();
        ctx.arc(x, y, w * 0.8, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Update player weapon duration
function updateWeaponDuration() {
    if (player.weaponType !== WEAPON_TYPES.SINGLE && player.weaponDuration > 0) {
        player.weaponDuration -= 16.67; // Approx time between frames
        
        // Display weapon timer
        const timeLeft = Math.max(0, Math.ceil(player.weaponDuration / 1000));
        
        // Create a more modern looking weapon indicator
        const weaponColors = {
            [WEAPON_TYPES.DOUBLE]: '#0ff',
            [WEAPON_TYPES.TRIPLE]: '#0f0',
            [WEAPON_TYPES.LASER]: '#f0f',
            [WEAPON_TYPES.SPREAD]: '#f80'
        };
        
        const color = weaponColors[player.weaponType];
        
        // Draw weapon icon
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(20, GAME_HEIGHT - 40);
        ctx.lineTo(40, GAME_HEIGHT - 40);
        ctx.lineTo(30, GAME_HEIGHT - 60);
        ctx.closePath();
        ctx.fill();
        
        // Draw time indicator background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(10, GAME_HEIGHT - 30, 100, 10);
        
        // Draw time remaining bar
        let barColor = color;
        if (player.weaponDuration < 3000) {
            // Flash when about to expire
            if (Math.floor(player.weaponDuration / 200) % 2 === 0) {
                barColor = '#f00';
            }
        }
        
        ctx.fillStyle = barColor;
        const barWidth = (player.weaponDuration / 15000) * 100;
        ctx.fillRect(10, GAME_HEIGHT - 30, barWidth, 10);
        
        // Draw time text
        ctx.fillStyle = '#fff';
        ctx.font = '14px Orbitron, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${timeLeft}s`, 50, GAME_HEIGHT - 40);
        
        // Reset to basic weapon when duration expires
        if (player.weaponDuration <= 0) {
            player.weaponType = WEAPON_TYPES.SINGLE;
            player.weaponLevel = 1;
        }
    }
}

// Update bonus enemy
function updateBonusEnemy() {
    if (!bonusEnemy || !bonusEnemy.active) return;
    
    // 보너스 적 속도에 따라 이동 (기본값 2)
    const bonusSpeed = bonusEnemy.speed || 2;
    
    // 보너스 적 이동
    bonusEnemy.x += bonusEnemy.direction * bonusSpeed;
    
    // 화면 밖으로 나갔는지 확인
    if ((bonusEnemy.direction > 0 && bonusEnemy.x > GAME_WIDTH + 50) || 
        (bonusEnemy.direction < 0 && bonusEnemy.x < -BONUS_WIDTH - 50)) {
        console.log("Bonus enemy left the screen, deactivating");
        
        // 화면 밖으로 나가면 비활성화
        bonusEnemy.active = false;
        bonusEnemy = null; // 참조 완전히 제거
        
        // 즉시 다음 생성을 위해 타이머 진행
        bonusEnemyTimer = BONUS_ENEMY_INTERVAL - 2000; // 2초 후 생성되도록 설정
    }
}

// Spawn bonus enemy
function spawnBonusEnemy() {
    // 이미 보너스 적이 있으면 생성하지 않음
    if (bonusEnemy && bonusEnemy.active) {
        console.log("Bonus enemy already exists, not spawning a new one");
        return;
    }
    
    // 기존 객체가 있지만 비활성화되었으면 완전히 제거
    if (bonusEnemy) {
        bonusEnemy = null;
    }
    
    // 화면 밖에서 시작하도록 설정
    const direction = Math.random() > 0.5 ? 1 : -1; // 1 = 오른쪽으로 이동, -1 = 왼쪽으로 이동
    let startX;
    
    if (direction === 1) {
        startX = -BONUS_WIDTH - 20; // 왼쪽에서 시작해서 오른쪽으로 이동 (여유 공간 증가)
    } else {
        startX = GAME_WIDTH + 20; // 오른쪽에서 시작해서 왼쪽으로 이동 (여유 공간 증가)
    }
    
    // 무기 종류를 레벨에 따라 다양하게 설정
    const weaponDrop = getRandomWeapon();
    
    bonusEnemy = {
        x: startX,
        y: 80, // 화면 상단 부근
        width: BONUS_WIDTH,
        height: BONUS_HEIGHT,
        direction: direction,
        active: true,
        color: '#ff0',
        weaponDrop: weaponDrop,
        animationFrame: 0,
        animationCounter: 0,
        speed: 2 + Math.min(level - 1, 3) // 레벨에 따라 속도 증가 (최대 5)
    };
    
    console.log(`Bonus enemy spawned at level ${level}:`, bonusEnemy, "Direction:", direction, "Start X:", startX, "Weapon:", weaponDrop);
    
    // Play special sound for bonus enemy
    playBonusSound();
}

// Play bonus enemy sound
function playBonusSound() {
    if (!audioContext || !soundsEnabled) return;
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        
        // Create a distinctive sound
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(500, audioContext.currentTime + 0.2);
        oscillator.frequency.setValueAtTime(700, audioContext.currentTime + 0.3);
        
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.4);
        
        oscillator.onended = function() {
            oscillator.disconnect();
            gainNode.disconnect();
        };
    } catch (e) {
        console.error('Error playing bonus sound:', e);
    }
}

// Get random weapon for bonus enemy to drop
function getRandomWeapon() {
    const weapons = [
        WEAPON_TYPES.DOUBLE,
        WEAPON_TYPES.TRIPLE,
        WEAPON_TYPES.LASER,
        WEAPON_TYPES.SPREAD
    ];
    return weapons[Math.floor(Math.random() * weapons.length)];
}

// Draw bonus enemy
function drawBonusEnemy() {
    if (!bonusEnemy || !bonusEnemy.active) return;
    
    // 디버깅 메시지 추가
    console.log("Drawing bonus enemy:", bonusEnemy.x, bonusEnemy.y);
    
    // Update animation
    bonusEnemy.animationCounter++;
    if (bonusEnemy.animationCounter > 5) {
        bonusEnemy.animationCounter = 0;
        bonusEnemy.animationFrame = (bonusEnemy.animationFrame + 1) % 4;
    }
    
    const x = bonusEnemy.x + bonusEnemy.width / 2;
    const y = bonusEnemy.y + bonusEnemy.height / 2;
    const w = bonusEnemy.width;
    const h = bonusEnemy.height;
    
    // Create UFO glow effect
    const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, w);
    glowGradient.addColorStop(0, 'rgba(255, 255, 0, 0.3)');
    glowGradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
    
    ctx.fillStyle = glowGradient;
    ctx.fillRect(x - w, y - h, w * 2, h * 2);
    
    // UFO body with gradient
    const bodyGradient = ctx.createLinearGradient(x, y - h/2, x, y + h/2);
    bodyGradient.addColorStop(0, '#fc0');
    bodyGradient.addColorStop(1, '#f80');
    
    // UFO dome
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.ellipse(x, y - h/4, w/2, h/3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // UFO main body
    ctx.beginPath();
    ctx.ellipse(x, y + h/6, w/1.5, h/3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Cockpit with reflective effect
    const cockpitGradient = ctx.createRadialGradient(x, y - h/4, 0, x, y - h/4, w/6);
    cockpitGradient.addColorStop(0, '#fff');
    cockpitGradient.addColorStop(0.4, '#fc0');
    cockpitGradient.addColorStop(1, '#f80');
    
    ctx.fillStyle = cockpitGradient;
    ctx.beginPath();
    ctx.arc(x, y - h/4, w/6, 0, Math.PI * 2);
    ctx.fill();
    
    // Flashing lights with animation
    const time = Date.now();
    const colors = ['#f00', '#0f0', '#00f', '#ff0'];
    const lightIndex = (Math.floor(time / 200) + bonusEnemy.animationFrame) % colors.length;
    
    ctx.fillStyle = colors[lightIndex];
    
    // Left light
    ctx.beginPath();
    ctx.arc(x - w/3, y + h/6, w/10, 0, Math.PI * 2);
    ctx.fill();
    
    // Right light
    ctx.beginPath();
    ctx.arc(x + w/3, y + h/6, w/10, 0, Math.PI * 2);
    ctx.fill();
    
    // Bottom lights - animated
    for (let i = 0; i < 3; i++) {
        const lightX = x + (i - 1) * w/5;
        const lightStatus = (bonusEnemy.animationFrame + i) % 3;
        
        if (lightStatus === 0) {
            ctx.fillStyle = '#f00';
        } else if (lightStatus === 1) {
            ctx.fillStyle = '#0f0';
        } else {
            ctx.fillStyle = '#00f';
        }
        
        ctx.beginPath();
        ctx.arc(lightX, y + h/3, w/12, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Weapon icon indicator based on what weapon this bonus will drop
    const weaponColors = {
        [WEAPON_TYPES.DOUBLE]: '#0ff',
        [WEAPON_TYPES.TRIPLE]: '#0f0',
        [WEAPON_TYPES.LASER]: '#f0f',
        [WEAPON_TYPES.SPREAD]: '#f80'
    };
    
    // Create pulsing effect
    const pulseSize = w/8 + Math.sin(time * 0.01) * w/20;
    
    ctx.fillStyle = weaponColors[bonusEnemy.weaponDrop];
    ctx.beginPath();
    ctx.arc(x, y, pulseSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Add text showing the weapon type in Korean
    const weaponNames = {
        [WEAPON_TYPES.DOUBLE]: '더블',
        [WEAPON_TYPES.TRIPLE]: '트리플',
        [WEAPON_TYPES.LASER]: '레이저',
        [WEAPON_TYPES.SPREAD]: '스프레드'
    };
    
    ctx.fillStyle = '#fff';
    ctx.font = '10px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(weaponNames[bonusEnemy.weaponDrop], x, y - h/2 - 10);
}

// Update player bullets
function updateBullets() {
    for (let i = player.bullets.length - 1; i >= 0; i--) {
        const bullet = player.bullets[i];
        
        // 레이저 특수 처리
        if (bullet.type === WEAPON_TYPES.LASER) {
            // 레이저는 수직선 상의 모든 적에게 피해를 주고 화면 상단에 고정
            bullet.y = 0;
            bullet.height = player.y - player.height / 2;
            
            // 레이저는 유지 시간 후 사라짐 (약 0.5초)
            if (bullet.lifeTime === undefined) {
                bullet.lifeTime = 30; // 약 0.5초 (프레임 기준)
            } else {
                bullet.lifeTime--;
                if (bullet.lifeTime <= 0) {
                    player.bullets.splice(i, 1);
                }
            }
            continue;
        }
        
        // 일반 총알 업데이트
        bullet.y -= player.bulletSpeed;
        
        // Apply horizontal movement for bullets with vx property
        if (bullet.vx !== undefined) {
            bullet.x += bullet.vx * player.bulletSpeed;
        }
        
        // Remove bullets that leave the screen
        if (bullet.y < 0 || bullet.x < 0 || bullet.x > GAME_WIDTH) {
            player.bullets.splice(i, 1);
        }
    }
}

// Draw player bullets
function drawBullets() {
    player.bullets.forEach(bullet => {
        // Different styles based on bullet type
        switch(bullet.type) {
            case WEAPON_TYPES.DOUBLE:
                // Blue double bullets
                const grdDouble = ctx.createLinearGradient(bullet.x, bullet.y, bullet.x, bullet.y + 15);
                grdDouble.addColorStop(0, "#fff");
                grdDouble.addColorStop(0.5, "#0ff");
                grdDouble.addColorStop(1, "#08f");
                
                ctx.fillStyle = grdDouble;
                ctx.fillRect(bullet.x - 2, bullet.y, 4, 15);
                
                // Glow effect
                ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
                ctx.beginPath();
                ctx.arc(bullet.x, bullet.y + 7, 6, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case WEAPON_TYPES.TRIPLE:
                // Green triple bullets
                const grdTriple = ctx.createLinearGradient(bullet.x, bullet.y, bullet.x, bullet.y + 15);
                grdTriple.addColorStop(0, "#fff");
                grdTriple.addColorStop(0.5, "#0f0");
                grdTriple.addColorStop(1, "#080");
                
                ctx.fillStyle = grdTriple;
                ctx.fillRect(bullet.x - 2, bullet.y, 4, 15);
                
                // Glow effect
                ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
                ctx.beginPath();
                ctx.arc(bullet.x, bullet.y + 7, 6, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case WEAPON_TYPES.LASER:
                // 레이저 총알 렌더링 개선
                const laserWidth = 4; // 레이저 기본 너비
                const laserAlpha = bullet.lifeTime / 30; // 시간에 따른 투명도
                
                // 레이저 본체 그라디언트
                const grdLaser = ctx.createLinearGradient(bullet.x, 0, bullet.x, bullet.height);
                grdLaser.addColorStop(0, `rgba(255, 0, 255, ${0.2 * laserAlpha})`);
                grdLaser.addColorStop(0.5, `rgba(255, 0, 255, ${0.8 * laserAlpha})`);
                grdLaser.addColorStop(1, `rgba(255, 255, 255, ${1.0 * laserAlpha})`);
                
                // 레이저 본체 그리기
                ctx.fillStyle = grdLaser;
                ctx.fillRect(bullet.x - laserWidth/2, 0, laserWidth, bullet.height);
                
                // 레이저 광채 효과
                const glowRadius = 6 + Math.sin(Date.now() / 100) * 3;
                ctx.fillStyle = `rgba(255, 0, 255, ${0.3 * laserAlpha})`;
                
                // 레이저 시작점(상단) 광채
                ctx.beginPath();
                ctx.arc(bullet.x, 10, glowRadius, 0, Math.PI * 2);
                ctx.fill();
                
                // 레이저 끝점(플레이어 위) 광채
                ctx.beginPath();
                ctx.arc(bullet.x, bullet.height, glowRadius * 1.5, 0, Math.PI * 2);
                ctx.fill();
                
                break;
                
            case WEAPON_TYPES.SPREAD:
                // Orange spread bullets
                const grdSpread = ctx.createLinearGradient(bullet.x, bullet.y, bullet.x, bullet.y + 15);
                grdSpread.addColorStop(0, "#fff");
                grdSpread.addColorStop(0.5, "#f80");
                grdSpread.addColorStop(1, "#f40");
                
                ctx.fillStyle = grdSpread;
                ctx.fillRect(bullet.x - 2, bullet.y, 4, 15);
                
                // Glow effect
                ctx.fillStyle = 'rgba(255, 128, 0, 0.3)';
                ctx.beginPath();
                ctx.arc(bullet.x, bullet.y + 7, 6, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            default:
                // Default yellow bullet
                const grd = ctx.createLinearGradient(bullet.x, bullet.y, bullet.x, bullet.y + 15);
                grd.addColorStop(0, "#fff");
                grd.addColorStop(0.5, "#ff0");
                grd.addColorStop(1, "#f80");
                
                ctx.fillStyle = grd;
                ctx.fillRect(bullet.x - 2, bullet.y, 4, 15);
                
                // Glow effect
                ctx.fillStyle = 'rgba(255, 255, 150, 0.3)';
                ctx.beginPath();
                ctx.arc(bullet.x, bullet.y + 7, 6, 0, Math.PI * 2);
                ctx.fill();
        }
    });
}

// Update enemies
function updateEnemies() {
    let moveDown = false;
    let hitEdge = false;
    
    // Check if any enemy has hit the edge
    for (const enemy of enemies) {
        if (!enemy.alive) continue;
        
        if ((enemy.x <= 10 && enemyDirection === -1) || 
            (enemy.x >= GAME_WIDTH - 10 - ENEMY_WIDTH && enemyDirection === 1)) {
            hitEdge = true;
            break;
        }
    }
    
    if (hitEdge) {
        enemyDirection *= -1;
        moveDown = true;
    }
    
    // Move enemies and update animations
    for (const enemy of enemies) {
        if (!enemy.alive) continue;
        
        enemy.x += ENEMY_SPEED * enemyDirection;
        if (moveDown) {
            enemy.y += ENEMY_DROP;
        }
        
        // Update animation
        enemy.animationCounter++;
        if (enemy.animationCounter > 15) {
            enemy.animationCounter = 0;
            enemy.animationFrame = (enemy.animationFrame + 1) % 4;
        }
    }
}

// Draw enemies
function drawEnemies() {
    if (enemies.length === 0) {
        console.log("drawEnemies 호출됨: 적이 없음");
        return;
    }
    
    console.log(`drawEnemies 호출됨: 총 ${enemies.length}개의 적 렌더링 시작`);
    
    let drawnCount = 0;
    enemies.forEach((enemy, index) => {
        if (enemy.alive) {
            drawnCount++;
            
            // 처음 3개만 위치 로그 출력
            if (index < 3) {
                console.log(`적 ${index} 렌더링: 위치(${enemy.x}, ${enemy.y}), 타입: ${enemy.type}, alive: ${enemy.alive}`);
            }
            
            const x = enemy.x + enemy.width / 2;
            const y = enemy.y + enemy.height / 2;
            const w = enemy.width;
            const h = enemy.height;
            
            // 체력 표시 (보스와 엘리트 적에 대해서만)
            if ((enemy.type === 'boss' || enemy.type === 'elite') && enemy.health > 1) {
                // 체력바 배경
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(x - w/2, y - h/2 - 8, w, 4);
                
                // 체력바 (녹색~빨간색 그라데이션)
                const healthPercent = enemy.health / (enemy.type === 'boss' ? (1 + Math.floor(level/2)) : (1 + Math.floor(level/3)));
                const healthColor = `hsl(${120 * healthPercent}, 100%, 50%)`;
                ctx.fillStyle = healthColor;
                ctx.fillRect(x - w/2, y - h/2 - 8, w * healthPercent, 4);
            }
            
            // Different enemy types
            switch(enemy.type) {
                case 'boss':
                    drawBossEnemy(x, y, w, h, enemy);
                    break;
                case 'elite':
                    drawEliteEnemy(x, y, w, h, enemy);
                    break;
                default:
                    drawRegularEnemy(x, y, w, h, enemy);
            }
        }
    });
    
    console.log(`drawEnemies 완료: ${drawnCount}개의 살아있는 적 렌더링됨`);
}

// Draw boss enemy (red one at the top)
function drawBossEnemy(x, y, w, h, enemy) {
    // Animation based on frame
    const animOffset = Math.sin(enemy.animationFrame * Math.PI / 2) * 3;
    
    // Body
    ctx.fillStyle = '#f00';
    ctx.beginPath();
    ctx.moveTo(x - w/2, y);
    ctx.lineTo(x - w/4, y - h/2);
    ctx.lineTo(x + w/4, y - h/2);
    ctx.lineTo(x + w/2, y);
    ctx.lineTo(x + w/4, y + h/2);
    ctx.lineTo(x - w/4, y + h/2);
    ctx.closePath();
    ctx.fill();
    
    // Eye/cockpit
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.arc(x, y, w/4, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner eye
    ctx.fillStyle = '#700';
    ctx.beginPath();
    ctx.arc(x, y, w/8, 0, Math.PI * 2);
    ctx.fill();
    
    // Wing details
    ctx.fillStyle = '#700';
    
    // Left wing
    ctx.beginPath();
    ctx.moveTo(x - w/2, y);
    ctx.lineTo(x - w/2 - animOffset, y - h/4);
    ctx.lineTo(x - w/4, y - h/4);
    ctx.fill();
    
    // Right wing
    ctx.beginPath();
    ctx.moveTo(x + w/2, y);
    ctx.lineTo(x + w/2 + animOffset, y - h/4);
    ctx.lineTo(x + w/4, y - h/4);
    ctx.fill();
}

// Draw elite enemy (purple ones)
function drawEliteEnemy(x, y, w, h, enemy) {
    // Animation based on frame
    const animOffset = enemy.animationFrame % 2 * 4;
    
    // Main body
    ctx.fillStyle = '#f0f';
    ctx.beginPath();
    ctx.ellipse(x, y, w/2, h/2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Wing tips
    ctx.fillStyle = '#70b';
    
    // Left wing
    ctx.beginPath();
    ctx.moveTo(x - w/2, y);
    ctx.lineTo(x - w/2 - animOffset, y - h/4);
    ctx.lineTo(x - w/2 - animOffset, y + h/4);
    ctx.closePath();
    ctx.fill();
    
    // Right wing
    ctx.beginPath();
    ctx.moveTo(x + w/2, y);
    ctx.lineTo(x + w/2 + animOffset, y - h/4);
    ctx.lineTo(x + w/2 + animOffset, y + h/4);
    ctx.closePath();
    ctx.fill();
    
    // Center detail
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, w/5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x, y, w/10, 0, Math.PI * 2);
    ctx.fill();
}

// Draw regular enemy (blue ones)
function drawRegularEnemy(x, y, w, h, enemy) {
    // Animation based on frame
    const animOffset = Math.sin(enemy.animationFrame * Math.PI / 2) * 2;
    
    // Main body
    ctx.fillStyle = '#00f';
    
    // Draw insect-like body
    ctx.beginPath();
    ctx.moveTo(x - w/3, y - h/3);
    ctx.lineTo(x + w/3, y - h/3);
    ctx.lineTo(x + w/2, y + h/3);
    ctx.lineTo(x - w/2, y + h/3);
    ctx.closePath();
    ctx.fill();
    
    // Antenna
    ctx.strokeStyle = '#00f';
    ctx.lineWidth = 2;
    
    // Left antenna
    ctx.beginPath();
    ctx.moveTo(x - w/4, y - h/3);
    ctx.lineTo(x - w/4 - animOffset, y - h/2 - animOffset);
    ctx.stroke();
    
    // Right antenna
    ctx.beginPath();
    ctx.moveTo(x + w/4, y - h/3);
    ctx.lineTo(x + w/4 + animOffset, y - h/2 - animOffset);
    ctx.stroke();
    
    // Eyes
    ctx.fillStyle = '#aaf';
    
    // Left eye
    ctx.beginPath();
    ctx.arc(x - w/6, y - h/6, w/10, 0, Math.PI * 2);
    ctx.fill();
    
    // Right eye
    ctx.beginPath();
    ctx.arc(x + w/6, y - h/6, w/10, 0, Math.PI * 2);
    ctx.fill();
}

// Enemy shooting logic
function enemyShooting() {
    enemies.forEach(enemy => {
        if (enemy.alive && Math.random() < ENEMY_SHOOTING_CHANCE) {
            enemyBullets.push({
                x: enemy.x + enemy.width / 2,
                y: enemy.y + enemy.height,
                width: 4,
                height: 10,
                type: enemy.type
            });
        }
    });
}

// Update enemy bullets
function updateEnemyBullets() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        enemyBullets[i].y += ENEMY_BULLET_SPEED;
        
        // Remove bullets that leave the screen
        if (enemyBullets[i].y > GAME_HEIGHT) {
            enemyBullets.splice(i, 1);
        }
    }
}

// Draw enemy bullets
function drawEnemyBullets() {
    enemyBullets.forEach(bullet => {
        // Different bullet types based on enemy type
        let bulletColor;
        
        switch(bullet.type) {
            case 'boss':
                bulletColor = '#f00';
                break;
            case 'elite':
                bulletColor = '#f0f';
                break;
            default:
                bulletColor = '#00f';
        }
        
        // Create gradient
        const grd = ctx.createLinearGradient(bullet.x, bullet.y, bullet.x, bullet.y + bullet.height);
        grd.addColorStop(0, '#fff');
        grd.addColorStop(1, bulletColor);
        
        ctx.fillStyle = grd;
        ctx.fillRect(bullet.x - bullet.width/2, bullet.y, bullet.width, bullet.height);
        
        // Add glow effect
        ctx.fillStyle = `rgba(${bulletColor === '#f00' ? '255, 0, 0' : (bulletColor === '#f0f' ? '255, 0, 255' : '0, 0, 255')}, 0.3)`;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y + bullet.height/2, bullet.width * 1.5, 0, Math.PI * 2);
        ctx.fill();
    });
}

// Check for collisions
function checkCollisions() {
    // 레이저 총알 특수 처리
    const laserBullets = player.bullets.filter(bullet => bullet.type === WEAPON_TYPES.LASER);
    
    // 레이저가 있으면 수직선 상의 모든 적에게 피해
    if (laserBullets.length > 0) {
        laserBullets.forEach(laser => {
            enemies.forEach(enemy => {
                if (enemy.alive && 
                    laser.x + laser.width/2 > enemy.x && 
                    laser.x - laser.width/2 < enemy.x + enemy.width) {
                    
                    // 적 체력 감소 또는 파괴
                    if (enemy.health && enemy.health > 1) {
                        enemy.health--;
                        createHitEffect(enemy.x + enemy.width/2, enemy.y + enemy.height/2);
                        // 적이 레이저에 피격된 적 있음을 표시
                        enemy.hitByLaser = true;
                    } else {
                        // 이미 죽은 적에게는 이펙트만
                        if (!enemy.hitByLaser) {
                            enemy.alive = false;
                            score += enemy.type === 'boss' ? 30 : (enemy.type === 'elite' ? 20 : 10);
                            scoreDisplay.textContent = score;
                            playSound('explosion');
                            createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color);
                            enemy.hitByLaser = true;
                        }
                    }
                }
            });
            
            // 레이저로 보너스 적 처리
            if (bonusEnemy && bonusEnemy.active && 
                laser.x + laser.width/2 > bonusEnemy.x && 
                laser.x - laser.width/2 < bonusEnemy.x + bonusEnemy.width) {
                // Hit bonus enemy
                bonusEnemy.active = false;
                
                // Special effect for bonus enemy explosion
                for (let j = 0; j < 30; j++) {
                    createExplosion(bonusEnemy.x + bonusEnemy.width/2, bonusEnemy.y + bonusEnemy.height/2, bonusEnemy.color);
                }
                
                // Give points - 레벨에 따라 점수 증가
                score += BONUS_SCORE + (level - 1) * 50;
                scoreDisplay.textContent = score;
                
                // Upgrade weapon
                upgradeWeapon(bonusEnemy.weaponDrop);
            }
        });
    }
    
    // 일반 총알 충돌 처리
    for (let i = player.bullets.length - 1; i >= 0; i--) {
        const bullet = player.bullets[i];
        
        // 레이저는 이미 위에서 처리했으므로 건너뛰기
        if (bullet.type === WEAPON_TYPES.LASER) continue;
        
        let bulletHit = false;
        
        // Check for collision with bonus enemy
        if (bonusEnemy && bonusEnemy.active) {
            if (bullet.x > bonusEnemy.x && 
                bullet.x < bonusEnemy.x + bonusEnemy.width && 
                bullet.y > bonusEnemy.y && 
                bullet.y < bonusEnemy.y + bonusEnemy.height) {
                
                // Hit bonus enemy
                bonusEnemy.active = false;
                
                // Special effect for bonus enemy explosion
                for (let j = 0; j < 30; j++) {
                    createExplosion(bonusEnemy.x + bonusEnemy.width/2, bonusEnemy.y + bonusEnemy.height/2, bonusEnemy.color);
                }
                
                // Give points - 레벨에 따라 점수 증가
                score += BONUS_SCORE + (level - 1) * 50;
                scoreDisplay.textContent = score;
                
                // Upgrade weapon
                upgradeWeapon(bonusEnemy.weaponDrop);
                
                // Remove bullet
                player.bullets.splice(i, 1);
                
                bulletHit = true;
                continue;
            }
        }
        
        // Check for collision with regular enemies
        if (!bulletHit) {
            for (let j = 0; j < enemies.length; j++) {
                const enemy = enemies[j];
                
                if (enemy.alive && 
                    bullet.x > enemy.x && 
                    bullet.x < enemy.x + enemy.width && 
                    bullet.y > enemy.y && 
                    bullet.y < enemy.y + enemy.height) {
                    
                    // Enemy hit - 체력이 있는 적은 체력 감소
                    if (enemy.health && enemy.health > 1) {
                        enemy.health--;
                        // 피격 효과
                        createHitEffect(enemy.x + enemy.width/2, enemy.y + enemy.height/2);
                        // 총알 제거
                        player.bullets.splice(i, 1);
                        bulletHit = true;
                    } else {
                        // 체력이 1 이하면 파괴
                        enemy.alive = false;
                        
                        // 점수 추가 - 레벨 및 적 타입별 차등 점수
                        score += enemy.type === 'boss' ? 30 : 
                                (enemy.type === 'elite' ? 20 : 10);
                        scoreDisplay.textContent = score;
                        
                        // Remove bullet
                        player.bullets.splice(i, 1);
                        
                        // Play explosion sound
                        playSound('explosion');
                        
                        // Add explosion effect
                        createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color);
                        
                        bulletHit = true;
                    }
                    break;
                }
            }
        }
    }
    
    // Enemy bullets hitting player
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        
        if (bullet.x > player.x - player.width / 2 && 
            bullet.x < player.x + player.width / 2 && 
            bullet.y > player.y - player.height / 2 && 
            bullet.y < player.y + player.height / 2) {
            
            // Player hit
            enemyBullets.splice(i, 1);
            lives--;
            livesDisplay.textContent = lives;
            
            // Reset weapon to basic on hit
            player.weaponType = WEAPON_TYPES.SINGLE;
            player.weaponDuration = 0;
            
            // Play explosion sound
            playSound('explosion');
            
            // Add explosion effect
            createExplosion(player.x, player.y, player.color);
        }
    }
}

// Explosion particles array
const explosions = [];

// Create explosion effect
function createExplosion(x, y, color) {
    const particleCount = 20;
    
    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        
        explosions.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 1 + Math.random() * 3,
            color: color,
            alpha: 1,
            life: 30 + Math.random() * 20
        });
    }
}

// Update and draw explosions
function updateExplosions() {
    for (let i = explosions.length - 1; i >= 0; i--) {
        const particle = explosions[i];
        
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // Update alpha
        particle.alpha = particle.life / 50;
        
        // Update life
        particle.life--;
        
        // Remove dead particles
        if (particle.life <= 0) {
            explosions.splice(i, 1);
            continue;
        }
        
        // Draw particle
        ctx.fillStyle = `rgba(${hexToRgb(particle.color)}, ${particle.alpha})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Convert hex color to rgb for explosion particles
function hexToRgb(hex) {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? 
        parseInt(result[1], 16) + ',' + parseInt(result[2], 16) + ',' + parseInt(result[3], 16) :
        '255,255,255';
}

// Draw level complete screen with countdown
function drawLevelComplete(remainingSeconds) {
    // Update explosions (they should continue during level complete screen)
    updateExplosions();
    
    // 레벨에 따라 다른 배경 색상
    const levelColors = [
        {main: '#6a11cb', secondary: '#2575fc'}, // 레벨 1
        {main: '#1152cb', secondary: '#25c8fc'}, // 레벨 2
        {main: '#cb1178', secondary: '#fc25bb'}, // 레벨 3
        {main: '#cb5c11', secondary: '#fc9425'}  // 레벨 4 이상
    ];
    
    // 레벨 색상은 현재 완료한 레벨(level-1)에 기반함
    const colorIndex = Math.min((level-2), levelColors.length - 1);
    const colors = levelColors[Math.max(0, colorIndex)];
    
    // Draw semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Draw stars to maintain the space theme
    drawStars();
    
    // Draw level complete message with gradient based on level
    const textGradient = ctx.createLinearGradient(
        GAME_WIDTH/2 - 200, GAME_HEIGHT/2 - 70,
        GAME_WIDTH/2 + 200, GAME_HEIGHT/2 - 70
    );
    textGradient.addColorStop(0, colors.main);
    textGradient.addColorStop(1, colors.secondary);
    
    ctx.fillStyle = textGradient;
    ctx.font = 'bold 50px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`레벨 ${level-1} 클리어!`, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 70);
    
    // Add glow to the text
    ctx.shadowColor = colors.secondary;
    ctx.shadowBlur = 20;
    ctx.fillText(`레벨 ${level-1} 클리어!`, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 70);
    ctx.shadowBlur = 0;
    
    // Draw next level info
    ctx.fillStyle = '#fff';
    ctx.font = '28px Orbitron, sans-serif';
    ctx.fillText(`다음 레벨: ${level}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20);
    
    // Draw score with animated color
    const time = Date.now() * 0.001;
    const hue = (time * 20) % 360;
    ctx.fillStyle = `hsl(${hue}, 100%, 70%)`;
    ctx.font = '30px Orbitron, sans-serif';
    ctx.fillText(`점수: ${score}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20);
    
    // Draw level info
    ctx.fillStyle = '#fff';
    ctx.font = '24px Orbitron, sans-serif';
    ctx.fillText(`레벨 ${level} 시작까지:`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60);
    
    // Draw countdown timer with pulsing effect
    const pulseSize = 1 + 0.2 * Math.sin(time * 5);
    
    ctx.font = `${60 * pulseSize}px Orbitron, sans-serif`;
    
    // Draw glowing circle around the number
    ctx.fillStyle = `rgba(${parseInt(colors.secondary.slice(1, 3), 16)}, ${parseInt(colors.secondary.slice(3, 5), 16)}, ${parseInt(colors.secondary.slice(5, 7), 16)}, 0.2)`;
    ctx.beginPath();
    ctx.arc(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 120, 50, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw countdown number or GO! text
    ctx.fillStyle = colors.secondary;
    
    // 카운트다운 숫자 표시 - 마지막 1초간도 정확히 처리
    let countdownText;
    if (remainingSeconds <= 0) {
        // 타이머가 0 이하이면 "GO!" 표시
        countdownText = "GO!";
        
        // 강제로 다음 레벨로 진행 (타이머가 0 이하면 바로 다음 레벨로)
        if (gameState === GAME_STATE.LEVEL_COMPLETE) {
            // 타이머 사용을 최소화하고 즉시 전환 시도
            console.log("GO! 메시지 표시 - 즉시 다음 레벨로 전환");
            
            // 게임 상태 설정
            gameState = GAME_STATE.PLAYING;
            showingLevelComplete = false;
            gameActive = true;
            levelCompleteTime = 0;
            
            if (nextLevelTimer) {
                clearTimeout(nextLevelTimer);
                nextLevelTimer = null;
            }
            
            // 다음 프레임에서 다음 레벨 시작하도록 예약 (타이머 없이)
            window.requestAnimationFrame(() => {
                console.log("다음 프레임에서 새 레벨 시작");
                startNextLevel();
            });
        }
    } else {
        countdownText = `${remainingSeconds}`;
        // 카운트다운이 아직 진행 중인데 타이머가 설정되어 있다면 취소
        if (nextLevelTimer) {
            clearTimeout(nextLevelTimer);
            nextLevelTimer = null;
        }
    }
    
    // 글자 그리기 - 명확하게 표시
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${60 * pulseSize}px Orbitron, sans-serif`;
    ctx.fillText(countdownText, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 120);
    
    console.log(`그려진 카운트다운: ${countdownText}, 실제 남은 시간: ${remainingSeconds}, 게임 상태: ${gameState}, 레벨: ${level}`);
    
    // Draw level features
    ctx.font = '18px Orbitron, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    
    // 레벨별 특징 설명
    let features = [];
    
    // 다음 레벨의 특징 표시
    if (level === 1) {
        features = ["기본 적 구성", "느린 적 속도", "적은 총알"];
    } else if (level === 2) {
        features = ["적 속도 증가", "더 많은 적", "특수 배치 패턴"];
    } else if (level === 3) {
        features = ["강화된 보스", "빠른 총알", "높은 점수 보너스"];
    } else {
        features = ["최대 난이도", "다중 체력 적", "높은 총알 발사율"];
    }
    
    // 레벨 특징 표시
    ctx.fillText("다음 레벨 특징:", GAME_WIDTH / 2, GAME_HEIGHT / 2 + 180);
    
    features.forEach((feature, index) => {
        ctx.fillText(`• ${feature}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 210 + index * 25);
    });
    
    // Draw tips based on level
    ctx.font = '16px Roboto, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    
    let tip = "황금색 UFO를 격추하면 특수 무기를 얻을 수 있습니다!";
    if (level > 1) {
        const tips = [
            "황금색 UFO를 격추하면 특수 무기를 얻을 수 있습니다!",
            "적의 총알을 피하기 위해 계속 움직이세요!",
            "보라색 레이저 무기는 여러 적을 관통합니다!",
            "목숨을 잃으면 특수 무기도 사라집니다!",
            "적이 지구에 도달하기 전에 격추하세요!"
        ];
        tip = tips[level % tips.length];
    }
    
    ctx.fillText(tip, GAME_WIDTH / 2, GAME_HEIGHT - 40);
}

// Start the next level
function startNextLevel() {
    console.log(`=== 레벨 ${level} 시작 ===`);
    
    // 게임 상태 초기화
    gameState = GAME_STATE.PLAYING;
    showingLevelComplete = false;
    gameActive = true;
    levelCompleteTime = 0;
    
    // 타이머 정리
    if (nextLevelTimer) {
        clearTimeout(nextLevelTimer);
        nextLevelTimer = null;
    }
    
    // 게임 루프 정리
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null;
    }
    
    // UI 업데이트
    levelDisplay.textContent = level;
    
    // 게임 객체들 초기화
    player.bullets = [];
    enemies.length = 0;
    enemyBullets.length = 0;
    explosions.length = 0;
    
    // 플레이어 위치 초기화
    player.x = GAME_WIDTH / 2;
    
    console.log(`게임 상태 초기화 완료, 적 생성 시작`);
    
    // 적 생성
    createEnemyGrid();
    
    console.log(`적 생성 완료: ${enemies.length}개, 게임 루프 시작`);
    
    // 게임 루프 시작
    gameLoopId = requestAnimationFrame(gameLoop);
    
    console.log(`=== 레벨 ${level} 시작 완료 ===`);
}

// Check for game over conditions
function checkGameOver() {
    // All enemies destroyed
    const allEnemiesDestroyed = enemies.every(enemy => !enemy.alive);
    
    if (allEnemiesDestroyed && gameState === GAME_STATE.PLAYING) {
        // Add score bonus
        const levelBonus = 100 * level;
        score += levelBonus;
        level++; // 다음 레벨로 증가
        
        // UI 업데이트
        scoreDisplay.textContent = score;
        
        console.log(`모든 적 처치! 레벨 ${level-1} 클리어, 다음 레벨 ${level}로 진행, 보너스: ${levelBonus}`);
        
        // 타이머가 설정되어 있다면 취소 (안전장치)
        if (nextLevelTimer) {
            clearTimeout(nextLevelTimer);
            nextLevelTimer = null;
        }
        
        // 레벨 완료 화면 표시 및 타이머 설정 - 시간 감소 (원래 5초에서 3초로 줄임)
        levelCompleteDuration = 3000; // 3초만 표시
        gameState = GAME_STATE.LEVEL_COMPLETE;
        showingLevelComplete = true;
        levelCompleteTime = Date.now();
        console.log(`레벨 완료 화면으로 전환: 레벨 ${level-1} -> ${level}, 타이머: ${levelCompleteTime}, 지속시간: ${levelCompleteDuration}ms`);
        
        // 백업 타이머 설정 - 3.5초 후 강제 전환 (시각 효과를 위해 0.5초 더 지연)
        nextLevelTimer = setTimeout(() => {
            console.log("백업 타이머에 의한 레벨 전환");
            if (gameState === GAME_STATE.LEVEL_COMPLETE) {
                gameState = GAME_STATE.PLAYING;
                showingLevelComplete = false;
                startNextLevel();
            }
        }, levelCompleteDuration + 500);
        
        return false; // 게임 계속 진행
    }
    
    // 레벨 시작 했는데 적이 없는 경우 (버그)
    if (enemies.length === 0 && gameState === GAME_STATE.PLAYING) {
        console.error("에러: 적이 없는 레벨이 시작됨 - 적 강제 생성");
        createEnemyGrid(); // 적 생성 재시도
        return false;
    }
    
    // Player lost all lives
    if (lives <= 0) {
        gameState = GAME_STATE.GAME_OVER;
        gameActive = false;
        showingLevelComplete = false;
        backgroundMusic.stop();
        playSound('gameOver');
        
        // Display game over message
        ctx.fillStyle = '#fff';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', GAME_WIDTH / 2, GAME_HEIGHT / 2);
        ctx.font = '24px Arial';
        ctx.fillText('Final Score: ' + score, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50);
        return true; // 게임 오버 처리됨
    }
    
    // Enemies reached the bottom
    for (const enemy of enemies) {
        if (enemy.alive && enemy.y + enemy.height > player.y - player.height / 2) {
            gameState = GAME_STATE.GAME_OVER;
            gameActive = false;
            showingLevelComplete = false;
            backgroundMusic.stop();
            playSound('gameOver');
            
            // Display game over message
            ctx.fillStyle = '#fff';
            ctx.font = '48px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('GAME OVER', GAME_WIDTH / 2, GAME_HEIGHT / 2);
            ctx.font = '24px Arial';
            ctx.fillText('Enemies reached Earth!', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50);
            ctx.fillText('Final Score: ' + score, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90);
            return true; // 게임 오버 처리됨
        }
    }
    
    return false; // 아무 이벤트도 발생하지 않음
}

// Upgrade player's weapon
function upgradeWeapon(weaponType) {
    player.weaponType = weaponType;
    player.weaponDuration = 15000; // 15 seconds
    
    // Special effects for weapon upgrade
    createWeaponUpgradeEffect();
    playWeaponUpgradeSound();
}

// Create visual effect for weapon upgrade
function createWeaponUpgradeEffect() {
    // Create particles surrounding the player
    const particleCount = 30;
    
    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        const distance = 30 + Math.random() * 30;
        
        explosions.push({
            x: player.x + Math.cos(angle) * distance,
            y: player.y + Math.sin(angle) * distance,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 1 + Math.random() * 3,
            color: '#0ff',
            alpha: 1,
            life: 30 + Math.random() * 20
        });
    }
}

// Play sound for weapon upgrade
function playWeaponUpgradeSound() {
    if (!audioContext || !soundsEnabled) return;
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'square';
        
        // Ascending sound
        oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.2);
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime + 0.3);
        oscillator.frequency.exponentialRampToValueAtTime(1000, audioContext.currentTime + 0.5);
        
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.6);
        
        oscillator.onended = function() {
            oscillator.disconnect();
            gainNode.disconnect();
        };
    } catch (e) {
        console.error('Error playing weapon upgrade sound:', e);
    }
}

// Fire player weapon
function fireWeapon() {
    const now = Date.now();
    if (!player.canShoot || now - player.lastShot < player.shootCooldown) return;
    
    // Play shoot sound
    playSound('shoot');
    
    // Fire based on weapon type
    switch (player.weaponType) {
        case WEAPON_TYPES.DOUBLE:
            player.bullets.push({
                x: player.x - 15,
                y: player.y - player.height / 2,
                type: player.weaponType
            });
            player.bullets.push({
                x: player.x + 15,
                y: player.y - player.height / 2,
                type: player.weaponType
            });
            break;
            
        case WEAPON_TYPES.TRIPLE:
            player.bullets.push({
                x: player.x,
                y: player.y - player.height / 2,
                type: player.weaponType
            });
            player.bullets.push({
                x: player.x - 15,
                y: player.y - player.height / 2 + 10,
                vx: -0.5,
                type: player.weaponType
            });
            player.bullets.push({
                x: player.x + 15,
                y: player.y - player.height / 2 + 10,
                vx: 0.5,
                type: player.weaponType
            });
            break;
            
        case WEAPON_TYPES.LASER:
            // 레이저 총알 개선 - 유지 시간 추가
            player.bullets.push({
                x: player.x,
                y: 0, // 화면 상단
                height: player.y - player.height / 2, // 플레이어까지의 길이
                width: 4, // 레이저 너비
                type: player.weaponType,
                isLaser: true, // 레이저임을 명시적으로 표시
                lifeTime: 30 // 약 0.5초 (프레임 기준)
            });
            break;
            
        case WEAPON_TYPES.SPREAD:
            for (let i = -2; i <= 2; i++) {
                player.bullets.push({
                    x: player.x,
                    y: player.y - player.height / 2,
                    vx: i * 0.5,
                    type: player.weaponType
                });
            }
            break;
            
        default: // Single bullet (default)
            player.bullets.push({
                x: player.x,
                y: player.y - player.height / 2,
                type: WEAPON_TYPES.SINGLE
            });
    }
    
    player.lastShot = now;
}

// Event listeners
document.addEventListener('keydown', function(e) {
    if (!gameActive) return;
    
    // Move player
    if (e.key === 'ArrowLeft' || e.key === 'a') {
        player.x = Math.max(player.width / 2, player.x - player.speed);
    } else if (e.key === 'ArrowRight' || e.key === 'd') {
        player.x = Math.min(GAME_WIDTH - player.width / 2, player.x + player.speed);
    }
    
    // Shoot
    if (e.key === ' ' || e.key === 'ArrowUp') {
        fireWeapon();
    }
});

// Touch/mouse controls
canvas.addEventListener('mousemove', function(e) {
    if (!gameActive) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    // 캔버스 스케일을 고려한 X 좌표 계산
    const gameX = mouseX / (rect.width / GAME_WIDTH);
    player.x = Math.max(player.width / 2, Math.min(GAME_WIDTH - player.width / 2, gameX));
});

canvas.addEventListener('click', function(e) {
    if (!gameActive && !showingLevelComplete) {
        // If clicking on title screen, start game
        initGame();
        return;
    }
    
    if (gameActive) {
        fireWeapon();
    }
});

// Start button
startButton.addEventListener('click', function() {
    // 모든 타이머 정리
    if (nextLevelTimer) {
        clearTimeout(nextLevelTimer);
        nextLevelTimer = null;
    }
    
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null;
    }
    
    // 게임 상태 변수 강제 리셋
    gameState = GAME_STATE.MENU;
    level = 1;
    showingLevelComplete = false;
    levelCompleteTime = 0;
    gameActive = false;
    
    // Resume audio context if needed
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    // 게임 시작 전 모든 상태 초기화
    console.log("게임 시작 버튼 클릭 - 모든 상태 초기화");
    
    // 게임 초기화 및 시작
    initGame();
});

// Initialize game with default screen
window.onload = function() {
    // 캔버스 크기 초기 조정
    resizeCanvas();
    
    // Draw title screen
    ctx.fillStyle = '#0f0f1b';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Draw stars and nebulas in background
    drawStars();
    
    // Draw the title with gradient and glow
    const gradient = ctx.createLinearGradient(GAME_WIDTH/2 - 200, GAME_HEIGHT/3, GAME_WIDTH/2 + 200, GAME_HEIGHT/3);
    gradient.addColorStop(0, "#6a11cb");
    gradient.addColorStop(0.5, "#2575fc");
    gradient.addColorStop(1, "#f06");
    
    ctx.fillStyle = gradient;
    ctx.font = 'bold 48px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('톱니바꿈의', GAME_WIDTH / 2, GAME_HEIGHT / 3 - 50);
    ctx.fillText('겔러그 소환', GAME_WIDTH / 2, GAME_HEIGHT / 3);
    
    // Add glow effect to title
    ctx.shadowColor = '#2575fc';
    ctx.shadowBlur = 20;
    ctx.fillText('톱니바꿈의', GAME_WIDTH / 2, GAME_HEIGHT / 3 - 50);
    ctx.fillText('겔러그 소환', GAME_WIDTH / 2, GAME_HEIGHT / 3);
    ctx.shadowBlur = 0;
    
    // Add subtitle
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '20px Roboto, sans-serif';
    ctx.fillText('클래식 슈팅 게임의 현대적 재해석', GAME_WIDTH / 2, GAME_HEIGHT / 3 + 40);
    
    ctx.fillStyle = '#fff';
    ctx.font = '24px Orbitron, sans-serif';
    ctx.fillText('게임 시작 버튼을 클릭하세요', GAME_WIDTH / 2, GAME_HEIGHT / 2);
    
    // Draw sample enemies
    const demoX = GAME_WIDTH / 2;
    const demoY = GAME_HEIGHT / 1.7;
    
    // Draw a boss enemy
    const boss = {animationFrame: 0, type: 'boss'};
    drawBossEnemy(demoX - 80, demoY, 40, 30, boss);
    
    // Draw an elite enemy
    const elite = {animationFrame: 0, type: 'elite'};
    drawEliteEnemy(demoX, demoY, 40, 30, elite);
    
    // Draw a regular enemy
    const regular = {animationFrame: 0, type: 'regular'};
    drawRegularEnemy(demoX + 80, demoY, 40, 30, regular);
    
    // Draw bonus UFO
    const ufo = {
        x: demoX + 160 - BONUS_WIDTH/2,
        y: demoY - BONUS_HEIGHT/2,
        width: BONUS_WIDTH,
        height: BONUS_HEIGHT,
        animationFrame: 0,
        animationCounter: 0,
        active: true,
        color: '#ff0',
        weaponDrop: WEAPON_TYPES.LASER,
        direction: -1
    };
    // 데모화면을 위해 임시로 bonusEnemy 설정
    bonusEnemy = ufo;
    drawBonusEnemy();
    bonusEnemy = null; // 데모 후 초기화
    
    // Draw player ship
    player.x = GAME_WIDTH / 2;
    player.y = GAME_HEIGHT / 1.3;
    drawPlayer();
    
    // Version info
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '14px Roboto, sans-serif';
    ctx.fillText('Version 2.0 - 현대적 디자인 & 추가 기능', GAME_WIDTH / 2, GAME_HEIGHT - 20);
    
    // 디버깅: 페이지 로딩 후 즉시 보너스 적 생성
    setTimeout(() => {
        console.log("Creating initial bonus enemy for testing");
        spawnBonusEnemy();
    }, 1000);
}; 

// 적 피격 효과 생성
function createHitEffect(x, y) {
    // 작은 반짝임 효과 생성
    for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 1;
        
        explosions.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 1 + Math.random() * 2,
            color: '#fff', // 흰색 반짝임
            alpha: 1,
            life: 10 + Math.random() * 10
        });
    }
}

// 터치 이벤트 처리
canvas.addEventListener('touchmove', function(e) {
    if (!gameActive) return;
    e.preventDefault(); // 터치 시 스크롤 방지
    
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const touchX = touch.clientX - rect.left;
    // 캔버스 스케일을 고려한 X 좌표 계산
    const gameX = touchX / (rect.width / GAME_WIDTH);
    player.x = Math.max(player.width / 2, Math.min(GAME_WIDTH - player.width / 2, gameX));
});

canvas.addEventListener('touchstart', function(e) {
    if (!gameActive && !showingLevelComplete) {
        // 타이틀 화면에서 터치하면 게임 시작
        initGame();
        return;
    }
    
    // 게임 플레이 중 터치 시 자동 발사
    if (gameActive) {
        fireWeapon();
    }
});

// 창 크기 변경 시 캔버스 크기 조정
window.addEventListener('resize', resizeCanvas);