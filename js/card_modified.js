// --- Game state ---
// Load game data from gameSetupProgress with error handling
let gameSetupProgress = {};
try {
  gameSetupProgress = JSON.parse(localStorage.getItem("gameSetupProgress") || "{}");
} catch (error) {
  console.warn("Error parsing gameSetupProgress:", error);
  gameSetupProgress = {};
}

// Load round count from gameSetupProgress
let roundCount = 5;
let startingHP = 5;

try {
  if (gameSetupProgress.rounds) {
    roundCount = gameSetupProgress.rounds;
    startingHP = gameSetupProgress.rounds;
  } else if (localStorage.getItem("totalRounds")) {
    roundCount = parseInt(localStorage.getItem("totalRounds"));
    startingHP = parseInt(localStorage.getItem("totalRounds"));
  }
} catch (e) {
  console.error('Error loading round count:', e);
}

// Load player names from gameSetupProgress
let player1 = "لاعب 1";
let player2 = "لاعب 2";

try {
  if (gameSetupProgress.player1?.name) {
    player1 = gameSetupProgress.player1.name;
  } else if (gameSetupProgress.player1Name) {
    player1 = gameSetupProgress.player1Name;
  } else if (localStorage.getItem("player1")) {
    player1 = localStorage.getItem("player1");
  }
  
  if (gameSetupProgress.player2?.name) {
    player2 = gameSetupProgress.player2.name;
  } else if (gameSetupProgress.player2Name) {
    player2 = gameSetupProgress.player2Name;
  } else if (localStorage.getItem("player2")) {
    player2 = localStorage.getItem("player2");
  }
  
  console.log('Loaded player names:', { player1, player2 });
} catch (e) {
  console.error('Error loading player names:', e);
}

// Dynamic picks loading function
function loadPlayerPicks() {
  let picks = {};
  
  try {
    // First priority: Load from StrategicOrdered (final arrangement from player-cards.html)
    const player1Order = localStorage.getItem('player1StrategicOrdered');
    const player2Order = localStorage.getItem('player2StrategicOrdered');
    
    if (player1Order && player2Order) {
      try {
        const player1Ordered = JSON.parse(player1Order);
        const player2Ordered = JSON.parse(player2Order);
        
        if (Array.isArray(player1Ordered) && Array.isArray(player2Ordered) && 
            player1Ordered.length > 0 && player2Ordered.length > 0) {
          picks[player1] = [...player1Ordered];
          picks[player2] = [...player2Ordered];
          console.log('Loaded picks from StrategicOrdered:', { player1: picks[player1], player2: picks[player2] });
          return picks;
        }
      } catch (e) {
        console.warn('Error parsing StrategicOrdered:', e);
      }
    }
    
    // Second priority: Load from StrategicPicks (selected cards from cards-setup.js)
    const player1Picks = localStorage.getItem('player1StrategicPicks');
    const player2Picks = localStorage.getItem('player2StrategicPicks');
    
    if (player1Picks && player2Picks) {
      try {
        const player1Cards = JSON.parse(player1Picks);
        const player2Cards = JSON.parse(player2Picks);
        
        if (Array.isArray(player1Cards) && Array.isArray(player2Cards) && 
            player1Cards.length > 0 && player2Cards.length > 0) {
          picks[player1] = [...player1Cards];
          picks[player2] = [...player2Cards];
          console.log('Loaded picks from StrategicPicks:', { player1: picks[player1], player2: picks[player2] });
          return picks;
        }
      } catch (e) {
        console.warn('Error parsing StrategicPicks:', e);
      }
    }
    
    // Third priority: Load from gameCardSelection
    const cardSelection = localStorage.getItem('gameCardSelection');
    if (cardSelection) {
      try {
        const cardData = JSON.parse(cardSelection);
        if (cardData.player1Cards && cardData.player2Cards) {
          picks[player1] = [...cardData.player1Cards];
          picks[player2] = [...cardData.player2Cards];
          console.log('Loaded picks from gameCardSelection:', { player1: picks[player1], player2: picks[player2] });
          return picks;
        }
      } catch (e) {
        console.warn('Error parsing gameCardSelection:', e);
      }
    }
    
  } catch (error) {
    console.warn("Error loading picks:", error);
  }
  
  // Ensure picks has valid data for both players
  if (!picks[player1] || !Array.isArray(picks[player1]) || picks[player1].length === 0) {
    picks[player1] = []; // All card data has been removed - ready for new cards
    console.log('Using empty cards for player1:', picks[player1]);
  }
  if (!picks[player2] || !Array.isArray(picks[player2]) || picks[player2].length === 0) {
    picks[player2] = []; // All card data has been removed - ready for new cards
    console.log('Using empty cards for player2:', picks[player2]);
  }
  
  return picks;
}

// Load picks dynamically
let picks = loadPlayerPicks();

let round = parseInt(localStorage.getItem("currentRound") || "0");

// Scores init/persist with error handling
let scores = {};
try {
  scores = JSON.parse(localStorage.getItem("scores") || "{}");
} catch (error) {
  console.warn("Error parsing scores:", error);
  scores = {};
}

if (Object.keys(scores).length === 0 || round === 0) {
  scores[player1] = startingHP;
  scores[player2] = startingHP;
}

// Storage keys
const P1_ABILITIES_KEY = "player1Abilities";
const P2_ABILITIES_KEY = "player2Abilities";
const NOTES_KEY = (name) => `notes:${name}`;
const USED_ABILITIES_KEY = "usedAbilities";
const ABILITY_REQUESTS_KEY = "abilityRequests";

// ---- UI roots ----
const roundTitle = document.querySelector(".topbar h1");
const leftName   = document.querySelector(".player-column .name");
const rightName  = document.querySelector(".right-panel .name");
const leftCard   = document.querySelector(".player-column .big-card");
const rightCard  = document.querySelector(".right-panel .big-card");
const leftNotes  = document.querySelector(".player-column .notes textarea");
const rightNotes = document.querySelector(".right-panel .notes textarea");

// Track shown notifications to avoid duplicates
let shownNotifications = new Set();

