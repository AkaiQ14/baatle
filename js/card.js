// Import Firebase Sync Service
import syncService from './sync-service.js';
import { database } from './firebase-init.js';
import { ref, onChildAdded, onChildChanged, onValue, get, set, update, remove } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

// --- Game state ---
// ✅ نظام الملاحظات المحسن
// - مربع الملاحظات بسيط بدون أزرار مسح أو تسميات
// - المضيف يكتب ويمسح ملاحظات اللاعبين
// - لا يحدث أي تغيير في الملاحظات عند استخدام القدرات أبداً
// - كل لاعب يرى ملاحظاته فقط (لا تنتقل الملاحظات بين اللاعبين)
// - الملاحظات تُحفظ في localStorage وتبقى عبر الجولات
// - عند إعادة تحميل الصفحة تبقى الملاحظات محفوظة

// ✅ نظام دكة البدلاء المحسن
// - يحتفظ بالبطاقات العشوائية عبر تحديثات الصفحة
// - يعيد تعيين النظام فقط عند بدء لعبة جديدة حقيقية
// - يتحقق من حالة اللعبة قبل إعادة التعيين

// Voice system for Legendary cards
let voiceSystem = {
  isEnabled: true,
  volume: 0.7,
  currentAudio: null,
  audioQueue: [],
  isPlaying: false,
  isMuted: false,
  mutedVolume: 0.7,
  playedCards: new Set(), // Track which cards have already played their voice
  
  // Check if card is legendary by name patterns - Updated with all voice files
  isLegendaryByName: function(cardPath) {
    // All legendary cards that have voice files in voice/ directory
    const legendaryPatterns = [
      'aizen', 'AizenVoCrowCard', 'Akai', 'AllForOne', 'Ayanokoji', 'Ranppo', 'Todo', 'ZenoSama',
      // Removed: 'Asta', 
      'Beru', 'Cell', 'Sasuke', 'Vermoth', 'Ouki', 'Kakashi', 'Rukia', 'Akame', 'Sukuna', 'Azik',
      'Dio', 'ErenCard', 'foboki', 'Gin', 'Giyuu', 'Gogeta', 'Gohan Beast', 'Gojo', 'Yami', 'vegeta',
      // Removed: 'Goku UI', 
      'Hashirama', 'Hawks', 'Hinata', 'Hisoka', 'jiraya', 'Riboku', 'Lelouch', 'Utsuro', 'Kyurak', 'Shinobu',
      // Changed: 'joker' to 'Joker'
      'Joker', 'Kaido', 'KaitoKid', 'Kanki', 'Shigaraki', 'Roselle-Gustav', 'Broly', 'Chrollo',
      'law', 'Lelouch', 'LuffyGear5', 'madara', 'Meruem', 'naruto', 'Neiji', 'Netero', 'obito',
      'QG14', 'queen', 'Sakamoto', 'shikamaru', 'Shanks', 'Silva Zoldyck', 'smith', 'UmibozoCard',
      'Garp', 'Gilgamesh', 'Gintoki', 'Ippo', 'Makima', 'Musashi', 'Muzan', 'PrinceHata', 'Smiley',
      'Sung-Jinwoo', 'Takamura', 'Toji', 'Ulquiorra', 'Walker', 'Yamamoto', 'Yamato', 'Zaraki',
      'Zenon', 'Escanor', 'Saitama',
      // Removed: 'Vegetto', 
      'whitebeard', 'zoro', 'Zenitsu', 'Zeno', 'RockLee', 'AlocardCard', 'alocard', 'alucard', 'AloCard', // إضافة جميع الأسماء المحتملة
      // New voice files added
      'All-For-One', 'Goku Black', 'Yoriichi', 'Sonji', 'Bakugo', 'Itachi', 'Meliodas', 'AllMight', 'Roger', 'Yhwach', 'Midoriya',
      // Additional new voices
      'Goku-SSJ4', 'Goku-UI', 'Rengoku', 'Beerus', 'Lecht', 'zabuza', 'Ranpo', 'Urahara', 'Hiroto',
      'Goku-SSJG', 'Goku-SSJB', 'Gogeta', 'Vegito-Blue', 'Giyuu', 'X', 'Shadow', 'Unahanaa'
    ];
    
    const cardName = cardPath.split('/').pop().split('.')[0].toLowerCase();
    return legendaryPatterns.some(pattern => cardName.includes(pattern.toLowerCase()));
  },
  
  // Check if card is Legendary
  isLegendaryCard: function(cardPath) {
    if (!cardPath) return false;
    return cardPath.includes('Legendary/') || 
           cardPath.includes('images/') && this.isLegendaryByName(cardPath);
  },
  
  // Enhanced voice file name mapping - Exact match with voice files
  getVoiceFileName: function(cardPath) {
    if (!cardPath) return null;
    
    // Extract card name from path
    let cardName = cardPath.split('/').pop().split('.')[0];
    
    
    // Exact mapping to voice file names (case-sensitive)
    const voiceFileMappings = {
      // Existing mappings...
      'aizen': 'aizen',
      'Azik': 'Azik',
      'AizenVoCrowCard': 'AizenVoCrowCard',
      'Akai': 'Akai',
      'AllForOne': 'AllForOne',
      'AllMight': 'AllMight',
      'Ayanokoji': 'Ayanokoji',
      'Beru': 'Beru',
      'Bakugo': 'Bakugo',
      'Broly': 'Broly',
      'Cell': 'Cell',
      'Chrollo': 'Chrollo',
      'Dio': 'Dio',
      'ErenCard': 'ErenCard',
      'foboki': 'foboki',
      'Gin': 'Gin',
      'Gintoki': 'Gintoki',
      'Akame': 'Akame',
      'Giyuu': 'Giyuu',
      'Gilgamesh': 'Gilgamesh',
      'Gogeta': 'Gogeta',
      'Gohan Beast': 'Gohan Beast',
      'Gojo': 'Gojo',
      'Hashirama': 'Hashirama',
      'Hawks': 'Hawks',
      'Hinata': 'Hinata',
      'Hisoka': 'Hisoka',
      'Hiroto': 'Hiroto',
      'Itachi': 'Itachi',
      'jiraya': 'jiraya',
      'Yami': 'Yami',
      'vegeta': 'vegeta',
      'Escanor': 'Escanor',
      // Changed: 'joker': 'joker' to 'Joker': 'Joker'
      'Joker': 'Joker',
      'Kaido': 'Kaido',
      'KaitoKid': 'KaitoKid',
      'Kanki': 'Kanki',
      'Kyurak': 'Kyurak',
      'law': 'law',
      'Lelouch': 'Lelouch',
      'LuffyGear5': 'LuffyGear5',
      'madara': 'madara',
      'Meruem': 'Meruem',
      'Meliodas': 'Meliodas',
      'Midoriya': 'Midoriya',
      'naruto': 'naruto',
      'Netero': 'Netero',
      'obito': 'obito',
      'QG14': 'QG14',
      'Ouki': 'Ouki',
      'queen': 'queen',
      'Ranppo': 'Ranppo',
      'Riboku': 'Riboku',
      'Rukia': 'Rukia',
      'Kakashi': 'Kakashi',
      'Roselle-Gustav': 'Roselle-Gustav',
      'PrinceHata': 'PrinceHata',
      'Sakamoto': 'Sakamoto',
      'Sonji': 'Sonji',
      'shikamaru': 'shikamaru',
      'Shanks': 'Shanks',
      'Smiley': 'Smiley',
      'Silva Zoldyck': 'Silva Zoldyck',
      'Shigaraki': 'Shigaraki',
      'smith': 'smith',
      'Todo': 'Todo',
      'Sasuke': 'Sasuke',
      'Sung-Jinwoo': 'Sung-Jinwoo',
      'Takamura': 'Takamura',
      'Toji': 'Toji',
      'UmibozoCard': 'UmibozoCard',
      'Utsuro': 'Utsuro',
      'Urahara': 'Urahara',
      'whitebeard': 'whitebeard',
      'zabuza': 'zabuza',
      'zoro': 'Zoro',
      'Zoro': 'Zoro',
      'Zenitsu': 'Zenitsu',
      'Zeno': 'Zeno',
      'ZenoSama': 'ZenoSama',
      'Zaraki': 'Zaraki',
      'Neiji': 'Neiji',
      'RockLee': 'RockLee',
      'rocklee': 'RockLee',
      'Roger': 'Roger',
      'Shinobu': 'Shinobu',
      'Sukuna': 'Sukuna',
      'Ippo': 'Ippo',
      'Makima': 'Makima',
      'Musashi': 'Musashi',
      'Muzan': 'Muzan',
      // AlocardCard support
      'AlocardCard': 'AlocardCard',
      'alocardcard': 'AlocardCard',
      'Alocard': 'AlocardCard',
      'alocard': 'AlocardCard',
      'AloCard': 'AlocardCard',
      'alucard': 'AlocardCard',
      'Unahanaa': 'Unahanaa',
      'Ulquiorra': 'Ulquiorra',
      // New voice files added
      'All-For-One': 'All-For-One',
      'Goku Black': 'Goku Black',
      'Yoriichi': 'Yoriichi',
      'Yhwach': 'Yhwach',
      'zabuza': 'zabuza',
      'X': 'X',
      'Shadow': 'Shadow',
      // Additional new voices
      'Goku-SSJ4': 'Goku-SSJ4',
      'Garp': 'Garp',
      'Goku-UI': 'Goku-UI',
      'Rengoku': 'Rengoku',
      'Beerus': 'Beerus',
      'Goku-SSJG': 'Goku-SSJG',
      'Goku-SSJB': 'Goku-SSJB',
      'Gogeta': 'Gogeta',
      'Giyuu': 'Giyuu',
      'Lecht': 'Lecht',
      'Vegito-Blue': 'Vegito-Blue',
      'Vermoth': 'Vermoth',
      'Walker': 'Walker',
      'Yamamoto': 'Yamamoto',
      'Yamato': 'Yamato',
      'Zenon': 'Zenon',
      'Saitama': 'Saitama',
    };
    
    // Check for exact match first
    if (voiceFileMappings[cardName]) {
      return voiceFileMappings[cardName];
    }
    
    // Check for case-insensitive match
    const lowerCardName = cardName.toLowerCase();
    for (const [key, value] of Object.entries(voiceFileMappings)) {
      if (key.toLowerCase() === lowerCardName) {
        return value;
      }
    }
    
    // Handle common variations
    const cleanedName = cardName.replace('-card', '').replace('Card', '');
    if (voiceFileMappings[cleanedName]) {
      return voiceFileMappings[cleanedName];
    }
    
    // Final fallback - return original name (might work for simple cases)
    return cardName;
  },
  
  // Play voice for a card
  playVoice: function(cardPath, playerName, forcePlay = false) {
    if (!this.isEnabled || !this.isLegendaryCard(cardPath)) {
      console.log(`🎵 Voice disabled or not legendary: ${cardPath}`);
      return;
    }
    
    const voiceFileName = this.getVoiceFileName(cardPath);
    if (!voiceFileName) {
      console.log(`🎵 No voice file found for: ${cardPath}`);
      return;
    }
    
    // Create unique key for this card and player combination
    const cardKey = `${cardPath}_${playerName}`;
    
    // Check if this card has already played its voice (unless forced)
    if (this.playedCards.has(cardKey) && !forcePlay) {
      console.log(`🎵 Voice already played for ${playerName}: ${cardPath}`);
      return;
    }
    
    // Check if this exact voice is already playing or in queue to prevent duplicates
    const isAlreadyPlaying = this.audioQueue.some(audio => 
      audio.cardPath === cardPath && audio.playerName === playerName
    ) || (this.currentAudio && this.currentAudio.dataset.cardPath === cardPath && this.currentAudio.dataset.playerName === playerName);
    
    if (isAlreadyPlaying && !forcePlay) {
      console.log(`🎵 Voice already playing or queued for ${playerName}: ${cardPath}`);
      return;
    }
    
    const audioPath = `voice/${voiceFileName}.mp3`;
    console.log(`🎵 Playing voice for ${playerName}: ${audioPath}`);
    
    // Mark this card as played
    this.playedCards.add(cardKey);
    
    // Save last voice for this player
    this.saveLastVoiceForPlayer(playerName, cardPath);
    
    // Add to queue
    this.audioQueue.push({
      path: audioPath,
      playerName: playerName,
      cardPath: cardPath,
      voiceFileName: voiceFileName
    });
    
    // Start playing if not already playing
    if (!this.isPlaying) {
      this.playNextInQueue();
    }
  },
  
  // Play next audio in queue
  playNextInQueue: function() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }
    
    const audioData = this.audioQueue.shift();
    this.isPlaying = true;
    
    // Stop current audio if playing
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    
    // Create new audio
    this.currentAudio = new Audio(audioData.path);
    this.currentAudio.volume = this.volume;
    
    // Store metadata for duplicate checking
    this.currentAudio.dataset.cardPath = audioData.cardPath;
    this.currentAudio.dataset.playerName = audioData.playerName;
    
    // Handle audio events
    this.currentAudio.onended = () => {
      console.log(`🎵 Finished playing voice for ${audioData.playerName}`);
      this.currentAudio = null;
      this.playNextInQueue();
    };
    
    this.currentAudio.onerror = (error) => {
      console.warn(`🎵 Error playing voice ${audioData.path}:`, error);
      this.currentAudio = null;
      this.playNextInQueue();
    };
    
    // Play the audio
    this.currentAudio.play().catch(error => {
      console.warn(`🎵 Failed to play voice ${audioData.path}:`, error);
      this.currentAudio = null;
      this.playNextInQueue();
    });
  },
  
  // Replay voice for a specific player
  replayVoice: function(playerName) {
    // Find the last played voice for this player
    const lastVoice = this.getLastVoiceForPlayer(playerName);
    if (lastVoice) {
      console.log(`🎵 Replaying voice for ${playerName}`);
      this.playVoice(lastVoice.cardPath, playerName, true); // forcePlay = true
    }
  },
  
  // Get last voice played for a player
  getLastVoiceForPlayer: function(playerName) {
    // Get the last played voice from localStorage
    const lastVoiceKey = `lastVoice_${playerName}`;
    const lastVoice = localStorage.getItem(lastVoiceKey);
    
    if (lastVoice) {
      try {
        return JSON.parse(lastVoice);
      } catch (e) {
        console.warn('Error parsing last voice data:', e);
      }
    }
    
    // Fallback to current round's card
    const currentCard = this.getCurrentCardForPlayer(playerName);
    if (currentCard && this.isLegendaryCard(currentCard)) {
      return {
        cardPath: currentCard,
        playerName: playerName
      };
    }
    return null;
  },
  
  // Save last played voice for a player
  saveLastVoiceForPlayer: function(playerName, cardPath) {
    if (!this.isLegendaryCard(cardPath)) return;
    
    const voiceData = {
      cardPath: cardPath,
      playerName: playerName,
      timestamp: Date.now()
    };
    
    const lastVoiceKey = `lastVoice_${playerName}`;
    localStorage.setItem(lastVoiceKey, JSON.stringify(voiceData));
  },
  
  // Get current card for a player
  getCurrentCardForPlayer: function(playerName) {
    if (playerName === player1) {
      return picks?.[player1]?.[round];
    } else if (playerName === player2) {
      return picks?.[player2]?.[round];
    }
    return null;
  },
  
  // Stop current audio
  stopAudio: function() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.audioQueue = [];
    this.isPlaying = false;
  },
  
  // Clear previous voices for new round
  clearPreviousVoices: function() {
    // Stop current audio
    this.stopAudio();
    
    // Clear localStorage for both players
    try {
      localStorage.removeItem(`lastVoice_${player1}`);
      localStorage.removeItem(`lastVoice_${player2}`);
      console.log('🎵 Previous voices cleared for new round');
    } catch (error) {
      console.warn('Error clearing previous voices:', error);
    }
  },
  
  // Set volume
  setVolume: function(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    // ✅ تحديث الصوت الحالي في voiceSystem
    if (this.currentAudio) {
      this.currentAudio.volume = this.volume;
    }
    // ✅ تحديث الصوت النشط للبطاقة اليسرى (لاعب 2)
    if (window.leftCurrentAudio) {
      window.leftCurrentAudio.volume = this.volume;
    }
    // ✅ تحديث الصوت النشط للبطاقة اليمنى (لاعب 1)
    if (window.rightCurrentAudio) {
      window.rightCurrentAudio.volume = this.volume;
    }
    // ✅ تحديث جميع الأصوات المحملة مسبقاً (preloadedVoices)
    if (typeof preloadedVoices !== 'undefined') {
      for (const audioPath in preloadedVoices) {
        if (preloadedVoices[audioPath]) {
          preloadedVoices[audioPath].volume = this.volume;
        }
      }
    }
  },
  
  // Toggle mute (temporary mute, not disable system)
  toggleMute: function() {
    this.isMuted = !this.isMuted;
    
    if (this.isMuted) {
      // Mute: pause current audio and set volume to 0
      if (this.currentAudio) {
        this.currentAudio.pause();
      }
      // ✅ إيقاف الصوت النشط للبطاقة اليسرى
      if (window.leftCurrentAudio) {
        window.leftCurrentAudio.pause();
        window.leftCurrentAudio.volume = 0;
      }
      // ✅ إيقاف الصوت النشط للبطاقة اليمنى
      if (window.rightCurrentAudio) {
        window.rightCurrentAudio.pause();
        window.rightCurrentAudio.volume = 0;
      }
      this.mutedVolume = this.volume; // Save current volume
      this.volume = 0;
    } else {
      // Unmute: restore volume and resume if audio was playing
      this.volume = this.mutedVolume || 0.7; // Restore saved volume or default
      if (this.currentAudio) {
        this.currentAudio.volume = this.volume;
        this.currentAudio.play().catch(e => console.log('Could not resume audio:', e));
      }
      // ✅ استعادة الصوت النشط للبطاقة اليسرى
      if (window.leftCurrentAudio) {
        window.leftCurrentAudio.volume = this.volume;
        if (!window.leftCurrentAudio.ended) {
          window.leftCurrentAudio.play().catch(e => console.log('Could not resume left audio:', e));
        }
      }
      // ✅ استعادة الصوت النشط للبطاقة اليمنى
      if (window.rightCurrentAudio) {
        window.rightCurrentAudio.volume = this.volume;
        if (!window.rightCurrentAudio.ended) {
          window.rightCurrentAudio.play().catch(e => console.log('Could not resume right audio:', e));
        }
      }
    }
    
    return !this.isMuted; // Return true if unmuted, false if muted
  },
  
  // Test function to verify all legendary cards have voice files
  testAllLegendaryVoices: function() {
    console.log('🎵 Testing all legendary voice mappings...');
    
    const testCards = [
      // All card data has been removed - ready for new cards
    ];
    
    testCards.forEach(cardPath => {
      const isLegendary = this.isLegendaryCard(cardPath);
      const voiceFileName = this.getVoiceFileName(cardPath);
      const audioPath = voiceFileName ? `voice/${voiceFileName}.mp3` : 'N/A';
      
      console.log(`🎵 ${cardPath}: Legendary=${isLegendary}, Voice=${voiceFileName}, Path=${audioPath}`);
    });
    
    // Test actual audio loading
    this.testAudioLoading();
  },
  
  
  // Test actual audio file loading
  testAudioLoading: function() {
    console.log('🎵 Testing audio file accessibility...');
    
    const testVoiceFiles = ['aizen', 'Akai', 'law', 'smith'];
    
    testVoiceFiles.forEach(voiceFile => {
      const audioPath = `voice/${voiceFile}.mp3`;
      const audio = new Audio(audioPath);
      
      audio.oncanplaythrough = () => {
        console.log(`✅ Audio accessible: ${audioPath}`);
      };
      
      audio.onerror = (error) => {
        console.log(`❌ Audio not accessible: ${audioPath}`, error);
      };
      
      // Trigger the check
      audio.load();
    });
  }
};

// Create voice control buttons
function createVoiceControls() {
  // Remove existing voice controls to prevent duplicates
  const existingControls = document.querySelectorAll('.voice-controls');
  existingControls.forEach(control => control.remove());
  
  // Create voice controls container
  const voiceControlsContainer = document.createElement('div');
  voiceControlsContainer.className = 'voice-controls';
  voiceControlsContainer.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 2000;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
  `;
  
  // Mute/Unmute Button (Circular)
  const muteButton = document.createElement('button');
  muteButton.className = 'mute-button';
  muteButton.style.cssText = `
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: 4px solid #f3c21a;
    background: #f3c21a;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(243, 194, 26, 0.3);
  `;
  
  // Set initial icon based on mute state
  muteButton.innerHTML = !voiceSystem.isMuted ? 
    '<span style="color: #87CEEB;">🔊</span>' : 
    '<span style="color: #87CEEB;">🔇</span>';
  
  muteButton.onclick = function() {
    const isUnmuted = voiceSystem.toggleMute();
    this.innerHTML = isUnmuted ? 
      '<span style="color: #87CEEB;">🔊</span>' : 
      '<span style="color: #87CEEB;">🔇</span>';
  };
  
  muteButton.onmouseover = function() {
    this.style.transform = 'scale(1.05)';
    this.style.boxShadow = '0 6px 20px rgba(243, 194, 26, 0.4)';
  };
  
  muteButton.onmouseout = function() {
    this.style.transform = 'scale(1)';
    this.style.boxShadow = '0 4px 15px rgba(243, 194, 26, 0.3)';
  };
  
  // Volume Control Container (Simple and Clean)
  const volumeContainer = document.createElement('div');
  volumeContainer.style.cssText = `
    width: 120px;
    height: 40px;
    border: 2px solid #f3c21a;
    border-radius: 20px;
    background: rgba(26, 10, 15, 0.9);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 15px;
    box-sizing: border-box;
  `;
  
  // Volume Percentage Display
  const volumeDisplay = document.createElement('span');
  volumeDisplay.className = 'volume-display';
  volumeDisplay.textContent = Math.round(voiceSystem.volume * 100) + '%';
  volumeDisplay.style.cssText = `
    color: #f3c21a;
    font-family: "Cairo", sans-serif;
    font-weight: bold;
    font-size: 14px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    pointer-events: none;
  `;
  
  // Volume Slider (Native HTML5 range input)
  const volumeSlider = document.createElement('input');
  volumeSlider.type = 'range';
  volumeSlider.min = '0';
  volumeSlider.max = '200';  // Changed from '100' to '200'
  volumeSlider.value = Math.round(voiceSystem.volume * 200);  // Adjust calculation to match new range
  volumeSlider.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    margin: 0;
    z-index: 2;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
  `;
  
  // Custom slider styling for webkit browsers
  volumeSlider.style.webkitAppearance = 'none';
  volumeSlider.style.appearance = 'none';
  
  // Update volume display
  function updateVolumeDisplay(value) {
    const percentage = Math.round(value);
    volumeDisplay.textContent = percentage + '%';
  }
  
  // Set initial position
  updateVolumeDisplay(voiceSystem.volume * 200);
  
  // Volume control events
  volumeSlider.oninput = function() {
    const value = parseInt(this.value);
    voiceSystem.setVolume(value / 200);  // Adjust calculation to match new range
    updateVolumeDisplay(value);
  };
  
  // Add elements to volume container
  volumeContainer.appendChild(volumeDisplay);
  volumeContainer.appendChild(volumeSlider);
  
  // Add elements to main container
  voiceControlsContainer.appendChild(muteButton);
  voiceControlsContainer.appendChild(volumeContainer);
  
  // Add to document
  document.body.appendChild(voiceControlsContainer);
  
  console.log('🎵 Voice controls created with new design');
}

