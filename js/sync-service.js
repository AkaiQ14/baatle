/**
 * Sync Service - مزامنة البيانات بين جميع الأجهزة عبر Firebase
 * 
 * هذا الملف يوفر مزامنة فورية لـ:
 * - طلبات القدرات
 * - حالة اللعبة
 * - القدرات المستخدمة
 * - النتائج والنقاط
 */

import { database } from './firebase-init.js';
import { ref, set, get, onValue, push, update, remove, query, orderByChild, equalTo } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

class SyncService {
  constructor() {
    this.gameId = null;
    this.listeners = new Map();
    this.isInitialized = false;
  }

  /**
   * تهيئة المزامنة للعبة محددة
   */
  async initSync(gameId) {
    if (!gameId) {
      console.error('❌ Game ID is required for sync');
      return false;
    }

    this.gameId = gameId;
    console.log(`🔄 بدء المزامنة للعبة: ${gameId}`);
    
    try {
      // الاستماع لتغييرات طلبات القدرات
      this.listenToAbilityRequests();
      
      // الاستماع لتغييرات حالة اللعبة
      this.listenToGameState();
      
      // الاستماع لتغييرات القدرات المستخدمة
      this.listenToUsedAbilities();
      
      this.isInitialized = true;
      console.log('✅ تم تهيئة المزامنة بنجاح');
      return true;
    } catch (error) {
      console.error('❌ خطأ في تهيئة المزامنة:', error);
      return false;
    }
  }

  /**
   * إضافة طلب قدرة جديد إلى Firebase
   */
  async addAbilityRequest(request) {
    if (!this.gameId) {
      console.error('❌ Sync not initialized');
      return null;
    }

    try {
      const requestsRef = ref(database, `games/${this.gameId}/abilityRequests`);
      const newRequestRef = push(requestsRef);
      
      const requestData = {
        ...request,
        id: newRequestRef.key,
        timestamp: Date.now(),
        status: 'pending'
      };
      
      await set(newRequestRef, requestData);
      
      console.log('✅ تم إضافة طلب القدرة إلى Firebase:', requestData);
      return requestData;
    } catch (error) {
      console.error('❌ خطأ في إضافة طلب القدرة:', error);
      return null;
    }
  }

  /**
   * الاستماع لطلبات القدرات (للمضيف)
   */
  listenToAbilityRequests() {
    const requestsRef = ref(database, `games/${this.gameId}/abilityRequests`);
    
    const unsubscribe = onValue(requestsRef, (snapshot) => {
      const requests = [];
      
      snapshot.forEach((childSnapshot) => {
        requests.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      
      console.log('📥 استلام طلبات القدرات من Firebase:', requests.length);
      
      // تحديث localStorage للتوافق مع النظام الحالي
      localStorage.setItem('abilityRequests', JSON.stringify(requests));
      
      // إطلاق حدث مخصص لتحديث الواجهة
      window.dispatchEvent(new CustomEvent('abilityRequestsSync', {
        detail: { requests }
      }));
      
      // أيضاً إطلاق حدث storage للتوافق
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'abilityRequests',
        newValue: JSON.stringify(requests),
        storageArea: localStorage
      }));
    }, (error) => {
      console.error('❌ خطأ في الاستماع لطلبات القدرات:', error);
    });
    