/* ---------------------- Toast ---------------------- */
function showToast(message, actions = []) {
  const wrap = document.createElement("div");
  wrap.style.cssText = `
    position:fixed; left:50%; transform:translateX(-50%);
    bottom:18px; z-index:3000; background:#222; color:#fff;
    border:2px solid #ffffff; border-radius:12px; padding:10px 14px;
    box-shadow:0 8px 18px rgba(0,0,0,.35); font-weight:700;
    font-family:"Cairo",sans-serif;
  `;
  const msg = document.createElement("div");
  
  // Check if message starts with "!" and style it red
  if (message.startsWith("! ")) {
    const icon = document.createElement("span");
    icon.textContent = "!";
    icon.style.color = "#dc2626"; // Red color
    icon.style.fontWeight = "bold";
    icon.style.fontSize = "18px";
    
    const text = document.createElement("span");
    text.textContent = message.substring(2); // Remove "! " from the beginning
    
    msg.appendChild(icon);
    msg.appendChild(text);
  } else {
    msg.textContent = message;
  }
  
  msg.style.marginBottom = actions.length ? "8px" : "0";
  wrap.appendChild(msg);

  if (actions.length) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.justifyContent = "flex-end";
    actions.forEach(a => {
      const b = document.createElement("button");
      b.textContent = a.label;
      
      // Set different colors based on button label
      let backgroundColor = "#16a34a"; // Default green for "قبول"
      if (a.label === "رفض") {
        backgroundColor = "#dc2626"; // Red for "رفض"
      }
      
      b.style.cssText = `
        padding:6px 10px; border-radius:10px; border:none;
        background:${backgroundColor}; color:#fff; font-weight:800; cursor:pointer;
        font-family:"Cairo",sans-serif;
      `;
      b.onclick = () => { a.onClick?.(); document.body.removeChild(wrap); };
      row.appendChild(b);
    });
    wrap.appendChild(row);
  }

  document.body.appendChild(wrap);
  if (!actions.length) setTimeout(() => wrap.remove(), 1800);
}

/* ---------------------- Abilities helpers ---------------------- */
function loadAbilities(key){ 
  try{ 
    const a=JSON.parse(localStorage.getItem(key)||"[]"); 
    return Array.isArray(a)?a:[] 
  }catch(error){ 
    console.warn(`Error loading abilities for ${key}:`, error);
    return [] 
  } 
}

// Load abilities from player-specific keys
function loadPlayerAbilities(playerParam) {
  try {
    const abilitiesKey = `${playerParam}Abilities`;
    const usedAbilitiesKey = `${playerParam}UsedAbilities`;
    
    const abilities = JSON.parse(localStorage.getItem(abilitiesKey) || '[]');
    const usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
    const usedSet = new Set(usedAbilities);
    
    return abilities.map(ability => {
      const abilityText = typeof ability === 'string' ? ability : ability.text || ability;
      return {
        text: abilityText,
        used: usedSet.has(abilityText) || (typeof ability === 'object' && ability.used === true)
      };
    });
  } catch (e) {
    console.error(`Error loading player abilities for ${playerParam}:`, e);
    return [];
  }
}
function saveAbilities(key, arr){ 
  try {
    localStorage.setItem(key, JSON.stringify(arr)); 
  } catch(error) {
    console.error(`Error saving abilities for ${key}:`, error);
  }
}

function loadUsedAbilities(){
  try {
    const used = JSON.parse(localStorage.getItem(USED_ABILITIES_KEY) || "{}");
    return used;
  } catch(error) {
    console.warn("Error loading used abilities:", error);
    localStorage.removeItem(USED_ABILITIES_KEY);
    return {};
  }
}

function saveUsedAbilities(usedAbilities){
  try {
    localStorage.setItem(USED_ABILITIES_KEY, JSON.stringify(usedAbilities));
    
    // Also trigger storage event manually for cross-page sync
    window.dispatchEvent(new StorageEvent('storage', {
      key: USED_ABILITIES_KEY,
      newValue: localStorage.getItem(USED_ABILITIES_KEY),
      oldValue: localStorage.getItem(USED_ABILITIES_KEY),
      storageArea: localStorage
    }));
  } catch(error) {
    console.error("Error saving used abilities:", error);
    try {
      localStorage.removeItem(USED_ABILITIES_KEY);
      localStorage.setItem(USED_ABILITIES_KEY, JSON.stringify(usedAbilities));
    } catch(clearError) {
      console.error("Error clearing and saving used abilities:", clearError);
    }
  }
}

function isAbilityUsed(abilityText){
  try {
    const usedAbilities = loadUsedAbilities();
    return usedAbilities[abilityText] === true;
  } catch(error) {
    console.error("Error checking ability usage:", error);
    return false;
  }
}

// Ability request system
function loadAbilityRequests(){
  try {
    const requests = JSON.parse(localStorage.getItem(ABILITY_REQUESTS_KEY) || "[]");
    return requests;
  } catch(error) {
    console.warn("Error loading ability requests:", error);
    localStorage.removeItem(ABILITY_REQUESTS_KEY);
    return [];
  }
}

function saveAbilityRequests(requests){
  try {
    localStorage.setItem(ABILITY_REQUESTS_KEY, JSON.stringify(requests));
  } catch(error) {
    console.error("Error saving ability requests:", error);
  }
}

function updateAbilityRequestStatus(requestId, status){
  try {
    const requests = loadAbilityRequests();
    const requestIndex = requests.findIndex(req => req.id === requestId);
    
    if (requestIndex !== -1) {
      requests[requestIndex].status = status;
      requests[requestIndex].resolvedAt = Date.now();
      saveAbilityRequests(requests);
      
      // Dispatch event to notify other pages
      window.dispatchEvent(new CustomEvent('abilityRequestUpdated', {
        detail: { requestId, status, request: requests[requestIndex] }
      }));
      
      // Also trigger storage event manually for cross-page sync
      window.dispatchEvent(new StorageEvent('storage', {
        key: ABILITY_REQUESTS_KEY,
        newValue: localStorage.getItem(ABILITY_REQUESTS_KEY),
        oldValue: localStorage.getItem(ABILITY_REQUESTS_KEY),
        storageArea: localStorage
      }));
      
      return true;
    }
    return false;
  } catch(error) {
    console.error("Error updating ability request status:", error);
    return false;
  }
}

function getPendingRequests(){
  try {
    const requests = loadAbilityRequests();
    return requests.filter(req => req.status === 'pending');
  } catch(error) {
    console.error("Error getting pending requests:", error);
    return [];
  }
}