// Helper function to get player name from all possible sources
function getPlayerName(playerNumber) {
  try {
    // Try to get from gameSetupProgress first
    if (gameSetupProgress && gameSetupProgress[`player${playerNumber}`]?.name) {
      console.log(`🎵 Found player ${playerNumber} name in gameSetupProgress.player${playerNumber}.name: ${gameSetupProgress[`player${playerNumber}`].name}`);
      return gameSetupProgress[`player${playerNumber}`].name;
    }
    
    // Try alternative naming convention
    if (gameSetupProgress && gameSetupProgress[`player${playerNumber}Name`]) {
      console.log(`🎵 Found player ${playerNumber} name in gameSetupProgress.player${playerNumber}Name: ${gameSetupProgress[`player${playerNumber}Name`]}`);
      return gameSetupProgress[`player${playerNumber}Name`];
    }
    
    // Try localStorage
    const fromStorage = localStorage.getItem(`player${playerNumber}`);
    if (fromStorage) {
      console.log(`🎵 Found player ${playerNumber} name in localStorage: ${fromStorage}`);
      return fromStorage;
    }
    
    // Fallback to default
    console.log(`🎵 Using fallback name for player ${playerNumber}: لاعب ${playerNumber}`);
    return `لاعب ${playerNumber}`;
  } catch (error) {
    console.error(`Error getting player ${playerNumber} name:`, error);
    return `لاعب ${playerNumber}`;
  }
}

// Create replay buttons under abilities
function createReplayButtons() {
  // Remove existing replay buttons
  const existingReplayButtons = document.querySelectorAll('.replay-buttons');
  existingReplayButtons.forEach(button => button.remove());
  
  // Debug: Print all player name sources
  console.log('🎵 === PLAYER NAME DEBUG ===');
  console.log('🎵 gameSetupProgress:', gameSetupProgress);
  console.log('🎵 localStorage player1:', localStorage.getItem("player1"));
  console.log('🎵 localStorage player2:', localStorage.getItem("player2"));
  console.log('🎵 Current player1 variable:', player1);
  console.log('🎵 Current player2 variable:', player2);
  
  // Check DOM elements
  const rightPlayerNameElement = document.querySelector('.right-panel .name');
  const leftPlayerNameElement = document.querySelector('.player-column .name');
  console.log('🎵 Right panel player name (DOM):', rightPlayerNameElement ? rightPlayerNameElement.textContent.trim() : 'NOT FOUND');
  console.log('🎵 Left panel player name (DOM):', leftPlayerNameElement ? leftPlayerNameElement.textContent.trim() : 'NOT FOUND');
  
  const debugPlayer1 = getPlayerName(1);
  const debugPlayer2 = getPlayerName(2);
  console.log('🎵 getPlayerName(1) result:', debugPlayer1);
  console.log('🎵 getPlayerName(2) result:', debugPlayer2);
  console.log('🎵 === END DEBUG ===');
  
  // Create replay button for player 1 (right side) - اللاعب الأول
  const replayPlayer1 = document.createElement('button');
  replayPlayer1.className = 'replay-buttons';
  replayPlayer1.textContent = '🔄 إعادة التشغيل';
  replayPlayer1.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 10px 15px;
    background: linear-gradient(145deg, #3b82f6, #2563eb);
    color: white;
    border: 2px solid #fff;
    border-radius: 10px;
    font-family: "Cairo", sans-serif;
    font-weight: bold;
    font-size: 12px;
    cursor: pointer;
    z-index: 1500;
    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
    transition: all 0.3s ease;
  `;
  replayPlayer1.onclick = function() {
    // الزر الأيمن للاعب الأيسر - قراءة الاسم من العنصر الموجود على الشاشة
    const leftPlayerNameElement = document.querySelector('.player-column .name');
    const currentPlayer = leftPlayerNameElement ? leftPlayerNameElement.textContent.trim() : getPlayerName(2);
    console.log(`🎵 Replay button clicked for Left Player (Right Button): ${currentPlayer}`);
    voiceSystem.replayVoice(currentPlayer);
  };
  replayPlayer1.onmouseover = function() {
    this.style.transform = 'translateY(-2px)';
    this.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)';
  };
  replayPlayer1.onmouseout = function() {
    this.style.transform = 'translateY(0)';
    this.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.3)';
  };
  
  // Create replay button for player 2 (left side) - اللاعب الثاني
  const replayPlayer2 = document.createElement('button');
  replayPlayer2.className = 'replay-buttons';
  replayPlayer2.textContent = '🔄 إعادة التشغيل';
  replayPlayer2.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    padding: 10px 15px;
    background: linear-gradient(145deg, #3b82f6, #2563eb);
    color: white;
    border: 2px solid #fff;
    border-radius: 10px;
    font-family: "Cairo", sans-serif;
    font-weight: bold;
    font-size: 12px;
    cursor: pointer;
    z-index: 1500;
    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
    transition: all 0.3s ease;
  `;
  replayPlayer2.onclick = function() {
    // الزر الأيسر للاعب الأيمن - قراءة الاسم من العنصر الموجود على الشاشة
    const rightPlayerNameElement = document.querySelector('.right-panel .name');
    const currentPlayer = rightPlayerNameElement ? rightPlayerNameElement.textContent.trim() : getPlayerName(1);
    console.log(`🎵 Replay button clicked for Right Player (Left Button): ${currentPlayer}`);
    voiceSystem.replayVoice(currentPlayer);
  };
  replayPlayer2.onmouseover = function() {
    this.style.transform = 'translateY(-2px)';
    this.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)';
  };
  replayPlayer2.onmouseout = function() {
    this.style.transform = 'translateY(0)';
    this.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.3)';
  };
  
  // Add to document
  document.body.appendChild(replayPlayer1);
  document.body.appendChild(replayPlayer2);
  
  console.log('🎵 Replay buttons created');
}

/**
 * Reset swap deck system for new games only
 */
function resetSwapDeckSystem() {
  try {
    // Check if this is a real new game
    const gameSetupProgress = localStorage.getItem('gameSetupProgress');
    
    if (gameSetupProgress === 'completed') {
      // Game is in progress, don't reset
      console.log('🎴 Game in progress, keeping swap deck data');
      return;
    }
    
    // This is a new game, reset swap deck system
    console.log('🎴 New game detected, resetting swap deck system');
    
    // Reset swap deck system if available
    if (window.swapDeckSystem && typeof window.swapDeckSystem.resetSwapDeckSystem === 'function') {
      window.swapDeckSystem.resetSwapDeckSystem();
    }
    
    // Clear generated cards to force regeneration for new game
    localStorage.removeItem('generatedCards');
    
    // Reset global card generation variables
    if (window.gameCardsGenerated) {
      window.gameCardsGenerated = false;
      window.gameCardsData = {
        player1Cards: [],
        player2Cards: []
      };
      console.log('🔄 Reset global card generation variables');
    }
    
    console.log('✅ Swap deck system reset for new game');
    
  } catch (error) {
    console.error('❌ Error resetting swap deck system:', error);
  }
}

// Call reset function when page loads
document.addEventListener('DOMContentLoaded', function() {
  resetSwapDeckSystem();
});

// Load game data from gameSetupProgress with error handling
let gameSetupProgress = {};
try {
  gameSetupProgress = JSON.parse(localStorage.getItem("gameSetupProgress") || "{}");
} catch (error) {
  console.warn("Error parsing gameSetupProgress:", error);
  gameSetupProgress = {};
}

// Determine game mode via adapters and load config
// ✅ استخدام GameModeNormal فقط (تم حذف mode-tournament.js)
const modeAdapter = window.GameModeNormal;

const modeConfig = modeAdapter.loadConfig({ rounds: 5, player1: "لاعب 1", player2: "لاعب 2" });

let isTournament = !!modeConfig.isTournament;
let roundCount = modeConfig.roundCount;
let startingHP = modeConfig.startingHP;
let player1 = modeConfig.player1;
let player2 = modeConfig.player2;

console.log('Mode config loaded:', { isTournament, roundCount, startingHP, player1, player2 });

// Dynamic picks loading function
function loadPlayerPicks() {
  let picks = {};
  
  try {
    // Aggressive data clearing before loading
    const gameId = sessionStorage.getItem('currentGameId');
    const matchId = localStorage.getItem('currentMatchId');
    
    if (!gameId && !matchId) {
      console.log('🧹 No active game found. Clearing ALL game-related localStorage data');
      Object.keys(localStorage).forEach(key => {
        const gameRelatedPatterns = [
          'StrategicPicks', 
          'StrategicOrdered', 
          'CardArrangement', 
          'ArrangementCompleted',
          'player1', 
          'player2',
          'orderSubmitted_',
          'gameCardSelection'
        ];
        
        if (gameRelatedPatterns.some(pattern => key.includes(pattern))) {
          console.log(`🗑️ Removing stale game-related key: ${key}`);
          localStorage.removeItem(key);
        }
      });
      
      // Return empty picks
      return {
        player1: [],
        player2: []
      };
    }
    
    // First priority: Load from StrategicOrdered (final arrangement from player-cards.html)
    const player1Order = localStorage.getItem('player1StrategicOrdered');
    const player2Order = localStorage.getItem('player2StrategicOrdered');
    
    console.log('Checking StrategicOrdered data:', { player1Order, player2Order });
    
    if (player1Order && player2Order) {
      try {
        const player1Ordered = JSON.parse(player1Order);
        const player2Ordered = JSON.parse(player2Order);
        
        console.log('Parsed StrategicOrdered data:', { player1Ordered, player2Ordered });
        
        if (Array.isArray(player1Ordered) && Array.isArray(player2Ordered) && 
            player1Ordered.length > 0 && player2Ordered.length > 0) {
          picks[player1] = [...player1Ordered];
          picks[player2] = [...player2Ordered];
          console.log('✅ Loaded picks from StrategicOrdered:', { player1: picks[player1], player2: picks[player2] });
          return picks;
        } else {
          console.log('❌ StrategicOrdered data is empty or invalid');
        }
      } catch (e) {
        console.warn('Error parsing StrategicOrdered:', e);
      }
    } else {
      console.log('❌ StrategicOrdered data not found in localStorage');
    }
    
    // Second priority: Load from StrategicPicks (selected cards from cards-setup.js)
    const player1Picks = localStorage.getItem('player1StrategicPicks');
    const player2Picks = localStorage.getItem('player2StrategicPicks');
    
    if (player1Picks && player2Picks)
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

// ✅ متغيرات لتتبع الصوت النشط الحالي لكل بطاقة
let leftCurrentAudio = null;
let rightCurrentAudio = null;

// ✅ جعل المتغيرات متاحة عبر window للوصول إليها من voiceSystem
window.leftCurrentAudio = leftCurrentAudio;
window.rightCurrentAudio = rightCurrentAudio;

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
// ✅ مفتاح حفظ الملاحظات - تبقى محفوظة للجولات التالية
const NOTES_KEY = (name, roundNumber = null) => {
  const currentRound = roundNumber !== null ? roundNumber : round;
  return `notes:${name}:round${currentRound}`;
};
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
// Track processed requests to avoid duplicates
let processedRequests = new Set();

// ✅ دالة لترميز المعرف بشكل آمن
function safeEncodeId(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/=/g, '')        // إزالة علامات "="
      .replace(/\+/g, '-')      // استبدال الرموز غير المسموح بها
      .replace(/\//g, '_');
  } catch (e) {
    console.warn('⚠️ فشل ترميز المعرف، استخدام بديل:', e);
    return 'popup_' + Date.now(); // بديل آمن مؤقت
  }
}

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
    
    // ✅ محاولة تحميل القدرات من المفتاح المباشر أولاً
    let abilities = JSON.parse(localStorage.getItem(abilitiesKey) || '[]');
    
    // ✅ إذا لم توجد في المفتاح المباشر، جرب المفاتيح العامة
    if (!abilities || abilities.length === 0) {
      const globalKey = playerParam === 'player1' ? P1_ABILITIES_KEY : P2_ABILITIES_KEY;
      abilities = JSON.parse(localStorage.getItem(globalKey) || '[]');
    }
    
    // ✅ التأكد من أن abilities مصفوفة
    if (!Array.isArray(abilities)) {
      console.warn(`⚠️ abilities للاعب ${playerParam} ليست مصفوفة:`, abilities);
      abilities = [];
    }
    
    // ✅ تحميل القدرات المستخدمة
    let usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
    if (!Array.isArray(usedAbilities)) {
      // إذا كانت كائن، حولها إلى مصفوفة
      if (typeof usedAbilities === 'object' && usedAbilities !== null) {
        usedAbilities = Object.values(usedAbilities).map(item => {
          if (typeof item === 'string') return item;
          if (typeof item === 'object' && item !== null) {
            return item.text || item.abilityText || item;
          }
          return item;
        });
      } else {
        usedAbilities = [];
      }
    }
    
    // ✅ تصفية القدرات المستخدمة لتكون نصوص فقط
    usedAbilities = usedAbilities.filter(item => typeof item === 'string' && item.length > 0);
    const usedSet = new Set(usedAbilities);
    
    // ✅ تحويل القدرات إلى الصيغة الموحدة مع الحفاظ على جميع القدرات
    const formattedAbilities = abilities.map(ability => {
      const abilityText = typeof ability === 'string' ? ability : (ability.text || ability);
      const isUsed = usedSet.has(abilityText) || (typeof ability === 'object' && ability.used === true);
      return {
        text: abilityText,
        used: isUsed
      };
    });
    
    console.log(`✅ تم تحميل ${formattedAbilities.length} قدرة للاعب ${playerParam}`);
    return formattedAbilities;
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

// ✅ الخطوة 1: السماح بتشغيل الأصوات بعد أول تفاعل من المستخدم (Chrome Audio Policy)
document.addEventListener("click", enableAudioPlaybackOnce, { once: true });
document.addEventListener("keydown", enableAudioPlaybackOnce, { once: true });

function enableAudioPlaybackOnce() {
  try {
    const dummy = new Audio();
    dummy.muted = true;
    dummy.play().then(() => {
      console.log("🔊 Audio playback unlocked for Chrome");
    }).catch(() => {});
  } catch(e) {}
}

// ✅ نظام تهيئة الصوت مسبقًا لتفادي أي تأخير
const preloadedVoices = {};

function preloadVoice(cardPath) {
  if (!voiceSystem || !voiceSystem.isLegendaryCard(cardPath)) return;
  
  const voiceFileName = voiceSystem.getVoiceFileName(cardPath);
  const audioPath = `voice/${voiceFileName}.mp3`;
  
  if (!preloadedVoices[audioPath]) {
    const audio = new Audio(audioPath);
    audio.preload = "auto";
    audio.load();
    preloadedVoices[audioPath] = audio;
    console.log(`🎧 Preloaded voice: ${audioPath}`);
  }
  
  return preloadedVoices[audioPath];
}

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

  // ✅ إيقاف أي صوت نشط من الجولة السابقة
  if (leftCurrentAudio) {
    leftCurrentAudio.pause();
    leftCurrentAudio.currentTime = 0;
    leftCurrentAudio = null;
    window.leftCurrentAudio = null;
  }
  if (rightCurrentAudio) {
    rightCurrentAudio.pause();
    rightCurrentAudio.currentTime = 0;
    rightCurrentAudio = null;
    window.rightCurrentAudio = null;
  }

  // Smooth card loading without clearing first
  // ✅ نبدأ ببطاقة اللاعب الأول (الأيمن) ثم الثاني (الأيسر)
  
  // ➡️ الكرت الأيمن (لاعب 1) - يبدأ أولاً
  let rightCardHasVoice = false;
  if (rightCard) {
    const rightCardSrc = picks?.[player1]?.[round];
    if (rightCardSrc) {
      const newMedia = createMedia(rightCardSrc, "");
      rightCard.innerHTML = "";
      rightCard.appendChild(newMedia);

      // ✅ التحقق من أن البطاقة أسطورية
      if (voiceSystem && voiceSystem.isLegendaryCard(rightCardSrc)) {
        rightCardHasVoice = true;
        const voiceFileName = voiceSystem.getVoiceFileName(rightCardSrc);
        const audioPath = `voice/${voiceFileName}.mp3`;

        // ✅ حمّل الصوت مسبقًا إذا لم يكن جاهزًا
        preloadVoice(rightCardSrc);
        const audio = preloadedVoices[audioPath];
        
        if (audio) {
          audio.currentTime = 0;
          audio.volume = voiceSystem.volume;
          
          // ✅ حفظ المرجع للصوت الحالي
          rightCurrentAudio = audio;
          window.rightCurrentAudio = rightCurrentAudio;

          // ✅ الصوت يبدأ في نفس لحظة ظهور الكرت فعليًا
          if (newMedia.tagName === "VIDEO") {
            newMedia.addEventListener("playing", () => {
              audio.play().catch(err => console.warn("⚠️ Audio play error:", err));
            }, { once: true });
          } else if (newMedia.tagName === "IMG") {
            newMedia.addEventListener("load", () => {
              audio.play().catch(err => console.warn("⚠️ Audio play error:", err));
            }, { once: true });
          }

          // ✅ تنظيف المرجع عند انتهاء الصوت
          audio.addEventListener("ended", () => {
            if (rightCurrentAudio === audio) {
              rightCurrentAudio = null;
              window.rightCurrentAudio = null;
            }
            // ✅ عند انتهاء صوت اللاعب الأول، نبدأ صوت اللاعب الثاني إن وجد
            if (leftCurrentAudio) {
              // ✅ التأكد من أن الصوت الثاني جاهز ولم يبدأ بعد
              if (leftCurrentAudio.readyState >= 2 && (leftCurrentAudio.paused || leftCurrentAudio.currentTime === 0)) {
                leftCurrentAudio.currentTime = 0;
                leftCurrentAudio.play().catch(err => console.warn("⚠️ فشل تشغيل الصوت الثاني:", err));
              } else if (leftCurrentAudio.readyState < 2) {
                // إذا لم يكن الصوت جاهزاً بعد، ننتظر حتى يصبح جاهزاً
                leftCurrentAudio.addEventListener("canplay", () => {
                  if (leftCurrentAudio && (leftCurrentAudio.paused || leftCurrentAudio.currentTime === 0)) {
                    leftCurrentAudio.currentTime = 0;
                    leftCurrentAudio.play().catch(err => console.warn("⚠️ فشل تشغيل الصوت الثاني:", err));
                  }
                }, { once: true });
              }
            }
          }, { once: true });
        }
      }
    } else {
      rightCard.innerHTML = '<div class="empty-hint">لا توجد بطاقة لهذه الجولة</div>';
    }
  }

  // ⬅️ الكرت الأيسر (لاعب 2) - يبدأ بعد انتهاء الأول
  if (leftCard) {
    const leftCardSrc = picks?.[player2]?.[round];
    if (leftCardSrc) {
      const newMedia = createMedia(leftCardSrc, "");
      leftCard.innerHTML = "";
      leftCard.appendChild(newMedia);

      // ✅ التحقق من أن البطاقة أسطورية
      if (voiceSystem && voiceSystem.isLegendaryCard(leftCardSrc)) {
        const voiceFileName = voiceSystem.getVoiceFileName(leftCardSrc);
        const audioPath = `voice/${voiceFileName}.mp3`;

        // ✅ حمّل الصوت مسبقًا إذا لم يكن جاهزًا
        preloadVoice(leftCardSrc);
        const audio = preloadedVoices[audioPath];
        
        if (audio) {
          audio.currentTime = 0;
          audio.volume = voiceSystem.volume;
          
          // ✅ حفظ المرجع للصوت الحالي
          leftCurrentAudio = audio;
          window.leftCurrentAudio = leftCurrentAudio;

          // ✅ دالة لتشغيل الصوت الثاني
          const playLeftAudio = () => {
            // ✅ إذا كان الصوت الثاني يعمل بالفعل، لا نعيد تشغيله
            if (audio.currentTime > 0 && !audio.paused && !audio.ended) {
              return;
            }
            
            // ✅ إذا كان هناك صوت للاعب الأول ولا يزال يعمل، ننتظر حتى ينتهي
            if (rightCardHasVoice && rightCurrentAudio && !rightCurrentAudio.ended) {
              // الصوت الأول لا يزال يعمل، ننتظر حتى ينتهي (يتم تشغيله في حدث ended للصوت الأول)
              return;
            }
            
            // ✅ إذا لم يكن هناك صوت للاعب الأول أو انتهى، نبدأ مباشرة
            if (audio.readyState >= 2) { // HAVE_CURRENT_DATA أو أعلى
              audio.currentTime = 0;
              audio.play().catch(err => console.warn("⚠️ Audio play error:", err));
            } else {
              // إذا لم يكن الصوت جاهزاً بعد، ننتظر قليلاً
              audio.addEventListener("canplay", () => {
                if (audio === leftCurrentAudio) { // التأكد من أن الصوت لم يتغير
                  audio.currentTime = 0;
                  audio.play().catch(err => console.warn("⚠️ Audio play error:", err));
                }
              }, { once: true });
            }
          };

          // ✅ الصوت يبدأ في نفس لحظة ظهور الكرت فعليًا (أو بعد انتهاء الأول)
          if (newMedia.tagName === "VIDEO") {
            newMedia.addEventListener("playing", () => {
              // نتحقق من حالة الصوت الأول بعد تأخير بسيط
              setTimeout(() => {
                playLeftAudio();
              }, 100);
            }, { once: true });
          } else if (newMedia.tagName === "IMG") {
            newMedia.addEventListener("load", () => {
              // نتحقق من حالة الصوت الأول بعد تأخير بسيط
              setTimeout(() => {
                playLeftAudio();
              }, 100);
            }, { once: true });
          }

          // ✅ تنظيف المرجع عند انتهاء الصوت
          audio.addEventListener("ended", () => {
            if (leftCurrentAudio === audio) {
              leftCurrentAudio = null;
              window.leftCurrentAudio = null;
            }
          }, { once: true });
        }
      }
    } else {
      leftCard.innerHTML = '<div class="empty-hint">لا توجد بطاقة لهذه الجولة</div>';
    }
  }

  // Update notes for current round
  updateNotesForRound();
  
  // Create voice control buttons
  if (voiceSystem && createVoiceControls) {
    createVoiceControls();
  }
  
  // Create replay buttons
  if (voiceSystem && createReplayButtons) {
    createReplayButtons();
  }
}

