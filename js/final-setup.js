// Import Firebase GameService
import { GameService } from './gameService.js';


// Final Setup - Generate player links for card arrangement
let gameData = {};

// Load game data from localStorage
function loadGameData() {
  try {
    const setupData = localStorage.getItem('gameSetupProgress');
    if (setupData) {
      gameData = JSON.parse(setupData);
      console.log('Loaded game data:', gameData);
      
      // Validate game data structure
      if (!gameData.player1 && !gameData.player1Name) {
        console.warn('Player 1 data not found in game setup');
      }
      if (!gameData.player2 && !gameData.player2Name) {
        console.warn('Player 2 data not found in game setup');
      }
      if (!gameData.rounds) {
        console.warn('Rounds not specified, using default value');
        gameData.rounds = 11;
      }
    } else {
      console.warn('No game setup data found, using defaults');
      gameData = {
        player1: { name: 'اللاعب الأول' },
        player2: { name: 'اللاعب الثاني' },
        rounds: 11
      };
    }
  } catch (e) {
    console.error('Error loading game data:', e);
    gameData = {
      player1: { name: 'اللاعب الأول' },
      player2: { name: 'اللاعب الثاني' },
      rounds: 11
    };
  }
}

// Generate player links
function generatePlayerLinks() {
  const gameId = sessionStorage.getItem('currentGameId');
  
  if (!gameId) {
    alert('لم يتم العثور على معرف اللعبة');
    return { player1Link: '', player2Link: '', player1Name: '', player2Name: '' };
  }
  
  try {
    // Get the correct base URL
    let baseUrl = window.location.origin + window.location.pathname;
    baseUrl = baseUrl.replace('final-setup.html', '');
    
    // Ensure baseUrl ends with /
    if (!baseUrl.endsWith('/')) {
      baseUrl += '/';
    }
    
    // Load real player names from gameData (already loaded)
    let player1Name = 'اللاعب الأول';
    let player2Name = 'اللاعب الثاني';
    
    if (gameData.player1?.name) {
      player1Name = gameData.player1.name;
    } else if (gameData.player1Name) {
      player1Name = gameData.player1Name;
    }
    
    if (gameData.player2?.name) {
      player2Name = gameData.player2.name;
    } else if (gameData.player2Name) {
      player2Name = gameData.player2Name;
    }
    
    // Get rounds from gameData
    const rounds = gameData.rounds || 11;
    
    // Generate proper URLs with gameId, player name, and rounds
    const player1Link = `${baseUrl}player-cards.html?gameId=${gameId}&player=1&name=${encodeURIComponent(player1Name)}&rounds=${rounds}`;
    const player2Link = `${baseUrl}player-cards.html?gameId=${gameId}&player=2&name=${encodeURIComponent(player2Name)}&rounds=${rounds}`;
    
    console.log('Generated links:', { 
      gameId,
      player1Name, 
      player2Name, 
      player1Link,
      player2Link
    });
    
    return { player1Link, player2Link, player1Name, player2Name };
  } catch (e) {
    console.error('Error generating player links:', e);
    alert('حدث خطأ في إنشاء الروابط: ' + e.message);
    return { player1Link: '', player2Link: '', player1Name: '', player2Name: '' };
  }
}

// Copy player link to clipboard
function copyPlayerLink(player) {
  try {
    // Validate player parameter
    if (player !== 'player1' && player !== 'player2') {
      console.error('Invalid player parameter:', player);
      alert('خطأ في تحديد اللاعب');
      return;
    }
    
    const { player1Link, player2Link, player1Name, player2Name } = generatePlayerLinks();
    
    const link = player === 'player1' ? player1Link : player2Link;
    const playerName = player === 'player1' ? player1Name : player2Name;
    
    console.log(`Copying link for ${player} (${playerName}):`, link);
    
    // Check if clipboard API is available
    if (!navigator.clipboard) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        showCopySuccess(player);
      } catch (err) {
        console.error('Fallback copy failed:', err);
        alert('فشل في نسخ الرابط. يرجى نسخه يدوياً:\n' + link);
      }
      document.body.removeChild(textArea);
      return;
    }
    
    // Use modern clipboard API
    navigator.clipboard.writeText(link).then(() => {
      showCopySuccess(player);
      console.log(`Link copied successfully for ${player} (${playerName})`);
    }).catch(err => {
      console.error('Failed to copy link:', err);
      alert('فشل في نسخ الرابط. يرجى نسخه يدوياً:\n' + link);
    });
  } catch (e) {
    console.error('Error in copyPlayerLink:', e);
    alert('حدث خطأ في نسخ الرابط');
  }
}