/* ---------------------- Media ---------------------- */
function createMedia(url, className){
  // Fix card paths for Netlify compatibility
  let fixedUrl = url;
  if (fixedUrl && !fixedUrl.startsWith('http') && !fixedUrl.startsWith('images/')) {
    if (fixedUrl.startsWith('CARD/')) {
      fixedUrl = fixedUrl.replace('CARD/', 'images/');
    } else if (!fixedUrl.startsWith('images/')) {
      fixedUrl = 'images/' + fixedUrl;
    }
  }
  
  const isWebm = /\.webm(\?|#|$)/i.test(fixedUrl || "");
  if (isWebm){
    const v=document.createElement("video");
    v.src=fixedUrl; 
    v.autoplay=true; 
    v.loop=true; 
    v.muted=true; 
    v.playsInline=true;
    v.style.width="100%"; 
    v.style.height="100%";
    v.style.objectFit="contain"; 
    v.style.borderRadius="12px";
    v.style.display="block";
    v.onerror = function() {
      console.error('Error loading video:', fixedUrl);
      this.style.display = 'none';
    };
    if (className) v.className=className;
    return v;
  } else {
    const img=document.createElement("img");
    img.src=fixedUrl;
    img.style.width="100%"; 
    img.style.height="100%";
    img.style.objectFit="contain"; 
    img.style.borderRadius="12px";
    img.style.display="block";
    img.onerror = function() {
      console.error('Error loading image:', fixedUrl);
      this.style.display = 'none';
    };
    if (className) img.className=className;
    return img;
  }
}

/* ---------------------- VS section ---------------------- */
function renderVs(){
  // Update player names in HTML
  const leftPlayerName = document.getElementById('leftPlayerName');
  const rightPlayerName = document.getElementById('rightPlayerName');
  
  if (leftPlayerName) {
    leftPlayerName.textContent = player2;
  }
  if (rightPlayerName) {
    rightPlayerName.textContent = player1;
  }
  
  // Update legacy elements for compatibility
  if (leftName) {
    leftName.textContent = player2;
  }
  if (rightName) {
    rightName.textContent = player1;
  }

  if (leftCard) {
    leftCard.innerHTML = "";
    const leftCardSrc = picks?.[player2]?.[round];
    if (leftCardSrc) {
      leftCard.appendChild(createMedia(leftCardSrc, ""));
    } else {
      leftCard.innerHTML = '<div class="empty-hint">لا توجد بطاقة لهذه الجولة</div>';
    }
  }
  
  if (rightCard) {
    rightCard.innerHTML = "";
    const rightCardSrc = picks?.[player1]?.[round];
    if (rightCardSrc) {
      rightCard.appendChild(createMedia(rightCardSrc, ""));
    } else {
      rightCard.innerHTML = '<div class="empty-hint">لا توجد بطاقة لهذه الجولة</div>';
    }
  }

  leftNotes.value  = localStorage.getItem(NOTES_KEY(player2)) || "";
  rightNotes.value = localStorage.getItem(NOTES_KEY(player1)) || "";
  leftNotes.addEventListener("input", ()=>localStorage.setItem(NOTES_KEY(player2), leftNotes.value));
  rightNotes.addEventListener("input",()=>localStorage.setItem(NOTES_KEY(player1), rightNotes.value));
}

/* ---------------------- Previous cards ---------------------- */
function renderPrev(){
  const getPrev = (name)=> (Array.isArray(picks?.[name])?picks[name]:[]).filter((_,i)=>i<round);
  const leftRow  = document.getElementById("historyRowLeft");
  const rightRow = document.getElementById("historyRowRight");
  const leftLbl  = document.getElementById("historyLabelLeft");
  const rightLbl = document.getElementById("historyLabelRight");

  if (round <= 0){
    if (leftRow) leftRow.classList.add("history-hidden");
    if (rightRow) rightRow.classList.add("history-hidden");
    if (leftLbl) leftLbl.classList.add("history-hidden");
    if (rightLbl) rightLbl.classList.add("history-hidden");
    return;
  }
  
  if (leftRow) leftRow.classList.remove("history-hidden");
  if (rightRow) rightRow.classList.remove("history-hidden");
  if (leftLbl) leftLbl.classList.remove("history-hidden");
  if (rightLbl) rightLbl.classList.remove("history-hidden");

  if (leftRow) leftRow.innerHTML=""; 
  if (rightRow) rightRow.innerHTML="";
  
  // Show previous cards for player2 (left side)
  const player2Prev = getPrev(player2);
  if (player2Prev.length > 0 && leftRow) {
    player2Prev.forEach(src=>{
      const mini=document.createElement("div");
      mini.className="mini-card";
      mini.appendChild(createMedia(src,""));
      leftRow.appendChild(mini);
    });
  }
  
  // Show previous cards for player1 (right side)
  const player1Prev = getPrev(player1);
  if (player1Prev.length > 0 && rightRow) {
    player1Prev.forEach(src=>{
      const mini=document.createElement("div");
      mini.className="mini-card";
      mini.appendChild(createMedia(src,""));
      rightRow.appendChild(mini);
    });
  }
}

/* ---------------------- Abilities panels ---------------------- */
function abilityButton(text, onClick, isUsed = false){
  const b=document.createElement("button");
  b.className="btn";
  b.textContent=text;
  b.style.fontFamily = '"Cairo", sans-serif';     // ⬅ force Cairo on dynamic buttons
  b.onclick=onClick;
  
  // Add visual hint for clickable abilities
  b.title = isUsed ? "انقر لإلغاء تفعيل القدرة" : "انقر لتفعيل القدرة";
  b.style.cursor = "pointer";
  
  return b;
}

function renderAbilitiesPanel(key, container, fromName, toName){
  // Determine which player this is
  const playerParam = (fromName === player1) ? 'player1' : 'player2';
  
  // Load abilities from player-specific keys
  const abilities = loadPlayerAbilities(playerParam);
  container.innerHTML = "";

  if (!abilities.length){
    const p=document.createElement("p");
    p.style.opacity=".7"; p.style.fontSize="12px"; p.textContent="لا توجد قدرات";
    p.style.fontFamily = '"Cairo", sans-serif';
    container.appendChild(p);
  } else {
    abilities.forEach((ab, idx)=>{
      const isUsed = ab.used;
      const displayText = isUsed ? `${ab.text} (مستخدمة)` : ab.text;
      
      const btn = abilityButton(displayText, ()=>{
        // Toggle ability usage for host
        const newUsedState = !isUsed;
        
        // Update used abilities for the specific player
        const usedAbilitiesKey = `${playerParam}UsedAbilities`;
        const usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
        
        if (newUsedState) {
          // Add to used abilities
          if (!usedAbilities.includes(ab.text)) {
            usedAbilities.push(ab.text);
          }
        } else {
          // Remove from used abilities
          const filteredAbilities = usedAbilities.filter(ability => ability !== ab.text);
          usedAbilities.length = 0;
          usedAbilities.push(...filteredAbilities);
        }
        
        localStorage.setItem(usedAbilitiesKey, JSON.stringify(usedAbilities));
        
        // Update global used abilities
        const globalUsedAbilities = loadUsedAbilities();
        globalUsedAbilities[ab.text] = newUsedState;
        saveUsedAbilities(globalUsedAbilities);
        
        // Update abilities list
        const current = loadAbilities(key);
        if (current[idx]) {
          current[idx].used = newUsedState;
          saveAbilities(key, current);
        }
        
        // Force immediate update in current page
        renderPanels();
        
        // Force update in player pages by triggering a custom event
        window.dispatchEvent(new CustomEvent('abilityToggled', {
          detail: {
            playerParam: playerParam,
            abilityText: ab.text,
            isUsed: newUsedState
          }
        }));
        
        // Also trigger storage event for cross-tab sync
        window.dispatchEvent(new StorageEvent('storage', {
          key: `${playerParam}UsedAbilities`,
          newValue: localStorage.getItem(`${playerParam}UsedAbilities`),
          oldValue: localStorage.getItem(`${playerParam}UsedAbilities`),
          storageArea: localStorage
        }));
        
        // Also try postMessage to all possible windows
        try {
          const message = {
            type: 'ABILITY_TOGGLED',
            playerParam: playerParam,
            abilityText: ab.text,
            isUsed: newUsedState
          };
          
          // Send to parent window
          if (window.parent && window.parent !== window) {
            window.parent.postMessage(message, '*');
          }
          
          // Send to opener window
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(message, '*');
          }
          
          // Send to all frames
          for (let i = 0; i < window.frames.length; i++) {
            try {
              window.frames[i].postMessage(message, '*');
            } catch (e) {
              // Ignore cross-origin errors
            }
          }
        } catch (e) {
          console.error('Error sending postMessage:', e);
        }
        
        // Show enhanced toast notification
        const action = newUsedState ? "تم تعطيل" : "تم إعادة تفعيل";
        const icon = newUsedState ? "🔴" : "🟢";
        const playerName = fromName;
        
        showToast(`${icon} ${action} القدرة "${ab.text}" للاعب ${playerName}`, [
          {
            label: "إشعار اللاعب",
            onClick: () => {
              // Send notification to player
              const notification = {
                type: 'ability_toggle',
                playerParam: playerParam,
                abilityText: ab.text,
                isUsed: newUsedState,
                timestamp: Date.now(),
                fromHost: true
              };
              localStorage.setItem('playerNotification', JSON.stringify(notification));
              
              // Trigger storage event for immediate sync
              window.dispatchEvent(new StorageEvent('storage', {
                key: 'playerNotification',
                newValue: localStorage.getItem('playerNotification'),
                oldValue: localStorage.getItem('playerNotification'),
                storageArea: localStorage
              }));
              
              showToast(`📤 تم إرسال إشعار للاعب ${playerName}`);
            }
          }
        ]);
      }, isUsed);
      
      // Update button appearance for used abilities
      if (isUsed) {
        btn.style.backgroundColor = "#666";
        btn.style.color = "#999";
      }
      
      container.appendChild(btn);
    });
  }

  const transferBtn=document.createElement("button");
  transferBtn.className="btn transfer-btn";
  transferBtn.style.fontFamily = '"Cairo", sans-serif';
  transferBtn.textContent="نقل القدرة للاعب الآخر";
  transferBtn.onclick=()=>openTransferModal(key, fromName, toName);
  container.appendChild(transferBtn);
}

