// js/mode-normal.js
// Adapter for normal (non-tournament) mode

window.GameModeNormal = {
  detect() {
    const currentMatchId = localStorage.getItem('currentMatchId');
    const currentMatchPlayers = localStorage.getItem('currentMatchPlayers');
    return !(currentMatchId && currentMatchPlayers);
  },

  loadConfig(defaults) {
    let gameSetupProgress = {};
    try {
      gameSetupProgress = JSON.parse(localStorage.getItem('gameSetupProgress') || '{}');
    } catch (e) { gameSetupProgress = {}; }

    const roundCount = gameSetupProgress.rounds
      ? parseInt(gameSetupProgress.rounds)
      : (localStorage.getItem('totalRounds') ? parseInt(localStorage.getItem('totalRounds')) : defaults.rounds);

    let player1 = defaults.player1;
    let player2 = defaults.player2;
    try {
      if (gameSetupProgress.player1?.name) player1 = gameSetupProgress.player1.name;
      else if (gameSetupProgress.player1Name) player1 = gameSetupProgress.player1Name;
      else if (localStorage.getItem('player1')) player1 = localStorage.getItem('player1');

      if (gameSetupProgress.player2?.name) player2 = gameSetupProgress.player2.name;
      else if (gameSetupProgress.player2Name) player2 = gameSetupProgress.player2Name;
      else if (localStorage.getItem('player2')) player2 = localStorage.getItem('player2');
    } catch (_) {}

    return {
      isTournament: false,
      roundCount,
      startingHP: roundCount,
      player1,
      player2
    };
  },

  onGameEnd(winner) {
    // Normal mode: navigate to final-result
    localStorage.setItem('currentRound', '0');
    window.location.href = 'final-result.html';
  }
};


