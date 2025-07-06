const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

// Game state
const gameState = {
  players: new Map(),
  poopMines: new Map(),
  peeMarks: new Map(),
  gameTime: 5 * 60, // 5 minutes in seconds
  gameStarted: false,
  startTime: null,
  townMap: null // Store the generated town map
};

// Dog breeds and colors
const DOG_BREEDS = [
  { name: 'Shiba', color: '#FFD700', peeColor: '#FFFF00' },
  { name: 'Beagle', color: '#8B4513', peeColor: '#FFA500' },
  { name: 'Bassotto', color: '#654321', peeColor: '#FF8C00' },
  { name: 'Bulldog', color: '#696969', peeColor: '#FF6347' },
  { name: 'Barboncino', color: '#F5F5DC', peeColor: '#FFB6C1' },
  { name: 'Golden Retriever', color: '#DAA520', peeColor: '#FFD700' },
  { name: 'Labrador', color: '#000000', peeColor: '#FF4500' },
  { name: 'Chihuahua', color: '#DEB887', peeColor: '#FF69B4' }
];

// Game map dimensions
const MAP_WIDTH = 800;
const MAP_HEIGHT = 600;
const HOUSE_SIZE = 60;

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

const clampToBounds = (x, y, width, height, margin) => ({
  x: Math.max(margin, Math.min(x, MAP_WIDTH - width - margin)),
  y: Math.max(margin, Math.min(y, MAP_HEIGHT - height - margin))
});

const generateLittleTown = () => {
  const margin = 20;
  const townMap = {
    houses: [],
    roads: [],
    landmarks: [],
    parks: [],
    shops: []
  };

  // Generate random houses in a town-like pattern
  const housePositions = [
    // Top row
    { x: 60, y: 60, color: '#FFD700' },
    { x: 220, y: 60, color: '#8B4513' },
    { x: 380, y: 60, color: '#654321' },
    { x: 540, y: 60, color: '#696969' },
    // Middle row
    { x: 120, y: 250, color: '#F5F5DC' },
    { x: 320, y: 250, color: '#DAA520' },
    { x: 520, y: 250, color: '#000000' },
    // Bottom row
    { x: 60, y: 440, color: '#DEB887' },
    { x: 220, y: 440, color: '#FF69B4' },
    { x: 380, y: 440, color: '#00BFFF' },
    { x: 540, y: 440, color: '#32CD32' },
    { x: 320, y: 540, color: '#FFD700' }
  ];

  // Shuffle house positions for randomness
  for (let i = housePositions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [housePositions[i], housePositions[j]] = [housePositions[j], housePositions[i]];
  }

  // Create houses, clamped to fit inside canvas with margin
  housePositions.forEach((pos, index) => {
    const {x, y} = clampToBounds(pos.x, pos.y, HOUSE_SIZE, HOUSE_SIZE, margin);
    townMap.houses.push({
      id: index,
      x,
      y,
      width: HOUSE_SIZE,
      height: HOUSE_SIZE,
      color: pos.color,
      type: 'house'
    });
  });

  // Generate roads, clamped
  townMap.roads = [
    // Main horizontal road
    (() => { const width = MAP_WIDTH - 2 * margin, height = 20; const {x, y} = clampToBounds(margin, 300, width, height, margin); return { x, y, width, height, color: '#8B4513' }; })(),
    // Vertical road 1
    (() => { const width = 20, height = MAP_HEIGHT - 2 * margin; const {x, y} = clampToBounds(200, margin, width, height, margin); return { x, y, width, height, color: '#8B4513' }; })(),
    // Vertical road 2
    (() => { const width = 20, height = MAP_HEIGHT - 2 * margin; const {x, y} = clampToBounds(600, margin, width, height, margin); return { x, y, width, height, color: '#8B4513' }; })(),
    // Small connecting roads
    (() => { const width = 200 - margin, height = 10; const {x, y} = clampToBounds(margin, 100, width, height, margin); return { x, y, width, height, color: '#A0522D' }; })(),
    (() => { const width = MAP_WIDTH - 600 - margin, height = 10; const {x, y} = clampToBounds(600, 100, width, height, margin); return { x, y, width, height, color: '#A0522D' }; })(),
    (() => { const width = 200 - margin, height = 10; const {x, y} = clampToBounds(margin, 500, width, height, margin); return { x, y, width, height, color: '#A0522D' }; })(),
    (() => { const width = MAP_WIDTH - 600 - margin, height = 10; const {x, y} = clampToBounds(600, 500, width, height, margin); return { x, y, width, height, color: '#A0522D' }; })()
  ];

  // Generate landmarks, clamped
  townMap.landmarks = [
    // Town center fountain
    (() => { const width = 50, height = 50; const {x, y} = clampToBounds(375, 275, width, height, margin); return { x, y, width, height, type: 'fountain', color: '#87CEEB' }; })(),
    // Park
    (() => { const width = 200, height = 100; const {x, y} = clampToBounds(300, 50, width, height, margin); return { x, y, width, height, type: 'park', color: '#90EE90' }; })(),
    // Shop
    (() => { const width = 100, height = 60; const {x, y} = clampToBounds(350, 450, width, height, margin); return { x, y, width, height, type: 'shop', color: '#FFB6C1' }; })()
  ];

  // Generate parks (grass areas), clamped
  townMap.parks = [
    (() => { const width = 200, height = 100; const {x, y} = clampToBounds(300, 50, width, height, margin); return { x, y, width, height, color: '#90EE90' }; })(),
    (() => { const width = 100, height = 80; const {x, y} = clampToBounds(50, 250, width, height, margin); return { x, y, width, height, color: '#90EE90' }; })(),
    (() => { const width = 100, height = 80; const {x, y} = clampToBounds(650, 250, width, height, margin); return { x, y, width, height, color: '#90EE90' }; })()
  ];

  // Generate shops, clamped
  townMap.shops = [
    (() => { const width = 100, height = 60; const {x, y} = clampToBounds(350, 450, width, height, margin); return { x, y, width, height, color: '#FFB6C1', type: 'shop' }; })()
  ];

  return townMap;
};

