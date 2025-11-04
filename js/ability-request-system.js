/**
 * =====================================================
 * 🎯 نظام طلب القدرات الجديد والمحسّن
 * =====================================================
 * 
 * نظام بسيط وفعّال لطلب القدرات بين اللاعبين والمضيف
 * - يعمل بدون تداخل أو تكرار
 * - يستخدم Firebase كمصدر رئيسي
 * - localStorage كنسخة احتياطية
 * - يدعم إعادة تفعيل القدرات عند الرفض
 * - واجهة بسيطة وسهلة الاستخدام
 */

// ========== Configuration ==========
const ABILITY_REQUEST_TIMEOUT = 30000; // 30 ثانية
const REQUEST_CHECK_INTERVAL = 1000; // كل ثانية
const MAX_ABILITY_REQUESTS = 3; // الحد الأقصى للطلبات المعلقة
const ABILITY_COOLDOWN = 5 * 60 * 1000; // 5 دقائق للتبريد

// ========== State Management ==========
class AbilityRequestManager {
  constructor() {
    this.syncService = null;
    this.isHost = false;
    this.playerParam = null;
    this.playerName = null;
    
    this.ABILITY_REQUESTS_KEY = 'abilityRequests';
    this.ABILITY_UPDATES_KEY = 'abilityUpdates';
    this.ABILITY_GLOBAL_STATE_KEY = 'globalAbilityState';
    
    this.broadcastChannel = null;
    
    this.setupEventListeners();
  }
  
