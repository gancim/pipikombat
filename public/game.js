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

// Add breed and color selection logic
let selectedColor = null;
let selectedPeeColor = null;

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const BASE_WIDTH = 800;
const BASE_HEIGHT = 600;

function resizeCanvas() {
  // Calculate the largest size that fits in the window while preserving aspect ratio
  const scale = Math.min(window.innerWidth / BASE_WIDTH, window.innerHeight / BASE_HEIGHT);
  canvas.width = BASE_WIDTH;
  canvas.height = BASE_HEIGHT;
  canvas.style.width = `${BASE_WIDTH * scale}px`;
  canvas.style.height = `${BASE_HEIGHT * scale}px`;
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
  msg.textContent = `相手: ${opponentName} とバトル中... 選んでください！`;
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

// Initialize game
function initGame() {
  // Connect to server
  socket = io();
  
  // Event listeners
  joinGameBtn.addEventListener('click', joinGame);
  // closeLeaderboardBtn.addEventListener('click', () => {
  //   leaderboardModal.classList.add('hidden');
  // });
  
  // leaderboardBtn.addEventListener('click', () => {
  //   leaderboardModal.classList.remove('hidden');
  //   socket.emit('getLeaderboard');
  // });
  
  // playAgainBtn.addEventListener('click', () => {
  //   gameOverModal.classList.add('hidden');
  //   location.reload();
  // });
  
  // Control buttons
  // peeBtn.addEventListener('click', () => pee());
  // poopBtn.addEventListener('click', () => poop());
  // cuddleBtn.addEventListener('click', () => cuddle());
  
  // Keyboard controls
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
  
  // Canvas click handling for buttons
  canvas.addEventListener('click', handleCanvasClick);
  
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
    console.log('Game joined, player data:', data);
    console.log('Received townMap:', data.townMap);
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
    otherPlayers.set(data.player.id, data.player);
  });
  
  socket.on('playerMoved', (data) => {
    console.log('playerMoved:', data);
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
    }, 300);
  }, 200);
  
  console.log('Game screen visible:', !gameScreen.classList.contains('hidden'));
}

// Update player display
function updatePlayerDisplay() {
  if (!player) return;
  
  playerNameDisplay.innerHTML =
    (DOG_EMOJIS[player.breed] ? `<span style='font-size:1.2em;'>${DOG_EMOJIS[player.breed]}</span> ` : '') +
    `<span>${player.name}</span> <span style='font-size:0.9em;color:#888;'>(${player.breed})</span>`;
  // Show a row of heart icons for each heart
  heartsDisplay.textContent = '';
  for (let i = 0; i < player.hearts; i++) {
    heartsDisplay.textContent += '❤️';
  }
  peeBarFill.style.width = `${player.peeCharge}%`;
  
  // Update player avatar
  const playerAvatar = document.getElementById('playerAvatar');
  playerAvatar.textContent = DOG_EMOJIS[player.breed] || '🐕';
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
  
  const now = Date.now();
  if (now - lastPeeTime < 1000) return; // Cooldown
  
  lastPeeTime = now;
  socket.emit('pee', { x: player.x, y: player.y });
}

function poop() {
  if (!player || !player.isAlive) return;
  
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
    content.innerHTML = `<h3>${type === 'battleNotification' ? '⚔️ バトル！' : 
      type === 'cuddleNotification' ? '🤗 ハグ成功！' : '💩 うんち地雷！'}</h3>
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
        <div class="territory-percentage">${player.territoryPercentage.toFixed(1)}% テリトリー</div>
        <div class="hearts-leaderboard">❤️ ${player.hearts}</div>
      </div>
    `;
    
    leaderboardList.appendChild(item);
  });
}

