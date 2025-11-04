// Import Firebase GameService
import { GameService } from './gameService.js';

// ✅ نظام حفظ القدرات الدائم - لا تُمسح أبداً
// القدرات التي يتم إضافتها هنا تبقى محفوظة في localStorage دائماً
// حتى لو تم بدء لعبة جديدة، ستظهر القدرات المحفوظة مسبقاً
// القدرات لا تُمسح إلا بموافقة صريحة من المستخدم

// Game state
let gameState = {
  player1: { name: '', abilities: [], selectedCards: [] },
  player2: { name: '', abilities: [], selectedCards: [] },
  currentStep: 2,
  defaultAbilities: []
};

// Load existing data
document.addEventListener('DOMContentLoaded', function() {
  loadExistingData();
  initializeAbilities();
  setupEventListeners();
  setupMessageListeners();
});

// Setup message listeners for cross-page communication
function setupMessageListeners() {
  // Listen for messages from card.js
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'ABILITIES_ADDED') {
      console.log('📥 تم استقبال إشعار إضافة قدرات من card.js:', event.data);
      handleAbilitiesAdded(event.data);
    }
  });
  
  // Listen for storage events
  window.addEventListener('storage', function(e) {
    if (e.key === 'savedAbilities') {
      console.log('📥 تم تحديث savedAbilities في localStorage');
      refreshAbilitiesFromStorage();
    }
  });
  
  // Initialize BroadcastChannel if available
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      window.broadcastChannel = new BroadcastChannel('ability-updates');
      window.broadcastChannel.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'ABILITIES_ADDED') {
          console.log('📥 تم استقبال إشعار إضافة قدرات عبر BroadcastChannel:', event.data);
          handleAbilitiesAdded(event.data);
        }
      });
    }
  } catch (e) {
    console.log('BroadcastChannel not supported');
  }
}

// Handle abilities added from card.js
function handleAbilitiesAdded(data) {
  try {
    console.log('🔄 معالجة القدرات المضافة:', data);
    
    // Refresh abilities from localStorage
    refreshAbilitiesFromStorage();
    
    // Show success message
    const messageEl = document.getElementById('savedAbilitiesMessage');
    if (messageEl) {
      messageEl.style.display = 'block';
      messageEl.textContent = `✅ تم إضافة ${data.globalAbilities.length} قدرة جديدة من صفحة اللعبة - تبقى محفوظة دائماً`;
      messageEl.style.color = '#4caf50';
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        messageEl.style.display = 'none';
      }, 5000);
    }
    
    console.log('✅ تم تحديث قائمة القدرات بنجاح');
    
  } catch (error) {
    console.error('Error handling abilities added:', error);
  }
}

// Refresh abilities from localStorage
function refreshAbilitiesFromStorage() {
  try {
    const savedAbilities = localStorage.getItem('savedAbilities');
    if (savedAbilities) {
      gameState.defaultAbilities = JSON.parse(savedAbilities);
      displayAllAbilities();
      console.log('🔄 تم تحديث قائمة القدرات من localStorage:', gameState.defaultAbilities.length);
    }
  } catch (error) {
    console.error('Error refreshing abilities from storage:', error);
  }
}

function loadExistingData() {
  // Regular challenge mode
  const savedData = localStorage.getItem('gameSetupProgress');
  
  if (savedData) {
    const gameSetupData = JSON.parse(savedData);
    gameState.player1.name = gameSetupData.player1Name;
    gameState.player2.name = gameSetupData.player2Name;
    
    // Update player names in headers
    const player1Header = document.getElementById('player1Title');
    const player2Header = document.getElementById('player2Title');
    
    if (player1Header) {
      player1Header.textContent = `${gameState.player1.name} - القدرات`;
    }
    if (player2Header) {
      player2Header.textContent = `${gameState.player2.name} - القدرات`;
    }
    
    // Display all abilities
    displayAllAbilities();
  }
}

function initializeAbilities() {
  // ✅ دائماً نحمل القدرات المحفوظة - لا تمسح أبداً
  const savedAbilities = localStorage.getItem('savedAbilities');
  if (savedAbilities) {
    gameState.defaultAbilities = JSON.parse(savedAbilities);
    console.log('Loaded saved abilities:', gameState.defaultAbilities.length);
  } else {
    console.log('No saved abilities found, starting fresh');
  }
  
  // Always start with empty player abilities for new game
  gameState.player1.abilities = [];
  gameState.player2.abilities = [];
  displayAbilities();
  displayAllAbilities();
  
  // Show message if abilities were loaded
  if (gameState.defaultAbilities.length > 0) {
    const messageEl = document.getElementById('savedAbilitiesMessage');
    if (messageEl) {
      messageEl.style.display = 'block';
      messageEl.textContent = `💾 تم تحميل ${gameState.defaultAbilities.length} قدرة محفوظة - تبقى محفوظة دائماً`;
    }
    console.log(`تم تحميل ${gameState.defaultAbilities.length} قدرة محفوظة - تبقى محفوظة دائماً`);
  }
}

