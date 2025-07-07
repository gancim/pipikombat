// Game state
let socket;
let player = null;
let otherPlayers = new Map();
let townMap = null; // Store the town map
let peeMarks = new Map();
let poopMines = new Map();
let gameStarted = false;
let gameStartTime = null;
let gameTime = 5 * 60; // 5 minutes
let keys = {};
let lastPeeTime = 0;
let lastPoopTime = 0;
let lastCuddleTime = 0;

// Mobile touch state
let touchStartX = 0;
let touchStartY = 0;
let isTouching = false;
let touchDirection = { x: 0, y: 0 };

// Add breed and color selection logic
let selectedColor = null;
let selectedPeeColor = null;

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const BASE_WIDTH = 800;
const BASE_HEIGHT = 600;

// Scaling variables for full-screen support
let scaleX = 1;
let scaleY = 1;
let offsetX = 0;
let offsetY = 0;

// Add roundRect polyfill for kawaii rounded corners
if (!ctx.roundRect) {
  ctx.roundRect = function(x, y, width, height, radius) {
    this.beginPath();
    this.moveTo(x + radius, y);
    this.lineTo(x + width - radius, y);
    this.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.lineTo(x + width, y + height - radius);
    this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.lineTo(x + radius, y + height);
    this.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.lineTo(x, y + radius);
    this.quadraticCurveTo(x, y, x + radius, y);
    this.closePath();
  };
}

function resizeCanvas() {
  // Make canvas fill the entire available space
  const gameArea = document.querySelector('.game-area');
  if (gameArea) {
    const rect = gameArea.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    
    // Calculate scaling to fit the game world
    scaleX = canvas.width / BASE_WIDTH;
    scaleY = canvas.height / BASE_HEIGHT;
    
    // Use the smaller scale to maintain aspect ratio
    const scale = Math.min(scaleX, scaleY);
    scaleX = scale;
    scaleY = scale;
    
    // Calculate centering offsets
    offsetX = (canvas.width - BASE_WIDTH * scale) / 2;
    offsetY = (canvas.height - BASE_HEIGHT * scale) / 2;
  } else {
    // Fallback to window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    
    scaleX = canvas.width / BASE_WIDTH;
    scaleY = canvas.height / BASE_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    scaleX = scale;
    scaleY = scale;
    
    offsetX = (canvas.width - BASE_WIDTH * scale) / 2;
    offsetY = (canvas.height - BASE_HEIGHT * scale) / 2;
  }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// DOM elements
const welcomeScreen = document.getElementById('welcomeScreen');
const gameScreen = document.getElementById('gameScreen');
const playerNameInput = document.getElementById('playerName');
const joinGameBtn = document.getElementById('joinGameBtn');
const playerNameDisplay = document.getElementById('playerNameDisplay');
const heartsDisplay = document.getElementById('heartsDisplay');
const peeBarFill = document.getElementById('peeBarFill');
const timerDisplay = document.getElementById('timerDisplay');
const leaderboardModal = document.getElementById('leaderboardModal');
const leaderboardList = document.getElementById('leaderboardList');
const gameOverModal = document.getElementById('gameOverModal');
const gameOverContent = document.getElementById('gameOverContent');

// Mobile control buttons
const mobilePeeBtn = document.getElementById('mobilePeeBtn');
const mobilePoopBtn = document.getElementById('mobilePoopBtn');
const mobileHugBtn = document.getElementById('mobileHugBtn');
const mobileLeaderboardBtn = document.getElementById('mobileLeaderboardBtn');

// Dog emojis for different breeds
const DOG_EMOJIS = {
  'Shiba': '🐕',
  'Beagle': '🐶',
  'Bassotto': '🦴',
  'Bulldog': '🐾',
  'Barboncino': '🦴',
  'Golden Retriever': '🦮',
  'Labrador': '🐕‍🦺',
  'Chihuahua': '🐩'
};

// --- RPS Battle Modal Logic ---
let currentBattleId = null;
let rpsTimeout = null;

function showRPSBattle(battleId, opponentName) {
  currentBattleId = battleId;
  const modal = document.getElementById('battleRPSModal');
  const msg = document.getElementById('battleRPSMessage');
  const countdown = document.getElementById('battleRPSCountdown');
  msg.textContent = `Battling ${opponentName}... Choose your move!`;
  countdown.textContent = '5';
  modal.classList.remove('hidden');
  let timeLeft = 5;
  let picked = false;
  const buttons = Array.from(document.querySelectorAll('.rps-btn'));
  buttons.forEach(btn => btn.classList.remove('selected'));

  function pick(choice) {
    if (picked) return;
    picked = true;
    buttons.forEach(btn => btn.disabled = true);
    // Only add .selected to the picked button
    const btn = buttons.find(b => b.dataset.choice === choice);
    if (btn) {
      btn.classList.add('selected');
      console.log('RPS selected:', choice, btn);
    }
    window.socket.emit('battleChoice', { battleId, choice });
  }

  buttons.forEach(btn => {
    btn.disabled = false;
    btn.onclick = () => pick(btn.dataset.choice);
  });

  rpsTimeout = setInterval(() => {
    timeLeft--;
    countdown.textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(rpsTimeout);
      if (!picked) {
        // Auto-pick random
        const random = ['rock','paper','scissors'][Math.floor(Math.random()*3)];
        pick(random);
      }
    }
  }, 1000);
}

function hideRPSBattle() {
  const modal = document.getElementById('battleRPSModal');
  modal.classList.add('hidden');
  if (rpsTimeout) clearInterval(rpsTimeout);
  // Remove .selected from all buttons
  const buttons = Array.from(document.querySelectorAll('.rps-btn'));
  buttons.forEach(btn => btn.classList.remove('selected'));
  currentBattleId = null;
}

// Mobile touch controls
function setupMobileControls() {
  // Mobile control buttons
  if (mobilePeeBtn) {
    mobilePeeBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      pee();
    });
    mobilePeeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      pee();
    });
  }
  
  if (mobilePoopBtn) {
    mobilePoopBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      poop();
    });
    mobilePoopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      poop();
    });
  }
  
  if (mobileHugBtn) {
    mobileHugBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      cuddle();
    });
    mobileHugBtn.addEventListener('click', (e) => {
      e.preventDefault();
      cuddle();
    });
  }
  
  if (mobileLeaderboardBtn) {
    mobileLeaderboardBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      showLeaderboard();
    });
    mobileLeaderboardBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showLeaderboard();
    });
  }

  // Canvas touch events for movement
  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
}

function handleTouchStart(e) {
  e.preventDefault();
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    isTouching = true;
    touchDirection = { x: 0, y: 0 };
  }
}

