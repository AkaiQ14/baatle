// Login credentials
const LOGIN_CREDENTIALS = {
  username: 'AKAI',
  password: 'AKAI2004'
};

// Initialize login page
document.addEventListener('DOMContentLoaded', function() {
  setupLoginForm();
  // Auto-login for demo purposes
  setTimeout(() => {
    // Clear any lingering tournament state before redirecting to challenge
    try {
      localStorage.removeItem('currentMatchId');
      localStorage.removeItem('currentMatchPlayers');
      localStorage.removeItem('tournamentRounds');
      localStorage.removeItem('tournamentData');
      localStorage.removeItem('matchWinner');
    } catch (_) {}
    autoLogin();
  }, 1000);
});

function autoLogin() {
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  
  usernameInput.value = LOGIN_CREDENTIALS.username;
  passwordInput.value = LOGIN_CREDENTIALS.password;
  
  // Trigger login
  const loginForm = document.getElementById('loginForm');
  loginForm.dispatchEvent(new Event('submit'));
}

function setupLoginForm() {
  const loginForm = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const errorMessage = document.getElementById('errorMessage');
  const successMessage = document.getElementById('successMessage');
  const loading = document.getElementById('loading');

  // Handle form submission
  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    // Hide previous messages
    hideMessages();
    
    // Show loading
    showLoading();
    
    // Simulate login delay
    setTimeout(() => {
      if (username === LOGIN_CREDENTIALS.username && password === LOGIN_CREDENTIALS.password) {
        // Login successful
        showSuccess();
        
        // Redirect to game-mode.html after 2 seconds
        setTimeout(() => {
          window.location.href = 'names-setup.html';
        }, 2000);
      } else {
        // Login failed
        hideLoading();
        showError();
      }
    }, 1500);
  });

  // Handle Enter key in password field
  passwordInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      loginForm.dispatchEvent(new Event('submit'));
    }
  });

  // Clear error message when user starts typing
  usernameInput.addEventListener('input', hideError);
  passwordInput.addEventListener('input', hideError);
}

function showLoading() {
  const loginBtn = document.getElementById('loginBtn');
  
  loginBtn.disabled = true;
  loginBtn.textContent = '⏳ جاري التحقق...';
}

function hideLoading() {
  const loginBtn = document.getElementById('loginBtn');
  
  loginBtn.disabled = false;
  loginBtn.textContent = 'دخول';
}

function showError() {
  const loginBtn = document.getElementById('loginBtn');
  
  hideLoading();
  loginBtn.textContent = '❌ خطأ في البيانات';
  loginBtn.style.background = 'linear-gradient(135deg, #dc2626, #ef4444)';
  
  // Add shake animation
  const loginContainer = document.querySelector('.login-container');
  loginContainer.style.animation = 'shake 0.5s ease-in-out';
  setTimeout(() => {
    loginContainer.style.animation = '';
  }, 500);
  
  // Reset button after 3 seconds
  setTimeout(() => {
    loginBtn.textContent = 'دخول';
    loginBtn.style.background = 'linear-gradient(135deg, var(--btn), var(--accent-light))';
  }, 3000);
}

function hideError() {
  // No separate error message to hide
}

function showSuccess() {
  const loginBtn = document.getElementById('loginBtn');
  
  hideLoading();
  loginBtn.textContent = '✅ تم تسجيل الدخول!';
  loginBtn.style.background = 'linear-gradient(135deg, #16a34a, #22c55e)';
}

function hideMessages() {
  // No separate messages to hide
}

// Add shake animation keyframes
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
`;
document.head.appendChild(style);