// Update notes for current round
function updateNotesForRound() {
  const leftNotes = document.getElementById("player1Notes");
  const rightNotes = document.getElementById("player2Notes");
  
  if (!leftNotes || !rightNotes) {
    console.warn('Notes elements not found');
    return;
  }
  
  // Smooth update without replacing elements
  try {
    const player1Notes = localStorage.getItem('notes:player1') || '';
    const player2Notes = localStorage.getItem('notes:player2') || '';
    
    // Update values smoothly
    leftNotes.value = player1Notes;
    rightNotes.value = player2Notes;
    
    console.log(`Notes updated smoothly for round ${round + 1}`);
  } catch (error) {
    console.error('Error updating notes:', error);
    leftNotes.value = "";
    rightNotes.value = "";
  }
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
  
  // Show history smoothly
  if (leftRow) leftRow.classList.remove("history-hidden");
  if (rightRow) rightRow.classList.remove("history-hidden");
  if (leftLbl) leftLbl.classList.remove("history-hidden");
  if (rightLbl) rightLbl.classList.remove("history-hidden");

  // Clear and rebuild smoothly
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
  
  // Clear container completely
  container.innerHTML = "";

  if (!abilities.length){
    const p=document.createElement("p");
    p.style.opacity=".7"; p.style.fontSize="12px"; p.textContent="لا توجد قدرات";
    p.style.fontFamily = '"Cairo", sans-serif';
    container.appendChild(p);
  } else {
    abilities.forEach((ab, idx)=>{
      const isUsed = ab.used;
      // إضافة أيقونة لتوضيح إمكانية الإلغاء
      const displayText = isUsed ? `🔄 ${ab.text} (انقر للإلغاء)` : ab.text;
      
      const btn = abilityButton(displayText, async ()=>{
        console.log(`Ability clicked: ${ab.text}, current state: ${isUsed}`);
        
        // Toggle ability usage for host
        const newUsedState = !isUsed;
        
        // ✅ تحديث بصري فوري للزر قبل أي شيء آخر
        const clickedButton = event.currentTarget;
        if (newUsedState) {
          // تم التفعيل - تطبيق الأنماط البرتقالية
          clickedButton.style.setProperty('opacity', '0.9', 'important');
          clickedButton.style.setProperty('background', 'linear-gradient(145deg, #f59e0b, #d97706)', 'important');
          clickedButton.style.setProperty('color', '#fff', 'important');
          clickedButton.style.setProperty('border', '2px solid #fbbf24', 'important');
          clickedButton.style.setProperty('box-shadow', '0 0 15px rgba(251, 191, 36, 0.6)', 'important');
          clickedButton.style.setProperty('font-weight', 'bold', 'important');
          clickedButton.textContent = `🔄 ${ab.text} (انقر للإلغاء)`;
        } else {
          // إلغاء التفعيل - العودة للأنماط الطبيعية (الأصفر/الافتراضي)
          clickedButton.style.removeProperty('opacity');
          clickedButton.style.removeProperty('background');
          clickedButton.style.removeProperty('color');
          clickedButton.style.removeProperty('border');
          clickedButton.style.removeProperty('box-shadow');
          clickedButton.style.removeProperty('font-weight');
          clickedButton.textContent = ab.text;
          
          // Force re-render to show default styles
          clickedButton.offsetHeight; // Trigger reflow
        }
        
        // Update used abilities for the specific player
        const usedAbilitiesKey = `${playerParam}UsedAbilities`;
        let usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
        
        // ✅ التأكد من أن usedAbilities مصفوفة
        if (!Array.isArray(usedAbilities)) {
          if (typeof usedAbilities === 'object' && usedAbilities !== null) {
            // إذا كان كائن، حوله إلى مصفوفة
            usedAbilities = Object.values(usedAbilities).map(item => {
              if (typeof item === 'string') return item;
              if (typeof item === 'object' && item !== null) {
                return item.text || item.abilityText || item;
              }
              return item;
            });
          } else {
            usedAbilities = [];
          }
        }
        
        if (newUsedState) {
          // Add to used abilities
          if (!usedAbilities.includes(ab.text)) {
            usedAbilities.push(ab.text);
          }
          
          // ✅ حفظ تفعيل القدرة في Firebase Realtime Database (فوري بدون await)
          if (database) {
            const gameId = localStorage.getItem('currentGameId') || 'default-game';
            const abilityKey = encodeURIComponent(ab.text);
            const usedRef = ref(database, `games/${gameId}/players/${playerParam}/usedAbilities/${abilityKey}`);
            
            // ✅ تحديث فوري بدون انتظار (للمزامنة السريعة على الهواتف)
            set(usedRef, {
              text: ab.text,
              usedAt: Date.now(),
              usedBy: fromName
            }).then(() => {
              console.log(`✅ تم تفعيل القدرة في Firebase للاعب ${playerParam}:`, ab.text);
              
              // ✅ تحديث فوري للقدرات الكاملة في Firebase
              const abilitiesKey = `${playerParam}Abilities`;
              let abilities = JSON.parse(localStorage.getItem(abilitiesKey) || '[]');
              if (!abilities || abilities.length === 0) {
                const globalKey = playerParam === 'player1' ? P1_ABILITIES_KEY : P2_ABILITIES_KEY;
                abilities = JSON.parse(localStorage.getItem(globalKey) || '[]');
              }
              
              const updatedAbilities = abilities.map(ability => {
                const text = typeof ability === 'string' ? ability : (ability.text || ability);
                if (text === ab.text) {
                  return typeof ability === 'string' ? { text: ability, used: true } : { ...ability, used: true };
                }
                return typeof ability === 'string' ? { text: ability, used: ability.used || false } : ability;
              });
              
              const abilitiesRef = ref(database, `games/${gameId}/players/${playerParam}/abilities`);
              set(abilitiesRef, updatedAbilities).catch(err => console.error('❌ خطأ في تحديث القدرات:', err));
            }).catch((error) => {
              console.error('❌ خطأ في تفعيل القدرة في Firebase:', error);
            });
          }
          
          // رسالة تأكيد
          showToast(`✅ تم تفعيل القدرة: ${ab.text}`, []);
        } else {
          // ✅ Remove from used abilities
          const filteredAbilities = usedAbilities.filter(ability => ability !== ab.text);
          usedAbilities.length = 0;
          usedAbilities.push(...filteredAbilities);
          
          // ✅ إعادة تفعيل القدرة في Firebase Realtime Database
          if (database) {
            const gameId = localStorage.getItem('currentGameId') || 'default-game';
            const abilityKey = encodeURIComponent(ab.text);
            const usedRef = ref(database, `games/${gameId}/players/${playerParam}/usedAbilities/${abilityKey}`);
            
            console.log('🔄 محاولة حذف القدرة من Firebase:', {
              gameId,
              playerParam,
              abilityText: ab.text,
              abilityKey,
              refPath: `games/${gameId}/players/${playerParam}/usedAbilities/${abilityKey}`
            });
            
            // حذف القدرة المستخدمة من Firebase (فوري بدون await)
            remove(usedRef).then(() => {
              console.log(`✅ تم إعادة تفعيل القدرة في Firebase للاعب ${playerParam}:`, ab.text);
              
              // ✅ تحديث فوري للقدرات الكاملة في Firebase
              const abilitiesKey = `${playerParam}Abilities`;
              let abilities = JSON.parse(localStorage.getItem(abilitiesKey) || '[]');
              if (!abilities || abilities.length === 0) {
                const globalKey = playerParam === 'player1' ? P1_ABILITIES_KEY : P2_ABILITIES_KEY;
                abilities = JSON.parse(localStorage.getItem(globalKey) || '[]');
              }
              
              const updatedAbilities = abilities.map(ability => {
                const text = typeof ability === 'string' ? ability : (ability.text || ability);
                if (text === ab.text) {
                  return typeof ability === 'string' ? { text: ability, used: false } : { ...ability, used: false };
                }
                return typeof ability === 'string' ? { text: ability, used: ability.used || false } : ability;
              });
              
              const abilitiesRef = ref(database, `games/${gameId}/players/${playerParam}/abilities`);
              set(abilitiesRef, updatedAbilities).then(() => {
                console.log('✅ تم تحديث القدرات في Firebase بعد إعادة التفعيل');
              }).catch(err => console.error('❌ خطأ في تحديث القدرات:', err));
            }).catch((error) => {
              console.error('❌ خطأ في إعادة تفعيل القدرة في Firebase:', error);
            });
          } else {
            console.warn('⚠️ Firebase database غير متاح - لا يمكن حذف القدرة من Firebase');
          }
          
          // ✅ تحديث القدرات في localStorage لتظهر غير مستخدمة
          const playerAbilitiesKey = `${playerParam}Abilities`;
          let abilities = JSON.parse(localStorage.getItem(playerAbilitiesKey) || '[]');
          
          // إذا لم توجد في المفتاح المباشر، جرب المفاتيح العامة
          if (!abilities || abilities.length === 0) {
            const abilitiesKey = playerParam === 'player1' ? P1_ABILITIES_KEY : P2_ABILITIES_KEY;
            abilities = JSON.parse(localStorage.getItem(abilitiesKey) || '[]');
          }
          
          // ✅ تحديث القدرات مع الحفاظ على جميع القدرات
          const updatedAbilities = abilities.map(ability => {
            const text = typeof ability === 'string' ? ability : (ability.text || ability);
            if (text === ab.text) {
              // إعادة تفعيل هذه القدرة فقط
              return typeof ability === 'string' ? { text: ability, used: false } : { ...ability, used: false };
            }
            // الحفاظ على القدرات الأخرى كما هي
            return typeof ability === 'string' ? { text: ability, used: ability.used || false } : ability;
          });
          
          // ✅ حفظ في كلا المفتاحين لضمان المزامنة
          localStorage.setItem(playerAbilitiesKey, JSON.stringify(updatedAbilities));
          const abilitiesKey = playerParam === 'player1' ? P1_ABILITIES_KEY : P2_ABILITIES_KEY;
          localStorage.setItem(abilitiesKey, JSON.stringify(updatedAbilities));
          
          console.log(`✅ تم إعادة تفعيل القدرة للاعب ${playerParam}:`, ab.text);
          
          // رسالة تأكيد
          showToast(`🔄 تم إعادة تفعيل القدرة: ${ab.text}`, []);
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
        
        // ✅ إشارة صريحة للتحديث - لضمان المزامنة الفورية
        const updateTimestamp = Date.now().toString();
        localStorage.setItem('abilitiesLastUpdate', updateTimestamp);
        
        // ✅ BroadcastChannel للتواصل الفوري مع جميع النوافذ (ممتاز للهواتف)
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            const abilityChannel = new BroadcastChannel('ability-updates');
            abilityChannel.postMessage({
              type: 'ABILITY_UPDATED',
              playerParam: playerParam,
              abilityText: ab.text,
              isUsed: newUsedState,
              timestamp: updateTimestamp
            });
            console.log('📡 BroadcastChannel message sent to all windows');
          }
        } catch (e) {
          console.log('⚠️ BroadcastChannel not available');
        }
        
        // Force immediate update in current page (delayed to avoid overwriting instant update)
        setTimeout(() => renderPanels(), 50);
        
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
        
        console.log(`${icon} ${action} القدرة "${ab.text}" للاعب ${playerName}`);
        // showToast disabled - actions removed
        
        // Send notification to player directly
        const notification = {
          type: 'ability_toggle',
          playerParam: playerParam,
          abilityText: ab.text,
          isUsed: newUsedState,
          timestamp: Date.now(),
          fromHost: true
        };
        
        // Store notification with unique key to force change detection
        const notificationKey = `playerNotification_${Date.now()}`;
        localStorage.setItem(notificationKey, JSON.stringify(notification));
        localStorage.setItem('playerNotification', JSON.stringify(notification));
        
        // Also store in a way that player can detect
        const playerNotifications = JSON.parse(localStorage.getItem('allPlayerNotifications') || '[]');
        playerNotifications.push(notification);
        localStorage.setItem('allPlayerNotifications', JSON.stringify(playerNotifications));
        
        // Try BroadcastChannel if available
        try {
          if (window.BroadcastChannel) {
            window.BroadcastChannel.postMessage(notification);
          }
        } catch (e) {
          console.log('BroadcastChannel not available');
        }
        
        console.log(`📤 تم إرسال إشعار للاعب ${playerName}:`, notification);
      }, isUsed);
      
      // إضافة تنسيق مرئي للقدرات المستخدمة (برتقالي مميز للإشارة إلى إمكانية الإلغاء)
      if (isUsed) {
        btn.style.opacity = "0.9";
        btn.style.background = "linear-gradient(145deg, #f59e0b, #d97706)";
        btn.style.color = "#fff";
        btn.style.border = "2px solid #fbbf24";
        btn.style.boxShadow = "0 0 15px rgba(251, 191, 36, 0.6)";
        btn.style.fontWeight = "bold";
        btn.style.transition = "all 0.3s ease";
      }
      
      // Add unique ID to prevent duplicates
      btn.id = `ability-${playerParam}-${idx}`;
      container.appendChild(btn);
    });
  }

  // Clear existing buttons to prevent duplicates
  const existingTransferBtn = container.querySelector('.transfer-btn');
  const existingAddBtn = container.querySelector('.add-ability-btn');
  if (existingTransferBtn) {
    existingTransferBtn.remove();
  }
  if (existingAddBtn) {
    existingAddBtn.remove();
  }
  
  // Create button container
  const buttonContainer = document.createElement("div");
  buttonContainer.style.display = "flex";
  buttonContainer.style.gap = "8px";
  buttonContainer.style.marginTop = "10px";
  
  // Create transfer button
  const transferBtn=document.createElement("button");
  transferBtn.className="btn transfer-btn";
  transferBtn.style.fontFamily = '"Cairo", sans-serif';
  transferBtn.style.flex = "1";
  transferBtn.textContent="نقل";
  transferBtn.onclick=()=>openTransferModal(key, fromName, toName);
  transferBtn.id = `transfer-${playerParam}`;
  
  // Create add ability button
  const addBtn=document.createElement("button");
  addBtn.className="btn add-ability-btn";
  addBtn.style.fontFamily = '"Cairo", sans-serif';
  addBtn.style.flex = "1";
  addBtn.textContent="إضافة";
  addBtn.onclick=()=>openAddAbilityModal(playerParam);
  addBtn.id = `add-${playerParam}`;
  
  buttonContainer.appendChild(transferBtn);
  buttonContainer.appendChild(addBtn);
  container.appendChild(buttonContainer);
}

function renderPanels(){
  try {
    const player1Container = document.getElementById("player1AbilitiesContainer");
    const player2Container = document.getElementById("player2AbilitiesContainer");
    const player1Title = document.getElementById("player1AbilitiesTitle");
    const player2Title = document.getElementById("player2AbilitiesTitle");
    
    // Update ability titles smoothly
    if (player1Title) {
      player1Title.textContent = `قدرات ${player1}`;
    }
    if (player2Title) {
      player2Title.textContent = `قدرات ${player2}`;
    }
    
    // Clear and rebuild containers smoothly
    if (player1Container) {
      player1Container.innerHTML = '';
      renderAbilitiesPanel(P1_ABILITIES_KEY, player1Container, player1, player2);
    }
    if (player2Container) {
      player2Container.innerHTML = '';
      renderAbilitiesPanel(P2_ABILITIES_KEY, player2Container, player2, player1);
    }
    
    // ✅ حفظ القدرات في Firebase بعد العرض (لضمان المزامنة الفورية)
    if (database) {
      const gameId = localStorage.getItem('currentGameId') || 'default-game';
      
      // ✅ تحديث فوري بدون انتظار (للمزامنة السريعة على الهواتف)
      // تحميل القدرات الحالية
      const player1Abilities = loadPlayerAbilities('player1');
      const player2Abilities = loadPlayerAbilities('player2');
      
      // حفظ قدرات اللاعب 1 في Firebase (فوري)
      if (player1Abilities.length > 0) {
        const player1AbilitiesRef = ref(database, `games/${gameId}/players/player1/abilities`);
        set(player1AbilitiesRef, player1Abilities).catch((error) => {
          console.error('❌ خطأ في حفظ قدرات اللاعب 1 في Firebase:', error);
        });
      }
      
      // حفظ قدرات اللاعب 2 في Firebase (فوري)
      if (player2Abilities.length > 0) {
        const player2AbilitiesRef = ref(database, `games/${gameId}/players/player2/abilities`);
        set(player2AbilitiesRef, player2Abilities).catch((error) => {
          console.error('❌ خطأ في حفظ قدرات اللاعب 2 في Firebase:', error);
        });
      }
    }
    
    // ✅ لا نعيد تحميل الملاحظات عند تحديث القدرات - تبقى كما هي
    // updateNotesForRound(); // تم إزالة هذا السطر
    
    // ⚠️ renderAbilityRequests تم استبداله بمستمع Firebase
    // المستمع الجديد startAbilityRequestsListener يتولى عرض الطلبات من Firebase
    // renderAbilityRequests();
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

// دالة معالجة طلبات القدرات
function renderAbilityRequests() {
  try {
    console.log('🔄 تحديث طلبات القدرات');
    
    // جلب الطلبات من localStorage
    const abilityRequests = JSON.parse(localStorage.getItem('abilityRequests') || '[]');
    
    console.log('عدد طلبات القدرات:', abilityRequests.length);
    
    // تصفية الطلبات المعلقة
    const pendingRequests = abilityRequests.filter(req => req.status === 'pending');
    
    console.log('عدد الطلبات المعلقة:', pendingRequests.length);
    
    // عرض الإشعارات للطلبات المعلقة
    pendingRequests.forEach(request => {
      // التأكد من أن الطلب ليس للاعب الحالي
      if (request.playerParam !== 'player1') {
        console.log('طلب قدرة معلق:', request);
        // ✅ استخدام النظام الجديد الآمن
        showAbilityRequestPopup(request);
      }
    });
  } catch (error) {
    console.error('❌ خطأ في تحديث طلبات القدرات:', error);
  }
}

// التأكد من وجود الدالة في النافذة العامة
window.renderAbilityRequests = renderAbilityRequests;

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
      // ✅ حذف الطلب تماماً بدلاً من تحديث حالته
      const updatedRequests = requests.filter(req => req.id !== requestId);
      localStorage.setItem('abilityRequests', JSON.stringify(updatedRequests));
      console.log(`✅ تم حذف الطلب من localStorage:`, requestId);
      
      // Mark ability as permanently used for the requesting player
      const usedAbilitiesKey = `${request.playerParam}UsedAbilities`;
      const usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
      if (!usedAbilities.includes(request.abilityText)) {
        usedAbilities.push(request.abilityText);
        localStorage.setItem(usedAbilitiesKey, JSON.stringify(usedAbilities));
      }
      
      // Update abilities only for the requesting player
      const requestingPlayerAbilities = loadAbilities(request.playerParam === 'player1' ? P1_ABILITIES_KEY : P2_ABILITIES_KEY);
      
      let abilityUpdated = false;
      requestingPlayerAbilities.forEach(ability => {
        if (ability.text === request.abilityText) {
          ability.used = true;
          abilityUpdated = true;
        }
      });
      
      if (abilityUpdated) {
        const abilitiesKey = request.playerParam === 'player1' ? P1_ABILITIES_KEY : P2_ABILITIES_KEY;
        saveAbilities(abilitiesKey, requestingPlayerAbilities);
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
      const globalAbilitiesKey = request.playerParam === 'player1' ? P1_ABILITIES_KEY : P2_ABILITIES_KEY;
      const globalAbilities = JSON.parse(localStorage.getItem(globalAbilitiesKey) || '[]');
      globalAbilities.forEach(ability => {
        if (ability.text === request.abilityText) {
          ability.used = true;
        }
      });
      localStorage.setItem(globalAbilitiesKey, JSON.stringify(globalAbilities));
      
      // ✅ إشارة صريحة للتحديث - لضمان المزامنة الفورية
      const updateTimestamp = Date.now().toString();
      localStorage.setItem('abilitiesLastUpdate', updateTimestamp);
      
      // ✅ BroadcastChannel للتواصل الفوري (ممتاز للهواتف)
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const abilityChannel = new BroadcastChannel('ability-updates');
          abilityChannel.postMessage({
            type: 'ABILITY_UPDATED',
            playerParam: request.playerParam,
            abilityText: request.abilityText,
            isUsed: true,
            timestamp: updateTimestamp,
            action: 'approved'
          });
          console.log('📡 Ability approval sent via BroadcastChannel');
        }
      } catch (e) {
        console.log('⚠️ BroadcastChannel not available');
      }
      
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
      
      // Re-render panels once
      renderPanels();
      
      console.log(`تمت الموافقة على استخدام ${request.abilityText} من ${request.playerName}`);
      
      // ✅ حذف الإشعار من tracking و DOM
      shownNotifications.delete(requestId);
      
      // ✅ حذف باستخدام data-request-id
      const notificationElement = document.querySelector(`[data-request-id="${requestId}"]`);
      if (notificationElement && notificationElement.parentNode) {
        notificationElement.parentNode.removeChild(notificationElement);
        console.log('✅ Notification removed from DOM (by requestId)');
      }
      
      // ✅ حذف أيضاً باستخدام unique key (للتأكد التام)
      const uniqueKey = `${request.playerParam}_${request.abilityText}`;
      const notificationByKey = document.querySelector(`[data-unique-key="${uniqueKey}"]`);
      if (notificationByKey && notificationByKey.parentNode) {
        notificationByKey.parentNode.removeChild(notificationByKey);
        console.log('✅ Notification removed from DOM (by uniqueKey)');
      }
      
      // Navigate to player page after approving ability request
      navigateToPlayerPage(request.playerParam, request.playerName);
      
      console.log(`Approved ability: ${request.abilityText} for ${request.playerName}`);
    }
  } catch(error) {
    console.error("Error approving ability request:", error);
        console.log("حدث خطأ في الموافقة على الطلب");
  }
}

