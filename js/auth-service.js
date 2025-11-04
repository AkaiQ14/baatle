// js/auth-service.js
import { 
  signInAnonymously, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { auth } from './firebase-init.js';

export class AuthService {
  // تسجيل الدخول كضيف
  static async signInAnonymously() {
    try {
      const result = await signInAnonymously(auth);
      console.log('✅ تم تسجيل الدخول كضيف:', result.user.uid);
      return result.user;
    } catch (error) {
      console.error('❌ خطأ في تسجيل الدخول كضيف:', error);
      throw error;
    }
  }

  // تسجيل الدخول بالإيميل وكلمة المرور
  static async signInWithEmail(email, password) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ تم تسجيل الدخول:', result.user.uid);
      return result.user;
    } catch (error) {
      console.error('❌ خطأ في تسجيل الدخول:', error);
      throw error;
    }
  }

  // إنشاء حساب جديد
  static async createAccount(email, password) {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      console.log('✅ تم إنشاء الحساب:', result.user.uid);
      return result.user;
    } catch (error) {
      console.error('❌ خطأ في إنشاء الحساب:', error);
      throw error;
    }
  }

  // تسجيل الخروج
  static async signOut() {
    try {
      await signOut(auth);
      console.log('✅ تم تسجيل الخروج');
    } catch (error) {
      console.error('❌ خطأ في تسجيل الخروج:', error);
      throw error;
    }
  }

  // مراقبة حالة المصادقة
  static onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, callback);
  }

  // الحصول على المستخدم الحالي
  static getCurrentUser() {
    return auth.currentUser;
  }

  // التحقق من تسجيل الدخول
  static isSignedIn() {
    return auth.currentUser !== null;
  }
}

// تسجيل دخول تلقائي كضيف عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (!AuthService.isSignedIn()) {
      await AuthService.signInAnonymously();
      console.log('🎯 تم تسجيل الدخول التلقائي كضيف');
    }
  } catch (error) {
    console.warn('⚠️ فشل في تسجيل الدخول التلقائي:', error);
  }
});
