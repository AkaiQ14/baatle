// Mock Socket.IO Server for ability requests
// This simulates the server-side logic from order.js

class MockSocketServer {
  constructor() {
    this.games = new Map(); // gameID -> game data
    this.players = new Map(); // socketId -> player data
  }

  // Initialize a new game
  createGame(gameID) {
    this.games.set(gameID, {
      players: [],
      abilities: {
        player1: [],
        player2: []
      },
      requests: new Map() // requestId -> request data
    });
  }

  // Add player to game
  addPlayer(socketId, gameID, playerName, role) {
    let game = this.games.get(gameID);
    if (!game) {
      this.createGame(gameID);
      game = this.games.get(gameID); // Get the newly created game
    }

    const player = {
      socketId,
      playerName,
      role,
      abilities: []
    };

    this.players.set(socketId, player);
    game.players.push(player);

    // Add default abilities for testing
    if (role === 'player1' || role === 'player2') {
      const playerParam = role === 'player1' ? 'player1' : 'player2';
      const defaultAbilities = [
        'قدرة الهجوم السريع',
        'قدرة الدفاع القوي',
        'قدرة الشفاء',
        'قدرة التخفي',
        'قدرة القوة الخارقة'
      ];
      
      game.abilities[playerParam] = defaultAbilities;
    }
  }

  // Handle ability request
  handleAbilityRequest(gameID, playerName, abilityText, requestId) {
    const game = this.games.get(gameID);
    if (!game) return { success: false, reason: 'game_not_found' };

    // Check if ability exists
    const player = game.players.find(p => p.playerName === playerName);
    if (!player) return { success: false, reason: 'player_not_found' };

    // Check if ability is already used
    const usedAbilities = this.getUsedAbilities(gameID, playerName);
    if (usedAbilities.includes(abilityText)) {
      return { success: false, reason: 'already_used' };
    }

    // Store request
    game.requests.set(requestId, {
      playerName,
      abilityText,
      timestamp: Date.now(),
      status: 'pending'
    });

    return { success: true, requestId };
  }

  // Get used abilities for a player
  getUsedAbilities(gameID, playerName) {
    const game = this.games.get(gameID);
    if (!game) return [];

    const playerParam = game.players.find(p => p.playerName === playerName)?.role === 'player1' ? 'player1' : 'player2';
    return game.abilities[playerParam] || [];
  }

  // Approve ability request
  approveAbilityRequest(gameID, requestId) {
    const game = this.games.get(gameID);
    if (!game) return false;

    const request = game.requests.get(requestId);
    if (!request) return false;

    const player = game.players.find(p => p.playerName === request.playerName);
    if (!player) return false;

    const playerParam = player.role === 'player1' ? 'player1' : 'player2';
    
    // Add to used abilities
    if (!game.abilities[playerParam]) {
      game.abilities[playerParam] = [];
    }
    game.abilities[playerParam].push(request.abilityText);

    // Mark request as approved
    request.status = 'approved';
    
    return true;
  }

  // Reject ability request
  rejectAbilityRequest(gameID, requestId) {
    const game = this.games.get(gameID);
    if (!game) return false;

    const request = game.requests.get(requestId);
    if (!request) return false;

    request.status = 'rejected';
    return true;
  }

  // Get ability requests for a game
  getAbilityRequests(gameID) {
    const game = this.games.get(gameID);
    if (!game) return [];

    return Array.from(game.requests.values()).filter(req => req.status === 'pending');
  }
}

// Global server instance
window.mockSocketServer = new MockSocketServer();

// Mock Socket.IO implementation
class MockSocket {
  constructor() {
    this.socketId = 'mock_' + Date.now();
    this.listeners = new Map();
    this.connected = true;
  }

