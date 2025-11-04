// Import Firebase GameService
import { GameService } from './gameService.js';

// ========== Extract Parameters ==========
const params = new URLSearchParams(window.location.search);
const gameId = params.get("gameId");
const player = params.get("player");
const isTournament = params.get("tournament") === "true";
const matchId = params.get("matchId");
let playerName = "اللاعب"; // Default name

let currentPlayer = player === "2" ? 2 : 1;
let rounds = 11; // Default rounds

// Define player parameter for abilities
const playerParam = player === "2" ? "player2" : "player1";

// ✅ أولوية عليا: قراءة من الرابط (URL parameters) أولاً
const nameFromUrl = params.get("name");
const roundsFromUrl = params.get("rounds");

if (nameFromUrl) {
  playerName = decodeURIComponent(nameFromUrl);
  console.log(`✅ Player name from URL: ${playerName}`);
}

if (roundsFromUrl) {
  rounds = parseInt(roundsFromUrl);
  console.log(`✅ Rounds from URL: ${rounds}`);
}

// Tournament mode setup
if (isTournament) {
  console.log('🏆 Tournament mode detected');
  
  // حفظ matchId للتعرف على المباراة
  if (matchId) {
    localStorage.setItem('currentMatchId', matchId);
    console.log(`✅ Match ID saved: ${matchId}`);
  }
}

// Load real player name from localStorage (fallback only)
function loadPlayerName() {
  try {
    // Skip if name already loaded from URL
    if (nameFromUrl) {
      return;
    }
    
    // Fallback: load from localStorage
    const playerKey = playerParam === "player2" ? "player2" : "player1";
    const savedName = localStorage.getItem(playerKey);
    if (savedName) {
      playerName = savedName;
      console.log('Player name from localStorage:', playerName);
    } else {
      // Try to load from gameSetupProgress
      const gameSetup = localStorage.getItem('gameSetupProgress');
      if (gameSetup) {
        try {
          const setupData = JSON.parse(gameSetup);
          if (setupData[playerParam]?.name) {
            playerName = setupData[playerParam].name;
            console.log('Player name from gameSetupProgress:', playerName);
          }
        } catch (e) {
          console.error('Error parsing gameSetupProgress:', e);
        }
      }
    }
  } catch (e) {
    console.error('Error loading player name:', e);
  }
}

// Load player name immediately (only as fallback now)
loadPlayerName();

// Update instruction text with loaded name
function updateInstructionText() {
  if (instruction) {
    instruction.innerText = `اللاعب ${playerName || 'اللاعب'} رتب بطاقاتك`;
    console.log('Updated instruction text:', instruction.innerText);
  }
}

// Define storage keys
const PICKS_LOCAL_KEY = `${playerParam}StrategicPicks`;
const ORDER_LOCAL_KEY = `${playerParam}StrategicOrdered`;

const instruction = document.getElementById("instruction");
const grid = document.getElementById("cardGrid");
const continueBtn = document.getElementById("continueBtn");

// Abilities (self)
const abilitiesWrap = document.getElementById("playerAbilities");
const abilityStatus = document.getElementById("abilityStatus");

// Opponent abilities (view-only)
const oppPanel = document.getElementById("opponentAbilitiesPanel");
const oppWrap = document.getElementById("opponentAbilities");

// Update instruction with real player name
if (instruction) {
  instruction.innerText = `اللاعب ${playerName || 'اللاعب'} رتب بطاقاتك`;
}

// Check if required elements exist
if (!abilitiesWrap) {
  console.error('playerAbilities element not found');
}
if (!abilityStatus) {
  console.error('abilityStatus element not found');
}

let picks = [];
let submittedOrder = null;
let opponentName = "الخصم";

// Socket.IO initialization
const socket = io();
const gameID = gameId || 'default-game';
const playerRole = playerParam;

// Check if socket is initialized
if (!socket) {
  console.error('Socket not initialized');
}

socket.emit("joinGame", { gameID, role: playerRole, playerName: playerName });

