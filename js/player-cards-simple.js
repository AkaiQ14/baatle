// Import Firebase GameService
import { GameService } from './gameService.js';
import { auth, database } from './firebase-init.js';
import syncService from './sync-service.js';
import { ref, onChildAdded, onChildChanged, onChildRemoved, onValue, get, set } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

// ========== حماية من التداخل بين اللاعبين ==========
// تم إضافة حماية لمنع إعادة تعيين ترتيب اللاعب الآخر عند تأكيد ترتيب أحد اللاعبين
// كل لاعب يستخدم مفاتيح localStorage منفصلة: player1Order, player2Order
// ويستمع فقط للتغييرات الخاصة به في storage events


// ========== Extract Parameters ==========
const params = new URLSearchParams(window.location.search);
const gameId = params.get("gameId"); // يعمل للبطولة والتحدي
const player = params.get("player");
const isTournament = params.get("tournament") === "true"; // for backward compatibility
const matchId = params.get("matchId"); // for backward compatibility

// Define player parameter for abilities first
const playerParam = player === "2" ? "player2" : "player1";

// Initialize player name from multiple sources
let playerName = "اللاعب";
let currentPlayer = player === "2" ? 2 : 1;
let rounds = 11; // Default rounds

// ✅ أولوية عليا: قراءة من الرابط (URL parameters) أولاً - يحل مشكلة البيانات المختلفة
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

// Tournament mode setup - استخدم matchId لتحديد البيانات الصحيحة
if (isTournament) {
  console.log('🏆 Tournament mode detected');
  
  // إذا لم يكن الاسم من الرابط، حاول من localStorage
  if (!nameFromUrl) {
    const currentMatchPlayers = localStorage.getItem('currentMatchPlayers');
    if (currentMatchPlayers) {
      try {
        const players = JSON.parse(currentMatchPlayers);
        playerName = players[currentPlayer - 1];
        console.log(`Tournament player ${currentPlayer} from localStorage: ${playerName}`);
      } catch (e) {
        console.error('Error parsing currentMatchPlayers:', e);
      }
    }
  }
  
  // إذا لم تكن الجولات من الرابط، حاول من localStorage
  if (!roundsFromUrl) {
    const tournamentRounds = localStorage.getItem('tournamentRounds');
    if (tournamentRounds) {
      rounds = parseInt(tournamentRounds);
      console.log(`Tournament rounds from localStorage: ${rounds}`);
    }
  }
  
  // حفظ matchId للتعرف على المباراة
  if (matchId) {
    localStorage.setItem('currentMatchId', matchId);
    console.log(`✅ Match ID saved: ${matchId}`);
  }
}

// ⚠️ فقط كخيار احتياطي نهائي: محاولة القراءة من localStorage إذا لم يتم تعيين الاسم بعد
if (playerName === "اللاعب" && !isTournament) {
  try {
    // Try player1/player2 keys
    const storedName = localStorage.getItem(playerParam) || 
                       localStorage.getItem(player === "2" ? "player2" : "player1");
    if (storedName && storedName !== "اللاعب") {
      playerName = storedName;
      console.log(`Player name from localStorage fallback: ${playerName}`);
    }
    
    // Try gameSetupProgress
    if (!storedName || storedName === "اللاعب") {
      const gameSetup = localStorage.getItem('gameSetupProgress');
      if (gameSetup) {
        const setupData = JSON.parse(gameSetup);
        if (setupData[playerParam]?.name) {
          playerName = setupData[playerParam].name;
          console.log(`Player name from gameSetupProgress: ${playerName}`);
        }
      }
    }
  } catch (e) {
    console.error('Error loading player name:', e);
  }
}

console.log(`✅ Final player name: ${playerName} (${playerParam})`);

// ✅ تهيئة المزامنة مع Firebase (نظام موحد)
if (gameId) {
  syncService.initSync(gameId).then(success => {
    if (success) {
      console.log(`✅ Firebase sync initialized for gameId:`, gameId);
      // ✅ بدء الاستماع لنتائج طلبات القدرات من Firebase
      startPlayerAbilityResultListener();
      
      // ✅ بدء الاستماع لتغييرات usedAbilities من Firebase (لإعادة تفعيل القدرات)
      startUsedAbilitiesListener();
      
      // ✅ بدء الاستماع لتغييرات القدرات من Firebase (لإضافة/نقل القدرات)
      startAbilitiesListener();
      
      // ✅ بدء الاستماع لتحديثات القدرات الفورية (للهواتف)
      startAbilityUpdatesListener();
      
      // ✅ تحميل حالة "تمام" الحالية وتحديث الزر
      loadPlayerReadyState();
      
      // ✅ بدء الاستماع لتغييرات حالة "تمام" من Firebase
      startPlayerReadyListener();
    } else {
      console.warn('⚠️ Firebase sync failed to initialize, using localStorage only');
    }
  });
} else {
  console.warn('⚠️ No gameId found, Firebase sync not initialized');
}

// Define storage keys - مفاتيح تخزين مستقلة لكل لاعب
const PICKS_LOCAL_KEY = `${playerParam}Picks`;
const ORDER_LOCAL_KEY = `${playerParam}Order`;
const GAME_SETUP_KEY = `${playerParam}_gameSetupProgress`;
const GAME_STATE_KEY = `${playerParam}_gameState`;
const CURRENT_GAME_ID_KEY = `${playerParam}_currentGameId`;
const STRATEGIC_GAME_ID_KEY = `${playerParam}_StrategicGameId`;
const LAST_LOAD_TIME_KEY = `${playerParam}_LastLoadTime`;
const LAST_SUBMIT_TIME_KEY = `${playerParam}_LastSubmitTime`;

// ------------------- Persist last-open slot (to survive page reload) -------------------
// Save index of currently open yellow-slot so reload re-opens it
function getLastOpenSlotKey() {
  return `${playerParam}LastOpenSlot_${gameId || 'default'}`;
}

function saveLastOpenSlot(slotIndex) {
  try {
    const key = getLastOpenSlotKey();
    const payload = {
      slotIndex: Number(slotIndex),
      ts: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(payload));
    console.log(`✅ Saved last open slot ${slotIndex} -> ${key}`);
  } catch (e) {
    console.warn('⚠️ Failed to save last open slot:', e);
  }
}

function readLastOpenSlot() {
  try {
    const key = getLastOpenSlotKey();
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    // Protection: ignore old entries > 30 minutes
    if (payload && payload.ts && (Date.now() - payload.ts) > (30 * 60 * 1000)) {
      // stale
      localStorage.removeItem(key);
      return null;
    }
    return (payload && Number.isFinite(payload.slotIndex)) ? payload.slotIndex : null;
  } catch (e) {
    console.warn('⚠️ Failed to read last open slot:', e);
    return null;
  }
}

function clearLastOpenSlot() {
  try {
    const key = getLastOpenSlotKey();
    localStorage.removeItem(key);
    console.log('✅ Cleared last open slot:', key);
  } catch (e) {
    console.warn('⚠️ Failed to clear last open slot:', e);
  }
}
// -------------------------------------------------------------------------------------

// ✅ حماية قوية من التكرار - علامات تتبع حالة التحميل
let isLoadingPlayerCards = false;
let isCardsRendered = false;
let lastLoadPlayerParam = null;
let lastLoadGameId = null;
let isLoadingGameData = false;

const instruction = document.getElementById("instruction");
const grid = document.getElementById("cardGrid");
const continueBtn = document.getElementById("continueBtn");

// Abilities (self)
const abilitiesWrap = document.getElementById("playerAbilities");
const abilityStatus = document.getElementById("abilityStatus");

// Player abilities (view-only) - يختفي عند بدء المعركة
const playerAbilitiesViewPanel = document.getElementById("playerAbilitiesViewPanel");
const playerAbilitiesViewWrap = document.getElementById("playerAbilitiesView");

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
let order = [];
let submittedOrder = null;
let opponentName = "الخصم";

// متغير لمنع التحديثات الخارجية أثناء الترتيب
let isArranging = true;

// ✅ متغيرات لنظام اختيار الكروت (3 كروت لكل بطاقة صفراء)
let cardSlots = []; // البطاقات الصفراء مع 3 كروت لكل بطاقة
let selectedCards = []; // الكروت المختارة من البطاقات الصفراء [{slotIndex: 0, cardPath: "..."}, ...]
let isSelectionPhase = true; // هل نحن في مرحلة الاختيار أم الترتيب

// Initialize card manager
let cardManager = null;

// Socket.IO initialization - REMOVED/DISABLED
// const socket = io();
// const gameID = gameId || 'default-game';
// const playerRole = playerParam;

// Check if socket is initialized - REMOVED/DISABLED
// if (!socket) {
//   console.error('Socket not initialized');
// }

// socket.emit("joinGame", { gameID, role: playerRole, playerName: playerName });

// ===== Ability state =====
let myAbilities = [];                 // authoritative list for this player (objects: {text, used})
const tempUsed = new Set();           // optimistic, per-request (text)
const pendingRequests = new Map();    // requestId -> abilityText
const processedRequests = new Set();  // ✅ تتبع الطلبات المعالجة لمنع التداخل

/* ================== 🔮 نظام طلب القدرات عبر Firebase ================== */

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

function renderBadges(container, abilities, { clickable = false, onClick, badgeColor = 'gray' } = {}) {
  if (!container) {
    console.error('Container not found for renderBadges');
    return;
  }
  
  // ✅ تحديث سلس بدون وميض
  const wasEmpty = container.children.length === 0;
  if (!wasEmpty) {
    container.style.transition = 'opacity 0.15s ease';
    container.style.opacity = '0.7';
  }
  
  container.innerHTML = "";
  const list = Array.isArray(abilities) ? abilities : [];
  console.log('Rendering badges:', { list, clickable, badgeColor });
  
  list.forEach(ab => {
    const isUsed = !!ab.used;
    const el = document.createElement(clickable ? "button" : "span");
    el.textContent = ab.text;
    
    // ✅ تحديد الألوان بناءً على badgeColor
    let className = "px-3 py-1 rounded-lg font-bold border ";
    
    if (clickable) {
      // أزرار قابلة للنقر (مربع طلب القدرات)
      if (isUsed) {
        className += "bg-gray-500/60 text-black/60 border-gray-600 cursor-not-allowed";
      } else {
        className += "bg-yellow-400 hover:bg-yellow-300 text-black border-yellow-500";
      }
    } else {
      // أزرار عرض فقط
      if (badgeColor === 'blue') {
        // ✅ أزرق لمربع عرض قدرات اللاعب نفسه
        if (isUsed) {
          className += "bg-blue-500/60 text-white/80 border-blue-600";
        } else {
          className += "bg-blue-400/80 text-white border-blue-500";
        }
      } else {
        // رمادي افتراضي (مربع عرض قدرات الخصم)
        className += "bg-gray-400/70 text-black border-gray-500";
      }
    }
    
    el.className = className;
    
    // ✅ إضافة transition للتغيير السلس
    el.style.transition = 'all 0.2s ease';
    
    if (clickable) {
      if (isUsed) { 
        el.disabled = true; 
        el.setAttribute("aria-disabled", "true"); 
      } else if (onClick) { 
        el.onclick = () => {
          console.log('Ability clicked:', ab.text);
          onClick(ab.text);
        }; 
      }
    }
    container.appendChild(el);
  });
  
  // ✅ إعادة الشفافية بسرعة
  if (!wasEmpty) {
    setTimeout(() => {
      container.style.opacity = '1';
    }, 50);
  }
  
  console.log('Badges rendered successfully');
}

function hideOpponentPanel() {
  if (oppPanel) {
    oppPanel.classList.add("hidden");
    if (oppWrap) oppWrap.innerHTML = "";
  }
}

// ✅ إخفاء مربع عرض قدرات اللاعب نفسه عند بدء المعركة
function hidePlayerAbilitiesViewPanel() {
  if (playerAbilitiesViewPanel) {
    playerAbilitiesViewPanel.classList.add("hidden");
    if (playerAbilitiesViewWrap) playerAbilitiesViewWrap.innerHTML = "";
  }
}

function createMedia(url, className, onClick) {
  // Use card manager if available, otherwise fallback to original method
  if (cardManager) {
    return cardManager.createMediaElement(url, className, onClick);
  }
  
  const isWebm = /\.webm(\?|#|$)/i.test(url);
  if (isWebm) {
    const vid = document.createElement("video");
    vid.src = url;
    vid.autoplay = true;
    vid.loop = true;
    vid.muted = true;
    vid.playsInline = true;
    vid.className = className;
    vid.style.width = "100%";
    vid.style.height = "100%";
    vid.style.objectFit = "contain";
    vid.style.borderRadius = "12px";
    vid.style.border = "1px solid white";
    vid.style.display = "block";
    if (onClick) vid.onclick = onClick;
    return vid;
  } else {
    const img = document.createElement("img");
    img.src = url;
    img.className = className;
    img.alt = "Card Image";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";
    img.style.borderRadius = "12px";
    img.style.border = "1px solid white";
    img.style.display = "block";
    if (onClick) img.onclick = onClick;
    return img;
  }
}

/* ================== Generate Card Slots ================== */
// ✅ دالة لتوليد cardSlots (20 بطاقة صفراء مع 3 كروت لكل بطاقة)
// ✅ دالة لاستخراج جميع الكروت من cardSlots وتطبيعها للمقارنة
function getAllCardsFromSlots(cardSlots) {
  if (!cardSlots || !Array.isArray(cardSlots)) {
    return [];
  }
  
  const allCards = [];
  cardSlots.forEach(slot => {
    if (Array.isArray(slot)) {
      slot.forEach(card => {
        // تطبيع مسار الكرت للمقارنة الصحيحة
        if (card && typeof card === 'string') {
          const normalizedCard = card.trim().replace(/\/+/g, '/').replace(/\/$/, '');
          if (normalizedCard && !allCards.includes(normalizedCard)) {
            allCards.push(normalizedCard);
          }
        }
      });
    }
  });
  
  return allCards;
}

// ✅ دالة لتطبيع مسار الكرت للمقارنة
function normalizeCardPath(card) {
  if (!card || typeof card !== 'string') {
    return null;
  }
  // تطبيع المسار: إزالة المسافات الزائدة، توحيد الفواصل، إزالة الفواصل النهائية
  return card.trim().replace(/\/+/g, '/').replace(/\/$/, '').toLowerCase();
}

// ✅ دالة للتحقق من عدم وجود تكرار بين اللاعبين
async function validateNoDuplicatesBetweenPlayers(playerCardSlots, gameId) {
  if (!gameId || !playerCardSlots || !Array.isArray(playerCardSlots)) {
    return { isValid: true, duplicates: [] };
  }
  
  try {
    // جلب بيانات اللعبة من Firebase
    const gameData = await GameService.getGame(gameId);
    
    // تحديد اللاعب الآخر
    const otherPlayer = player === "1" ? 2 : 1;
    const otherPlayerData = gameData[`player${otherPlayer}`];
    
    // استخراج جميع الكروت من cardSlots للاعب الحالي
    const currentPlayerCards = getAllCardsFromSlots(playerCardSlots);
    
    // استخراج جميع الكروت من cardSlots للاعب الآخر
    let opponentCards = [];
    if (otherPlayerData && otherPlayerData.cardSlots && Array.isArray(otherPlayerData.cardSlots)) {
      opponentCards = getAllCardsFromSlots(otherPlayerData.cardSlots);
    } else {
      // محاولة من localStorage إذا لم تكن في Firebase
      const otherPlayerParam = otherPlayer === 1 ? 'player1' : 'player2';
      const otherPlayerCardSlotsGameId = localStorage.getItem(`${otherPlayerParam}CardSlots_GameId`);
      if (otherPlayerCardSlotsGameId === gameId) {
        const savedCardSlots = localStorage.getItem(`${otherPlayerParam}CardSlots`);
        if (savedCardSlots) {
          try {
            const parsed = JSON.parse(savedCardSlots);
            opponentCards = getAllCardsFromSlots(parsed);
          } catch (e) {
            console.warn('⚠️ خطأ في تحميل cardSlots للاعب الآخر من localStorage للتحقق');
          }
        }
      }
    }
    
    // التحقق من التكرار باستخدام مقارنة تطبيعية
    const duplicates = [];
    const normalizedCurrentPlayerCards = currentPlayerCards.map(c => normalizeCardPath(c));
    const normalizedOpponentCards = opponentCards.map(c => normalizeCardPath(c));
    
    normalizedCurrentPlayerCards.forEach((normalizedCard, index) => {
      if (normalizedCard && normalizedOpponentCards.includes(normalizedCard)) {
        const originalCard = currentPlayerCards[index];
        if (!duplicates.includes(originalCard)) {
          duplicates.push(originalCard);
        }
      }
    });
    
    if (duplicates.length > 0) {
      console.error(`❌ تم العثور على ${duplicates.length} كرت مكررة بين اللاعبين:`, duplicates);
      return { isValid: false, duplicates };
    }
    
    console.log('✅ التحقق: لا توجد كروت مكررة بين اللاعبين');
    return { isValid: true, duplicates: [] };
    
  } catch (error) {
    console.warn('⚠️ خطأ في التحقق من التكرار:', error);
    // في حالة الخطأ، نعتبر أن التحقق ناجح (لعدم منع الحفظ)
    return { isValid: true, duplicates: [] };
  }
}

async function generateCardSlotsForPlayer() {
  if (!window.cardManager) {
    console.error('cardManager غير متوفر');
    return [];
  }
  
  console.log('🎴 توليد cardSlots للاعب...');
  
  // ✅ جلب الكروت المستخدمة للاعب الآخر (cardSlots + الكروت المختارة) - فقط للعبة الحالية
  let usedCardsByOpponent = [];
  const normalizedOpponentSet = new Set();
  if (gameId) {
    try {
      // تحديد اللاعب الآخر
      const otherPlayer = player === "1" ? 2 : 1;
      const otherPlayerParam = otherPlayer === 1 ? 'player1' : 'player2';
      
      // ✅ التحقق من أن cardSlots للاعب الآخر للعبة الحالية فقط
      const otherPlayerCardSlotsGameId = localStorage.getItem(`${otherPlayerParam}CardSlots_GameId`);
      
      // محاولة جلب cardSlots من Firebase - فقط للعبة الحالية
      const gameData = await GameService.getGame(gameId);
      const otherPlayerData = gameData[`player${otherPlayer}`];
      
      // ✅ استخراج الكروت من cardSlots للاعب الآخر
      if (otherPlayerData && otherPlayerData.cardSlots && Array.isArray(otherPlayerData.cardSlots)) {
        // استخراج جميع الكروت من cardSlots للاعب الآخر باستخدام دالة الاستخراج
        const opponentCardSlotsCards = getAllCardsFromSlots(otherPlayerData.cardSlots);
        usedCardsByOpponent.push(...opponentCardSlotsCards);
        console.log(`✅ تم استبعاد ${opponentCardSlotsCards.length} كرت من cardSlots للاعب الآخر من Firebase`);
      } else if (otherPlayerCardSlotsGameId === gameId) {
        // ✅ محاولة من localStorage - فقط إذا كانت للعبة الحالية
        const otherPlayerCardSlots = localStorage.getItem(`${otherPlayerParam}CardSlots`);
        if (otherPlayerCardSlots) {
          try {
            const parsed = JSON.parse(otherPlayerCardSlots);
            const opponentCardSlotsCards = getAllCardsFromSlots(parsed);
            usedCardsByOpponent.push(...opponentCardSlotsCards);
            console.log(`✅ تم استبعاد ${opponentCardSlotsCards.length} كرت من cardSlots للاعب الآخر من localStorage للعبة ${gameId}`);
          } catch (e) {
            console.warn('⚠️ خطأ في تحميل cardSlots للاعب الآخر من localStorage');
          }
        }
      } else {
        console.log(`ℹ️ تجاهل cardSlots للاعب الآخر - ليست للعبة الحالية (${otherPlayerCardSlotsGameId} != ${gameId})`);
      }
      
      // ✅ استخراج الكروت المختارة فعلياً من قبل اللاعب الآخر (picks أو selectedCards)
      let opponentSelectedCards = [];
      
      // محاولة من Firebase (picks)
      if (otherPlayerData && otherPlayerData.cards && Array.isArray(otherPlayerData.cards)) {
        opponentSelectedCards = otherPlayerData.cards;
        console.log(`✅ تم استبعاد ${opponentSelectedCards.length} كرت مختارة من قبل اللاعب الآخر من Firebase`);
      }
      
      // محاولة من localStorage (selectedCards)
      const otherPlayerSelectedCardsKey = `${otherPlayerParam}SelectedCards_${gameId}`;
      const otherPlayerSelectedCardsGameId = localStorage.getItem(`${otherPlayerParam}SelectedCards_GameId`);
      if (otherPlayerSelectedCardsGameId === gameId) {
        const savedSelectedCards = localStorage.getItem(otherPlayerSelectedCardsKey);
        if (savedSelectedCards) {
          try {
            const parsed = JSON.parse(savedSelectedCards);
            // استخراج cardPath من selectedCards
            const selectedCardPaths = parsed.map(sc => sc.cardPath || sc).filter(card => card);
            opponentSelectedCards.push(...selectedCardPaths);
            console.log(`✅ تم استبعاد ${selectedCardPaths.length} كرت مختارة من localStorage للاعب الآخر`);
          } catch (e) {
            console.warn('⚠️ خطأ في تحميل selectedCards للاعب الآخر من localStorage');
          }
        }
      }
      
      // ✅ إضافة الكروت المختارة إلى القائمة المستبعدة
      if (opponentSelectedCards.length > 0) {
        // إزالة التكرارات
        const uniqueOpponentSelectedCards = [...new Set(opponentSelectedCards)];
        usedCardsByOpponent.push(...uniqueOpponentSelectedCards);
        console.log(`✅ إجمالي الكروت المستبعدة: ${usedCardsByOpponent.length} (${usedCardsByOpponent.length - uniqueOpponentSelectedCards.length} من cardSlots + ${uniqueOpponentSelectedCards.length} مختارة)`);
      }
      
      // ✅ إزالة التكرارات من القائمة النهائية
      const normalizedUsed = usedCardsByOpponent.map(c => normalizeCardPath(c));
      const uniqueUsed = [];
      const seen = new Set();
      usedCardsByOpponent.forEach((card, index) => {
        const normalized = normalizedUsed[index];
        if (normalized && !seen.has(normalized)) {
          seen.add(normalized);
          uniqueUsed.push(card);
        }
      });
      usedCardsByOpponent = uniqueUsed;
      
      // ✅ إضافة الكروت المستبعدة إلى normalizedOpponentSet
      usedCardsByOpponent.forEach(c => {
        const n = normalizeCardPath(c);
        if (n) normalizedOpponentSet.add(n);
      });
      
    } catch (e) {
      console.warn('⚠️ لم يتم العثور على كروت للاعب الآخر أو حدث خطأ:', e);
    }
  }
  
  // جلب الكروت من الفئات المطلوبة فقط
  const commonCards = window.cardManager.getAllCardsByCategory('common') || [];
  const epicCards = window.cardManager.getAllCardsByCategory('epic') || [];
  
  // ✅ استبعاد الكروت المستخدمة للاعب الآخر باستخدام مقارنة تطبيعية
  const availableCommon = commonCards.filter(card => 
    !normalizedOpponentSet.has(normalizeCardPath(card))
  );
  const availableEpic = epicCards.filter(card => 
    !normalizedOpponentSet.has(normalizeCardPath(card))
  );
  
  console.log(`📊 الكروت المتاحة: ${availableCommon.length} common, ${availableEpic.length} epic`);
  console.log(`📊 الكروت المستبعدة: ${usedCardsByOpponent.length} كرت`);
  
  // ✅ حساب عدد الكروت المطلوبة (20 بطاقة صفراء × 3 كروت = 60 كرت)
  const totalCardsNeeded = 20 * 3; // 60 كرت
  const commonCount = Math.floor(totalCardsNeeded * 0.7); // 70% common = 42 كرت
  const epicCount = totalCardsNeeded - commonCount; // 30% epic = 18 كرت
  
  console.log(`📊 نسبة التوزيع: Common ${commonCount} (70%) | Epic ${epicCount} (30%)`);
  
  // ✅ دالة خلط عادل (Fisher-Yates Shuffle) - أكثر عدلاً من sort
  const fairShuffle = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      // استخدام crypto.getRandomValues للحصول على عشوائية أفضل
      const randomBuffer = new Uint32Array(1);
      crypto.getRandomValues(randomBuffer);
      const j = randomBuffer[0] % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };
  
  // ✅ إنشاء بذرة فريدة لكل لعبة ولاعب لضمان العدالة والاختلاف التام
  // ✅ استخدام timestamp إضافي لضمان الاختلاف حتى في نفس gameId
  const gameSeed = gameId ? (gameId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) : Date.now();
  const playerSeed = player === "1" ? 1001 : 2002;
  // ✅ إضافة timestamp لتوليد بذرة فريدة لكل مرة حتى لو كان gameId نفسه
  const timestampSeed = Date.now() % 1000000; // آخر 6 أرقام من timestamp
  const uniqueSeed = gameSeed + playerSeed + timestampSeed;
  
  // ✅ خلط الكروت باستخدام البذرة الفريدة لضمان العدالة
  const shuffledEpic = fairShuffle(availableEpic);
  const shuffledCommon = fairShuffle(availableCommon);
  
  // ✅ خلط إضافي بناءً على البذرة الفريدة لضمان العدالة الكاملة
  const seedShuffle = (array, seed) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const seedIndex = (seed + i) % (i + 1);
      [shuffled[i], shuffled[seedIndex]] = [shuffled[seedIndex], shuffled[i]];
    }
    return shuffled;
  };
  
  const finalShuffledEpic = seedShuffle(shuffledEpic, uniqueSeed);
  const finalShuffledCommon = seedShuffle(shuffledCommon, uniqueSeed);
  
  console.log(`🎲 بذرة فريدة للاعب ${player}: ${uniqueSeed}`);
  
  // ✅ إنشاء مجموعة مختلطة بنسبة 70% common و 30% epic (منصفة وعادلة)
  const selectedCards = [];
  
  // إضافة كروت common (حتى 70%) - بشكل عادل
  let actualCommonAdded = 0;
  for (let i = 0; i < commonCount && i < finalShuffledCommon.length; i++) {
    selectedCards.push(finalShuffledCommon[i]);
    actualCommonAdded++;
  }
  
  // إضافة كروت epic (حتى 30%) - بشكل عادل
  let actualEpicAdded = 0;
  for (let i = 0; i < epicCount && i < finalShuffledEpic.length; i++) {
    selectedCards.push(finalShuffledEpic[i]);
    actualEpicAdded++;
  }
  
  // ✅ إذا كان هناك نقص، نملأ مع الحفاظ على النسبة 70/30 قدر الإمكان
  const currentTotal = selectedCards.length;
  if (currentTotal < totalCardsNeeded) {
    const remainingNeeded = totalCardsNeeded - currentTotal;
    
    // حساب النسبة المثالية للكروت المتبقية
    const idealCommonForRemaining = Math.floor(remainingNeeded * 0.7);
    const idealEpicForRemaining = remainingNeeded - idealCommonForRemaining;
    
    // محاولة ملء النقص من common أولاً (حسب النسبة 70%)
    let commonToAdd = Math.min(idealCommonForRemaining, finalShuffledCommon.length - actualCommonAdded);
    for (let i = actualCommonAdded; i < actualCommonAdded + commonToAdd; i++) {
      selectedCards.push(finalShuffledCommon[i]);
    }
    
    // ملء الباقي من epic (حسب النسبة 30%)
    const stillNeeded = totalCardsNeeded - selectedCards.length;
    if (stillNeeded > 0) {
      let epicToAdd = Math.min(stillNeeded, finalShuffledEpic.length - actualEpicAdded);
      for (let i = actualEpicAdded; i < actualEpicAdded + epicToAdd; i++) {
        selectedCards.push(finalShuffledEpic[i]);
      }
    }
    
    // إذا ما زال هناك نقص، نملأ من common
    const finalNeeded = totalCardsNeeded - selectedCards.length;
    if (finalNeeded > 0 && finalShuffledCommon.length > (actualCommonAdded + commonToAdd)) {
      const finalCommonToAdd = Math.min(finalNeeded, finalShuffledCommon.length - (actualCommonAdded + commonToAdd));
      for (let i = actualCommonAdded + commonToAdd; i < actualCommonAdded + commonToAdd + finalCommonToAdd; i++) {
        selectedCards.push(finalShuffledCommon[i]);
      }
    }
  }
  
  // ✅ التحقق من النسبة النهائية
  const finalCommonCount = selectedCards.filter(card => availableCommon.includes(card)).length;
  const finalEpicCount = selectedCards.filter(card => availableEpic.includes(card)).length;
  const finalTotal = finalCommonCount + finalEpicCount;
  if (finalTotal > 0) {
    const actualCommonPercent = Math.round((finalCommonCount / finalTotal) * 100);
    const actualEpicPercent = Math.round((finalEpicCount / finalTotal) * 100);
    console.log(`✅ النسبة النهائية للاعب ${player}: Common ${finalCommonCount} (${actualCommonPercent}%) | Epic ${finalEpicCount} (${actualEpicPercent}%)`);
  }
  
  // ✅ خلط الكروت المختارة بشكل عادل (Fisher-Yates)
  const allAvailableCards = fairShuffle(selectedCards);
  
  if (allAvailableCards.length === 0) {
    console.error('❌ لا توجد كروت متاحة');
    return [];
  }
  
  console.log(`✅ تم اختيار ${allAvailableCards.length} كرت: ${epicCount} epic و ${commonCount} common`);
  
  // عدد البطاقات الصفراء (20)
  const totalSlots = 20;
  const playerCardSlots = [];
  
  // ✅ منع التكرار داخل اللاعب نفسه - استخدام Set لتتبع الكروت المستخدمة بشكل فريد
  const globalUsedSet = new Set();
  
  // ✅ دالة للحصول على كرت عشوائي بشكل عادل (استخدام crypto.getRandomValues)
  const getRandomCard = (availableCards) => {
    if (availableCards.length === 0) return null;
    // استخدام crypto.getRandomValues للحصول على عشوائية أفضل وعدالة أكبر
    const randomBuffer = new Uint32Array(1);
    crypto.getRandomValues(randomBuffer);
    const randomIndex = randomBuffer[0] % availableCards.length;
    return availableCards[randomIndex];
  };
  
  // ✅ دالة لإنشاء مجموعة من 3 كروت فريدة مع توزيع عادل - منع التكرار تماماً
  const createSlot = (slotIndex, availableCardsPool) => {
    const slotCards = [];
    
    // ✅ فلترة الكروت المتاحة - استبعاد الكروت المستخدمة بالفعل (باستخدام normalizeCardPath)
    const availableForSlot = availableCardsPool.filter(card => {
      const normalized = normalizeCardPath(card);
      return normalized && !globalUsedSet.has(normalized);
    });
    
    if (availableForSlot.length === 0) {
      console.warn(`⚠️ لا توجد كروت متاحة للسلوط ${slotIndex}`);
      return slotCards;
    }
    
    // ✅ توزيع عادل: محاولة الحصول على مزيج من common و epic لكل بطاقة
    const availableCommonForSlot = availableForSlot.filter(card => availableCommon.includes(card));
    const availableEpicForSlot = availableForSlot.filter(card => availableEpic.includes(card));
    
    // ✅ توزيع ذكي: محاولة إضافة كرت epic واحد على الأقل لكل 3 بطاقات
    const shouldIncludeEpic = (slotIndex % 3) === 0 && availableEpicForSlot.length > 0;
    
    // محاولة الحصول على 3 كروت فريدة مع توزيع عادل
    while (slotCards.length < 3 && availableForSlot.length > 0) {
      let randomCard = null;
      
      // إذا كان يجب إضافة epic ولم نضف واحداً بعد
      if (shouldIncludeEpic && slotCards.length < 2 && availableEpicForSlot.length > 0) {
        // ✅ استخدام crypto.getRandomValues للحصول على عشوائية أفضل
        const epicRandomBuffer = new Uint32Array(1);
        crypto.getRandomValues(epicRandomBuffer);
        const epicIndex = epicRandomBuffer[0] % availableEpicForSlot.length;
        randomCard = availableEpicForSlot[epicIndex];
      } else {
        // اختيار عشوائي عادل من الكروت المتاحة
        randomCard = getRandomCard(availableForSlot);
      }
      
      if (randomCard) {
        const normalized = normalizeCardPath(randomCard);
        
        // ✅ التحقق من عدم التكرار - يجب أن يكون الكرت فريداً تماماً
        if (normalized && !globalUsedSet.has(normalized) && !slotCards.includes(randomCard)) {
          slotCards.push(randomCard);
          // ✅ إضافة الكرت إلى Set المستخدمة لمنع التكرار تماماً
          globalUsedSet.add(normalized);
          
          // إزالة الكرت من القائمة المتاحة لهذا السلوط
          const index = availableForSlot.indexOf(randomCard);
          if (index > -1) {
            availableForSlot.splice(index, 1);
          }
          // إزالة من قائمة epic/common إذا كان موجوداً
          const epicIndex = availableEpicForSlot.indexOf(randomCard);
          if (epicIndex > -1) {
            availableEpicForSlot.splice(epicIndex, 1);
          }
          const commonIndex = availableCommonForSlot.indexOf(randomCard);
          if (commonIndex > -1) {
            availableCommonForSlot.splice(commonIndex, 1);
          }
        } else {
          // إذا كان الكرت مستخدماً بالفعل، نزيله من القائمة المتاحة
          const index = availableForSlot.indexOf(randomCard);
          if (index > -1) {
            availableForSlot.splice(index, 1);
          }
        }
      } else {
        break; // لا توجد كروت متاحة
      }
    }
    
    return slotCards;
  };
  
  // ✅ توليد 20 بطاقة صفراء مع 3 كروت لكل بطاقة - توزيع عادل ومنع التكرار تماماً
  // ✅ خلط الكروت مرة أخرى قبل التوزيع على البطاقات لضمان العدالة
  const shuffledForDistribution = fairShuffle(allAvailableCards);
  
  for (let i = 0; i < totalSlots; i++) {
    const slotCards = createSlot(i, shuffledForDistribution);
    
    if (slotCards.length === 3) {
      // ✅ خلط الكروت داخل البطاقة الواحدة لضمان التنوع
      const shuffledSlotCards = fairShuffle(slotCards);
      playerCardSlots.push(shuffledSlotCards);
    } else if (slotCards.length > 0) {
      // ✅ إذا كان هناك كروت أقل من 3، نستخدم ما هو متاح
      const shuffledSlotCards = fairShuffle(slotCards);
      playerCardSlots.push(shuffledSlotCards);
      console.warn(`⚠️ السلوط ${i} يحتوي على ${slotCards.length} كروت فقط بدلاً من 3`);
    } else {
      // ✅ إذا لم نجد أي كروت، نستخدم كروت متاحة من القائمة المتبقية
      const remainingCards = shuffledForDistribution.filter(card => {
        const normalized = normalizeCardPath(card);
        return normalized && !globalUsedSet.has(normalized);
      });
      
      if (remainingCards.length > 0) {
        const fallbackCards = [];
        while (fallbackCards.length < 3 && remainingCards.length > 0) {
          const randomCard = getRandomCard(remainingCards);
          if (randomCard) {
            const normalized = normalizeCardPath(randomCard);
            if (normalized && !globalUsedSet.has(normalized)) {
              fallbackCards.push(randomCard);
              globalUsedSet.add(normalized);
              const index = remainingCards.indexOf(randomCard);
              if (index > -1) {
                remainingCards.splice(index, 1);
              }
            } else {
              const index = remainingCards.indexOf(randomCard);
              if (index > -1) {
                remainingCards.splice(index, 1);
              }
            }
          } else {
            break;
          }
        }
        
        if (fallbackCards.length > 0) {
          const shuffledFallbackCards = fairShuffle(fallbackCards);
          playerCardSlots.push(shuffledFallbackCards);
          console.warn(`⚠️ السلوط ${i} يستخدم كروت احتياطية: ${fallbackCards.length} كروت`);
        }
      }
    }
  }
  
  // ✅ التحقق من عدم التكرار - فحص نهائي
  const allCardsInSlots = playerCardSlots.flat();
  const normalizedAllCards = allCardsInSlots.map(card => normalizeCardPath(card));
  const uniqueNormalized = new Set(normalizedAllCards);
  
  if (normalizedAllCards.length !== uniqueNormalized.size) {
    console.error(`❌ تم اكتشاف تكرار في الكروت! إجمالي: ${normalizedAllCards.length}, فريدة: ${uniqueNormalized.size}`);
    const duplicates = normalizedAllCards.filter((card, index) => normalizedAllCards.indexOf(card) !== index);
    console.error('❌ الكروت المكررة:', duplicates);
  } else {
    console.log(`✅ تم التحقق: جميع الكروت الـ ${normalizedAllCards.length} فريدة تماماً`);
  }
  
  console.log('✅ تم توليد cardSlots:', {
    totalSlots: playerCardSlots.length,
    cardsPerSlot: playerCardSlots[0]?.length || 0
  });
  
  return playerCardSlots;
}