// Show game over
function showGameOver(winner) {
  gameOverContent.innerHTML = `
    <h3>🏆 ゲーム終了！</h3>
    ${winner ? `
      <p><strong>勝者: ${winner.name}</strong></p>
      <p>テリトリー: ${winner.territoryPercentage.toFixed(1)}%</p>
      <p>ハート: ❤️ ${winner.hearts}</p>
    ` : '<p>ゲームが終了しました！</p>'}
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
  // Responsive scaling: always fit the map
  ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
  const scale = Math.min(window.innerWidth / BASE_WIDTH, window.innerHeight / BASE_HEIGHT);
  ctx.scale(scale, scale);
  console.log('Rendering, townMap:', townMap);
  // Clear canvas with white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (!townMap) return;
  
  // Draw parks (grass areas) first
  townMap.parks.forEach(park => {
    ctx.fillStyle = park.color;
    ctx.fillRect(park.x, park.y, park.width, park.height);
    
    // Add some grass texture
    ctx.strokeStyle = '#228B22';
    ctx.lineWidth = 1;
    for (let i = 0; i < park.width; i += 10) {
      for (let j = 0; j < park.height; j += 10) {
        ctx.beginPath();
        ctx.moveTo(park.x + i, park.y + j);
        ctx.lineTo(park.x + i + 5, park.y + j + 5);
        ctx.stroke();
      }
    }
  });
  
  // Draw roads
  townMap.roads.forEach(road => {
    ctx.fillStyle = road.color;
    ctx.fillRect(road.x, road.y, road.width, road.height);
    
    // Add road markings
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    if (road.width > road.height) {
      // Horizontal road
      ctx.beginPath();
      ctx.moveTo(road.x, road.y + road.height / 2);
      ctx.lineTo(road.x + road.width, road.y + road.height / 2);
      ctx.stroke();
    } else {
      // Vertical road
      ctx.beginPath();
      ctx.moveTo(road.x + road.width / 2, road.y);
      ctx.lineTo(road.x + road.width / 2, road.y + road.height);
      ctx.stroke();
    }
  });
  
  // Draw landmarks
  townMap.landmarks.forEach(landmark => {
    if (landmark.type === 'fountain') {
      // Draw fountain
      ctx.fillStyle = landmark.color;
      ctx.fillRect(landmark.x, landmark.y, landmark.width, landmark.height);
      ctx.strokeStyle = '#4682B4';
      ctx.lineWidth = 2;
      ctx.strokeRect(landmark.x, landmark.y, landmark.width, landmark.height);
      
      // Fountain water effect
      ctx.fillStyle = '#87CEEB';
      ctx.beginPath();
      ctx.arc(landmark.x + landmark.width/2, landmark.y + landmark.height/2, 15, 0, Math.PI * 2);
      ctx.fill();
    } else if (landmark.type === 'shop') {
      // Draw shop
      ctx.fillStyle = landmark.color;
      ctx.fillRect(landmark.x, landmark.y, landmark.width, landmark.height);
      ctx.strokeStyle = '#FF69B4';
      ctx.lineWidth = 2;
      ctx.strokeRect(landmark.x, landmark.y, landmark.width, landmark.height);
      
      // Shop sign
      ctx.fillStyle = '#FF1493';
      ctx.fillRect(landmark.x + 10, landmark.y - 15, 80, 10);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '10px VT323';
      ctx.textAlign = 'center';
      ctx.fillText('🏪 ショップ', landmark.x + landmark.width/2, landmark.y - 8);
    }
  });
  
  // Draw houses
  townMap.houses.forEach(house => {
    // House base
    ctx.fillStyle = house.color;
    ctx.fillRect(house.x, house.y, house.width, house.height);
    
    // House outline
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2;
    ctx.strokeRect(house.x, house.y, house.width, house.height);
    
    // House roof
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(house.x - 5, house.y - 10, house.width + 10, 10);
    ctx.strokeRect(house.x - 5, house.y - 10, house.width + 10, 10);
    
    // House door
    ctx.fillStyle = '#654321';
    ctx.fillRect(house.x + 15, house.y + 30, 30, 30);
    ctx.strokeRect(house.x + 15, house.y + 30, 30, 30);
    
    // House window
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(house.x + 5, house.y + 10, 15, 15);
    ctx.strokeRect(house.x + 5, house.y + 10, 15, 15);
    
    // House number
    ctx.fillStyle = '#000000';
    ctx.font = '12px VT323';
    ctx.textAlign = 'center';
    ctx.fillText(house.id + 1, house.x + house.width/2, house.y + 25);
  });
  
  // Draw pee marks
  peeMarks.forEach(mark => {
    ctx.save();
    ctx.translate(mark.x, mark.y);
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
  
  // Draw poop mines (for all players)
  poopMines.forEach(mine => {
    // Draw stylized cartoon poop swirl
    ctx.save();
    ctx.translate(mine.x, mine.y);
    ctx.scale(1.2, 1.2);
    // Bottom swirl
    ctx.beginPath();
    ctx.arc(0, 8, 10, Math.PI, 2 * Math.PI);
    ctx.arc(0, 8, 10, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#8B4513';
    ctx.fill();
    // Middle swirl
    ctx.beginPath();
    ctx.arc(0, 0, 7, Math.PI, 2 * Math.PI);
    ctx.arc(0, 0, 7, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#A0522D';
    ctx.fill();
    // Top swirl
    ctx.beginPath();
    ctx.arc(0, -6, 4, Math.PI, 2 * Math.PI);
    ctx.arc(0, -6, 4, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#DEB887';
    ctx.fill();
    // Poop tip
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(-2, -14);
    ctx.lineTo(2, -14);
    ctx.closePath();
    ctx.fillStyle = '#DEB887';
    ctx.fill();
    ctx.restore();
  });
  
  // Draw other players
  otherPlayers.forEach(otherPlayer => {
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
  // Body
  ctx.fillStyle = color;
  ctx.strokeStyle = '#000'; // Always black outline
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 12, 9, 0, 0, Math.PI * 2); // body
  ctx.fill();
  ctx.stroke();

  // Head
  ctx.beginPath();
  ctx.ellipse(x, y - 8, 8, 7, 0, 0, Math.PI * 2); // head
  ctx.fillStyle = color;
  ctx.fill();
  ctx.stroke();

  // Snout
  ctx.beginPath();
  ctx.ellipse(x, y - 3, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#fffbe6';
  ctx.fill();
  ctx.stroke();

  // Nose
  ctx.beginPath();
  ctx.arc(x, y - 5, 1.2, 0, Math.PI * 2);
  ctx.fillStyle = '#222';
  ctx.fill();

  // Eyes
  ctx.beginPath();
  ctx.arc(x - 3, y - 9, 1, 0, Math.PI * 2);
  ctx.arc(x + 3, y - 9, 1, 0, Math.PI * 2);
  ctx.fillStyle = '#222';
  ctx.fill();

  // Mouth
  ctx.beginPath();
  ctx.arc(x, y - 4, 1.2, 0, Math.PI);
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Ears
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 14);
  ctx.lineTo(x - 10, y - 18);
  ctx.lineTo(x - 3, y - 12);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + 6, y - 14);
  ctx.lineTo(x + 10, y - 18);
  ctx.lineTo(x + 3, y - 12);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.stroke();

  // Tail
  ctx.beginPath();
  ctx.moveTo(x + 12, y + 4);
  ctx.quadraticCurveTo(x + 18, y + 2, x + 14, y - 6);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000';
  ctx.stroke();

  // Legs (simple lines)
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 6, y + 12);
  ctx.lineTo(x - 6, y + 18);
  ctx.moveTo(x - 2, y + 12);
  ctx.lineTo(x - 2, y + 18);
  ctx.moveTo(x + 2, y + 12);
  ctx.lineTo(x + 2, y + 18);
  ctx.moveTo(x + 6, y + 12);
  ctx.lineTo(x + 6, y + 18);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(x - 6, y + 12);
  ctx.lineTo(x - 6, y + 18);
  ctx.moveTo(x - 2, y + 12);
  ctx.lineTo(x - 2, y + 18);
  ctx.moveTo(x + 2, y + 12);
  ctx.lineTo(x + 2, y + 18);
  ctx.moveTo(x + 6, y + 12);
  ctx.lineTo(x + 6, y + 18);
  ctx.stroke();

  // Player name and breed
  ctx.fillStyle = '#000'; // Always black name
  ctx.font = '12px VT323';
  ctx.textAlign = 'center';
  ctx.fillText(
    name,
    x, y - 25
  );
  ctx.font = '10px VT323';
  ctx.fillStyle = '#888';
  ctx.fillText(breed, x, y - 14);

  // Current player indicator
  if (isCurrentPlayer) {
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(x - 2, y - 35, 4, 4);
  }
  ctx.restore();
}

// Draw command overlay
function drawCommandOverlay() {
  // Reset transform for UI overlay
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  
  // Draw control buttons on the right side
  const buttonWidth = 120;
  const buttonHeight = 40;
  const buttonSpacing = 10;
  const startX = canvas.width - buttonWidth - 20;
  const startY = 20;
  
  const buttons = [
    { text: '📊 Leaderboard', action: 'leaderboard', y: startY }
  ];
  
  // Store button positions for click detection
  window.gameButtons = buttons.map(btn => ({
    x: startX,
    y: btn.y,
    width: buttonWidth,
    height: buttonHeight,
    action: btn.action
  }));
  
  buttons.forEach(btn => {
    // Button background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(startX, btn.y, buttonWidth, buttonHeight);
    
    // Button border
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(startX, btn.y, buttonWidth, buttonHeight);
    
    // Button text
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px VT323';
    ctx.textAlign = 'center';
    ctx.fillText(btn.text, startX + buttonWidth/2, btn.y + buttonHeight/2 + 5);
  });
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