// ===== Ability state =====
let myAbilities = [];                 // authoritative list for this player (objects: {text, used})
const tempUsed = new Set();           // optimistic, per-request (text)
const pendingRequests = new Map();    // requestId -> abilityText

/* ================== Helpers ================== */

// Normalize to [{text, used}]
function normalizeAbilityList(arr) {
  const list = Array.isArray(arr) ? arr : [];
  return list.map(a => {
    if (typeof a === "string") return { text: a.trim(), used: false };
    if (a && typeof a === "object") return { text: String(a.text || "").trim(), used: !!a.used };
    return null;
  }).filter(Boolean).filter(a => a.text);
}

function renderBadges(container, abilities, { clickable = false, onClick } = {}) {
  if (!container) return;
  
  container.innerHTML = "";
  const list = Array.isArray(abilities) ? abilities : [];
  list.forEach(ab => {
    const isUsed = !!ab.used;
    const el = document.createElement(clickable ? "button" : "span");
    el.textContent = ab.text;
    el.className =
      "px-3 py-1 rounded-lg font-bold border " +
      (clickable
        ? (isUsed
            ? "bg-gray-500/60 text-black/60 border-gray-600 cursor-not-allowed"
            : "bg-yellow-400 hover:bg-yellow-300 text-black border-yellow-500")
        : "bg-gray-400/70 text-black border-gray-500");
    if (clickable) {
      if (isUsed) { el.disabled = true; el.setAttribute("aria-disabled", "true"); }
      else if (onClick) { el.onclick = () => onClick(ab.text); }
    }
    container.appendChild(el);
  });
}

function hideOpponentPanel() {
  if (oppPanel) {
    oppPanel.classList.add("hidden");
    if (oppWrap) oppWrap.innerHTML = "";
  }
}

/* ================== Load picks + existing order ================== */
function loadPlayerCards() {
  console.log('Loading player cards for:', playerParam);
  
  // ✅ حل مشكلة البطاقات المختلفة: قراءة البطاقات من الرابط أولاً (للبطولة)
  if (isTournament) {
    const cardsFromUrl = params.get('cards');
    
    if (cardsFromUrl) {
      try {
        // فك تشفير البطاقات من base64
        const decodedCards = decodeURIComponent(atob(cardsFromUrl));
        const cardsArray = JSON.parse(decodedCards);
        
        if (Array.isArray(cardsArray) && cardsArray.length > 0) {
          picks = cardsArray;
          
          // حفظ البطاقات في localStorage للاستخدام المستقبلي
          localStorage.setItem(PICKS_LOCAL_KEY, JSON.stringify(picks));
          localStorage.setItem(`${playerParam}StrategicPicks`, JSON.stringify(picks));
          
          console.log(`✅ تم تحميل البطاقات من الرابط للاعب ${playerParam}:`, picks.length, 'cards');
        }
      } catch (e) {
        console.error('Error decoding cards from URL:', e);
      }
    }
  }
  
  // Try to load from localStorage if not already loaded from URL
  if (!picks || picks.length === 0) {
    const localPicks = JSON.parse(localStorage.getItem(PICKS_LOCAL_KEY) || "[]");
    picks = Array.isArray(localPicks) ? localPicks : [];
    
    console.log('Loaded picks from localStorage:', picks);
  }

  // Check if we have a submitted order
  const savedOrder = JSON.parse(localStorage.getItem(ORDER_LOCAL_KEY) || "[]");
  submittedOrder = Array.isArray(savedOrder) && savedOrder.length === picks.length ? savedOrder.slice() : null;
  
  console.log('Loaded order from localStorage:', submittedOrder);

  if (!picks.length) {
    if (grid) {
      grid.innerHTML = `<p class="text-red-500 text-lg">لم يتم العثور على بطاقات لهذا اللاعب.</p>`;
    }
    return;
  }

  if (submittedOrder && submittedOrder.length === picks.length) {
    hideOpponentPanel();
    renderCards(submittedOrder, submittedOrder);
    if (continueBtn) {
      continueBtn.classList.remove("hidden");
      continueBtn.textContent = "✅ تم إرسال الترتيب";
      continueBtn.disabled = true;
    }
  } else {
    renderCards(picks, null);
    if (continueBtn) {
      continueBtn.classList.add("hidden");
      continueBtn.disabled = false;
      continueBtn.textContent = "متابعة";
    }
  }
}