/* ================== Load Game Data from Firebase ================== */
async function loadGameData() {
  // ✅ حماية قوية من التكرار - التحقق من حالة التحميل
  if (isLoadingGameData) {
    console.log(`⚠️ تجاهل تحميل gameData متكرر للاعب ${playerParam} - التحميل قيد التنفيذ`);
    return;
  }
  
  if (!gameId) {
    console.error('No game ID found');
    alert('لم يتم العثور على معرف اللعبة');
    return;
  }
  
  // ✅ تعيين علامة التحميل قبل البدء
  isLoadingGameData = true;
  
  try {
    // إظهار loading
    if (instruction) {
      instruction.textContent = 'جاري تحميل بيانات اللعبة...';
    }
    
    // مسح البيانات القديمة إذا كانت من لعبة مختلفة
    const currentGameId = localStorage.getItem(CURRENT_GAME_ID_KEY);
    if (currentGameId && currentGameId !== gameId) {
      clearOldGameData();
    }
    
    // ✅ مسح الكروت المختارة القديمة إذا كانت من لعبة مختلفة
    const selectedCardsGameId = localStorage.getItem(`${playerParam}SelectedCards_GameId`);
    if (selectedCardsGameId && selectedCardsGameId !== gameId) {
      console.log('🧹 مسح الكروت المختارة القديمة من لعبة مختلفة عند التحميل');
      // مسح جميع الكروت المختارة القديمة
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(`${playerParam}SelectedCards_`)) {
          localStorage.removeItem(key);
        }
      });
      localStorage.removeItem(`${playerParam}SelectedCards_GameId`);
      selectedCards = [];
      isSelectionPhase = true;
    } else if (selectedCardsGameId === gameId) {
      // ✅ تحميل فوري للكروت المختارة إذا كانت للعبة الحالية
      const savedSelectedCardsKey = `${playerParam}SelectedCards_${gameId}`;
      const savedSelectedCards = localStorage.getItem(savedSelectedCardsKey);
      if (savedSelectedCards) {
        try {
          selectedCards = JSON.parse(savedSelectedCards);
          console.log(`✅ تحميل فوري: تم تحميل ${selectedCards.length} كرت مختار مسبقاً`);
          
          // ✅ تحميل حالة isSelectionPhase
          const savedIsSelectionPhase = localStorage.getItem(`${playerParam}IsSelectionPhase_${gameId}`);
          if (savedIsSelectionPhase !== null) {
            try {
              isSelectionPhase = JSON.parse(savedIsSelectionPhase);
              console.log(`✅ تم تحميل حالة isSelectionPhase: ${isSelectionPhase}`);
            } catch (e) {
              console.error('❌ خطأ في تحميل isSelectionPhase:', e);
            }
          }
        } catch (e) {
          console.error('❌ خطأ في التحميل الفوري للكروت المختارة:', e);
          selectedCards = [];
        }
      }
    }
    
    // جلب البيانات من Firebase
    const gameData = await GameService.getGame(gameId);
    const playerData = gameData[`player${player}`];
    
    // تحديث المتغيرات
    picks = playerData.cards || [];
    myAbilities = normalizeAbilityList(playerData.abilities || []);
    playerName = playerData.name || "اللاعب";
    rounds = gameData.rounds || 11;
    
  // ✅ تحميل cardSlots من Firebase (البطاقات الصفراء مع 3 كروت لكل بطاقة)
  cardSlots = playerData.cardSlots || [];
  
  // ✅ التحقق من أن cardSlots من Firebase للعبة الحالية فقط
  if (cardSlots && cardSlots.length > 0) {
    // التحقق من أن cardSlots من Firebase مرتبطة باللعبة الحالية
    const cardSlotsGameId = localStorage.getItem(`${playerParam}CardSlots_GameId`);
    if (cardSlotsGameId && cardSlotsGameId !== gameId) {
      console.log(`🧹 cardSlots من Firebase للعبة مختلفة (${cardSlotsGameId} != ${gameId}) - سيتم توليد جديدة`);
      cardSlots = [];
    } else {
      // حفظ gameId للتحقق في المستقبل
      localStorage.setItem(`${playerParam}CardSlots_GameId`, gameId);
    }
  }
  
  // ✅ إذا لم توجد cardSlots في Firebase، حاول من localStorage مع التحقق من gameId
  if (!cardSlots || cardSlots.length === 0) {
    const savedCardSlots = localStorage.getItem(`${playerParam}CardSlots`);
    const cardSlotsGameId = localStorage.getItem(`${playerParam}CardSlots_GameId`);
    
    // ✅ التحقق الشديد: يجب أن تكون cardSlots للعبة الحالية فقط
    if (savedCardSlots && cardSlotsGameId === gameId) {
      try {
        cardSlots = JSON.parse(savedCardSlots);
        console.log(`✅ تم تحميل cardSlots من localStorage للعبة ${gameId}`);
      } catch (e) {
        console.error('❌ خطأ في تحميل cardSlots من localStorage:', e);
        cardSlots = [];
      }
    } else {
      // ✅ إذا كانت cardSlots من لعبة مختلفة، مسحها وتوليد جديدة
      if (savedCardSlots && cardSlotsGameId && cardSlotsGameId !== gameId) {
        console.log(`🧹 مسح cardSlots القديمة من لعبة مختلفة (${cardSlotsGameId} != ${gameId})`);
        localStorage.removeItem(`${playerParam}CardSlots`);
        localStorage.removeItem(`${playerParam}CardSlots_GameId`);
      }
      cardSlots = [];
    }
  }
  
  // ✅ إذا لم توجد cardSlots، قم بتوليدها تلقائياً
  if (!cardSlots || cardSlots.length === 0) {
      console.log('⚠️ cardSlots غير موجودة - سيتم توليدها تلقائياً');
      
      // الانتظار حتى يكون cardManager جاهزاً
      let attempts = 0;
      const maxAttempts = 50; // 5 ثواني كحد أقصى
      
      const waitForCardManager = () => {
        return new Promise((resolve) => {
          const checkCardManager = () => {
            if (window.cardManager && window.cardManager.getAllCardsByCategory) {
              resolve(true);
            } else if (attempts < maxAttempts) {
              attempts++;
              setTimeout(checkCardManager, 100);
            } else {
              resolve(false);
            }
          };
          checkCardManager();
        });
      };
      
      const cardManagerReady = await waitForCardManager();
      
      if (cardManagerReady) {
        // ✅ توليد cardSlots مع التحقق من عدم وجود تكرار
        let maxAttempts = 5;
        let attempts = 0;
        let validationResult = { isValid: false, duplicates: [] };
        
        do {
          cardSlots = await generateCardSlotsForPlayer();
          
          if (cardSlots && cardSlots.length > 0 && gameId) {
            // ✅ التحقق من عدم وجود تكرار قبل الحفظ
            validationResult = await validateNoDuplicatesBetweenPlayers(cardSlots, gameId);
            
            if (validationResult.isValid) {
              // ✅ فحص التكرار داخل اللاعب نفسه قبل الحفظ
              const flat = cardSlots.flat();
              const normalized = flat.map(c => normalizeCardPath(c)).filter(n => n !== null);
              const unique = new Set(normalized);
              if (unique.size !== normalized.length) {
                console.error("❌ تكرار داخلي للاعب — سيتم إعادة التوليد");
                validationResult.isValid = false; // تعيين الحالة لتكملة الحلقة
                attempts++;
                if (attempts < maxAttempts) {
                  await new Promise(resolve => setTimeout(resolve, 300));
                }
                continue; // يعيد المحاولة
              }
              
              // ✅ لا توجد تكرارات - حفظ في Firebase Realtime Database
              try {
                if (database && gameId) {
                  const cardSlotsRef = ref(database, `games/${gameId}/players/${player}/cardSlots`);
                  await set(cardSlotsRef, cardSlots);
                  console.log('✅ تم حفظ cardSlots في Firebase Realtime Database بدون تكرار');
                } else {
                  console.warn('⚠️ Firebase database أو gameId غير متاح - سيتم حفظ cardSlots في localStorage فقط');
                }
                break; // نجح الحفظ - خروج من الحلقة
              } catch (e) {
                console.error('❌ فشل حفظ cardSlots في Firebase:', e);
                // في حالة فشل الحفظ، نعيد المحاولة
                attempts++;
                if (attempts >= maxAttempts) {
                  console.error('❌ فشل حفظ cardSlots بعد عدة محاولات');
                  break;
                }
                // انتظار قصير قبل إعادة المحاولة
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            } else {
              // ✅ تم العثور على تكرارات - إعادة توليد الكروت
              console.warn(`⚠️ تم العثور على ${validationResult.duplicates.length} كرت مكررة - إعادة توليد الكروت... (المحاولة ${attempts + 1}/${maxAttempts})`);
              attempts++;
              
              // انتظار قصير قبل إعادة المحاولة
              if (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 300));
              }
            }
          } else {
            console.error('❌ فشل توليد cardSlots');
            break;
          }
        } while (!validationResult.isValid && attempts < maxAttempts);
        
        // ✅ إذا فشلت جميع المحاولات، نستخدم الكروت المولدة مع تحذير
        if (!validationResult.isValid && attempts >= maxAttempts) {
          console.error(`❌ فشل توليد كروت بدون تكرار بعد ${maxAttempts} محاولات - سيتم حفظ الكروت الحالية مع تحذير`);
          if (cardSlots && cardSlots.length > 0 && gameId) {
            try {
              if (database && gameId) {
                const cardSlotsRef = ref(database, `games/${gameId}/players/${player}/cardSlots`);
                await set(cardSlotsRef, cardSlots);
                console.log('⚠️ تم حفظ cardSlots في Firebase Realtime Database مع تحذير بوجود تكرارات محتملة');
              } else {
                console.warn('⚠️ Firebase database أو gameId غير متاح - سيتم حفظ cardSlots في localStorage فقط');
              }
            } catch (e) {
              console.error('❌ فشل حفظ cardSlots في Firebase:', e);
            }
          }
        }
      } else {
        console.warn('⚠️ cardManager غير متوفر بعد 5 ثواني - سيتم استخدام النظام القديم');
        // إذا كانت هناك بطاقات موجودة، استخدمها مباشرة للترتيب
        if (picks && picks.length > 0) {
          isSelectionPhase = false;
          console.log('✅ تم العثور على بطاقات موجودة - الانتقال مباشرة للترتيب');
        }
      }
    }
    
    // ✅ حفظ cardSlots في localStorage والمتغير مع gameId للتأكد من التطابق
    if (cardSlots && cardSlots.length > 0) {
      localStorage.setItem(`${playerParam}CardSlots`, JSON.stringify(cardSlots));
      localStorage.setItem(`${playerParam}CardSlots_GameId`, gameId); // ✅ حفظ gameId مع cardSlots
      
      // ✅ تحميل الكروت المختارة مسبقاً إذا كانت موجودة - فقط للعبة الحالية
      const savedSelectedCardsKey = `${playerParam}SelectedCards_${gameId}`;
      const savedSelectedCards = localStorage.getItem(savedSelectedCardsKey);
      
      // ✅ التحقق من gameId الحالي
      const currentGameIdForSelectedCards = localStorage.getItem(`${playerParam}SelectedCards_GameId`);
      
      // ✅ إذا كانت لعبة مختلفة، مسح الكروت المختارة القديمة
      if (currentGameIdForSelectedCards && currentGameIdForSelectedCards !== gameId) {
        console.log('🧹 مسح الكروت المختارة القديمة من لعبة مختلفة');
        // مسح جميع الكروت المختارة القديمة
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(`${playerParam}SelectedCards_`)) {
            localStorage.removeItem(key);
          }
        });
        localStorage.removeItem(`${playerParam}SelectedCards_GameId`);
        selectedCards = [];
        isSelectionPhase = true;
      } else if (savedSelectedCards && currentGameIdForSelectedCards === gameId) {
        // ✅ تحميل الكروت المختارة فقط إذا كانت للعبة الحالية
        try {
          selectedCards = JSON.parse(savedSelectedCards);
          console.log(`✅ تم تحميل ${selectedCards.length} كرت مختار مسبقاً للعبة ${gameId}:`, selectedCards);
          
          // ✅ التأكد من أن selectedCards صحيحة
          if (!Array.isArray(selectedCards)) {
            selectedCards = [];
            isSelectionPhase = true;
          } else {
            // ✅ تنظيف التكرارات عند التحميل
            const cleanedSelectedCards = [];
            const seenSlotIndices = new Set();
            const seenCardPaths = new Set();
            
            selectedCards.forEach(sc => {
              if (!sc || typeof sc !== 'object') return;
              
              const slotIndex = sc.slotIndex;
              const cardPath = sc.cardPath || sc;
              const normalizedCardPath = normalizeCardPath(cardPath);
              
              // التحقق من صحة البيانات
              if (slotIndex === undefined || slotIndex === null || !cardPath || !normalizedCardPath) {
                console.warn('⚠️ كرت غير صالح في selectedCards:', sc);
                return;
              }
              
              // التحقق من عدم وجود تكرار في slotIndex
              if (seenSlotIndices.has(slotIndex)) {
                console.warn(`⚠️ تكرار slotIndex ${slotIndex} - تم تجاهل الكرت:`, sc);
                return;
              }
              
              // التحقق من عدم وجود تكرار في cardPath (مطبق بشكل تطبيعي)
              if (seenCardPaths.has(normalizedCardPath)) {
                console.warn(`⚠️ تكرار cardPath ${cardPath} - تم تجاهل الكرت:`, sc);
                return;
              }
              
              // إضافة الكرت بعد التحقق من عدم وجود تكرار
              cleanedSelectedCards.push(sc);
              seenSlotIndices.add(slotIndex);
              seenCardPaths.add(normalizedCardPath);
            });
            
            // استبدال selectedCards بالنسخة المنظفة
            if (cleanedSelectedCards.length !== selectedCards.length) {
              console.log(`🧹 تم تنظيف ${selectedCards.length - cleanedSelectedCards.length} كرت مكرر من selectedCards`);
              selectedCards = cleanedSelectedCards;
              
              // حفظ النسخة المنظفة
              const savedSelectedCardsKey = `${playerParam}SelectedCards_${gameId}`;
              localStorage.setItem(savedSelectedCardsKey, JSON.stringify(selectedCards));
            }
            
            // ✅ التحقق النهائي من عدم وجود تكرار
            const finalNormalized = selectedCards.map(sc => normalizeCardPath(sc.cardPath || sc)).filter(n => n !== null);
            const finalUnique = new Set(finalNormalized);
            if (finalNormalized.length !== finalUnique.size) {
              console.error('❌ لا يزال هناك تكرار بعد التنظيف - إعادة تنظيف');
              // إعادة التنظيف بشكل أكثر صرامة
              const uniqueSelectedCards = [];
              const finalSeen = new Set();
              selectedCards.forEach(sc => {
                const normalized = normalizeCardPath(sc.cardPath || sc);
                if (normalized && !finalSeen.has(normalized)) {
                  finalSeen.add(normalized);
                  uniqueSelectedCards.push(sc);
                }
              });
              selectedCards = uniqueSelectedCards;
              const savedSelectedCardsKey = `${playerParam}SelectedCards_${gameId}`;
              localStorage.setItem(savedSelectedCardsKey, JSON.stringify(selectedCards));
            }
            
            // ✅ تحميل حالة isSelectionPhase من localStorage
            const savedIsSelectionPhase = localStorage.getItem(`${playerParam}IsSelectionPhase_${gameId}`);
            if (savedIsSelectionPhase !== null) {
              try {
                isSelectionPhase = JSON.parse(savedIsSelectionPhase);
                console.log(`✅ تم تحميل حالة isSelectionPhase: ${isSelectionPhase}`);
              } catch (e) {
                console.error('❌ خطأ في تحميل isSelectionPhase:', e);
              }
            }
            
            // إذا تم اختيار عدد كافٍ من الكروت، ننتقل لمرحلة الترتيب
            if (selectedCards.length >= rounds) {
              isSelectionPhase = false;
              picks = selectedCards.map(sc => sc.cardPath);
              // ✅ حفظ حالة isSelectionPhase
              localStorage.setItem(`${playerParam}IsSelectionPhase_${gameId}`, JSON.stringify(false));
              localStorage.setItem(PICKS_LOCAL_KEY, JSON.stringify(picks));
              console.log('✅ تم تحميل جميع الكروت المختارة - الانتقال لمرحلة الترتيب');
            } else {
              isSelectionPhase = true;
              // ✅ حفظ حالة isSelectionPhase
              localStorage.setItem(`${playerParam}IsSelectionPhase_${gameId}`, JSON.stringify(true));
              console.log(`✅ تم تحميل ${selectedCards.length} كرت - باقي ${rounds - selectedCards.length} كروت للاختيار`);
            }
          }
        } catch (e) {
          console.error('❌ خطأ في تحميل الكروت المختارة:', e);
          selectedCards = [];
          isSelectionPhase = true;
        }
      } else {
        // ✅ التأكد من أن selectedCards فارغة للعبة الجديدة
        selectedCards = [];
        isSelectionPhase = true;
        console.log('✅ لا توجد كروت مختارة مسبقاً - بدء جديد');
      }
      
      // حفظ gameId للكروت المختارة
      localStorage.setItem(`${playerParam}SelectedCards_GameId`, gameId);
    }
    
    // ✅ حفظ gameId مع البطاقات والقدرات
    localStorage.setItem(CURRENT_GAME_ID_KEY, gameId);
    localStorage.setItem(PICKS_LOCAL_KEY, JSON.stringify(picks));
    
    // ✅ حفظ القدرات في localStorage للتحميل السريع في المستقبل
    const abilitiesKey = `${playerParam}Abilities`;
    localStorage.setItem(abilitiesKey, JSON.stringify(myAbilities));
    
    // ✅ حفظ القدرات في Firebase فوراً (للمزامنة الفورية على جميع الأجهزة)
    if (database && myAbilities.length > 0) {
      const abilitiesRef = ref(database, `games/${gameId}/players/${playerParam}/abilities`);
      set(abilitiesRef, myAbilities).then(() => {
        console.log(`✅ تم حفظ القدرات في Firebase للاعب ${playerParam} (${myAbilities.length} قدرة)`);
      }).catch((error) => {
        console.error('❌ خطأ في حفظ القدرات في Firebase:', error);
      });
    }
    
    console.log(`✅ تم حفظ البطاقات والقدرات للعبة ${gameId}`, {
      cards: picks.length,
      abilities: myAbilities.length
    });
    
    // تحديث النص
    if (instruction) {
      instruction.textContent = `اللاعب ${playerName} رتب بطاقاتك`;
    }
    
    console.log('Loaded data:', { playerName, picks: picks.length, myAbilities: myAbilities.length, rounds });
    
    // عرض البيانات
    // ✅ التحقق من وجود ترتيب محفوظ مسبقاً
    const savedOrder = JSON.parse(localStorage.getItem(ORDER_LOCAL_KEY) || "[]");
    if (savedOrder && savedOrder.length === picks.length && picks.length > 0 && !isSelectionPhase) {
      console.log("✅ تم العثور على ترتيب محفوظ - سيتم عرضه بدلاً من ترتيب Firebase");
      submittedOrder = savedOrder.slice();
      hideOpponentPanel();
      hidePlayerAbilitiesViewPanel();
      renderCards(submittedOrder, submittedOrder);
      isSelectionPhase = false;
      return; // نوقف التحميل من Firebase هنا
    }
    
    // ✅ إذا كان لدينا cardSlots، نعرض نظام الاختيار الجديد
    if (cardSlots && cardSlots.length > 0 && isSelectionPhase) {
      console.log('✅ عرض نظام الاختيار الجديد مع', cardSlots.length, 'بطاقة صفراء');
      console.log('✅ الكروت المختارة مسبقاً:', selectedCards.length);
      // تحديث النص
      if (instruction) {
        const selectedCount = selectedCards.length;
        const remaining = rounds - selectedCount;
        if (selectedCount > 0) {
          instruction.textContent = `اختر ${remaining} كرت إضافي${remaining > 1 ? 'ات' : ''} (${selectedCount}/${rounds})`;
        } else {
          instruction.textContent = `اختر ${rounds} كرت للبدء`;
        }
      }
      // ✅ عرض الكروت المختارة مسبقاً في الشبكة
      renderCardSelectionGrid(cardSlots);
      // ✅ عرض الكروت المختارة في الأسفل
      renderSelectedCards();
      
      // ✅ إذا ما زالت مرحلة الاختيار، أعد فتح البطاقة
      if (isSelectionPhase && selectedCards.length < rounds) {
        // read last open slot and reopen it
        const lastOpen = readLastOpenSlot();
        if (lastOpen !== null && Number.isFinite(lastOpen)) {
          // حاول فتح نفس البطاقة كما قبل التحديث
          try {
            console.log(`🔁 Re-opening last open slot ${lastOpen} because selection incomplete`);
            // انتظار قصير لضمان تحميل DOM
            setTimeout(() => {
              // البحث عن العنصر باستخدام data attribute أو الفهرس
              const slotElements = document.querySelectorAll('.card-selection-slot');
              if (slotElements[lastOpen]) {
                // محاكاة النقر على البطاقة
                slotElements[lastOpen].click();
              } else {
                // Fallback: محاولة فتح modal مباشرة
                if (cardSlots[lastOpen] && Array.isArray(cardSlots[lastOpen])) {
                  openCardSelectionModal(lastOpen, cardSlots[lastOpen]);
                }
              }
            }, 500);
          } catch (e) {
            console.warn('⚠️ Failed to auto-open last slot on load:', e);
          }
        } else {
          console.log('ℹ️ No last-open slot or it was stale/too-old.');
        }
      }
    } else if (picks.length > 0) {
      // إذا لم يكن في مرحلة الاختيار، عرض الكروت للترتيب
      console.log('✅ عرض الكروت للترتيب');
      if (instruction) {
        instruction.textContent = `اللاعب ${playerName} رتب بطاقاتك`;
      }
      // ✅ إخفاء الكروت المختارة عند تحميل الصفحة إذا كان الاختيار مكتملاً
      renderSelectedCards();
      renderCards(picks);
    } else {
      // إذا لم توجد بطاقات، عرض رسالة خطأ
      if (grid) {
        grid.innerHTML = '<div style="color:#fff;padding:20px;text-align:center;">لم يتم العثور على بطاقات لهذا اللاعب.</div>';
      }
      if (instruction) {
        instruction.textContent = 'لم يتم العثور على بطاقات لهذا اللاعب';
      }
    }
    
    renderAbilities(myAbilities);
    
    // الاستماع للتغييرات في الوقت الفعلي - فقط للاعب الحالي
    GameService.listenToGame(gameId, (updatedData) => {
      // تحقق من أن التحديث خاص باللاعب الحالي فقط
      const currentPlayerParam = playerParam;
      const updatedPlayerData = updatedData[`player${player}`];
      
      if (updatedPlayerData) {
        console.log(`🔄 تحديث Firebase للاعب ${currentPlayerParam} فقط`);
        updateGameData(updatedData);
      } else {
        console.log(`⚠️ تجاهل تحديث Firebase - ليس للاعب الحالي ${currentPlayerParam}`);
      }
    });
    
    console.log('Game data loaded successfully:', { playerName, picks: picks.length, myAbilities: myAbilities.length, rounds });
    
  } catch (error) {
    console.error('Error loading game data:', error);
    alert('حدث خطأ في تحميل بيانات اللعبة: ' + error.message);
    
    // إعادة تفعيل الزر في حالة الخطأ
    if (continueBtn) {
      continueBtn.disabled = false;
      continueBtn.textContent = 'متابعة';
    }
  } finally {
    // ✅ إعادة تعيين علامة التحميل بعد الانتهاء (حتى في حالة الخطأ)
    setTimeout(() => {
      isLoadingGameData = false;
    }, 500);
  }
}