function handleTouchMove(e) {
  e.preventDefault();
  if (isTouching && e.touches.length === 1) {
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    
    // Calculate direction based on touch movement
    const threshold = 20; // Minimum movement threshold
    
    if (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold) {
      // Determine primary direction
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal movement
        touchDirection.x = deltaX > 0 ? 1 : -1;
        touchDirection.y = 0;
      } else {
        // Vertical movement
        touchDirection.x = 0;
        touchDirection.y = deltaY > 0 ? 1 : -1;
      }
    }
  }
}

function handleTouchEnd(e) {
  e.preventDefault();
  isTouching = false;
  touchDirection = { x: 0, y: 0 };
}

// Initialize game
function initGame() {
  // Connect to server
  socket = io();
  
  // Event listeners
  joinGameBtn.addEventListener('click', joinGame);
  
  // Keyboard controls
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
  
  // Canvas click handling for buttons
  canvas.addEventListener('click', handleCanvasClick);
  
  // Setup mobile controls
  setupMobileControls();
  
  // Close modal when clicking outside
  leaderboardModal.addEventListener('click', (e) => {
    if (e.target === leaderboardModal) {
      hideLeaderboard();
    }
  });
  
  // Socket event handlers
  setupSocketEvents();
  
  // Start game loop
  gameLoop();
  
  // Handle logo loading
  const logo = document.querySelector('.game-logo');
  const loading = document.querySelector('.logo-loading');
  const fallback = document.querySelector('.fallback-title');
  
  if (logo) {
    // Show loading initially
    if (loading) {
      loading.style.display = 'block';
    }
    
    logo.addEventListener('load', () => {
      console.log('Logo loaded successfully');
      logo.style.display = 'block';
      if (loading) {
        loading.style.display = 'none';
      }
      if (fallback) {
        fallback.style.display = 'none';
      }
    });
    
    logo.addEventListener('error', () => {
      console.log('Logo failed to load, showing fallback');
      logo.style.display = 'none';
      if (loading) {
        loading.style.display = 'none';
      }
      if (fallback) {
        fallback.style.display = 'block';
      }
    });
  }
}

// Add breed and color selection logic
function setupBreedAndColorSelection() {
  console.log('Setting up breed and color selection...');
  
  // Dog color selection
  const colorBtns = document.querySelectorAll('#colorSelect .color-btn');
  console.log('Found dog color buttons:', colorBtns.length);
  colorBtns.forEach((btn, index) => {
    console.log(`Dog color button ${index}:`, btn);
    btn.addEventListener('click', () => {
      console.log('Dog color button clicked:', btn.getAttribute('data-color'));
      colorBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedColor = btn.getAttribute('data-color');
      console.log('Selected dog color:', selectedColor);
    });
  });
  // Default to first dog color
  if (colorBtns.length > 0) {
    colorBtns[0].classList.add('selected');
    selectedColor = colorBtns[0].getAttribute('data-color');
    console.log('Default dog color set to:', selectedColor);
  }

  // Pee color selection
  const peeColorBtns = document.querySelectorAll('#peeColorSelect .color-btn');
  console.log('Found pee color buttons:', peeColorBtns.length);
  peeColorBtns.forEach((btn, index) => {
    console.log(`Pee color button ${index}:`, btn);
    btn.addEventListener('click', () => {
      console.log('Pee color button clicked:', btn.getAttribute('data-color'));
      peeColorBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedPeeColor = btn.getAttribute('data-color');
      console.log('Selected pee color:', selectedPeeColor);
    });
  });
  // Default to first pee color
  if (peeColorBtns.length > 0) {
    peeColorBtns[0].classList.add('selected');
    selectedPeeColor = peeColorBtns[0].getAttribute('data-color');
    console.log('Default pee color set to:', selectedPeeColor);
  }
}

// Socket event handlers
function setupSocketEvents() {
  socket.on('gameJoined', (data) => {
    player = data.player;
    townMap = data.townMap;
    updatePlayerDisplay();
    showGameScreen();
  });
  
  socket.on('gameStarted', (data) => {
    gameStarted = true;
    gameStartTime = data.startTime;
  });
  
  socket.on('playerJoined', (data) => {
    console.log('Client received playerJoined:', data.player.name, 'at', data.player.x, data.player.y);
    otherPlayers.set(data.player.id, data.player);
    console.log('Other players count after adding:', otherPlayers.size);
  });
  
  socket.on('playerMoved', (data) => {
    if (data.id !== player.id) {
      const otherPlayer = otherPlayers.get(data.id);
      if (otherPlayer) {
        otherPlayer.x = data.x;
        otherPlayer.y = data.y;
        otherPlayer.peeCharge = data.peeCharge;
      }
    }
  });
  
  socket.on('playerLeft', (data) => {
    otherPlayers.delete(data.id);
  });
  
  // In the peeMarked handler, generate and store splat points
  socket.on('peeMarked', (mark) => {
    // Generate static splat points for this mark
    const points = 8 + Math.floor(Math.random() * 5); // 8-12 points
    const baseRadius = 8 + Math.random() * 3; // 8-11 px
    mark.splat = [];
    for (let i = 0; i < points; i++) {
      const angle = (Math.PI * 2 / points) * i;
      const radius = baseRadius + Math.random() * 4 - 2; // -2 to +2 px
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      mark.splat.push({ x, y });
    }
    peeMarks.set(mark.id, mark);
  });
  
  socket.on('poopMinePlaced', (mine) => {
    poopMines.set(mine.id, mine);
  });
  
  socket.on('peeUsed', (data) => {
    player.peeCharge = data.peeCharge;
    updatePlayerDisplay();
  });
  
  socket.on('hitPoopMine', (data) => {
    player.hearts = data.hearts;
    updatePlayerDisplay();
    showNotification('poopNotification');
  });
  
  socket.on('playerDefeated', () => {
    showNotification('battleNotification', '敗北しました！10秒後にリスポーンします...');
  });
  
  socket.on('playerRespawned', (data) => {
    player.x = data.x;
    player.y = data.y;
    player.hearts = data.hearts;
    player.isAlive = true;
    updatePlayerDisplay();
  });
  
  socket.on('battleStart', (data) => {
    showRPSBattle(data.battleId, data.opponent.name);
  });
  socket.on('battleResult', (data) => {
    hideRPSBattle();
    // Show result as notification
    let msg = '';
    if (data.result === 'draw') {
      msg = `あいこ！（引き分け）`;
    } else if (data.winner === player.id) {
      msg = `勝ち！あなた: ${data.yourChoice} 相手: ${data.opponentChoice}`;
    } else if (data.loser === player.id) {
      msg = `負け... あなた: ${data.yourChoice} 相手: ${data.opponentChoice}`;
    }
    showNotification('battleNotification', msg);
    // Update hearts if provided
    if (data.hearts && data.hearts[player.id] !== undefined) {
      player.hearts = data.hearts[player.id];
      updatePlayerDisplay();
    }
  });
  
  socket.on('cuddleSuccess', (data) => {
    if (data.player1.id === player.id) {
      player.hearts = data.player1.hearts;
    } else if (data.player2.id === player.id) {
      player.hearts = data.player2.hearts;
    }
    updatePlayerDisplay();
    showNotification('cuddleNotification');
  });
  
  socket.on('leaderboardUpdate', (leaderboard) => {
    updateLeaderboard(leaderboard);
  });
  
  socket.on('gameEnded', (data) => {
    gameStarted = false;
    showGameOver(data.winner);
  });
}