// Game logic functions
const isInHouse = (player, houses) => {
  const radius = 16; // Allow partial overlap for recharge
  return houses.some(house =>
    player.x + radius > house.x &&
    player.x - radius < house.x + house.width &&
    player.y + radius > house.y &&
    player.y - radius < house.y + house.height
  );
};

const calculateTerritoryPercentage = (playerId) => {
  const playerMarks = Array.from(gameState.peeMarks.values())
    .filter(mark => mark.playerId === playerId);
  
  if (playerMarks.length === 0) return 0;
  
  const totalMarks = gameState.peeMarks.size;
  return (playerMarks.length / totalMarks) * 100;
};

const getLeaderboard = () => {
  const players = Array.from(gameState.players.values());
  return players
    .map(player => ({
      id: player.id,
      name: player.name,
      breed: player.breed,
      hearts: player.hearts,
      territoryPercentage: calculateTerritoryPercentage(player.id),
      color: player.color
    }))
    .sort((a, b) => {
      if (a.territoryPercentage !== b.territoryPercentage) {
        return b.territoryPercentage - a.territoryPercentage;
      }
      return b.hearts - a.hearts;
    });
};

const checkCollision = (player1, player2) => {
  const distance = Math.sqrt(
    Math.pow(player1.x - player2.x, 2) + 
    Math.pow(player1.y - player2.y, 2)
  );
  return distance < 30; // Collision radius
};

const rockPaperScissors = () => {
  const choices = ['rock', 'paper', 'scissors'];
  return choices[Math.floor(Math.random() * choices.length)];
};

const checkPoopMineCollision = (player) => {
  for (const [mineId, mine] of gameState.poopMines) {
    if (mine.playerId === player.id) continue; // Don't trigger own mine
    if (Date.now() - mine.timestamp < 1000) continue; // Don't trigger if mine is less than 1s old
    const distance = Math.sqrt(
      Math.pow(player.x - mine.x, 2) + 
      Math.pow(player.y - mine.y, 2)
    );
    if (distance < 20) {
      gameState.poopMines.delete(mineId);
      return true;
    }
  }
  return false;
};

// Store pending battles
const pendingBattles = new Map(); // key: battleId, value: {players: [id1, id2], choices: {}, timeout}

function getRandomRPS() {
  const choices = ['rock', 'paper', 'scissors'];
  return choices[Math.floor(Math.random() * choices.length)];
}