// Update game data from Firebase
function updateGameData(gameData) {
  // 🧠 الحل النهائي المضمون: تجاهل التحديثات الخارجية أثناء الترتيب
  if (isArranging) {
    console.log("⏸ تجاهل تحديث Firebase أثناء ترتيب اللاعب - الحل النهائي المضمون");
    return;
  }
  
  // ✅ تحقق إضافي: تأكد من أن التحديث للعبة الحالية فقط
  const currentGameId = localStorage.getItem(CURRENT_GAME_ID_KEY);
  if (currentGameId && gameId && currentGameId !== gameId) {
    console.log(`⚠️ تجاهل تحديث Firebase - لعبة مختلفة (current: ${currentGameId}, update: ${gameId})`);
    return;
  }
  
  // تحقق من أن التحديث خاص باللاعب الحالي فقط
  const currentPlayerParam = playerParam;
  const playerData = gameData[`player${player}`];
  
  if (!playerData) {
    console.log(`⚠️ تجاهل تحديث Firebase - لا توجد بيانات للاعب ${currentPlayerParam}`);
    return;
  }
  
  console.log(`🔄 تحديث بيانات اللاعب ${currentPlayerParam} من Firebase`);
  
  // تحديث rounds
  if (gameData.rounds) {
    rounds = gameData.rounds;
  }
  
  // تحديث اسم اللاعب
  if (playerData.name) {
    playerName = playerData.name;
    if (instruction) {
      instruction.textContent = `اللاعب ${playerName} رتب بطاقاتك`;
    }
  }
  
  // تحديث القدرات
  if (playerData.abilities) {
    myAbilities = normalizeAbilityList(playerData.abilities);
    
    // ✅ حفظ القدرات في localStorage
    const abilitiesKey = `${playerParam}Abilities`;
    localStorage.setItem(abilitiesKey, JSON.stringify(myAbilities));
    console.log(`✅ تم حفظ القدرات المحدثة في localStorage`, myAbilities.length);
    
    // ✅ حفظ القدرات في Firebase فوراً (للمزامنة الفورية على جميع الأجهزة)
    if (database && myAbilities.length > 0) {
      const currentGameId = localStorage.getItem('currentGameId') || gameId || 'default-game';
      const abilitiesRef = ref(database, `games/${currentGameId}/players/${playerParam}/abilities`);
      set(abilitiesRef, myAbilities).then(() => {
        console.log(`✅ تم حفظ القدرات في Firebase للاعب ${playerParam} (من updateGameData)`);
      }).catch((error) => {
        console.error('❌ خطأ في حفظ القدرات في Firebase:', error);
      });
    }
    
    renderAbilities(myAbilities);
  }
  
  // تحديث البطاقات - فقط للاعب الحالي
  if (playerData.cards) {
    picks = playerData.cards;
    
    // التحقق من وجود ترتيب مرسل للعبة الحالية - فقط للاعب الحالي
    const savedOrder = JSON.parse(localStorage.getItem(ORDER_LOCAL_KEY) || "[]");
    const currentGameId = localStorage.getItem(CURRENT_GAME_ID_KEY);
    
    // تحقق إضافي للتأكد من أن التحديث خاص باللاعب الحالي
    if (currentGameId && gameId && currentGameId === gameId && 
        savedOrder && savedOrder.length === picks.length) {
      submittedOrder = savedOrder.slice();
      hideOpponentPanel();
      hidePlayerAbilitiesViewPanel();
      renderCards(submittedOrder, submittedOrder);
      console.log(`✅ تم الحفاظ على ترتيب اللاعب ${playerParam} عند تحديث البيانات`);
    } else {
      submittedOrder = null;
      renderCards(picks, null);
      loadOpponentAbilities();
      loadPlayerAbilitiesView();
      console.log(`🔄 تم تحديث البطاقات للاعب ${playerParam} بدون ترتيب محفوظ`);
    }
  }
  
  console.log('Game data updated:', { playerData, rounds, playerName });
}

// Render abilities
function renderAbilities(abilities) {
  if (!abilitiesWrap) return;
  
  // Normalize abilities to the correct format
  const normalizedAbilities = normalizeAbilityList(abilities);
  
  // ✅ حفظ القدرات في Firebase فوراً (للمزامنة الفورية على جميع الأجهزة)
  if (database && normalizedAbilities.length > 0) {
    const currentGameId = localStorage.getItem('currentGameId') || gameId || 'default-game';
    const abilitiesRef = ref(database, `games/${currentGameId}/players/${playerParam}/abilities`);
    set(abilitiesRef, normalizedAbilities).then(() => {
      console.log(`✅ تم حفظ القدرات في Firebase للاعب ${playerParam} (من renderAbilities)`);
    }).catch((error) => {
      console.error('❌ خطأ في حفظ القدرات في Firebase:', error);
    });
  }
  
  // Use renderBadges for consistent UI
  renderBadges(abilitiesWrap, normalizedAbilities, { 
    clickable: true, 
    onClick: requestUseAbility 
  });
  
  // Update myAbilities to match the normalized format
  myAbilities = normalizedAbilities;
}

/* ================== Initialize Card Manager ================== */
// ✅ حماية من التكرار في initializeCardManager
let isInitializingCardManager = false;
function initializeCardManager() {
  // ✅ حماية: منع التهيئة المكررة
  if (isInitializingCardManager) {
    console.log('⚠️ تهيئة cardManager قيد التنفيذ - تجاهل التهيئة المكررة');
    return;
  }
  
  // Wait for card manager to be available
  if (typeof window.cardManager !== 'undefined') {
    cardManager = window.cardManager;
    isInitializingCardManager = true;
    
    // ✅ نظام موحد: استخدم loadGameData للبطولة والتحدي
    if (gameId) {
      console.log(`🔄 Loading game data from Firebase for ${playerParam} (gameId: ${gameId})`);
      if (!isLoadingPlayerCards) {
        loadGameData(); // تحميل من Firebase دائماً
      }
    } else {
      console.warn(`⚠️ No gameId found for ${playerParam}`);
      // fallback to localStorage
      if (!isLoadingPlayerCards) {
        loadPlayerCards();
      }
    }
    // إعادة تعيين العلامة بعد قليل
    setTimeout(() => {
      isInitializingCardManager = false;
    }, 1000);
  } else {
    // Wait a bit and try again
    setTimeout(initializeCardManager, 100);
  }
}

function loadPlayerCards() {
  // ✅ حماية قوية من التكرار - التحقق من حالة التحميل
  if (isLoadingPlayerCards) {
    console.log(`⚠️ تجاهل تحميل متكرر للاعب ${playerParam} - التحميل قيد التنفيذ`);
    return;
  }

  if (!cardManager) {
    console.error('Card manager not available');
    return;
  }

  if (isTournament) {
    console.log(`🔄 تحميل بطاقات البطولة للاعب ${playerParam}`);
    loadTournamentCards();
    return;
  }

  // ✅ حماية إضافية: التحقق من أن هذا اللاعب واللعبة لم يتم تحميلهما بالفعل
  const lastLoadTime = localStorage.getItem(LAST_LOAD_TIME_KEY);
  const currentTime = Date.now();
  const timeSinceLastLoad = lastLoadTime ? (currentTime - parseInt(lastLoadTime)) : Infinity;
  
  // ✅ تحقق شامل: نفس اللاعب + نفس اللعبة + وقت قصير جداً = تكرار
  if (lastLoadPlayerParam === playerParam && 
      lastLoadGameId === gameId && 
      timeSinceLastLoad < 2000 && 
      isCardsRendered) {
    console.log(`⚠️ تجاهل تحميل متكرر للاعب ${playerParam} - تم التحميل مؤخراً (${Math.round(timeSinceLastLoad)}ms)`);
    return;
  }

  // ✅ تعيين علامة التحميل قبل البدء
  isLoadingPlayerCards = true;
  lastLoadPlayerParam = playerParam;
  lastLoadGameId = gameId;
  localStorage.setItem(LAST_LOAD_TIME_KEY, currentTime.toString());

  console.log(`🔄 تحميل بطاقات اللاعب ${playerParam} للعبة ${gameId}`);

  // ✅ التحقق من gameId قبل تحميل البطاقات من localStorage
  const currentGameId = localStorage.getItem(CURRENT_GAME_ID_KEY);
  
  // إذا كانت اللعبة مختلفة، احذف البيانات القديمة واستخدم Firebase
  if (currentGameId && currentGameId !== gameId) {
    console.log(`🧹 لعبة جديدة - حذف البطاقات القديمة للاعب ${playerParam}`);
    clearOldGameData();
    
    // تحميل من Firebase للعبة الجديدة
    loadGameData();
    return;
  }
  
  // Try to load from localStorage first (only if same game)
  const localPicks = JSON.parse(localStorage.getItem(PICKS_LOCAL_KEY) || "[]");
  picks = Array.isArray(localPicks) ? localPicks : [];

  // Get rounds from game setup and limit cards accordingly
  const gameSetup = localStorage.getItem(GAME_SETUP_KEY);
  if (gameSetup) {
    try {
      const setupData = JSON.parse(gameSetup);
      const rounds = setupData.rounds || 11;
      
      // Take only the number of cards needed for the rounds
      if (picks.length > rounds) {
        picks = picks.slice(0, rounds);
        console.log(`Limited to ${rounds} cards for game rounds`);
      }
    } catch (e) {
      console.error('Error parsing game setup:', e);
    }
  }

  // Check if we have a submitted order for the CURRENT game - فقط للاعب الحالي
  const savedOrder = JSON.parse(localStorage.getItem(ORDER_LOCAL_KEY) || "[]");
  
  // Also check for StrategicOrdered format (for compatibility with card.js)
  const strategicOrder = JSON.parse(localStorage.getItem(`${playerParam}StrategicOrdered`) || "[]");
  
  // Use the most recent order available - فقط للاعب الحالي مع تحقق إضافي
  let orderToUse = null;
  if (currentGameId && gameId && currentGameId === gameId && 
      Array.isArray(savedOrder) && savedOrder.length === picks.length) {
    orderToUse = savedOrder;
    console.log(`✅ تم العثور على ترتيب محفوظ للاعب ${playerParam}:`, orderToUse.length, 'بطاقة');
  } else if (Array.isArray(strategicOrder) && strategicOrder.length === picks.length) {
    // تحقق إضافي للتأكد من أن الترتيب الاستراتيجي للعبة الحالية
    const strategicGameId = localStorage.getItem(STRATEGIC_GAME_ID_KEY);
    if (!strategicGameId || strategicGameId === gameId) {
      orderToUse = strategicOrder;
      console.log(`✅ تم العثور على ترتيب استراتيجي للاعب ${playerParam}:`, orderToUse.length, 'بطاقة');
    } else {
      console.log(`⚠️ تجاهل الترتيب الاستراتيجي - ليس للعبة الحالية (${strategicGameId} != ${gameId})`);
    }
  }
  
  if (orderToUse) {
    submittedOrder = orderToUse.slice();
    picks = orderToUse.slice(); // Update picks to match the ordered arrangement
    console.log('Loaded existing order:', submittedOrder);
  } else {
    submittedOrder = null;
    // Clear old order if it's from a different game
    if (currentGameId !== gameId) {
      localStorage.removeItem(ORDER_LOCAL_KEY);
      localStorage.removeItem(`${playerParam}StrategicOrdered`);
      console.log(`🧹 تم مسح الترتيب القديم للاعب ${playerParam} - لعبة مختلفة`);
    }
  }

  if (!picks.length) {
    grid.innerHTML = `<p class="text-red-500 text-lg">لم يتم العثور على بطاقات لهذا اللاعب.</p>`;
    return;
  }
  
  // ✅ حفظ gameId الحالي للتأكد من تطابقه في المستقبل
  if (gameId) {
    localStorage.setItem(CURRENT_GAME_ID_KEY, gameId);
    console.log(`✅ تم تأكيد gameId: ${gameId} للاعب ${playerParam}`);
  }

  if (submittedOrder && submittedOrder.length === picks.length) {
    hideOpponentPanel();
    hidePlayerAbilitiesViewPanel();
    console.log('Rendering submitted order on load:', submittedOrder);
    console.log('Picks on load:', picks);
    console.log('Submitted order length:', submittedOrder.length);
    console.log('Picks length:', picks.length);
    
    // إضافة تأثير انتقال سلس لتقليل الوميض
    if (grid) {
      grid.style.transition = 'opacity 0.3s ease';
      grid.style.opacity = '0.7';
    }
    
    renderCards(submittedOrder, submittedOrder);
    
    // إعادة تعيين الشفافية بعد الانتهاء
    setTimeout(() => {
      if (grid) {
        grid.style.opacity = '1';
      }
    }, 100);
    
    // تحديث حالة الزر عند وجود ترتيب مرسل
    if (continueBtn) {
      continueBtn.disabled = true;
      continueBtn.textContent = '✅ تم إرسال الترتيب';
    }
  } else {
    // Ensure picks is valid before rendering
    if (Array.isArray(picks) && picks.length > 0) {
      // إضافة تأثير انتقال سلس لتقليل الوميض
      if (grid) {
        grid.style.transition = 'opacity 0.3s ease';
        grid.style.opacity = '0.7';
      }
      
      renderCards(picks, null);
      
      // إعادة تعيين الشفافية بعد الانتهاء
      setTimeout(() => {
        if (grid) {
          grid.style.opacity = '1';
        }
      }, 100);
    } else {
      console.warn('No valid picks found, showing empty state');
      if (grid) {
        grid.innerHTML = '<p class="text-red-500 text-lg">لم يتم العثور على بطاقات صالحة.</p>';
      }
    }
    // Show opponent abilities if not submitted
    loadOpponentAbilities();
    loadPlayerAbilitiesView();
    // إعادة تعيين الزر عند عدم وجود ترتيب مرسل
    if (continueBtn) {
      continueBtn.disabled = false;
      continueBtn.textContent = 'متابعة';
    }
  }
  
  // Load player abilities
  loadPlayerAbilities();
  
  // ✅ إعادة تعيين علامات التحميل بعد الانتهاء
  setTimeout(() => {
    isLoadingPlayerCards = false;
    isCardsRendered = true;
  }, 500);
}

/* ================== Abilities (self) ================== */

if (abilityStatus) {
  abilityStatus.textContent = "جاري تحميل القدرات...";
}

myAbilities = [];
console.log('✅ No default abilities - Will load real abilities from Firebase');