function renderPanels(){
  try {
    const player1Container = document.getElementById("player1AbilitiesContainer");
    const player2Container = document.getElementById("player2AbilitiesContainer");
    const player1Title = document.getElementById("player1AbilitiesTitle");
    const player2Title = document.getElementById("player2AbilitiesTitle");
    
    // Update ability titles
    if (player1Title) {
      player1Title.textContent = `قدرات ${player1}`;
    }
    if (player2Title) {
      player2Title.textContent = `قدرات ${player2}`;
    }
    
    if (player1Container) {
      renderAbilitiesPanel(P1_ABILITIES_KEY, player1Container, player1, player2);
    }
    if (player2Container) {
      renderAbilitiesPanel(P2_ABILITIES_KEY, player2Container, player2, player1);
    }
    
    renderAbilityRequests();
  } catch(error) {
    console.error("Error rendering ability panels:", error);
  }
}

// Function to reload abilities dynamically
function reloadAbilitiesFromGameSetup() {
  try {
    console.log('Reloading abilities from game setup...');
    
    // First try to load from individual player ability keys (new system)
    const player1AbilitiesKey = 'player1Abilities';
    const player2AbilitiesKey = 'player2Abilities';
    
    let player1Abilities = [];
    let player2Abilities = [];
    
    // Load player 1 abilities
    if (localStorage.getItem(player1AbilitiesKey)) {
      try {
        const abilities = JSON.parse(localStorage.getItem(player1AbilitiesKey));
        if (Array.isArray(abilities)) {
          player1Abilities = abilities.map(ability => ({
            text: typeof ability === 'string' ? ability : ability.text || ability,
            used: false
          }));
          console.log('Loaded player1 abilities from new system:', player1Abilities);
        }
      } catch (e) {
        console.error('Error loading player1 abilities from new system:', e);
      }
    }
    
    // Load player 2 abilities
    if (localStorage.getItem(player2AbilitiesKey)) {
      try {
        const abilities = JSON.parse(localStorage.getItem(player2AbilitiesKey));
        if (Array.isArray(abilities)) {
          player2Abilities = abilities.map(ability => ({
            text: typeof ability === 'string' ? ability : ability.text || ability,
            used: false
          }));
          console.log('Loaded player2 abilities from new system:', player2Abilities);
        }
      } catch (e) {
        console.error('Error loading player2 abilities from new system:', e);
      }
    }
    
    // If we have abilities from new system, use them
    if (player1Abilities.length > 0 || player2Abilities.length > 0) {
      localStorage.setItem(P1_ABILITIES_KEY, JSON.stringify(player1Abilities));
      localStorage.setItem(P2_ABILITIES_KEY, JSON.stringify(player2Abilities));
      
      console.log('Abilities loaded from new system:', {
        player1: player1Abilities,
        player2: player2Abilities
      });
      
      // Re-render panels
      renderPanels();
      return true;
    }
    
    // Fallback: try to load from gameSetupProgress
    const gameSetup = localStorage.getItem('gameSetupProgress');
    if (gameSetup) {
      try {
        const gameData = JSON.parse(gameSetup);
        if (gameData.player1?.abilities && gameData.player2?.abilities) {
          const player1Abilities = gameData.player1.abilities.map(ability => ({
            text: ability,
            used: false
          }));
          const player2Abilities = gameData.player2.abilities.map(ability => ({
            text: ability,
            used: false
          }));
          
          localStorage.setItem(P1_ABILITIES_KEY, JSON.stringify(player1Abilities));
          localStorage.setItem(P2_ABILITIES_KEY, JSON.stringify(player2Abilities));
          
          console.log('Abilities reloaded from gameSetupProgress:', {
            player1: gameData.player1.abilities,
            player2: gameData.player2.abilities
          });
          
          // Re-render panels
          renderPanels();
          return true;
        }
      } catch (e) {
        console.error('Error reloading abilities from gameSetupProgress:', e);
      }
    }
    
    return false;
  } catch(error) {
    console.error("Error reloading abilities:", error);
    return false;
  }
}