// Try to load cards from server first, then fallback to localStorage
socket.emit("getOrderData", { gameID, playerName });
socket.on("orderData", ({ picks: serverPicks = [], ordered = null }) => {
  if (Array.isArray(serverPicks) && serverPicks.length) {
    picks = serverPicks.slice();
    try { localStorage.setItem(PICKS_LOCAL_KEY, JSON.stringify(picks)); } catch {}
    console.log('Loaded picks from server:', picks);
  } else {
    // Fallback to localStorage
    loadPlayerCards();
    return;
  }

  submittedOrder = Array.isArray(ordered) && ordered.length ? ordered.slice() : null;
  try {
    if (submittedOrder) localStorage.setItem(ORDER_LOCAL_KEY, JSON.stringify(submittedOrder));
    else localStorage.removeItem(ORDER_LOCAL_KEY);
  } catch {}

  if (!picks.length) {
    if (grid) {
      grid.innerHTML = `<p class="text-red-500 text-lg">لم يتم العثور على بطاقات لهذا اللاعب.</p>`;
    }
    return;
  }

  if (submittedOrder && submittedOrder.length === picks.length) {
    hideOpponentPanel();
    renderCards(submittedOrder, submittedOrder);
    if (continueBtn) {
      continueBtn.classList.remove("hidden");
      continueBtn.textContent = "✅ تم إرسال الترتيب";
      continueBtn.disabled = true;
    }
  } else {
    renderCards(picks, null);
    if (continueBtn) {
      continueBtn.classList.add("hidden");
      continueBtn.disabled = false;
      continueBtn.textContent = "متابعة";
    }
  }
});

// Render abilities
function renderAbilities(abilities) {
  if (!abilitiesWrap) return;
  
  // Normalize abilities to the correct format
  const normalizedAbilities = normalizeAbilityList(abilities);
  
  // Use renderBadges for consistent UI
  renderBadges(abilitiesWrap, normalizedAbilities, { 
    clickable: true, 
    onClick: requestUseAbility 
  });
  
  // Update myAbilities to match the normalized format
  myAbilities = normalizedAbilities;
}

// Initialize abilities from localStorage
function loadPlayerAbilitiesFromStorage() {
  console.log('Loading abilities for player:', playerParam);
  
  // Try to load from localStorage first
  const abilitiesKey = `${playerParam}Abilities`;
  const savedAbilities = JSON.parse(localStorage.getItem(abilitiesKey) || '[]');
  
  console.log('Loaded abilities from localStorage:', savedAbilities);
  
  if (Array.isArray(savedAbilities) && savedAbilities.length > 0) {
    // Convert to normalized format
    const normalizedAbilities = savedAbilities.map(ability => {
      const text = typeof ability === 'string' ? ability : (ability.text || ability);
      return { text, used: false };
    });
    
    myAbilities = normalizedAbilities;
    
    if (abilitiesWrap) {
      renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
    }
    if (abilityStatus) {
      abilityStatus.textContent = "اضغط على القدرة لطلب استخدامها. سيتم إشعار المستضيف.";
    }
    
    console.log('Rendered abilities:', myAbilities);
  } else {
    // No abilities found
    if (abilityStatus) {
      abilityStatus.textContent = "لا توجد قدرات متاحة حالياً.";
    }
    console.log('No abilities found for player:', playerParam);
  }
}

// Initialize abilities from localStorage only (no server requests)
loadPlayerAbilitiesFromStorage();