// ✅ إزالة كل استخدام للـ socket
// لم نعد نستعمل:
// socket.emit("requestAbilities") أو socket.on("receiveAbilities")

// لذا الآن abilities سيتم تحميلها فقط من:
// loadPlayerAbilities() و Firebase syncService

/* ================== Opponent abilities (view-only) ================== */

// ✅ حذف نظام جلب الخصم عبر socket
// لن نحتاج requestAbilities أو getPlayers

// سيتم بدلاً من ذلك استعمال نظامك الموجود: loadOpponentAbilities()

/* ================== Handling abilities after cards load ================== */

// بعد تحميل الكروت، النظام سيستدعي:
// loadPlayerAbilities();
// loadOpponentAbilities();

/* ================== Abilities Request Logic (Firebase Only) ================== */

async function requestUseAbility(abilityText) {
  console.log('🎯 Requesting ability:', abilityText);
  
  // check existing pending request
  try {
    const existingRequests = JSON.parse(localStorage.getItem('abilityRequests') || '[]');
    const hasPendingRequest = existingRequests.some(req => 
      req.playerParam === playerParam && 
      req.abilityText === abilityText && 
      req.status === 'pending'
    );
    
    if (hasPendingRequest) {
      console.log('⚠️ طلب موجود بالفعل لهذه القدرة - تجاهل الطلب المكرر');
      if (abilityStatus) {
        abilityStatus.textContent = "⏳ الطلب قيد المراجعة بالفعل...";
        abilityStatus.style.color = "#f59e0b";
      }
      return;
    }
  } catch (e) {
    console.error('Error checking existing requests:', e);
  }
  
  if (abilityStatus) {
    abilityStatus.textContent = "⏳ تم إرسال طلب استخدام القدرة…";
  }

  const requestId = `${playerParam}_${abilityText}_${Date.now()}`;

  // visual update
  tempUsed.add(abilityText);
  pendingRequests.set(requestId, abilityText);
  myAbilities = (myAbilities || []).map(a => a.text === abilityText ? { ...a, used: true } : a);

  if (abilitiesWrap) {
    renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
  }
  
  // ✅ إرسال الطلب إلى Firebase فقط
  const newRequest = {
    id: requestId,
    requestId: requestId,
    playerParam: playerParam,
    playerName: playerName,
    abilityText: abilityText,
    status: 'pending',
    timestamp: Date.now()
  };

  try {
    if (syncService?.isReady?.()) {
      await syncService.addAbilityRequest(newRequest);
    } else {
      // fallback local
      const list = JSON.parse(localStorage.getItem('abilityRequests') || '[]');
      list.push(newRequest);
      localStorage.setItem('abilityRequests', JSON.stringify(list));
    }
  } catch (err) {
    console.error("Failed to send ability request:", err);

    // rollback
    tempUsed.delete(abilityText);
    pendingRequests.delete(requestId);
    myAbilities = myAbilities.map(a => a.text === abilityText ? { ...a, used: false } : a);

    renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
    if (abilityStatus) abilityStatus.textContent = "❌ حدث خطأ أثناء إرسال الطلب";
  }
}

/**
 * بدء الاستماع لنتائج طلبات القدرات من Firebase Realtime Database
 * يستبدل socket.on("abilityRequestResult")
 */
function startPlayerAbilityResultListener() {
  if (!database || !gameId) {
    console.warn('⚠️ Firebase database أو gameId غير موجودين - لن يتم تشغيل مستمع نتائج طلبات القدرات');
    return;
  }

  try {
    const refPath = `games/${gameId}/abilityRequests`;
    const requestsRef = ref(database, refPath);

    console.log('✅ بدء الاستماع لنتائج طلبات القدرات من Firebase:', refPath);

    // عندما يتغير أي طلب، تحقق إذا كان يخص هذا playerParam
    onChildChanged(requestsRef, (snapshot) => {
      const req = snapshot.val();
      if (!req) return;

      // فقط طلبات هذا اللاعب
      if (req.playerParam !== playerParam) return;

      const requestKey = snapshot.key;
      const requestId = req.requestId || req.id || requestKey;
      const abilityText = req.abilityText || req.ability;

      console.log('🔄 تحديث طلب قدرة من Firebase:', { requestKey, requestId, abilityText, status: req.status });

      // إزالة من pendingRequests
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
      }

      if (req.status === 'accepted' || req.status === 'approved') {
        // بالفعل تم قبول — أبقِ العلامة "used" ظاهرة في الواجهة
        // (هي موجودة أساساً لأننا وضعنا myAbilities.used = true عند الطلب)
        if (abilityStatus) {
          abilityStatus.textContent = "✅ تم قبول الطلب من المستضيف.";
          abilityStatus.style.color = "#1a9c35";
        }

        // احفظ حالة الاستخدام في localStorage إذا تريد
        // يمكن إضافة منطق إضافي هنا إذا لزم الأمر

      } else if (req.status === 'rejected') {
        // تراجع عن التغيرات المؤقتة
        if (abilityText) {
          tempUsed.delete(abilityText);
          myAbilities = (myAbilities || []).map(a => a.text === abilityText ? { ...a, used: false } : a);
        }
        
        if (abilitiesWrap) {
          renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
        }

        if (abilityStatus) {
          abilityStatus.textContent = "❌ تم رفض الطلب.";
          abilityStatus.style.color = "#dc2626";
        }
      }
    });

    console.log('✅ مستمع نتائج طلبات القدرات من Firebase نشط');
  } catch (error) {
    console.error('❌ خطأ في بدء مستمع نتائج طلبات القدرات من Firebase:', error);
  }
}

// ✅ متغير خارجي لتتبع القدرات المستخدمة السابقة
let previousUsedAbilitiesSet = new Set();

// ✅ مستمع لتغييرات usedAbilities من Firebase (لإعادة تفعيل القدرات)
function startUsedAbilitiesListener() {
  if (!database || !gameId || !playerParam) {
    console.warn('⚠️ Firebase database أو gameId أو playerParam غير موجودين - لن يتم تشغيل مستمع usedAbilities');
    return;
  }

  try {
    const refPath = `games/${gameId}/players/${playerParam}/usedAbilities`;
    const usedAbilitiesRef = ref(database, refPath);

    console.log('✅ بدء الاستماع لتغييرات usedAbilities من Firebase:', refPath);

    // ✅ تهيئة previousUsedAbilitiesSet من Firebase عند البدء
    let isInitialized = false;
    get(usedAbilitiesRef).then((snapshot) => {
      const initialUsedAbilities = snapshot.val() || {};
      previousUsedAbilitiesSet = new Set();
      Object.keys(initialUsedAbilities).forEach(abilityKey => {
        const abilityData = initialUsedAbilities[abilityKey];
        const abilityText = abilityData?.text || decodeURIComponent(abilityKey);
        previousUsedAbilitiesSet.add(abilityText);
      });
      isInitialized = true;
      console.log('✅ تم تهيئة previousUsedAbilitiesSet:', Array.from(previousUsedAbilitiesSet));
    }).catch((error) => {
      console.error('❌ خطأ في تهيئة previousUsedAbilitiesSet:', error);
      isInitialized = true; // حتى لو فشلت التهيئة، نبدأ الاستماع
    });
    
    // ✅ الاستماع لتغييرات usedAbilities باستخدام onValue (أكثر موثوقية)
    onValue(usedAbilitiesRef, (snapshot) => {
      // ✅ تجاهل الاستدعاء الأول حتى يتم التهيئة
      if (!isInitialized) {
        // تهيئة سريعة من snapshot الحالي
        const initialUsedAbilities = snapshot.val() || {};
        previousUsedAbilitiesSet = new Set();
        Object.keys(initialUsedAbilities).forEach(abilityKey => {
          const abilityData = initialUsedAbilities[abilityKey];
          const abilityText = abilityData?.text || decodeURIComponent(abilityKey);
          previousUsedAbilitiesSet.add(abilityText);
        });
        isInitialized = true;
        console.log('✅ تم تهيئة previousUsedAbilitiesSet من onValue:', Array.from(previousUsedAbilitiesSet));
        return; // تجاهل هذا الاستدعاء
      }
      
      const currentUsedAbilities = snapshot.val() || {};
      const currentSet = new Set();
      
      // ✅ بناء مجموعة القدرات المستخدمة الحالية
      Object.keys(currentUsedAbilities).forEach(abilityKey => {
        const abilityData = currentUsedAbilities[abilityKey];
        const abilityText = abilityData?.text || decodeURIComponent(abilityKey);
        currentSet.add(abilityText);
      });
      
      // ✅ تسجيل الحالة الحالية والسابقة للمقارنة
      console.log('📊 مقارنة القدرات المستخدمة:', {
        previous: Array.from(previousUsedAbilitiesSet),
        current: Array.from(currentSet)
      });
      
      // ✅ العثور على القدرات التي تم حذفها (إعادة تفعيلها)
      previousUsedAbilitiesSet.forEach(abilityText => {
        if (!currentSet.has(abilityText)) {
          // ✅ هذه القدرة تم حذفها (إعادة تفعيلها)
          console.log('🔄 تم إعادة تفعيل القدرة من Firebase:', abilityText);
          console.log('📋 تفاصيل إعادة التفعيل:', {
            abilityText,
            playerParam,
            previousSet: Array.from(previousUsedAbilitiesSet),
            currentSet: Array.from(currentSet)
          });
          
          // ✅ إزالة من tempUsed
          tempUsed.delete(abilityText);
          console.log('✅ تم إزالة القدرة من tempUsed:', abilityText);
          
          // ✅ تحديث myAbilities
          const beforeUpdate = myAbilities.length;
          myAbilities = (myAbilities || []).map(a => {
            const text = a.text || a;
            if (text === abilityText) {
              console.log('🔄 تحديث myAbilities - إعادة تفعيل:', text);
              return { ...a, used: false };
            }
            return a;
          });
          console.log('✅ تم تحديث myAbilities:', { before: beforeUpdate, after: myAbilities.length });
          
          // ✅ تحديث localStorage
          const usedAbilitiesKey = `${playerParam}UsedAbilities`;
          let usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
          const beforeFilter = usedAbilities.length;
          usedAbilities = usedAbilities.filter(ability => ability !== abilityText);
          localStorage.setItem(usedAbilitiesKey, JSON.stringify(usedAbilities));
          console.log('✅ تم تحديث usedAbilities في localStorage:', { before: beforeFilter, after: usedAbilities.length });
          
          // ✅ تحديث القدرات في localStorage
          const abilitiesKey = `${playerParam}Abilities`;
          let abilities = JSON.parse(localStorage.getItem(abilitiesKey) || '[]');
          const updatedAbilities = abilities.map(ability => {
            const text = typeof ability === 'string' ? ability : (ability.text || ability);
            if (text === abilityText) {
              console.log('🔄 تحديث abilities في localStorage - إعادة تفعيل:', text);
              return typeof ability === 'string' ? { text: ability, used: false } : { ...ability, used: false };
            }
            return typeof ability === 'string' ? { text: ability, used: ability.used || false } : ability;
          });
          localStorage.setItem(abilitiesKey, JSON.stringify(updatedAbilities));
          console.log('✅ تم تحديث abilities في localStorage:', updatedAbilities.length, 'قدرة');
          
          // ✅ تحديث الواجهة فوراً (مهم للهواتف)
          if (abilitiesWrap) {
            console.log('🎨 إعادة رسم الواجهة...');
            // ✅ مسح الواجهة أولاً للتحديث الفوري
            abilitiesWrap.innerHTML = '';
            renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
            console.log('✅ تم إعادة رسم الواجهة (فوري)');
          } else {
            console.warn('⚠️ abilitiesWrap غير موجود - لا يمكن تحديث الواجهة');
          }
          
          if (abilityStatus) {
            abilityStatus.textContent = `🔄 تم إعادة تفعيل القدرة: ${abilityText}`;
            abilityStatus.style.color = "#1a9c35";
            setTimeout(() => {
              if (abilityStatus) {
                abilityStatus.textContent = "";
              }
            }, 3000);
          }
          
          console.log(`✅ تم إعادة تفعيل القدرة للاعب ${playerParam}:`, abilityText);
        }
      });
      
      // ✅ تحديث previousUsedAbilitiesSet للمقارنة التالية
      previousUsedAbilitiesSet = new Set(currentSet);
      console.log('✅ تم تحديث previousUsedAbilitiesSet:', Array.from(previousUsedAbilitiesSet));
    }, (error) => {
      console.error('❌ خطأ في مستمع usedAbilities:', error);
    });
    
    // ✅ أيضاً الاستماع لحذف القدرات المستخدمة (عند إعادة تفعيلها من قبل المضيف)
    onChildRemoved(usedAbilitiesRef, (snapshot) => {
      console.log('🔔 onChildRemoved تم استدعاؤه:', snapshot.key);
      
      const abilityData = snapshot.val();
      const abilityKey = snapshot.key;
      
      console.log('📋 بيانات snapshot:', { abilityData, abilityKey });
      
      // ✅ استخراج abilityText من abilityData أو من abilityKey
      let abilityText = null;
      if (abilityData && abilityData.text) {
        abilityText = abilityData.text;
        console.log('✅ تم استخراج abilityText من abilityData:', abilityText);
      } else if (abilityKey) {
        // إذا لم يكن هناك abilityData، فاستخدم abilityKey (المشفر)
        try {
          abilityText = decodeURIComponent(abilityKey);
          console.log('✅ تم استخراج abilityText من abilityKey (فك التشفير):', abilityText);
        } catch (e) {
          // إذا فشل فك التشفير، استخدم abilityKey كما هو
          abilityText = abilityKey;
          console.log('⚠️ فشل فك التشفير، استخدام abilityKey كما هو:', abilityText);
        }
      }
      
      if (!abilityText) {
        console.warn('⚠️ لم يتم العثور على abilityText في snapshot:', { abilityData, abilityKey });
        return;
      }
      
      console.log('🔄 تم إعادة تفعيل القدرة من Firebase (onChildRemoved):', abilityText);

      // ✅ إزالة من tempUsed
      tempUsed.delete(abilityText);

      // ✅ تحديث myAbilities
      myAbilities = (myAbilities || []).map(a => {
        const text = a.text || a;
        if (text === abilityText) {
          return { ...a, used: false };
        }
        return a;
      });

      // ✅ تحديث localStorage
      const usedAbilitiesKey = `${playerParam}UsedAbilities`;
      let usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
      usedAbilities = usedAbilities.filter(ability => ability !== abilityText);
      localStorage.setItem(usedAbilitiesKey, JSON.stringify(usedAbilities));

      // ✅ تحديث القدرات في localStorage
      const abilitiesKey = `${playerParam}Abilities`;
      let abilities = JSON.parse(localStorage.getItem(abilitiesKey) || '[]');
      const updatedAbilities = abilities.map(ability => {
        const text = typeof ability === 'string' ? ability : (ability.text || ability);
        if (text === abilityText) {
          return typeof ability === 'string' ? { text: ability, used: false } : { ...ability, used: false };
        }
        return typeof ability === 'string' ? { text: ability, used: ability.used || false } : ability;
      });
      localStorage.setItem(abilitiesKey, JSON.stringify(updatedAbilities));

      // ✅ تحديث الواجهة فوراً (مهم للهواتف)
      if (abilitiesWrap) {
        // ✅ مسح الواجهة أولاً للتحديث الفوري
        abilitiesWrap.innerHTML = '';
        renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
        console.log('✅ تم إعادة رسم الواجهة (onChildRemoved - فوري)');
      }

      if (abilityStatus) {
        abilityStatus.textContent = `🔄 تم إعادة تفعيل القدرة: ${abilityText}`;
        abilityStatus.style.color = "#1a9c35";
        setTimeout(() => {
          if (abilityStatus) {
            abilityStatus.textContent = "";
          }
        }, 3000);
      }

      console.log(`✅ تم إعادة تفعيل القدرة للاعب ${playerParam}:`, abilityText);
    });

    console.log('✅ مستمع usedAbilities من Firebase نشط');
  } catch (error) {
    console.error('❌ خطأ في بدء مستمع usedAbilities من Firebase:', error);
  }
}

/**
 * ✅ بدء الاستماع لتغييرات القدرات من Firebase (لإضافة/نقل القدرات)
 */
function startAbilitiesListener() {
  if (!database || !gameId || !playerParam) {
    console.warn('⚠️ Firebase database أو gameId أو playerParam غير موجودين - لن يتم تشغيل مستمع abilities');
    return;
  }

  try {
    const refPath = `games/${gameId}/players/${playerParam}/abilities`;
    const abilitiesRef = ref(database, refPath);

    console.log('✅ بدء الاستماع لتغييرات abilities من Firebase:', refPath);

    // ✅ تحميل القدرات من Firebase عند البدء
    get(abilitiesRef).then((snapshot) => {
      const firebaseAbilities = snapshot.val() || [];
      
      // ✅ التأكد من أن firebaseAbilities مصفوفة
      let abilitiesArray = [];
      if (Array.isArray(firebaseAbilities)) {
        abilitiesArray = firebaseAbilities;
      } else if (typeof firebaseAbilities === 'object') {
        // إذا كان كائن، حوله إلى مصفوفة
        abilitiesArray = Object.values(firebaseAbilities);
      }
      
      if (abilitiesArray.length > 0) {
        console.log('📥 تحميل القدرات الأولية من Firebase:', abilitiesArray.length, 'قدرة');
        
        // ✅ تحديث myAbilities مع الحفاظ على حالة used من usedAbilities
        const usedAbilitiesKey = `${playerParam}UsedAbilities`;
        const usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
        const usedSet = new Set(usedAbilities);
        
        // ✅ تحديث myAbilities مع دمج حالة used
        myAbilities = abilitiesArray.map(ability => {
          const text = typeof ability === 'string' ? ability : (ability.text || ability);
          const isUsed = usedSet.has(text) || (typeof ability === 'object' && ability.used === true);
          return {
            text: text,
            used: isUsed
          };
        });
        
        // ✅ حفظ في localStorage
        const abilitiesKey = `${playerParam}Abilities`;
        localStorage.setItem(abilitiesKey, JSON.stringify(myAbilities));
        
        // ✅ تحديث الواجهة
        if (abilitiesWrap) {
          renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
          console.log('✅ تم تحديث واجهة القدرات من Firebase (التحميل الأولي)');
        }
        
        console.log(`✅ تم تحميل ${myAbilities.length} قدرة للاعب ${playerParam} من Firebase`);
      } else {
        console.log('⚠️ لا توجد قدرات في Firebase للاعب', playerParam, '- سيتم استخدام localStorage');
        // إذا لم توجد في Firebase، جرب localStorage
        loadPlayerAbilities();
      }
    }).catch((error) => {
      console.error('❌ خطأ في تحميل القدرات الأولية من Firebase:', error);
      // إذا فشل التحميل من Firebase، جرب localStorage
      loadPlayerAbilities();
    });

    // ✅ الاستماع لتغييرات abilities باستخدام onValue
    onValue(abilitiesRef, (snapshot) => {
      const firebaseAbilities = snapshot.val() || [];
      
      // ✅ التأكد من أن firebaseAbilities مصفوفة
      let abilitiesArray = [];
      if (Array.isArray(firebaseAbilities)) {
        abilitiesArray = firebaseAbilities;
      } else if (typeof firebaseAbilities === 'object') {
        // إذا كان كائن، حوله إلى مصفوفة
        abilitiesArray = Object.values(firebaseAbilities);
      }
      
      console.log('📥 تحديث القدرات من Firebase:', abilitiesArray.length, 'قدرة');
      
      // ✅ إذا كانت القدرات فارغة، لا نحدث (لكن نسمح بالتحديثات الفارغة للتنظيف)
      if (abilitiesArray.length === 0 && myAbilities.length === 0) {
        console.log('⚠️ القدرات فارغة في Firebase و localStorage - تجاهل التحديث');
        return;
      }
      
      // ✅ تحديث myAbilities مع الحفاظ على حالة used من usedAbilities
      const usedAbilitiesKey = `${playerParam}UsedAbilities`;
      const usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
      const usedSet = new Set(usedAbilities);
      
      // ✅ تحديث myAbilities مع دمج حالة used
      myAbilities = abilitiesArray.map(ability => {
        const text = typeof ability === 'string' ? ability : (ability.text || ability);
        const isUsed = usedSet.has(text) || (typeof ability === 'object' && ability.used === true);
        return {
          text: text,
          used: isUsed
        };
      });
      
      // ✅ حفظ في localStorage
      const abilitiesKey = `${playerParam}Abilities`;
      localStorage.setItem(abilitiesKey, JSON.stringify(myAbilities));
      
      // ✅ تحديث الواجهة فوراً (مهم للهواتف)
      if (abilitiesWrap) {
        // ✅ مسح الواجهة أولاً للتحديث الفوري
        abilitiesWrap.innerHTML = '';
        renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
        console.log('✅ تم تحديث واجهة القدرات من Firebase (فوري)');
      }
      
      console.log(`✅ تم تحديث ${myAbilities.length} قدرة للاعب ${playerParam} من Firebase`);
    }, (error) => {
      console.error('❌ خطأ في مستمع abilities:', error);
    });

    console.log('✅ مستمع abilities من Firebase نشط');
  } catch (error) {
    console.error('❌ خطأ في بدء مستمع abilities من Firebase:', error);
  }
}

/**
 * ✅ بدء الاستماع لتحديثات القدرات الفورية من Firebase (للهواتف)
 * يستمع لـ abilityUpdates للتحديثات الفورية
 */
function startAbilityUpdatesListener() {
  if (!database || !gameId) {
    console.warn('⚠️ Firebase database أو gameId غير موجودين - لن يتم تشغيل مستمع abilityUpdates');
    return;
  }

  try {
    const refPath = `games/${gameId}/abilityUpdates`;
    const updatesRef = ref(database, refPath);

    console.log('✅ بدء الاستماع لتحديثات القدرات الفورية من Firebase:', refPath);

    // ✅ الاستماع لتحديثات جديدة (child_added)
    onChildAdded(updatesRef, (snapshot) => {
      const update = snapshot.val();
      if (!update) return;

      console.log('📥 تحديث فوري للقدرات:', update);

      // ✅ إذا كان التحديث خاص باللاعب الحالي، تحديث فوري
      if (update.playerParam === playerParam || update.toPlayer === playerParam) {
        console.log('🔄 تحديث فوري للاعب الحالي - إعادة تحميل القدرات');
        
        // ✅ إعادة تحميل القدرات من Firebase فوراً
        const abilitiesRef = ref(database, `games/${gameId}/players/${playerParam}/abilities`);
        get(abilitiesRef).then((snapshot) => {
          const firebaseAbilities = snapshot.val() || [];
          
          let abilitiesArray = [];
          if (Array.isArray(firebaseAbilities)) {
            abilitiesArray = firebaseAbilities;
          } else if (typeof firebaseAbilities === 'object') {
            abilitiesArray = Object.values(firebaseAbilities);
          }
          
          if (abilitiesArray.length > 0) {
            // ✅ تحديث myAbilities مع الحفاظ على حالة used
            const usedAbilitiesKey = `${playerParam}UsedAbilities`;
            const usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
            const usedSet = new Set(usedAbilities);
            
            myAbilities = abilitiesArray.map(ability => {
              const text = typeof ability === 'string' ? ability : (ability.text || ability);
              const isUsed = usedSet.has(text) || (typeof ability === 'object' && ability.used === true);
              return {
                text: text,
                used: isUsed
              };
            });
            
            // ✅ حفظ في localStorage
            const abilitiesKey = `${playerParam}Abilities`;
            localStorage.setItem(abilitiesKey, JSON.stringify(myAbilities));
            
            // ✅ تحديث الواجهة فوراً
            if (abilitiesWrap) {
              abilitiesWrap.innerHTML = '';
              renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
              console.log('✅ تم تحديث واجهة القدرات فوراً من abilityUpdates');
            }
          }
        }).catch(err => console.error('❌ خطأ في تحميل القدرات:', err));
      }
    });

    console.log('✅ مستمع abilityUpdates من Firebase نشط');
  } catch (error) {
    console.error('❌ خطأ في بدء مستمع abilityUpdates من Firebase:', error);
  }
}

// ⚠️ socket.on تم استبداله بمستمع Firebase
// المستمع الجديد startPlayerAbilityResultListener يتولى كل شيء من Firebase
// if (socket) {
//   socket.on("abilityRequestResult", ({ requestId, ok, reason }) => {
//     const abilityText = pendingRequests.get(requestId);
//     if (abilityText) pendingRequests.delete(requestId);
//
//     if (!ok) {
//       if (abilityText) {
//         tempUsed.delete(abilityText);
//         myAbilities = (myAbilities || []).map(a => a.text === abilityText ? { ...a, used: false } : a);
//       }
//       if (abilitiesWrap) {
//         renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
//       }
//       if (socket) {
//         socket.emit("requestAbilities", { gameID, playerName });
//       }
//
//       if (abilityStatus) {
//         if (reason === "already_used") abilityStatus.textContent = "❌ القدرة تم استخدامها بالفعل. اطلب قدرة أخرى.";
//         else if (reason === "ability_not_found") abilityStatus.textContent = "❌ القدرة غير معروفة لدى المستضيف.";
//         else abilityStatus.textContent = "❌ تعذر تنفيذ الطلب.";
//       }
//     } else {
//       if (abilityStatus) {
//         abilityStatus.textContent = "✅ تم قبول الطلب من المستضيف.";
//       }
//     }
//   });
// }