// Update joinGame to send breed and color
function joinGame() {
  const playerName = playerNameInput.value.trim() || '匿名の犬';
  const breed = document.getElementById('breedSelect').value;
  const color = selectedColor || '#FFD700';
  const peeColor = selectedPeeColor || '#FFD700';
  console.log('Joining game with peeColor:', peeColor);
  socket.emit('joinGame', { name: playerName, breed, color, peeColor });
}

// Show game screen
function showGameScreen() {
  console.log('Showing game screen...');
  
  // Add retro transition effect
  welcomeScreen.classList.add('glitch');
  setTimeout(() => {
    welcomeScreen.classList.add('hidden');
    welcomeScreen.classList.remove('glitch');
    gameScreen.classList.remove('hidden');
    gameScreen.classList.add('glitch');
    setTimeout(() => {
      gameScreen.classList.remove('glitch');
      // Resize canvas for full screen after transition
      resizeCanvas();
    }, 300);
  }, 200);
  
  console.log('Game screen visible:', !gameScreen.classList.contains('hidden'));
}

// Update player display
function updatePlayerDisplay() {
  if (!player) return;
  playerNameDisplay.innerHTML = `<span>${player.name}</span> <span style='font-size:0.9em;color:#888;'>(${player.breed})</span>`;
  // Show a row of heart icons for each heart
  heartsDisplay.textContent = '';
  for (let i = 0; i < player.hearts; i++) {
    heartsDisplay.textContent += '❤️';
  }
  peeBarFill.style.width = `${player.peeCharge}%`;
  // Update player avatar (no emoji)
  const playerAvatar = document.getElementById('playerAvatar');
  playerAvatar.textContent = '';
  playerAvatar.style.backgroundColor = player.color;
}

// Handle keyboard input
function handleKeyDown(e) {
  keys[e.key.toLowerCase()] = true;
  
  // Action keys
  if (e.key === ' ') {
    e.preventDefault();
    pee();
  } else if (e.key.toLowerCase() === 'p') {
    e.preventDefault();
    poop();
  } else if (e.key.toLowerCase() === 'c') {
    e.preventDefault();
    cuddle();
  } else if (e.key === 'Escape') {
    // Close leaderboard with ESC key
    if (!leaderboardModal.classList.contains('hidden')) {
      hideLeaderboard();
    }
  }
}

function handleKeyUp(e) {
  keys[e.key.toLowerCase()] = false;
}

function handleCanvasClick(e) {
  if (!window.gameButtons) return;
  
  // Get click position relative to canvas
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  
  // Check if any button was clicked
  window.gameButtons.forEach(button => {
    if (x >= button.x && x <= button.x + button.width &&
        y >= button.y && y <= button.y + button.height) {
      
      // Execute button action
      switch (button.action) {
        case 'leaderboard':
          showLeaderboard();
          break;
      }
    }
  });
}

// Player actions
function pee() {
  if (!player || !player.isAlive || player.peeCharge < 20) return;
  
  // Check if there are at least 2 players (current player + at least 1 other)
  let aliveOtherPlayers = 0;
  for (const [id, otherPlayer] of otherPlayers) {
    if (otherPlayer.isAlive) {
      aliveOtherPlayers++;
    }
  }
  
  if (aliveOtherPlayers < 1) {
    showNotification('battleNotification', 'Need at least 2 players to pee!');
    return;
  }
  
  const now = Date.now();
  if (now - lastPeeTime < 1000) return; // Cooldown
  
  lastPeeTime = now;
  socket.emit('pee', { x: player.x, y: player.y });
}

function poop() {
  if (!player || !player.isAlive) return;
  
  // Check if there are at least 2 players (current player + at least 1 other)
  let aliveOtherPlayers = 0;
  for (const [id, otherPlayer] of otherPlayers) {
    if (otherPlayer.isAlive) {
      aliveOtherPlayers++;
    }
  }
  
  if (aliveOtherPlayers < 1) {
    showNotification('battleNotification', 'Need at least 2 players to poop!');
    return;
  }
  
  const now = Date.now();
  if (now - lastPoopTime < 3000) return; // Cooldown
  
  lastPoopTime = now;
  socket.emit('poop', { x: player.x, y: player.y });
}

function cuddle() {
  if (!player || !player.isAlive) return;
  
  const now = Date.now();
  if (now - lastCuddleTime < 2000) return; // Cooldown
  
  lastCuddleTime = now;
  
  // Find nearest player
  let nearestPlayer = null;
  let minDistance = Infinity;
  
  for (const [id, otherPlayer] of otherPlayers) {
    if (!otherPlayer.isAlive) continue;
    
    const distance = Math.sqrt(
      Math.pow(player.x - otherPlayer.x, 2) + 
      Math.pow(player.y - otherPlayer.y, 2)
    );
    
    if (distance < minDistance && distance < 40) {
      minDistance = distance;
      nearestPlayer = otherPlayer;
    }
  }
  
  if (nearestPlayer) {
    socket.emit('cuddle', { targetId: nearestPlayer.id });
  }
}

// Show notification
function showNotification(type, message = '') {
  const notification = document.getElementById(type);
  const content = notification.querySelector('div');
  
  if (message) {
    content.innerHTML = `<h3>${type === 'battleNotification' ? '⚔️ Battle!' : 
      type === 'cuddleNotification' ? '🤗 Hug Success!' : '💩 Poop Mine!'}</h3>
      <p>${message}</p>`;
  }
  
  notification.classList.remove('hidden');
  
  // Add retro glitch effect
  notification.classList.add('glitch');
  setTimeout(() => {
    notification.classList.remove('glitch');
  }, 300);
  
  setTimeout(() => {
    notification.classList.add('hidden');
  }, 3000);
}

// Update leaderboard
function updateLeaderboard(leaderboard) {
  leaderboardList.innerHTML = '';
  
  leaderboard.forEach((player, index) => {
    const item = document.createElement('div');
    item.className = `leaderboard-item ${index === 0 ? 'winner' : ''}`;
    
    item.innerHTML = `
      <div class="player-rank">#${index + 1}</div>
      <div class="player-details">
        <div class="player-name">${player.name}</div>
        <div class="player-breed">${player.breed}</div>
      </div>
      <div class="player-stats-leaderboard">
        <div class="territory-percentage">${player.territoryPercentage.toFixed(1)}% Territory</div>
        <div class="hearts-leaderboard">❤️ ${player.hearts}</div>
      </div>
    `;
    
    leaderboardList.appendChild(item);
  });
}