// Render ability requests notifications
function renderAbilityRequests(){
  try {
    const requests = JSON.parse(localStorage.getItem('abilityRequests') || '[]');
    const pendingRequests = requests.filter(req => req.status === 'pending');
    
    if (pendingRequests.length === 0) return;
    
    pendingRequests.forEach(request => {
      if (!shownNotifications.has(request.id)) {
        shownNotifications.add(request.id);
        
        showToast(`! ${request.playerName} يطلب استخدام القدرة: «${request.abilityText}»`, [
          {
            label: "قبول",
            onClick: () => {
              approveAbilityRequest(request.id);
              shownNotifications.delete(request.id);
            }
          },
          {
            label: "رفض",
            onClick: () => {
              rejectAbilityRequest(request.id);
              shownNotifications.delete(request.id);
            }
          }
        ]);
      }
    });
    
  } catch(error) {
    console.error("Error rendering ability requests:", error);
  }
}

// Force immediate sync between pages
function forceImmediateSync() {
  window.dispatchEvent(new CustomEvent('forceAbilitySync'));
  window.dispatchEvent(new CustomEvent('abilityUsageChanged'));
  
  setTimeout(() => {
    window.dispatchEvent(new StorageEvent('storage', {
      key: USED_ABILITIES_KEY,
      newValue: localStorage.getItem(USED_ABILITIES_KEY),
      oldValue: localStorage.getItem(USED_ABILITIES_KEY),
      storageArea: localStorage
    }));
  }, 10);
  
  setTimeout(() => {
    window.dispatchEvent(new StorageEvent('storage', {
      key: ABILITY_REQUESTS_KEY,
      newValue: localStorage.getItem(ABILITY_REQUESTS_KEY),
      oldValue: localStorage.getItem(ABILITY_REQUESTS_KEY),
      storageArea: localStorage
    }));
  }, 20);
  
  setTimeout(() => {
    window.dispatchEvent(new StorageEvent('storage', {
      key: P1_ABILITIES_KEY,
      newValue: localStorage.getItem(P1_ABILITIES_KEY),
      oldValue: localStorage.getItem(P1_ABILITIES_KEY),
      storageArea: localStorage
    }));
  }, 30);
  
  setTimeout(() => {
    window.dispatchEvent(new StorageEvent('storage', {
      key: P2_ABILITIES_KEY,
      newValue: localStorage.getItem(P2_ABILITIES_KEY),
      oldValue: localStorage.getItem(P2_ABILITIES_KEY),
      storageArea: localStorage
    }));
  }, 40);
  
  renderPanels();
  setTimeout(() => renderPanels(), 100);
  setTimeout(() => renderPanels(), 200);
}

// Approve ability request
function approveAbilityRequest(requestId){
  try {
    const requests = JSON.parse(localStorage.getItem('abilityRequests') || '[]');
    const request = requests.find(req => req.id === requestId);
    
    if (request) {
      // Update request status
      const updatedRequests = requests.map(req => 
        req.id === requestId ? { ...req, status: 'approved' } : req
      );
      localStorage.setItem('abilityRequests', JSON.stringify(updatedRequests));
      
      // Mark ability as permanently used for the requesting player
      const usedAbilitiesKey = `${request.playerParam}UsedAbilities`;
      const usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
      if (!usedAbilities.includes(request.abilityText)) {
        usedAbilities.push(request.abilityText);
        localStorage.setItem(usedAbilitiesKey, JSON.stringify(usedAbilities));
      }
      
      // Update abilities in both players' lists to show as used
      const player1Abilities = loadAbilities(P1_ABILITIES_KEY);
      const player2Abilities = loadAbilities(P2_ABILITIES_KEY);
      
      let abilityUpdated = false;
      player1Abilities.forEach(ability => {
        if (ability.text === request.abilityText) {
          ability.used = true;
          abilityUpdated = true;
        }
      });
      player2Abilities.forEach(ability => {
        if (ability.text === request.abilityText) {
          ability.used = true;
          abilityUpdated = true;
        }
      });
      
      if (abilityUpdated) {
        saveAbilities(P1_ABILITIES_KEY, player1Abilities);
        saveAbilities(P2_ABILITIES_KEY, player2Abilities);
      }
      
      // Also update the player-specific abilities list
      const playerAbilitiesKey = `${request.playerParam}Abilities`;
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
      const globalAbilitiesKey = request.playerParam === 'player1' ? 'P1_ABILITIES_KEY' : 'P2_ABILITIES_KEY';
      const globalAbilities = JSON.parse(localStorage.getItem(globalAbilitiesKey) || '[]');
      globalAbilities.forEach(ability => {
        if (ability.text === request.abilityText) {
          ability.used = true;
        }
      });
      localStorage.setItem(globalAbilitiesKey, JSON.stringify(globalAbilities));
      
      // Trigger storage event for player pages
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'abilityRequests',
        newValue: localStorage.getItem('abilityRequests'),
        oldValue: localStorage.getItem('abilityRequests'),
        storageArea: localStorage
      }));
      
      // Also trigger storage event for used abilities
      window.dispatchEvent(new StorageEvent('storage', {
        key: usedAbilitiesKey,
        newValue: localStorage.getItem(usedAbilitiesKey),
        oldValue: localStorage.getItem(usedAbilitiesKey),
        storageArea: localStorage
      }));
      
      renderPanels();
      setTimeout(() => renderPanels(), 50);
      setTimeout(() => renderPanels(), 100);
      
      showToast(`تمت الموافقة على استخدام ${request.abilityText} من ${request.playerName}`, []);
      
      shownNotifications.delete(requestId);
      
      console.log(`Approved ability: ${request.abilityText} for ${request.playerName}`);
    }
  } catch(error) {
    console.error("Error approving ability request:", error);
    showToast("حدث خطأ في الموافقة على الطلب", []);
  }
}