// Load abilities from localStorage
function loadPlayerAbilities() {
  const abilitiesKey = `${playerParam}Abilities`;
  const savedAbilities = localStorage.getItem(abilitiesKey);
  
  console.log('Loading abilities from localStorage:', { abilitiesKey, savedAbilities });
  
  if (savedAbilities) {
    try {
      const abilitiesRaw = JSON.parse(savedAbilities);
      console.log('Parsed abilities:', abilitiesRaw);
      
      // تأكد أن abilities هو مصفوفة وليس كائن
      let abilities = [];
      if (Array.isArray(abilitiesRaw)) {
        abilities = abilitiesRaw;
      } else if (typeof abilitiesRaw === 'object' && abilitiesRaw !== null) {
        // إذا كان كائن، حوله إلى مصفوفة من القيم
        abilities = Object.values(abilitiesRaw);
      } else if (typeof abilitiesRaw === 'string') {
        // إذا كان نص، حوله إلى مصفوفة
        abilities = [abilitiesRaw];
      } else {
        console.warn('Unexpected abilities format:', abilitiesRaw);
        abilities = [];
      }
      
      // Always reset abilities to unused state for new game
      // Only check for used abilities if we're in the middle of a game
      const currentRound = parseInt(localStorage.getItem('currentRound') || '0');
      let usedSet = new Set();
      
      // Always load used abilities (both from game and from host control)
      const usedAbilitiesKey = `${playerParam}UsedAbilities`;
      const usedAbilitiesRaw = localStorage.getItem(usedAbilitiesKey) || '[]';
      let usedAbilities = [];
      
      try {
        const parsed = JSON.parse(usedAbilitiesRaw);
        // تأكد أن usedAbilities هو مصفوفة وليس كائن
        if (Array.isArray(parsed)) {
          // إذا كانت مصفوفة، استخرج text من كل عنصر إذا كان كائن
          usedAbilities = parsed.map(item => {
            if (typeof item === 'string') return item;
            if (typeof item === 'object' && item !== null) {
              return item.text || item.abilityText || item;
            }
            return item;
          });
        } else if (typeof parsed === 'object' && parsed !== null) {
          // إذا كان كائن، حوله إلى مصفوفة من القيم
          usedAbilities = Object.values(parsed).map(item => {
            if (typeof item === 'string') return item;
            if (typeof item === 'object' && item !== null) {
              return item.text || item.abilityText || item;
            }
            return item;
          });
        } else if (typeof parsed === 'string') {
          // إذا كان نص، حوله إلى مصفوفة
          usedAbilities = [parsed];
        } else {
          usedAbilities = [];
        }
      } catch (e) {
        console.warn('Error parsing used abilities:', e);
        usedAbilities = [];
      }
      
      // تأكد أن جميع العناصر هي نصوص قبل إنشاء Set
      usedAbilities = usedAbilities.filter(item => typeof item === 'string' && item.length > 0);
      usedSet = new Set(usedAbilities);
      
      if (currentRound > 0) {
        console.log(`Loading used abilities for round ${currentRound}:`, Array.from(usedSet));
      } else {
        console.log('Loading used abilities (including host-controlled):', Array.from(usedSet));
      }
      
      myAbilities = abilities.map(ability => {
        const text = typeof ability === 'string' ? ability : (ability.text || ability);
        // Check if it's used in game OR temporarily used (pending request) OR used by host
        const isUsedInGame = currentRound > 0 && usedSet.has(text);
        const isTemporarilyUsed = tempUsed.has(text);
        const isUsedByHost = usedSet.has(text); // Always check if used by host regardless of round
        const isUsed = isUsedInGame || isTemporarilyUsed || isUsedByHost;
        return { 
          text, 
          used: isUsed
        };
      });
      
      console.log(`Loaded ${myAbilities.length} abilities, ${myAbilities.filter(a => a.used).length} used`);
      
      // Force immediate UI update
      if (abilitiesWrap) {
        abilitiesWrap.innerHTML = ''; // Clear first
        renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
      }
      if (abilityStatus) {
        abilityStatus.textContent = "اضغط على القدرة لطلب استخدامها.";
      }
      console.log('Loaded abilities:', myAbilities);
      
      // Force a small delay to ensure DOM is updated
      setTimeout(() => {
        if (abilitiesWrap && abilitiesWrap.children.length === 0) {
          console.log('Re-rendering abilities after delay...');
          renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
        }
      }, 100);
      
      // Check for any pending requests immediately after loading
      setTimeout(checkAbilityRequests, 100);
      
      // Also check for pending requests in localStorage to maintain disabled state
      setTimeout(() => {
        const requests = JSON.parse(localStorage.getItem('abilityRequests') || '[]');
        const myPendingRequests = requests.filter(req => 
          req.playerParam === playerParam && req.status === 'pending'
        );
        
        if (myPendingRequests.length > 0) {
          myPendingRequests.forEach(request => {
            tempUsed.add(request.abilityText);
            myAbilities = myAbilities.map(a =>
              a.text === request.abilityText ? { ...a, used: true } : a
            );
          });
          
          if (abilitiesWrap) {
            renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
          }
          
          if (abilityStatus) {
            abilityStatus.textContent = "⏳ في انتظار موافقة المستضيف...";
          }
          
          console.log(`Restored ${myPendingRequests.length} pending ability requests`);
        }
      }, 200);
    } catch (e) {
      console.error('Error loading abilities:', e);
      if (abilityStatus) {
        abilityStatus.textContent = "خطأ في تحميل القدرات.";
      }
    }
  } else {
    // Try to load abilities from gameSetupProgress as fallback
    console.log('No abilities found in localStorage, trying gameSetupProgress...');
    const gameSetup = localStorage.getItem('gameSetupProgress');
    if (gameSetup) {
      try {
        const setupData = JSON.parse(gameSetup);
        const playerKey = playerParam === 'player1' ? 'player1' : 'player2';
        const playerData = setupData[playerKey];
        
        if (playerData && playerData.abilities) {
          console.log('✅ Found abilities in gameSetupProgress:', playerData.abilities);
          myAbilities = normalizeAbilityList(playerData.abilities);
          
          // ✅ حفظ القدرات في localStorage للتحميل السريع في المستقبل
          const abilitiesKey = `${playerParam}Abilities`;
          localStorage.setItem(abilitiesKey, JSON.stringify(myAbilities));
          console.log(`✅ تم حفظ القدرات من gameSetupProgress في localStorage`, myAbilities.length);
          
          if (abilitiesWrap) {
            abilitiesWrap.innerHTML = '';
            renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
          }
          if (abilityStatus) {
            abilityStatus.textContent = "اضغط على القدرة لطلب استخدامها.";
          }
          
          // Force a small delay to ensure DOM is updated
          setTimeout(() => {
            if (abilitiesWrap && abilitiesWrap.children.length === 0) {
              console.log('Re-rendering abilities from gameSetupProgress after delay...');
              renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
            }
          }, 100);
          
          return;
        }
      } catch (e) {
        console.error('Error parsing gameSetupProgress:', e);
      }
    }
    
    // ✅ لا توجد قدرات محفوظة - رسالة واضحة للمستخدم
    console.warn('⚠️ No abilities found in localStorage or gameSetupProgress');
    if (abilityStatus) {
      abilityStatus.textContent = "⏳ في انتظار تحميل القدرات من المستضيف...";
      abilityStatus.style.color = "#f59e0b";
    }
    
    // ✅ مسح العرض إذا لم توجد قدرات
    if (abilitiesWrap) {
      abilitiesWrap.innerHTML = '<p style="color: #9ca3af; font-size: 0.875rem;">لا توجد قدرات متاحة بعد</p>';
    }
  }
}

// ✅ تحميل قدرات اللاعب نفسه (عرض فقط) - يختفي عند بدء المعركة
function loadPlayerAbilitiesView() {
  const abilitiesKey = `${playerParam}Abilities`;
  const savedAbilities = localStorage.getItem(abilitiesKey);
  
  if (savedAbilities) {
    try {
      const abilities = JSON.parse(savedAbilities);
      
      // Only check for used abilities if we're in the middle of a game
      const currentRound = parseInt(localStorage.getItem('currentRound') || '0');
      let usedSet = new Set();
      
      // Always load used abilities (both from game and from host control)
      const usedAbilitiesKey = `${playerParam}UsedAbilities`;
      const usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
      usedSet = new Set(usedAbilities);
      
      const playerAbilities = abilities.map(ability => {
        const text = typeof ability === 'string' ? ability : (ability.text || ability);
        // Check if it's used in game OR used by host
        const isUsed = usedSet.has(text) || (typeof ability === 'object' && ability.used === true);
        return { 
          text, 
          used: isUsed
        };
      });
      
      if (playerAbilitiesViewWrap) {
        playerAbilitiesViewWrap.innerHTML = ''; // Clear first
        renderBadges(playerAbilitiesViewWrap, playerAbilities, { clickable: false, badgeColor: 'blue' });
      }
      
      // Show player abilities view panel if not submitted
      if (playerAbilitiesViewPanel && !submittedOrder) {
        playerAbilitiesViewPanel.classList.remove("hidden");
      }
      
      console.log('Loaded player abilities view:', playerAbilities);
    } catch (e) {
      console.error('Error loading player abilities view:', e);
    }
  }
}

// Load opponent abilities
function loadOpponentAbilities() {
  const opponentParam = playerParam === 'player1' ? 'player2' : 'player1';
  const opponentAbilitiesKey = `${opponentParam}Abilities`;
  const savedAbilities = localStorage.getItem(opponentAbilitiesKey);
  
  if (savedAbilities) {
    try {
      const abilities = JSON.parse(savedAbilities);
      
      // Only check for used abilities if we're in the middle of a game
      const currentRound = parseInt(localStorage.getItem('currentRound') || '0');
      let usedSet = new Set();
      
      // Only load used abilities if we're actually in a game (round > 0)
      if (currentRound > 0) {
        const usedAbilitiesKey = `${opponentParam}UsedAbilities`;
        const usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
        usedSet = new Set(usedAbilities);
      }
      
      const opponentAbilities = abilities.map(ability => {
        const text = typeof ability === 'string' ? ability : (ability.text || ability);
        // Only mark as used if we're in a game and it's actually been used
        const isUsed = currentRound > 0 && usedSet.has(text);
        return { 
          text, 
          used: isUsed
        };
      });
      
      if (oppWrap) {
        oppWrap.innerHTML = ''; // Clear first
        renderBadges(oppWrap, opponentAbilities, { clickable: false });
      }
      
      // Show opponent panel if not submitted
      if (oppPanel && !submittedOrder) {
        oppPanel.classList.remove("hidden");
      }
      
      console.log('Loaded opponent abilities:', opponentAbilities);
    } catch (e) {
      console.error('Error loading opponent abilities:', e);
    }
  }
}

// ✅ تنظيف الطلبات القديمة عند بدء الصفحة (مهم للهواتف)
try {
  const requests = JSON.parse(localStorage.getItem('abilityRequests') || '[]');
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
  const cleanRequests = requests.filter(req => {
    // حذف الطلبات القديمة جداً أو التي بحالة pending لأكثر من 5 دقائق
    if (!req.timestamp || req.timestamp < fiveMinutesAgo) {
      if (req.status === 'pending' || !req.status) {
        console.log(`🧹 حذف طلب قديم عند بدء الصفحة: ${req.abilityText}`);
        return false;
      }
    }
    return true;
  });
  
  if (cleanRequests.length !== requests.length) {
    localStorage.setItem('abilityRequests', JSON.stringify(cleanRequests));
    console.log(`✅ تم تنظيف ${requests.length - cleanRequests.length} طلب قديم`);
  }
} catch (e) {
  console.error('Error cleaning old requests:', e);
}

// ✅ تحميل فوري للقدرات عند بدء الصفحة (بدون قدرات افتراضية)
console.log('🔄 Initial abilities load...');

// تحميل فوري
loadPlayerAbilities();
loadOpponentAbilities();
loadPlayerAbilitiesView();

// تحميل إضافي بعد تأخير قصير لضمان جاهزية DOM
setTimeout(() => {
  console.log('🔄 Secondary abilities load (after delay)...');
  loadPlayerAbilities();
  loadOpponentAbilities();
}, 200);

// ✅ نظام مراقبة سريع للقدرات (كل 300ms للتزامن الفوري)
let lastAbilitiesUpdateTime = localStorage.getItem('abilitiesLastUpdate') || '0';

// ✅ BroadcastChannel للتواصل الفوري (ممتاز للهواتف)
try {
  if (typeof BroadcastChannel !== 'undefined') {
    const abilityChannel = new BroadcastChannel('ability-updates');
    
    abilityChannel.onmessage = function(event) {
      console.log('📡 BroadcastChannel message received in player-cards:', event.data);
      
      if (event.data.type === 'ABILITY_UPDATED') {
        console.log('⚡ Ability update via BroadcastChannel - Refreshing immediately...');
        
        // ✅ تحميل فوري للقدرات
        loadPlayerAbilities();
        loadOpponentAbilities();
        
        // ✅ تحديث إشارة التحديث المحلية
        lastAbilitiesUpdateTime = event.data.timestamp || Date.now().toString();
      }
    };
    
    console.log('✅ BroadcastChannel initialized for player-cards page');
  }
} catch (e) {
  console.log('⚠️ BroadcastChannel not supported, using polling only');
}

setInterval(() => {
  // ✅ فحص إشارة التحديث أولاً (أسرع طريقة)
  const currentUpdateTime = localStorage.getItem('abilitiesLastUpdate') || '0';
  if (currentUpdateTime !== lastAbilitiesUpdateTime) {
    console.log('✅ Abilities update signal detected - Immediate refresh...');
    loadPlayerAbilities();
    loadOpponentAbilities();
    lastAbilitiesUpdateTime = currentUpdateTime;
  }
  
  // فحص طلبات القدرات
  checkAbilityRequests();
}, 300); // ✅ التحقق كل 300ms للتزامن فائق السرعة

// ✅ تنظيف دوري للطلبات المعالجة من الذاكرة (كل 5 دقائق)
setInterval(() => {
  if (processedRequests.size > 50) {
    console.log(`🧹 تنظيف الطلبات المعالجة من الذاكرة (${processedRequests.size} طلبات)`);
    processedRequests.clear();
  }
}, 5 * 60 * 1000);

// Simple storage change listener like order.js - مع حماية قوية من التكرار
window.addEventListener('storage', function(e) {
  // ✅ حماية: تجاهل التغييرات للاعب الآخر
  if (e.key && e.key.includes('player') && !e.key.includes(playerParam)) {
    const otherPlayerParam = playerParam === 'player1' ? 'player2' : 'player1';
    if (e.key.includes(otherPlayerParam) && !e.key.includes(playerParam)) {
      console.log(`🚫 تجاهل تغيير storage للاعب الآخر في abilities: ${e.key}`);
      return;
    }
  }
  
  // ✅ استماع لإشارة التحديث الصريحة (أسرع طريقة)
  if (e.key === 'abilitiesLastUpdate') {
    console.log('⚡ Immediate abilities update signal received!');
    lastAbilitiesUpdateTime = e.newValue || '0';
    loadPlayerAbilities();
    loadOpponentAbilities();
    return; // تم المعالجة، لا حاجة للمتابعة
  }
  
  // ✅ حماية: التحقق من أن التغيير للاعب الحالي فقط
  if (e.key && e.key.includes('Abilities')) {
    // تحقق من أن المفتاح للاعب الحالي
    const keyPlayerParam = e.key.includes('player1') ? 'player1' : (e.key.includes('player2') ? 'player2' : null);
    if (keyPlayerParam && keyPlayerParam !== playerParam && !e.key.includes('Opponent')) {
      console.log(`🚫 تجاهل تغيير Abilities للاعب الآخر: ${keyPlayerParam} (ليس ${playerParam})`);
      return;
    }
    console.log(`Storage change detected: ${e.key}`);
    loadPlayerAbilities();
    loadOpponentAbilities();
  }
  if (e.key === 'abilityRequests') {
    checkAbilityRequests();
  }
});

// Listen for ability toggle events from host
window.addEventListener('abilityToggled', function(e) {
  try {
    const { playerParam: changedPlayerParam, abilityText, isUsed } = e.detail;
    console.log(`🔔 Ability toggled event: ${abilityText} for ${changedPlayerParam}, isUsed: ${isUsed}`);

    if (changedPlayerParam === playerParam) {
      console.log('✅ This is for current player - Applying immediate update...');
      
      // ✅ مزامنة فورية
      forceImmediateAbilitySync(changedPlayerParam, abilityText, isUsed);
      
      // Also update myAbilities directly
      const abilityIndex = myAbilities.findIndex(ab => ab.text === abilityText);
      if (abilityIndex !== -1) {
        myAbilities[abilityIndex].used = isUsed;
        console.log(`✅ Ability "${abilityText}" set to used: ${isUsed}`);
        
        // ✅ تحديث فوري في localStorage
        const abilitiesKey = `${playerParam}Abilities`;
        const savedAbilities = JSON.parse(localStorage.getItem(abilitiesKey) || '[]');
        savedAbilities.forEach(ability => {
          const text = typeof ability === 'string' ? ability : ability.text;
          if (text === abilityText && typeof ability === 'object') {
            ability.used = isUsed;
          }
        });
        localStorage.setItem(abilitiesKey, JSON.stringify(savedAbilities));
        
        // Re-render abilities with visual feedback
        if (abilitiesWrap) {
          abilitiesWrap.style.transition = 'transform 0.2s ease';
          abilitiesWrap.style.transform = 'scale(0.98)';
          
          renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
          
          setTimeout(() => {
            abilitiesWrap.style.transform = 'scale(1)';
          }, 100);
        }
        
        // Update status message with visual feedback
        if (abilityStatus) {
          if (isUsed) {
            abilityStatus.textContent = "❌ القدرة مستخدمة - انتظر إعادة التفعيل";
            abilityStatus.style.color = "#ff6b35";
          } else {
            abilityStatus.textContent = "✅ تم إعادة تفعيل القدرة - يمكنك استخدامها الآن!";
            abilityStatus.style.color = "#32c675";
            
            // إعادة النص الأصلي بعد 3 ثواني
            setTimeout(() => {
              if (abilityStatus) {
                abilityStatus.textContent = "اضغط على القدرة لطلب استخدامها.";
              }
            }, 3000);
          }
        }
        
        // ✅ بعد تعديل used داخل الحدث، إعادة تحميل القدرات من Firebase
        loadPlayerAbilities();
      }
    }

    loadOpponentAbilities();
  } catch (error) {
    console.error('Error handling ability toggle event:', error);
  }
});

// Listen for postMessage from host
window.addEventListener('message', function(e) {
  try {
    if (e.data && e.data.type === 'ABILITY_TOGGLED') {
      const { playerParam: changedPlayerParam, abilityText, isUsed } = e.data;
      console.log(`📬 PostMessage: Ability toggled: ${abilityText} for ${changedPlayerParam}, isUsed: ${isUsed}`);
      
      // Check if this change affects the current player
      if (changedPlayerParam === playerParam) {
        console.log(`✅ Updating abilities for current player: ${playerParam}`);
        
        // Update myAbilities
        if (myAbilities) {
          myAbilities.forEach(ability => {
            if (ability.text === abilityText) {
              ability.used = isUsed;
            }
          });
        }
        
        // ✅ تحديث فوري في localStorage
        const abilitiesKey = `${playerParam}Abilities`;
        const savedAbilities = JSON.parse(localStorage.getItem(abilitiesKey) || '[]');
        savedAbilities.forEach(ability => {
          const text = typeof ability === 'string' ? ability : ability.text;
          if (text === abilityText && typeof ability === 'object') {
            ability.used = isUsed;
          }
        });
        localStorage.setItem(abilitiesKey, JSON.stringify(savedAbilities));
        
        // Update tempUsed
        if (isUsed) {
          tempUsed.add(abilityText);
        } else {
          tempUsed.delete(abilityText);
        }
        
        // ✅ تحديث بصري فوري مع تأثير
        if (abilitiesWrap) {
          abilitiesWrap.style.transition = 'transform 0.2s ease';
          abilitiesWrap.style.transform = 'scale(0.98)';
          
          renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
          
          setTimeout(() => {
            abilitiesWrap.style.transform = 'scale(1)';
          }, 100);
        }
        
        console.log(`✅ Abilities updated visually for ${playerParam}`);
      }
      
      // Always re-render opponent abilities
      loadOpponentAbilities();
    }
  } catch (error) {
    console.error('Error handling postMessage:', error);
  }
});

// ✅ فور وصول أي تحديث من المضيف، أعد تحميل القدرات مباشرة
function forceImmediateAbilitySync(playerParam, abilityText, isUsed) {
  try {
    // حدّث القدرات الخاصة بي
    if (myAbilities) {
      myAbilities.forEach(ability => {
        if (ability.text === abilityText) {
          ability.used = isUsed;
        }
      });
    }

    // حدّث الحالة المؤقتة
    if (isUsed) {
      tempUsed.add(abilityText);
    } else {
      tempUsed.delete(abilityText);
    }

    // أعد رسم القدرات فوراً
    if (abilitiesWrap) {
      renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
    }
    loadOpponentAbilities();
    console.log(`🔄 فوراً: تم تحديث القدرة ${abilityText} (${isUsed ? "مستخدمة" : "متاحة"})`);
  } catch (err) {
    console.error("Error in forceImmediateAbilitySync:", err);
  }
}


// Check for ability request responses
function checkAbilityRequests() {
  try {
    const requests = JSON.parse(localStorage.getItem('abilityRequests') || '[]');
    
    // ✅ حذف الطلبات القديمة جداً (أكثر من ساعة)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const freshRequests = requests.filter(req => {
      if (req.timestamp && req.timestamp < oneHourAgo) {
        console.log(`🧹 تنظيف طلب قديم: ${req.abilityText} (${new Date(req.timestamp).toLocaleString()})`);
        return false;
      }
      return true;
    });
    
    // حفظ الطلبات النظيفة
    if (freshRequests.length !== requests.length) {
      localStorage.setItem('abilityRequests', JSON.stringify(freshRequests));
    }
    
    // فقط طلبات اللاعب الحالي
    const myRequests = freshRequests.filter(req => req.playerParam === playerParam);
    
    if (myRequests.length === 0) {
      // No pending requests, reset status
      if (abilityStatus && !myAbilities.some(a => a.used)) {
        abilityStatus.textContent = "اضغط على القدرة لطلب استخدامها.";
      }
      return;
    }
    
    myRequests.forEach(request => {
      // ✅ تجاهل الطلبات المعالجة سابقاً
      if (processedRequests.has(request.id)) {
        console.log(`⚠️ تجاهل طلب معالج بالفعل: ${request.id}`);
        
        // حذف من localStorage أيضاً
        const updatedRequests = freshRequests.filter(req => req.id !== request.id);
        localStorage.setItem('abilityRequests', JSON.stringify(updatedRequests));
        return;
      }
      
      if (request.status === 'approved') {
        // ✅ تسجيل الطلب كمعالج
        processedRequests.add(request.id);
        console.log(`✅ معالجة طلب موافق: ${request.id} - ${request.abilityText}`);
        // Ability was approved by host - keep it disabled permanently
        if (abilityStatus) {
          abilityStatus.textContent = "✅ تم قبول الطلب من المستضيف.";
        }
        
        // Mark as permanently used
        const usedAbilitiesKey = `${playerParam}UsedAbilities`;
        const usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
        if (!usedAbilities.includes(request.abilityText)) {
          usedAbilities.push(request.abilityText);
          localStorage.setItem(usedAbilitiesKey, JSON.stringify(usedAbilities));
        }
        
        // Keep ability disabled (already disabled from request)
        // Update abilities display to show permanent disabled state
        myAbilities = (myAbilities || []).map(a =>
          a.text === request.abilityText ? { ...a, used: true } : a
        );
        
        // Also update the player-specific abilities list
        const playerAbilitiesKey = `${playerParam}Abilities`;
        const playerAbilities = JSON.parse(localStorage.getItem(playerAbilitiesKey) || '[]');
        playerAbilities.forEach(ability => {
          const abilityText = typeof ability === 'string' ? ability : ability.text;
          if (abilityText === request.abilityText) {
            if (typeof ability === 'object') {
              ability.used = true;
            }
          }
        });
        localStorage.setItem(playerAbilitiesKey, JSON.stringify(playerAbilities));
        
        // Update global abilities lists
        const globalAbilitiesKey = playerParam === 'player1' ? 'P1_ABILITIES_KEY' : 'P2_ABILITIES_KEY';
        const globalAbilities = JSON.parse(localStorage.getItem(globalAbilitiesKey) || '[]');
        globalAbilities.forEach(ability => {
          if (ability.text === request.abilityText) {
            ability.used = true;
          }
        });
        localStorage.setItem(globalAbilitiesKey, JSON.stringify(globalAbilities));
        
        if (abilitiesWrap) {
          renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
        }
        
        // ✅ حذف الطلب فوراً من localStorage
        const updatedRequests = freshRequests.filter(req => req.id !== request.id);
        localStorage.setItem('abilityRequests', JSON.stringify(updatedRequests));
        
        console.log(`✅ تم حذف الطلب الموافق من localStorage: ${request.abilityText}`);
        
      } else if (request.status === 'rejected') {
        // ✅ تسجيل الطلب كمعالج
        processedRequests.add(request.id);
        console.log(`❌ معالجة طلب مرفوض: ${request.id} - ${request.abilityText}`);
        // Ability was rejected by host - re-enable it
        if (abilityStatus) {
          abilityStatus.textContent = "❌ تم رفض الطلب من المستضيف.";
        }
        
        // Remove from temp used and re-enable
        tempUsed.delete(request.abilityText);
        
        // Update abilities display to show enabled state
        myAbilities = (myAbilities || []).map(a =>
          a.text === request.abilityText ? { ...a, used: false } : a
        );
        
        if (abilitiesWrap) {
          renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
        }
        
        // ✅ حذف الطلب فوراً من localStorage
        const updatedRequests = freshRequests.filter(req => req.id !== request.id);
        localStorage.setItem('abilityRequests', JSON.stringify(updatedRequests));
        
        console.log(`✅ تم حذف الطلب المرفوض من localStorage: ${request.abilityText}`);
      }
    });
  } catch (e) {
    console.error('Error checking ability requests:', e);
  }
}