// Reject ability request
function rejectAbilityRequest(requestId){
  try {
    const requests = JSON.parse(localStorage.getItem('abilityRequests') || '[]');
    const request = requests.find(req => req.id === requestId);
    
    if (request) {
      // ✅ حذف الطلب تماماً بدلاً من تحديث حالته
      const updatedRequests = requests.filter(req => req.id !== requestId);
      localStorage.setItem('abilityRequests', JSON.stringify(updatedRequests));
      console.log(`✅ تم حذف الطلب من localStorage:`, requestId);
      
      // Remove ability from used abilities for the requesting player
      const usedAbilitiesKey = `${request.playerParam}UsedAbilities`;
      const usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
      const filteredAbilities = usedAbilities.filter(ability => ability !== request.abilityText);
      localStorage.setItem(usedAbilitiesKey, JSON.stringify(filteredAbilities));
      
      // Update abilities only for the requesting player
      const requestingPlayerAbilities = loadAbilities(request.playerParam === 'player1' ? P1_ABILITIES_KEY : P2_ABILITIES_KEY);
      
      let abilityUpdated = false;
      requestingPlayerAbilities.forEach(ability => {
        if (ability.text === request.abilityText) {
          ability.used = false;
          abilityUpdated = true;
        }
      });
      
      if (abilityUpdated) {
        const abilitiesKey = request.playerParam === 'player1' ? P1_ABILITIES_KEY : P2_ABILITIES_KEY;
        saveAbilities(abilitiesKey, requestingPlayerAbilities);
      }
      
      // Trigger storage event for player pages
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'abilityRequests',
        newValue: localStorage.getItem('abilityRequests'),
        oldValue: localStorage.getItem('abilityRequests'),
        storageArea: localStorage
      }));
      
      // ✅ إشارة صريحة للتحديث - لضمان المزامنة الفورية
      const updateTimestamp = Date.now().toString();
      localStorage.setItem('abilitiesLastUpdate', updateTimestamp);
      
      // ✅ BroadcastChannel للتواصل الفوري (ممتاز للهواتف)
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const abilityChannel = new BroadcastChannel('ability-updates');
          abilityChannel.postMessage({
            type: 'ABILITY_UPDATED',
            playerParam: request.playerParam,
            abilityText: request.abilityText,
            isUsed: false,
            timestamp: updateTimestamp,
            action: 'rejected'
          });
          console.log('📡 Ability rejection sent via BroadcastChannel');
        }
      } catch (e) {
        console.log('⚠️ BroadcastChannel not available');
      }
      
      // Re-render panels once
      renderPanels();
      
      console.log(`تم رفض استخدام ${request.abilityText} من ${request.playerName}`);
      
      // ✅ حذف الإشعار من tracking و DOM
      shownNotifications.delete(requestId);
      
      // ✅ حذف باستخدام data-request-id
      const notificationElement = document.querySelector(`[data-request-id="${requestId}"]`);
      if (notificationElement && notificationElement.parentNode) {
        notificationElement.parentNode.removeChild(notificationElement);
        console.log('✅ Notification removed from DOM (by requestId)');
      }
      
      // ✅ حذف أيضاً باستخدام unique key (للتأكد التام)
      const uniqueKey = `${request.playerParam}_${request.abilityText}`;
      const notificationByKey = document.querySelector(`[data-unique-key="${uniqueKey}"]`);
      if (notificationByKey && notificationByKey.parentNode) {
        notificationByKey.parentNode.removeChild(notificationByKey);
        console.log('✅ Notification removed from DOM (by uniqueKey)');
      }
      
      console.log(`Rejected ability: ${request.abilityText} for ${request.playerName}`);
    }
  } catch(error) {
    console.error("Error rejecting ability request:", error);
        console.log("حدث خطأ في رفض الطلب");
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
    
    // Update abilities only for the specific player
    if (playerParam) {
      const playerAbilities = loadAbilities(playerParam === 'player1' ? P1_ABILITIES_KEY : P2_ABILITIES_KEY);
      
      let abilityUpdated = false;
      playerAbilities.forEach(ability => {
        if (ability.text === abilityText) {
          ability.used = false;
          abilityUpdated = true;
        }
      });
      
      if (abilityUpdated) {
        const abilitiesKey = playerParam === 'player1' ? P1_ABILITIES_KEY : P2_ABILITIES_KEY;
        saveAbilities(abilitiesKey, playerAbilities);
      }
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
    
        console.log(`تم إعادة القدرة ${abilityText} لـ ${playerName}`);
    
    console.log(`Restored ability: ${abilityText} for ${playerName}`);
    return true;
  } catch(error) {
    console.error("Error restoring ability:", error);
        console.log("حدث خطأ في إعادة القدرة");
    return false;
  }
}

/* ---------------------- Add Ability Modal ---------------------- */
function openAddAbilityModal(playerParam) {
  const playerName = playerParam === 'player1' ? player1 : player2;
  
  // Get the modal from HTML
  const modal = document.getElementById("addAbilityModal");
  if (!modal) {
    console.error('Add ability modal not found in HTML');
    return;
  }
  
  // Update title
  const title = document.getElementById("addAbilityTitle");
  title.textContent = `إضافة قدرة جديدة - ${playerName}`;
  
  // Clear inputs
  document.getElementById("newAbilityInput").value = "";
  document.getElementById("bulkAbilitiesInput").value = "";
  
  // Store player parameter
  modal.dataset.playerParam = playerParam;
  
  // Show modal
  modal.classList.add("active");
  
  // Focus on input and setup keyboard shortcuts
  setTimeout(() => {
    const input = document.getElementById("newAbilityInput");
    const textarea = document.getElementById("bulkAbilitiesInput");
    
    input.focus();
    
    // Remove existing event listeners to prevent duplicates
    input.removeEventListener('keypress', handleEnterKey);
    textarea.removeEventListener('keydown', handleCtrlEnter);
    
    // Add new event listeners
    input.addEventListener('keypress', handleEnterKey);
    textarea.addEventListener('keydown', handleCtrlEnter);
    
    function handleEnterKey(e) {
      if (e.key === 'Enter') {
        confirmAddAbility();
      }
    }
    
    function handleCtrlEnter(e) {
      if (e.ctrlKey && e.key === 'Enter') {
        confirmAddAbility();
      }
    }
  }, 100);
}

function closeAddAbilityModal() {
  const modal = document.getElementById("addAbilityModal");
  if (modal) {
    modal.classList.remove("active");
  }
}

async function confirmAddAbility() {
  const modal = document.getElementById("addAbilityModal");
  const playerParam = modal.dataset.playerParam;
  const playerName = playerParam === 'player1' ? player1 : player2;
  
  const singleInput = document.getElementById("newAbilityInput");
  const bulkInput = document.getElementById("bulkAbilitiesInput");
  
  const singleAbility = singleInput.value.trim();
  const bulkAbilities = bulkInput.value.trim();
  
  // Check if both fields are empty
  if (!singleAbility && !bulkAbilities) {
    showToast("! يرجى إدخال قدرة واحدة أو عدة قدرات", 'error');
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
    showToast("! لم يتم العثور على قدرات صحيحة", 'error');
    return;
  }
  
  try {
    // 1. Add to player's abilities
    const playerAbilitiesKey = `${playerParam}Abilities`;
    const currentAbilities = JSON.parse(localStorage.getItem(playerAbilitiesKey) || '[]');
    
    // Check for duplicates within player's abilities
    const newAbilities = [];
    const duplicates = [];
    
    abilitiesToAdd.forEach(ability => {
      const exists = currentAbilities.some(existing => {
        const existingText = typeof existing === 'string' ? existing : existing.text;
        return existingText === ability;
      });
      
      if (exists) {
        duplicates.push(ability);
      } else {
        newAbilities.push(ability);
      }
    });
    
    // Add new abilities to player
    if (newAbilities.length > 0) {
      newAbilities.forEach(ability => {
        currentAbilities.push({ text: ability, used: false });
      });
      localStorage.setItem(playerAbilitiesKey, JSON.stringify(currentAbilities));
      
      // ✅ حفظ القدرات المضافة في Firebase Realtime Database (فوري بدون await)
      if (database) {
        const gameId = localStorage.getItem('currentGameId') || 'default-game';
        const abilitiesRef = ref(database, `games/${gameId}/players/${playerParam}/abilities`);
        
        // ✅ تحديث فوري بدون انتظار (للمزامنة السريعة على الهواتف)
        set(abilitiesRef, currentAbilities).then(() => {
          console.log(`✅ تم حفظ القدرات المضافة في Firebase للاعب ${playerParam}`);
          
          // ✅ إرسال إشعار تحديث فوري للاعبين
          const updateTimestamp = Date.now();
          const updateRef = ref(database, `games/${gameId}/abilityUpdates/${updateTimestamp}`);
          set(updateRef, {
            type: 'ABILITIES_ADDED',
            playerParam: playerParam,
            abilities: newAbilities,
            timestamp: updateTimestamp
          }).then(() => {
            console.log('✅ تم إرسال إشعار إضافة القدرات للاعبين');
          }).catch(err => console.error('❌ خطأ في إرسال الإشعار:', err));
        }).catch((error) => {
          console.error('❌ خطأ في حفظ القدرات المضافة في Firebase:', error);
        });
      }
    }
    
    // 2. Add to global abilities library (savedAbilities)
    const savedAbilities = JSON.parse(localStorage.getItem('savedAbilities') || '[]');
    const globalNewAbilities = [];
    const globalDuplicates = [];
    
    abilitiesToAdd.forEach(ability => {
      if (savedAbilities.includes(ability)) {
        globalDuplicates.push(ability);
      } else {
        globalNewAbilities.push(ability);
      }
    });
    
    // Add new abilities to global library
    if (globalNewAbilities.length > 0) {
      savedAbilities.push(...globalNewAbilities);
      localStorage.setItem('savedAbilities', JSON.stringify(savedAbilities));
    }
    
    // 3. Update gameSetupProgress if it exists
    const gameSetupProgress = JSON.parse(localStorage.getItem('gameSetupProgress') || '{}');
    if (gameSetupProgress[playerParam] && gameSetupProgress[playerParam].abilities) {
      const gameSetupAbilities = gameSetupProgress[playerParam].abilities;
      abilitiesToAdd.forEach(ability => {
        if (!gameSetupAbilities.includes(ability)) {
          gameSetupAbilities.push(ability);
        }
      });
      localStorage.setItem('gameSetupProgress', JSON.stringify(gameSetupProgress));
    }
    
    // 4. Update global abilities lists (P1_ABILITIES_KEY, P2_ABILITIES_KEY)
    const globalKey = playerParam === 'player1' ? P1_ABILITIES_KEY : P2_ABILITIES_KEY;
    const globalAbilities = JSON.parse(localStorage.getItem(globalKey) || '[]');
    
    abilitiesToAdd.forEach(ability => {
      const exists = globalAbilities.some(existing => {
        const existingText = typeof existing === 'string' ? existing : existing.text;
        return existingText === ability;
      });
      
      if (!exists) {
        globalAbilities.push({ text: ability, used: false });
      }
    });
    
    localStorage.setItem(globalKey, JSON.stringify(globalAbilities));
    
    // 5. Re-render panels
    renderPanels();
    
    // 6. Close modal
    closeAddAbilityModal();
    
    // 7. Show success message
    const successMessage = `تم إضافة ${newAbilities.length} قدرة جديدة للاعب ${playerName}`;
    showToast(successMessage, 'success');
    
    // 8. Show info about duplicates if any
    if (duplicates.length > 0) {
      console.log(`تم تجاهل ${duplicates.length} قدرة مكررة للاعب: ${duplicates.join(', ')}`);
    }
    
    if (globalNewAbilities.length > 0) {
      console.log(`تم إضافة ${globalNewAbilities.length} قدرة جديدة للمكتبة العامة`);
    }
    
    console.log(`✅ تمت إضافة القدرات بنجاح للاعب ${playerName}:`, newAbilities);
    
    // 9. Trigger storage events to notify other pages
    window.dispatchEvent(new StorageEvent('storage', {
      key: playerAbilitiesKey,
      newValue: localStorage.getItem(playerAbilitiesKey),
      oldValue: localStorage.getItem(playerAbilitiesKey),
      storageArea: localStorage
    }));
    
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'savedAbilities',
      newValue: localStorage.getItem('savedAbilities'),
      oldValue: localStorage.getItem('savedAbilities'),
      storageArea: localStorage
    }));
    
    window.dispatchEvent(new StorageEvent('storage', {
      key: globalKey,
      newValue: localStorage.getItem(globalKey),
      oldValue: localStorage.getItem(globalKey),
      storageArea: localStorage
    }));
    
    // 10. Notify abilities-setup.html page if it's open
    try {
      // Send message to abilities-setup page
      const message = {
        type: 'ABILITIES_ADDED',
        playerParam: playerParam,
        abilities: newAbilities,
        globalAbilities: globalNewAbilities,
        timestamp: Date.now()
      };
      
      // Try to send to parent window
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(message, '*');
      }
      
      // Try to send to opener window
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(message, '*');
      }
      
      // Try BroadcastChannel if available
      if (window.BroadcastChannel) {
        window.BroadcastChannel.postMessage(message);
      }
      
      console.log('📤 تم إرسال إشعار لصفحة abilities-setup:', message);
    } catch (e) {
      console.log('لم يتم إرسال الإشعار لصفحة abilities-setup:', e);
    }
    
    // 11. Notify player-cards.html page if it's open
    try {
      const playerCardsMessage = {
        type: 'PLAYER_ABILITIES_UPDATED',
        playerParam: playerParam,
        playerName: playerName,
        abilities: newAbilities,
        timestamp: Date.now()
      };
      
      // Try to send to parent window
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(playerCardsMessage, '*');
      }
      
      // Try to send to opener window
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(playerCardsMessage, '*');
      }
      
      // Try BroadcastChannel if available
      if (window.BroadcastChannel) {
        window.BroadcastChannel.postMessage(playerCardsMessage);
      }
      
      console.log('📤 تم إرسال إشعار لصفحة player-cards:', playerCardsMessage);
    } catch (e) {
      console.log('لم يتم إرسال الإشعار لصفحة player-cards:', e);
    }
    
  } catch (error) {
    console.error('Error adding abilities:', error);
    showToast("! حدث خطأ في إضافة القدرات", 'error');
  }
}

// Make functions globally available
window.approveAbilityRequest = approveAbilityRequest;
window.rejectAbilityRequest = rejectAbilityRequest;
window.restoreAbility = restoreAbility;
window.confirmResult = confirmResult;
window.confirmWinner = confirmWinner;
window.changeHealth = changeHealth;
window.saveNotes = saveNotes;
window.clearNotes = clearNotes;
window.showPreviousNotes = showPreviousNotes;
window.confirmTransfer = confirmTransfer;
window.closeTransferModal = closeTransferModal;
window.openTransferModal = openTransferModal;
window.openRestoreModal = openRestoreModal;
window.openAddAbilityModal = openAddAbilityModal;
window.closeAddAbilityModal = closeAddAbilityModal;
window.confirmAddAbility = confirmAddAbility;

// Swap deck functions will be defined later in the file

/* ---------------------- Swap Deck System REMOVED ---------------------- */

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
      opt.onclick = async ()=>{
        const sender = loadAbilities(fromKey);
        const moved  = sender.splice(idx,1)[0];
        saveAbilities(fromKey, sender);

        const toKey = (toName === player1) ? P1_ABILITIES_KEY : P2_ABILITIES_KEY;
        const receiver = loadAbilities(toKey);
        receiver.push({ text:moved.text, used:moved.used });
        saveAbilities(toKey, receiver);

        // ✅ حفظ نقل القدرة في Firebase Realtime Database (فوري بدون await)
        if (database) {
          const gameId = localStorage.getItem('currentGameId') || 'default-game';
          const fromPlayerParam = (fromName === player1) ? 'player1' : 'player2';
          const toPlayerParam = (toName === player1) ? 'player1' : 'player2';
          
          // ✅ تحديث فوري بدون انتظار (للمزامنة السريعة على الهواتف)
          // تحديث القدرات في Firebase للاعب المرسل
          const fromAbilitiesRef = ref(database, `games/${gameId}/players/${fromPlayerParam}/abilities`);
          set(fromAbilitiesRef, sender).then(() => {
            console.log(`✅ تم تحديث قدرات ${fromPlayerParam} في Firebase`);
          }).catch(err => console.error('❌ خطأ في تحديث قدرات المرسل:', err));
          
          // تحديث القدرات في Firebase للاعب المستقبل
          const toAbilitiesRef = ref(database, `games/${gameId}/players/${toPlayerParam}/abilities`);
          set(toAbilitiesRef, receiver).then(() => {
            console.log(`✅ تم تحديث قدرات ${toPlayerParam} في Firebase`);
            
            // ✅ إرسال إشعار تحديث فوري للاعبين
            const updateTimestamp = Date.now();
            const updateRef = ref(database, `games/${gameId}/abilityUpdates/${updateTimestamp}`);
            set(updateRef, {
              type: 'ABILITY_TRANSFERRED',
              fromPlayer: fromPlayerParam,
              toPlayer: toPlayerParam,
              abilityText: moved.text,
              timestamp: updateTimestamp
            }).then(() => {
              console.log('✅ تم إرسال إشعار نقل القدرة للاعبين');
            }).catch(err => console.error('❌ خطأ في إرسال الإشعار:', err));
          }).catch(err => console.error('❌ خطأ في تحديث قدرات المستقبل:', err));
        }

        closeTransferModal();
        renderPanels();
        console.log(`تم نقل «${moved.text}» إلى ${toName}`);
      };
      grid.appendChild(opt);
    });
  }
  modal.classList.add("active");
}
function closeTransferModal(){ document.getElementById("transferModal").classList.remove("active"); }

function confirmTransfer(){
  // This function is called when the transfer modal is confirmed
  // The actual transfer logic is handled in openTransferModal
  closeTransferModal();
}

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
        console.log(`تم استعادة «${ab.text}» لـ ${fromName}`);
      };
      grid.appendChild(opt);
    });
  }
  modal.classList.add("active");
}

/* ---------------------- Health controls ---------------------- */
function wireHealth(name, decEl, incEl, valueEl){
  if (!decEl || !incEl || !valueEl) {
    console.warn(`Missing elements for ${name} health controls`);
    return;
  }
  
  const clamp = (n)=>Math.max(0, Math.min(startingHP,n));
  const refresh = ()=>{ 
    valueEl.textContent=String(scores[name]); 
    valueEl.classList.toggle("red", scores[name] <= Math.ceil(startingHP/2)); 
  };

  // Store parent reference before replacing elements
  const parentEl = decEl.parentNode;
  
  // Clear existing listeners
  decEl.replaceWith(decEl.cloneNode(true));
  incEl.replaceWith(incEl.cloneNode(true));
  
  // Get fresh references using the stored parent
  const newDecEl = parentEl ? parentEl.querySelector(".round-btn:last-child") : null;
  const newIncEl = parentEl ? parentEl.querySelector(".round-btn:first-child") : null;
  
  // Add unique IDs to prevent conflicts
  if (newDecEl) newDecEl.id = `dec-${name}`;
  if (newIncEl) newIncEl.id = `inc-${name}`;
  
  if (newDecEl && newIncEl) {
    newDecEl.onclick = ()=>{ 
      console.log(`Decreasing health for ${name}`);
      scores[name]=clamp(scores[name]-1); 
      refresh(); 
      localStorage.setItem("scores", JSON.stringify(scores)); 
    };
    newIncEl.onclick = ()=>{ 
      console.log(`Increasing health for ${name}`);
      scores[name]=clamp(scores[name]+1); 
      refresh(); 
      localStorage.setItem("scores", JSON.stringify(scores)); 
    };
    console.log(`Health buttons wired for ${name}`);
  } else {
    console.warn(`Could not find health buttons for ${name}`);
  }
  
  refresh();
}