// Show copy success feedback
function showCopySuccess(player) {
  const button = document.querySelector(`.${player}-btn`);
  if (button) {
    const originalText = button.textContent;
    button.textContent = 'تم النسخ!';
    button.classList.add('copied');
    
    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove('copied');
    }, 2000);
  }
}

// Validate generated links
function validateLinks(player1Link, player2Link) {
  try {
    // Check if links are valid URLs
    const url1 = new URL(player1Link);
    const url2 = new URL(player2Link);
    
    // Check required parameters
    const params1 = new URLSearchParams(url1.search);
    const params2 = new URLSearchParams(url2.search);
    
    const requiredParams = ['player', 'name', 'rounds'];
    const missingParams1 = requiredParams.filter(param => !params1.has(param));
    const missingParams2 = requiredParams.filter(param => !params2.has(param));
    
    if (missingParams1.length > 0) {
      console.error('Player 1 link missing parameters:', missingParams1);
      return false;
    }
    
    if (missingParams2.length > 0) {
      console.error('Player 2 link missing parameters:', missingParams2);
      return false;
    }
    
    // Check if player parameters are correct
    if (params1.get('player') !== 'player1' || params2.get('player') !== 'player2') {
      console.error('Incorrect player parameters in links');
      return false;
    }
    
    console.log('Links validation passed');
    return true;
  } catch (e) {
    console.error('Error validating links:', e);
    return false;
  }
}