function resolveBattle(battleId) {
  const battle = pendingBattles.get(battleId);
  if (!battle) return;
  const [id1, id2] = battle.players;
  let choice1 = battle.choices[id1] || getRandomRPS();
  let choice2 = battle.choices[id2] || getRandomRPS();

  // Determine winner
  let winnerId = null, loserId = null, result = null;
  if (choice1 === choice2) {
    result = 'draw';
  } else if (
    (choice1 === 'rock' && choice2 === 'scissors') ||
    (choice1 === 'scissors' && choice2 === 'paper') ||
    (choice1 === 'paper' && choice2 === 'rock')
  ) {
    winnerId = id1;
    loserId = id2;
    result = `${choice1} beats ${choice2}`;
  } else {
    winnerId = id2;
    loserId = id1;
    result = `${choice2} beats ${choice1}`;
  }

  // Update hearts
  if (winnerId && loserId) {
    const winner = gameState.players.get(winnerId);
    const loser = gameState.players.get(loserId);
    if (winner && loser) {
      loser.hearts = Math.max(0, loser.hearts - 1);
      if (loser.hearts <= 0) {
        loser.isAlive = false;
        loser.respawnTime = Date.now() + 10000;
        io.to(loser.id).emit('playerDefeated');
      }
    }
  }

  // Emit result
  io.to(id1).emit('battleResult', {
    winner: winnerId,
    loser: loserId,
    result,
    yourChoice: choice1,
    opponentChoice: choice2,
    hearts: {
      [id1]: gameState.players.get(id1)?.hearts,
      [id2]: gameState.players.get(id2)?.hearts
    }
  });
  io.to(id2).emit('battleResult', {
    winner: winnerId,
    loser: loserId,
    result,
    yourChoice: choice2,
    opponentChoice: choice1,
    hearts: {
      [id1]: gameState.players.get(id1)?.hearts,
      [id2]: gameState.players.get(id2)?.hearts
    }
  });
  clearTimeout(battle.timeout);
  pendingBattles.delete(battleId);
}