/* ---------------------- Round render ---------------------- */
function renderRound(){
  // Reload picks dynamically before rendering
  picks = loadPlayerPicks();
  
  // Update round title smoothly
  roundTitle.textContent = `الجولة ${round + 1}`;
  
  // Render all components smoothly
  renderVs();
  renderPrev();
  
  // ✅ تحميل الملاحظات مرة واحدة فقط عند بداية الجولة
  updateNotesForRound();
  
  renderPanels();

  // Wire health controls with proper event handling
  const player2DecBtn = document.querySelector(".player-column .round-btn:last-child");
  const player2IncBtn = document.querySelector(".player-column .round-btn:first-child");
  const player1DecBtn = document.querySelector(".right-panel .round-btn:last-child");
  const player1IncBtn = document.querySelector(".right-panel .round-btn:first-child");
  
  if (player2DecBtn && player2IncBtn) {
    wireHealth(player2, player2DecBtn, player2IncBtn, document.getElementById("health1"));
  }
  if (player1DecBtn && player1IncBtn) {
    wireHealth(player1, player1DecBtn, player1IncBtn, document.getElementById("health2"));
  }
  
  // Ensure confirm button is properly wired
  const confirmBtn = document.querySelector(".confirm");
  if (confirmBtn) {
    // Remove existing listeners to prevent duplicates
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    const newConfirmBtn = document.querySelector(".confirm");
    newConfirmBtn.onclick = confirmResult;
    newConfirmBtn.id = "confirm-result-btn";
    console.log('Confirm button wired successfully');

    // Nudge the confirm button down slightly for better spacing
    try {
      const confirmWrap = document.querySelector('.confirm-wrap');
      if (confirmWrap) {
        if (!confirmWrap.style.marginTop || parseInt(confirmWrap.style.marginTop) < 20) {
          confirmWrap.style.marginTop = '24px';
        }
      } else if (newConfirmBtn && (!newConfirmBtn.style.marginTop || parseInt(newConfirmBtn.style.marginTop) < 16)) {
        newConfirmBtn.style.marginTop = '16px';
      }
    } catch (e) {
      console.warn('Could not adjust confirm button spacing:', e);
    }
  } else {
    console.warn('Confirm button not found');
  }
  
  
}

function confirmWinner(){
  localStorage.setItem("scores", JSON.stringify(scores));
  round++;
  localStorage.setItem("currentRound", round);

  const over = round >= roundCount || scores[player1] === 0 || scores[player2] === 0;
  if (over){
    localStorage.setItem("scores", JSON.stringify(scores));
    // ✅ لا نمسح ملاحظات الجولات السابقة - تبقى محفوظة لكل لاعب منفصل
    // ✅ لا نمسح الملاحظات نهائياً - تبقى محفوظة للجولات التالية
    localStorage.removeItem(USED_ABILITIES_KEY);
    localStorage.removeItem(ABILITY_REQUESTS_KEY);
    shownNotifications.clear();
    
    // Notify player views that game is over
    localStorage.setItem('gameStatus', 'finished');
    localStorage.setItem('gameUpdate', Date.now().toString());
    
    // Show winner
    const winner = scores[player1] > scores[player2] ? player1 : scores[player2] > scores[player1] ? player2 : "تعادل";
    console.log(`انتهت المعركة! الفائز: ${winner}`);
    
    // Delegate game end to adapter for separation
    if (typeof modeAdapter?.onGameEnd === 'function') {
      modeAdapter.onGameEnd(winner);
      return;
    }
  } else {
    // ✅ لا نمسح الملاحظات عند الانتقال للجولة التالية
    localStorage.removeItem(USED_ABILITIES_KEY);
    localStorage.removeItem(ABILITY_REQUESTS_KEY);
    shownNotifications.clear();
    
    // ✅ إعادة تعيين حالة "تمام" للاعبين عند بداية جولة جديدة
    if (database) {
      const currentGameId = localStorage.getItem('currentGameId') || 'default-game';
      const player1ReadyRef = ref(database, `games/${currentGameId}/players/player1/ready`);
      const player2ReadyRef = ref(database, `games/${currentGameId}/players/player2/ready`);
      
      set(player1ReadyRef, false).then(() => {
        console.log('✅ تم إعادة تعيين حالة "تمام" للاعب 1');
      }).catch((error) => {
        console.error('❌ خطأ في إعادة تعيين حالة "تمام" للاعب 1:', error);
      });
      
      set(player2ReadyRef, false).then(() => {
        console.log('✅ تم إعادة تعيين حالة "تمام" للاعب 2');
      }).catch((error) => {
        console.error('❌ خطأ في إعادة تعيين حالة "تمام" للاعب 2:', error);
      });
      
      // إخفاء عناصر "تمام" في الواجهة
      const player1ReadyBadge = document.getElementById('player1ReadyBadge');
      const player2ReadyBadge = document.getElementById('player2ReadyBadge');
      if (player1ReadyBadge) player1ReadyBadge.style.display = 'none';
      if (player2ReadyBadge) player2ReadyBadge.style.display = 'none';
    }
    
    // Clear previous voices for new round
    if (voiceSystem && voiceSystem.clearPreviousVoices) {
      voiceSystem.clearPreviousVoices();
    }
    
    // ✅ الحفاظ على حالة استخدام دكة البدلاء عبر الجولات
    console.log('🎴 Preserving swap deck usage state across rounds');
    
    // Notify player views of round update BEFORE reload
    console.log('Notifying player views of round update...');
    localStorage.setItem('gameStatus', 'active');
    localStorage.setItem('gameUpdate', Date.now().toString());
    localStorage.setItem('roundUpdate', Date.now().toString());
    
    // Dispatch custom event for same-tab communication
    window.dispatchEvent(new CustomEvent('roundUpdated', {
      detail: { round, scores, player1, player2 }
    }));
    
    // Update the page content without reloading to avoid flash
    updatePageContent();
  }
}