// Show game over
function showGameOver(winner) {
  gameOverContent.innerHTML = `
    <h3>🏆 Game Over!</h3>
    ${winner ? `
      <p><strong>Winner: ${winner.name}</strong></p>
      <p>Territory: ${winner.territoryPercentage.toFixed(1)}%</p>
      <p>Hearts: ❤️ ${winner.hearts}</p>
    ` : '<p>The game has ended!</p>'}
  `;
  
  gameOverModal.classList.remove('hidden');
}

// Show leaderboard
function showLeaderboard() {
  leaderboardModal.classList.remove('hidden');
  socket.emit('getLeaderboard');
}

// Hide leaderboard
function hideLeaderboard() {
  leaderboardModal.classList.add('hidden');
}

// Hide game over
function hideGameOver() {
  gameOverModal.classList.add('hidden');
  location.reload();
}

// Game loop
function gameLoop() {
  updatePlayerMovement();
  render();
  updateTimer();
  requestAnimationFrame(gameLoop);
}

// Update player movement
function updatePlayerMovement() {
  if (!player || !player.isAlive) return;
  
  const speed = 3;
  let moved = false;
  let wasInHouse = false;
  let peeRecharged = false;

  // Keyboard controls
  if (keys['w'] || keys['arrowup']) {
    player.y = Math.max(15, player.y - speed);
    moved = true;
  }
  if (keys['s'] || keys['arrowdown']) {
    player.y = Math.min(585, player.y + speed);
    moved = true;
  }
  if (keys['a'] || keys['arrowleft']) {
    player.x = Math.max(15, player.x - speed);
    moved = true;
  }
  if (keys['d'] || keys['arrowright']) {
    player.x = Math.min(785, player.x + speed);
    moved = true;
  }
  
  // Touch controls
  if (isTouching && (touchDirection.x !== 0 || touchDirection.y !== 0)) {
    if (touchDirection.y < 0) {
      player.y = Math.max(15, player.y - speed);
      moved = true;
    }
    if (touchDirection.y > 0) {
      player.y = Math.min(585, player.y + speed);
      moved = true;
    }
    if (touchDirection.x < 0) {
      player.x = Math.max(15, player.x - speed);
      moved = true;
    }
    if (touchDirection.x > 0) {
      player.x = Math.min(785, player.x + speed);
      moved = true;
    }
  }

  // --- Pee recharge in house logic ---
  if (townMap && townMap.houses && player) {
    for (const house of townMap.houses) {
      if (
        player.x > house.x &&
        player.x < house.x + house.width &&
        player.y > house.y &&
        player.y < house.y + house.height
      ) {
        wasInHouse = true;
        if (typeof player.peeCharge === 'number' && player.peeCharge < 100) {
          player.peeCharge = Math.min(100, player.peeCharge + 2); // Recharge 2% per frame
          peeRecharged = true;
        }
        break;
      }
    }
  }
  if (peeRecharged) {
    updatePlayerDisplay();
  }
  
  if (moved) {
    socket.emit('playerMove', { x: player.x, y: player.y });
  }
}