function shuffleAbilities() {
  // ✅ تحذير: هذا سيمسح جميع القدرات المحفوظة نهائياً
  if (!confirm('هل أنت متأكد من أنك تريد مسح جميع القدرات المحفوظة؟\nهذا الإجراء لا يمكن التراجع عنه!')) {
    return;
  }
  
  // Clear all abilities and start fresh
  gameState.defaultAbilities = [];
  gameState.player1.abilities = [];
  gameState.player2.abilities = [];
  
  // Save empty abilities (this will clear saved abilities permanently)
  localStorage.setItem('savedAbilities', JSON.stringify([]));
  
  displayAllAbilities();
  displayAbilities();
  saveProgress();
  
  // Hide saved abilities message
  const messageEl = document.getElementById('savedAbilitiesMessage');
  if (messageEl) {
    messageEl.style.display = 'none';
  }
  
  console.log('تم مسح جميع القدرات المحفوظة نهائياً');
  alert('تم مسح جميع القدرات المحفوظة نهائياً!');
}

function distributeAbilities() {
  // Clear existing abilities first
  gameState.player1.abilities = [];
  gameState.player2.abilities = [];
  
  if (gameState.defaultAbilities.length < 6) {
    console.log('يجب أن تكون هناك 6 قدرات على الأقل للتوزيع');
    return;
  }
  
  // إنشاء نسخة من القدرات المتاحة مع خلط مكثف
  const availableAbilities = [...gameState.defaultAbilities];
  
  // خلط مكثف للقدرات باستخدام خوارزمية Fisher-Yates
  for (let i = availableAbilities.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableAbilities[i], availableAbilities[j]] = [availableAbilities[j], availableAbilities[i]];
  }
  
  // خلط إضافي باستخدام Math.random() مع عوامل عشوائية متعددة
  const shuffledAbilities = availableAbilities.sort(() => {
    const random1 = Math.random();
    const random2 = Math.random();
    const random3 = Math.random();
    return (random1 + random2 + random3) / 3 - 0.5;
  });
  
  // اختيار 6 قدرات فريدة تماماً مع ضمان عدم التكرار
  const selectedAbilities = [];
  const usedIndices = new Set();
  
  while (selectedAbilities.length < 6 && usedIndices.size < shuffledAbilities.length) {
    // استخدام عدة مصادر عشوائية لضمان التنويع
    const randomSeed1 = Math.random();
    const randomSeed2 = Date.now() % 1000;
    const randomSeed3 = Math.floor(Math.random() * 10000);
    
    const combinedRandom = (randomSeed1 + randomSeed2 + randomSeed3) % shuffledAbilities.length;
    const randomIndex = Math.floor(combinedRandom);
    
    if (!usedIndices.has(randomIndex)) {
      selectedAbilities.push(shuffledAbilities[randomIndex]);
      usedIndices.add(randomIndex);
    }
  }
  
  // ضمان أن لدينا 6 قدرات فريدة تماماً
  if (selectedAbilities.length < 6) {
    console.error('لا يمكن اختيار 6 قدرات فريدة - عدد القدرات المتاحة غير كافي');
    return;
  }
  
  // تقسيم القدرات إلى مجموعتين منفصلتين تماماً (بدون تكرار مطلق)
  const player1Abilities = selectedAbilities.slice(0, 3);
  const player2Abilities = selectedAbilities.slice(3, 6);
  
  // التحقق من عدم وجود تكرار بين اللاعبين
  const player1Set = new Set(player1Abilities);
  const player2Set = new Set(player2Abilities);
  
  // التحقق من عدم التكرار داخل كل لاعب
  if (player1Set.size !== player1Abilities.length) {
    console.error('توجد قدرات مكررة في اللاعب الأول!');
    return;
  }
  
  if (player2Set.size !== player2Abilities.length) {
    console.error('توجد قدرات مكررة في اللاعب الثاني!');
    return;
  }
  
  // التحقق من عدم التكرار بين اللاعبين
  const intersection = [...player1Set].filter(ability => player2Set.has(ability));
  if (intersection.length > 0) {
    console.error('توجد قدرات مكررة بين اللاعبين!', intersection);
    return;
  }
  
  // خلط نهائي لقدرات كل لاعب (مع الحفاظ على عدم التكرار)
  gameState.player1.abilities = player1Abilities.sort(() => Math.random() - 0.5);
  gameState.player2.abilities = player2Abilities.sort(() => Math.random() - 0.5);
  
  // التحقق النهائي من عدم التكرار
  const finalCheck1 = new Set(gameState.player1.abilities);
  const finalCheck2 = new Set(gameState.player2.abilities);
  const finalIntersection = [...finalCheck1].filter(ability => finalCheck2.has(ability));
  
  if (finalIntersection.length > 0) {
    console.error('فشل التحقق النهائي - توجد قدرات مكررة!', finalIntersection);
    return;
  }
  
  displayAbilities();
  saveProgress();
  
  console.log('✅ تم توزيع 3 قدرات فريدة تماماً لكل لاعب - بدون أي تكرار');
  console.log('اللاعب الأول:', gameState.player1.abilities);
  console.log('اللاعب الثاني:', gameState.player2.abilities);
  console.log('✅ تأكيد: لا توجد قدرات مكررة بين اللاعبين');
}