// Simplified ability request (same as order.js)
function requestUseAbility(abilityText) {
  console.log('Requesting ability:', abilityText);
  if (abilityStatus) {
    abilityStatus.textContent = "تم إرسال طلب استخدام القدرة…";
  }
  const requestId = `${playerName}:${Date.now()}`;
  tempUsed.add(abilityText);
  pendingRequests.set(requestId, abilityText);
  myAbilities = (myAbilities || []).map(a => a.text === abilityText ? { ...a, used: true } : a);
  if (abilitiesWrap) {
    renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
  }
  
  // Send request via socket only (same as order.js)
  if (socket) {
    socket.emit("requestUseAbility", { gameID, playerName, abilityText, requestId });
    console.log('Ability request sent via socket:', { gameID, playerName, abilityText, requestId });
  } else {
    console.error('Socket not available for ability request');
    // Reset the ability state if socket is not available
    tempUsed.delete(abilityText);
    pendingRequests.delete(requestId);
    myAbilities = (myAbilities || []).map(a => a.text === abilityText ? { ...a, used: false } : a);
    if (abilitiesWrap) {
      renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
    }
    if (abilityStatus) {
      abilityStatus.textContent = "❌ تعذر إرسال الطلب. تحقق من الاتصال.";
    }
  }
}

// Handle ability request results (same as order.js)
if (socket) {
  socket.on("abilityRequestResult", ({ requestId, ok, reason }) => {
    const abilityText = pendingRequests.get(requestId);
    if (abilityText) pendingRequests.delete(requestId);

    if (!ok) {
      if (abilityText) {
        tempUsed.delete(abilityText);
        myAbilities = (myAbilities || []).map(a => a.text === abilityText ? { ...a, used: false } : a);
      }
      if (abilitiesWrap) {
        renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
      }
      // Reload abilities from localStorage instead of server
      loadPlayerAbilitiesFromStorage();

      if (reason === "already_used") {
        if (abilityStatus) abilityStatus.textContent = "❌ القدرة تم استخدامها بالفعل. اطلب قدرة أخرى.";
      } else if (reason === "ability_not_found") {
        if (abilityStatus) abilityStatus.textContent = "❌ القدرة غير معروفة لدى المستضيف.";
      } else {
        if (abilityStatus) abilityStatus.textContent = "❌ تعذر تنفيذ الطلب.";
      }
    } else {
      if (abilityStatus) abilityStatus.textContent = "✅ تم قبول الطلب من المستضيف.";
    }
  });
}

/* ================== Card Management ================== */