// Update page content without reloading
function updatePageContent() {
  try {
    // Update round title smoothly
    const roundTitle = document.querySelector('.topbar h1');
    if (roundTitle) {
      roundTitle.textContent = `الجولة ${round}`;
    }
    
    // Update health values smoothly
    const health1Element = document.getElementById('health1');
    const health2Element = document.getElementById('health2');
    if (health1Element) health1Element.textContent = scores[player1];
    if (health2Element) health2Element.textContent = scores[player2];
    
    // Update health colors smoothly
    if (health1Element) {
      health1Element.classList.toggle("red", scores[player1] <= Math.ceil(startingHP/2));
    }
    if (health2Element) {
      health2Element.classList.toggle("red", scores[player2] <= Math.ceil(startingHP/2));
    }
    
    // Reset confirm button smoothly
    const confirmBtn = document.querySelector('.confirm');
    if (confirmBtn) {
      confirmBtn.textContent = 'تأكيد النتيجة';
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
    }
    
    // Update cards and other elements smoothly
    renderRound();
    
    console.log('Page content updated smoothly for round', round);
  } catch (error) {
    console.error('Error updating page content:', error);
    // ✅ تم إزالة location.reload() - لا نريد إعادة تحميل الصفحة تلقائياً
    // الصفحة تبقى على حالها حتى لو فشل التحديث
    // setTimeout(() => {
    //   location.reload();
    // }, 100);
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
        let usedAbilities = JSON.parse(localStorage.getItem('player1UsedAbilities') || '[]');
        // ✅ التأكد من أن usedAbilities مصفوفة
        if (!Array.isArray(usedAbilities)) {
          if (typeof usedAbilities === 'object' && usedAbilities !== null) {
            // إذا كان كائن، حوله إلى مصفوفة
            usedAbilities = Object.values(usedAbilities).map(item => {
              if (typeof item === 'string') return item;
              if (typeof item === 'object' && item !== null) {
                return item.text || item.abilityText || item;
              }
              return item;
            });
          } else {
            usedAbilities = [];
          }
        }
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
        let usedAbilities = JSON.parse(localStorage.getItem('player2UsedAbilities') || '[]');
        // ✅ التأكد من أن usedAbilities مصفوفة
        if (!Array.isArray(usedAbilities)) {
          if (typeof usedAbilities === 'object' && usedAbilities !== null) {
            // إذا كان كائن، حوله إلى مصفوفة
            usedAbilities = Object.values(usedAbilities).map(item => {
              if (typeof item === 'string') return item;
              if (typeof item === 'object' && item !== null) {
                return item.text || item.abilityText || item;
              }
              return item;
            });
          } else {
            usedAbilities = [];
          }
        }
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
    
    // ✅ حفظ القدرات في Firebase Realtime Database
    if (database) {
      const gameId = localStorage.getItem('currentGameId') || 'default-game';
      
      try {
        // حفظ قدرات اللاعب 1
        if (player1Abilities.length > 0) {
          const player1AbilitiesRef = ref(database, `games/${gameId}/players/player1/abilities`);
          set(player1AbilitiesRef, player1Abilities).then(() => {
            console.log('✅ تم حفظ قدرات اللاعب 1 في Firebase');
          }).catch((error) => {
            console.error('❌ خطأ في حفظ قدرات اللاعب 1 في Firebase:', error);
          });
        }
        
        // حفظ قدرات اللاعب 2
        if (player2Abilities.length > 0) {
          const player2AbilitiesRef = ref(database, `games/${gameId}/players/player2/abilities`);
          set(player2AbilitiesRef, player2Abilities).then(() => {
            console.log('✅ تم حفظ قدرات اللاعب 2 في Firebase');
          }).catch((error) => {
            console.error('❌ خطأ في حفظ قدرات اللاعب 2 في Firebase:', error);
          });
        }
      } catch (error) {
        console.error('❌ خطأ في حفظ القدرات في Firebase:', error);
      }
    }
    
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
      
      // ✅ حفظ القدرات في Firebase Realtime Database
      if (database) {
        const gameId = localStorage.getItem('currentGameId') || 'default-game';
        
        try {
          // حفظ قدرات اللاعب 1
          const player1AbilitiesRef = ref(database, `games/${gameId}/players/player1/abilities`);
          set(player1AbilitiesRef, player1Abilities).then(() => {
            console.log('✅ تم حفظ قدرات اللاعب 1 في Firebase (من gameSetupProgress)');
          }).catch((error) => {
            console.error('❌ خطأ في حفظ قدرات اللاعب 1 في Firebase:', error);
          });
          
          // حفظ قدرات اللاعب 2
          const player2AbilitiesRef = ref(database, `games/${gameId}/players/player2/abilities`);
          set(player2AbilitiesRef, player2Abilities).then(() => {
            console.log('✅ تم حفظ قدرات اللاعب 2 في Firebase (من gameSetupProgress)');
          }).catch((error) => {
            console.error('❌ خطأ في حفظ قدرات اللاعب 2 في Firebase:', error);
          });
        } catch (error) {
          console.error('❌ خطأ في حفظ القدرات في Firebase:', error);
        }
      }
      
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

// ---------- Firebase listener for ability requests ----------
/**
 * بدء الاستماع لطلبات القدرات من Firebase Realtime Database
 * يستبدل الاستماع لـ localStorage/storage events
 */
async function startAbilityRequestsListener(gameId) {
  if (!database || !gameId) {
    console.warn('⚠️ Firebase SDK أو gameId غير موجودين - لن يتم تشغيل مستمع طلبات القدرات');
    return;
  }

  try {
    const refPath = `games/${gameId}/abilityRequests`;
    const requestsRef = ref(database, refPath);

    console.log('✅ بدء الاستماع لطلبات القدرات من Firebase:', refPath);

    // Listen for new requests (child_added)
    onChildAdded(requestsRef, (snapshot) => {
      const req = snapshot.val();
      if (req && req.status === 'pending') {
        req._key = snapshot.key;
        req.requestId = req.requestId || req.id || req._key;
        console.log('📥 طلب قدرة جديد من Firebase:', req);
        
        // ✅ عرض النافذة للمضيف لجميع اللاعبين (player1 و player2)
        // في card.js، المضيف هو admin، لذا يجب أن يرى طلبات جميع اللاعبين
        showAbilityRequestPopup(req);
      }
    });

    // Listen for changed requests (child_changed)
    onChildChanged(requestsRef, (snapshot) => {
      const req = snapshot.val();
      req._key = snapshot.key;
      req.requestId = req.requestId || req.id || req._key;
      console.log('🔄 تحديث طلب قدرة من Firebase:', req);
      
      // تحديث العرض المحلي إذا تغيرت الحالة (accepted/rejected)
      updateLocalRequestState(req);
    });

    console.log('✅ مستمع طلبات القدرات من Firebase نشط');
  } catch (error) {
    console.error('❌ خطأ في بدء مستمع طلبات القدرات من Firebase:', error);
  }
}

/**
 * تحديث حالة الطلب محلياً عند تغييرها في Firebase
 */
function updateLocalRequestState(req) {
  // إغلاق popup إذا تم قبول أو رفض الطلب
  if (req.status === 'approved' || req.status === 'accepted' || req.status === 'rejected') {
    const requestKey = req._key || req.requestId || req.id;
    const requestId = req.requestId || req.id || requestKey;
    
    // البحث عن popup باستخدام جميع المعرفات المحتملة
    const popupId1 = `popup_${safeEncodeId(requestKey)}`;
    const popupId2 = `popup_${safeEncodeId(requestId)}`;
    
    let popup = document.getElementById(popupId1);
    if (!popup) {
      popup = document.getElementById(popupId2);
    }
    
    // أيضاً البحث عن popup باستخدام class
    if (!popup) {
      const popups = document.querySelectorAll('.ability-popup');
      popups.forEach(p => {
        const acceptBtn = p.querySelector(`#accept_${requestId}`);
        const rejectBtn = p.querySelector(`#reject_${requestId}`);
        if (acceptBtn || rejectBtn) {
          popup = p;
        }
      });
    }
    
    if (popup) {
      popup.remove();
      console.log('🔄 تم إغلاق popup للطلب المعالج:', requestKey);
    }
    
    // إذا تم قبول الطلب، تحديث القدرة لتظهر مستخدمة
    if ((req.status === 'approved' || req.status === 'accepted') && req.playerParam && req.abilityText) {
      const playerParam = req.playerParam;
      const abilityText = req.abilityText;
      
      // تحديث localStorage
      const usedAbilitiesKey = `${playerParam}UsedAbilities`;
      const usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
      if (!usedAbilities.includes(abilityText)) {
        usedAbilities.push(abilityText);
        localStorage.setItem(usedAbilitiesKey, JSON.stringify(usedAbilities));
      }
      
      // ✅ تحديث القدرات في localStorage مع الحفاظ على جميع القدرات
      // استخدام المفتاح المباشر للاعب أولاً
      const playerAbilitiesKey = `${playerParam}Abilities`;
      let abilities = JSON.parse(localStorage.getItem(playerAbilitiesKey) || '[]');
      
      // إذا لم توجد في المفتاح المباشر، جرب المفاتيح العامة
      if (!abilities || abilities.length === 0) {
        const abilitiesKey = playerParam === 'player1' ? P1_ABILITIES_KEY : P2_ABILITIES_KEY;
        abilities = JSON.parse(localStorage.getItem(abilitiesKey) || '[]');
      }
      
      // ✅ التأكد من أن abilities مصفوفة وليست فارغة
      if (!Array.isArray(abilities) || abilities.length === 0) {
        console.warn(`⚠️ لا توجد قدرات للاعب ${playerParam} - سيتم تحميلها من المفاتيح الأخرى`);
        // محاولة تحميل القدرات من المفاتيح الأخرى
        const abilitiesKey = playerParam === 'player1' ? P1_ABILITIES_KEY : P2_ABILITIES_KEY;
        abilities = JSON.parse(localStorage.getItem(abilitiesKey) || '[]');
      }
      
      // ✅ تحديث القدرات مع الحفاظ على جميع القدرات
      const updatedAbilities = abilities.map(ability => {
        const text = typeof ability === 'string' ? ability : (ability.text || ability);
        if (text === abilityText) {
          // تحديث هذه القدرة فقط لتكون مستخدمة
          return typeof ability === 'string' ? { text: ability, used: true } : { ...ability, used: true };
        }
        // الحفاظ على القدرات الأخرى كما هي
        return typeof ability === 'string' ? { text: ability, used: ability.used || false } : ability;
      });
      
      // ✅ حفظ في كلا المفتاحين لضمان المزامنة
      localStorage.setItem(playerAbilitiesKey, JSON.stringify(updatedAbilities));
      const abilitiesKey = playerParam === 'player1' ? P1_ABILITIES_KEY : P2_ABILITIES_KEY;
      localStorage.setItem(abilitiesKey, JSON.stringify(updatedAbilities));
      
      console.log(`✅ تم تحديث القدرات للاعب ${playerParam}:`, updatedAbilities.length, 'قدرة');
      
      // إعادة رسم اللوحات
      if (typeof renderPanels === 'function') {
        renderPanels();
        console.log('✅ تم تحديث واجهة القدرات بعد قبول الطلب');
      }
    }
  }
}

/**
 * بدء الاستماع لحالة "تمام" للاعبين من Firebase
 */
async function startPlayerReadyListener(gameId) {
  if (!database || !gameId) {
    console.warn('⚠️ Firebase SDK أو gameId غير موجودين - لن يتم تشغيل مستمع حالة "تمام"');
    return;
  }

  try {
    // ✅ الاستماع لحالة "تمام" للاعب 1
    const player1ReadyRef = ref(database, `games/${gameId}/players/player1/ready`);
    onValue(player1ReadyRef, (snapshot) => {
      const isReady = snapshot.val() || false;
      const player1ReadyBadge = document.getElementById('player1ReadyBadge');
      if (player1ReadyBadge) {
        if (isReady) {
          player1ReadyBadge.style.display = 'block';
          console.log('✅ تم عرض "تمام" للاعب 1');
        } else {
          player1ReadyBadge.style.display = 'none';
          console.log('✅ تم إخفاء "تمام" للاعب 1');
        }
      }
    });

    // ✅ الاستماع لحالة "تمام" للاعب 2
    const player2ReadyRef = ref(database, `games/${gameId}/players/player2/ready`);
    onValue(player2ReadyRef, (snapshot) => {
      const isReady = snapshot.val() || false;
      const player2ReadyBadge = document.getElementById('player2ReadyBadge');
      if (player2ReadyBadge) {
        if (isReady) {
          player2ReadyBadge.style.display = 'block';
          console.log('✅ تم عرض "تمام" للاعب 2');
        } else {
          player2ReadyBadge.style.display = 'none';
          console.log('✅ تم إخفاء "تمام" للاعب 2');
        }
      }
    });

    console.log('✅ مستمع حالة "تمام" من Firebase نشط');
  } catch (error) {
    console.error('❌ خطأ في بدء مستمع حالة "تمام" من Firebase:', error);
  }
}

// Initialize and render with error handling
try {
  console.log('Initializing game...');
  initializeGameData();
  
  // ✅ تهيئة المزامنة مع Firebase
  const currentGameId = localStorage.getItem('currentGameId') || 'default-game';
  syncService.initSync(currentGameId).then(success => {
    if (success) {
      console.log('✅ Firebase sync initialized for host');
      // ✅ بدء الاستماع لطلبات القدرات من Firebase
      startAbilityRequestsListener(currentGameId);
      
      // ✅ بدء الاستماع لحالة "تمام" للاعبين
      startPlayerReadyListener(currentGameId);
    } else {
      console.warn('⚠️ Firebase sync failed, using localStorage only');
    }
  });
  
  // ✅ تهيئة نظام طلب القدرات الجديد (للمضيف)
  let abilityRequestManager = null;
  if (typeof window.AbilityRequestManager !== 'undefined') {
    abilityRequestManager = new window.AbilityRequestManager();
    
    // استخدام async/await بدلاً من .then()
    try {
      await abilityRequestManager.init({
        syncService: syncService,
        isHost: true,
        playerParam: null,
        playerName: null
      });
      
      console.log('✅ Ability Request System initialized for host');
    } catch (err) {
      console.error('❌ Failed to initialize Ability Request System:', err);
      
      // عرض رسالة للمستخدم
      showToast('خطأ في تهيئة نظام القدرات', 'error');
    }
  } else {
    console.warn('⚠️ AbilityRequestManager not loaded yet');
  }
  
  // Clear used abilities for new game if current round is 0
  const currentRound = parseInt(localStorage.getItem('currentRound') || '0');
  if (currentRound === 0) {
    clearUsedAbilities();
    
    // Clear notes for new game
    localStorage.removeItem('notes:player1');
    localStorage.removeItem('notes:player2');
    
    // Clear notes UI
    const player1NotesEl = document.getElementById('player1Notes');
    const player2NotesEl = document.getElementById('player2Notes');
    if (player1NotesEl) player1NotesEl.value = '';
    if (player2NotesEl) player2NotesEl.value = '';
    
    console.log('✅ Notes cleared for new game');
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
        // ⚠️ renderAbilityRequests تم استبداله بمستمع Firebase
        // المستمع الجديد startAbilityRequestsListener يتولى عرض الطلبات من Firebase
        // renderAbilityRequests();
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
    
    // Listen for card arrangement changes - فقط للاعب الحالي
    if (e.key && (e.key.includes('CardArrangement') || e.key.includes('ArrangementCompleted'))) {
      try {
        // تحقق من أن التغيير خاص باللاعب الحالي فقط
        const currentPlayerParam = window.playerParam || (window.location.search.includes('player=2') ? 'player2' : 'player1');
        if (e.key === `${currentPlayerParam}CardArrangement` || e.key === `${currentPlayerParam}ArrangementCompleted`) {
          console.log(`Card arrangement changed for current player ${currentPlayerParam}, refreshing card data...`);
          refreshCardData();
        } else {
          console.log(`Card arrangement changed for different player (${e.key}), ignoring...`);
        }
      } catch(error) {
        console.error("Error reloading picks after card arrangement change:", error);
      }
    }
    
    // Listen for Strategic order changes - فقط للاعب الحالي
    if (e.key && e.key.includes('StrategicOrdered')) {
      try {
        // تحقق من أن التغيير خاص باللاعب الحالي فقط
        const currentPlayerParam = window.playerParam || (window.location.search.includes('player=2') ? 'player2' : 'player1');
        if (e.key === `${currentPlayerParam}StrategicOrdered`) {
          console.log(`Strategic order changed for current player ${currentPlayerParam}, refreshing card data...`);
          refreshCardData();
        } else {
          console.log(`Strategic order changed for different player (${e.key}), ignoring...`);
        }
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
  
  // ✅ تم إزالة مستمع focus - لا نريد إعادة تحميل الصفحة عند العودة
  // الصفحة تبقى على حالها عند الخروج والعودة إليها
  // window.addEventListener('focus', function() {
  //   try {
  //     // Reload everything on focus
  //     console.log('Window focused, refreshing all data...');
  //     reloadAbilitiesFromGameSetup();
  //     refreshCardData();
  //     renderPanels();
  //   } catch(error) {
  //     console.error("Error re-rendering on focus:", error);
  //   }
  // });
  
  // ✅ تم إزالة مستمع visibilitychange - لا نريد إعادة تحميل الصفحة عند العودة
  // الصفحة تبقى على حالها عند الخروج والعودة إليها
  // document.addEventListener('visibilitychange', function() {
  //   if (!document.hidden) {
  //     try {
  //       console.log('Tab visible, refreshing all data...');
  //       reloadAbilitiesFromGameSetup();
  //       refreshCardData();
  //       renderPanels();
  //     } catch(error) {
  //       console.error("Error re-rendering on visibility change:", error);
  //     }
  //   }
  // });
  
  // Event listeners for ability system
  
  // ❌ Old system disabled - New system handles this automatically
  // startAbilityRequestMonitoring();
  
  window.addEventListener('beforeunload', function() {
    shownNotifications.clear();
  });
  
  // Show welcome message for debugging
  console.log('');
  console.log('=================================================');
  console.log('🎮 نظام طلبات القدرات مفعّل');
  console.log('=================================================');
  console.log('💡 للتحقق من حالة النظام: debugAbilityRequests()');
  console.log('🧪 لاختبار النظام: testAbilityRequest()');
  console.log('🔄 لتحديث الطلبات يدويًا: handleAbilityRequests()');
  console.log('=================================================');
  console.log('');
  
} catch (error) {
  console.error("Error initializing game:", error);
    console.log("حدث خطأ في تحميل اللعبة. يرجى إعادة تحميل الصفحة.");
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
  // ✅ حفظ الملاحظات في localStorage لتكون دائمة
  try {
    const notesKey = `notes:${player}`;
    localStorage.setItem(notesKey, value);
    console.log(`Notes for ${player} saved: ${value}`);
  } catch (error) {
    console.error(`Error saving notes for ${player}:`, error);
  }
}

// مسح ملاحظات اللاعب
function clearNotes(player) {
  try {
    const notesElement = document.getElementById(player === 'player1' ? 'player1Notes' : 'player2Notes');
    
    if (notesElement) {
      notesElement.value = '';
      // مسح من localStorage أيضاً
      const notesKey = `notes:${player}`;
      localStorage.removeItem(notesKey);
      console.log(`تم مسح ملاحظات ${player} من المربع و localStorage`);
    }
  } catch(error) {
    console.error(`Error clearing notes for ${player}:`, error);
  }
}


// عرض ملاحظات الجولات السابقة
function showPreviousNotes(player) {
  try {
    const notesKey = `notes:${player}`;
    const notes = localStorage.getItem(notesKey) || '';
    
    if (notes.trim()) {
      console.log(`ملاحظات ${player}: ${notes}`);
    } else {
      console.log(`لا توجد ملاحظات محفوظة لـ ${player}`);
    }
  } catch(error) {
    console.error(`Error showing previous notes for ${player}:`, error);
  }
}

// Clear used abilities for new game
function clearUsedAbilities() {
  try {
    console.group('🔄 إعادة تفعيل القدرات');
    console.log('بدء عملية إعادة تفعيل القدرات للاعبين');
    
    // مسح طلبات القدرات القديمة
    localStorage.removeItem('abilityRequests');
    
    // إعادة تفعيل القدرات للاعبين
    const player1Abilities = JSON.parse(localStorage.getItem('player1Abilities') || '[]');
    const player2Abilities = JSON.parse(localStorage.getItem('player2Abilities') || '[]');
    
    console.log('القدرات الأصلية للاعب 1:', player1Abilities);
    console.log('القدرات الأصلية للاعب 2:', player2Abilities);
    
    // إعادة تعيين حالة القدرات مع الحفاظ على المعلومات الأصلية
    const resetAbilities = (abilities) => abilities.map(ability => {
      const text = typeof ability === 'string' ? ability : ability.text || ability;
      const originalAbility = typeof ability === 'object' ? ability : { text };
      
      // الحفاظ على المعلومات الأصلية مع إعادة تفعيل القدرة
      return {
        ...originalAbility,
        text,
        used: false  // إعادة التفعيل بشكل مؤكد
      };
    });
    
    const updatedPlayer1Abilities = resetAbilities(player1Abilities);
    const updatedPlayer2Abilities = resetAbilities(player2Abilities);
    
    console.log('القدرات المحدثة للاعب 1:', updatedPlayer1Abilities);
    console.log('القدرات المحدثة للاعب 2:', updatedPlayer2Abilities);
    
    // حفظ القدرات المعاد تفعيلها
    localStorage.setItem('player1Abilities', JSON.stringify(updatedPlayer1Abilities));
    localStorage.setItem('player2Abilities', JSON.stringify(updatedPlayer2Abilities));
    
    // مسح قائمة القدرات المستخدمة
    localStorage.removeItem('player1UsedAbilities');
    localStorage.removeItem('player2UsedAbilities');
    localStorage.removeItem('usedAbilities');
    
    // إعادة ضبط الحالة العامة للقدرات
    const globalAbilityState = {
      globalDisabled: false,
      disabledUntil: null,
      lastResetTimestamp: Date.now()
    };
    localStorage.setItem('globalAbilityState', JSON.stringify(globalAbilityState));
    
    // إشارة تحديث للاعبين لإعادة تحميل القدرات
    localStorage.setItem('abilitiesLastUpdate', Date.now().toString());
    
    // إعادة رسم اللوحات
    renderPanels();
    
    console.log('✅ تم إعادة تفعيل جميع القدرات للاعبين بشكل كامل');
    console.groupEnd();
    
  } catch (error) {
    console.error('خطأ في إعادة تفعيل القدرات:', error);
    console.groupEnd();
  }
}

/* ================== Card Arrangement Commands ================== */
// Command to open player cards page for arrangement (following order.js pattern)
function openPlayerCardsForArrangement(playerParam, playerName) {
  try {
    // Get current game ID
    const gameId = localStorage.getItem('currentGameId') || 'default';
    
    // Generate the player cards URL
    const playerNumber = playerParam === 'player1' ? '1' : '2';
    const baseUrl = window.location.origin + window.location.pathname.replace('card.html', '');
    const playerCardsUrl = `${baseUrl}player-cards.html?gameId=${gameId}&player=${playerNumber}`;
    
    console.log(`Opening player cards for ${playerParam}: ${playerCardsUrl}`);
    
    // Open in new window/tab
    const newWindow = window.open(playerCardsUrl, `player-cards-${playerParam}`, 
      'width=800,height=600,scrollbars=yes,resizable=yes');
    
    if (!newWindow) {
      alert('تم منع النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.');
      return;
    }
    
    // Focus the new window
    newWindow.focus();
    
    // Store the window reference for monitoring
    window.playerCardsWindow = newWindow;
    
    // Start monitoring for arrangement completion
    startMonitoringArrangement(playerParam, playerName);
    
  } catch (error) {
    console.error('Error opening player cards:', error);
    alert('حدث خطأ في فتح صفحة ترتيب البطاقات: ' + error.message);
  }
}

// Monitor arrangement completion
function startMonitoringArrangement(playerParam, playerName) {
  const checkInterval = setInterval(() => {
    try {
      // Check if window is closed
      if (window.playerCardsWindow && window.playerCardsWindow.closed) {
        clearInterval(checkInterval);
        window.playerCardsWindow = null;
        return;
      }
      
      // Check for arrangement completion in localStorage
      const arrangementKey = `${playerParam}ArrangementCompleted`;
      const isCompleted = localStorage.getItem(arrangementKey) === 'true';
      
      if (isCompleted) {
        clearInterval(checkInterval);
        window.playerCardsWindow = null;
        
        // Refresh card data to show the new arrangement
        refreshCardData();
        
        // Show success message
        alert(`تم إكمال ترتيب البطاقات للاعب ${playerName} بنجاح!`);
        
        console.log(`Arrangement completed for ${playerParam}`);
      }
    } catch (error) {
      console.error('Error monitoring arrangement:', error);
    }
  }, 1000); // Check every second
}

// Command to check arrangement status
function checkArrangementStatus(playerParam) {
  const arrangementKey = `${playerParam}ArrangementCompleted`;
  const isCompleted = localStorage.getItem(arrangementKey) === 'true';
  const orderKey = `${playerParam}StrategicOrdered`;
  const order = JSON.parse(localStorage.getItem(orderKey) || '[]');
  
  return {
    isCompleted,
    order,
    playerParam
  };
}

// Command to reset arrangement (for new games)
function resetArrangement(playerParam) {
  try {
    console.log(`🔄 إعادة تعيين ترتيب اللاعب ${playerParam}`);
    
    // استدعاء clearGameData
    clearGameData();
    
    // إعادة تعيين المتغيرات الخاصة بالترتيب
    if (typeof picks !== 'undefined') {
      picks = {
        player1: [],
        player2: []
      };
    }
    
    console.log(`✅ تم إعادة تعيين ترتيب اللاعب ${playerParam}`);
  } catch (error) {
    console.error(`خطأ في إعادة تعيين ترتيب اللاعب ${playerParam}:`, error);
  }
}

// دالة شاملة لمسح بيانات اللعبة
function clearGameData(playerParam = null) {
  try {
    console.log('🧹 مسح شامل لبيانات اللعبة');
    
    // قائمة شاملة بالمفاتيح للمسح
    const gameRelatedKeys = [
      // بيانات اللعبة الأساسية
      'scores', 'currentRound', 'gameSetupProgress', 'gameStatus', 'gameUpdate',
      
      // بيانات اللاعبين
      'player1', 'player2',
      'player1Name', 'player2Name',
      
      // بيانات البطاقات والترتيب
      'player1Picks', 'player2Picks',
      'player1Order', 'player2Order',
      'player1StrategicPicks', 'player2StrategicPicks',
      'player1StrategicOrdered', 'player2StrategicOrdered',
      'player1CardArrangement', 'player2CardArrangement',
      'player1ArrangementCompleted', 'player2ArrangementCompleted',
      
      // القدرات
      'player1Abilities', 'player2Abilities',
      'player1UsedAbilities', 'player2UsedAbilities',
      
      // بيانات اللعبة العامة
      'gameCardSelection', 'gameCardsGenerated', 'gameCardsData',
      'currentGameId', 'currentMatchId',
      
      // بيانات أخرى
      'swapDeckUsageData', 'swapDeckData',
      'generatedCards',
      'tournamentRounds', 'tournamentData', 'matchWinner'
    ];
    
    // مسح المفاتيح المحددة
    gameRelatedKeys.forEach(key => {
      console.log(`🗑️ Removing key: ${key}, Previous value:`, localStorage.getItem(key));
      localStorage.removeItem(key);
    });
    
    // مسح أي مفاتيح متبقية متعلقة باللعبة
    Object.keys(localStorage).forEach(key => {
      const gameRelatedPatterns = [
        'StrategicPicks', 'StrategicOrdered', 
        'CardArrangement', 'ArrangementCompleted',
        'SwapDeck', 'notes:', 
        'player1', 'player2',
        'Order', 'Picks',
        'Abilities', 'UsedAbilities'
      ];
      
      if (gameRelatedPatterns.some(pattern => key.includes(pattern))) {
        console.log(`🗑️ Removing additional game-related key: ${key}`);
        localStorage.removeItem(key);
      }
    });
    
    // إعادة تعيين المتغيرات العامة
    if (window.swapDeckUsageData) {
      window.swapDeckUsageData = { player1: false, player2: false };
    }
    if (window.swapDeckCardsGenerated) {
      window.swapDeckCardsGenerated = false;
    }
    if (window.swapDeckCardsData) {
      window.swapDeckCardsData = {
        player1: { cards: [], used: false },
        player2: { cards: [], used: false }
      };
    }
    if (window.gameCardsGenerated) {
      window.gameCardsGenerated = false;
    }
    if (window.gameCardsData) {
      window.gameCardsData = null;
    }
    
    console.log('✅ تم مسح بيانات اللعبة بنجاح');
    
  } catch (error) {
    console.error('❌ خطأ في مسح بيانات اللعبة:', error);
  }
}

// تعريف دالة clearGameData كدالة عامة
window.clearGameData = clearGameData;

// ================== Ability Request System ================== //
// Handle ability requests from players
// ❌ REMOVED: handleAbilityRequests - النظام القديم تم حذفه بالكامل

// ❌ REMOVED: showAbilityRequestNotification - النظام القديم تم حذفه
function showAbilityRequestNotification_OLD(request) {
  try {
    // Get player name from multiple sources for reliability
    let playerName = request.playerName || request.player;
    
    // If no player name, try to get from playerParam and game config
    if (!playerName || playerName === 'اللاعب' || playerName === 'لاعب') {
      const playerParam = request.playerParam || 'player1';
      if (playerParam === 'player1') {
        playerName = player1 || localStorage.getItem('player1') || 'اللاعب 1';
      } else {
        playerName = player2 || localStorage.getItem('player2') || 'اللاعب 2';
      }
    }
    
    const abilityText = request.abilityText || request.ability || 'القدرة';
    const playerParam = request.playerParam || 'player1';
    const requestId = request.id || request.requestId || `${playerParam}_${abilityText}_${Date.now()}`;
    const uniqueKey = `${playerParam}_${abilityText}`;
    
    // ✅ حذف أي إشعارات موجودة لنفس القدرة قبل عرض الجديدة
    const existingNotification = document.querySelector(`[data-unique-key="${uniqueKey}"]`);
    if (existingNotification) {
      console.log('🧹 حذف إشعار موجود قبل عرض الجديد:', uniqueKey);
      if (existingNotification.parentNode) {
        existingNotification.parentNode.removeChild(existingNotification);
      }
      // حذف من Set أيضاً
      const oldRequestId = existingNotification.getAttribute('data-request-id');
      if (oldRequestId) {
        shownNotifications.delete(oldRequestId);
      }
    }
    
    console.log('🎨 Creating notification:', { 
      playerName, 
      playerParam, 
      abilityText, 
      requestId, 
      uniqueKey,
      originalRequest: request 
    });
    
    // Create notification element
    const wrap = document.createElement("div");
    wrap.setAttribute('data-request-id', requestId);
    wrap.setAttribute('data-unique-key', uniqueKey);
    
    wrap.className = 'ability-request-notification';
    wrap.style.cssText = `
      position: fixed; left: 50%; transform: translateX(-50%);
      bottom: 18px; z-index: 3000; background: #222; color: #fff;
      border: 2px solid #f3c21a; border-radius: 12px; padding: 12px 16px;
      box-shadow: 0 8px 18px rgba(0,0,0,.35); font-weight: 700;
      font-family: "Cairo", sans-serif;
      animation: slideUp 0.3s ease-out;
      min-width: 400px;
    `;
    
    // Create message with player name highlighted
    const msg = document.createElement("div");
    msg.style.marginBottom = "10px";
    msg.style.fontSize = "16px";
    msg.style.lineHeight = "1.6";
    msg.style.fontWeight = "700";
    
    // Player name (highlighted)
    const playerNameSpan = document.createElement("span");
    playerNameSpan.textContent = playerName;
    playerNameSpan.style.cssText = `
      color: #60a5fa;
      font-weight: 900;
      font-size: 17px;
      background: rgba(96, 165, 250, 0.1);
      padding: 2px 8px;
      border-radius: 6px;
      margin: 0 4px;
    `;
    
    // Ability text (highlighted)
    const abilitySpan = document.createElement("span");
    abilitySpan.textContent = abilityText;
    abilitySpan.style.cssText = `
      color: #fbbf24;
      font-weight: 900;
      font-size: 17px;
      background: rgba(251, 191, 36, 0.1);
      padding: 2px 8px;
      border-radius: 6px;
      margin: 0 4px;
    `;
    
    // Build message
    msg.innerHTML = '❗ ';
    msg.appendChild(playerNameSpan);
    msg.appendChild(document.createTextNode(' يطلب استخدام القدرة: '));
    msg.appendChild(abilitySpan);
    
    wrap.appendChild(msg);
    
    // Create buttons row
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.justifyContent = "flex-end";
    
    // Use Now button (green)
    const useBtn = document.createElement("button");
    useBtn.textContent = "✅ قبول واستخدام";
    useBtn.style.cssText = `
      padding: 8px 12px; border-radius: 10px; border: none;
      background: #16a34a; color: #fff; font-weight: 800; cursor: pointer;
      font-family: "Cairo", sans-serif;
      transition: all 0.2s ease;
    `;
    useBtn.onmouseover = () => useBtn.style.background = '#15803d';
    useBtn.onmouseout = () => useBtn.style.background = '#16a34a';
    useBtn.onclick = () => {
      console.log('✅ Approving ability request:', { playerParam, abilityText, requestId });
      approveAbilityRequestFromNotification(playerParam, abilityText, requestId);
      if (wrap.parentNode) {
        wrap.parentNode.removeChild(wrap);
      }
      shownNotifications.delete(requestId);
    };
    row.appendChild(useBtn);
    
    // Close button (red)
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "❌ رفض";
    closeBtn.style.cssText = `
      padding: 8px 12px; border-radius: 10px; border: none;
      background: #dc2626; color: #fff; font-weight: 800; cursor: pointer;
      font-family: "Cairo", sans-serif;
      transition: all 0.2s ease;
    `;
    closeBtn.onmouseover = () => closeBtn.style.background = '#b91c1c';
    closeBtn.onmouseout = () => closeBtn.style.background = '#dc2626';
    closeBtn.onclick = () => {
      console.log('❌ Rejecting ability request:', { playerParam, abilityText, requestId });
      rejectAbilityRequestFromNotification(playerParam, abilityText, requestId);
      if (wrap.parentNode) {
        wrap.parentNode.removeChild(wrap);
      }
      shownNotifications.delete(requestId);
    };
    row.appendChild(closeBtn);
    
    wrap.appendChild(row);
    document.body.appendChild(wrap);
    console.log('✅ Notification added to DOM with ID:', requestId);
    
    // Play sound notification
    setupNotificationSound();
    
    // Auto-remove after 30 seconds (longer time)
    setTimeout(() => {
      if (wrap.parentNode) {
        wrap.parentNode.removeChild(wrap);
        shownNotifications.delete(requestId);
        console.log('⏱️ Notification auto-removed after timeout:', requestId);
      }
    }, 30000);
    
  } catch (error) {
    console.error('❌ Error showing ability request notification:', error);
  }
}

// إذا كانت الدالة موجودة بالفعل، نتجنب إعادة تعريفها
if (typeof setupNotificationSound !== 'function') {
  // إعادة تعريف دالة playNotificationSound
  function playNotificationSound() {
    try {
      // إنشاء صوت باستخدام Web Audio API
      const audioContext = new (window.AudioContext || window.AudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // إعداد الصوت
      oscillator.frequency.value = 800;  // تردد الصوت
      oscillator.type = 'sine';  // نوع الموجة
      
      // التحكم في مستوى الصوت
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      // تشغيل الصوت
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
      
      console.log('🔔 تم تشغيل صوت الإشعار');
    } catch (error) {
      console.warn('تعذر تشغيل صوت الإشعار:', error);
    }
  }
}

// Approve ability request from notification
async function approveAbilityRequestFromNotification(playerParam, abilityText, requestId) {
  try {
    console.log('📝 Approving ability request from notification:', { playerParam, abilityText, requestId });
    
    // ✅ PRIMARY: تحديث في Firebase (يعمل عبر جميع الأجهزة)
    if (syncService.isReady()) {
      try {
        // تحديث حالة الطلب إلى approved
        await syncService.updateAbilityRequestStatus(requestId, 'approved');
        console.log('✅ Request status updated in Firebase');
        
        // إضافة إلى القدرات المستخدمة في Firebase
        await syncService.addUsedAbility(playerParam, abilityText);
        console.log('✅ Added to used abilities in Firebase');
      } catch (firebaseError) {
        console.error('⚠️ Firebase error, continuing with localStorage:', firebaseError);
      }
    }
    
    // ✅ FALLBACK: تحديث localStorage (للتوافق)
    const usedAbilitiesKey = `${playerParam}UsedAbilities`;
    const usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
    if (!usedAbilities.includes(abilityText)) {
      usedAbilities.push(abilityText);
      localStorage.setItem(usedAbilitiesKey, JSON.stringify(usedAbilities));
      console.log('✅ Added to used abilities (localStorage):', usedAbilitiesKey, abilityText);
    }
    
    // ✅ حذف الطلب تماماً من localStorage
    const abilityRequests = JSON.parse(localStorage.getItem('abilityRequests') || '[]');
    const updatedRequests = abilityRequests.filter(req => {
      // احذف الطلب المطابق
      return !(req.id === requestId || 
               (req.playerParam === playerParam && req.abilityText === abilityText && req.status === 'pending'));
    });
    localStorage.setItem('abilityRequests', JSON.stringify(updatedRequests));
    console.log('✅ Request deleted from localStorage:', requestId);
    
    // Update abilities in the abilities panel
    const abilitiesKey = playerParam === 'player1' ? P1_ABILITIES_KEY : P2_ABILITIES_KEY;
    const abilities = JSON.parse(localStorage.getItem(abilitiesKey) || '[]');
    const updatedAbilities = abilities.map(ability => {
      const text = typeof ability === 'string' ? ability : ability.text;
      if (text === abilityText) {
        return typeof ability === 'string' ? { text: ability, used: true } : { ...ability, used: true };
      }
      return ability;
    });
    localStorage.setItem(abilitiesKey, JSON.stringify(updatedAbilities));
    console.log('✅ Abilities updated');
    
    // Trigger storage events for cross-tab sync
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'abilityRequests',
      newValue: localStorage.getItem('abilityRequests'),
      storageArea: localStorage
    }));
    
    window.dispatchEvent(new StorageEvent('storage', {
      key: usedAbilitiesKey,
      newValue: localStorage.getItem(usedAbilitiesKey),
      storageArea: localStorage
    }));
    
    // ✅ إشارة صريحة للتحديث - لضمان المزامنة الفورية
    localStorage.setItem('abilitiesLastUpdate', Date.now().toString());
    
    // Re-render panels
    renderPanels();
    
    // ✅ حذف الإشعار من DOM
    const notificationElement = document.querySelector(`[data-request-id="${requestId}"]`);
    if (notificationElement && notificationElement.parentNode) {
      notificationElement.parentNode.removeChild(notificationElement);
      console.log('✅ Notification removed from DOM (by requestId)');
    }
    
    // ✅ حذف أيضاً باستخدام unique key
    const uniqueKey = `${playerParam}_${abilityText}`;
    const notificationByKey = document.querySelector(`[data-unique-key="${uniqueKey}"]`);
    if (notificationByKey && notificationByKey.parentNode) {
      notificationByKey.parentNode.removeChild(notificationByKey);
      console.log('✅ Notification removed from DOM (by uniqueKey)');
    }
    
    // Remove from tracking set
    if (typeof shownNotifications !== 'undefined') {
      shownNotifications.delete(requestId);
    }
    
    // Show success message
    const playerName = playerParam === 'player1' ? player1 : player2;
    showToast(`✅ تم قبول استخدام "${abilityText}" من ${playerName}`);
    
    console.log(`✅ Ability request approved: ${playerParam} - ${abilityText}`);
    
  } catch (error) {
    console.error('❌ Error approving ability request:', error);
    showToast('❌ حدث خطأ في الموافقة على الطلب');
  }
}

// Reject ability request from notification
function rejectAbilityRequestFromNotification(playerParam, abilityText, requestId) {
  try {
    console.log('📝 Rejecting ability request from notification:', { playerParam, abilityText, requestId });
    
    // ✅ حذف الطلب تماماً من localStorage
    const abilityRequests = JSON.parse(localStorage.getItem('abilityRequests') || '[]');
    const updatedRequests = abilityRequests.filter(req => {
      // احذف الطلب المطابق
      return !(req.id === requestId || 
               (req.playerParam === playerParam && req.abilityText === abilityText && req.status === 'pending'));
    });
    localStorage.setItem('abilityRequests', JSON.stringify(updatedRequests));
    console.log('✅ Request deleted from localStorage:', requestId);
    
    // Trigger storage events for cross-tab sync
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'abilityRequests',
      newValue: localStorage.getItem('abilityRequests'),
      storageArea: localStorage
    }));
    
    // ✅ إشارة صريحة للتحديث - لضمان المزامنة الفورية
    localStorage.setItem('abilitiesLastUpdate', Date.now().toString());
    
    // ✅ حذف الإشعار من DOM
    const notificationElement = document.querySelector(`[data-request-id="${requestId}"]`);
    if (notificationElement && notificationElement.parentNode) {
      notificationElement.parentNode.removeChild(notificationElement);
      console.log('✅ Notification removed from DOM (by requestId)');
    }
    
    // ✅ حذف أيضاً باستخدام unique key
    const uniqueKey = `${playerParam}_${abilityText}`;
    const notificationByKey = document.querySelector(`[data-unique-key="${uniqueKey}"]`);
    if (notificationByKey && notificationByKey.parentNode) {
      notificationByKey.parentNode.removeChild(notificationByKey);
      console.log('✅ Notification removed from DOM (by uniqueKey)');
    }
    
    // Remove from tracking set
    if (typeof shownNotifications !== 'undefined') {
      shownNotifications.delete(requestId);
    }
    
    // Show rejection message
    const playerName = playerParam === 'player1' ? player1 : player2;
    showToast(`❌ تم رفض استخدام "${abilityText}" من ${playerName}`);
    
    console.log(`❌ Ability request rejected: ${playerParam} - ${abilityText}`);
    
  } catch (error) {
    console.error('❌ Error rejecting ability request:', error);
    showToast('❌ حدث خطأ في رفض الطلب');
  }
}