// Start battle (redirect to battle page)
async function startBattle() {
  try {
    console.log('startBattle function called'); // Added debug log
    
    const gameId = sessionStorage.getItem('currentGameId');
    
    if (!gameId) {
      console.error('No game ID found'); // More specific error logging
      alert('لم يتم العثور على معرف اللعبة');
      return;
    }
    
    console.log('Fetching game data for gameId:', gameId); // Added debug log
    
    // Get game data from Firebase
    const gameData = await GameService.getGame(gameId);
    
    console.log('Game data retrieved:', gameData); // Added debug log
    
    // Check if both players have completed their arrangements
    const player1Ready = gameData.player1.isReady;
    const player2Ready = gameData.player2.isReady;
    
    console.log('Player readiness:', { player1Ready, player2Ready }); // Added debug log
    
    if (!player1Ready || !player2Ready) {
      alert('يجب أن يكمل كلا اللاعبين ترتيب بطاقاتهم أولاً');
      return;
    }
    
    // Check if both players have card orders
    const player1Cards = gameData.player1.cardOrder;
    const player2Cards = gameData.player2.cardOrder;
    
    if (!player1Cards || !player2Cards || 
        !Array.isArray(player1Cards) || !Array.isArray(player2Cards) ||
        player1Cards.length === 0 || player2Cards.length === 0) {
      alert('بيانات ترتيب البطاقات غير صحيحة. يرجى إعادة ترتيب البطاقات');
      return;
    }
    
    // Save game data to localStorage for card.html compatibility
    const gameSetupProgress = {
      player1: {
        name: gameData.player1.name,
        abilities: gameData.player1.abilities || [],
        selectedCards: player1Cards
      },
      player2: {
        name: gameData.player2.name,
        abilities: gameData.player2.abilities || [],
        selectedCards: player2Cards
      },
      rounds: gameData.rounds || 11
    };
    
    localStorage.setItem('gameSetupProgress', JSON.stringify(gameSetupProgress));
    
    // Save player names for compatibility
    localStorage.setItem('player1', gameData.player1.name);
    localStorage.setItem('player2', gameData.player2.name);
    localStorage.setItem('totalRounds', gameData.rounds.toString());
    
    // Save abilities for compatibility
    localStorage.setItem('player1Abilities', JSON.stringify(gameData.player1.abilities || []));
    localStorage.setItem('player2Abilities', JSON.stringify(gameData.player2.abilities || []));
    
    // Save card orders for compatibility
    localStorage.setItem('player1StrategicOrdered', JSON.stringify(player1Cards));
    localStorage.setItem('player2StrategicOrdered', JSON.stringify(player2Cards));
    
    // Reset round counter for new battle
    localStorage.setItem('currentRound', '0');
    
    // Clear all used abilities for new battle
    localStorage.removeItem('player1UsedAbilities');
    localStorage.removeItem('player2UsedAbilities');
    localStorage.removeItem('usedAbilities');
    localStorage.removeItem('abilityRequests');
    
    // Reset ability usage in abilities lists
    const player1Abilities = gameData.player1.abilities || [];
    const player2Abilities = gameData.player2.abilities || [];
    
    // Reset used state for all abilities
    player1Abilities.forEach(ability => {
      if (typeof ability === 'object' && ability.used !== undefined) {
        ability.used = false;
      }
    });
    player2Abilities.forEach(ability => {
      if (typeof ability === 'object' && ability.used !== undefined) {
        ability.used = false;
      }
    });
    
    // Save updated abilities
    localStorage.setItem('player1Abilities', JSON.stringify(player1Abilities));
    localStorage.setItem('player2Abilities', JSON.stringify(player2Abilities));
    
    console.log('تم إعداد البيانات للعبة الجديدة!');
    console.log('Game data prepared:', { 
      player1: gameData.player1.name, 
      player2: gameData.player2.name, 
      rounds: gameData.rounds,
      player1Cards: player1Cards.length,
      player2Cards: player2Cards.length
    });
    
    // Set battle started flag to enable player view buttons
    localStorage.setItem('battleStarted', 'true');
    
    // Show success message
    showToast('تم تفعيل أزرار عرض التحدي للاعبين!', 'success');
    
    // Small delay before redirecting to allow toast to show
    setTimeout(() => {
      // Redirect to battle page for host
      window.location.href = 'card.html';
    }, 1500);
  } catch (e) {
    console.error('Detailed error in startBattle:', e);
    alert('حدث خطأ في بدء المعركة: ' + e.message);
  }
}

// Check player completion status
async function checkPlayerStatus() {
  try {
    const gameId = sessionStorage.getItem('currentGameId');
    
    if (!gameId) {
      console.log('No game ID found, using localStorage fallback');
      // Fallback to localStorage check
      checkPlayerStatusLocalStorage();
      return;
    }
    
    // Get game data from Firebase
    const gameData = await GameService.getGame(gameId);
    
    const player1Ready = gameData.player1.isReady;
    const player2Ready = gameData.player2.isReady;
    
    // Update player 1 status message
    const player1StatusMessage = document.getElementById('player1StatusMessage');
    if (player1StatusMessage) {
      if (player1Ready) {
        player1StatusMessage.classList.add('show');
        // إظهار رابط اللاعب الثاني بعد اكتمال ترتيب اللاعب الأول
        showPlayer2Link();
      } else {
        player1StatusMessage.classList.remove('show');
      }
    }
    
    // Update player 2 status message
    const player2StatusMessage = document.getElementById('player2StatusMessage');
    if (player2StatusMessage) {
      if (player2Ready) {
        player2StatusMessage.classList.add('show');
      } else {
        player2StatusMessage.classList.remove('show');
      }
    }
    
    // Update battle button
    const battleBtn = document.getElementById('battleBtn');
    if (battleBtn) {
      if (player1Ready && player2Ready) {
        battleBtn.disabled = false;
      } else {
        battleBtn.disabled = true;
      }
    }
    
    console.log('Player status check (Firebase):', { 
      player1Ready, 
      player2Ready,
      player1Cards: gameData.player1.cardOrder?.length || 0,
      player2Cards: gameData.player2.cardOrder?.length || 0
    });
  } catch (e) {
    console.error('Error checking player status:', e);
    // Fallback to localStorage check
    checkPlayerStatusLocalStorage();
  }
}