// Reject ability request
function rejectAbilityRequest(requestId){
  try {
    const requests = JSON.parse(localStorage.getItem('abilityRequests') || '[]');
    const request = requests.find(req => req.id === requestId);
    
    if (request) {
      // Update request status
      const updatedRequests = requests.map(req => 
        req.id === requestId ? { ...req, status: 'rejected' } : req
      );
      localStorage.setItem('abilityRequests', JSON.stringify(updatedRequests));
      
      // Remove ability from used abilities for the requesting player
      const usedAbilitiesKey = `${request.playerParam}UsedAbilities`;
      const usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
      const filteredAbilities = usedAbilities.filter(ability => ability !== request.abilityText);
      localStorage.setItem(usedAbilitiesKey, JSON.stringify(filteredAbilities));
      
      // Update abilities in both players' lists to show as available
      const player1Abilities = loadAbilities(P1_ABILITIES_KEY);
      const player2Abilities = loadAbilities(P2_ABILITIES_KEY);
      
      let abilityUpdated = false;
      player1Abilities.forEach(ability => {
        if (ability.text === request.abilityText) {
          ability.used = false;
          abilityUpdated = true;
        }
      });
      player2Abilities.forEach(ability => {
        if (ability.text === request.abilityText) {
          ability.used = false;
          abilityUpdated = true;
        }
      });
      
      if (abilityUpdated) {
        saveAbilities(P1_ABILITIES_KEY, player1Abilities);
        saveAbilities(P2_ABILITIES_KEY, player2Abilities);
      }
      
      // Trigger storage event for player pages
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'abilityRequests',
        newValue: localStorage.getItem('abilityRequests'),
        oldValue: localStorage.getItem('abilityRequests'),
        storageArea: localStorage
      }));
      
      renderPanels();
      setTimeout(() => renderPanels(), 50);
      setTimeout(() => renderPanels(), 100);
      
      showToast(`تم رفض استخدام ${request.abilityText} من ${request.playerName}`, []);
      
      shownNotifications.delete(requestId);
      
      console.log(`Rejected ability: ${request.abilityText} for ${request.playerName}`);
    }
  } catch(error) {
    console.error("Error rejecting ability request:", error);
    showToast("حدث خطأ في رفض الطلب", []);
  }
}

// Restore ability (make it available again for requesting)
function restoreAbility(abilityText, playerName) {
  try {
    console.log(`Restoring ability: ${abilityText} for ${playerName}`);
    
    // Find the player parameter for this player name
    let playerParam = null;
    if (playerName === player1) {
      playerParam = 'player1';
    } else if (playerName === player2) {
      playerParam = 'player2';
    }
    
    if (playerParam) {
      // Remove from used abilities for the specific player
      const usedAbilitiesKey = `${playerParam}UsedAbilities`;
      const usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
      const filteredAbilities = usedAbilities.filter(ability => ability !== abilityText);
      localStorage.setItem(usedAbilitiesKey, JSON.stringify(filteredAbilities));
    }
    
    // Update abilities in both players' lists to show as available
    const player1Abilities = loadAbilities(P1_ABILITIES_KEY);
    const player2Abilities = loadAbilities(P2_ABILITIES_KEY);
    
    let abilityUpdated = false;
    player1Abilities.forEach(ability => {
      if (ability.text === abilityText) {
        ability.used = false;
        abilityUpdated = true;
      }
    });
    player2Abilities.forEach(ability => {
      if (ability.text === abilityText) {
        ability.used = false;
        abilityUpdated = true;
      }
    });
    
    if (abilityUpdated) {
      saveAbilities(P1_ABILITIES_KEY, player1Abilities);
      saveAbilities(P2_ABILITIES_KEY, player2Abilities);
    }
    
    // Remove any pending requests for this ability
    const requests = JSON.parse(localStorage.getItem('abilityRequests') || '[]');
    const filteredRequests = requests.filter(req => 
      !(req.abilityText === abilityText && req.playerName === playerName)
    );
    localStorage.setItem('abilityRequests', JSON.stringify(filteredRequests));
    
    // Trigger storage event for player pages
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'abilityRequests',
      newValue: localStorage.getItem('abilityRequests'),
      oldValue: localStorage.getItem('abilityRequests'),
      storageArea: localStorage
    }));

    // ✅ إرسال إشعار مباشر للاعبين مثل toggle
    window.dispatchEvent(new CustomEvent('abilityToggled', {
      detail: {
        playerParam: playerParam,
        abilityText: abilityText,
        isUsed: false   // القدرة أصبحت غير مستخدمة (متاحة)
      }
    }));

    // ✅ إرسال postMessage للاعبين
    try {
      const message = {
        type: 'ABILITY_TOGGLED',
        playerParam: playerParam,
        abilityText: abilityText,
        isUsed: false
      };
      
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(message, '*');
      }
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(message, '*');
      }
      for (let i = 0; i < window.frames.length; i++) {
        try {
          window.frames[i].postMessage(message, '*');
        } catch (e) {}
      }
    } catch (e) {
      console.error('Error sending postMessage:', e);
    }

    renderPanels();
    setTimeout(() => renderPanels(), 50);
    setTimeout(() => renderPanels(), 100);
    
    showToast(`تم إعادة القدرة ${abilityText} لـ ${playerName}`, []);
    
    console.log(`Restored ability: ${abilityText} for ${playerName}`);
    return true;
  } catch(error) {
    console.error("Error restoring ability:", error);
    showToast("حدث خطأ في إعادة القدرة", []);
    return false;
  }
}

// Make functions globally available
window.approveAbilityRequest = approveAbilityRequest;
window.rejectAbilityRequest = rejectAbilityRequest;
window.restoreAbility = restoreAbility;

/* ---------------------- Transfer modal ---------------------- */
function openTransferModal(fromKey, fromName, toName){
  const list = loadAbilities(fromKey);
  const modal = document.getElementById("transferModal");
  const grid  = document.getElementById("abilityGrid");
  const title = document.getElementById("transferTitle");
  title.textContent = `اختر القدرة المراد نقلها إلى ${toName} (ستُزال منك)`;
  title.style.fontFamily = '"Cairo", sans-serif';

  grid.innerHTML="";
  if (!list.length){
    const p=document.createElement("p");
    p.style.color="#ffed7a"; p.textContent="لا توجد قدرات لنقلها.";
    p.style.fontFamily = '"Cairo", sans-serif';
    grid.appendChild(p);
  } else {
    list.forEach((ab, idx)=>{
      const opt=document.createElement("div");
      opt.className="ability-option";
      opt.style.fontFamily = '"Cairo", sans-serif';
      opt.textContent = ab.text;
      opt.onclick = ()=>{
        const sender = loadAbilities(fromKey);
        const moved  = sender.splice(idx,1)[0];
        saveAbilities(fromKey, sender);

        const toKey = (toName === player1) ? P1_ABILITIES_KEY : P2_ABILITIES_KEY;
        const receiver = loadAbilities(toKey);
        receiver.push({ text:moved.text, used:moved.used });
        saveAbilities(toKey, receiver);

        closeTransferModal();
        renderPanels();
        showToast(`تم نقل «${moved.text}» إلى ${toName}`);
      };
      grid.appendChild(opt);
    });
  }
  modal.classList.add("active");
}
function closeTransferModal(){ document.getElementById("transferModal").classList.remove("active"); }

