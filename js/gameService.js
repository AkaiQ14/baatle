// js/gameService.js
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  getDoc, 
  onSnapshot,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';

// ✅ Wait for Firebase to be initialized
let auth, db;

// دالة للحصول على Firebase app
function getAppInstance() {
  try {
    // محاولة من firebase-init.js أولاً
    if (window.firebaseApp) {
      return window.firebaseApp;
    }
    // محاولة من getApp
    return getApp();
  } catch (error) {
    console.warn('Firebase not initialized yet, will use window objects...');
    return null;
  }
}

// تهيئة Firebase
function initializeFirebase() {
  try {
    const app = getAppInstance();
    if (app) {
      auth = getAuth(app);
      db = getFirestore(app);
      console.log('✅ Firebase initialized in GameService');
    } else {
      // Fallback: get from window if available
      if (window.auth && window.db) {
        auth = window.auth;
        db = window.db;
        console.log('✅ Firebase initialized from window objects');
      }
    }
  } catch (error) {
    console.warn('Firebase initialization warning:', error);
    // Fallback: get from window if available
    if (window.auth && window.db) {
      auth = window.auth;
      db = window.db;
    }
  }
}

// تهيئة فورية
initializeFirebase();

// ✅ محاولة إضافية بعد تأخير قصير
setTimeout(() => {
  if (!auth || !db) {
    initializeFirebase();
  }
}, 100);