function displayAbilities() {
  displayPlayerAbilities('player1');
  displayPlayerAbilities('player2');
}

function displayAllAbilities() {
  const container = document.getElementById('allAbilitiesList');
  const countElement = document.getElementById('abilitiesCount');
  container.innerHTML = '';
  
  if (gameState.defaultAbilities.length === 0) {
    countElement.textContent = '0';
    return;
  }
  
  countElement.textContent = gameState.defaultAbilities.length;
  
  gameState.defaultAbilities.forEach((ability, index) => {
    const abilityDiv = document.createElement('div');
    abilityDiv.className = 'ability-item';
    abilityDiv.innerHTML = `
      <span class="ability-text">${ability}</span>
      <button class="delete-btn" onclick="deleteAbility(${index})">×</button>
    `;
    container.appendChild(abilityDiv);
  });
}

function deleteAbility(index) {
  const abilityToDelete = gameState.defaultAbilities[index];
  
  // Remove from default abilities
  gameState.defaultAbilities.splice(index, 1);
  
  // Remove from players if they have it
  gameState.player1.abilities = gameState.player1.abilities.filter(ability => ability !== abilityToDelete);
  gameState.player2.abilities = gameState.player2.abilities.filter(ability => ability !== abilityToDelete);
  
  // ✅ حفظ التعديلات في localStorage - تبقى محفوظة دائماً
  localStorage.setItem('savedAbilities', JSON.stringify(gameState.defaultAbilities));
  
  displayAllAbilities();
  displayAbilities();
  saveProgress();
  
  console.log(`تم حذف القدرة "${abilityToDelete}" من القائمة المحفوظة - التعديلات محفوظة دائماً`);
}

function displayPlayerAbilities(player) {
  const container = document.getElementById(`${player}Abilities`);
  container.innerHTML = '';
  
  if (gameState[player].abilities.length === 0) {
    return;
  }
  
  gameState[player].abilities.forEach((ability, index) => {
    const abilityDiv = document.createElement('div');
    abilityDiv.className = 'player-ability-item';
    
    const abilityText = document.createElement('span');
    abilityText.className = 'player-ability-text';
    abilityText.textContent = ability;
    
    abilityDiv.appendChild(abilityText);
    container.appendChild(abilityDiv);
  });
}

function removeAbility(player, index) {
  if (gameState[player].abilities.length > 1) {
    gameState[player].abilities.splice(index, 1);
    displayAbilities();
    saveProgress();
  } else {
    console.log('يجب أن يكون لكل لاعب قدرة واحدة على الأقل');
  }
}