// Remove all ability request notifications
function removeAllAbilityNotifications() {
  try {
    // Find all notifications by their unique styling and custom property
    const notifications = document.querySelectorAll('[style*="position: fixed"][style*="bottom: 18px"]');
    notifications.forEach(notification => {
      if (notification._abilityNotification && notification.parentNode) {
        notification.parentNode.removeChild(notification);
        console.log('Removed ability notification');
      }
    });
  } catch (error) {
    console.error('Error removing notifications:', error);
  }
}

// Initialize BroadcastChannel if available
try {
  if (typeof BroadcastChannel !== 'undefined') {
    window.BroadcastChannel = new BroadcastChannel('ability-updates');
  }
} catch (e) {
  console.log('BroadcastChannel not supported');
}

// Socket.IO removed - using localStorage + Custom Events instead

// ⚠️ startAbilityRequestMonitoring تم استبداله بمستمع Firebase
// المستمع الجديد startAbilityRequestsListener يتولى كل شيء من Firebase
// function startAbilityRequestMonitoring() {
//   console.log('🎯 Starting ability request monitoring system...');
//   
//   // Initial check
//   handleAbilityRequests();
//   
//   // Check for ability requests every 1 second (faster response)
//   const monitoringInterval = setInterval(() => {
//     handleAbilityRequests();
//   }, 1000);
//   
//   // Store interval ID for cleanup if needed
//   window.abilityRequestMonitoringInterval = monitoringInterval;
//   
//   // ⚠️ استماع localStorage تم استبداله بمستمع Firebase
//   // Firebase listener يستمع مباشرة من Realtime Database
//   // window.addEventListener('storage', function(e) {
//   //   if (e.key === 'abilityRequests') {
//   //     console.log('🔔 Storage event received for abilityRequests');
//   //     setTimeout(() => handleAbilityRequests(), 100);
//   //   }
//   // });
//   
//   // Listen for custom events (from same tab)
//   window.addEventListener('abilityRequestAdded', function(e) {
//     console.log('🔔 Custom event received: abilityRequestAdded', e.detail);
//     setTimeout(() => handleAbilityRequests(), 100);
//   });
//   
//   // Listen for focus events to refresh
//   window.addEventListener('focus', function() {
//     console.log('👁️ Window focused, checking for ability requests...');
//     setTimeout(() => handleAbilityRequests(), 200);
//   });
//   
//   // Listen for visibility change
//   document.addEventListener('visibilitychange', function() {
//     if (!document.hidden) {
//       console.log('👁️ Tab visible, checking for ability requests...');
//       setTimeout(() => handleAbilityRequests(), 200);
//     }
//   });
//   
//   console.log('✅ Ability request monitoring system started');
//   console.log('📊 Monitoring interval: 1 second');
//   console.log('📊 Storage events: enabled');
//   console.log('📊 Custom events: enabled');
//   console.log('📊 Focus events: enabled');
// }

// Debug function to check ability request system
window.debugAbilityRequests = function() {
  console.log('=== 🔍 ABILITY REQUEST SYSTEM DEBUG ===');
  
  const abilityRequests = JSON.parse(localStorage.getItem('abilityRequests') || '[]');
  console.log('📋 Total requests:', abilityRequests.length);
  console.log('📋 All requests:', abilityRequests);
  
  const pendingRequests = abilityRequests.filter(req => req.status === 'pending');
  console.log('⏳ Pending requests:', pendingRequests.length);
  console.log('⏳ Pending details:', pendingRequests);
  
  const approvedRequests = abilityRequests.filter(req => req.status === 'approved');
  console.log('✅ Approved requests:', approvedRequests.length);
  
  const rejectedRequests = abilityRequests.filter(req => req.status === 'rejected');
  console.log('❌ Rejected requests:', rejectedRequests.length);
  
  const existingNotifications = document.querySelectorAll('[data-request-id]');
  console.log('🔔 Existing notifications:', existingNotifications.length);
  
  console.log('🕐 Monitoring interval active:', !!window.abilityRequestMonitoringInterval);
  
  console.log('=== END DEBUG ===');
  
  return {
    total: abilityRequests.length,
    pending: pendingRequests,
    approved: approvedRequests.length,
    rejected: rejectedRequests.length,
    notifications: existingNotifications.length
  };
};

// Manual trigger for testing
window.testAbilityRequest = function(playerParam = 'player1', abilityText = 'Test Ability') {
  console.log('🧪 Creating test ability request...');
  
  const testRequest = {
    id: `test_${Date.now()}`,
    playerParam: playerParam,
    playerName: playerParam === 'player1' ? player1 : player2,
    abilityText: abilityText,
    status: 'pending',
    timestamp: Date.now()
  };
  
  // ⚠️ testAbilityRequest تم استبداله - يجب استخدام Firebase مباشرة
  // const abilityRequests = JSON.parse(localStorage.getItem('abilityRequests') || '[]');
  // abilityRequests.push(testRequest);
  // localStorage.setItem('abilityRequests', JSON.stringify(abilityRequests));
  
  console.log('✅ Test request created:', testRequest);
  console.log('💡 يجب إضافة الطلب إلى Firebase مباشرة بدلاً من localStorage');
  console.warn('⚠️ دالة testAbilityRequest تحتاج إلى تحديث لاستخدام Firebase');
  
  // ⚠️ handleAbilityRequests تم استبداله بمستمع Firebase
  // handleAbilityRequests();
  
  return testRequest;
};

// Make commands available globally
window.openPlayerCardsForArrangement = openPlayerCardsForArrangement;
window.checkArrangementStatus = checkArrangementStatus;
window.resetArrangement = resetArrangement;
window.approveAbilityRequest = approveAbilityRequest;
window.rejectAbilityRequest = rejectAbilityRequest;
window.approveAbilityRequestFromNotification = approveAbilityRequestFromNotification;
window.rejectAbilityRequestFromNotification = rejectAbilityRequestFromNotification;
window.handleAbilityRequests = handleAbilityRequests;
window.showAbilityRequestNotification = showAbilityRequestNotification;
window.showToast = showToast;

// ==================== SWAP DECK RESET SYSTEM ====================

/**
 * Complete game reset (for new games)
 */
function resetGameForNewMatch() {
  try {
    console.log('🔄 Resetting game for new match...');
    
    // Reset swap deck system
    resetSwapDeckSystem();
    
    // Clear game-specific data
    localStorage.removeItem('currentRound');
    localStorage.removeItem('player1Notes');
    localStorage.removeItem('player2Notes');
    localStorage.removeItem('health1');
    localStorage.removeItem('health2');
    
    // Reset ability system
    localStorage.removeItem('abilityRequests');
    localStorage.removeItem('lastProcessedRequests');
    
    console.log('✅ Game reset for new match completed');
    
  } catch (error) {
    console.error('❌ Error resetting game for new match:', error);
  }
}

// Make reset functions available globally
window.resetSwapDeckSystem = resetSwapDeckSystem;
window.resetGameForNewMatch = resetGameForNewMatch;

// Make voice system globally available
window.voiceSystem = voiceSystem;
window.createVoiceControls = createVoiceControls;
window.createReplayButtons = createReplayButtons;

// Auto-test voice system on load
setTimeout(() => {
  console.log('🎵 Voice system initialized - testing legendary cards...');
  voiceSystem.testAllLegendaryVoices();
  
  // Add manual test function to window for debugging
  window.testVoice = function(cardName) {
    console.log(`🎵 Testing voice for: ${cardName}`);
    const testPath = `images/${cardName}.webm`;
    voiceSystem.playVoice(testPath, 'Test Player', true);
  };
  
  console.log('🎵 Use window.testVoice("aizen") to test voice playback');
}, 1000);

// Navigate to player page after approving ability request
function navigateToPlayerPage(playerParam, playerName) {
  try {
    // Get current game ID
    const gameId = localStorage.getItem('currentGameId') || 'default';
    
    // Determine player number
    const playerNumber = playerParam === 'player1' ? '1' : '2';
    
    // Generate the player view URL
    const baseUrl = window.location.origin + window.location.pathname.replace('card.html', '');
    const playerViewUrl = `${baseUrl}player-view.html?player=${playerNumber}&gameId=${gameId}`;
    
    console.log(`Navigating to player page for ${playerName}: ${playerViewUrl}`);
    
    // Open player view page in new tab
    const newWindow = window.open(playerViewUrl, `player-view-${playerParam}`, 
      'width=1200,height=800,scrollbars=yes,resizable=yes');
    
    if (!newWindow) {
      console.warn('تم منع النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.');
      // Fallback: try to redirect current window
      if (confirm(`تم قبول طلب القدرة من ${playerName}. هل تريد الانتقال إلى صفحة اللاعب؟`)) {
        window.location.href = playerViewUrl;
      }
      return;
    }
    
    // Focus the new window
    newWindow.focus();
    
    // Show success message
    showToast(`تم فتح صفحة اللاعب ${playerName} بنجاح!`, 'success');
    
  } catch (error) {
    console.error('Error navigating to player page:', error);
    showToast('حدث خطأ في الانتقال إلى صفحة اللاعب', 'error');
  }
}

// Remove tournament game end handler
function handleTournamentGameEnd(winner) {
  console.log('Tournament game end removed');
}

function updateTournamentLeaderboard(winner) {
  console.log('Tournament leaderboard update removed');
}

// Make functions available globally
window.handleTournamentGameEnd = handleTournamentGameEnd;
window.updateTournamentLeaderboard = updateTournamentLeaderboard;

// ================== Ability Request Notifications ==================
function showAbilityRequestNotification(request) {
  try {
    console.group('🔔 إشعار طلب القدرة');
    console.log('تفاصيل الطلب:', request);
    
    // استخراج معلومات اللاعب
    const playerParam = request.playerParam || 'player1';
    const playerName = request.playerName || 
      (playerParam === 'player1' ? player1 : player2) || 
      'اللاعب';
    const abilityText = request.abilityText || 'قدرة غير محددة';
    const requestId = request.id || `${playerParam}_${abilityText}_${Date.now()}`;
    
    console.log('معلومات اللاعب:', { playerParam, playerName, abilityText });
    
    // التحقق من وجود إشعار مماثل
    const existingNotification = document.querySelector(`[data-request-id="${requestId}"]`);
    if (existingNotification) {
      console.log('إشعار مماثل موجود بالفعل');
      return;
    }
    
    // إنشاء عنصر الإشعار
    const notificationContainer = document.createElement('div');
    notificationContainer.className = 'ability-request-notification';
    notificationContainer.setAttribute('data-request-id', requestId);
    notificationContainer.style.cssText = `
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
      bottom: 20px;
      z-index: 3000;
      background: linear-gradient(145deg, #1e293b, #0f172a);
      color: #fff;
      border: 2px solid #f3c21a;
      border-radius: 15px;
      padding: 15px 20px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      max-width: 500px;
      width: 100%;
      font-family: "Cairo", sans-serif;
      animation: slideUp 0.3s ease-out;
    `;
    
    // محتوى الإشعار
    const messageContainer = document.createElement('div');
    messageContainer.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 10px;">
        <span style="color: #f3c21a; margin-left: 10px; font-size: 24px;">🎯</span>
        <span style="font-weight: bold; color: #60a5fa;">${playerName}</span>
        <span style="margin: 0 5px;">يطلب استخدام القدرة:</span>
        <span style="font-weight: bold; color: #10b981;">${abilityText}</span>
      </div>
    `;
    
    // زر القبول
    const acceptButton = document.createElement('button');
    acceptButton.textContent = '✅ قبول';
    acceptButton.style.cssText = `
      background-color: #16a34a;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 8px;
      margin-right: 10px;
      cursor: pointer;
      font-weight: bold;
      transition: all 0.3s ease;
    `;
    acceptButton.onclick = () => {
      console.log('✅ تمت الموافقة على القدرة');
      
      // تحديث القدرات للاعب
      const playerAbilitiesKey = `${playerParam}Abilities`;
      const abilities = JSON.parse(localStorage.getItem(playerAbilitiesKey) || '[]');
      
      const updatedAbilities = abilities.map(ability => {
        const text = typeof ability === 'string' ? ability : ability.text || ability;
        if (text === abilityText) {
          return typeof ability === 'string' 
            ? { text: ability, used: true }
            : { ...ability, used: true };
        }
        return ability;
      });
      
      localStorage.setItem(playerAbilitiesKey, JSON.stringify(updatedAbilities));
      
      // إضافة القدرة للقدرات المستخدمة
      const usedAbilitiesKey = `${playerParam}UsedAbilities`;
      const usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
      if (!usedAbilities.includes(abilityText)) {
        usedAbilities.push(abilityText);
        localStorage.setItem(usedAbilitiesKey, JSON.stringify(usedAbilities));
      }
      
      // ✅ إزالة الطلب من الذاكرة المؤقتة والـ localStorage فور القبول
      processedRequests.delete(requestId);
      const allRequests = JSON.parse(localStorage.getItem('abilityRequests') || '[]');
      const updatedRequests = allRequests.filter(r => r.requestId !== requestId && r.id !== requestId);
      localStorage.setItem('abilityRequests', JSON.stringify(updatedRequests));
      // بثّ حدث لتحديث واجهات اللاعبين الآخرين
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'abilityRequests',
        newValue: JSON.stringify(updatedRequests),
        storageArea: localStorage
      }));
      console.log(`🧹 تم حذف الطلب ${requestId} بعد قبول القدرة بنجاح`);
      
      // إزالة popup من DOM
      const popup = document.getElementById(`popup_${safeEncodeId(requestId)}`);
      if (popup) popup.remove();
      
      // إزالة الإشعار
      notificationContainer.remove();
      
      // إعادة رسم اللوحات
      renderPanels();
      
      // إشعار بالتوست
      showToast(`✅ تم قبول القدرة: ${abilityText}`);
    };
    
    // زر الرفض
    const rejectButton = document.createElement('button');
    rejectButton.textContent = '❌ رفض';
    rejectButton.style.cssText = `
      background-color: #dc2626;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: bold;
      transition: all 0.3s ease;
    `;
    rejectButton.onclick = () => {
      console.log('❌ تم رفض القدرة');
      
      // إزالة popup من DOM
      const popup = document.getElementById(`popup_${safeEncodeId(requestId)}`);
      if (popup) popup.remove();
      
      // إزالة الإشعار
      notificationContainer.remove();
      
      // إشعار بالتوست
      showToast(`❌ تم رفض القدرة: ${abilityText}`);
    };
    
    // إضافة الأزرار
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      justify-content: flex-end;
      margin-top: 10px;
    `;
    buttonContainer.appendChild(acceptButton);
    buttonContainer.appendChild(rejectButton);
    
    // تجميع عناصر الإشعار
    notificationContainer.appendChild(messageContainer);
    notificationContainer.appendChild(buttonContainer);
    
    // إضافة الإشعار للصفحة
    document.body.appendChild(notificationContainer);
    
    // تشغيل صوت الإشعار
    setupNotificationSound();
    
    console.log('✅ تم إنشاء الإشعار بنجاح');
    console.groupEnd();
    
  } catch (error) {
    console.error('❌ خطأ في إنشاء الإشعار:', error);
    console.groupEnd();
  }
}

// ⚠️ استماع localStorage تم استبداله بمستمع Firebase
// Firebase listener يستمع مباشرة من Realtime Database
// window.addEventListener('storage', function(event) {
//   if (event.key === 'abilityRequests') {
//     try {
//       const requests = JSON.parse(event.newValue || '[]');
//       const pendingRequests = requests.filter(req => req.status === 'pending');
//       
//       pendingRequests.forEach(request => {
//         // عرض الإشعار فقط للمضيف
//         if (request.playerParam !== 'player1') {
//           // ✅ استخدام النظام الجديد الآمن
//           showAbilityRequestPopup(request);
//         }
//       });
//     } catch (error) {
//       console.error('خطأ في معالجة طلبات القدرات:', error);
//     }
//   }
// });

// إضافة الدالة للنافذة للوصول العام
window.showAbilityRequestNotification = showAbilityRequestNotification;

// ================== Ability Request Handling ==================
function handleAbilityRequests() {
  try {
    console.group('🔍 معالجة طلبات القدرات');
    
    // جلب الطلبات من localStorage
    const abilityRequests = JSON.parse(localStorage.getItem('abilityRequests') || '[]');
    
    console.log('عدد طلبات القدرات:', abilityRequests.length);
    
    // تصفية الطلبات المعلقة
    const pendingRequests = abilityRequests.filter(req => req.status === 'pending');
    
    console.log('عدد الطلبات المعلقة:', pendingRequests.length);
    
    // عرض الإشعارات للطلبات المعلقة
    pendingRequests.forEach(request => {
      // التأكد من أن الطلب ليس للاعب الحالي
      if (request.playerParam !== 'player1') {
        console.log('طلب قدرة معلق:', request);
        // ✅ استخدام النظام الجديد الآمن
        showAbilityRequestPopup(request);
      }
    });
    
    console.groupEnd();
  } catch (error) {
    console.error('❌ خطأ في معالجة طلبات القدرات:', error);
    console.groupEnd();
  }
}

// التأكد من وجود الدالة في النافذة العامة
if (typeof window.playNotificationSound !== 'function') {
  
}

// دالة تهيئة اللعبة مع معالجة الأخطاء
/* ================== ⚔️ إشعارات القدرات القادمة من اللاعبين ================== */