export class GameService {
  // إنشاء لعبة جديدة
  static async createGame(player1Name, player2Name, rounds, advancedMode = false) {
    console.log('🎮 GameService.createGame called with:', { player1Name, player2Name, rounds, advancedMode });
    
    // Ensure auth and db are initialized
    if (!auth || !db) {
      console.log('⚠️ auth or db not initialized, trying to initialize...');
      try {
        const app = getAppInstance();
        if (app) {
          auth = getAuth(app);
          db = getFirestore(app);
          console.log('✅ Firebase initialized in createGame');
        } else {
          // Fallback: get from window
          if (window.auth && window.db) {
            auth = window.auth;
            db = window.db;
            console.log('✅ Firebase initialized from window objects');
          } else {
            throw new Error('Firebase not initialized');
          }
        }
      } catch (error) {
        console.error('❌ Error initializing Firebase:', error);
        throw new Error('فشل تهيئة Firebase: ' + error.message);
      }
    }
    
    if (!auth || !db) {
      throw new Error('Firebase غير مهيأ بشكل صحيح');
    }
    
    const user = auth.currentUser;
    if (!user) {
      console.error('❌ User not logged in');
      throw new Error('الرجاء تسجيل الدخول أولاً');
    }
    
    console.log('✅ User authenticated:', user.uid);

    const gameData = {
      player1: {
        name: player1Name,
        cards: [],
        abilities: [],
        cardOrder: [],
        isReady: false
      },
      player2: {
        name: player2Name,
        cards: [],
        abilities: [],
        cardOrder: [],
        isReady: false
      },
      rounds: rounds,
      advancedMode: advancedMode,
      status: 'waiting',
      creatorId: user.uid,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const gameId = crypto.randomUUID();
    await setDoc(doc(db, "games", gameId), gameData);
    return gameId;
  }
  
  // ✅ إنشاء لعبة بطولة (مع matchId محدد)
  static async createTournamentGame(matchId, gameData) {
    // Ensure db is initialized
    if (!db) {
      const app = getApp();
      db = getFirestore(app);
    }
    
    // إنشاء سجل اللعبة في Firebase بـ matchId محدد
    await setDoc(doc(db, "games", matchId), gameData);
    console.log(`✅ Tournament game created with ID: ${matchId}`);
    return matchId;
  }
  
  // حفظ البطاقات
  static async savePlayerCards(gameId, player, cards) {
    // Ensure db is initialized
    if (!db) {
      const app = getApp();
      db = getFirestore(app);
    }
    
    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      [`player${player}.cards`]: cards,
      updatedAt: new Date()
    });
  }
  
  // حفظ cardSlots (البطاقات الصفراء مع 3 كروت لكل بطاقة)
  static async savePlayerCardSlots(gameId, player, cardSlots) {
    // Ensure db is initialized
    if (!db) {
      const app = getApp();
      db = getFirestore(app);
    }
    
    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      [`player${player}.cardSlots`]: cardSlots,
      updatedAt: new Date()
    });
  }
  
  // حفظ القدرات
  static async savePlayerAbilities(gameId, player, abilities) {
    // Ensure db is initialized
    if (!db) {
      const app = getApp();
      db = getFirestore(app);
    }
    
    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      [`player${player}.abilities`]: abilities,
      updatedAt: new Date()
    });
  }
  
  // ✅ حفظ علامة أن اللاعب أنهى اختيار الكروت (قبل الترتيب)
  static async savePlayerCardsSelected(gameId, player, cardsSelected) {
    // Ensure db is initialized
    if (!db) {
      const app = getApp();
      db = getFirestore(app);
    }
    
    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      [`player${player}.cardsSelected`]: cardsSelected,
      updatedAt: new Date()
    });
  }
  
  // حفظ ترتيب البطاقات
  static async saveCardOrder(gameId, player, cardOrder) {
    // Ensure db is initialized
    if (!db) {
      const app = getApp();
      db = getFirestore(app);
    }
    
    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      [`player${player}.cardOrder`]: cardOrder,
      [`player${player}.isReady`]: true,
      updatedAt: new Date()
    });
  }
  
  // جلب بيانات اللعبة
  static async getGame(gameId) {
    // ✅ Ensure db is initialized
    if (!db) {
      initializeFirebase();
      // انتظار قصير إذا لم يكن مهيأ بعد
      if (!db) {
        await new Promise(resolve => setTimeout(resolve, 100));
        initializeFirebase();
      }
    }
    
    // ✅ التأكد من أن db مهيأ قبل الاستخدام
    if (!db) {
      throw new Error('Firebase not initialized. Please refresh the page.');
    }
    
    const gameRef = doc(db, 'games', gameId);
    const gameSnap = await getDoc(gameRef);
    
    if (gameSnap.exists()) {
      return gameSnap.data();
    } else {
      throw new Error('Game not found');
    }
  }
  
  // الاستماع للتغييرات في الوقت الفعلي
  static listenToGame(gameId, callback) {
    // Ensure db is initialized
    if (!db) {
      const app = getApp();
      db = getFirestore(app);
    }
    
    const gameRef = doc(db, 'games', gameId);
    return onSnapshot(gameRef, (doc) => {
      if (doc.exists()) {
        callback(doc.data());
      }
    });
  }

  // جلب بطاقات اللاعب
  static async getPlayerPicks(gameId, playerParam) {
    // Ensure db is initialized
    if (!db) {
      const app = getApp();
      db = getFirestore(app);
    }
    
    const gameRef = doc(db, 'games', gameId);
    const gameSnap = await getDoc(gameRef);
    
    if (gameSnap.exists()) {
      const gameData = gameSnap.data();
      const playerNumber = playerParam === 'player2' ? 2 : 1;
      return gameData[`player${playerNumber}`]?.cards || [];
    } else {
      throw new Error('Game not found');
    }
  }
  
  // جلب ترتيب بطاقات اللاعب
  static async getPlayerOrder(gameId, playerParam) {
    // Ensure db is initialized
    if (!db) {
      const app = getApp();
      db = getFirestore(app);
    }
    
    const gameRef = doc(db, 'games', gameId);
    const gameSnap = await getDoc(gameRef);
    
    if (gameSnap.exists()) {
      const gameData = gameSnap.data();
      const playerNumber = playerParam === 'player2' ? 2 : 1;
      return gameData[`player${playerNumber}`]?.cardOrder || [];
    } else {
      throw new Error('Game not found');
    }
  }
}