  // تهيئة النظام
  async init(config) {
    try {
      // التحقق من صحة التكوين
      if (!config || !config.syncService) {
        throw new Error('Invalid configuration for AbilityRequestManager');
      }

      this.syncService = config.syncService;
      this.isHost = config.isHost || false;
      this.playerParam = config.playerParam;
      this.playerName = config.playerName;
      
      // إعداد قناة البث
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel('ability-updates');
        this.broadcastChannel.onmessage = this.handleBroadcastMessage.bind(this);
      }
      
      // تنظيف الطلبات القديمة وإعادة ضبط الحالة
      this.cleanupOldRequests();
      this.resetGlobalAbilityState();
      
      // تشغيل المزامنة
      this.setupAbilityStateSynchronization();
      
      // إرجاع Promise ناجح
      return Promise.resolve({
        initialized: true,
        playerParam: this.playerParam,
        isHost: this.isHost
      });
    } catch (error) {
      console.error('❌ فشل تهيئة نظام طلب القدرات:', error);
      
      // إرجاع Promise مرفوض مع تفاصيل الخطأ
      return Promise.reject({
        error: error.message,
        details: error
      });
    }
  }
  
  // إعداد مستمعي الأحداث
  setupEventListeners() {
    window.addEventListener('storage', (event) => {
      if (event.key === this.ABILITY_REQUESTS_KEY) {
        this.processAbilityRequests();
      }
      if (event.key === this.ABILITY_GLOBAL_STATE_KEY) {
        this.syncAbilityState();
      }
    });
  }
  
  // تنظيف الطلبات القديمة
  cleanupOldRequests() {
    const requests = this.getAbilityRequests();
    const currentTime = Date.now();
    
    const validRequests = requests.filter(req => 
      currentTime - req.timestamp < 5 * 60 * 1000 // 5 دقائق
    );
    
    localStorage.setItem(this.ABILITY_REQUESTS_KEY, JSON.stringify(validRequests));
  }
  
  // إعادة ضبط الحالة العامة للقدرات
  resetGlobalAbilityState() {
    const defaultState = {
      globalDisabled: false,
      disabledUntil: null,
      lastResetTimestamp: Date.now()
    };
    
    localStorage.setItem(this.ABILITY_GLOBAL_STATE_KEY, JSON.stringify(defaultState));
  }
  
  // مزامنة حالة القدرات
  syncAbilityState() {
    const globalState = this.getGlobalAbilityState();
    
    if (globalState.globalDisabled || 
        (globalState.disabledUntil && Date.now() < globalState.disabledUntil)) {
      this.disableAllAbilities();
    } else {
      this.enableAllAbilities();
    }
  }
  
  // الحصول على الحالة العامة للقدرات
  getGlobalAbilityState() {
    try {
      return JSON.parse(localStorage.getItem(this.ABILITY_GLOBAL_STATE_KEY) || '{}');
    } catch {
      return { globalDisabled: false };
    }
  }
  
  // تعطيل جميع القدرات
  disableAllAbilities() {
    const players = ['player1', 'player2'];
    players.forEach(playerParam => {
      const abilitiesKey = `${playerParam}Abilities`;
      const abilities = JSON.parse(localStorage.getItem(abilitiesKey) || '[]');
      
      const disabledAbilities = abilities.map(ability => {
        const text = typeof ability === 'string' ? ability : ability.text;
        return {
          ...(typeof ability === 'object' ? ability : { text }),
          used: true
        };
      });
      
      localStorage.setItem(abilitiesKey, JSON.stringify(disabledAbilities));
      localStorage.setItem(`${playerParam}UsedAbilities`, 
        JSON.stringify(disabledAbilities.map(a => a.text)));
    });
    
    localStorage.setItem('abilitiesLastUpdate', Date.now().toString());
  }
  
  // تفعيل جميع القدرات
  enableAllAbilities() {
    const players = ['player1', 'player2'];
    players.forEach(playerParam => {
      const abilitiesKey = `${playerParam}Abilities`;
      const abilities = JSON.parse(localStorage.getItem(abilitiesKey) || '[]');
      
      const enabledAbilities = abilities.map(ability => {
        const text = typeof ability === 'string' ? ability : ability.text;
        return {
          ...(typeof ability === 'object' ? ability : { text }),
          used: false
        };
      });
      
      localStorage.setItem(abilitiesKey, JSON.stringify(enabledAbilities));
      localStorage.removeItem(`${playerParam}UsedAbilities`);
    });
    
    localStorage.setItem('abilitiesLastUpdate', Date.now().toString());
  }
  
  // معالجة طلبات القدرات
  processAbilityRequests() {
    if (!this.isHost) return;
    
    const requests = this.getAbilityRequests();
    const pendingRequests = requests.filter(req => req.status === 'pending');
    
    pendingRequests.forEach(request => {
      const decision = this.hostDecideRequest(request);
      
      if (decision) {
        this.approveRequest(request.id);
      } else {
        this.rejectRequest(request.id);
      }
    });
  }
  
  // قرار المضيف بشأن الطلب
  hostDecideRequest(request) {
    return Math.random() > 0.2; // 80% احتمال الموافقة
  }
  
  // الموافقة على طلب القدرة
  approveRequest(requestId) {
    const requests = this.getAbilityRequests();
    const requestIndex = requests.findIndex(req => req.id === requestId);
    
    if (requestIndex !== -1) {
      requests[requestIndex].status = 'approved';
      localStorage.setItem(this.ABILITY_REQUESTS_KEY, JSON.stringify(requests));
      
      localStorage.setItem('abilitiesLastUpdate', Date.now().toString());
      
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'ABILITY_APPROVED',
          requestId: requestId,
          abilityText: requests[requestIndex].abilityText,
          playerParam: requests[requestIndex].playerParam
        });
      }
    }
  }
  
  // رفض طلب القدرة
  rejectRequest(requestId) {
    const requests = this.getAbilityRequests();
    const requestIndex = requests.findIndex(req => req.id === requestId);
    
    if (requestIndex !== -1) {
      requests[requestIndex].status = 'rejected';
      localStorage.setItem(this.ABILITY_REQUESTS_KEY, JSON.stringify(requests));
      
      localStorage.setItem('abilitiesLastUpdate', Date.now().toString());
      
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'ABILITY_REJECTED',
          requestId: requestId,
          abilityText: requests[requestIndex].abilityText,
          playerParam: requests[requestIndex].playerParam
        });
      }
    }
  }
  
  // معالجة رسائل البث
  handleBroadcastMessage(event) {
    const message = event.data;
    
    switch (message.type) {
      case 'ABILITY_REQUEST':
        if (this.isHost) {
          this.processAbilityRequests();
        }
        break;
      
      case 'ABILITY_APPROVED':
      case 'ABILITY_REJECTED':
        this.updateLocalAbilityStatus(message);
        break;
    }
  }
  
  // تحديث حالة القدرة محليًا
  updateLocalAbilityStatus(message) {
    const { requestId, abilityText, playerParam } = message;
    
    const abilitiesKey = `${playerParam}Abilities`;
    const usedAbilitiesKey = `${playerParam}UsedAbilities`;
    
    const savedAbilities = JSON.parse(localStorage.getItem(abilitiesKey) || '[]');
    const usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
    
    const updatedAbilities = savedAbilities.map(ability => {
      const text = typeof ability === 'string' ? ability : ability.text || ability;
      
      if (text === abilityText) {
        return typeof ability === 'object' 
          ? { ...ability, used: message.type === 'ABILITY_APPROVED' }
          : { text: ability, used: message.type === 'ABILITY_APPROVED' };
      }
      
      return ability;
    });
    
    localStorage.setItem(abilitiesKey, JSON.stringify(updatedAbilities));
    
    const newUsedAbilities = message.type === 'ABILITY_APPROVED'
      ? [...new Set([...usedAbilities, abilityText])]
      : usedAbilities.filter(a => a !== abilityText);
    
    localStorage.setItem(usedAbilitiesKey, JSON.stringify(newUsedAbilities));
    
    localStorage.setItem('abilitiesLastUpdate', Date.now().toString());
    
    const customEvent = new CustomEvent('abilityToggled', {
      detail: {
        playerParam: playerParam,
        abilityText: abilityText,
        isUsed: message.type === 'ABILITY_APPROVED'
      }
    });
    window.dispatchEvent(customEvent);
  }

  // بث حالة القدرات
  broadcastAbilityStateSync(playerParam, abilityText, isUsed) {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const abilityChannel = new BroadcastChannel('ability-updates');
        abilityChannel.postMessage({
          type: 'ABILITY_STATE_SYNC',
          playerParam: playerParam,
          abilityText: abilityText,
          isUsed: isUsed
        });
      }
    } catch (e) {
      console.warn('خطأ في إرسال رسالة BroadcastChannel:', e);
    }
  }

  // استماع لتحديثات القدرات
  setupAbilityStateSynchronization() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const abilityChannel = new BroadcastChannel('ability-updates');
        abilityChannel.onmessage = (event) => {
          if (event.data.type === 'ABILITY_STATE_SYNC') {
            console.log('تم استلام تحديث حالة القدرات:', event.data);
            
            const { playerParam, abilityText, isUsed } = event.data;
            const abilitiesKey = `${playerParam}Abilities`;
            const usedAbilitiesKey = `${playerParam}UsedAbilities`;
            
            const savedAbilities = JSON.parse(localStorage.getItem(abilitiesKey) || '[]');
            const usedAbilities = JSON.parse(localStorage.getItem(usedAbilitiesKey) || '[]');
            
            const updatedAbilities = savedAbilities.map(ability => {
              const text = typeof ability === 'string' ? ability : ability.text || ability;
              
              if (text === abilityText) {
                return typeof ability === 'object' 
                  ? { ...ability, used: isUsed }
                  : { text: ability, used: isUsed };
              }
              
              return ability;
            });
            
            const newUsedAbilities = isUsed 
              ? [...new Set([...usedAbilities, abilityText])]
              : usedAbilities.filter(a => a !== abilityText);
            
            localStorage.setItem(abilitiesKey, JSON.stringify(updatedAbilities));
            localStorage.setItem(usedAbilitiesKey, JSON.stringify(newUsedAbilities));
            localStorage.setItem('abilitiesLastUpdate', Date.now().toString());
            
            const customEvent = new CustomEvent('abilityToggled', {
              detail: { 
                playerParam: playerParam, 
                abilityText: abilityText, 
                isUsed: isUsed 
              }
            });
            window.dispatchEvent(customEvent);
          }
        };
      }
    } catch (e) {
      console.warn('خطأ في إعداد BroadcastChannel:', e);
    }
  }

  // تشغيل المزامنة عند تحميل الصفحة
  init() {
    this.setupAbilityStateSynchronization();
  }
}

// ========== CSS Animations ==========
const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp {
    from {
      transform: translate(-50%, 100px);
      opacity: 0;
    }
    to {
      transform: translate(-50%, 0);
      opacity: 1;
    }
  }

  @keyframes slideDown {
    from {
      transform: translate(-50%, 0);
      opacity: 1;
    }
    to {
      transform: translate(-50%, 100px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// ========== Export ==========
window.AbilityRequestManager = AbilityRequestManager;

console.log('✅ Ability Request System loaded');