// Update timer
function updateTimer() {
  if (!gameStarted || !gameStartTime) return;
  
  const elapsed = Math.max(0, gameTime - (Date.now() - gameStartTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = Math.floor(elapsed % 60);
  
  timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Render game
function render() {
  // Full screen rendering with proper scaling
  ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
  ctx.translate(offsetX, offsetY);
  ctx.scale(scaleX, scaleY);
  console.log('Rendering, townMap:', townMap);
  
  // Clear canvas with kawaii pastel background
  const gradient = ctx.createLinearGradient(0, 0, 0, BASE_HEIGHT);
  gradient.addColorStop(0, '#FFE5F1'); // Soft pink sky
  gradient.addColorStop(1, '#E8F4FD'); // Soft blue ground
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
  
  if (!townMap) return;
  
  // Draw kawaii parks (grass areas) first
  townMap.parks.forEach(park => {
    // Soft pastel green background
    ctx.fillStyle = '#B8E6B8';
    ctx.fillRect(park.x, park.y, park.width, park.height);
    
    // Add kawaii grass texture with flowers
    ctx.strokeStyle = '#90EE90';
    ctx.lineWidth = 1;
    for (let i = 0; i < park.width; i += 15) {
      for (let j = 0; j < park.height; j += 15) {
        // Draw grass blades
        ctx.beginPath();
        ctx.moveTo(park.x + i, park.y + j);
        ctx.lineTo(park.x + i + 3, park.y + j - 5);
        ctx.stroke();
        
        // Draw cute flowers randomly
        if (Math.random() < 0.3) {
          ctx.fillStyle = ['#FFB6C1', '#FFC0CB', '#DDA0DD', '#F0E68C'][Math.floor(Math.random() * 4)];
          ctx.beginPath();
          ctx.arc(park.x + i + 5, park.y + j + 5, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    
    // Add kawaii border
    ctx.strokeStyle = '#98FB98';
    ctx.lineWidth = 3;
    ctx.strokeRect(park.x, park.y, park.width, park.height);
  });
  
  // Draw kawaii roads
  townMap.roads.forEach(road => {
    // Soft gray road
    ctx.fillStyle = '#F5F5F5';
    ctx.fillRect(road.x, road.y, road.width, road.height);
    
    // Add kawaii road markings with hearts
    ctx.strokeStyle = '#FFB6C1';
    ctx.lineWidth = 3;
    if (road.width > road.height) {
      // Horizontal road with dotted line
      for (let i = 0; i < road.width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(road.x + i, road.y + road.height / 2);
        ctx.lineTo(road.x + i + 10, road.y + road.height / 2);
        ctx.stroke();
      }
    } else {
      // Vertical road with dotted line
      for (let i = 0; i < road.height; i += 20) {
        ctx.beginPath();
        ctx.moveTo(road.x + road.width / 2, road.y + i);
        ctx.lineTo(road.x + road.width / 2, road.y + i + 10);
        ctx.stroke();
      }
    }
    
    // Add cute road border
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 2;
    ctx.strokeRect(road.x, road.y, road.width, road.height);
  });
  
  // Draw kawaii landmarks
  townMap.landmarks.forEach(landmark => {
    if (landmark.type === 'fountain') {
      // Draw kawaii fountain
      ctx.fillStyle = '#E6F3FF';
      ctx.fillRect(landmark.x, landmark.y, landmark.width, landmark.height);
      
      // Fountain base with rounded corners
      ctx.fillStyle = '#B0E0E6';
      ctx.beginPath();
      ctx.roundRect(landmark.x, landmark.y, landmark.width, landmark.height, 10);
      ctx.fill();
      
      // Fountain water effect with sparkles
      ctx.fillStyle = '#87CEEB';
      ctx.beginPath();
      ctx.arc(landmark.x + landmark.width/2, landmark.y + landmark.height/2, 15, 0, Math.PI * 2);
      ctx.fill();
      
      // Add sparkles around fountain
      ctx.fillStyle = '#FFD700';
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI * 2) / 8;
        const x = landmark.x + landmark.width/2 + Math.cos(angle) * 25;
        const y = landmark.y + landmark.height/2 + Math.sin(angle) * 25;
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Fountain border
      ctx.strokeStyle = '#4682B4';
      ctx.lineWidth = 3;
      ctx.strokeRect(landmark.x, landmark.y, landmark.width, landmark.height);
      
    } else if (landmark.type === 'shop') {
      // Draw kawaii shop
      ctx.fillStyle = '#FFE4E1';
      ctx.fillRect(landmark.x, landmark.y, landmark.width, landmark.height);
      
      // Shop base with rounded corners
      ctx.fillStyle = '#FFB6C1';
      ctx.beginPath();
      ctx.roundRect(landmark.x, landmark.y, landmark.width, landmark.height, 8);
      ctx.fill();
      
      // Kawaii shop sign
      ctx.fillStyle = '#FF69B4';
      ctx.fillRect(landmark.x + 10, landmark.y - 20, 80, 15);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('🏪 Shop', landmark.x + landmark.width/2, landmark.y - 10);
      
      // Add cute decorations
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(landmark.x + 15, landmark.y + 15, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(landmark.x + landmark.width - 15, landmark.y + 15, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  
  // Draw realistic kawaii houses in different architectural styles
  townMap.houses.forEach((house, index) => {
    const houseType = index % 5; // 5 different house types
    const centerX = house.x + house.width / 2;
    const centerY = house.y + house.height / 2;
    
    switch (houseType) {
      case 0: // Victorian House
        // Main structure with realistic proportions
        ctx.fillStyle = '#F5DEB3';
        ctx.fillRect(house.x, house.y, house.width, house.height);
        
        // Stone foundation
        ctx.fillStyle = '#8B7355';
        ctx.fillRect(house.x - 2, house.y + house.height - 8, house.width + 4, 8);
        
        // Victorian roof with proper pitch
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.moveTo(house.x - 10, house.y);
        ctx.lineTo(centerX, house.y - 25);
        ctx.lineTo(house.x + house.width + 10, house.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Chimney
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(centerX - 3, house.y - 35, 6, 15);
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 1;
        ctx.strokeRect(centerX - 3, house.y - 35, 6, 15);
        
        // Roof shingles detail
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(house.x - 10 + i * 8, house.y - i * 3);
          ctx.lineTo(house.x + house.width + 10 - i * 8, house.y - i * 3);
          ctx.stroke();
        }
        break;
        
      case 1: // Modern Minimalist House
        // Clean rectangular base
        ctx.fillStyle = '#F8F8FF';
        ctx.fillRect(house.x, house.y, house.width, house.height);
        
        // Flat roof with overhang
        ctx.fillStyle = '#2F4F4F';
        ctx.fillRect(house.x - 5, house.y - 8, house.width + 10, 8);
        
        // Large windows (modern style)
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(house.x + 8, house.y + 8, 25, 20);
        ctx.fillRect(house.x + house.width - 33, house.y + 8, 25, 20);
        
        // Window frames
        ctx.strokeStyle = '#2F4F4F';
        ctx.lineWidth = 2;
        ctx.strokeRect(house.x + 8, house.y + 8, 25, 20);
        ctx.strokeRect(house.x + house.width - 33, house.y + 8, 25, 20);
        
        // Minimalist door
        ctx.fillStyle = '#2F4F4F';
        ctx.fillRect(house.x + 25, house.y + 25, 30, 35);
        break;
        
      case 2: // Cottage House
        // Stone base
        ctx.fillStyle = '#D2B48C';
        ctx.fillRect(house.x, house.y, house.width, house.height);
        
        // Thatched roof with realistic texture
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.moveTo(house.x - 8, house.y);
        ctx.lineTo(centerX, house.y - 20);
        ctx.lineTo(house.x + house.width + 8, house.y);
        ctx.closePath();
        ctx.fill();
        
        // Thatch texture lines
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
          ctx.beginPath();
          ctx.moveTo(house.x - 8 + i * 4, house.y - i * 2);
          ctx.lineTo(house.x + house.width + 8 - i * 4, house.y - i * 2);
          ctx.stroke();
        }
        
        // Stone wall texture
        ctx.strokeStyle = '#A0522D';
        ctx.lineWidth = 1;
        for (let i = 0; i < house.height; i += 8) {
          ctx.beginPath();
          ctx.moveTo(house.x, house.y + i);
          ctx.lineTo(house.x + house.width, house.y + i);
          ctx.stroke();
        }
        break;
        
      case 3: // Japanese Traditional House
        // Wooden structure
        ctx.fillStyle = '#DEB887';
        ctx.fillRect(house.x, house.y, house.width, house.height);
        
        // Sloped roof with traditional tiles
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.moveTo(house.x - 5, house.y);
        ctx.lineTo(centerX, house.y - 18);
        ctx.lineTo(house.x + house.width + 5, house.y);
        ctx.closePath();
        ctx.fill();
        
        // Roof tile pattern
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          ctx.moveTo(house.x - 5 + i * 6, house.y - i * 2);
          ctx.lineTo(house.x + house.width + 5 - i * 6, house.y - i * 2);
          ctx.stroke();
        }
        
        // Wooden beams
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(house.x, house.y + 15);
        ctx.lineTo(house.x + house.width, house.y + 15);
        ctx.moveTo(house.x, house.y + 35);
        ctx.lineTo(house.x + house.width, house.y + 35);
        ctx.stroke();
        break;
        
      case 4: // Mediterranean Villa
        // Stucco walls
        ctx.fillStyle = '#F5F5DC';
        ctx.fillRect(house.x, house.y, house.width, house.height);
        
        // Terracotta roof tiles
        ctx.fillStyle = '#CD5C5C';
        ctx.beginPath();
        ctx.moveTo(house.x - 8, house.y);
        ctx.lineTo(centerX, house.y - 22);
        ctx.lineTo(house.x + house.width + 8, house.y);
        ctx.closePath();
        ctx.fill();
        
        // Roof tile detail
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 1;
        for (let i = 0; i < 7; i++) {
          ctx.beginPath();
          ctx.moveTo(house.x - 8 + i * 5, house.y - i * 2.5);
          ctx.lineTo(house.x + house.width + 8 - i * 5, house.y - i * 2.5);
          ctx.stroke();
        }
        
        // Balcony
        ctx.fillStyle = '#DEB887';
        ctx.fillRect(house.x + 10, house.y + 15, 20, 8);
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2;
        ctx.strokeRect(house.x + 10, house.y + 15, 20, 8);
        
        // Balcony railing
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(house.x + 12 + i * 4, house.y + 15);
          ctx.lineTo(house.x + 12 + i * 4, house.y + 23);
          ctx.stroke();
        }
        break;
    }
    
    // Realistic doors and windows for each house type
    let doorX = house.x + 15;
    let doorY = house.y + 25;
    let doorWidth = 30;
    let doorHeight = 35;
    
    if (houseType === 1) { // Modern house
      doorX = house.x + 25;
      doorY = house.y + 25;
      doorWidth = 30;
      doorHeight = 35;
    } else if (houseType === 2) { // Cottage
      doorX = house.x + 20;
      doorY = house.y + 20;
      doorWidth = 25;
      doorHeight = 40;
    } else if (houseType === 3) { // Japanese house
      doorX = house.x + 20;
      doorY = house.y + 30;
      doorWidth = 20;
      doorHeight = 30;
    } else if (houseType === 4) { // Mediterranean
      doorX = house.x + 25;
      doorY = house.y + 25;
      doorWidth = 30;
      doorHeight = 35;
    }
    
    // Realistic door
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(doorX, doorY, doorWidth, doorHeight);
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 2;
    ctx.strokeRect(doorX, doorY, doorWidth, doorHeight);
    
    // Door handle
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(doorX + doorWidth - 5, doorY + doorHeight/2, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Realistic windows (positioned appropriately for each house type)
    let windowX = house.x + 8;
    let windowY = house.y + 12;
    
    if (houseType === 0) { // Victorian
      windowX = house.x + 8;
      windowY = house.y + 12;
    } else if (houseType === 1) { // Modern (already drawn above)
      // Windows already drawn in modern house
    } else if (houseType === 2) { // Cottage
      windowX = house.x + 10;
      windowY = house.y + 15;
    } else if (houseType === 3) { // Japanese
      windowX = house.x + 8;
      windowY = house.y + 10;
    } else if (houseType === 4) { // Mediterranean
      windowX = house.x + 8;
      windowY = house.y + 12;
    }
    
    if (houseType !== 1) { // Don't redraw modern windows
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(windowX, windowY, 18, 15);
      ctx.strokeStyle = '#4682B4';
      ctx.lineWidth = 2;
      ctx.strokeRect(windowX, windowY, 18, 15);
      
      // Window panes
      ctx.strokeStyle = '#4682B4';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(windowX + 9, windowY);
      ctx.lineTo(windowX + 9, windowY + 15);
      ctx.moveTo(windowX, windowY + 7.5);
      ctx.lineTo(windowX + 18, windowY + 7.5);
      ctx.stroke();
    }
    
    // House number with realistic style
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 12px Inter';
    ctx.textAlign = 'center';
    let numberY = house.y + 20;
    if (houseType === 1) numberY = house.y + 18;
    else if (houseType === 2) numberY = house.y + 18;
    else if (houseType === 3) numberY = house.y + 20;
    else if (houseType === 4) numberY = house.y + 18;
    ctx.fillText(house.id + 1, centerX, numberY);
    
    // Realistic architectural details
    if (houseType === 0) { // Victorian details
      // Corner stones
      ctx.fillStyle = '#8B7355';
      ctx.fillRect(house.x - 2, house.y - 2, 4, 4);
      ctx.fillRect(house.x + house.width - 2, house.y - 2, 4, 4);
    } else if (houseType === 2) { // Cottage details
      // Flower box
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(house.x + 5, house.y + 5, 15, 5);
      ctx.fillStyle = '#FFB6C1';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(house.x + 8 + i * 4, house.y + 7, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (houseType === 3) { // Japanese details
      // Lantern
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(house.x + house.width + 5, house.y + 10, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (houseType === 4) { // Mediterranean details
      // Shutters
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(house.x - 3, house.y + 12, 3, 15);
      ctx.fillRect(house.x + house.width, house.y + 12, 3, 15);
    }
  });
  
  // Draw pee marks
  peeMarks.forEach(mark => {
    ctx.save();
    ctx.translate(mark.x, mark.y);
    ctx.scale(1.25, 1.25); // 25% larger
    ctx.fillStyle = mark.color;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    if (mark.splat && mark.splat.length) {
      mark.splat.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  });
  
  // Draw manga-style poop mines (for all players)
  poopMines.forEach(mine => {
    // Draw manga-style poop with clean lines and no face
    ctx.save();
    ctx.translate(mine.x, mine.y);
    ctx.scale(0.768, 0.768); // 40% smaller total (1.2 * 0.8 * 0.8 = 0.768)
    
    // Add subtle sparkle effect
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(-6, -6, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(6, -6, 0.8, 0, Math.PI * 2);
    ctx.fill();
    
    // Bottom swirl with manga-style brown
    ctx.beginPath();
    ctx.arc(0, 8, 10, Math.PI, 2 * Math.PI);
    ctx.arc(0, 8, 10, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#8B4513';
    ctx.fill();
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Middle swirl with manga-style shading
    ctx.beginPath();
    ctx.arc(0, 0, 7, Math.PI, 2 * Math.PI);
    ctx.arc(0, 0, 7, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#A0522D';
    ctx.fill();
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Top swirl with manga-style highlight
    ctx.beginPath();
    ctx.arc(0, -6, 4, Math.PI, 2 * Math.PI);
    ctx.arc(0, -6, 4, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#CD853F';
    ctx.fill();
    ctx.strokeStyle = '#A0522D';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Manga-style poop tip
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(-2, -14);
    ctx.lineTo(2, -14);
    ctx.closePath();
    ctx.fillStyle = '#CD853F';
    ctx.fill();
    ctx.strokeStyle = '#A0522D';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Add manga-style highlight
    ctx.fillStyle = '#DEB887';
    ctx.beginPath();
    ctx.arc(-1, -12, 0.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  });
  
  // Draw other players
  console.log('Rendering other players. Count:', otherPlayers.size);
  
  otherPlayers.forEach((otherPlayer, id) => {
    console.log('Other player:', otherPlayer.name, 'alive:', otherPlayer.isAlive, 'at', otherPlayer.x, otherPlayer.y);
    if (otherPlayer.isAlive) {
      drawDog(otherPlayer.x, otherPlayer.y, otherPlayer.color, otherPlayer.name, false, otherPlayer.breed);
    }
  });
  
  // Draw current player
  if (player && player.isAlive) {
    drawDog(player.x, player.y, player.color, player.name, true, player.breed);
  }
  
  // Draw command overlay
  drawCommandOverlay();
}

// Draw a dog
function drawDog(x, y, color, name, isCurrentPlayer, breed) {
  ctx.save();
  
  // Breed-specific rendering
  switch(breed) {
    case 'Shiba':
      drawShiba(x, y, color, name, isCurrentPlayer);
      break;
    case 'Beagle':
      drawBeagle(x, y, color, name, isCurrentPlayer);
      break;
    case 'Bassotto':
      drawDachshund(x, y, color, name, isCurrentPlayer);
      break;
    case 'Bulldog':
      drawBulldog(x, y, color, name, isCurrentPlayer);
      break;
    case 'Barboncino':
      drawPoodle(x, y, color, name, isCurrentPlayer);
      break;
    case 'Golden Retriever':
      drawGoldenRetriever(x, y, color, name, isCurrentPlayer);
      break;
    case 'Labrador':
      drawLabrador(x, y, color, name, isCurrentPlayer);
      break;
    case 'Chihuahua':
      drawChihuahua(x, y, color, name, isCurrentPlayer);
      break;
    default:
      drawGoldenRetriever(x, y, color, name, isCurrentPlayer);
  }
  
  ctx.restore();
}

// Golden Retriever - cute, fluffy, floppy ear, longer body
function drawGoldenRetriever(x, y, color, name, isCurrentPlayer) {
  ctx.fillStyle = color;
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2;
  // Fluffy, slightly longer body
  ctx.beginPath();
  ctx.ellipse(x + 7, y + 6, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // Big, round head
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x - 4, y - 4, 7, 7, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // Fluffy snout
  ctx.fillStyle = '#FFF8DC';
  ctx.beginPath();
  ctx.ellipse(x - 10, y - 1, 2.2, 1.2, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // Large, expressive eye
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(x - 5, y - 6, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 4.7, y - 6.3, 0.3, 0, Math.PI * 2); ctx.fill();
  // Nose
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 11.5, y - 1, 0.6, 0, Math.PI * 2); ctx.fill();
  // Smile
  ctx.beginPath(); ctx.arc(x - 9, y + 1, 0.7, 0, Math.PI); ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.stroke();
  // Floppy ear
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x - 7, y - 10); ctx.quadraticCurveTo(x - 14, y - 16, x - 3, y - 7); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Fluffy tail
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 15, y + 6); ctx.quadraticCurveTo(x + 20, y + 2, x + 16, y - 2); ctx.stroke();
  // Short, chubby legs
  ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + 2, y + 10); ctx.lineTo(x + 2, y + 15); ctx.moveTo(x + 7, y + 10); ctx.lineTo(x + 7, y + 15); ctx.moveTo(x + 11, y + 10); ctx.lineTo(x + 11, y + 15); ctx.stroke();
  drawDogNameAndBreed(x, y, name, isCurrentPlayer, 'Golden Retriever');
}

// Shiba Inu - cute, pointy ear, curled tail, white face/chest
function drawShiba(x, y, color, name, isCurrentPlayer) {
  // Orange/tan body
  ctx.fillStyle = color;
  ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x + 4, y + 6, 7, 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // White chest
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x + 2, y + 7, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
  // Big, round head
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x - 3, y - 3, 6, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // White face
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x - 4, y - 3, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
  // Pointy ear
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x - 5, y - 8); ctx.lineTo(x - 8, y - 12); ctx.lineTo(x - 2, y - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Curled tail
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 10, y + 6); ctx.quadraticCurveTo(x + 14, y + 4, x + 11, y + 2); ctx.stroke();
  // Eye
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 4, y - 5, 1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 3.7, y - 5.3, 0.25, 0, Math.PI * 2); ctx.fill();
  // Nose
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 9, y - 1, 0.5, 0, Math.PI * 2); ctx.fill();
  // Smile
  ctx.beginPath(); ctx.arc(x - 7, y + 1, 0.5, 0, Math.PI); ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.stroke();
  // Short legs
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 1, y + 10); ctx.lineTo(x + 1, y + 14); ctx.moveTo(x + 4, y + 10); ctx.lineTo(x + 4, y + 14); ctx.moveTo(x + 7, y + 10); ctx.lineTo(x + 7, y + 14); ctx.stroke();
  drawDogNameAndBreed(x, y, name, isCurrentPlayer, 'Shiba');
}

// Beagle - cute, floppy ear, tricolor patches
function drawBeagle(x, y, color, name, isCurrentPlayer) {
  // Brown body
  ctx.fillStyle = '#b97a56'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x + 4, y + 6, 7.5, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Black patch
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(x + 7, y + 6, 2, 1.5, 0, 0, Math.PI * 2); ctx.fill();
  // White chest
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x + 2, y + 7, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
  // Big, round head
  ctx.fillStyle = '#b97a56'; ctx.beginPath(); ctx.ellipse(x - 3, y - 4, 6.5, 6.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // White snout
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x - 8, y - 1, 2, 1, 0, 0, Math.PI * 2); ctx.fill();
  // Floppy ear
  ctx.fillStyle = '#b97a56'; ctx.beginPath(); ctx.moveTo(x - 6, y - 8); ctx.lineTo(x - 10, y - 12); ctx.lineTo(x - 2, y - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Short tail
  ctx.strokeStyle = '#b97a56'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 11, y + 6); ctx.lineTo(x + 15, y + 4); ctx.stroke();
  // Eye
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 4, y - 6, 1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 3.7, y - 6.3, 0.25, 0, Math.PI * 2); ctx.fill();
  // Nose
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 10, y - 1, 0.5, 0, Math.PI * 2); ctx.fill();
  // Smile
  ctx.beginPath(); ctx.arc(x - 8, y + 1, 0.5, 0, Math.PI); ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.stroke();
  // Short legs
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 1, y + 10); ctx.lineTo(x + 1, y + 15); ctx.moveTo(x + 4, y + 10); ctx.lineTo(x + 4, y + 15); ctx.moveTo(x + 7, y + 10); ctx.lineTo(x + 7, y + 15); ctx.stroke();
  drawDogNameAndBreed(x, y, name, isCurrentPlayer, 'Beagle');
}

// Labrador - cute, floppy ear, thick tail, solid color
function drawLabrador(x, y, color, name, isCurrentPlayer) {
  ctx.fillStyle = color; ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x + 5, y + 6, 8, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x - 4, y - 4, 7, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x - 10, y - 1, 2.2, 1.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 5, y - 6, 1.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 4.7, y - 6.3, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 11.5, y - 1, 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x - 9, y + 1, 0.7, 0, Math.PI); ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x - 7, y - 10); ctx.quadraticCurveTo(x - 12, y - 14, x - 3, y - 7); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 12, y + 6); ctx.quadraticCurveTo(x + 16, y + 4, x + 13, y + 1); ctx.stroke();
  ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + 1, y + 10); ctx.lineTo(x + 1, y + 15); ctx.moveTo(x + 5, y + 10); ctx.lineTo(x + 5, y + 15); ctx.moveTo(x + 8, y + 10); ctx.lineTo(x + 8, y + 15); ctx.stroke();
  drawDogNameAndBreed(x, y, name, isCurrentPlayer, 'Labrador');
}

// Chihuahua - cute, big upright ear, tiny body
function drawChihuahua(x, y, color, name, isCurrentPlayer) {
  ctx.fillStyle = color; ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x + 2, y + 6, 5, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x - 3, y - 3, 4.5, 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x - 7, y - 1, 1.3, 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 4, y - 4, 0.8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 3.8, y - 4.2, 0.18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 7.8, y - 1, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x - 6, y + 1, 0.3, 0, Math.PI); ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x - 7, y - 7); ctx.lineTo(x - 12, y - 13); ctx.lineTo(x - 2, y - 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 7, y + 6); ctx.lineTo(x + 11, y + 4); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 1, y + 9); ctx.lineTo(x + 1, y + 13); ctx.moveTo(x + 3, y + 9); ctx.lineTo(x + 3, y + 13); ctx.stroke();
  drawDogNameAndBreed(x, y, name, isCurrentPlayer, 'Chihuahua');
}

// Husky - cute, pointy ear, bushy tail, mask
function drawHusky(x, y, color, name, isCurrentPlayer) {
  // Gray body
  ctx.fillStyle = color; ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x + 5, y + 6, 8, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Big, round head
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x - 4, y - 4, 7, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // White mask
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x - 4, y - 4, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
  // Pointy ear
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x - 7, y - 10); ctx.lineTo(x - 12, y - 14); ctx.lineTo(x - 3, y - 7); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Bushy tail
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 12, y + 6); ctx.quadraticCurveTo(x + 16, y + 4, x + 13, y + 1); ctx.stroke();
  // Blue eye
  ctx.fillStyle = '#4A90E2'; ctx.beginPath(); ctx.arc(x - 5, y - 6, 1.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 4.7, y - 6.3, 0.3, 0, Math.PI * 2); ctx.fill();
  // Nose
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 11.5, y - 1, 0.6, 0, Math.PI * 2); ctx.fill();
  // Smile
  ctx.beginPath(); ctx.arc(x - 9, y + 1, 0.7, 0, Math.PI); ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.stroke();
  // Short, chubby legs
  ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + 1, y + 10); ctx.lineTo(x + 1, y + 15); ctx.moveTo(x + 5, y + 10); ctx.lineTo(x + 5, y + 15); ctx.moveTo(x + 8, y + 10); ctx.lineTo(x + 8, y + 15); ctx.stroke();
  drawDogNameAndBreed(x, y, name, isCurrentPlayer, 'Husky');
}