// Fallback function for localStorage check
function checkPlayerStatusLocalStorage() {
  try {
    // Get the current game ID
    const gameId = sessionStorage.getItem('currentGameId') || 'default';

    // Check for actual submitted orders from player-cards.html
    const player1Order = localStorage.getItem(`${gameId}_player1_order`);
    const player2Order = localStorage.getItem(`${gameId}_player2_order`);
    
    // Parse orders to check if they're valid
    let player1Completed = false;
    let player2Completed = false;
    
    // Check if player 1 has submitted their order
    if (player1Order) {
      try {
        const parsed = JSON.parse(player1Order);
        player1Completed = Array.isArray(parsed) && parsed.length > 0;
      } catch (e) {
        console.warn('Invalid player1 order data');
      }
    }
    
    // Check if player 2 has submitted their order
    if (player2Order) {
      try {
        const parsed = JSON.parse(player2Order);
        player2Completed = Array.isArray(parsed) && parsed.length > 0;
      } catch (e) {
        console.warn('Invalid player2 order data');
      }
    }
    
    // Update player 1 status message
    const player1StatusMessage = document.getElementById('player1StatusMessage');
    if (player1StatusMessage) {
      if (player1Completed) {
        player1StatusMessage.classList.add('show');
      } else {
        player1StatusMessage.classList.remove('show');
      }
    }
    
    // Update player 2 status message
    const player2StatusMessage = document.getElementById('player2StatusMessage');
    if (player2StatusMessage) {
      if (player2Completed) {
        player2StatusMessage.classList.add('show');
      } else {
        player2StatusMessage.classList.remove('show');
      }
    }
    
    // Update battle button
    const battleBtn = document.getElementById('battleBtn');
    if (battleBtn) {
      if (player1Completed && player2Completed) {
        battleBtn.disabled = false;
      } else {
        battleBtn.disabled = true;
      }
    }
    
    console.log('Player status check (localStorage):', { 
      player1Completed, 
      player2Completed,
      player1Order: !!player1Order,
      player2Order: !!player2Order
    });
  } catch (e) {
    console.error('Error checking player status (localStorage):', e);
  }
}

// Update player names in buttons and panels
function updatePlayerNames() {
  // Get player names from gameData
  let player1Name = 'اللاعب الأول';
  let player2Name = 'اللاعب الثاني';
  
  if (gameData.player1?.name) {
    player1Name = gameData.player1.name;
  } else if (gameData.player1Name) {
    player1Name = gameData.player1Name;
  }
  
  if (gameData.player2?.name) {
    player2Name = gameData.player2.name;
  } else if (gameData.player2Name) {
    player2Name = gameData.player2Name;
  }
  
  // Update button names
  const player1NameSpan = document.getElementById('player1Name');
  const player2NameSpan = document.getElementById('player2Name');
  
  if (player1NameSpan) player1NameSpan.textContent = player1Name;
  if (player2NameSpan) player2NameSpan.textContent = player2Name;
  
  // Update status message names
  const player1StatusName = document.getElementById('player1StatusName');
  const player2StatusName = document.getElementById('player2StatusName');
  
  if (player1StatusName) player1StatusName.textContent = player1Name;
  if (player2StatusName) player2StatusName.textContent = player2Name;
  
  // Update ability panel names
  const player1AbilitiesName = document.getElementById('player1AbilitiesName');
  const player2AbilitiesName = document.getElementById('player2AbilitiesName');
  
  if (player1AbilitiesName) player1AbilitiesName.textContent = player1Name;
  if (player2AbilitiesName) player2AbilitiesName.textContent = player2Name;
  
  
  console.log('Updated player names:', { player1Name, player2Name });
}