// Open restore ability modal
function openRestoreModal(key, fromName, usedAbilities){
  const modal = document.getElementById("transferModal");
  const grid  = document.getElementById("abilityGrid");
  const title = document.getElementById("transferTitle");
  title.textContent = `اختر القدرة المراد استعادتها لـ ${fromName}`;
  title.style.fontFamily = '"Cairo", sans-serif';

  grid.innerHTML="";
  if (!usedAbilities.length){
    const p=document.createElement("p");
    p.style.color="#ffed7a"; p.textContent="لا توجد قدرات مستخدمة لاستعادتها.";
    p.style.fontFamily = '"Cairo", sans-serif';
    grid.appendChild(p);
  } else {
    usedAbilities.forEach((ab, idx)=>{
      const opt=document.createElement("div");
      opt.className="ability-option";
      opt.style.fontFamily = '"Cairo", sans-serif';
      opt.textContent = ab.text;
      opt.onclick = ()=>{
        restoreAbility(ab.text, fromName);
        closeTransferModal();
        renderPanels();
        showToast(`تم استعادة «${ab.text}» لـ ${fromName}`);
      };
      grid.appendChild(opt);
    });
  }
  modal.classList.add("active");
}

/* ---------------------- Health controls ---------------------- */
function wireHealth(name, decEl, incEl, valueEl){
  const clamp = (n)=>Math.max(0, Math.min(startingHP,n));
  const refresh = ()=>{ valueEl.textContent=String(scores[name]); valueEl.classList.toggle("red", scores[name] <= Math.ceil(startingHP/2)); };

  incEl.onclick = ()=>{ scores[name]=clamp(scores[name]+1); refresh(); localStorage.setItem("scores", JSON.stringify(scores)); };
  decEl.onclick = ()=>{ scores[name]=clamp(scores[name]-1); refresh(); localStorage.setItem("scores", JSON.stringify(scores)); };
  refresh();
}

/* ---------------------- Round render ---------------------- */
function renderRound(){
  // Reload picks dynamically before rendering
  picks = loadPlayerPicks();
  
  roundTitle.textContent = `الجولة ${round + 1}`;
  renderVs();
  renderPrev();
  renderPanels();

  wireHealth(player2, document.querySelector(".player-column .round-btn:last-child"), document.querySelector(".player-column .round-btn:first-child"), document.getElementById("health1"));
  wireHealth(player1, document.querySelector(".right-panel .round-btn:last-child"), document.querySelector(".right-panel .round-btn:first-child"), document.getElementById("health2"));
}

function confirmWinner(){
  localStorage.setItem("scores", JSON.stringify(scores));
  round++;
  localStorage.setItem("currentRound", round);

  const over = round >= roundCount || scores[player1] === 0 || scores[player2] === 0;
  if (over){
    localStorage.setItem("scores", JSON.stringify(scores));
    localStorage.removeItem(NOTES_KEY(player1));
    localStorage.removeItem(NOTES_KEY(player2));
    localStorage.removeItem(USED_ABILITIES_KEY);
    localStorage.removeItem(ABILITY_REQUESTS_KEY);
    shownNotifications.clear();
    
    // Show winner
    const winner = scores[player1] > scores[player2] ? player1 : scores[player2] > scores[player1] ? player2 : "تعادل";
    console.log(`انتهت المعركة! الفائز: ${winner}`);
    
    // Reset for new battle
    localStorage.setItem('currentRound', '0');
    location.href="final-result.html";
  } else {
    localStorage.removeItem(USED_ABILITIES_KEY);
    localStorage.removeItem(ABILITY_REQUESTS_KEY);
    shownNotifications.clear();
    location.reload();
  }
}

// Initialize game data if missing
function initializeGameData() {
  // First try to load from individual player ability keys (new system)
  const player1AbilitiesKey = 'player1Abilities';
  const player2AbilitiesKey = 'player2Abilities';
  
  let player1Abilities = [];
  let player2Abilities = [];
  
  // Load player 1 abilities
  if (localStorage.getItem(player1AbilitiesKey)) {
    try {
      const abilities = JSON.parse(localStorage.getItem(player1AbilitiesKey));
      if (Array.isArray(abilities)) {
        // Load used abilities for player 1
        const usedAbilities = JSON.parse(localStorage.getItem('player1UsedAbilities') || '[]');
        const usedSet = new Set(usedAbilities);
        
        player1Abilities = abilities.map(ability => {
          const abilityText = typeof ability === 'string' ? ability : ability.text || ability;
          return {
            text: abilityText,
            used: usedSet.has(abilityText) || (typeof ability === 'object' && ability.used === true)
          };
        });
        console.log('Loaded player1 abilities from new system:', player1Abilities);
      }
    } catch (e) {
      console.error('Error loading player1 abilities from new system:', e);
    }
  }
  
  // Load player 2 abilities
  if (localStorage.getItem(player2AbilitiesKey)) {
    try {
      const abilities = JSON.parse(localStorage.getItem(player2AbilitiesKey));
      if (Array.isArray(abilities)) {
        // Load used abilities for player 2
        const usedAbilities = JSON.parse(localStorage.getItem('player2UsedAbilities') || '[]');
        const usedSet = new Set(usedAbilities);
        
        player2Abilities = abilities.map(ability => {
          const abilityText = typeof ability === 'string' ? ability : ability.text || ability;
          return {
            text: abilityText,
            used: usedSet.has(abilityText) || (typeof ability === 'object' && ability.used === true)
          };
        });
        console.log('Loaded player2 abilities from new system:', player2Abilities);
      }
    } catch (e) {
      console.error('Error loading player2 abilities from new system:', e);
    }
  }
  
  // If we have abilities from new system, use them
  if (player1Abilities.length > 0 || player2Abilities.length > 0) {
    localStorage.setItem(P1_ABILITIES_KEY, JSON.stringify(player1Abilities));
    localStorage.setItem(P2_ABILITIES_KEY, JSON.stringify(player2Abilities));
    
    console.log('Abilities loaded from new system:', {
      player1: player1Abilities,
      player2: player2Abilities
    });
  } else {
    // Fallback: try to load from gameSetupProgress
    if (gameSetupProgress.player1?.abilities && gameSetupProgress.player2?.abilities) {
      const player1Abilities = gameSetupProgress.player1.abilities.map(ability => ({
        text: ability,
        used: false
      }));
      const player2Abilities = gameSetupProgress.player2.abilities.map(ability => ({
        text: ability,
        used: false
      }));
      
      localStorage.setItem(P1_ABILITIES_KEY, JSON.stringify(player1Abilities));
      localStorage.setItem(P2_ABILITIES_KEY, JSON.stringify(player2Abilities));
      
      console.log('Loaded abilities from gameSetupProgress:', {
        player1: gameSetupProgress.player1.abilities,
        player2: gameSetupProgress.player2.abilities
      });
    } else {
      // Set empty arrays if still no abilities found
      if (!localStorage.getItem(P1_ABILITIES_KEY)) {
        localStorage.setItem(P1_ABILITIES_KEY, JSON.stringify([]));
      }
      if (!localStorage.getItem(P2_ABILITIES_KEY)) {
        localStorage.setItem(P2_ABILITIES_KEY, JSON.stringify([]));
      }
    }
  }
  
  if (!gameSetupProgress.player1 || !gameSetupProgress.player2) {
    if (!localStorage.getItem("player1") || !localStorage.getItem("player2")) {
      localStorage.setItem("player1", "اكاي");
      localStorage.setItem("player2", "شانكس");
    }
    if (!localStorage.getItem("totalRounds")) {
      localStorage.setItem("totalRounds", "5");
    }
  }
  
  if (!scores[player1]) {
    scores[player1] = startingHP;
  }
  if (!scores[player2]) {
    scores[player2] = startingHP;
  }
  localStorage.setItem("scores", JSON.stringify(scores));
  
  if (!localStorage.getItem(USED_ABILITIES_KEY)) {
    localStorage.setItem(USED_ABILITIES_KEY, JSON.stringify({}));
  }
  
  if (!localStorage.getItem(ABILITY_REQUESTS_KEY)) {
    localStorage.setItem(ABILITY_REQUESTS_KEY, JSON.stringify([]));
  }
}