// Poodle - cute, fluffy head/ears/tail, dainty legs
function drawPoodle(x, y, color, name, isCurrentPlayer) {
  ctx.fillStyle = color; ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x + 4, y + 6, 7, 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x - 3, y - 3, 6, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Fluffy head
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x - 3, y - 6, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
  // Fluffy ear
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x - 5, y - 8); ctx.lineTo(x - 8, y - 12); ctx.lineTo(x - 2, y - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Fluffy tail
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 10, y + 6); ctx.lineTo(x + 14, y + 4); ctx.stroke();
  // Eye
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 4, y - 5, 1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 3.7, y - 5.3, 0.25, 0, Math.PI * 2); ctx.fill();
  // Nose
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 9, y - 1, 0.5, 0, Math.PI * 2); ctx.fill();
  // Smile
  ctx.beginPath(); ctx.arc(x - 7, y + 1, 0.5, 0, Math.PI); ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.stroke();
  // Dainty legs
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 1, y + 10); ctx.lineTo(x + 1, y + 15); ctx.moveTo(x + 4, y + 10); ctx.lineTo(x + 4, y + 15); ctx.moveTo(x + 7, y + 10); ctx.lineTo(x + 7, y + 15); ctx.stroke();
  drawDogNameAndBreed(x, y, name, isCurrentPlayer, 'Poodle');
}