function addCustomAbility() {
  const input = document.getElementById('customAbility');
  const textarea = document.getElementById('bulkAbilities');
  const singleAbility = input.value.trim();
  const bulkAbilities = textarea.value.trim();
  
  // Check if both fields are empty
  if (!singleAbility && !bulkAbilities) {
    alert('يرجى إدخال قدرة واحدة أو عدة قدرات');
    return;
  }
  
  let abilitiesToAdd = [];
  
  // Process single ability
  if (singleAbility) {
    abilitiesToAdd.push(singleAbility);
  }
  
  // Process bulk abilities
  if (bulkAbilities) {
    const bulkList = bulkAbilities
      .split('\n')
      .map(ability => ability.trim())
      .filter(ability => ability.length > 0);
    abilitiesToAdd.push(...bulkList);
  }
  
  if (abilitiesToAdd.length === 0) {
    alert('لم يتم العثور على قدرات صحيحة');
    return;
  }
  
  // Check for duplicates
  const newAbilities = [];
  const duplicates = [];
  
  abilitiesToAdd.forEach(ability => {
    if (gameState.defaultAbilities.includes(ability)) {
      duplicates.push(ability);
    } else {
      newAbilities.push(ability);
    }
  });
  
  // Add new abilities
  if (newAbilities.length > 0) {
    gameState.defaultAbilities.push(...newAbilities);
    
    // ✅ حفظ القدرات في localStorage - تبقى محفوظة دائماً
    localStorage.setItem('savedAbilities', JSON.stringify(gameState.defaultAbilities));
    
    displayAllAbilities();
    saveProgress();
  }
  
  // Clear both fields
  input.value = '';
  textarea.value = '';
  
  // Show success feedback
  const addBtn = document.querySelector('.btn-add');
  const originalText = addBtn.textContent;
  addBtn.textContent = `✅ تمت إضافة ${newAbilities.length} قدرة`;
  addBtn.style.background = '#20c997';
  
  setTimeout(() => {
    addBtn.textContent = originalText;
    addBtn.style.background = '';
  }, 1500);
  
  // Show message about duplicates if any
  if (duplicates.length > 0) {
    console.log(`تم تجاهل ${duplicates.length} قدرة مكررة: ${duplicates.join(', ')}`);
  }
  
  console.log(`تم إضافة ${newAbilities.length} قدرة جديدة وستبقى محفوظة دائماً - لا تُمسح أبداً`);
}


function setupEventListeners() {
  // Enter key in custom ability input
  document.getElementById('customAbility').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addCustomAbility();
    }
  });
  
  // Ctrl+Enter in bulk abilities textarea
  document.getElementById('bulkAbilities').addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'Enter') {
      addCustomAbility();
    }
  });
}

function saveProgress() {
  gameState.currentStep = 2;
  localStorage.setItem('gameSetupProgress', JSON.stringify(gameState));
}

async function nextStep() {
  // Regular challenge mode
  const gameId = sessionStorage.getItem('currentGameId');
  
  if (!gameId) {
    alert('لم يتم العثور على معرف اللعبة');
    return;
  }
  
  // التحقق من وجود القدرات
  if (gameState.player1.abilities.length === 0 || gameState.player2.abilities.length === 0) {
    alert('يجب أن يكون لكل لاعب قدرة واحدة على الأقل');
    return;
  }
  
  try {
    // إظهار loading
    const nextBtn = document.getElementById('nextBtn');
    nextBtn.disabled = true;
    nextBtn.textContent = 'جاري حفظ القدرات...';
    
    // حفظ القدرات في Firebase
    await GameService.savePlayerAbilities(gameId, 1, gameState.player1.abilities);
    await GameService.savePlayerAbilities(gameId, 2, gameState.player2.abilities);
    
    // حفظ في localStorage للتوافق
    localStorage.setItem('player1Abilities', JSON.stringify(gameState.player1.abilities));
    localStorage.setItem('player2Abilities', JSON.stringify(gameState.player2.abilities));
    
    // حفظ التقدم
    saveProgress();
    
    // الانتقال مباشرة إلى final-setup.html
    console.log('✅ تم حفظ القدرات بنجاح - الانتقال إلى final-setup.html');
    setTimeout(() => {
      window.location.href = 'final-setup.html';
    }, 100);
    
  } catch (error) {
    console.error('Error saving abilities:', error);
    alert('حدث خطأ في حفظ القدرات: ' + error.message);
    
    // إعادة تفعيل الزر
    const nextBtn = document.getElementById('nextBtn');
    nextBtn.disabled = false;
    nextBtn.textContent = 'إبدأ';
  }
}

function goBack() {
  saveProgress();
  // Check if this is a tournament match
  const currentMatchId = localStorage.getItem('currentMatchId');
  if (currentMatchId) {
    window.location.href = 'tournament-rounds.html';
  } else {
    window.location.href = 'names-setup.html';
  }
}

function showTournamentIndicator() {
  const container = document.querySelector('.container');
  if (container && !document.getElementById('tournament-indicator')) {
    const indicator = document.createElement('div');
    indicator.id = 'tournament-indicator';
    indicator.style.cssText = `
      font-size: 48px;
      text-align: center;
      margin-bottom: 10px;
      filter: drop-shadow(0 2px 8px rgba(255, 152, 0, 0.3));
    `;
    indicator.textContent = '🏆';
    container.insertBefore(indicator, container.firstChild.nextSibling);
  }
}

// Make functions available globally
window.nextStep = nextStep;
window.saveProgress = saveProgress;
window.addCustomAbility = addCustomAbility;
window.shuffleAbilities = shuffleAbilities;
window.distributeAbilities = distributeAbilities;
window.deleteAbility = deleteAbility;
window.showTournamentIndicator = showTournamentIndicator;