// Function to refresh card data dynamically
function refreshCardData() {
  console.log('Refreshing card data...');
  picks = loadPlayerPicks();
  console.log('Updated picks:', picks);
  renderRound();
}

// Initialize and render with error handling
try {
  initializeGameData();
  
  // Clear used abilities for new game if current round is 0
  const currentRound = parseInt(localStorage.getItem('currentRound') || '0');
  if (currentRound === 0) {
    clearUsedAbilities();
  }
  
  renderRound();
  
  // Listen for changes in used abilities from other pages
  window.addEventListener('storage', function(e) {
    if (e.key === USED_ABILITIES_KEY) {
      try {
        renderPanels();
      } catch(error) {
        console.error("Error re-rendering panels after storage change:", error);
      }
    }
    
    if (e.key === 'abilityRequests') {
      try {
        renderAbilityRequests();
        renderPanels();
      } catch(error) {
        console.error("Error re-rendering panels after ability requests change:", error);
      }
    }
    
    // Listen for gameSetupProgress changes to reload abilities and picks
    if (e.key === 'gameSetupProgress') {
      try {
        console.log('Game setup progress changed, reloading abilities and picks...');
        reloadAbilitiesFromGameSetup();
        
        // Reload gameSetupProgress and update picks
        gameSetupProgress = JSON.parse(localStorage.getItem("gameSetupProgress") || "{}");
        refreshCardData();
      } catch(error) {
        console.error("Error reloading abilities and picks after game setup change:", error);
      }
    }
    
    // Listen for player abilities changes
    if (e.key && (e.key.includes('Abilities') || e.key.includes('abilities'))) {
      try {
        console.log('Player abilities changed, reloading...');
        reloadAbilitiesFromGameSetup();
      } catch(error) {
        console.error("Error reloading abilities after player abilities change:", error);
      }
    }
    
    // Listen for ability usage changes
    if (e.key && e.key.includes('UsedAbilities')) {
      try {
        console.log('Ability usage changed, re-rendering panels...');
        renderPanels();
      } catch(error) {
        console.error("Error re-rendering panels after ability usage change:", error);
      }
    }
    
    // Listen for player abilities changes
    if (e.key && e.key.includes('Abilities')) {
      try {
        console.log('Player abilities changed, re-rendering panels...');
        renderPanels();
      } catch(error) {
        console.error("Error re-rendering panels after player abilities change:", error);
      }
    }
    
    // Listen for card arrangement changes
    if (e.key && (e.key.includes('CardArrangement') || e.key.includes('ArrangementCompleted'))) {
      try {
        console.log('Card arrangement changed, refreshing card data...');
        refreshCardData();
      } catch(error) {
        console.error("Error reloading picks after card arrangement change:", error);
      }
    }
    
    // Listen for Strategic order changes
    if (e.key && e.key.includes('StrategicOrdered')) {
      try {
        console.log('Strategic order changed, refreshing card data...');
        refreshCardData();
      } catch(error) {
        console.error("Error reloading picks after strategic order change:", error);
      }
    }
  });
  
  
  // Simple storage listener like result.js
  window.addEventListener('storage', function(e) {
    if (e.key && e.key.includes('Abilities')) {
      console.log(`Storage change detected: ${e.key}`);
      renderPanels();
    }
  });
  
  window.addEventListener('focus', function() {
    try {
      // Reload everything on focus
      console.log('Window focused, refreshing all data...');
      reloadAbilitiesFromGameSetup();
      refreshCardData();
      renderPanels();
    } catch(error) {
      console.error("Error re-rendering on focus:", error);
    }
  });
  
  // Listen for visibility changes
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      try {
        console.log('Tab visible, refreshing all data...');
        reloadAbilitiesFromGameSetup();
        refreshCardData();
        renderPanels();
      } catch(error) {
        console.error("Error re-rendering on visibility change:", error);
      }
    }
  });
  
  // Event listeners for ability system
  
  window.addEventListener('beforeunload', function() {
    shownNotifications.clear();
  });
  
} catch (error) {
  console.error("Error initializing game:", error);
  showToast("حدث خطأ في تحميل اللعبة. يرجى إعادة تحميل الصفحة.", []);
}

/* ---------------------- Confirm Result ---------------------- */
function confirmResult(){
  confirmWinner();
}

/* ---------------------- Health Controls ---------------------- */
function changeHealth(player, delta){
  try {
    const healthElement = document.getElementById(player === 'player1' ? 'health1' : 'health2');
    if (!healthElement) {
      console.error(`Health element not found for ${player}`);
      return;
    }
    
    const currentHealth = parseInt(healthElement.textContent) || 0;
    const newHealth = Math.max(0, Math.min(startingHP, currentHealth + delta));
    healthElement.textContent = newHealth;
    healthElement.classList.toggle("red", newHealth <= Math.ceil(startingHP/2));
    
    scores[player === 'player1' ? player1 : player2] = newHealth;
    localStorage.setItem("scores", JSON.stringify(scores));
  } catch(error) {
    console.error(`Error changing health for ${player}:`, error);
  }
}

/* ---------------------- Notes ---------------------- */
function saveNotes(player, value){
  try {
    const playerName = player === 'player1' ? player1 : player2;
    localStorage.setItem(NOTES_KEY(playerName), value);
  } catch(error) {
    console.error(`Error saving notes for ${player}:`, error);
  }
}

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
    
    // Re-render panels
    renderPanels();
  } catch (error) {
    console.error('Error clearing used abilities:', error);
  }
}