// Load and display abilities for both players
function loadAbilities() {
  try {
    // Load player 1 abilities
    const player1Abilities = JSON.parse(localStorage.getItem('player1Abilities') || '[]');
    const player1AbilitiesList = document.getElementById('player1AbilitiesList');
    
    if (player1AbilitiesList) {
      player1AbilitiesList.innerHTML = '';
      player1Abilities.forEach(ability => {
        const abilityText = typeof ability === 'string' ? ability : (ability.text || ability);
        const abilityDiv = document.createElement('div');
        abilityDiv.className = 'ability-item';
        abilityDiv.textContent = abilityText;
        player1AbilitiesList.appendChild(abilityDiv);
      });
    }
    
    // Load player 2 abilities
    const player2Abilities = JSON.parse(localStorage.getItem('player2Abilities') || '[]');
    const player2AbilitiesList = document.getElementById('player2AbilitiesList');
    
    if (player2AbilitiesList) {
      player2AbilitiesList.innerHTML = '';
      player2Abilities.forEach(ability => {
        const abilityText = typeof ability === 'string' ? ability : (ability.text || ability);
        const abilityDiv = document.createElement('div');
        abilityDiv.className = 'ability-item';
        abilityDiv.textContent = abilityText;
        player2AbilitiesList.appendChild(abilityDiv);
      });
    }
    
    console.log('Loaded abilities:', { player1: player1Abilities, player2: player2Abilities });
  } catch (e) {
    console.error('Error loading abilities:', e);
  }
}

// Reset battle status for new game
function resetBattleStatus() {
  try {
    localStorage.removeItem('battleStarted');
    console.log('Battle status reset for new game');
  } catch (error) {
    console.error('Error resetting battle status:', error);
  }
}

// Clear old data when starting fresh
function clearOldData() {
  try {
    // Clear old strategic data if it exists
    const player1Order = localStorage.getItem('player1StrategicOrdered');
    const player2Order = localStorage.getItem('player2StrategicOrdered');
    
    // Only clear if the data seems to be from a previous game
    if (player1Order || player2Order) {
      console.log('Clearing old strategic data...');
      localStorage.removeItem('player1StrategicOrdered');
      localStorage.removeItem('player2StrategicOrdered');
      localStorage.removeItem('player1StrategicPicks');
      localStorage.removeItem('player2StrategicPicks');
    }
  } catch (e) {
    console.error('Error clearing old data:', e);
  }
}

// Initialize page
async function init() {
  try {
    console.log('Initializing final-setup page...');
    
    // Clear old data first
    clearOldData();
    
    // Reset battle status for new game setup
    resetBattleStatus();
    
    loadGameData();
    updatePlayerNames();
    loadAbilities();
    await checkPlayerStatus();
    
    // Setup real-time listening
    setupRealTimeListening();
    
    // إخفاء رابط اللاعب الثاني في البداية
    hidePlayer2Link();
    
    // Add explicit event listener for battle start button
    const battleBtn = document.getElementById('battleBtn');
    if (battleBtn) {
      battleBtn.addEventListener('click', startBattle);
      console.log('Battle start button event listener added');
    } else {
      console.warn('Battle start button not found');
    }
    
    console.log('Final-setup page initialized successfully');
  } catch (e) {
    console.error('Error initializing page:', e);
  }
}

// إخفاء رابط اللاعب الثاني في البداية
function hidePlayer2Link() {
  const player2Container = document.querySelector('.button-container:nth-of-type(2)');
  if (player2Container) {
    player2Container.style.display = 'none';
  }
}

// إظهار رابط اللاعب الثاني بعد اكتمال ترتيب اللاعب الأول
function showPlayer2Link() {
  const player2Container = document.querySelector('.button-container:nth-of-type(2)');
  if (player2Container) {
    player2Container.style.display = 'flex';
    player2Container.style.animation = 'slideIn 0.5s ease-out';
  }
}

// Setup real-time listening for Firebase
function setupRealTimeListening() {
  const gameId = sessionStorage.getItem('currentGameId');
  
  if (gameId) {
    // Listen to Firebase changes
    GameService.listenToGame(gameId, (gameData) => {
      updatePlayerStatus(gameData);
    });
  }
}