/* ================== Mobile Detection ================== */
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

/* ================== Cards UI ================== */
/* ============ Unique-number dropdown logic (from order.js) ============ */
function buildOptions(select, N, forbiddenSet, currentValue) {
  // حفظ القيمة الحالية قبل التعديل
  const oldValue = select.value;
  
  // إضافة تأثير انتقال سلس لتقليل الوميض
  select.style.transition = 'opacity 0.1s ease';
  select.style.opacity = '0.8';
  
  // مسح المحتوى الحالي
  select.innerHTML = "";
  
  // إضافة الخيار الافتراضي
  const def = document.createElement("option"); 
  def.value = ""; 
  def.textContent = "-- الترتيب --"; 
  select.appendChild(def);
  
  // إضافة الخيارات المتاحة
  for (let i = 1; i <= N; i++) {
    if (!forbiddenSet.has(String(i)) || String(i) === String(currentValue)) {
      const opt = document.createElement("option");
      opt.value = i; 
      opt.textContent = i; 
      select.appendChild(opt);
    }
  }
  
  // استعادة القيمة إذا كانت متاحة
  if (currentValue && Array.from(select.options).some(o => o.value === String(currentValue))) {
    select.value = String(currentValue);
  } else if (oldValue && Array.from(select.options).some(o => o.value === oldValue)) {
    select.value = oldValue;
  } else {
    select.value = "";
  }
  
  // إعادة تعيين الشفافية بعد الانتهاء
  setTimeout(() => {
    select.style.opacity = '1';
  }, 50);
}

function snapshotChosen(selects) {
  const values = selects.map(s => s.value || "");
  const chosenSet = new Set(values.filter(Boolean));
  return { chosenSet, values };
}

function refreshAllSelects(selects, N) {
  // إضافة تأثير انتقال سلس لتقليل الوميض
  selects.forEach(select => {
    select.style.transition = 'opacity 0.1s ease';
    select.style.opacity = '0.8';
  });
  
  const { chosenSet, values } = snapshotChosen(selects);
  selects.forEach((sel, idx) => buildOptions(sel, N, chosenSet, values[idx]));
  const allChosen = values.filter(Boolean).length === N && chosenSet.size === N;
  
  // إعادة تعيين الشفافية بعد الانتهاء
  setTimeout(() => {
    selects.forEach(select => {
      select.style.opacity = '1';
    });
  }, 50);
  
  if (continueBtn) {
    continueBtn.classList.toggle("hidden", !allChosen);
    continueBtn.disabled = !allChosen;
  }
}

// ✅ دالة لعرض شبكة البطاقات الصفراء مع 3 كروت لكل بطاقة
function renderCardSelectionGrid(slots) {
  if (!grid) return;
  
  // ✅ التأكد من تحميل الكروت المختارة من localStorage
  if (selectedCards.length === 0 && gameId) {
    const savedSelectedCardsKey = `${playerParam}SelectedCards_${gameId}`;
    const savedSelectedCards = localStorage.getItem(savedSelectedCardsKey);
    if (savedSelectedCards) {
      try {
        selectedCards = JSON.parse(savedSelectedCards);
        console.log(`✅ تم تحميل ${selectedCards.length} كرت مختار في renderCardSelectionGrid`);
        
        // ✅ تنظيف التكرارات عند التحميل
        if (Array.isArray(selectedCards) && selectedCards.length > 0) {
          const cleanedSelectedCards = [];
          const seenSlotIndices = new Set();
          const seenCardPaths = new Set();
          
          selectedCards.forEach(sc => {
            if (!sc || typeof sc !== 'object') return;
            
            const slotIndex = sc.slotIndex;
            const cardPath = sc.cardPath || sc;
            const normalizedCardPath = normalizeCardPath(cardPath);
            
            if (slotIndex === undefined || slotIndex === null || !cardPath || !normalizedCardPath) {
              return;
            }
            
            if (!seenSlotIndices.has(slotIndex) && !seenCardPaths.has(normalizedCardPath)) {
              cleanedSelectedCards.push(sc);
              seenSlotIndices.add(slotIndex);
              seenCardPaths.add(normalizedCardPath);
            }
          });
          
          if (cleanedSelectedCards.length !== selectedCards.length) {
            console.log(`🧹 تم تنظيف ${selectedCards.length - cleanedSelectedCards.length} كرت مكرر في renderCardSelectionGrid`);
            selectedCards = cleanedSelectedCards;
            localStorage.setItem(savedSelectedCardsKey, JSON.stringify(selectedCards));
          }
        }
      } catch (e) {
        console.error('❌ خطأ في تحميل الكروت المختارة في renderCardSelectionGrid:', e);
      }
    }
  }
  
  console.log(`✅ renderCardSelectionGrid: ${selectedCards.length} كرت مختار من ${slots.length} بطاقة صفراء`);
  
  grid.innerHTML = "";
  grid.style.opacity = '0.7';
  grid.style.transition = 'opacity 0.2s ease';
  grid.style.direction = 'ltr'; // ✅ الأرقام تبدأ من اليسار
  
  // تحديث النص
  if (instruction) {
    const selectedCount = selectedCards.length;
    const remaining = rounds - selectedCount;
    if (selectedCount > 0) {
      instruction.textContent = `اختر ${remaining} كرت إضافي${remaining > 1 ? 'ات' : ''} (${selectedCount}/${rounds})`;
    } else {
      instruction.textContent = `اختر ${rounds} كرت للبدء`;
    }
  }
  
  // عرض 20 بطاقة صفراء
  for (let i = 0; i < Math.min(20, slots.length); i++) {
    const slot = slots[i];
    if (!slot || slot.length < 3) continue;
    
    const wrapper = document.createElement("div");
    wrapper.className = "card-selection-slot";
    wrapper.textContent = i + 1; // ✅ رقم البطاقة مباشرة في العنصر (مثل cards-setup.html)
    
    // التحقق من اختيار البطاقة
    const isSelected = selectedCards.some(sc => sc.slotIndex === i);
    if (isSelected) {
      wrapper.classList.add('selected');
      wrapper.style.cursor = 'not-allowed';
      wrapper.onclick = null;
      wrapper.style.pointerEvents = 'none';
    } else {
      // ✅ السماح بالنقر فقط على البطاقات غير المختارة
      wrapper.onclick = () => {
        // حفظ آخر بطاقة مفتوحة
        saveLastOpenSlot(i);
        openCardSelectionModal(i, slot);
      };
    }
    
    grid.appendChild(wrapper);
  }
  
  // إعادة تعيين الشفافية
  setTimeout(() => {
    grid.style.opacity = '1';
  }, 50);
  
  // ✅ عرض الكروت المختارة في الأسفل
  renderSelectedCards();
  
  // تحديث حالة زر المتابعة
  if (continueBtn) {
    if (selectedCards.length >= rounds) {
      continueBtn.classList.remove("hidden");
      continueBtn.disabled = false;
      continueBtn.textContent = "متابعة للترتيب";
    } else {
      continueBtn.classList.add("hidden");
    }
  }
}

// ✅ دالة لعرض الكروت المختارة في الأسفل بجانب بعضها
function renderSelectedCards() {
  const selectedCardsSection = document.getElementById('selectedCardsSection');
  const selectedCardsContainer = document.getElementById('selectedCardsContainer');
  
  if (!selectedCardsSection || !selectedCardsContainer) return;
  
  // ✅ إخفاء القسم إذا اكتمل الاختيار (انتقلنا لمرحلة الترتيب)
  if (!isSelectionPhase || selectedCards.length >= rounds) {
    selectedCardsSection.classList.add('hidden');
    return;
  }
  
  // إظهار القسم إذا كان هناك كروت مختارة ولم يكتمل الاختيار
  if (selectedCards.length > 0) {
    selectedCardsSection.classList.remove('hidden');
    selectedCardsContainer.innerHTML = '';
    
    // ترتيب الكروت حسب slotIndex
    const sortedSelectedCards = [...selectedCards].sort((a, b) => a.slotIndex - b.slotIndex);
    
    sortedSelectedCards.forEach((selectedCard, index) => {
      const cardWrapper = document.createElement('div');
      cardWrapper.className = 'selected-card-wrapper';
      cardWrapper.style.cssText = `
        position: relative;
        width: 120px;
        height: 168px;
        border: none;
        border-radius: 8px;
        overflow: hidden;
        cursor: pointer;
        transition: all 0.3s ease;
        background: rgba(0, 0, 0, 0.5);
        animation: slideInUp 0.3s ease ${index * 0.05}s backwards;
      `;
      
      // تأثير hover
      cardWrapper.onmouseenter = () => {
        cardWrapper.style.transform = 'scale(1.1) translateY(-5px)';
        cardWrapper.style.boxShadow = '0 8px 25px rgba(255, 215, 0, 0.5)';
      };
      cardWrapper.onmouseleave = () => {
        cardWrapper.style.transform = 'scale(1) translateY(0)';
        cardWrapper.style.boxShadow = 'none';
      };
      
      // الكرت
      const cardMedia = createMedia(selectedCard.cardPath, "w-full h-full object-contain");
      cardWrapper.appendChild(cardMedia);
      
      selectedCardsContainer.appendChild(cardWrapper);
    });
  } else {
    selectedCardsSection.classList.add('hidden');
  }
}