// Socket.io event handlers
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('joinGame', (data) => {
    console.log('Player joining with data:', data);
    const playerCount = gameState.players.size;
    
    // Generate town map if this is the first player
    if (playerCount === 0) {
      gameState.townMap = generateLittleTown();
      console.log('Generated new Little Town map');
    }
    
    const selectedHouse = gameState.townMap.houses[playerCount % gameState.townMap.houses.length];
    // Use client-provided breed and color if available
    const breed = data.breed || DOG_BREEDS[playerCount % DOG_BREEDS.length].name;
    const color = data.color || DOG_BREEDS[playerCount % DOG_BREEDS.length].color;
    // Use the selected peeColor from the client if provided, otherwise fallback
    const peeColor = data.peeColor || data.color || DOG_BREEDS.find(b => b.name === breed)?.peeColor || '#FFFF00';
    console.log('Using peeColor:', peeColor);

    const player = {
      id: socket.id,
      name: data.name || `犬${playerCount + 1}`,
      breed: breed,
      color: color,
      peeColor: peeColor,
      x: selectedHouse.x + HOUSE_SIZE / 2,
      y: selectedHouse.y + HOUSE_SIZE / 2,
      hearts: 5,
      peeCharge: 100,
      lastPeeTime: 0,
      lastPoopTime: 0,
      lastDrinkTime: 0,
      isAlive: true,
      respawnTime: 0
    };

    gameState.players.set(socket.id, player);
    
    console.log('Emitting gameJoined with townMap:', gameState.townMap);
    socket.emit('gameJoined', {
      player,
      townMap: gameState.townMap,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
      gameTime: gameState.gameTime
    });

    io.emit('playerJoined', {
      player,
      totalPlayers: gameState.players.size
    });

    // Start game if we have at least 2 players
    if (gameState.players.size >= 2 && !gameState.gameStarted) {
      gameState.gameStarted = true;
      gameState.startTime = Date.now();
      io.emit('gameStarted', { startTime: gameState.startTime });
    }
  });

  socket.on('playerMove', (data) => {
    const player = gameState.players.get(socket.id);
    if (!player || !player.isAlive) return;

    const inHouse = isInHouse(player, gameState.townMap.houses);

    // Debug log
    console.log(`Player ${player.name} at (${player.x},${player.y}) inHouse: ${inHouse}, peeCharge: ${player.peeCharge}`);

    // Update player position
    player.x = Math.max(15, Math.min(MAP_WIDTH - 15, data.x));
    player.y = Math.max(15, Math.min(MAP_HEIGHT - 15, data.y));

    // Regenerate pee if in house
    if (inHouse && player.peeCharge < 100) {
      player.peeCharge = Math.min(100, player.peeCharge + 1);
    }

    // Check poop mine collision
    if (checkPoopMineCollision(player)) {
      player.hearts = Math.max(0, player.hearts - 1);
      socket.emit('hitPoopMine', { hearts: player.hearts });
      
      if (player.hearts <= 0) {
        player.isAlive = false;
        player.respawnTime = Date.now() + 10000; // 10 seconds
        socket.emit('playerDefeated');
      }
    }

    // Check player collisions
    for (const [otherId, otherPlayer] of gameState.players) {
      if (otherId !== socket.id && otherPlayer.isAlive && checkCollision(player, otherPlayer)) {
        // Start interactive battle
        const battleId = uuidv4();
        pendingBattles.set(battleId, {
          players: [player.id, otherPlayer.id],
          choices: {},
          timeout: setTimeout(() => resolveBattle(battleId), 5000)
        });
        io.to(player.id).emit('battleStart', { battleId, opponent: { id: otherPlayer.id, name: otherPlayer.name } });
        io.to(otherPlayer.id).emit('battleStart', { battleId, opponent: { id: player.id, name: player.name } });
        break;
      }
    }

    // Check respawn
    if (!player.isAlive && Date.now() >= player.respawnTime) {
      const playerHouse = gameState.townMap.houses.find(h => h.color === player.color) || gameState.townMap.houses[0];
      player.x = playerHouse.x + HOUSE_SIZE / 2;
      player.y = playerHouse.y + HOUSE_SIZE / 2;
      player.hearts = 5;
      player.isAlive = true;
      player.respawnTime = 0;
      socket.emit('playerRespawned', { x: player.x, y: player.y, hearts: player.hearts });
    }

    io.emit('playerMoved', {
      id: socket.id,
      x: player.x,
      y: player.y,
      peeCharge: player.peeCharge
    });
  });

  socket.on('pee', (data) => {
    const player = gameState.players.get(socket.id);
    if (!player || !player.isAlive || player.peeCharge < 20) return;

    const now = Date.now();
    if (now - player.lastPeeTime < 1000) return; // Cooldown

    player.peeCharge -= 20;
    player.lastPeeTime = now;

    const peeMark = {
      id: uuidv4(),
      playerId: socket.id,
      x: data.x,
      y: data.y,
      color: player.peeColor, // Use personalized peeColor
      timestamp: now
    };

    console.log('Creating pee mark with color:', player.peeColor);
    gameState.peeMarks.set(peeMark.id, peeMark);
    
    io.emit('peeMarked', peeMark);
    socket.emit('peeUsed', { peeCharge: player.peeCharge });
  });

  socket.on('poop', (data) => {
    const player = gameState.players.get(socket.id);
    if (!player || !player.isAlive) return;

    const now = Date.now();
    if (now - player.lastPoopTime < 3000) return; // Cooldown

    player.lastPoopTime = now;

    const poopMine = {
      id: uuidv4(),
      playerId: socket.id,
      x: data.x,
      y: data.y,
      timestamp: now
    };

    gameState.poopMines.set(poopMine.id, poopMine);
    
    io.emit('poopMinePlaced', poopMine);
  });

  socket.on('cuddle', (data) => {
    const player = gameState.players.get(socket.id);
    const targetPlayer = gameState.players.get(data.targetId);
    
    if (!player || !targetPlayer || !player.isAlive || !targetPlayer.isAlive) return;

    const distance = Math.sqrt(
      Math.pow(player.x - targetPlayer.x, 2) + 
      Math.pow(player.y - targetPlayer.y, 2)
    );

    if (distance < 40) {
      player.hearts = Math.min(5, player.hearts + 1);
      targetPlayer.hearts = Math.min(5, targetPlayer.hearts + 1);
      
      io.emit('cuddleSuccess', {
        player1: { id: socket.id, hearts: player.hearts },
        player2: { id: data.targetId, hearts: targetPlayer.hearts }
      });
    }
  });

  socket.on('getLeaderboard', () => {
    socket.emit('leaderboardUpdate', getLeaderboard());
  });

  socket.on('battleChoice', ({ battleId, choice }) => {
    const battle = pendingBattles.get(battleId);
    if (!battle) return;
    battle.choices[socket.id] = choice;
    // If both choices are in, resolve immediately
    if (battle.choices[battle.players[0]] && battle.choices[battle.players[1]]) {
      resolveBattle(battleId);
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    gameState.players.delete(socket.id);
    
    // Remove player's pee marks and poop mines
    for (const [markId, mark] of gameState.peeMarks) {
      if (mark.playerId === socket.id) {
        gameState.peeMarks.delete(markId);
      }
    }
    
    for (const [mineId, mine] of gameState.poopMines) {
      if (mine.playerId === socket.id) {
        gameState.poopMines.delete(mineId);
      }
    }

    io.emit('playerLeft', { id: socket.id, totalPlayers: gameState.players.size });
    
    // End game if not enough players
    if (gameState.players.size < 2 && gameState.gameStarted) {
      gameState.gameStarted = false;
      io.emit('gameEnded');
    }
  });
});

// Game loop - send leaderboard updates every 2 seconds
setInterval(() => {
  if (gameState.gameStarted && gameState.players.size > 0) {
    io.emit('leaderboardUpdate', getLeaderboard());
    // Only end game when time runs out
    const elapsed = (Date.now() - gameState.startTime) / 1000;
    if (elapsed >= gameState.gameTime) {
      gameState.gameStarted = false;
      io.emit('gameEnded', { winner: getLeaderboard()[0] });
    }
  }
}, 2000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🐶 PiPiKombat server running on port ${PORT}`);
  console.log(`🎮 Open http://localhost:${PORT} to play!`);
}); 