    this.listeners.set('abilityRequests', unsubscribe);
  }

  /**
   * تحديث حالة طلب القدرة
   */
  async updateAbilityRequestStatus(requestId, status) {
    if (!this.gameId) {
      console.error('❌ Sync not initialized');
      return false;
    }

    try {
      const requestRef = ref(database, `games/${this.gameId}/abilityRequests/${requestId}`);
      
      await update(requestRef, {
        status: status,
        updatedAt: Date.now()
      });
      
      console.log(`✅ تم تحديث حالة الطلب ${requestId} إلى ${status}`);
      return true;
    } catch (error) {
      console.error('❌ خطأ في تحديث حالة الطلب:', error);
      return false;
    }
  }

  /**
   * حذف طلب قدرة من Firebase
   */
  async removeAbilityRequest(requestId) {
    if (!this.gameId) {
      console.error('❌ Sync not initialized');
      return false;
    }

    try {
      const requestRef = ref(database, `games/${this.gameId}/abilityRequests/${requestId}`);
      await remove(requestRef);
      
      console.log(`✅ تم حذف الطلب ${requestId}`);
      return true;
    } catch (error) {
      console.error('❌ خطأ في حذف الطلب:', error);
      return false;
    }
  }

  /**
   * تحديث حالة اللعبة
   */
  async updateGameState(state) {
    if (!this.gameId) {
      console.error('❌ Sync not initialized');
      return false;
    }

    try {
      const stateRef = ref(database, `games/${this.gameId}/gameState`);
      
      await update(stateRef, {
        ...state,
        updatedAt: Date.now()
      });
      
      console.log('✅ تم تحديث حالة اللعبة في Firebase');
      return true;
    } catch (error) {
      console.error('❌ خطأ في تحديث حالة اللعبة:', error);
      return false;
    }
  }

  /**
   * الاستماع لحالة اللعبة
   */
  listenToGameState() {
    const stateRef = ref(database, `games/${this.gameId}/gameState`);
    
    const unsubscribe = onValue(stateRef, (snapshot) => {
      const state = snapshot.val();
      
      if (state) {
        console.log('📥 استلام حالة اللعبة من Firebase:', state);
        
        // تحديث localStorage
        if (state.currentRound !== undefined) {
          localStorage.setItem('currentRound', state.currentRound.toString());
        }
        if (state.scores) {
          localStorage.setItem('scores', JSON.stringify(state.scores));
        }
        
        // إطلاق حدث مخصص
        window.dispatchEvent(new CustomEvent('gameStateSync', {
          detail: { state }
        }));
      }
    }, (error) => {
      console.error('❌ خطأ في الاستماع لحالة اللعبة:', error);
    });
    
    this.listeners.set('gameState', unsubscribe);
  }

  /**
   * إضافة قدرة مستخدمة
   */
  async addUsedAbility(playerParam, abilityText) {
    if (!this.gameId) {
      console.error('❌ Sync not initialized');
      return false;
    }

    try {
      const usedRef = ref(database, `games/${this.gameId}/players/${playerParam}/usedAbilities`);
      const snapshot = await get(usedRef);
      const usedAbilities = snapshot.val() || [];
      
      if (!usedAbilities.includes(abilityText)) {
        usedAbilities.push(abilityText);
        await set(usedRef, usedAbilities);
        
        console.log(`✅ تم إضافة القدرة المستخدمة: ${abilityText} لـ ${playerParam}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ خطأ في إضافة القدرة المستخدمة:', error);
      return false;
    }
  }

  /**
   * إزالة قدرة من القدرات المستخدمة
   */
  async removeUsedAbility(playerParam, abilityText) {
    if (!this.gameId) {
      console.error('❌ Sync not initialized');
      return false;
    }

    try {
      const usedRef = ref(database, `games/${this.gameId}/players/${playerParam}/usedAbilities`);
      const snapshot = await get(usedRef);
      const usedAbilities = snapshot.val() || [];
      
      const filtered = usedAbilities.filter(ability => ability !== abilityText);
      await set(usedRef, filtered);
      
      console.log(`✅ تم إزالة القدرة المستخدمة: ${abilityText} من ${playerParam}`);
      return true;
    } catch (error) {
      console.error('❌ خطأ في إزالة القدرة المستخدمة:', error);
      return false;
    }
  }

  /**
   * الاستماع للقدرات المستخدمة
   */
  listenToUsedAbilities() {
    ['player1', 'player2'].forEach(playerParam => {
      const usedRef = ref(database, `games/${this.gameId}/players/${playerParam}/usedAbilities`);
      
      const unsubscribe = onValue(usedRef, (snapshot) => {
        const usedAbilities = snapshot.val() || [];
        console.log(`📥 استلام القدرات المستخدمة لـ ${playerParam}:`, usedAbilities.length);
        
        // تحديث localStorage
        localStorage.setItem(`${playerParam}UsedAbilities`, JSON.stringify(usedAbilities));
        
        // إطلاق حدث مخصص
        window.dispatchEvent(new CustomEvent('usedAbilitiesSync', {
          detail: { playerParam, usedAbilities }
        }));
      }, (error) => {
        console.error(`❌ خطأ في الاستماع للقدرات المستخدمة لـ ${playerParam}:`, error);
      });
      
      this.listeners.set(`usedAbilities_${playerParam}`, unsubscribe);
    });
  }

  /**
   * مسح جميع طلبات القدرات
   */
  async clearAbilityRequests() {
    if (!this.gameId) {
      console.error('❌ Sync not initialized');
      return false;
    }

    try {
      const requestsRef = ref(database, `games/${this.gameId}/abilityRequests`);
      await remove(requestsRef);
      
      console.log('✅ تم مسح جميع طلبات القدرات');
      return true;
    } catch (error) {
      console.error('❌ خطأ في مسح طلبات القدرات:', error);
      return false;
    }
  }

  /**
   * إيقاف جميع المستمعين
   */
  stopSync() {
    console.log('🛑 إيقاف المزامنة...');
    
    // إيقاف جميع المستمعين
    this.listeners.forEach((unsubscribe, key) => {
      try {
        unsubscribe();
        console.log(`✅ تم إيقاف المستمع: ${key}`);
      } catch (error) {
        console.error(`❌ خطأ في إيقاف المستمع ${key}:`, error);
      }
    });
    
    this.listeners.clear();
    this.isInitialized = false;
    console.log('✅ تم إيقاف جميع المستمعين');
  }

  /**
   * التحقق من حالة المزامنة
   */
  isReady() {
    return this.isInitialized && this.gameId !== null;
  }

  /**
   * الحصول على Game ID الحالي
   */
  getGameId() {
    return this.gameId;
  }
}

// إنشاء instance واحد (Singleton)
const syncService = new SyncService();

// جعل الـ service متاح عالمياً للتشخيص
window.syncService = syncService;

export { syncService };
export default syncService;