// ✅ دالة لفتح modal اختيار الكرت (3 كروت لكل بطاقة)
async function openCardSelectionModal(slotIndex, slotCards) {
  // ✅ التحقق من أن البطاقة لم يتم اختيارها بالفعل - لا يمكن تغييرها
  const existingSelection = selectedCards.find(sc => sc.slotIndex === slotIndex);
  if (existingSelection) {
    // لا يمكن تغيير أو إلغاء الاختيار
    alert('هذه البطاقة تم اختيارها بالفعل ولا يمكن تغييرها');
    return;
  }
  
  // التحقق من العدد المطلوب
  if (selectedCards.length >= rounds) {
    alert(`لقد اخترت بالفعل ${rounds} كرت. يرجى الضغط على "متابعة للترتيب"`);
    return;
  }
  
  // ✅ استبعاد الكروت التي اختارها اللاعب الآخر من slotCards
  let availableSlotCards = [...slotCards];
  if (gameId) {
    try {
      // تحديد اللاعب الآخر
      const otherPlayer = player === "1" ? 2 : 1;
      const otherPlayerParam = otherPlayer === 1 ? 'player1' : 'player2';
      
      // جلب الكروت المختارة من اللاعب الآخر
      let opponentSelectedCards = [];
      
      // من Firebase
      try {
        const gameData = await GameService.getGame(gameId);
        const otherPlayerData = gameData[`player${otherPlayer}`];
        if (otherPlayerData && otherPlayerData.cards && Array.isArray(otherPlayerData.cards)) {
          opponentSelectedCards = otherPlayerData.cards;
        }
      } catch (e) {
        console.warn('⚠️ خطأ في جلب الكروت المختارة من Firebase:', e);
      }
      
      // من localStorage
      const otherPlayerSelectedCardsKey = `${otherPlayerParam}SelectedCards_${gameId}`;
      const otherPlayerSelectedCardsGameId = localStorage.getItem(`${otherPlayerParam}SelectedCards_GameId`);
      if (otherPlayerSelectedCardsGameId === gameId) {
        const savedSelectedCards = localStorage.getItem(otherPlayerSelectedCardsKey);
        if (savedSelectedCards) {
          try {
            const parsed = JSON.parse(savedSelectedCards);
            const selectedCardPaths = parsed.map(sc => sc.cardPath || sc).filter(card => card);
            opponentSelectedCards.push(...selectedCardPaths);
          } catch (e) {
            console.warn('⚠️ خطأ في تحميل selectedCards للاعب الآخر');
          }
        }
      }
      
      // ✅ إزالة التكرارات من opponentSelectedCards
      const uniqueOpponentSelectedCards = [...new Set(opponentSelectedCards)];
      
      // ✅ استبعاد الكروت المختارة من اللاعب الآخر من slotCards المتاحة
      if (uniqueOpponentSelectedCards.length > 0) {
        const normalizedOpponentCards = uniqueOpponentSelectedCards.map(c => normalizeCardPath(c));
        availableSlotCards = slotCards.filter(card => {
          const normalizedCard = normalizeCardPath(card);
          return !normalizedOpponentCards.includes(normalizedCard);
        });
        
        if (availableSlotCards.length < slotCards.length) {
          const removedCount = slotCards.length - availableSlotCards.length;
          console.log(`✅ تم استبعاد ${removedCount} كرت مختارة من اللاعب الآخر من slotCards`);
        }
      }
      
      // ✅ إذا لم تبق كروت متاحة، عرض رسالة خطأ
      if (availableSlotCards.length === 0) {
        alert('⚠️ جميع الكروت في هذه البطاقة تم اختيارها من قبل اللاعب الآخر. يرجى اختيار بطاقة أخرى.');
        return;
      }
      
    } catch (e) {
      console.warn('⚠️ خطأ في استبعاد الكروت المختارة من اللاعب الآخر:', e);
      // في حالة الخطأ، نستخدم slotCards الأصلية
      availableSlotCards = slotCards;
    }
  }
  
  // إنشاء modal احترافي
  const modal = document.createElement('div');
  modal.className = 'card-selection-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    backdrop-filter: blur(10px);
    animation: fadeIn 0.3s ease;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: linear-gradient(145deg, #2d2d2d, #1a1a1a);
    border: 3px solid #FFD700;
    border-radius: 20px;
    padding: 30px;
    max-width: 90%;
    width: 600px;
    box-shadow: 0 10px 40px rgba(255, 215, 0, 0.3);
    animation: slideUp 0.3s ease;
  `;
  
  const title = document.createElement('h2');
  title.textContent = `اختر كرت واحد للبطاقة ${slotIndex + 1}`;
  title.style.cssText = `
    color: #FFD700;
    font-size: 24px;
    font-weight: bold;
    text-align: center;
    margin-bottom: 25px;
    font-family: "Cairo", sans-serif;
  `;
  
  const cardsContainer = document.createElement('div');
  cardsContainer.style.cssText = `
    display: flex;
    gap: 20px;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 20px;
  `;
  
  // ✅ عرض الكروت المتاحة فقط (بعد استبعاد الكروت المختارة من اللاعب الآخر)
  if (availableSlotCards.length === 0) {
    // إذا لم تبق كروت متاحة، عرض رسالة
    const message = document.createElement('div');
    message.textContent = '⚠️ جميع الكروت في هذه البطاقة تم اختيارها من قبل اللاعب الآخر';
    message.style.cssText = `
      color: #ff6b6b;
      text-align: center;
      padding: 20px;
      font-size: 18px;
    `;
    modalContent.appendChild(title);
    modalContent.appendChild(message);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // إغلاق modal تلقائياً بعد 2 ثانية
    setTimeout(() => {
      if (document.body.contains(modal)) {
        document.body.removeChild(modal);
      }
    }, 2000);
    return;
  }
  
  // ✅ عرض الكروت المتاحة فقط
  availableSlotCards.forEach((cardPath, index) => {
    const cardOption = document.createElement('div');
    cardOption.className = 'card-option';
    cardOption.dataset.path = cardPath;
    cardOption.style.cssText = `
      width: 150px;
      height: 210px;
      border: 3px solid transparent;
      border-radius: 12px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
      background: #1a1a1a;
    `;
    
    const cardImg = createMedia(cardPath, "w-full h-full object-contain");
    cardOption.appendChild(cardImg);
    
    // تأثير hover
    cardOption.onmouseenter = () => {
      cardOption.style.transform = 'scale(1.1)';
      cardOption.style.borderColor = '#FFD700';
      cardOption.style.boxShadow = '0 8px 25px rgba(255, 215, 0, 0.5)';
    };
    cardOption.onmouseleave = () => {
      cardOption.style.transform = 'scale(1)';
      cardOption.style.borderColor = 'transparent';
      cardOption.style.boxShadow = 'none';
    };
    
    // حدث النقر
    cardOption.onclick = async () => {
      // ✅ فحص قوي لمنع التكرار قبل الإضافة
      const normalizedCardPath = normalizeCardPath(cardPath);
      
      // التحقق من عدم وجود نفس slotIndex
      const existingSlot = selectedCards.find(sc => sc.slotIndex === slotIndex);
      if (existingSlot) {
        console.error(`❌ تكرار: slotIndex ${slotIndex} تم اختياره مسبقاً`);
        alert('هذه البطاقة تم اختيارها بالفعل');
        return;
      }
      
      // التحقق من عدم وجود نفس cardPath (مطبق بشكل تطبيعي) في أي slot آخر
      const existingCard = selectedCards.find(sc => {
        const normalizedExisting = normalizeCardPath(sc.cardPath);
        return normalizedExisting && normalizedCardPath && normalizedExisting === normalizedCardPath;
      });
      
      if (existingCard) {
        console.error(`❌ تكرار: الكرت ${cardPath} تم اختياره مسبقاً في slot ${existingCard.slotIndex}`);
        alert(`⚠️ هذا الكرت تم اختياره مسبقاً في بطاقة أخرى. يرجى اختيار كرت مختلف.`);
        return;
      }
      
      // ✅ التحقق من صحة البيانات قبل الإضافة
      if (!normalizedCardPath || !cardPath) {
        console.error('❌ كرت غير صالح:', cardPath);
        alert('⚠️ خطأ: كرت غير صالح. يرجى المحاولة مرة أخرى.');
        return;
      }
      
      // ✅ حفظ الاختيار بعد التحقق من عدم وجود تكرار
      selectedCards.push({
        slotIndex: slotIndex,
        cardPath: cardPath
      });
      
      console.log(`✅ تم اختيار كرت ${cardPath} للبطاقة ${slotIndex + 1} (إجمالي: ${selectedCards.length}/${rounds})`);
      
      // ✅ فحص نهائي للتأكد من عدم وجود تكرار بعد الإضافة
      const finalNormalized = selectedCards.map(sc => normalizeCardPath(sc.cardPath || sc)).filter(n => n !== null);
      const finalUnique = new Set(finalNormalized);
      if (finalNormalized.length !== finalUnique.size) {
        console.error('❌ تم اكتشاف تكرار بعد الإضافة - إزالة التكرار');
        // إزالة التكرارات
        const uniqueSelectedCards = [];
        const seenNormalized = new Set();
        const seenSlotIndices = new Set();
        
        selectedCards.forEach(sc => {
          const normalized = normalizeCardPath(sc.cardPath || sc);
          if (normalized && !seenNormalized.has(normalized) && !seenSlotIndices.has(sc.slotIndex)) {
            seenNormalized.add(normalized);
            seenSlotIndices.add(sc.slotIndex);
            uniqueSelectedCards.push(sc);
          }
        });
        
        selectedCards = uniqueSelectedCards;
        console.log(`🧹 تم تنظيف التكرار - الكروت المتبقية: ${selectedCards.length}`);
      }
      
      // ✅ حفظ مع gameId لتجنب التضارب بين الألعاب
      const savedSelectedCardsKey = `${playerParam}SelectedCards_${gameId}`;
      localStorage.setItem(savedSelectedCardsKey, JSON.stringify(selectedCards));
      localStorage.setItem(`${playerParam}SelectedCards_GameId`, gameId);
      
      // ✅ حفظ الكروت المختارة في Firebase مباشرة بعد الاختيار (لضمان استبعادها للاعب الآخر)
      if (gameId) {
        try {
          const selectedCardPaths = selectedCards.map(sc => sc.cardPath || sc).filter(card => card);
          await GameService.savePlayerCards(gameId, player, selectedCardPaths);
          console.log(`✅ تم حفظ ${selectedCardPaths.length} كرت مختارة في Firebase للاعب ${player}`);
        } catch (e) {
          console.warn('⚠️ خطأ في حفظ الكروت المختارة في Firebase:', e);
        }
      }
      
      // ✅ تم الاختيار — لا نحتاج إعادة فتح popup بعد الآن
      clearLastOpenSlot();
      
      // ✅ حفظ حالة isSelectionPhase
      localStorage.setItem(`${playerParam}IsSelectionPhase_${gameId}`, JSON.stringify(isSelectionPhase));
      
      // إغلاق modal
      document.body.removeChild(modal);
      
      // ✅ إعادة عرض الشبكة والكروت المختارة
      renderCardSelectionGrid(cardSlots);
      
      // إذا تم جمع العدد المطلوب، الانتقال لمرحلة الترتيب
      if (selectedCards.length >= rounds) {
        isSelectionPhase = false;
        picks = selectedCards.map(sc => sc.cardPath);
        // ✅ حفظ حالة isSelectionPhase بعد الانتقال لمرحلة الترتيب
        localStorage.setItem(`${playerParam}IsSelectionPhase_${gameId}`, JSON.stringify(false));
        localStorage.setItem(PICKS_LOCAL_KEY, JSON.stringify(picks));
        
        // ✅ إخفاء الكروت المختارة عند اكتمال الاختيار
        renderSelectedCards();
        
        // ✅ حفظ علامة أن اللاعب أنهى اختيار الكروت في Firebase (لإظهار رابط اللاعب الثاني)
        if (gameId && playerParam === 'player1') {
          try {
            // حفظ علامة في Firebase أن اللاعب الأول أنهى اختيار الكروت
            await GameService.savePlayerCardsSelected(gameId, 1, true);
            console.log('✅ تم حفظ علامة اكتمال اختيار الكروت للاعب الأول في Firebase');
          } catch (e) {
            console.error('❌ خطأ في حفظ علامة اختيار الكروت:', e);
          }
          
          // ✅ حفظ في localStorage كبديل
          localStorage.setItem(`${gameId}_player1_cardsSelected`, 'true');
        }
        
        renderCards(picks);
        if (instruction) {
          instruction.textContent = `اللاعب ${playerName} رتب بطاقاتك`;
        }
        if (continueBtn) {
          continueBtn.classList.remove("hidden");
          continueBtn.disabled = false;
          continueBtn.textContent = "متابعة";
        }
      }
    };
    
    cardsContainer.appendChild(cardOption);
  });
  
  // ✅ لا يوجد زر إلغاء - يجب اختيار كرت
  
  modalContent.appendChild(title);
  modalContent.appendChild(cardsContainer);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // ✅ منع إغلاق modal عند النقر خارجها - يجب اختيار كرت
  // لا يوجد معالج onClick لـ modal - يجب اختيار كرت لإغلاق modal
}

// إضافة أنيميشن CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes slideUp {
    from { transform: translateY(50px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;
document.head.appendChild(style);

function renderCards(pickList, lockedOrder = null) {
  if (!grid) return;
  
  // إضافة تأثير انتقال سلس لتقليل الوميض
  grid.style.opacity = '0.7';
  grid.style.transition = 'opacity 0.2s ease';
  grid.style.direction = 'rtl'; // ✅ إعادة الاتجاه الأصلي عند عرض البطاقات المختارة
  
  // مسح المحتوى الحالي
  grid.innerHTML = "";
  
  const display = (Array.isArray(lockedOrder) && lockedOrder.length === pickList.length) ? lockedOrder : pickList;
  const selects = [];
  
  display.forEach((url) => {
    const wrapper = document.createElement("div");
    wrapper.className = "flex flex-col items-center space-y-2";

    // Media + shield wrapper (prevents right-click/drag and hides URL affordances)
    const mediaWrap = document.createElement("div");
    mediaWrap.className = "nosave";
    const media = createMedia(url, "w-36 h-48 object-contain rounded shadow");
    const shield = document.createElement("div");
    shield.className = "shield";
    mediaWrap.appendChild(media);
    mediaWrap.appendChild(shield);

    const select = document.createElement("select");
    select.className = "w-24 p-1 rounded bg-gray-800 text-white text-center text-lg orderSelect";
    const def = document.createElement("option"); 
    def.value = ""; 
    def.textContent = "-- الترتيب --"; 
    select.appendChild(def);

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

    wrapper.appendChild(mediaWrap);
    wrapper.appendChild(select);
    grid.appendChild(wrapper);
    selects.push(select);
  });

  // إعادة تعيين الشفافية بعد الانتهاء
  setTimeout(() => {
    grid.style.opacity = '1';
  }, 50);

  if (Array.isArray(lockedOrder) && lockedOrder.length === pickList.length) {
    if (continueBtn) {
      continueBtn.classList.add("hidden");
    }
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

/* ================== Mobile Number Selection ================== */
function checkArrangementComplete() {
  if (continueBtn) {
    continueBtn.classList.remove("hidden");
    continueBtn.disabled = false;
    continueBtn.textContent = "متابعة";
  }
}

/* ================== Submit Ordered Picks ================== */
async function submitPicks() {
  // ✅ إذا كان في مرحلة الاختيار، الانتقال لمرحلة الترتيب
  if (isSelectionPhase && selectedCards.length >= rounds) {
    isSelectionPhase = false;
    picks = selectedCards.map(sc => sc.cardPath);
    renderCards(picks);
    if (instruction) {
      instruction.textContent = `اللاعب ${playerName} رتب بطاقاتك`;
    }
    if (continueBtn) {
      continueBtn.textContent = "متابعة";
    }
    return;
  }
  
  if (!picks.length) return;

  if (Array.isArray(submittedOrder) && submittedOrder.length === picks.length) {
    console.log(`⚠️ اللاعب ${playerParam} حاول إرسال ترتيب مرسل بالفعل`);
    return;
  }

  // Tournament mode - skip authentication
  if (isTournament) {
    console.log('Tournament mode - submitting picks without authentication');
    await submitTournamentPicks();
    return;
  }

  // Regular challenge mode - require authentication
  const user = auth.currentUser;
  if (!user) {
    alert("الرجاء تسجيل الدخول أولاً");
    return;
  }

  // حماية إضافية: تحقق من أن هذا اللاعب لم يرسل الترتيب مؤخراً
  const lastSubmitTime = localStorage.getItem(LAST_SUBMIT_TIME_KEY);
  const currentTime = Date.now();
  if (lastSubmitTime && (currentTime - parseInt(lastSubmitTime)) < 2000) {
    console.log(`⚠️ تجاهل إرسال متكرر للاعب ${playerParam} - تم الإرسال مؤخراً`);
    return;
  }

  // Process ordering based on device type
  let ordered = [];
  
  if (isMobile) {
    // For mobile, use dropdown selection (same as desktop for consistency)
    const dropdowns = document.querySelectorAll(".orderSelect");
    const values = dropdowns.length
      ? Array.from(dropdowns).map((s) => parseInt(s.value, 10))
      : [];

    const inRange = values.every(v => Number.isInteger(v) && v >= 1 && v <= picks.length);
    if (!inRange || new Set(values).size !== picks.length) {
      alert("يرجى ترتيب كل البطاقات بدون تكرار وضمن النطاق الصحيح.");
      return;
    }

    // Create ordered array based on dropdown selections
    ordered = new Array(picks.length);
    for (let i = 0; i < values.length; i++) {
      const orderIndex = values[i] - 1;
      ordered[orderIndex] = picks[i];
      console.log(`Card ${i + 1} (${picks[i]}) placed at position ${orderIndex + 1}`);
    }
    console.log('Final ordered array:', ordered);
  } else {
    // For desktop dropdown selection, validate and process dropdowns
    const dropdowns = document.querySelectorAll(".orderSelect");
    const values = dropdowns.length
      ? Array.from(dropdowns).map((s) => parseInt(s.value, 10))
      : [];

    const inRange = values.every(v => Number.isInteger(v) && v >= 1 && v <= picks.length);
    if (!inRange || new Set(values).size !== picks.length) {
      alert("يرجى ترتيب كل البطاقات بدون تكرار وضمن النطاق الصحيح.");
      return;
    }

    ordered = new Array(picks.length);
    for (let i = 0; i < values.length; i++) {
      const orderIndex = values[i] - 1;
      ordered[orderIndex] = picks[i];
      console.log(`Card ${i + 1} (${picks[i]}) placed at position ${orderIndex + 1}`);
    }
    console.log('Final ordered array (desktop):', ordered);
  }

  try {
    // إظهار loading
    if (continueBtn) {
      continueBtn.disabled = true;
      continueBtn.textContent = 'جاري إرسال الترتيب...';
    }
    
    // Store submitted order in localStorage (following order.js pattern) - فقط للاعب الحالي
    console.log(`💾 حفظ ترتيب اللاعب ${playerParam} في localStorage`);
    localStorage.setItem(ORDER_LOCAL_KEY, JSON.stringify(ordered));
    
    // Store card arrangement for final-setup.html to detect (following order.js pattern)
    const playerKey = currentPlayer === 1 ? 'player1' : 'player2';
    localStorage.setItem(`${playerKey}CardArrangement`, JSON.stringify(ordered));
    localStorage.setItem(`${playerKey}ArrangementCompleted`, 'true');
    
    // Also store in the format expected by final-setup.html - فقط للاعب الحالي
    const currentGameSetup = JSON.parse(localStorage.getItem(GAME_SETUP_KEY) || '{}');
    const updatedGameSetup = {
      ...currentGameSetup,
      [playerKey]: {
        ...currentGameSetup[playerKey],
        selectedCards: ordered,
        arrangementCompleted: true
      }
    };
    // تحديث فقط بيانات اللاعب الحالي دون التأثير على اللاعب الآخر
    localStorage.setItem(GAME_SETUP_KEY, JSON.stringify(updatedGameSetup));
    
    // Store in gameState format as well
    const currentGameState = JSON.parse(localStorage.getItem(GAME_STATE_KEY) || '{}');
    const updatedGameState = {
      ...currentGameState,
      [playerKey]: {
        ...currentGameState[playerKey],
        selectedCards: ordered,
        arrangementCompleted: true
      }
    };
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(updatedGameState));
    
    // Store in StrategicOrdered format (for compatibility with card.js)
    localStorage.setItem(`${playerParam}StrategicOrdered`, JSON.stringify(ordered));
    localStorage.setItem(STRATEGIC_GAME_ID_KEY, gameId || 'default');
    localStorage.setItem(LAST_SUBMIT_TIME_KEY, Date.now().toString());
    
    // Dispatch custom event for host to listen (following order.js pattern)
    window.dispatchEvent(new CustomEvent('orderSubmitted', { 
      detail: { gameId, playerName, ordered } 
    }));
    
    // Save to Firebase if gameId is available
    if (gameId) {
      try {
        await GameService.saveCardOrder(gameId, player, ordered);
        localStorage.setItem(CURRENT_GAME_ID_KEY, gameId);
      } catch (e) {
        console.warn('Firebase save failed, but localStorage saved:', e);
      }
    }
    
    // Update submittedOrder immediately (like order.js) - فقط للاعب الحالي
    submittedOrder = ordered.slice();
    
    hideOpponentPanel();
    hidePlayerAbilitiesViewPanel();
    
    // Re-render cards immediately with submitted order (like order.js)
    // Ensure the order is displayed correctly
    console.log(`🎯 عرض ترتيب اللاعب ${playerParam}:`, submittedOrder);
    console.log('Submitted order length:', submittedOrder.length);
    console.log('Picks length:', picks.length);
    renderCards(submittedOrder, submittedOrder);
    
    // Update button state (like order.js)
    if (continueBtn) {
      continueBtn.disabled = true;
      continueBtn.textContent = '✅ تم إرسال الترتيب';
      continueBtn.classList.remove('hidden');
    }
    
    // Hide mobile instructions after submission
    const mobileInstructions = document.querySelector('.mobile-instructions');
    if (mobileInstructions) {
      mobileInstructions.remove();
    }
    
    // Show success message
    console.log('Order submitted successfully:', ordered);
    console.log('Submitted order length:', submittedOrder.length);
    console.log('Picks length:', picks.length);
    
    // Force a small delay to ensure UI updates
    setTimeout(() => {
      console.log('Final verification - submitted order:', submittedOrder);
      console.log('Final verification - picks:', picks);
    }, 100);
    
    // Success - no alert message needed
    
    // 🧠 الحل النهائي المضمون: إعادة تعيين isArranging بعد إرسال الترتيب
    isArranging = false;
    console.log("✅ تم إرسال الترتيب - السماح بالتحديثات الخارجية مرة أخرى");
    
  } catch (error) {
    console.error('Error saving card order:', error);
    alert('حدث خطأ في حفظ ترتيب البطاقات: ' + error.message);
    
    // 🧠 الحل النهائي المضمون: إعادة تعيين isArranging في حالة الخطأ أيضاً
    isArranging = false;
    console.log("❌ حدث خطأ - السماح بالتحديثات الخارجية مرة أخرى");
    
    // إعادة تفعيل الزر
    if (continueBtn) {
      continueBtn.disabled = false;
      continueBtn.textContent = 'متابعة';
    }
  }
}

window.submitPicks = submitPicks;

/* ================== Order.js Command Integration ================== */
// Function to be called from host page (card.html) following order.js pattern
window.arrangeCards = function(playerParam, gameId, playerName) {
  console.log(`Arranging cards for ${playerParam} in game ${gameId}`);
  
  // Update current player info
  if (playerParam === 'player1' || playerParam === 'player2') {
    currentPlayer = playerParam === 'player2' ? 2 : 1;
    window.playerParam = playerParam;
    window.gameId = gameId;
    window.playerName = playerName;
    
    // Update instruction
    if (instruction) {
      instruction.textContent = `اللاعب ${playerName} رتب بطاقاتك`;
    }
    
    // ✅ إعادة تحميل البطاقات مع حماية من التكرار
    if (!isLoadingPlayerCards) {
      loadPlayerCards();
    } else {
      console.log("⚠️ تجاهل إعادة تحميل البطاقات - التحميل قيد التنفيذ");
    }
  }
};

// Function to check arrangement status (for host monitoring)
window.getArrangementStatus = function() {
  return {
    isArranged: Array.isArray(submittedOrder) && submittedOrder.length === picks.length,
    order: submittedOrder,
    playerParam: playerParam,
    gameId: gameId,
    playerName: playerName
  };
};

// Function to reset arrangement (for new games) - فقط للاعب الحالي
window.resetArrangement = function() {
  console.log(`🔄 إعادة تعيين ترتيب اللاعب ${playerParam} فقط`);
  
  submittedOrder = null;
  picks = [];
  if (grid) {
    grid.innerHTML = '';
  }
  if (continueBtn) {
    continueBtn.classList.add('hidden');
    continueBtn.disabled = true;
    continueBtn.textContent = 'متابعة';
  }
  
  // 🧠 الحل النهائي المضمون: إعادة تعيين isArranging عند إعادة تعيين الترتيب
  isArranging = true;
  console.log("🔄 إعادة تعيين isArranging = true للعبة جديدة");
  
  // Clear localStorage - فقط للاعب الحالي
  localStorage.removeItem(ORDER_LOCAL_KEY);
  localStorage.removeItem(`${playerParam}StrategicOrdered`);
  localStorage.removeItem(STRATEGIC_GAME_ID_KEY);
  localStorage.removeItem(`${playerParam}CardArrangement`);
  localStorage.removeItem(`${playerParam}ArrangementCompleted`);
  
  console.log(`✅ تم إعادة تعيين ترتيب اللاعب ${playerParam} فقط`);
};

// Clear used abilities for new game
function clearUsedAbilities() {
  try {
    // Clear used abilities for both players
    localStorage.removeItem('player1UsedAbilities');
    localStorage.removeItem('player2UsedAbilities');
    localStorage.removeItem('usedAbilities');
    localStorage.removeItem('abilityRequests');
    
    // Reset ability usage in abilities lists
    const player1Abilities = JSON.parse(localStorage.getItem('player1Abilities') || '[]');
    const player2Abilities = JSON.parse(localStorage.getItem('player2Abilities') || '[]');
    
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
    
    // Reload abilities
    loadPlayerAbilities();
    loadOpponentAbilities();
  } catch (error) {
    console.error('Error clearing used abilities:', error);
  }
}

// Clear old game data when starting a new game
function clearOldGameData() {
  try {
    // Clear old card orders - فقط للاعب الحالي
    localStorage.removeItem(ORDER_LOCAL_KEY);
    localStorage.removeItem(`${playerParam}StrategicOrdered`);
    localStorage.removeItem(STRATEGIC_GAME_ID_KEY);
    localStorage.removeItem(LAST_LOAD_TIME_KEY);
    localStorage.removeItem(LAST_SUBMIT_TIME_KEY);
    
    // ✅ مسح الكروت المختارة القديمة
    const oldSelectedCardsKey = `${playerParam}SelectedCards`;
    localStorage.removeItem(oldSelectedCardsKey);
    localStorage.removeItem(`${playerParam}SelectedCards_GameId`);
    
    // ✅ مسح cardSlots القديمة للاعب الحالي
    localStorage.removeItem(`${playerParam}CardSlots`);
    localStorage.removeItem(`${playerParam}CardSlots_GameId`);
    
    // مسح الكروت المختارة لجميع الألعاب (تنظيف شامل)
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(`${playerParam}SelectedCards_`)) {
        localStorage.removeItem(key);
      }
    });
    
    // Reset selectedCards
    selectedCards = [];
    isSelectionPhase = true;
    
    // Clear old game ID
    localStorage.removeItem(CURRENT_GAME_ID_KEY);
    
    // Reset submitted order
    submittedOrder = null;
    
    // 🧠 الحل النهائي المضمون: إعادة تعيين isArranging عند مسح البيانات القديمة
    isArranging = true;
    console.log("🔄 إعادة تعيين isArranging = true عند مسح البيانات القديمة");
    
    console.log(`🧹 تم مسح البيانات القديمة للاعب ${playerParam}`);
  } catch (error) {
    console.error('Error clearing old game data:', error);
  }
}

// ✅ معالج visibilitychange لإعادة التحميل عند العودة للصفحة (مهم للهواتف)
document.addEventListener('visibilitychange', function() {
  if (!document.hidden) {
    console.log('📱 الصفحة ظاهرة مرة أخرى - إعادة تحميل القدرات (للهواتف)');
    
    // ✅ تحميل فوري للقدرات
    setTimeout(() => {
      loadPlayerAbilities();
      loadOpponentAbilities();
      checkAbilityRequests();
    }, 100);
    
    // ✅ تحميل إضافي بعد ثانية
    setTimeout(() => {
      loadPlayerAbilities();
      loadOpponentAbilities();
      checkAbilityRequests();
    }, 1000);
  }
});

// Initialize card manager when page loads - مع حماية من التكرار
let isInitialized = false;
document.addEventListener('DOMContentLoaded', function() {
  // ✅ حماية: منع التهيئة المكررة
  if (isInitialized) {
    console.log("⚠️ تم التهيئة بالفعل - تجاهل التهيئة المكررة");
    return;
  }
  isInitialized = true;
  
  // Show home button in tournament mode
  const isTournament = localStorage.getItem('currentMatchId') !== null;
  const homeBtn = document.getElementById('homeBtn');
  if (homeBtn && isTournament) {
    homeBtn.style.display = 'flex';
  }
  
  initializeCardManager();
  
  // Check for ability requests every 1 second for faster response
  setInterval(checkAbilityRequests, 1000);
  
  // Listen for storage changes - مع حماية من التكرار
  window.addEventListener('storage', function(e) {
    // ✅ حماية: تجاهل التغييرات للاعب الآخر
    if (e.key && e.key.includes('player') && !e.key.includes(playerParam)) {
      const otherPlayerParam = playerParam === 'player1' ? 'player2' : 'player1';
      if (e.key.includes(otherPlayerParam)) {
        console.log(`🚫 تجاهل تغيير storage للاعب الآخر: ${e.key}`);
        return;
      }
    }
    
    if (e.key === 'abilityRequests') {
      checkAbilityRequests();
    } else if (e.key && e.key.endsWith('UsedAbilities')) {
      // Handle ability usage changes from host
      const playerParamFromKey = e.key.replace('UsedAbilities', '');
      // ✅ حماية قوية: التحقق من أن التغيير للاعب الحالي فقط
      if (playerParamFromKey === playerParam) {
        console.log(`Received ability usage change via storage: ${e.key}`);
        
        // Reload abilities to sync with host changes
        setTimeout(() => {
          console.log('Reloading abilities due to host changes...');
          loadPlayerAbilities();
        }, 100);
      } else {
        console.log(`🚫 تجاهل تغيير UsedAbilities للاعب الآخر: ${playerParamFromKey} (ليس ${playerParam})`);
      }
    }
  });
  
  // Listen for custom events
  window.addEventListener('forceAbilitySync', function() {
    checkAbilityRequests();
  });
  
  // Listen for ability toggle events from host
  window.addEventListener('abilityToggled', function(event) {
    const { playerParam: eventPlayerParam, abilityText, isUsed } = event.detail;
    
    // Only process if it's for this player
    if (eventPlayerParam === playerParam) {
      console.log(`Received ability toggle from host: ${abilityText} = ${isUsed}`);
      
      // Update local abilities
      if (myAbilities) {
        myAbilities.forEach(ability => {
          if (ability.text === abilityText) {
            ability.used = isUsed;
          }
        });
      }
      
      // Update temp used set
      if (isUsed) {
        tempUsed.add(abilityText);
      } else {
        tempUsed.delete(abilityText);
      }
      
      // Also update the used abilities in localStorage to match host
      const usedAbilitiesKey = `${playerParam}UsedAbilities`;
      const usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
      
      if (isUsed) {
        if (!usedAbilities.includes(abilityText)) {
          usedAbilities.push(abilityText);
        }
      } else {
        const filteredAbilities = usedAbilities.filter(ability => ability !== abilityText);
        usedAbilities.length = 0;
        usedAbilities.push(...filteredAbilities);
      }
      
      localStorage.setItem(usedAbilitiesKey, JSON.stringify(usedAbilities));
      
      // Update UI immediately
      if (abilitiesWrap) {
        renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
      }
      
      // Update status message
      if (abilityStatus) {
        if (isUsed) {
          abilityStatus.textContent = `✅ تم تفعيل ${abilityText} من قبل المضيف`;
        } else {
          abilityStatus.textContent = `🔄 تم إلغاء تفعيل ${abilityText} من قبل المضيف`;
        }
        
        // Reset status after 3 seconds
        setTimeout(() => {
          if (abilityStatus) {
            abilityStatus.textContent = "اضغط على القدرة لطلب استخدامها.";
          }
        }, 3000);
      }
    }
  });
  
  // Listen for postMessage from host
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'ABILITY_TOGGLED') {
      const { playerParam: eventPlayerParam, abilityText, isUsed } = event.data;
      
      // Only process if it's for this player
      if (eventPlayerParam === playerParam) {
        console.log(`Received ability toggle via postMessage: ${abilityText} = ${isUsed}`);
        
        // Update local abilities
        if (myAbilities) {
          myAbilities.forEach(ability => {
            if (ability.text === abilityText) {
              ability.used = isUsed;
            }
          });
        }
        
        // Update temp used set
        if (isUsed) {
          tempUsed.add(abilityText);
        } else {
          tempUsed.delete(abilityText);
        }
        
        // Also update the used abilities in localStorage to match host
        const usedAbilitiesKey = `${playerParam}UsedAbilities`;
        const usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
        
        if (isUsed) {
          if (!usedAbilities.includes(abilityText)) {
            usedAbilities.push(abilityText);
          }
        } else {
          const filteredAbilities = usedAbilities.filter(ability => ability !== abilityText);
          usedAbilities.length = 0;
          usedAbilities.push(...filteredAbilities);
        }
        
        localStorage.setItem(usedAbilitiesKey, JSON.stringify(usedAbilities));
        
        // Update UI immediately
        if (abilitiesWrap) {
          renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
        }
        
        // Update status message
        if (abilityStatus) {
          if (isUsed) {
            abilityStatus.textContent = `✅ تم تفعيل ${abilityText} من قبل المضيف`;
          } else {
            abilityStatus.textContent = `🔄 تم إلغاء تفعيل ${abilityText} من قبل المضيف`;
          }
          
          // Reset status after 3 seconds
          setTimeout(() => {
            if (abilityStatus) {
              abilityStatus.textContent = "اضغط على القدرة لطلب استخدامها.";
            }
          }, 3000);
        }
      }
    }
  });
  
  // Also check immediately on load
  setTimeout(checkAbilityRequests, 500);
  
  // Force immediate ability sync on page load
  setTimeout(() => {
    if (myAbilities && abilitiesWrap) {
      renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
      console.log('Forced ability UI refresh on page load');
    }
  }, 1000);
});

// ✅ مزامنة فورية لتغييرات ترتيب البطاقات والاختيارات - فقط للاعب الحالي
window.addEventListener('storage', function(e) {
  try {
    // فقط استمع للتغييرات الخاصة باللاعب الحالي
    if (e.key === ORDER_LOCAL_KEY || e.key === PICKS_LOCAL_KEY) {
      console.log(`🔄 فوراً: تغيير في ${e.key} للاعب الحالي ${playerParam}, إعادة تحميل البطاقات`);
      
      // ✅ تحقق شامل: التأكد من أن التغيير خاص باللاعب الحالي واللعبة الحالية
      const currentGameId = localStorage.getItem(CURRENT_GAME_ID_KEY);
      const keyPlayerParam = e.key.includes('player1') ? 'player1' : (e.key.includes('player2') ? 'player2' : null);
      
      // ✅ حماية قوية: تجاهل إذا لم يكن للاعب الحالي أو اللعبة الحالية
      if (keyPlayerParam && keyPlayerParam !== playerParam) {
        console.log(`🚫 تجاهل التغيير في ${e.key} - للاعب الآخر ${keyPlayerParam} (ليس ${playerParam})`);
        return;
      }
      
      if (currentGameId && gameId && currentGameId === gameId && !isLoadingPlayerCards) {
        // تأخير صغير لتجنب التداخل
        setTimeout(() => {
          if (!isLoadingPlayerCards) {
            loadPlayerCards();
          }
        }, 200);
      } else {
        if (isLoadingPlayerCards) {
          console.log(`⚠️ تجاهل التغيير في ${e.key} - التحميل قيد التنفيذ`);
        } else {
          console.log(`⚠️ تجاهل التغيير في ${e.key} - ليس للعبة الحالية`);
        }
      }
    }
    
    // تجاهل أي تغييرات أخرى في localStorage - حماية شاملة
    if (e.key && (e.key.includes('StrategicOrdered') || e.key.includes('CardArrangement') || e.key.includes('ArrangementCompleted'))) {
      // تحقق من أن التغيير ليس للاعب الحالي
      if (!e.key.includes(playerParam)) {
        console.log(`🚫 تجاهل التغيير في ${e.key} - ليس للاعب الحالي ${playerParam}`);
        return;
      }
    }
    
    // تجاهل أي تغييرات في مفاتيح اللاعب الآخر
    const otherPlayerParam = playerParam === 'player1' ? 'player2' : 'player1';
    if (e.key && e.key.includes(otherPlayerParam)) {
      console.log(`🚫 تجاهل التغيير في ${e.key} - للاعب الآخر ${otherPlayerParam}`);
      return;
    }
  } catch (err) {
    console.error("Error in immediate picks/order sync:", err);
  }
});

// ✅ استقبال رسائل مباشرة للترتيب (لو المضيف أرسلها)
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'ORDER_UPDATED') {
    // ✅ حماية: التحقق من أن الرسالة للاعب الحالي
    if (e.data.playerParam && e.data.playerParam !== playerParam) {
      console.log(`🚫 تجاهل ORDER_UPDATED - للاعب الآخر ${e.data.playerParam}`);
      return;
    }
    if (!isLoadingPlayerCards) {
      console.log("🔄 استلام ترتيب جديد عبر postMessage:", e.data);
      loadPlayerCards();
    }
  }
  if (e.data && e.data.type === 'PICKS_UPDATED') {
    // ✅ حماية: التحقق من أن الرسالة للاعب الحالي
    if (e.data.playerParam && e.data.playerParam !== playerParam) {
      console.log(`🚫 تجاهل PICKS_UPDATED - للاعب الآخر ${e.data.playerParam}`);
      return;
    }
    if (!isLoadingPlayerCards) {
      console.log("🔄 استلام اختيارات جديدة عبر postMessage:", e.data);
      loadPlayerCards();
    }
  }
});

// Open battle view for player
function openBattleView() {
  try {
    // Check if button is disabled
    const viewBattleBtn = document.getElementById('viewBattleBtn');
    if (viewBattleBtn && viewBattleBtn.disabled) {
      alert('المعركة لم تبدأ بعد. يرجى انتظار المضيف لبدء المعركة.');
      return;
    }
    
    // Get current game ID and player number
    const currentGameId = gameId || 'default';
    const playerNumber = player || '1';
    
    // Generate the player view URL
    const baseUrl = window.location.origin + window.location.pathname.replace('player-cards.html', '');
    const playerViewUrl = `${baseUrl}player-view.html?player=${playerNumber}&gameId=${currentGameId}`;
    
    console.log(`Opening battle view for player ${playerNumber}: ${playerViewUrl}`);
    
    // Open in new tab (not a separate window)
    const newWindow = window.open(playerViewUrl, '_blank');
    
    if (!newWindow) {
      alert('تم منع النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.');
      return;
    }
    
    // Focus the new window
    newWindow.focus();
    
    // Show success message
    showToast('تم فتح صفحة عرض التحدي بنجاح!', 'success');
    
  } catch (error) {
    console.error('Error opening battle view:', error);
    alert('حدث خطأ في فتح صفحة عرض التحدي: ' + error.message);
  }
}

// ✅ دالة تبديل حالة "تمام" للاعب
async function togglePlayerReady() {
  try {
    const currentGameId = localStorage.getItem('currentGameId') || gameId || 'default-game';
    
    if (!database || !currentGameId || !playerParam) {
      console.warn('⚠️ Firebase database أو gameId أو playerParam غير موجودين');
      return;
    }

    const readyRef = ref(database, `games/${currentGameId}/players/${playerParam}/ready`);
    
    // جلب الحالة الحالية
    const currentSnapshot = await get(readyRef);
    const currentReady = currentSnapshot.val() || false;
    const newReady = !currentReady;
    
    // تحديث الحالة في Firebase
    await set(readyRef, newReady);
    
    // ✅ تحديث الزر مباشرة (سيتم تحديثه تلقائياً أيضاً من المستمع)
    updateReadyButton(newReady);
    
    console.log(`✅ تم ${newReady ? 'تفعيل' : 'إلغاء'} حالة "تمام" للاعب ${playerParam}`);
    
  } catch (error) {
    console.error('❌ خطأ في تبديل حالة "تمام":', error);
  }
}

// ✅ تحميل حالة "تمام" الحالية وتحديث الزر
async function loadPlayerReadyState() {
  try {
    const currentGameId = localStorage.getItem('currentGameId') || gameId || 'default-game';
    
    if (!database || !currentGameId || !playerParam) {
      console.warn('⚠️ Firebase database أو gameId أو playerParam غير موجودين');
      return;
    }

    const readyRef = ref(database, `games/${currentGameId}/players/${playerParam}/ready`);
    const snapshot = await get(readyRef);
    const isReady = snapshot.val() || false;
    
    // تحديث الزر
    updateReadyButton(isReady);
    
    console.log(`✅ تم تحميل حالة "تمام" للاعب ${playerParam}:`, isReady);
    
  } catch (error) {
    console.error('❌ خطأ في تحميل حالة "تمام":', error);
  }
}

// ✅ تحديث زر "تمام" بناءً على الحالة
function updateReadyButton(isReady) {
  const confirmReadyBtn = document.getElementById('confirmReadyBtn');
  if (confirmReadyBtn) {
    if (isReady) {
      confirmReadyBtn.textContent = '❌ إلغاء تمام';
      confirmReadyBtn.className = confirmReadyBtn.className.replace('bg-green-600 hover:bg-green-700', 'bg-red-600 hover:bg-red-700');
    } else {
      confirmReadyBtn.textContent = '✅ تمام';
      confirmReadyBtn.className = confirmReadyBtn.className.replace('bg-red-600 hover:bg-red-700', 'bg-green-600 hover:bg-green-700');
    }
  }
}

// ✅ مستمع لتغييرات حالة "تمام" من Firebase
function startPlayerReadyListener() {
  if (!database || !gameId || !playerParam) {
    console.warn('⚠️ Firebase database أو gameId أو playerParam غير موجودين - لن يتم تشغيل مستمع حالة "تمام"');
    return;
  }

  try {
    const currentGameId = localStorage.getItem('currentGameId') || gameId || 'default-game';
    const readyRef = ref(database, `games/${currentGameId}/players/${playerParam}/ready`);
    
    console.log('✅ بدء الاستماع لتغييرات حالة "تمام" من Firebase:', `games/${currentGameId}/players/${playerParam}/ready`);
    
    // ✅ الاستماع لتغييرات حالة "تمام" باستخدام onValue
    onValue(readyRef, (snapshot) => {
      const isReady = snapshot.val() || false;
      console.log(`🔔 تغيير في حالة "تمام" للاعب ${playerParam}:`, isReady);
      
      // ✅ تحديث الزر تلقائياً
      updateReadyButton(isReady);
      
      console.log(`✅ تم تحديث زر "تمام" للاعب ${playerParam}:`, isReady ? 'تمام' : 'غير تمام');
    }, (error) => {
      console.error('❌ خطأ في مستمع حالة "تمام":', error);
    });
    
    console.log('✅ مستمع حالة "تمام" من Firebase نشط');
  } catch (error) {
    console.error('❌ خطأ في بدء مستمع حالة "تمام" من Firebase:', error);
  }
}

// جعل الدالة متاحة عالمياً
window.togglePlayerReady = togglePlayerReady;

// Check battle status and enable/disable battle view button
function checkBattleStatus() {
  try {
    const viewBattleBtn = document.getElementById('viewBattleBtn');
    if (!viewBattleBtn) return;
    
    // Check if battle has started by looking for battle started flag
    const battleStarted = localStorage.getItem('battleStarted') === 'true';
    
    if (battleStarted) {
      // Enable button
      viewBattleBtn.disabled = false;
      viewBattleBtn.className = "bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg text-xl font-bold shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95";
      viewBattleBtn.textContent = "عرض التحدي";
      console.log('Battle view button enabled');
    } else {
      // Keep disabled
      viewBattleBtn.disabled = true;
      viewBattleBtn.className = "bg-gray-500 text-gray-300 px-8 py-3 rounded-lg text-xl font-bold shadow-lg cursor-not-allowed opacity-50";
      viewBattleBtn.textContent = "عرض التحدي";
      console.log('Battle view button disabled');
    }
  } catch (error) {
    console.error('Error checking battle status:', error);
  }
}

// Start monitoring battle status
function startBattleStatusMonitoring() {
  // Check initially
  checkBattleStatus();
  
  // Listen for localStorage changes
  window.addEventListener('storage', function(e) {
    if (e.key === 'battleStarted') {
      checkBattleStatus();
    }
    
    // Listen for host notifications
    if (e.key === 'playerNotification') {
      try {
        const notification = JSON.parse(e.newValue || '{}');
        if (notification.type === 'ability_toggle' && notification.playerParam === playerParam) {
          console.log('Host toggled ability:', notification);
          
          // Update ability state immediately
          const abilityIndex = myAbilities.findIndex(ab => ab.text === notification.abilityText);
          if (abilityIndex !== -1) {
            myAbilities[abilityIndex].used = notification.isUsed;
            console.log(`Ability "${notification.abilityText}" set to used: ${notification.isUsed}`);
            
            // Re-render abilities
            if (abilitiesWrap) {
              renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
            }
            
            // Update status message
            if (abilityStatus) {
              if (notification.isUsed) {
                abilityStatus.textContent = "القدرة مستخدمة - انتظر إعادة التفعيل من المضيف";
                abilityStatus.style.color = "#ff6b35";
              } else {
                abilityStatus.textContent = "اضغط على القدرة لطلب استخدامها. سيتم إشعار المستضيف.";
                abilityStatus.style.color = "#32c675";
              }
            }
          }
        }
      } catch (error) {
        console.error('Error handling player notification:', error);
      }
    }
  });
  
  // Check periodically
  setInterval(checkBattleStatus, 2000);
  
  // Initialize BroadcastChannel if available
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      window.broadcastChannel = new BroadcastChannel('ability-updates');
      window.broadcastChannel.onmessage = function(event) {
        const notification = event.data;
        if (notification.type === 'ability_toggle' && notification.playerParam === playerParam) {
          console.log('BroadcastChannel notification received:', notification);
          
          // Update ability state immediately
          const abilityIndex = myAbilities.findIndex(ab => ab.text === notification.abilityText);
          if (abilityIndex !== -1) {
            myAbilities[abilityIndex].used = notification.isUsed;
            console.log(`Ability "${notification.abilityText}" set to used: ${notification.isUsed}`);
            
            // Re-render abilities
            if (abilitiesWrap) {
              renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
            }
            
            // Update status message
            if (abilityStatus) {
              if (notification.isUsed) {
                abilityStatus.textContent = "القدرة مستخدمة - انتظر إعادة التفعيل من المضيف";
                abilityStatus.style.color = "#ff6b35";
              } else {
                abilityStatus.textContent = "اضغط على القدرة لطلب استخدامها. سيتم إشعار المستضيف.";
                abilityStatus.style.color = "#32c675";
              }
            }
          }
        }
      };
    }
  } catch (e) {
    console.log('BroadcastChannel not supported');
  }
  
  // Check for host notifications every 500ms
  setInterval(() => {
    try {
      const allNotifications = JSON.parse(localStorage.getItem('allPlayerNotifications') || '[]');
      const latestNotification = allNotifications[allNotifications.length - 1];
      
      if (latestNotification && 
          latestNotification.type === 'ability_toggle' && 
          latestNotification.playerParam === playerParam &&
          latestNotification.timestamp > (window.lastProcessedNotification || 0)) {
        
        console.log('Found new host notification:', latestNotification);
        window.lastProcessedNotification = latestNotification.timestamp;
        
        // Update ability state immediately
        const abilityIndex = myAbilities.findIndex(ab => ab.text === latestNotification.abilityText);
        if (abilityIndex !== -1) {
          myAbilities[abilityIndex].used = latestNotification.isUsed;
          console.log(`Ability "${latestNotification.abilityText}" set to used: ${latestNotification.isUsed}`);
          
          // Re-render abilities
          if (abilitiesWrap) {
            renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
          }
          
          // Update status message
          if (abilityStatus) {
            if (latestNotification.isUsed) {
              abilityStatus.textContent = "القدرة مستخدمة - انتظر إعادة التفعيل من المضيف";
              abilityStatus.style.color = "#ff6b35";
            } else {
              abilityStatus.textContent = "اضغط على القدرة لطلب استخدامها. سيتم إشعار المستضيف.";
              abilityStatus.style.color = "#32c675";
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking host notifications:', error);
    }
  }, 500);
}

// Initialize battle status monitoring when page loads
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(startBattleStatusMonitoring, 1000);
  
  // Check for pending host notifications
  setTimeout(() => {
    try {
      const notification = JSON.parse(localStorage.getItem('playerNotification') || '{}');
      if (notification.type === 'ability_toggle' && notification.playerParam === playerParam) {
        console.log('Found pending host notification:', notification);
        
        // Update ability state immediately
        const abilityIndex = myAbilities.findIndex(ab => ab.text === notification.abilityText);
        if (abilityIndex !== -1) {
          myAbilities[abilityIndex].used = notification.isUsed;
          console.log(`Ability "${notification.abilityText}" set to used: ${notification.isUsed}`);
          
          // Re-render abilities
          if (abilitiesWrap) {
            renderBadges(abilitiesWrap, myAbilities, { clickable: true, onClick: requestUseAbility });
          }
          
          // Update status message
          if (abilityStatus) {
            if (notification.isUsed) {
              abilityStatus.textContent = "القدرة مستخدمة - انتظر إعادة التفعيل من المضيف";
              abilityStatus.style.color = "#ff6b35";
            } else {
              abilityStatus.textContent = "اضغط على القدرة لطلب استخدامها. سيتم إشعار المستضيف.";
              abilityStatus.style.color = "#32c675";
            }
          }
        }
        
        // Clear the notification
        localStorage.removeItem('playerNotification');
      }
    } catch (error) {
      console.error('Error checking pending notifications:', error);
    }
  }, 500);
});

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
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      border: 2px solid #10B981;
      font-family: "Cairo", sans-serif;
      font-weight: 600;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    
    // Add type-specific styling
    if (type === 'success') {
      toast.style.borderColor = '#10B981';
    } else if (type === 'error') {
      toast.style.borderColor = '#EF4444';
    } else if (type === 'warning') {
      toast.style.borderColor = '#F59E0B';
    }
    
    document.body.appendChild(toast);
    
    // Show toast
    setTimeout(() => {
      toast.style.opacity = '1';
    }, 100);
    
    // Hide toast after 3 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
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

// ✅ Tournament mode card loading - نفس نظام التحدي تماماً
async function loadTournamentCards() {
  console.log('🏆 Loading tournament cards from Firebase (Challenge Mode Style)...');
  
  // ✅ تحميل البيانات من Firebase مثل طور التحدي تماماً
  if (gameId) {
    console.log('📡 Loading tournament data from Firebase:', gameId);
    await loadGameData();
    return;
  }
  
  // إذا لم يكن هناك gameId، حاول من localStorage
  console.warn('⚠️ No gameId found, trying localStorage...');
  const picksKey = `${playerParam}StrategicPicks`;
  const localPicks = JSON.parse(localStorage.getItem(picksKey) || "[]");
  picks = Array.isArray(localPicks) ? localPicks : [];
  
  if (picks.length === 0) {
    console.error('❌ No tournament picks found!');
    if (instruction) {
      instruction.innerText = 'لم يتم العثور على البطاقات. يرجى نسخ الرابط من جديد.';
    }
    if (grid) {
      grid.innerHTML = '<div style="color:#fff;padding:20px;text-align:center;">لم يتم العثور على البطاقات<br><small>يرجى الرجوع والحصول على رابط جديد</small></div>';
    }
    return;
  }
  
  // Limit to tournament rounds
  if (picks.length > rounds) {
    picks = picks.slice(0, rounds);
    console.log(`Limited to ${rounds} cards for tournament rounds`);
  }
  
  // Check if we have a submitted order for the CURRENT tournament - نفس النظام
  const savedOrder = JSON.parse(localStorage.getItem(ORDER_LOCAL_KEY) || "[]");
  const strategicOrder = JSON.parse(localStorage.getItem(`${playerParam}StrategicOrdered`) || "[]");
  
  // Use the most recent order available
  let orderToUse = null;
  if (Array.isArray(savedOrder) && savedOrder.length === picks.length) {
    orderToUse = savedOrder;
    console.log(`✅ Found saved order for tournament ${playerParam}:`, orderToUse.length, 'cards');
  } else if (Array.isArray(strategicOrder) && strategicOrder.length === picks.length) {
    orderToUse = strategicOrder;
    console.log(`✅ Found strategic order for tournament ${playerParam}:`, orderToUse.length, 'cards');
  }
  
  if (orderToUse) {
    submittedOrder = orderToUse.slice();
    picks = orderToUse.slice(); // Update picks to match the ordered arrangement
    console.log('Loaded existing tournament order:', submittedOrder);
    hideOpponentPanel();
    hidePlayerAbilitiesViewPanel();
    renderCards(submittedOrder, submittedOrder);
    
    // Update button state
    if (continueBtn) {
      continueBtn.disabled = true;
      continueBtn.textContent = '✅ تم إرسال الترتيب';
    }
  } else {
    submittedOrder = null;
    renderCards(picks, null);
    loadOpponentAbilities();
    
    // Reset button state
    if (continueBtn) {
      continueBtn.disabled = false;
      continueBtn.textContent = 'متابعة';
    }
  }
  
  // Update instruction
  if (instruction) {
    instruction.innerText = `${playerName} رتب بطاقاتك (${rounds} جولة)`;
  }
  
  // Load player abilities
  loadPlayerAbilities();
  
  // Show tournament indicator
  showTournamentIndicator();
}

function showTournamentIndicator() {
  const header = document.querySelector('.game-header');
  if (header && !document.getElementById('tournament-indicator')) {
    const indicator = document.createElement('div');
    indicator.id = 'tournament-indicator';
    indicator.style.cssText = `
      font-size: 48px;
      text-align: center;
      margin-bottom: 10px;
      filter: drop-shadow(0 2px 8px rgba(255, 152, 0, 0.3));
    `;
    indicator.textContent = '🏆';
    header.appendChild(indicator);
  }
}

// Tournament mode submit function - متطابق تماماً مع التحدي العادي
async function submitTournamentPicks() {
  console.log('🏆 Submitting tournament picks - UNIFIED SYSTEM...');
  
  if (!picks.length) return;

  if (Array.isArray(submittedOrder) && submittedOrder.length === picks.length) {
    console.log(`⚠️ اللاعب ${playerParam} حاول إرسال ترتيب مرسل بالفعل`);
    return;
  }

  // حماية إضافية: تحقق من أن هذا اللاعب لم يرسل الترتيب مؤخراً
  const lastSubmitTime = localStorage.getItem(LAST_SUBMIT_TIME_KEY);
  const currentTime = Date.now();
  if (lastSubmitTime && (currentTime - parseInt(lastSubmitTime)) < 2000) {
    console.log(`⚠️ تجاهل إرسال متكرر للاعب ${playerParam} - تم الإرسال مؤخراً`);
    return;
  }

  // Process ordering based on device type - نفس المنطق بالضبط
  let ordered = [];
  
  if (isMobile) {
    // For mobile, use dropdown selection (same as desktop for consistency)
    const dropdowns = document.querySelectorAll(".orderSelect");
    const values = dropdowns.length
      ? Array.from(dropdowns).map((s) => parseInt(s.value, 10))
      : [];

    const inRange = values.every(v => Number.isInteger(v) && v >= 1 && v <= picks.length);
    if (!inRange || new Set(values).size !== picks.length) {
      alert("يرجى ترتيب كل البطاقات بدون تكرار وضمن النطاق الصحيح.");
      return;
    }

    // Create ordered array based on dropdown selections
    ordered = new Array(picks.length);
    for (let i = 0; i < values.length; i++) {
      const orderIndex = values[i] - 1;
      ordered[orderIndex] = picks[i];
      console.log(`Card ${i + 1} (${picks[i]}) placed at position ${orderIndex + 1}`);
    }
    console.log('Final ordered array:', ordered);
  } else {
    // For desktop dropdown selection, validate and process dropdowns
    const dropdowns = document.querySelectorAll(".orderSelect");
    const values = dropdowns.length
      ? Array.from(dropdowns).map((s) => parseInt(s.value, 10))
      : [];

    const inRange = values.every(v => Number.isInteger(v) && v >= 1 && v <= picks.length);
    if (!inRange || new Set(values).size !== picks.length) {
      alert("يرجى ترتيب كل البطاقات بدون تكرار وضمن النطاق الصحيح.");
      return;
    }

    ordered = new Array(picks.length);
    for (let i = 0; i < values.length; i++) {
      const orderIndex = values[i] - 1;
      ordered[orderIndex] = picks[i];
      console.log(`Card ${i + 1} (${picks[i]}) placed at position ${orderIndex + 1}`);
    }
    console.log('Final ordered array (desktop):', ordered);
  }

  try {
    // إظهار loading
    if (continueBtn) {
      continueBtn.disabled = true;
      continueBtn.textContent = 'جاري إرسال الترتيب...';
    }
    
    // Store submitted order in localStorage (following same pattern as challenge mode)
    console.log(`💾 حفظ ترتيب البطولة للاعب ${playerParam} في localStorage`);
    localStorage.setItem(ORDER_LOCAL_KEY, JSON.stringify(ordered));
    
    // Store card arrangement for card.html to detect (following same pattern)
    const playerKey = currentPlayer === 1 ? 'player1' : 'player2';
    localStorage.setItem(`${playerKey}CardArrangement`, JSON.stringify(ordered));
    localStorage.setItem(`${playerKey}ArrangementCompleted`, 'true');
    
    // Also store in the format expected by card.html
    const currentGameSetup = JSON.parse(localStorage.getItem(GAME_SETUP_KEY) || '{}');
    const updatedGameSetup = {
      ...currentGameSetup,
      [playerKey]: {
        ...currentGameSetup[playerKey],
        selectedCards: ordered,
        arrangementCompleted: true
      }
    };
    localStorage.setItem(GAME_SETUP_KEY, JSON.stringify(updatedGameSetup));
    
    // Store in gameState format as well
    const currentGameState = JSON.parse(localStorage.getItem(GAME_STATE_KEY) || '{}');
    const updatedGameState = {
      ...currentGameState,
      [playerKey]: {
        ...currentGameState[playerKey],
        selectedCards: ordered,
        arrangementCompleted: true
      }
    };
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(updatedGameState));
    
    // Store in StrategicOrdered format (for compatibility with card.js)
    localStorage.setItem(`${playerParam}StrategicOrdered`, JSON.stringify(ordered));
    localStorage.setItem(LAST_SUBMIT_TIME_KEY, Date.now().toString());
    
    // ✅ حفظ في Firebase (نفس طور التحدي تماماً)
    if (gameId) {
      try {
        console.log(`📡 Saving tournament order to Firebase for player ${playerParam}...`);
        await GameService.saveCardOrder(gameId, player, ordered);
        console.log(`✅ Tournament order saved to Firebase successfully`);
      } catch (e) {
        console.error('❌ Firebase save failed:', e);
        alert('حدث خطأ في حفظ الترتيب. يرجى المحاولة مرة أخرى.');
        // إعادة تفعيل الزر
        if (continueBtn) {
          continueBtn.disabled = false;
          continueBtn.textContent = 'متابعة';
        }
        return;
      }
    } else {
      console.error('❌ No gameId found - cannot save to Firebase');
      alert('خطأ: لم يتم العثور على معرف اللعبة. يرجى نسخ الرابط من جديد.');
      if (continueBtn) {
        continueBtn.disabled = false;
        continueBtn.textContent = 'متابعة';
      }
      return;
    }
    
    // Update submittedOrder immediately
    submittedOrder = ordered.slice();
    
    hideOpponentPanel();
    hidePlayerAbilitiesViewPanel();
    
    // Re-render cards immediately with submitted order
    console.log(`🎯 عرض ترتيب البطولة للاعب ${playerParam}:`, submittedOrder);
    renderCards(submittedOrder, submittedOrder);
    
    // Update button state
    if (continueBtn) {
      continueBtn.disabled = true;
      continueBtn.textContent = '✅ تم إرسال الترتيب';
      continueBtn.classList.remove('hidden');
    }
    
    // Hide mobile instructions after submission
    const mobileInstructions = document.querySelector('.mobile-instructions');
    if (mobileInstructions) {
      mobileInstructions.remove();
    }
    
    // Show success message
    console.log('Tournament order submitted successfully:', ordered);
    showToast('تم حفظ ترتيب البطاقات بنجاح!', 'success');
    
    // Reset isArranging flag
    isArranging = false;
    console.log("✅ تم إرسال ترتيب البطولة - السماح بالتحديثات الخارجية مرة أخرى");
    
  } catch (error) {
    console.error('Error saving tournament card order:', error);
    alert('حدث خطأ في حفظ ترتيب البطاقات: ' + error.message);
    
    // Reset isArranging flag on error
    isArranging = false;
    console.log("❌ حدث خطأ في البطولة - السماح بالتحديثات الخارجية مرة أخرى");
    
    // إعادة تفعيل الزر
    if (continueBtn) {
      continueBtn.disabled = false;
      continueBtn.textContent = 'متابعة';
    }
  }
}

// الدالتان updateSubmitButton و checkTournamentReady تم دمجهما في submitTournamentPicks

// Make functions available globally
window.submitPicks = submitPicks;
window.clearOldGameData = clearOldGameData;
window.clearUsedAbilities = clearUsedAbilities;
window.openBattleView = openBattleView;
window.loadTournamentCards = loadTournamentCards;
window.submitTournamentPicks = submitTournamentPicks;



// ✅ إعادة تحميل ترتيب الكروت بعد تحديث الصفحة - مع حماية قوية
let hasInitialLoadCompleted = false;
document.addEventListener("DOMContentLoaded", () => {
  try {
    // ✅ حماية: منع التحميل المكرر إذا تم التحميل بالفعل
    if (hasInitialLoadCompleted) {
      console.log("⚠️ تم التحميل الأولي بالفعل - تجاهل التحميل المكرر");
      return;
    }
    
    // نمنع التحميل المكرر إذا كانت الدالة تعمل بالفعل
    if (typeof loadPlayerCards === "function" && !isLoadingPlayerCards) {
      console.log("🔁 إعادة تحميل ترتيب الكروت من localStorage بعد التحديث...");
      loadPlayerCards();
      hasInitialLoadCompleted = true;

      // في حال لم يكن cardManager جاهزاً بعد، نعيد المحاولة بعد قليل
      setTimeout(() => {
        if (typeof window.cardManager === "undefined" && !isLoadingPlayerCards) {
          console.warn("⚠️ cardManager لم يجهز بعد — إعادة المحاولة...");
          loadPlayerCards();
        }
      }, 1000);
    } else {
      if (isLoadingPlayerCards) {
        console.log("⚠️ التحميل قيد التنفيذ - تجاهل التحميل المكرر");
      } else {
        console.warn("⚠️ الدالة loadPlayerCards غير متوفرة حالياً.");
      }
    }
  } catch (e) {
    console.error("❌ خطأ أثناء إعادة تحميل ترتيب الكروت:", e);
    hasInitialLoadCompleted = false; // إعادة تعيين في حالة الخطأ
  }
});