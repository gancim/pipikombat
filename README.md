# 🐶 PiPiKombat - Territory Marking Battle!

A fun multiplayer browser game where dogs compete to mark the most territory while avoiding poop mines and battling other dogs!

## 🎮 Game Features

### Core Mechanics
- **Territory Marking**: Mark territory with your pee (colored by your dog breed)
- **Poop Mines**: Place invisible mines that damage other dogs
- **PvP Battles**: Automatic rock-paper-scissors battles when dogs collide
- **Cuddles**: Heal other dogs (and yourself) by cuddling nearby players
- **Houses**: Return to your house to recharge your pee meter

### Dog Breeds
Each player gets a unique dog breed with different colors:
- 🐕 Shiba (Golden)
- 🐕 Beagle (Brown)
- 🐕 Bassotto (Dark Brown)
- 🐕 Bulldog (Gray)
- 🐕 Barboncino (Beige)
- 🐕 Golden Retriever (Golden)
- 🐕 Labrador (Black)
- 🐕 Chihuahua (Light Brown)

### Game Rules
- **5 Hearts**: Each dog starts with 5 hearts
- **Pee Meter**: Limited pee supply, recharge in your house
- **Territory**: Win by covering the most area with your pee
- **Time Limit**: 5-minute matches
- **Respawn**: 10-second respawn when defeated

## 🚀 Quick Start

### Prerequisites
- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. **Clone or download the project**
   ```bash
   git clone <repository-url>
   cd pipikombat
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

5. **Join the game!**
   - Enter your dog's name
   - Click "Join the Battle!"
   - Wait for other players (minimum 2 to start)

## 🎯 How to Play

### Controls
- **WASD** or **Arrow Keys**: Move your dog
- **SPACE**: Pee (mark territory)
- **P**: Poop (place mine)
- **C**: Cuddle nearby dogs

### Strategy Tips
1. **Mark Territory**: Use your pee strategically to cover large areas
2. **Manage Resources**: Return to your house to recharge your pee meter
3. **Avoid Mines**: Watch out for invisible poop mines placed by other players
4. **Battle Smart**: When colliding with other dogs, you'll automatically battle
5. **Heal Up**: Cuddle with other dogs to restore hearts
6. **Stay Alive**: Keep your hearts above 0 to stay in the game

### Winning Conditions
- **Territory Control**: Cover the most area with your pee
- **Time Limit**: 5-minute matches
- **Territory Threshold**: First player to reach 50% territory wins

## 🛠️ Technical Details

### Architecture
- **Backend**: Node.js with Express and Socket.IO
- **Frontend**: HTML5 Canvas with vanilla JavaScript
- **Real-time**: WebSocket communication for multiplayer
- **Styling**: Modern CSS with cartoon-style design

### Game State Management
- Real-time player synchronization
- Territory tracking and scoring
- Collision detection
- Battle system with rock-paper-scissors
- Mine placement and explosion detection

### Multiplayer Features
- Real-time player movement
- Live leaderboard updates
- Battle notifications
- Territory marking synchronization
- Player respawn system

## 🎨 Visual Design

The game features a charming cartoon aesthetic with:
- Bright, playful colors
- Smooth animations and transitions
- Modern UI with rounded corners
- Emoji-based icons and indicators
- Responsive design for different screen sizes

## 🔧 Development

### Project Structure
```
pipikombat/
├── server/
│   └── index.js          # Main server file
├── public/
│   ├── index.html        # Main HTML file
│   ├── styles.css        # CSS styling
│   └── game.js          # Client-side game logic
├── package.json          # Dependencies and scripts
└── README.md            # This file
```

### Running in Development Mode
```bash
npm run dev
```
This uses nodemon for automatic server restart on file changes.

### Customization
You can easily customize the game by modifying:
- Dog breeds and colors in `server/index.js`
- Game duration in the `gameTime` variable
- Map size and house positions
- Visual styling in `public/styles.css`

## 🐛 Troubleshooting

### Common Issues

1. **Server won't start**
   - Make sure Node.js is installed
   - Check if port 3000 is available
   - Try `npm install` to ensure dependencies are installed

2. **Players can't connect**
   - Ensure the server is running
   - Check browser console for errors
   - Verify WebSocket connection

3. **Game not starting**
   - Need at least 2 players to start
   - Check if all players have joined successfully

## 🎉 Features Implemented

✅ **Core Gameplay**
- Multiplayer territory marking
- Real-time movement and synchronization
- Pee meter system with house recharging
- Poop mine placement and explosion
- Rock-paper-scissors battle system
- Cuddle healing mechanism

✅ **User Interface**
- Welcome screen with player name input
- Real-time game display with canvas rendering
- Player stats (hearts, pee meter)
- Live leaderboard
- Game timer
- Battle and event notifications

✅ **Multiplayer Features**
- WebSocket-based real-time communication
- Player join/leave handling
- Territory tracking and scoring
- Respawn system
- Game start/end conditions

✅ **Visual Design**
- Cartoon-style graphics
- Smooth animations
- Responsive layout
- Modern UI components
- Color-coded territory marking

## 🚀 Future Enhancements

Potential features for future versions:
- Sound effects and background music
- More dog breeds and customization options
- Power-ups and special abilities
- Different map layouts
- Tournament mode
- Persistent player profiles
- Mobile touch controls
- Spectator mode

## 📝 License

This project is open source and available under the MIT License.

---

**Have fun playing PiPiKombat! 🐾**

*Remember: It's just a game - no real dogs were harmed in the making of this territory marking battle!* 