function createMedia(url, className, onClick) {
  const isWebm = /\.webm(\?|#|$)/i.test(url);
  if (isWebm) {
    const vid = document.createElement("video");
    vid.src = url; vid.autoplay = true; vid.loop = true; vid.muted = true; vid.playsInline = true;
    vid.className = className;
    if (onClick) vid.onclick = onClick;
    return vid;
  } else {
    const img = document.createElement("img");
    img.src = url; img.className = className;
    if (onClick) img.onclick = onClick;
    return img;
  }
}

/* ============ Unique-number dropdown logic ============ */
function buildOptions(select, N, forbiddenSet, currentValue) {
  select.innerHTML = "";
  const def = document.createElement("option"); def.value = ""; def.textContent = "-- الترتيب --"; select.appendChild(def);
  for (let i = 1; i <= N; i++) {
    if (!forbiddenSet.has(String(i)) || String(i) === String(currentValue)) {
      const opt = document.createElement("option");
      opt.value = i; opt.textContent = i; select.appendChild(opt);
    }
  }
  if (currentValue && Array.from(select.options).some(o => o.value === String(currentValue))) {
    select.value = String(currentValue);
  } else {
    select.value = "";
  }
}

function snapshotChosen(selects) {
  const values = selects.map(s => s.value || "");
  const chosenSet = new Set(values.filter(Boolean));
  return { chosenSet, values };
}

function refreshAllSelects(selects, N) {
  const { chosenSet, values } = snapshotChosen(selects);
  selects.forEach((sel, idx) => buildOptions(sel, N, chosenSet, values[idx]));
  const allChosen = values.filter(Boolean).length === N && chosenSet.size === N;
  if (continueBtn) {
    continueBtn.classList.toggle("hidden", !allChosen);
    continueBtn.disabled = !allChosen;
  }
}

function renderCards(pickList, lockedOrder = null) {
  if (!grid) return;
  
  grid.innerHTML = "";
  const display = (Array.isArray(lockedOrder) && lockedOrder.length === pickList.length) ? lockedOrder : pickList;
  const selects = [];
  
  display.forEach((url) => {
    const wrapper = document.createElement("div");
    wrapper.className = "flex flex-col items-center space-y-2";
    const media = createMedia(url, "w-36 h-48 object-contain rounded shadow");
    const select = document.createElement("select");
    select.className = "w-24 p-1 rounded bg-gray-800 text-white text-center text-lg orderSelect";
    const def = document.createElement("option"); def.value = ""; def.textContent = "-- الترتيب --"; select.appendChild(def);

    if (Array.isArray(lockedOrder) && lockedOrder.length === pickList.length) {
      const orderIndex = lockedOrder.findIndex(u => u === url);
      if (orderIndex >= 0) {
        const opt = document.createElement("option");
        opt.value = String(orderIndex + 1);
        opt.textContent = String(orderIndex + 1);
        select.appendChild(opt);
        select.value = String(orderIndex + 1);
        select.disabled = true;
      }
    }
    wrapper.appendChild(media);
    wrapper.appendChild(select);
    grid.appendChild(wrapper);
    selects.push(select);
  });

  if (Array.isArray(lockedOrder) && lockedOrder.length === pickList.length) {
    if (continueBtn) continueBtn.classList.add("hidden");
  } else {
    refreshAllSelects(selects, pickList.length);
    selects.forEach(sel => sel.addEventListener("change", () => refreshAllSelects(selects, pickList.length)));
    if (continueBtn) {
      continueBtn.classList.add("hidden");
      continueBtn.disabled = false;
      continueBtn.textContent = "متابعة";
    }
  }
}

/* ================== Submit Ordered Picks ================== */
function submitPicks() {
  if (!picks.length) return;
  if (Array.isArray(submittedOrder) && submittedOrder.length === picks.length) return;

  const dropdowns = document.querySelectorAll(".orderSelect");
  const values = dropdowns.length ? Array.from(dropdowns).map((s) => parseInt(s.value, 10)) : [];
  const inRange = values.every(v => Number.isInteger(v) && v >= 1 && v <= picks.length);
  if (!inRange || new Set(values).size !== picks.length) {
    alert("يرجى ترتيب كل البطاقات بدون تكرار وضمن النطاق الصحيح.");
    return;
  }

  const ordered = new Array(picks.length);
  for (let i = 0; i < values.length; i++) {
    const orderIndex = values[i] - 1;
    ordered[orderIndex] = picks[i];
  }

  // Save to localStorage
  try { 
    localStorage.setItem(ORDER_LOCAL_KEY, JSON.stringify(ordered)); 
  } catch {}
  
  submittedOrder = ordered.slice();
  hideOpponentPanel();

  // Show success message
  if (continueBtn) {
    continueBtn.classList.remove("hidden");
    continueBtn.textContent = "✅ تم إرسال الترتيب";
    continueBtn.disabled = true;
  }

  renderCards(submittedOrder, submittedOrder);
}

// Open battle view for player
function openBattleView() {
  try {
    const battleUrl = `player-view.html?player=${player}&gameId=${gameId}&name=${encodeURIComponent(playerName)}`;
    window.open(battleUrl, '_blank');
  } catch (e) {
    console.error('Error opening battle view:', e);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('Player cards page initialized');
  // Update instruction text with real player name
  updateInstructionText();
  // Load cards immediately from localStorage
  loadPlayerCards();
  // Load abilities from localStorage
  loadPlayerAbilitiesFromStorage();
});

// Export functions for global access
window.submitPicks = submitPicks;
window.openBattleView = openBattleView;

// Keep abilities fresh if host re-syncs (reload from localStorage only)
if (socket) {
  socket.on("diagEvent", () => {
    tempUsed.clear();
    pendingRequests.clear();
    // Reload abilities from localStorage instead of server
    loadPlayerAbilitiesFromStorage();
  });
}
