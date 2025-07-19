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

  // Generate random houses in a town-like pattern with unique colors
  const housePositions = [
    // Top row
    { x: 60, y: 60, color: '#FFD700' },      // Gold
    { x: 220, y: 60, color: '#8B4513' },     // Saddle Brown
    { x: 380, y: 60, color: '#654321' },     // Dark Brown
    { x: 540, y: 60, color: '#696969' },     // Dim Gray
    // Middle row
    { x: 120, y: 250, color: '#F5F5DC' },   // Beige
    { x: 320, y: 250, color: '#DAA520' },   // Goldenrod
    { x: 520, y: 250, color: '#000000' },   // Black
    // Bottom row
    { x: 60, y: 440, color: '#DEB887' },    // Burlywood
    { x: 220, y: 440, color: '#FF69B4' },   // Hot Pink
    { x: 380, y: 440, color: '#00BFFF' },   // Deep Sky Blue
    { x: 540, y: 440, color: '#32CD32' },   // Lime Green
    { x: 320, y: 520, color: '#9370DB' }    // Medium Purple (changed from duplicate #FFD700)
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
const isInOwnHouse = (player, houses) => {
  const radius = 16; // Allow partial overlap for recharge
  return houses.some(house => {
    const inHouse = player.x + radius > house.x &&
      player.x - radius < house.x + house.width &&
      player.y + radius > house.y &&
      player.y - radius < house.y + house.height;
    
    // Debug: Show all houses for yellow players
    if (player.color === '#FFD700') {
      console.log(`🔍 ${player.name} at (${player.x},${player.y}) checking house (${house.color}) at (${house.x},${house.y}) size: ${house.width}x${house.height} - inHouse: ${inHouse}`);
    }
    
    // Only log when player is in their own house (matching color)
    if (inHouse && house.color === player.color) {
      console.log(`✅ ${player.name} in their own house (${house.color}) at (${house.x},${house.y}) - Recharging pee...`);
    }
    
    // Helpful debug for yellow players looking for their house
    if (player.color === '#FFD700' && inHouse && house.color !== player.color) {
      console.log(`💡 ${player.name} (yellow) in wrong house (${house.color}) at (${house.x},${house.y}) - Need to find yellow house`);
    }
    
    return inHouse && house.color === player.color; // Only recharge at own house (matching color)
  });
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

function checkForGameEnd() {
  const alivePlayers = Array.from(gameState.players.values()).filter(player => player.isAlive);
  
  if (alivePlayers.length === 1) {
    const winner = alivePlayers[0];
    console.log(`🏆 ${winner.name} is the last dog standing! Game Over!`);
    gameState.gameStarted = false;
    io.emit('gameEnded', { 
      winner: {
        id: winner.id,
        name: winner.name,
        breed: winner.breed,
        hearts: winner.hearts,
        territoryPercentage: calculateTerritoryPercentage(winner.id)
      },
      message: `${winner.name} is the last dog standing!`
    });
  } else if (alivePlayers.length === 0) {
    console.log(`💀 All dogs have been eliminated! Game Over!`);
    gameState.gameStarted = false;
    io.emit('gameEnded', { 
      winner: null,
      message: 'All dogs have been eliminated!'
    });
  }
}

function resolveBattle(battleId) {
  const battle = pendingBattles.get(battleId);
  if (!battle) {
    console.log(`❌ Battle ${battleId} not found in pending battles`);
    return;
  }
  
  const [id1, id2] = battle.players;
  const player1 = gameState.players.get(id1);
  const player2 = gameState.players.get(id2);
  
  // Check if players still exist and are alive
  if (!player1 || !player2) {
    console.log(`❌ One or both players not found for battle ${battleId}`);
    pendingBattles.delete(battleId);
    return;
  }
  
  if (!player1.isAlive || !player2.isAlive) {
    console.log(`❌ One or both players already eliminated for battle ${battleId}`);
    pendingBattles.delete(battleId);
    return;
  }
  
  let choice1 = battle.choices[id1] || getRandomRPS();
  let choice2 = battle.choices[id2] || getRandomRPS();
  
  console.log(`⚔️ Resolving battle ${battleId}: ${player1.name} (${choice1}) vs ${player2.name} (${choice2})`);

  // Determine winner
  let winnerId = null, loserId = null, result = null;
  if (choice1 === choice2) {
    result = 'draw';
    console.log(`🤝 Battle ${battleId} ended in a draw`);
  } else if (
    (choice1 === 'rock' && choice2 === 'scissors') ||
    (choice1 === 'scissors' && choice2 === 'paper') ||
    (choice1 === 'paper' && choice2 === 'rock')
  ) {
    winnerId = id1;
    loserId = id2;
    result = `${choice1} beats ${choice2}`;
    console.log(`🏆 ${player1.name} wins battle ${battleId} with ${choice1} vs ${choice2}`);
  } else {
    winnerId = id2;
    loserId = id1;
    result = `${choice2} beats ${choice1}`;
    console.log(`🏆 ${player2.name} wins battle ${battleId} with ${choice2} vs ${choice1}`);
  }

  // Update hearts
  if (winnerId && loserId) {
    const winner = gameState.players.get(winnerId);
    const loser = gameState.players.get(loserId);
    if (winner && loser) {
      const oldHearts = loser.hearts;
      loser.hearts = Math.max(0, loser.hearts - 1);
      console.log(`💔 ${loser.name} lost 1 heart: ${oldHearts} → ${loser.hearts}`);
      console.log(`🏆 ${winner.name} won the battle! ${winner.name} hearts: ${winner.hearts}, ${loser.name} hearts: ${loser.hearts}`);
      
      if (loser.hearts <= 0) {
        loser.isAlive = false;
        io.to(loser.id).emit('playerEliminated', { playerName: loser.name });
        console.log(`💀 ${loser.name} has been eliminated in battle!`);
        
        // Check if only one player remains alive
        checkForGameEnd();
      }
    }
  } else {
    console.log(`🤝 Draw - no hearts lost for either player`);
  }

  // Emit result
  const battleResult = {
    winner: winnerId,
    loser: loserId,
    result,
    yourChoice: choice1,
    opponentChoice: choice2,
    hearts: {
      [id1]: gameState.players.get(id1)?.hearts,
      [id2]: gameState.players.get(id2)?.hearts
    }
  };
  
  io.to(id1).emit('battleResult', battleResult);
  io.to(id2).emit('battleResult', {
    ...battleResult,
    yourChoice: choice2,
    opponentChoice: choice1
  });
  
  console.log(`✅ Battle ${battleId} resolved successfully`);
  clearTimeout(battle.timeout);
  pendingBattles.delete(battleId);
}

// Test function to verify heart loss logic
function testHeartLoss() {
  console.log('🧪 Testing heart loss logic...');
  
  // Create test players
  const testPlayer1 = { id: 'test1', name: 'TestPlayer1', hearts: 5, isAlive: true };
  const testPlayer2 = { id: 'test2', name: 'TestPlayer2', hearts: 5, isAlive: true };
  
  // Add to gameState temporarily
  gameState.players.set('test1', testPlayer1);
  gameState.players.set('test2', testPlayer2);
  
  // Create a test battle
  const battleId = 'test-battle-heart-loss';
  pendingBattles.set(battleId, {
    players: [testPlayer1.id, testPlayer2.id],
    choices: { 'test1': 'rock', 'test2': 'scissors' }, // Player1 wins
    timeout: null
  });
  
  console.log('Before battle - Player1 hearts:', testPlayer1.hearts, 'Player2 hearts:', testPlayer2.hearts);
  resolveBattle(battleId);
  console.log('After battle - Player1 hearts:', testPlayer1.hearts, 'Player2 hearts:', testPlayer2.hearts);
  
  // Clean up
  gameState.players.delete('test1');
  gameState.players.delete('test2');
  
  console.log('🧪 Heart loss test completed!');
}

// Socket.io event handlers
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('joinGame', (data) => {
    console.log('Player joining with data:', data);
    console.log('🔥🔥🔥 THIS IS THE UPDATED CODE - SERVER SHOULD SHOW THIS! 🔥🔥🔥');
    const playerCount = gameState.players.size;
    
    // Generate town map if this is the first player
    if (playerCount === 0) {
      gameState.townMap = generateLittleTown();
      console.log('Generated new Little Town map');
    }
    
    // Assign houses that match the player's color
    const playerColor = data.color || DOG_BREEDS[playerCount % DOG_BREEDS.length].color;
    
    // Get all houses that match the player's color
    const matchingHouses = gameState.townMap.houses.filter(house => house.color === playerColor);
    console.log(`🔍 Player ${data.name} (${playerColor}) - Found ${matchingHouses.length} matching houses:`, matchingHouses.map(h => `ID ${h.id} at (${h.x},${h.y})`));
    console.log(`🚨 DEBUG: Enhanced collision detection is ACTIVE!`);
    
    // Find houses that are not currently occupied by other players
    const availableHouses = matchingHouses.filter(house => {
      console.log(`🔍 Checking house ${house.id} at (${house.x},${house.y}) for availability...`);
      console.log(`  Total existing players: ${gameState.players.size}`);
      
      // Check if any existing player is using this house
      for (const [existingId, existingPlayer] of gameState.players) {
        // Calculate the center position of the house where players are placed
        const houseCenterX = house.x + HOUSE_SIZE / 2;
        const houseCenterY = house.y + HOUSE_SIZE / 2;
        
        console.log(`  Comparing with existing player ${existingPlayer.name} at (${existingPlayer.x},${existingPlayer.y})`);
        console.log(`  House center: (${houseCenterX},${houseCenterY})`);
        
        // Check if existing player is at this house's center position
        const playerAtHouseCenter = Math.abs(existingPlayer.x - houseCenterX) < 5 && 
                                   Math.abs(existingPlayer.y - houseCenterY) < 5;
        
        console.log(`  Distance: X=${Math.abs(existingPlayer.x - houseCenterX)}, Y=${Math.abs(existingPlayer.y - houseCenterY)}`);
        console.log(`  Player at house center: ${playerAtHouseCenter}`);
        
        if (playerAtHouseCenter) {
          console.log(`❌ House ${house.id} at (${house.x},${house.y}) is occupied by ${existingPlayer.name} at (${existingPlayer.x},${existingPlayer.y})`);
          return false; // House is taken
        }
      }
      console.log(`✅ House ${house.id} at (${house.x},${house.y}) is available`);
      return true; // House is available
    });
    
    // Select a house - prefer available ones, fallback to any available house of different color
    let selectedHouse;
    if (availableHouses.length > 0) {
      selectedHouse = availableHouses[0];
    } else {
      // No available houses of player's color, find any available house
      const allAvailableHouses = gameState.townMap.houses.filter(house => {
        // Check if any existing player is using this house
        for (const [existingId, existingPlayer] of gameState.players) {
          const houseCenterX = house.x + HOUSE_SIZE / 2;
          const houseCenterY = house.y + HOUSE_SIZE / 2;
          const playerAtHouseCenter = Math.abs(existingPlayer.x - houseCenterX) < 5 && 
                                     Math.abs(existingPlayer.y - houseCenterY) < 5;
          if (playerAtHouseCenter) {
            return false; // House is taken
          }
        }
        return true; // House is available
      });
      
      if (allAvailableHouses.length > 0) {
        selectedHouse = allAvailableHouses[0];
        console.log(`🏠 No available houses of player's color, assigned to different color house: ${selectedHouse.color}`);
      } else {
        // All houses are occupied, use the first house anyway (fallback)
        selectedHouse = gameState.townMap.houses[0];
        console.log(`🏠 All houses occupied, using fallback house`);
      }
    }
    
    console.log(`🏠 Player ${data.name || 'Unknown'} (${playerColor}) assigned to house ${selectedHouse.id} at (${selectedHouse.x}, ${selectedHouse.y})`);
    console.log(`   Available houses: ${availableHouses.length}, Matching houses: ${matchingHouses.length}`);
    console.log(`   Final position: (${selectedHouse.x + HOUSE_SIZE / 2}, ${selectedHouse.y + HOUSE_SIZE / 2})`);
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
      poopCount: 0, // Track number of poops placed
      isAlive: true,
      respawnTime: 0
    };
    
    console.log(`🎮 New player ${player.name} created with peeCharge: ${player.peeCharge}`);

    // Store existing players before adding the new one
    const existingPlayers = Array.from(gameState.players.values());
    console.log('New player joining. Existing players count:', existingPlayers.length);
    existingPlayers.forEach(p => console.log('Existing player:', p.name, 'at', p.x, p.y));
    
    gameState.players.set(socket.id, player);
    
    console.log('Emitting gameJoined with townMap:', gameState.townMap);
    socket.emit('gameJoined', {
      player,
      townMap: gameState.townMap,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
      gameTime: gameState.gameTime
    });

    // Send existing players to the new player
    console.log('Sending existing players to new player. Total existing players:', existingPlayers.length);
    existingPlayers.forEach(existingPlayer => {
      console.log('Sending existing player to new player:', existingPlayer.name, 'at', existingPlayer.x, existingPlayer.y);
      socket.emit('playerJoined', {
        player: existingPlayer,
        totalPlayers: gameState.players.size
      });
    });

    io.emit('playerJoined', {
      player,
      totalPlayers: gameState.players.size
    });

    // Only start game if we have at least 2 fully joined players
    const fullyJoinedPlayers = Array.from(gameState.players.values()).filter(p => p.name && p.name !== `犬${gameState.players.size}`);
    
    if (fullyJoinedPlayers.length >= 2 && !gameState.gameStarted) {
      gameState.gameStarted = true;
      gameState.startTime = Date.now();
      io.emit('gameStarted', { startTime: gameState.startTime });
      console.log(`🎮 Game started with ${fullyJoinedPlayers.length} fully joined players!`);
    } else if (gameState.players.size < 2) {
      // Notify players that they need to wait for more players
      io.emit('waitingForPlayers', { 
        message: `Waiting for more players... (${gameState.players.size}/2)`,
        currentPlayers: gameState.players.size,
        requiredPlayers: 2
      });
    } else if (gameState.players.size >= 2 && !gameState.gameStarted) {
      // Some players haven't provided names yet
      const unnamedPlayers = gameState.players.size - fullyJoinedPlayers.length;
      io.emit('waitingForPlayers', { 
        message: `Waiting for ${unnamedPlayers} player(s) to enter their names... (${fullyJoinedPlayers.length}/2)`,
        currentPlayers: fullyJoinedPlayers.length,
        requiredPlayers: 2
      });
    }
  });

  socket.on('updatePlayerName', (data) => {
    const player = gameState.players.get(socket.id);
    if (!player) return;

    // Update player name
    player.name = data.name;
    console.log(`📝 Player ${socket.id} updated name to: ${data.name}`);

    // Check if we can start the game now
    const fullyJoinedPlayers = Array.from(gameState.players.values()).filter(p => p.name && p.name !== `犬${gameState.players.size}`);
    
    if (fullyJoinedPlayers.length >= 2 && !gameState.gameStarted) {
      gameState.gameStarted = true;
      gameState.startTime = Date.now();
      io.emit('gameStarted', { startTime: gameState.startTime });
      console.log(`🎮 Game started with ${fullyJoinedPlayers.length} fully joined players!`);
    } else if (gameState.players.size >= 2 && !gameState.gameStarted) {
      // Some players haven't provided names yet
      const unnamedPlayers = gameState.players.size - fullyJoinedPlayers.length;
      io.emit('waitingForPlayers', { 
        message: `Waiting for ${unnamedPlayers} player(s) to enter their names... (${fullyJoinedPlayers.length}/2)`,
        currentPlayers: fullyJoinedPlayers.length,
        requiredPlayers: 2
      });
    }
  });

  socket.on('playerMove', (data) => {
    const player = gameState.players.get(socket.id);
    if (!player || !player.isAlive) return;

    // Update player position FIRST
    player.x = Math.max(15, Math.min(MAP_WIDTH - 15, data.x));
    player.y = Math.max(15, Math.min(MAP_HEIGHT - 15, data.y));

    // THEN check if in own house with the NEW position
    const inOwnHouse = isInOwnHouse(player, gameState.townMap.houses);

    // Debug log
    console.log(`Player ${player.name} (color: ${player.color}) at (${player.x},${player.y}) inOwnHouse: ${inOwnHouse}, peeCharge: ${player.peeCharge}`);

    // Regenerate pee if in own house
    if (inOwnHouse && player.peeCharge < 100) {
      player.peeCharge = Math.min(100, player.peeCharge + 1);
      console.log(`🔋 ${player.name} recharging pee! New charge: ${player.peeCharge}`);
    }

    // Check poop mine collision
    if (checkPoopMineCollision(player)) {
      player.hearts = Math.max(0, player.hearts - 1);
      socket.emit('hitPoopMine', { hearts: player.hearts });
      
      if (player.hearts <= 0) {
        player.isAlive = false;
        socket.emit('playerEliminated', { playerName: player.name });
        console.log(`💀 ${player.name} has been eliminated!`);
        
        // Check if only one player remains alive
        checkForGameEnd();
      }
    }

    // Check player collisions
    for (const [otherId, otherPlayer] of gameState.players) {
      if (otherId !== socket.id && otherPlayer.isAlive && checkCollision(player, otherPlayer)) {
        // Check if there's already a pending battle between these players
        const existingBattle = Array.from(pendingBattles.values()).find(battle => 
          battle.players.includes(player.id) && battle.players.includes(otherPlayer.id)
        );
        
        if (existingBattle) {
          console.log(`⚔️ Battle already in progress between ${player.name} and ${otherPlayer.name}`);
          return;
        }
        
        // Start interactive battle
        const battleId = uuidv4();
        console.log(`⚔️ Starting battle between ${player.name} and ${otherPlayer.name} (Battle ID: ${battleId})`);
        pendingBattles.set(battleId, {
          players: [player.id, otherPlayer.id],
          choices: {},
          timeout: setTimeout(() => {
            console.log(`⏰ Battle ${battleId} timed out, resolving...`);
            resolveBattle(battleId);
          }, 6000) // Increased timeout to 6 seconds to match client
        });
        io.to(player.id).emit('battleStart', { battleId, opponent: { id: otherPlayer.id, name: otherPlayer.name } });
        io.to(otherPlayer.id).emit('battleStart', { battleId, opponent: { id: player.id, name: player.name } });
        break;
      }
    }

    // Eliminated players cannot move or respawn
    if (!player.isAlive) return;

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

    console.log(`💧 ${player.name} using pee! Charge before: ${player.peeCharge}`);
    player.peeCharge -= 20;
    player.lastPeeTime = now;
    console.log(`💧 ${player.name} pee used! Charge after: ${player.peeCharge}`);

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

    // Check if player has reached the poop limit
    if (player.poopCount >= 5) {
      console.log(`💩 ${player.name} tried to poop but has reached the limit (5/5)`);
      socket.emit('poopLimitReached', { message: 'You have reached the maximum of 5 poops!' });
      return;
    }

    player.lastPoopTime = now;
    player.poopCount++;

    const poopMine = {
      id: uuidv4(),
      playerId: socket.id,
      x: data.x,
      y: data.y,
      timestamp: now
    };

    console.log(`💩 ${player.name} placed poop mine (${player.poopCount}/5)`);
    gameState.poopMines.set(poopMine.id, poopMine);
    
    io.emit('poopMinePlaced', poopMine);
    socket.emit('poopPlaced', { poopCount: player.poopCount });
  });



  socket.on('getLeaderboard', () => {
    socket.emit('leaderboardUpdate', getLeaderboard());
  });

  socket.on('battleChoice', ({ battleId, choice }) => {
    const battle = pendingBattles.get(battleId);
    if (!battle) {
      console.log(`❌ Battle ${battleId} not found for choice submission`);
      return;
    }
    
    // Check if this player is part of this battle
    if (!battle.players.includes(socket.id)) {
      console.log(`❌ Player ${socket.id} not part of battle ${battleId}`);
      return;
    }
    
    // Check if player already submitted a choice
    if (battle.choices[socket.id]) {
      console.log(`❌ Player ${socket.id} already submitted choice for battle ${battleId}`);
      return;
    }
    
    console.log(`🎯 Player ${socket.id} submitted choice: ${choice} for battle ${battleId}`);
    battle.choices[socket.id] = choice;
    
    // If both choices are in, resolve immediately
    if (battle.choices[battle.players[0]] && battle.choices[battle.players[1]]) {
      console.log(`⚡ Both choices received for battle ${battleId}, resolving immediately`);
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