// Bulldog - cute, stocky, wrinkly face, small floppy ear
function drawBulldog(x, y, color, name, isCurrentPlayer) {
  ctx.fillStyle = color; ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x + 4, y + 7, 8, 5.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x - 4, y - 3, 7, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Wrinkly face
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 7, y - 6); ctx.lineTo(x - 2, y - 4); ctx.stroke();
  // Small floppy ear
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x - 7, y - 8); ctx.lineTo(x - 12, y - 12); ctx.lineTo(x - 3, y - 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Short tail
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 12, y + 7); ctx.lineTo(x + 16, y + 5); ctx.stroke();
  // Eye
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 5, y - 4, 1.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 4.7, y - 4.3, 0.3, 0, Math.PI * 2); ctx.fill();
  // Nose
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 11.5, y, 0.6, 0, Math.PI * 2); ctx.fill();
  // Smile
  ctx.beginPath(); ctx.arc(x - 9, y + 2, 0.7, 0, Math.PI); ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.stroke();
  // Short, chubby legs
  ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + 1, y + 12); ctx.lineTo(x + 1, y + 16); ctx.moveTo(x + 5, y + 12); ctx.lineTo(x + 5, y + 16); ctx.moveTo(x + 8, y + 12); ctx.lineTo(x + 8, y + 16); ctx.stroke();
  drawDogNameAndBreed(x, y, name, isCurrentPlayer, 'Bulldog');
}