  emit(event, data) {
    console.log('Socket emit:', event, data);
    
    // Handle specific events
    switch (event) {
      case 'joinGame':
        this.handleJoinGame(data);
        break;
      case 'requestUseAbility':
        this.handleAbilityRequest(data);
        break;
      case 'approveAbilityRequest':
        this.handleApproveAbilityRequest(data);
        break;
      case 'rejectAbilityRequest':
        this.handleRejectAbilityRequest(data);
        break;
      case 'requestAbilities':
        this.handleRequestAbilities(data);
        break;
      case 'getPlayers':
        this.handleGetPlayers(data);
        break;
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  handleJoinGame(data) {
    const { gameID, role, playerName } = data;
    window.mockSocketServer.addPlayer(this.socketId, gameID, playerName || 'Player', role);
    console.log(`Player ${playerName || 'Player'} joined game ${gameID} as ${role}`);
  }

  handleAbilityRequest(data) {
    const { gameID, playerName, abilityText, requestId } = data;
    const result = window.mockSocketServer.handleAbilityRequest(gameID, playerName, abilityText, requestId);
    
    // Store the request for later approval/rejection
    this.currentRequest = { gameID, requestId, playerName, abilityText };
    
    console.log('Ability request stored, waiting for host response');
    
    // Find host socket and send the request
    const game = window.mockSocketServer.games.get(gameID);
    if (game) {
      const hostPlayer = game.players.find(p => p.role === 'host');
      if (hostPlayer) {
        // Find the host socket and send the request
        const hostSocket = Array.from(window.mockSocketServer.players.values())
          .find(p => p.socketId === hostPlayer.socketId);
        
        if (hostSocket) {
          // Send request to host
          console.log('Sending ability request to host:', { playerName, abilityText, requestId });
          // We need to find the actual socket instance and trigger the event
          // For now, let's use a different approach
        }
      }
    }
  }

  handleApproveAbilityRequest(data) {
    const { gameID, requestId } = data;
    const success = window.mockSocketServer.approveAbilityRequest(gameID, requestId);
    
    if (success) {
      // Find the original request
      const game = window.mockSocketServer.games.get(gameID);
      if (game && game.requests.has(requestId)) {
        const request = game.requests.get(requestId);
        
        // Send approval to player
        setTimeout(() => {
          this.trigger('abilityRequestResult', {
            requestId,
            ok: true
          });
        }, 50);
      }
    }
  }

  handleRejectAbilityRequest(data) {
    const { gameID, requestId } = data;
    const success = window.mockSocketServer.rejectAbilityRequest(gameID, requestId);
    
    if (success) {
      // Find the original request
      const game = window.mockSocketServer.games.get(gameID);
      if (game && game.requests.has(requestId)) {
        const request = game.requests.get(requestId);
        
        // Send rejection to player
        setTimeout(() => {
          this.trigger('abilityRequestResult', {
            requestId,
            ok: false,
            reason: 'rejected_by_host'
          });
        }, 50);
      }
    }
  }

  handleRequestAbilities(data) {
    const { gameID, playerName } = data;
    const game = window.mockSocketServer.games.get(gameID);
    if (!game) {
      console.log(`Game ${gameID} not found for ability request`);
      return;
    }

    const player = game.players.find(p => p.playerName === playerName);
    if (!player) {
      console.log(`Player ${playerName} not found in game ${gameID}`);
      return;
    }

    const playerParam = player.role === 'player1' ? 'player1' : 'player2';
    const abilities = game.abilities[playerParam] || [];
    
    console.log(`Sending abilities to ${playerName}:`, abilities);

    // Simulate server response
    setTimeout(() => {
      this.trigger('receiveAbilities', {
        abilities: abilities.map(text => ({ text, used: false })),
        player: playerName
      });
    }, 50);
  }

  handleGetPlayers(data) {
    const { gameID } = data;
    const game = window.mockSocketServer.games.get(gameID);
    if (!game) return;

    const playerNames = game.players.map(p => p.playerName);

    // Simulate server response
    setTimeout(() => {
      this.trigger('players', playerNames);
    }, 50);
  }

  trigger(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => callback(data));
  }
}

// Mock io function
window.io = function() {
  return new MockSocket();
};

console.log('Mock Socket.IO server initialized');