// ✅ دالة عامة لعرض popup طلب القدرة (تعمل مع البيانات القديمة والجديدة)
function showAbilityRequestPopup(req) {
  // ✅ تحويل البيانات القديمة إلى الصيغة الجديدة
  // استخدام _key من Firebase إذا كان متوفراً (من مستمع Firebase)
  const requestKey = req._key || req.requestId || req.id || `${req.playerParam || req.player}_${req.abilityText || req.ability}_${Date.now()}`;
  const requestId = req.requestId || req.id || requestKey; // للتوافق مع الكود القديم
  const playerName = req.player || req.playerName || (req.playerParam === 'player1' ? player1 : player2) || 'اللاعب';
  const abilityText = req.ability || req.abilityText || 'قدرة غير محددة';
  
  // ✅ استخدام requestKey في safeId لضمان التطابق مع respondToAbilityRequest
  const safeId = `popup_${safeEncodeId(requestKey)}`;
  // تحقق إن كان موجود
  if (document.getElementById(safeId)) {
    console.warn(`⚠️ Popup موجود بالفعل لهذا الطلب: ${requestKey}`);
    return;
  }
  
  // ✅ إنشاء عنصر الإشعار بتصميم متطور
  const popup = document.createElement("div");
  popup.id = safeId;
  popup.className = "ability-popup";
  popup.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(145deg, #1e293b, #0f172a);
    color: #fff;
    padding: 0;
    border-radius: 20px;
    border: 2px solid #f3c21a;
    z-index: 9999;
    font-family: 'Cairo', sans-serif;
    box-shadow: 0 10px 40px rgba(243, 194, 26, 0.4), 0 0 30px rgba(243, 194, 26, 0.2);
    text-align: center;
    min-width: 420px;
    max-width: 500px;
    overflow: hidden;
    animation: slideUpNotification 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    backdrop-filter: blur(10px);
  `;
  
  // ✅ إضافة أنيميشن CSS إذا لم يكن موجوداً
  if (!document.getElementById('ability-popup-styles')) {
    const style = document.createElement('style');
    style.id = 'ability-popup-styles';
    style.textContent = `
      @keyframes slideUpNotification {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(100px) scale(0.8);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0) scale(1);
        }
      }
      @keyframes pulseGlow {
        0%, 100% {
          box-shadow: 0 10px 40px rgba(243, 194, 26, 0.4), 0 0 30px rgba(243, 194, 26, 0.2);
        }
        50% {
          box-shadow: 0 10px 50px rgba(243, 194, 26, 0.6), 0 0 40px rgba(243, 194, 26, 0.4);
        }
      }
      @keyframes rotate {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
      .ability-popup {
        animation: slideUpNotification 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), pulseGlow 2s ease-in-out infinite;
      }
      .ability-popup-btn {
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        position: relative;
        overflow: hidden;
      }
      .ability-popup-btn::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0;
        height: 0;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: translate(-50%, -50%);
        transition: width 0.6s, height 0.6s;
      }
      .ability-popup-btn:hover::before {
        width: 300px;
        height: 300px;
      }
      .ability-popup-btn:hover {
        transform: translateY(-2px) scale(1.05);
      }
      .ability-popup-btn:active {
        transform: translateY(0) scale(0.98);
      }
    `;
    document.head.appendChild(style);
  }
  
  popup.innerHTML = `
    <div style="
      background: linear-gradient(135deg, rgba(243, 194, 26, 0.15), rgba(243, 194, 26, 0.05));
      padding: 20px 25px;
      border-bottom: 1px solid rgba(243, 194, 26, 0.3);
    ">
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;
      ">
        <span style="
          font-size: 32px;
          margin-left: 12px;
          animation: rotate 2s linear infinite;
        ">🎯</span>
        <div style="flex: 1;">
          <div style="
            font-size: 14px;
            color: #94a3b8;
            margin-bottom: 4px;
            font-weight: 600;
          ">طلب استخدام قدرة</div>
          <div style="
            font-size: 18px;
            font-weight: 900;
            color: #60a5fa;
            text-shadow: 0 0 10px rgba(96, 165, 250, 0.5);
          ">${playerName}</div>
        </div>
      </div>
      <div style="
        background: linear-gradient(135deg, rgba(96, 165, 250, 0.1), rgba(147, 197, 253, 0.1));
        padding: 12px 16px;
        border-radius: 12px;
        border: 1px solid rgba(96, 165, 250, 0.3);
        margin-top: 10px;
      ">
        <div style="
          font-size: 13px;
          color: #cbd5e1;
          margin-bottom: 6px;
          font-weight: 600;
        ">القدرة المطلوبة:</div>
        <div style="
          font-size: 20px;
          font-weight: 900;
          color: #fbbf24;
          text-shadow: 0 0 15px rgba(251, 191, 36, 0.6);
          line-height: 1.4;
        ">${abilityText}</div>
      </div>
    </div>
    <div style="
      padding: 18px 25px;
      display: flex;
      gap: 12px;
      justify-content: center;
      background: rgba(15, 23, 42, 0.5);
    ">
      <button id="accept_${requestId}" class="ability-popup-btn" style="
        flex: 1;
        padding: 12px 24px;
        background: linear-gradient(145deg, #16a34a, #15803d);
        border: none;
        border-radius: 12px;
        color: #fff;
        font-weight: 900;
        font-size: 16px;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(22, 163, 74, 0.4);
        font-family: 'Cairo', sans-serif;
      ">✅ قبول</button>
      <button id="reject_${requestId}" class="ability-popup-btn" style="
        flex: 1;
        padding: 12px 24px;
        background: linear-gradient(145deg, #dc2626, #b91c1c);
        border: none;
        border-radius: 12px;
        color: #fff;
        font-weight: 900;
        font-size: 16px;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(220, 38, 38, 0.4);
        font-family: 'Cairo', sans-serif;
      ">❌ رفض</button>
    </div>
  `;
  document.body.appendChild(popup);

  // ✅ استخدام الدالة الجديدة respondToAbilityRequest مع Firebase SDK مباشرة
  // استخدام requestKey (Firebase key) بدلاً من requestId
  document.getElementById(`accept_${requestId}`).onclick = async () => {
    await respondToAbilityRequest(requestKey, true);
    // popup سيتم إغلاقه تلقائياً في respondToAbilityRequest
  };
  document.getElementById(`reject_${requestId}`).onclick = async () => {
    await respondToAbilityRequest(requestKey, false);
    // popup سيتم إغلاقه تلقائياً في respondToAbilityRequest
  };
}

// ✅ دالة لتحديد القدرة كمستخدمة للاعب
function markAbilityAsUsed(playerName, abilityText) {
  console.log(`🎨 تعليم القدرة "${abilityText}" كمستخدمة للاعب ${playerName}`);
  
  // 🔹 تحديد الحاوية الصحيحة حسب اسم اللاعب
  let container;
  if (playerName === "اللاعب الأول" || playerName.includes("1")) {
    container = document.getElementById("player1AbilitiesContainer");
  } else if (playerName === "اللاعب الثاني" || playerName.includes("2")) {
    container = document.getElementById("player2AbilitiesContainer");
  } else {
    console.warn("⚠️ لم يتم التعرف على اللاعب:", playerName);
    return;
  }

  if (!container) {
    console.warn("⚠️ لم يتم العثور على حاوية القدرات للاعب:", playerName);
    return;
  }

  // 🔹 البحث عن الزر الذي يحتوي على نص القدرة
  const buttons = container.querySelectorAll(".btn, button");
  let found = false;
  buttons.forEach(btn => {
    if (btn.textContent.trim() === abilityText.trim()) {
      btn.classList.add("used-ability");
      btn.disabled = true;
      btn.style.filter = "brightness(0.6)";
      btn.style.opacity = "0.6";
      btn.style.pointerEvents = "none";
      found = true;
    }
  });

  if (!found) {
    console.warn(`⚠️ لم يتم العثور على الزر الخاص بالقدرة "${abilityText}" في واجهة ${playerName}`);
  }
}

function updateAbilityRequestStatus(requestId, status) {
  const gameId = localStorage.getItem('currentGameId') || 'default';
  const updateData = {
    status,
    handled: true,
    handledAt: Date.now()
  };

  if (syncService && syncService.isReady()) {
    syncService.update(`/games/${gameId}/abilityRequests/${requestId}`, updateData)
      .then(() => {
        console.log(`✅ تم تحديث حالة الطلب ${requestId} إلى ${status}`);

        // ✅ إذا تم قبول القدرة، حدّث بيانات اللاعب لتصبح مستخدمة
        if (status === "accepted") {
          // جلب الطلب من Firebase لمعرفة اللاعب والقدرة
          syncService.get(`/games/${gameId}/abilityRequests/${requestId}`).then(req => {
            if (!req) return;

            // ✅ تحويل البيانات القديمة إلى الصيغة الجديدة
            const playerName = req.player || req.playerName;
            const abilityText = req.ability || req.abilityText;

            if (playerName && abilityText) {
              markAbilityAsUsed(playerName, abilityText);
            }
          });
        }

        // 🧹 تنظيف الطلب بعد المعالجة
        setTimeout(() => {
          syncService.remove(`/games/${gameId}/abilityRequests/${requestId}`)
            .then(() => console.log(`🧹 تم حذف الطلب ${requestId} بعد معالجته`))
            .catch(err => console.warn('⚠️ فشل حذف الطلب:', err));
        }, 3000);
      })
      .catch(err => console.error("❌ خطأ في تحديث الطلب:", err));
  } else {
    // ✅ Fallback: تحديث localStorage للتوافق مع النظام القديم
    try {
      const abilityRequests = JSON.parse(localStorage.getItem('abilityRequests') || '[]');
      const updatedRequests = abilityRequests.map(req => {
        if (req.id === requestId || req.requestId === requestId) {
          return { ...req, ...updateData };
        }
        return req;
      });
      localStorage.setItem('abilityRequests', JSON.stringify(updatedRequests));
      console.log(`✅ تم تحديث حالة الطلب ${requestId} إلى ${status} (localStorage)`);
      
      // ✅ إذا تم قبول القدرة، حدّث بيانات اللاعب
      if (status === "accepted") {
        const request = updatedRequests.find(req => req.id === requestId || req.requestId === requestId);
        if (request) {
          const playerName = request.player || request.playerName;
          const abilityText = request.ability || request.abilityText;
          if (playerName && abilityText) {
            markAbilityAsUsed(playerName, abilityText);
          }
        }
      }
    } catch (err) {
      console.error("❌ خطأ في تحديث الطلب:", err);
    }
  }
}

/**
 * دالة قبول/رفض طلب القدرة من Firebase مباشرة (Admin Action)
 * تستخدم Firebase Realtime Database SDK مباشرة
 */
async function respondToAbilityRequest(requestKey, accept) {
  if (!database) {
    console.error('❌ Firebase database غير متاح');
    return;
  }

  const gameId = localStorage.getItem('currentGameId') || 'default-game';
  
  try {
    const reqRef = ref(database, `games/${gameId}/abilityRequests/${requestKey}`);
    
    // جلب بيانات الطلب أولاً لمعرفة playerParam و abilityText
    const requestSnapshot = await get(reqRef);
    const request = requestSnapshot.val();
    
    if (!request) {
      console.error('❌ الطلب غير موجود:', requestKey);
      return;
    }

    const newStatus = accept ? 'accepted' : 'rejected';
    const updateData = {
      status: newStatus,
      respondedAt: Date.now(),
      handled: true
    };

    // تحديث حالة الطلب
    await update(reqRef, updateData);
    console.log(`✅ تم ${accept ? 'قبول' : 'رفض'} طلب القدرة:`, requestKey);

    if (accept) {
      // ✅ تخزين أن القدرة مستخدمة عند اللاعب
      const playerParam = request.playerParam || request.player;
      const abilityText = request.abilityText || request.ability;
      
      if (playerParam && abilityText) {
        // استخدام abilityText كمفتاح (مع ترميز آمن)
        const abilityKey = encodeURIComponent(abilityText);
        const usedRef = ref(database, `games/${gameId}/players/${playerParam}/usedAbilities/${abilityKey}`);
        
        await set(usedRef, {
          text: abilityText,
          usedAt: Date.now(),
          usedBy: request.playerName || request.player,
          requestId: requestKey
        });
        
        console.log(`✅ تم حفظ القدرة المستخدمة للاعب ${playerParam}:`, abilityText);
        
        // ✅ تحديث localStorage لتحديث الواجهة فوراً
        const usedAbilitiesKey = `${playerParam}UsedAbilities`;
        const usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
        if (!usedAbilities.includes(abilityText)) {
          usedAbilities.push(abilityText);
          localStorage.setItem(usedAbilitiesKey, JSON.stringify(usedAbilities));
        }
        
        // ✅ تحديث القدرات في localStorage لتظهر مستخدمة
        // استخدام المفتاح المباشر للاعب أولاً
        const playerAbilitiesKey = `${playerParam}Abilities`;
        let abilities = JSON.parse(localStorage.getItem(playerAbilitiesKey) || '[]');
        
        // إذا لم توجد في المفتاح المباشر، جرب المفاتيح العامة
        if (!abilities || abilities.length === 0) {
          const abilitiesKey = playerParam === 'player1' ? P1_ABILITIES_KEY : P2_ABILITIES_KEY;
          abilities = JSON.parse(localStorage.getItem(abilitiesKey) || '[]');
        }
        
        // ✅ التأكد من أن abilities مصفوفة وليست فارغة
        if (!Array.isArray(abilities) || abilities.length === 0) {
          console.warn(`⚠️ لا توجد قدرات للاعب ${playerParam} - سيتم تحميلها من المفاتيح الأخرى`);
          // محاولة تحميل القدرات من المفاتيح الأخرى
          const abilitiesKey = playerParam === 'player1' ? P1_ABILITIES_KEY : P2_ABILITIES_KEY;
          abilities = JSON.parse(localStorage.getItem(abilitiesKey) || '[]');
        }
        
        // ✅ تحديث القدرات مع الحفاظ على جميع القدرات
        const updatedAbilities = abilities.map(ability => {
          const text = typeof ability === 'string' ? ability : (ability.text || ability);
          if (text === abilityText) {
            // تحديث هذه القدرة فقط لتكون مستخدمة
            return typeof ability === 'string' ? { text: ability, used: true } : { ...ability, used: true };
          }
          // الحفاظ على القدرات الأخرى كما هي
          return typeof ability === 'string' ? { text: ability, used: ability.used || false } : ability;
        });
        
        // ✅ حفظ في كلا المفتاحين لضمان المزامنة
        localStorage.setItem(playerAbilitiesKey, JSON.stringify(updatedAbilities));
        const abilitiesKey = playerParam === 'player1' ? P1_ABILITIES_KEY : P2_ABILITIES_KEY;
        localStorage.setItem(abilitiesKey, JSON.stringify(updatedAbilities));
        
        console.log(`✅ تم تحديث القدرات للاعب ${playerParam}:`, updatedAbilities.length, 'قدرة');
        
        // ✅ إعادة رسم اللوحات لتحديث الواجهة
        if (typeof renderPanels === 'function') {
          renderPanels();
          console.log('✅ تم تحديث واجهة القدرات');
        }
      } else {
        console.warn('⚠️ معلومات اللاعب أو القدرة غير متوفرة في الطلب');
      }
    }

    // إغلاق popup إذا كان موجوداً - استخدام جميع المعرفات المحتملة
    const requestId = request.requestId || request.id || requestKey;
    const popupId1 = `popup_${safeEncodeId(requestKey)}`;
    const popupId2 = `popup_${safeEncodeId(requestId)}`;
    
    let popup = document.getElementById(popupId1);
    if (!popup) {
      popup = document.getElementById(popupId2);
    }
    
    // أيضاً البحث عن popup باستخدام class
    if (!popup) {
      const popups = document.querySelectorAll('.ability-popup');
      popups.forEach(p => {
        const acceptBtn = p.querySelector(`#accept_${requestId}`);
        const rejectBtn = p.querySelector(`#reject_${requestId}`);
        if (acceptBtn || rejectBtn) {
          popup = p;
        }
      });
    }
    
    if (popup) {
      popup.remove();
      console.log('✅ تم إغلاق popup الطلب');
    } else {
      console.warn('⚠️ لم يتم العثور على popup للإغلاق:', { requestKey, requestId, popupId1, popupId2 });
    }

    // إشعار فوري محلي لواجهة admin
    if (accept) {
      showToast(`✅ تم قبول طلب القدرة: ${request.abilityText || 'غير محدد'}`);
    } else {
      showToast(`❌ تم رفض طلب القدرة: ${request.abilityText || 'غير محدد'}`);
    }

    // (خيار) حذف الطلب بعد فترة زمنية
    setTimeout(async () => {
      try {
        await remove(reqRef);
        console.log(`🧹 تم حذف الطلب ${requestKey} بعد معالجته`);
      } catch (err) {
        console.warn('⚠️ فشل حذف الطلب:', err);
      }
    }, 3000);

  } catch (error) {
    console.error('❌ خطأ في معالجة طلب القدرة:', error);
    showToast('❌ حدث خطأ في معالجة الطلب', 'error');
  }
}

// إضافة الدالة إلى النافذة العامة للوصول إليها من أي مكان
window.respondToAbilityRequest = respondToAbilityRequest;

async function initializeGame() {
  console.group('🚀 تهيئة اللعبة');
  
  try {
    // التحقق من وجود syncService
    if (!syncService || typeof syncService.initSync !== 'function') {
      console.warn('⚠️ syncService غير مهيأ بشكل صحيح');
      throw new Error('syncService not properly initialized');
    }
    
    // تهيئة المزامنة
    const gameId = localStorage.getItem('currentGameId') || 'default';
    
    console.log('معرف اللعبة:', gameId);
    
    const syncResult = await syncService.initSync(gameId);
    
    console.log('نتيجة المزامنة:', syncResult);
    
    /* ================== ⚔️ إشعارات القدرات القادمة من اللاعبين ================== */
    
    // ⚠️ syncService.on تم استبداله بمستمع Firebase الجديد
    // المستمع الجديد startAbilityRequestsListener يتولى عرض الطلبات من Firebase
    // syncService.on(`/games/${gameId}/abilityRequests`, (requests) => {
    //   if (!requests) return;
    //   
    //   Object.values(requests).forEach(req => {
    //     // ✅ نتأكد أن الطلب لم يُعالج مسبقًا
    //     if (req.status === "pending" && !req.handled) {
    //       // نتأكد أيضًا أنه لا يوجد popup موجود له
    //       if (!document.getElementById(req.requestId || req.id)) {
    //         showAbilityRequestPopup(req);
    //       }
    //     }
    //   });
    // });
    
    // إعداد أنظمة أخرى
    setupAbilitySystem();
    setupNotificationSystem();
    
    console.log('✅ تمت تهيئة اللعبة بنجاح');
    console.groupEnd();
    
    return syncResult;
  } catch (error) {
    console.error('❌ خطأ في تهيئة اللعبة:', error);
    console.groupEnd();
    
    // عرض رسالة للمستخدم
    showToast('حدث خطأ أثناء تهيئة اللعبة. يرجى المحاولة مرة أخرى.', 'error');
    
    throw error;
  }
}

// دالة إعداد نظام القدرات
function setupAbilitySystem() {
  console.log('🔧 إعداد نظام القدرات');
  
  // التأكد من وجود دالة playNotificationSound
  if (typeof setupNotificationSound !== 'function') {
    console.warn('⚠️ playNotificationSound غير معرفة، إنشاء نسخة افتراضية');
    
    window.playNotificationSound = function() {
      try {
        // إنشاء صوت باستخدام Web Audio API
        const audioContext = new (window.AudioContext || window.AudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // إعداد الصوت
        oscillator.frequency.value = 800;  // تردد الصوت
        oscillator.type = 'sine';  // نوع الموجة
        
        // التحكم في مستوى الصوت
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        // تشغيل الصوت
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
        
        console.log('🔔 تم تشغيل صوت الإشعار');
      } catch (error) {
        console.warn('تعذر تشغيل صوت الإشعار:', error);
      }
    };
  }
}

// دالة إعداد نظام الإشعارات
function setupNotificationSystem() {
  console.group('🔊 إعداد نظام الإشعارات');
  
  try {
    // التأكد من تعيين دالة playNotificationSound للنافذة العامة
    if (typeof window.playNotificationSound !== 'function') {
      console.warn('⚠️ تعيين playNotificationSound للنافذة العامة');
      window.playNotificationSound = function() {
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) {
            console.warn('Web Audio API غير مدعوم');
            return;
          }
          
          const audioContext = new AudioContext();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = 800;
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.5);
          
          console.log('🔔 تم تشغيل صوت الإشعار');
        } catch (error) {
          console.warn('تعذر تشغيل صوت الإشعار:', error);
        }
      };
    }
    
    // التحقق من وجود BroadcastChannel مع إنشاء قناة احتياطية
    function createFallbackChannel() {
      const listeners = [];
      return {
        postMessage: (message) => {
          // استخدام localStorage كوسيلة اتصال احتياطية
          localStorage.setItem('ability-updates', JSON.stringify(message));
          listeners.forEach(listener => listener({ data: message }));
        },
        addEventListener: (event, callback) => {
          if (event === 'message') {
            const storageListener = (e) => {
              if (e.key === 'ability-updates') {
                try {
                  const message = JSON.parse(e.newValue);
                  callback({ data: message });
                } catch (error) {
                  console.error('خطأ في تحليل رسالة localStorage:', error);
                }
              }
            };
            window.addEventListener('storage', storageListener);
            listeners.push(callback);
          }
        },
        close: () => {
          // مسح المستمعين
          listeners.length = 0;
        }
      };
    }

    // التحقق من دعم BroadcastChannel
    if ('BroadcastChannel' in window) {
      try {
        window.broadcastChannel = new BroadcastChannel('ability-updates');
        console.log('✅ BroadcastChannel متاح');
      } catch (error) {
        console.warn('⚠️ فشل إنشاء BroadcastChannel', error);
        window.broadcastChannel = createFallbackChannel();
      }
    } else {
      console.warn('⚠️ BroadcastChannel غير متاح');
      window.broadcastChannel = createFallbackChannel();
    }
    
    console.log('playNotificationSound في النافذة العامة:', typeof window.playNotificationSound);
  } catch (error) {
    console.error('❌ خطأ في إعداد نظام الإشعارات:', error);
  } finally {
    console.groupEnd();
  }
}

// دالة إعداد وتشغيل صوت الإشعارات
function playNotificationSound() {
  try {
    console.log('🔔 محاولة تشغيل صوت الإشعار');
    
    // التأكد من دعم Web Audio API
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      console.warn('Web Audio API غير مدعوم');
      return;
    }
    
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // إعداد الصوت
    oscillator.frequency.value = 800;  // تردد الصوت
    oscillator.type = 'sine';  // نوع الموجة
    
    // التحكم في مستوى الصوت
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    // تشغيل الصوت
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
    
    console.log('✅ تم تشغيل صوت الإشعار');
  } catch (error) {
    console.error('❌ خطأ في تشغيل صوت الإشعار:', error);
  }
}

// استدعاء إعداد نظام الإشعارات عند تحميل المستند
document.addEventListener('DOMContentLoaded', setupNotificationSystem);

// دالة بسيطة لتشغيل صوت الإشعار
if (typeof window.playNotificationSound !== 'function') {
  window.playNotificationSound = function() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        console.warn('Web Audio API غير مدعوم');
        return;
      }
      
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
      
      console.log('🔔 تم تشغيل صوت الإشعار');
    } catch (error) {
      console.warn('تعذر تشغيل صوت الإشعار:', error);
    }
  };
}

// التأكد من وجود الدالة في النافذة العامة
window.playNotificationSound = playNotificationSound;