// Dachshund - cute, long body, long floppy ear, short legs
function drawDachshund(x, y, color, name, isCurrentPlayer) {
  ctx.fillStyle = color; ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x + 10, y + 6, 13, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x - 6, y - 3, 6, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x - 13, y - 1, 2.5, 1, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 8, y - 4, 0.8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 7.7, y - 4.2, 0.18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 14.5, y - 1, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x - 12, y + 1, 0.3, 0, Math.PI); ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x - 10, y - 7); ctx.lineTo(x - 15, y - 11); ctx.lineTo(x - 3, y - 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 20, y + 6); ctx.lineTo(x + 26, y + 4); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 4, y + 9); ctx.lineTo(x + 4, y + 13); ctx.moveTo(x + 8, y + 9); ctx.lineTo(x + 8, y + 13); ctx.moveTo(x + 12, y + 9); ctx.lineTo(x + 12, y + 13); ctx.stroke();
  drawDogNameAndBreed(x, y, name, isCurrentPlayer, 'Dachshund');
}

// Helper function for name and breed display
function drawDogNameAndBreed(x, y, name, isCurrentPlayer, breed) {
  // Player name only
  ctx.fillStyle = '#000'; // Always black name
  ctx.font = '12px VT323';
  ctx.textAlign = 'center';
  ctx.fillText(name, x, y - 20);

  // Current player indicator
  if (isCurrentPlayer) {
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(x - 2, y - 30, 4, 4);
  }
}

// Draw command overlay
function drawCommandOverlay() {
  // Reset transform for UI overlay
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  
  // No buttons to draw - leaderboard button removed
  window.gameButtons = [];
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', function() {
  initGame();
  setupBreedAndColorSelection();
});

// Fallback: if game doesn't start after 3 seconds, show a message
setTimeout(() => {
  if (!player) {
    console.log('Game initialization timeout - checking for errors');
    const welcomeScreen = document.getElementById('welcomeScreen');
    const gameScreen = document.getElementById('gameScreen');
    
    if (welcomeScreen && gameScreen) {
      console.log('Welcome screen visible:', !welcomeScreen.classList.contains('hidden'));
      console.log('Game screen visible:', !gameScreen.classList.contains('hidden'));
    }
  }
}, 3000); 