// Update player status from Firebase data
function updatePlayerStatus(gameData) {
  const player1Ready = gameData.player1.isReady;
  const player2Ready = gameData.player2.isReady;
  
  // Update player 1 status message
  const player1StatusMessage = document.getElementById('player1StatusMessage');
  if (player1StatusMessage) {
    if (player1Ready) {
      player1StatusMessage.classList.add('show');
      // إظهار رابط اللاعب الثاني بعد اكتمال ترتيب اللاعب الأول
      showPlayer2Link();
    } else {
      player1StatusMessage.classList.remove('show');
    }
  }
  
  // Update player 2 status message
  const player2StatusMessage = document.getElementById('player2StatusMessage');
  if (player2StatusMessage) {
    if (player2Ready) {
      player2StatusMessage.classList.add('show');
    } else {
      player2StatusMessage.classList.remove('show');
    }
  }
  
  // Update battle button
  const battleBtn = document.getElementById('battleBtn');
  if (battleBtn) {
    if (player1Ready && player2Ready) {
      battleBtn.disabled = false;
      battleBtn.textContent = 'بدء المعركة';
    } else {
      battleBtn.disabled = true;
      battleBtn.textContent = 'انتظر اكمال اللاعبين';
    }
  }
  
  console.log('Player status updated:', { player1Ready, player2Ready });
}

// Listen for storage changes to update status in real-time
window.addEventListener('storage', function(e) {
  const gameId = sessionStorage.getItem('currentGameId') || 'default';
  
  if (e.key === `${gameId}_player1_order` || 
      e.key === `${gameId}_player2_order` ||
      e.key === `${gameId}_player1_picks` || 
      e.key === `${gameId}_player2_picks`) {
    console.log(`Storage change detected: ${e.key}, updating status...`);
    checkPlayerStatus();
  }
});

// Start when page loads
document.addEventListener('DOMContentLoaded', init);

// Save progress function (for compatibility)
function saveProgress() {
  // This function is kept for compatibility but doesn't need to do anything
  // since we're using Firebase for real-time updates
  console.log('saveProgress called (Firebase mode - no action needed)');
}

// Open player view pages for both players
function openPlayerViewPages() {
  try {
    // Get current game ID
    const gameId = sessionStorage.getItem('currentGameId') || 'default';
    
    // Get base URL
    const baseUrl = window.location.origin + window.location.pathname.replace('final-setup.html', '');
    
    // Generate player view URLs
    const player1Url = `${baseUrl}player-view.html?player=1&gameId=${gameId}`;
    const player2Url = `${baseUrl}player-view.html?player=2&gameId=${gameId}`;
    
    console.log('Opening player view pages:', { player1Url, player2Url });
    
  // Open both in new tabs
  const player1Window = window.open(player1Url, '_blank');
  const player2Window = window.open(player2Url, '_blank');
    
    // Check if windows were opened successfully
    if (!player1Window || player1Window.closed) {
      console.warn('Player 1 window was blocked or closed');
      alert('تم منع نافذة اللاعب الأول. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.');
    }
    
    if (!player2Window || player2Window.closed) {
      console.warn('Player 2 window was blocked or closed');
      alert('تم منع نافذة اللاعب الثاني. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.');
    }
    
    // Store window references for monitoring
    window.player1Window = player1Window;
    window.player2Window = player2Window;
    
    // Show success message
    showToast('تم فتح صفحات اللاعبين بنجاح!', 'success');
    
  } catch (error) {
    console.error('Error opening player view pages:', error);
    alert('حدث خطأ في فتح صفحات اللاعبين: ' + error.message);
  }
}

// Show toast notification
function showToast(message, type = 'info') {
  try {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    // Create new toast
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    // Add type-specific styling
    if (type === 'success') {
      toast.style.borderColor = 'var(--success)';
    } else if (type === 'error') {
      toast.style.borderColor = 'var(--danger)';
    } else if (type === 'warning') {
      toast.style.borderColor = 'var(--warning)';
    }
    
    document.body.appendChild(toast);
    
    // Show toast
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    // Hide toast after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
    
  } catch (error) {
    console.error('Error showing toast:', error);
  }
}


// Make functions available globally
window.copyPlayerLink = copyPlayerLink;
window.startBattle = startBattle;
window.saveProgress = saveProgress;