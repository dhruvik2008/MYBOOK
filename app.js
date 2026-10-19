// ==========================================================================
// My Book - Digital Ledger Web Application Logic
// 100% English & Zero Dummy Data
// ==========================================================================

const STORAGE_KEY = 'khatabook_parties_db_v2';
const BUSINESS_NAME_KEY = 'khatabook_business_name_v2';
const THEME_KEY = 'khatabook_theme_v2';
const LANG_KEY = 'khatabook_lang_v3';
const QR_IMAGE_KEY = 'khatabook_qr_image_v2';
const BIZ_PHONE_KEY = 'khatabook_biz_phone_v2';
const BIZ_ADDR_KEY = 'khatabook_biz_addr_v2';
const BUSINESSES_LIST_KEY = 'khatabook_businesses_list_v2';
const ACTIVE_BIZ_ID_KEY = 'khatabook_active_biz_id_v2';

// ==========================================================================
// GOOGLE FIREBASE REALTIME DATABASE CONFIGURATION
// ==========================================================================
const DEFAULT_FIREBASE_URL = 'https://mybook-3bff2-default-rtdb.firebaseio.com';
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCCxh01OP9U8gnzGGGNmY-H4RkqtxCGuOs",
  authDomain: "mybook-3bff2.firebaseapp.com",
  databaseURL: "https://mybook-3bff2-default-rtdb.firebaseio.com",
  projectId: "mybook-3bff2",
  storageBucket: "mybook-3bff2.firebasestorage.app",
  messagingSenderId: "179076979575",
  appId: "1:179076979575:web:8df42023e9e5ba6b341f72",
  measurementId: "G-GQLCM2E907"
};
const FIREBASE_CUSTOM_URL_KEY = 'khatabook_firebase_custom_url_v2';

function getFirebaseUrl() {
  const custom = (localStorage.getItem(FIREBASE_CUSTOM_URL_KEY) || '').trim().replace(/\/$/, '');
  return custom || DEFAULT_FIREBASE_URL;
}

// Application State (Completely empty initially - NO DUMMY DATA)
let businessAccounts = [];
let activeBusinessId = 'biz_default';
let customers = [];
let currentFilter = 'all';
let currentGlobalSearch = '';
let currentScreenSearch = '';
let currentSort = 'recent';
let selectedCustomerId = null;
let currentLang = localStorage.getItem(LANG_KEY) || 'en';
let currentAttachedBillPhoto = null;
let waSelectedCustomer = null;

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  // Request Persistent Storage from Browser/iOS to prevent auto eviction
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => { });
  }

  // Handle User 2 Auto Connect Link (from Partner WhatsApp Invite)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const connectPhone = urlParams.get('connect_phone');
    const connectVault = urlParams.get('connect_vault');
    if (connectPhone) {
      localStorage.setItem(CLOUD_PHONE_KEY, connectPhone);
      if (connectVault) localStorage.setItem(CLOUD_VAULT_ID_KEY, connectVault);
      setTimeout(() => {
        if (confirm(`Connect live ledger from User 1 (${connectPhone}) on this phone?`)) {
          performCloudRestore(null);
        }
      }, 700);
    }
  } catch (e) { }

  loadData();
  initTheme();
  initLanguage();
  setupLiveDate();
  setupEventListeners();
  initPinLock();
  initBackupAndSync();
  initAdvancedFeatures();
  renderDashboard();
});

const USERS_REGISTRY_KEY = 'mybook_users_registry_v2';
const ACTIVE_USER_PHONE_KEY = 'mybook_active_user_phone_v2';
const SESSION_LOCK_KEY = 'mybook_session_unlocked_v2';
const GLOBAL_REGISTRY_TOKEN = 'na2ulgix';
let currentActivePhone = localStorage.getItem(ACTIVE_USER_PHONE_KEY) || '';

// User registry and partitioned storage helpers
function getUsersRegistry() {
  try {
    const reg = localStorage.getItem(USERS_REGISTRY_KEY);
    if (reg) {
      const parsed = JSON.parse(reg);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) { }
  return [];
}

function saveUsersRegistry(list) {
  localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(list));
}

function getActiveUserPhone() {
  return currentActivePhone || localStorage.getItem(ACTIVE_USER_PHONE_KEY) || '';
}

function getUserPrefix() {
  const phone = getActiveUserPhone();
  return phone ? `u_${phone}_` : '';
}

// Helper: Get storage key for specific business
function getStorageKeyForBusiness(bizId) {
  const prefix = getUserPrefix();
  if (!bizId || bizId === 'biz_default') return `khatabook_${prefix}parties_db_v2`;
  return `khatabook_${prefix}parties_${bizId}`;
}

function getBusinessesListKey() {
  const prefix = getUserPrefix();
  return prefix ? `khatabook_${prefix}businesses_list_v2` : BUSINESSES_LIST_KEY;
}

function getActiveBizIdKey() {
  const prefix = getUserPrefix();
  return prefix ? `khatabook_${prefix}active_biz_id_v2` : ACTIVE_BIZ_ID_KEY;
}

// Helper: Get currently active business account
function getActiveBusiness() {
  return businessAccounts.find(b => b.id === activeBusinessId) || businessAccounts[0] || {
    id: 'biz_default',
    name: 'Office',
    type: 'Office'
  };
}

// Helper: Persist business accounts list & active state
function saveBusinessesList() {
  const listKey = getBusinessesListKey();
  const activeKey = getActiveBizIdKey();
  localStorage.setItem(listKey, JSON.stringify(businessAccounts));
  localStorage.setItem(activeKey, activeBusinessId);
  const activeBiz = getActiveBusiness();
  if (activeBiz) {
    const prefix = getUserPrefix();
    localStorage.setItem(`khatabook_${prefix}biz_name`, activeBiz.name);
    if (activeBiz.phone) localStorage.setItem(`khatabook_${prefix}biz_phone`, activeBiz.phone);
    else localStorage.removeItem(`khatabook_${prefix}biz_phone`);

    if (activeBiz.address) localStorage.setItem(`khatabook_${prefix}biz_addr`, activeBiz.address);
    else localStorage.removeItem(`khatabook_${prefix}biz_addr`);

    if (activeBiz.qrImage) localStorage.setItem(`khatabook_${prefix}qr_img`, activeBiz.qrImage);
    else localStorage.removeItem(`khatabook_${prefix}qr_img`);
  }
}

// Update Active Business UI (Navbar, Header, Sidebar icon)
function updateActiveBusinessUI() {
  const activeBiz = getActiveBusiness();
  const nameDisplay = document.getElementById('businessNameDisplay');
  const repTitle = document.getElementById('reportBusinessTitle');
  const avatarIcon = document.getElementById('businessAvatarIcon');

  if (nameDisplay) nameDisplay.textContent = activeBiz.name;
  if (repTitle) repTitle.textContent = `${activeBiz.name} - Ledger Statement`;

  if (avatarIcon) {
    const isHome = activeBiz.type === 'Home' || activeBiz.name.toLowerCase().includes('home');
    avatarIcon.innerHTML = isHome ? '<i class="ri-home-4-line"></i>' : '<i class="ri-store-2-line"></i>';
    avatarIcon.className = `business-avatar ${isHome ? 'biz-avatar-home' : 'biz-avatar-office'}`;
  }
}

// Load persistent data
function loadData() {
  const phone = getActiveUserPhone();
  const listKey = getBusinessesListKey();
  let storedList = localStorage.getItem(listKey);

  // Migration for first registered user if previous legacy data exists
  if (!storedList) {
    const registry = getUsersRegistry();
    if (registry.length <= 1) {
      const legacyList = localStorage.getItem(BUSINESSES_LIST_KEY);
      if (legacyList) {
        storedList = legacyList;
        localStorage.setItem(listKey, legacyList);
      }
    }
  }

  if (storedList) {
    try {
      businessAccounts = JSON.parse(storedList);
      if (!Array.isArray(businessAccounts) || businessAccounts.length === 0) {
        throw new Error('empty');
      }
    } catch (e) {
      businessAccounts = [];
    }
  }

  if (businessAccounts.length === 0) {
    const prefix = getUserPrefix();
    const currentBizName = localStorage.getItem(`khatabook_${prefix}biz_name`) || (phone ? `Office` : 'Office');
    const currentPhone = localStorage.getItem(`khatabook_${prefix}biz_phone`) || phone || '';
    const currentAddr = localStorage.getItem(`khatabook_${prefix}biz_addr`) || '';
    const currentQr = localStorage.getItem(`khatabook_${prefix}qr_img`) || '';
    businessAccounts = [{
      id: 'biz_default',
      name: currentBizName,
      type: 'Office',
      phone: currentPhone,
      address: currentAddr,
      qrImage: currentQr,
      createdAt: new Date().toISOString()
    }];
    activeBusinessId = 'biz_default';
    saveBusinessesList();
  } else {
    activeBusinessId = localStorage.getItem(getActiveBizIdKey()) || businessAccounts[0].id;
    if (!businessAccounts.some(b => b.id === activeBusinessId)) {
      activeBusinessId = businessAccounts[0].id;
    }
  }

  // 2. Load customers for active business
  const currentKey = getStorageKeyForBusiness(activeBusinessId);
  let storedCustomers = localStorage.getItem(currentKey);

  // Migration for first registered user if previous legacy customers exist
  if (!storedCustomers && activeBusinessId === 'biz_default') {
    const registry = getUsersRegistry();
    if (registry.length <= 1) {
      const legacyCust = localStorage.getItem(STORAGE_KEY);
      if (legacyCust) {
        storedCustomers = legacyCust;
        localStorage.setItem(currentKey, legacyCust);
      }
    }
  }

  if (storedCustomers) {
    try {
      customers = JSON.parse(storedCustomers);
      if (!Array.isArray(customers)) customers = [];
    } catch (e) {
      customers = [];
    }
  } else {
    customers = [];
    localStorage.setItem(currentKey, JSON.stringify(customers));
  }

  customers = customers.map(c => {
    if (!c) return { id: 'cust_' + Date.now(), name: 'Customer', phone: '', transactions: [] };
    return {
      ...c,
      transactions: Array.isArray(c.transactions) ? c.transactions : []
    };
  });

  updateActiveBusinessUI();
  updateActiveUserUI();
}

function saveData() {
  const currentKey = getStorageKeyForBusiness(activeBusinessId);
  localStorage.setItem(currentKey, JSON.stringify(customers));
  if (typeof triggerAutoCloudSync === 'function') {
    triggerAutoCloudSync();
  }
}

// Format any date/string into DD-MM-YYYY
function formatDateDMY(dateInput) {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') {
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateInput)) return dateInput;
    if (/^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
      const parts = dateInput.split('T')[0].split('-');
      return `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// Current Date & Formatters
function setupLiveDate() {
  const now = new Date();
  const dateFormatted = `${formatDateDMY(now)}`;
  document.getElementById('headerDateDisplay').textContent = dateFormatted;
  document.getElementById('txnDateInput').value = now.toISOString().split('T')[0];
  document.getElementById('reportDateTime').textContent = `Generated on: ${formatDateDMY(now)} at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatCurrency(amount) {
  const val = Math.abs(Number(amount) || 0);
  return '₹ ' + val.toLocaleString('en-IN');
}

function getInitials(name) {
  if (!name) return 'C';
  const clean = name.trim();
  // If starts with number
  if (/^[0-9]/.test(clean)) {
    return clean.charAt(0);
  }
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.substring(0, 2).toUpperCase();
}

// Calculate Customer Balance
// You gave = You'll get (debit / + balance)
// You got = You'll give (credit / - balance)
function calculateCustomerBalance(customer) {
  if (!customer || !Array.isArray(customer.transactions) || customer.transactions.length === 0) {
    return { balance: 0, status: 'settled', amount: 0 };
  }

  let totalGave = 0;
  let totalGot = 0;

  customer.transactions.forEach(t => {
    if (!t) return;
    const val = Number(t.amount) || 0;
    if (t.type === 'give') {
      totalGave += val;
    } else if (t.type === 'receive') {
      totalGot += val;
    }
  });

  const net = totalGave - totalGot;

  if (net > 0) {
    return { balance: net, status: 'receive', amount: net };
  } else if (net < 0) {
    return { balance: net, status: 'pay', amount: Math.abs(net) };
  } else {
    return { balance: 0, status: 'settled', amount: 0 };
  }
}

// Mobile Sidebar Drawer Management
window.closeMobileSidebar = function () {
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) sidebar.classList.remove('open');
  if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
  document.body.classList.remove('sidebar-drawer-open');
};

window.openMobileSidebar = function () {
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) sidebar.classList.add('open');
  if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
  document.body.classList.add('sidebar-drawer-open');
};

window.toggleMobileSidebar = function () {
  const sidebar = document.getElementById('sidebar');
  if (sidebar && sidebar.classList.contains('open')) {
    window.closeMobileSidebar();
  } else {
    window.openMobileSidebar();
  }
};

// Setup Event Listeners
function setupEventListeners() {
  // Mobile Sidebar Drawer
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      window.toggleMobileSidebar();
    });
  }

  if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.closeMobileSidebar();
    });
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', (e) => {
      e.stopPropagation();
      window.closeMobileSidebar();
    });
  }

  // Close sidebar on ESC key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closeMobileSidebar();
    }
  });

  // Swipe Left on Mobile to close sidebar drawer
  if (sidebar) {
    let touchStartX = 0;
    let touchStartY = 0;
    sidebar.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    sidebar.addEventListener('touchend', (e) => {
      if (e.changedTouches && e.changedTouches[0]) {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;
        // If swiped left by 40px or more
        if (diffX < -40 && Math.abs(diffX) > Math.abs(diffY)) {
          window.closeMobileSidebar();
        }
      }
    }, { passive: true });
  }

  // Close sidebar on mobile whenever any navigation item is tapped
  const sidebarNavItems = document.querySelectorAll('.sidebar .nav-item');
  sidebarNavItems.forEach((item) => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 1024) {
        window.closeMobileSidebar();
      }
    });
  });

  // Switch / Manage Business Accounts (Modal)
  const switchBusinessBtn = document.getElementById('switchBusinessBtn');
  const sidebarBusinessCard = document.getElementById('sidebarBusinessCard');
  const editBusinessBtn = document.getElementById('editBusinessBtn');

  if (switchBusinessBtn) {
    switchBusinessBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.closeMobileSidebar();
      openSwitchBusinessModal();
    });
  }
  if (sidebarBusinessCard) {
    sidebarBusinessCard.addEventListener('click', () => {
      window.closeMobileSidebar();
      openSwitchBusinessModal();
    });
  }
  if (editBusinessBtn) {
    editBusinessBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.closeMobileSidebar();
      openSwitchBusinessModal();
    });
  }

  // Top Global Search
  const globalSearchInput = document.getElementById('globalSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  globalSearchInput.addEventListener('input', (e) => {
    currentGlobalSearch = e.target.value.toLowerCase().trim();
    clearSearchBtn.style.display = currentGlobalSearch ? 'block' : 'none';
    renderDashboard();
  });

  clearSearchBtn.addEventListener('click', () => {
    globalSearchInput.value = '';
    currentGlobalSearch = '';
    clearSearchBtn.style.display = 'none';
    renderDashboard();
    globalSearchInput.focus();
  });

  // Sort Selection
  document.getElementById('sortSelect').addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderDashboard();
  });

  // Filter Chips
  const filterChips = document.querySelectorAll('.filter-chip');
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.getAttribute('data-filter');
      renderDashboard();
    });
  });

  // Theme Toggle Button
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // Language Selector
  const langSelect = document.getElementById('langSelect');
  if (langSelect) {
    langSelect.value = currentLang;
    langSelect.addEventListener('change', (e) => {
      setLanguage(e.target.value);
    });
  }

  // View Management: Dashboard vs Customers List vs Analytics
  let currentActiveView = 'dashboard';

  function switchView(viewName) {
    if (typeof window.closeMobileSidebar === 'function') {
      window.closeMobileSidebar();
    }
    currentActiveView = viewName;
    const dashboardView = document.getElementById('dashboardView');
    const customersPageView = document.getElementById('customersPageView');
    const analyticsPageView = document.getElementById('analyticsPageView');
    const dashboardTopHeader = document.getElementById('dashboardTopHeader');
    const navDashboardBtn = document.getElementById('navDashboardBtn');
    const navCustomersBtn = document.getElementById('navCustomersBtn');
    const navAnalyticsBtn = document.getElementById('navAnalyticsBtn');

    if (viewName === 'customers') {
      if (dashboardTopHeader) dashboardTopHeader.style.display = 'none';
      if (dashboardView) dashboardView.style.display = 'none';
      if (analyticsPageView) analyticsPageView.style.display = 'none';
      if (customersPageView) customersPageView.style.display = 'flex';
      navDashboardBtn.classList.remove('active');
      if (navAnalyticsBtn) navAnalyticsBtn.classList.remove('active');
      navCustomersBtn.classList.add('active');
      renderCustomersPageView();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (viewName === 'analytics') {
      if (dashboardTopHeader) dashboardTopHeader.style.display = 'none';
      if (dashboardView) dashboardView.style.display = 'none';
      if (customersPageView) customersPageView.style.display = 'none';
      if (analyticsPageView) analyticsPageView.style.display = 'flex';
      navDashboardBtn.classList.remove('active');
      navCustomersBtn.classList.remove('active');
      if (navAnalyticsBtn) navAnalyticsBtn.classList.add('active');
      renderAnalyticsPage();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      if (dashboardTopHeader) dashboardTopHeader.style.display = 'flex';
      if (dashboardView) dashboardView.style.display = 'flex';
      if (customersPageView) customersPageView.style.display = 'none';
      if (analyticsPageView) analyticsPageView.style.display = 'none';
      navDashboardBtn.classList.add('active');
      navCustomersBtn.classList.remove('active');
      if (navAnalyticsBtn) navAnalyticsBtn.classList.remove('active');
      renderDashboard();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Handle Browser / Mobile Hardware Back Button (Swipe or Back Tap)
  window.addEventListener('popstate', (e) => {
    const detailModal = document.getElementById('customerDetailModal');
    if (detailModal && detailModal.classList.contains('active')) {
      detailModal.classList.remove('active');
      const win = detailModal.querySelector('.mobile-window');
      if (win) win.classList.remove('is-fullscreen');
      return;
    }

    // Close any other open modals if back was pressed
    const activeModals = document.querySelectorAll('.screen-overlay.active:not(#pinLockScreen)');
    if (activeModals.length > 0) {
      activeModals.forEach(m => m.classList.remove('active'));
      return;
    }

    if (window.location.hash === '#customers') {
      switchView('customers');
    } else if (window.location.hash === '#analytics') {
      switchView('analytics');
    } else {
      switchView('dashboard');
    }
  });

  // Handle URL hash if any
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#customers') {
      switchView('customers');
    } else if (window.location.hash === '#analytics') {
      switchView('analytics');
    } else if (window.location.hash === '#dashboard' || !window.location.hash) {
      switchView('dashboard');
    }
  });

  if (window.location.hash === '#customers') {
    switchView('customers');
  } else if (window.location.hash === '#analytics') {
    switchView('analytics');
  }

  // Navigation Links
  document.getElementById('navDashboardBtn').addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = 'dashboard';
    switchView('dashboard');
  });

  document.getElementById('navCustomersBtn').addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = 'customers';
    switchView('customers');
  });

  const navAnalyticsBtn = document.getElementById('navAnalyticsBtn');
  if (navAnalyticsBtn) {
    navAnalyticsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = 'analytics';
      switchView('analytics');
    });
  }

  // Detail Modal Actions (UPI QR & WhatsApp Reminder)
  const detailUpiQrBtn = document.getElementById('detailUpiQrBtn');
  if (detailUpiQrBtn) {
    detailUpiQrBtn.addEventListener('click', () => {
      if (selectedCustomerId) openUpiQrModal(selectedCustomerId);
    });
  }

  const detailReminderActionBtn = document.getElementById('detailReminderActionBtn');
  if (detailReminderActionBtn) {
    detailReminderActionBtn.addEventListener('click', () => {
      if (selectedCustomerId) openWhatsappModal(selectedCustomerId);
    });
  }

  const quickWhatsAppBtn = document.getElementById('quickWhatsAppBtn');
  if (quickWhatsAppBtn) {
    quickWhatsAppBtn.addEventListener('click', () => {
      if (selectedCustomerId) openWhatsappModal(selectedCustomerId);
    });
  }

  // Customers Page (Image 2) Search and Add Button
  const pageSearchInput = document.getElementById('customersPageSearchInput');
  const clearPageSearchBtn = document.getElementById('clearPageSearchBtn');
  const pageAddCustomerBtn = document.getElementById('pageAddCustomerBtn');
  const pageEmptyAddBtn = document.getElementById('pageEmptyAddBtn');

  if (pageSearchInput) {
    pageSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      clearPageSearchBtn.style.display = q ? 'block' : 'none';
      renderCustomersPageView();
    });
  }

  if (clearPageSearchBtn) {
    clearPageSearchBtn.addEventListener('click', () => {
      pageSearchInput.value = '';
      clearPageSearchBtn.style.display = 'none';
      renderCustomersPageView();
      pageSearchInput.focus();
    });
  }

  if (pageAddCustomerBtn) {
    pageAddCustomerBtn.addEventListener('click', () => {
      openAddPartyScreen();
    });
  }

  if (pageEmptyAddBtn) {
    pageEmptyAddBtn.addEventListener('click', () => {
      openAddPartyScreen();
    });
  }

  // =========================================================================
  // SCREEN 1: Customer Search / Select Screen (Screenshot 1)
  // =========================================================================
  const openSearchBtn = document.getElementById('openAddCustomerFlowBtn');
  const emptyStateAddBtn = document.getElementById('emptyStateAddBtn');
  const searchScreen = document.getElementById('customerSearchScreen');
  const closeSearchScreenBtn = document.getElementById('closeSearchScreenBtn');
  const screenSearchInput = document.getElementById('screenSearchInput');
  const screenSearchClear = document.getElementById('screenSearchClear');

  function openCustomerSearchScreen() {
    screenSearchInput.value = '';
    currentScreenSearch = '';
    screenSearchClear.style.display = 'none';
    renderScreenCustomerList();
    searchScreen.classList.add('active');
    setTimeout(() => screenSearchInput.focus(), 150);
  }

  function closeCustomerSearchScreen() {
    searchScreen.classList.remove('active');
  }

  openSearchBtn.addEventListener('click', openAddPartyScreen);
  emptyStateAddBtn.addEventListener('click', openAddPartyScreen);
  closeSearchScreenBtn.addEventListener('click', closeCustomerSearchScreen);

  screenSearchInput.addEventListener('input', (e) => {
    currentScreenSearch = e.target.value.toLowerCase().trim();
    screenSearchClear.style.display = currentScreenSearch ? 'flex' : 'none';
    renderScreenCustomerList();
  });

  screenSearchClear.addEventListener('click', () => {
    screenSearchInput.value = '';
    currentScreenSearch = '';
    screenSearchClear.style.display = 'none';
    renderScreenCustomerList();
    screenSearchInput.focus();
  });

  // Alphabet Scrubber click
  const scrubber = document.getElementById('alphabetScrubber');
  scrubber.addEventListener('click', (e) => {
    if (e.target.tagName === 'SPAN') {
      const letter = e.target.textContent.trim().toUpperCase();
      screenSearchInput.value = letter;
      currentScreenSearch = letter.toLowerCase();
      screenSearchClear.style.display = 'flex';
      renderScreenCustomerList();
    }
  });

  // =========================================================================
  // SCREEN 2: Add Party Form (Screenshot 2)
  // =========================================================================
  const addPartyScreen = document.getElementById('addPartyScreen');
  const triggerAddPartyBtn = document.getElementById('triggerAddPartyFormBtn');
  const backToAddSearchBtn = document.getElementById('backToAddSearchBtn');
  const addPartyForm = document.getElementById('addPartyForm');
  const toggleGstAddressBtn = document.getElementById('toggleGstAddressBtn');
  const gstAddressSection = document.getElementById('gstAddressSection');
  const accordionToggleIcon = document.getElementById('accordionToggleIcon');

  function openAddPartyScreen() {
    addPartyForm.reset();
    document.querySelector('input[name="partyType"][value="Customer"]').checked = true;
    gstAddressSection.style.display = 'none';
    accordionToggleIcon.textContent = '+';
    addPartyScreen.classList.add('active');
    setTimeout(() => document.getElementById('partyNameInput').focus(), 150);
  }

  function closeAddPartyScreen() {
    addPartyScreen.classList.remove('active');
  }

  triggerAddPartyBtn.addEventListener('click', () => {
    // If user already typed something in search, prefill customer name
    const prefill = screenSearchInput.value.trim();
    openAddPartyScreen();
    if (prefill) {
      document.getElementById('partyNameInput').value = prefill;
    }
  });

  backToAddSearchBtn.addEventListener('click', closeAddPartyScreen);

  // Toggle GSTIN & Address Accordion
  toggleGstAddressBtn.addEventListener('click', () => {
    const isHidden = gstAddressSection.style.display === 'none';
    gstAddressSection.style.display = isHidden ? 'flex' : 'none';
    accordionToggleIcon.textContent = isHidden ? '−' : '+';
  });

  // Submit Add Customer Form
  addPartyForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('partyNameInput').value.trim();
    const phone = document.getElementById('partyPhoneInput').value.trim();
    const partyType = document.querySelector('input[name="partyType"]:checked').value;

    // Optional fields
    const gstin = document.getElementById('partyGstinInput').value.trim();
    const building = document.getElementById('partyBuildingInput').value.trim();
    const area = document.getElementById('partyAreaInput').value.trim();
    const pincode = document.getElementById('partyPincodeInput').value.trim();

    if (!name) {
      showToast('Please enter customer name', 'danger');
      return;
    }

    if (phone.length !== 10) {
      showToast('Please enter a valid 10-digit mobile number', 'danger');
      return;
    }

    const newCustomerId = 'cust_' + Date.now();
    const addressParts = [building, area, pincode].filter(Boolean);
    const fullAddress = addressParts.join(', ');

    const newCustomer = {
      id: newCustomerId,
      name: name,
      phone: phone,
      partyType: partyType,
      gstin: gstin,
      address: fullAddress,
      createdAt: new Date().toISOString(),
      transactions: []
    };

    customers.unshift(newCustomer);
    saveData();
    renderDashboard();

    closeAddPartyScreen();
    closeCustomerSearchScreen();
    showToast(`Added ${partyType} "${name}" successfully!`, 'success');

    // Open detail modal for the new customer immediately
    openCustomerDetail(newCustomerId);
  });

  // =========================================================================
  // CUSTOMER DETAIL & TRANSACTION ACTIONS
  // =========================================================================
  const detailModal = document.getElementById('customerDetailModal');
  const closeDetailBtn = document.getElementById('closeDetailModalBtn');
  if (closeDetailBtn) {
    closeDetailBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeCustomerDetailModal();
    });
  }

  // Backdrop click to close customer detail modal
  if (detailModal) {
    detailModal.addEventListener('click', (e) => {
      if (e.target === detailModal) {
        closeCustomerDetailModal();
      }
    });
  }

  // Back to Dashboard buttons in full-page views
  const btnBackCust = document.getElementById('btnBackToDashboardFromCust');
  if (btnBackCust) {
    btnBackCust.addEventListener('click', (e) => {
      e.preventDefault();
      goBackToDashboard();
    });
  }

  const btnBackAnalytics = document.getElementById('btnBackToDashboardFromAnalytics');
  if (btnBackAnalytics) {
    btnBackAnalytics.addEventListener('click', (e) => {
      e.preventDefault();
      goBackToDashboard();
    });
  }

  // Escape key to close customer detail modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (detailModal && detailModal.classList.contains('active')) {
        closeCustomerDetailModal();
      }
    }
  });

  // Delete Customer
  document.getElementById('deleteCustomerBtn').addEventListener('click', () => {
    if (!selectedCustomerId) return;
    const cust = customers.find(c => c.id === selectedCustomerId);
    if (!cust) return;

    if (confirm(`Are you sure you want to delete ${cust.name} and all associated ledger entries?`)) {
      customers = customers.filter(c => c.id !== selectedCustomerId);
      saveData();
      renderDashboard();
      detailModal.classList.remove('active');
      showToast('Customer deleted', 'info');
    }
  });

  // WhatsApp Reminder
  document.getElementById('quickWhatsAppBtn').addEventListener('click', () => {
    if (!selectedCustomerId) return;
    const cust = customers.find(c => c.id === selectedCustomerId);
    if (!cust) return;

    const balInfo = calculateCustomerBalance(cust);
    const businessName = localStorage.getItem(BUSINESS_NAME_KEY) || 'My Business';

    let message = '';
    if (balInfo.status === 'receive') {
      message = `Dear ${cust.name},\n\nThis is a friendly reminder that an outstanding payment of *₹${balInfo.amount.toLocaleString('en-IN')}* is pending at *${businessName}*.\nKindly settle the dues at your earliest convenience.\n\nThank you!`;
    } else if (balInfo.status === 'pay') {
      message = `Dear ${cust.name},\n\nYou have an advance/credit balance of *₹${balInfo.amount.toLocaleString('en-IN')}* at *${businessName}*.\n\nThank you!`;
    } else {
      message = `Dear ${cust.name},\n\nYour account balance with *${businessName}* is fully settled (₹0).\nThank you for your business!`;
    }

    const cleanPhone = cust.phone.replace(/\D/g, '');
    window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  });

  // You Gave / You Got Buttons
  document.getElementById('btnCustomerGave').addEventListener('click', () => {
    openTransactionModal('give');
  });

  document.getElementById('btnCustomerGot').addEventListener('click', () => {
    openTransactionModal('receive');
  });

  // Transaction Modal Controls
  const txnModal = document.getElementById('transactionModal');
  const closeTxnModalBtn = document.getElementById('closeTxnModalBtn');
  closeTxnModalBtn.addEventListener('click', () => txnModal.classList.remove('active'));

  document.getElementById('recordTxnForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!selectedCustomerId) return;

    const amount = Number(document.getElementById('txnAmountInput').value);
    const note = document.getElementById('txnNoteInput').value.trim() || 'Payment';
    const date = document.getElementById('txnDateInput').value;
    const dueDate = document.getElementById('txnDueDateInput').value;
    const dir = document.getElementById('txnDirectionInput').value;

    if (!amount || amount <= 0) {
      showToast('Please enter a valid amount', 'danger');
      return;
    }

    const cust = customers.find(c => c.id === selectedCustomerId);
    if (!cust) return;

    if (!Array.isArray(cust.transactions)) cust.transactions = [];

    if (dueDate) {
      cust.dueDate = dueDate;
    }

    cust.transactions.unshift({
      id: 'txn_' + Date.now(),
      type: dir,
      amount: amount,
      note: note,
      date: date || new Date().toISOString().split('T')[0],
      dueDate: dueDate || null,
      billPhoto: currentAttachedBillPhoto || null
    });

    currentAttachedBillPhoto = null;
    const previewWrap = document.getElementById('billPreviewWrap');
    if (previewWrap) previewWrap.style.display = 'none';
    const previewImg = document.getElementById('billPreviewImg');
    if (previewImg) previewImg.src = '';

    saveData();
    renderDashboard();
    updateCustomerDetailView(cust);
    txnModal.classList.remove('active');
    showToast(dir === 'give' ? `Recorded ₹${amount} given` : `Recorded ₹${amount} received`, 'success');
  });

  // Report Modal Controls
  const reportModal = document.getElementById('reportModal');
  const openReport = () => {
    if (typeof window.closeMobileSidebar === 'function') {
      window.closeMobileSidebar();
    }
    populateReportPartySelect();
    renderLedgerReport();
    reportModal.classList.add('active');
  };
  const closeReport = () => reportModal.classList.remove('active');

  document.getElementById('downloadReportBtn').addEventListener('click', openReport);
  document.getElementById('navReportBtn').addEventListener('click', (e) => {
    e.preventDefault();
    openReport();
  });
  document.getElementById('closeReportBtn').addEventListener('click', closeReport);
  document.getElementById('closeReportFooterBtn').addEventListener('click', closeReport);

  // Report Customer Filter Change
  const reportPartySelect = document.getElementById('reportPartySelect');
  if (reportPartySelect) {
    reportPartySelect.addEventListener('change', () => {
      renderLedgerReport();
    });
  }

  // Report View Switcher (Ledger Entries vs Party Balances)
  const btnReportViewTxns = document.getElementById('btnReportViewTxns');
  const btnReportViewSummary = document.getElementById('btnReportViewSummary');
  const reportTxnTableWrap = document.getElementById('reportTxnTableWrap');
  const reportSummaryTableWrap = document.getElementById('reportSummaryTableWrap');

  if (btnReportViewTxns && btnReportViewSummary) {
    btnReportViewTxns.addEventListener('click', () => {
      btnReportViewTxns.classList.add('active');
      btnReportViewSummary.classList.remove('active');
      if (reportTxnTableWrap) reportTxnTableWrap.style.display = 'block';
      if (reportSummaryTableWrap) reportSummaryTableWrap.style.display = 'none';
      renderLedgerReport();
    });

    btnReportViewSummary.addEventListener('click', () => {
      btnReportViewSummary.classList.add('active');
      btnReportViewTxns.classList.remove('active');
      if (reportTxnTableWrap) reportTxnTableWrap.style.display = 'none';
      if (reportSummaryTableWrap) reportSummaryTableWrap.style.display = 'block';
      renderLedgerReport();
    });
  }

  // Print Overall Ledger Report Button
  const printLedgerReportBtn = document.getElementById('printLedgerReportBtn');
  if (printLedgerReportBtn) {
    printLedgerReportBtn.addEventListener('click', () => {
      window.printGeneralReport();
    });
  }

  // Fullscreen Toggles for Modals
  const toggleFsDetailBtn = document.getElementById('toggleFsDetailBtn');
  const fsIconDetail = document.getElementById('fsIconDetail');
  const customerDetailWindow = document.querySelector('#customerDetailModal .mobile-window');

  if (toggleFsDetailBtn && customerDetailWindow) {
    toggleFsDetailBtn.addEventListener('click', () => {
      customerDetailWindow.classList.toggle('is-fullscreen');
      const isFs = customerDetailWindow.classList.contains('is-fullscreen');
      fsIconDetail.className = isFs ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line';
    });
  }

  const toggleFsReportBtn = document.getElementById('toggleFsReportBtn');
  const fsIconReport = document.getElementById('fsIconReport');
  const reportWindow = document.querySelector('#reportModal .mobile-window');

  if (toggleFsReportBtn && reportWindow) {
    toggleFsReportBtn.addEventListener('click', () => {
      reportWindow.classList.toggle('is-fullscreen');
      const isFs = reportWindow.classList.contains('is-fullscreen');
      fsIconReport.className = isFs ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line';
    });
  }

  // Print Customer Ledger Statement (Triggered from header icon or prominent action button)
  const triggerCustomerPrint = () => {
    if (!selectedCustomerId) return;
    const cust = customers.find(c => c.id === selectedCustomerId);
    if (!cust) return;

    prepareCustomerPrintableStatement(cust);
    document.body.classList.remove('printing-report');
    document.body.classList.add('printing-customer');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-customer');
    }, 1000);
  };

  const printCustomerLedgerBtn = document.getElementById('printCustomerLedgerBtn');
  if (printCustomerLedgerBtn) {
    printCustomerLedgerBtn.addEventListener('click', triggerCustomerPrint);
  }

  const printCustomerLedgerBtn2 = document.getElementById('printCustomerLedgerBtn2');
  if (printCustomerLedgerBtn2) {
    printCustomerLedgerBtn2.addEventListener('click', triggerCustomerPrint);
  }
}

// ==========================================================================
// PIN LOCK SCREEN LOGIC (PIN: 2704)
function updateActiveUserUI() {
  const phone = getActiveUserPhone();
  const displayStr = phone ? `+91 ${phone}` : 'Not Logged In';
  const sidebarEl = document.getElementById('sidebarUserPhone');
  const headerEl = document.getElementById('headerUserPhoneSpan');
  if (sidebarEl) sidebarEl.textContent = displayStr;
  if (headerEl) headerEl.textContent = phone ? `${phone.slice(-4)}` : 'Switch User';
  if (headerEl && phone) headerEl.title = `Logged in as +91 ${phone} (Tap to Switch User)`;

  // Keep Cloud Vault phone in sync
  const cloudPhone = document.getElementById('cloudPhoneInput');
  if (cloudPhone && phone && !cloudPhone.value) {
    cloudPhone.value = phone;
    localStorage.setItem(CLOUD_PHONE_KEY, phone);
  }
}

let enteredPin = '';

function initPinLock() {
  const pinLockScreen = document.getElementById('pinLockScreen');
  if (!pinLockScreen) return;

  const pinDots = document.querySelectorAll('.pin-dot');
  const pinHiddenInput = document.getElementById('pinHiddenInput');
  const pinErrorMsg = document.getElementById('pinErrorMsg');
  const pinDotsContainer = document.getElementById('pinDotsContainer');
  const keyBtns = document.querySelectorAll('.pin-key-btn[data-key]');
  const pinClearBtn = document.getElementById('pinClearBtn');
  const pinBackspaceBtn = document.getElementById('pinBackspaceBtn');
  const lockAppHeaderBtn = document.getElementById('lockAppHeaderBtn');
  const navLockBtn = document.getElementById('navLockBtn');
  const sidebarSwitchUserBtn = document.getElementById('sidebarSwitchUserBtn');
  const headerSwitchUserBtn = document.getElementById('headerSwitchUserBtn');
  const loginPhoneInput = document.getElementById('loginPhoneInput');
  const savedUsersPills = document.getElementById('savedUsersPills');
  const userStatusTag = document.getElementById('userStatusTag');
  const pinInstructionLabel = document.getElementById('pinInstructionLabel');

  // Check if session is already unlocked
  const isUnlocked = sessionStorage.getItem(SESSION_LOCK_KEY) === 'true';
  const currentPhone = getActiveUserPhone();

  if (isUnlocked && currentPhone) {
    pinLockScreen.classList.remove('active', 'unlocking');
    updateActiveUserUI();
  } else {
    pinLockScreen.classList.add('active');
    pinLockScreen.classList.remove('unlocking');
    setupLoginScreen();
  }

  function setupLoginScreen() {
    renderSavedUserPills();
    const registry = getUsersRegistry();
    const lastPhone = currentPhone || (registry.length > 0 ? registry[registry.length - 1].phone : '');
    if (loginPhoneInput) {
      if (lastPhone && !loginPhoneInput.value) {
        loginPhoneInput.value = lastPhone;
      }
      onPhoneInputChange();
      if (!loginPhoneInput.value) {
        setTimeout(() => loginPhoneInput.focus(), 200);
      } else {
        focusPinInput();
      }
    }
  }

  function renderSavedUserPills() {
    if (!savedUsersPills) return;
    const registry = getUsersRegistry();
    if (registry.length === 0) {
      savedUsersPills.style.display = 'none';
      return;
    }

    savedUsersPills.style.display = 'flex';
    const activePhone = loginPhoneInput ? loginPhoneInput.value.replace(/\D/g, '') : getActiveUserPhone();
    let pillsHtml = '';

    registry.forEach((u, idx) => {
      const isCurrent = (u.phone === activePhone);
      const label = `User ${idx + 1} (${u.phone.slice(-4)})`;
      pillsHtml += `
        <button type="button" class="saved-user-pill ${isCurrent ? 'active' : ''}" data-phone="${u.phone}">
          <i class="ri-user-3-line"></i> ${label}
        </button>
      `;
    });

    pillsHtml += `
      <button type="button" class="saved-user-pill" id="btnNewUserPill" style="background: rgba(99, 102, 241, 0.2); border-color: rgba(99, 102, 241, 0.4); color: #c7d2fe;">
        <i class="ri-user-add-line"></i> + New User
      </button>
    `;

    savedUsersPills.innerHTML = pillsHtml;

    savedUsersPills.querySelectorAll('.saved-user-pill[data-phone]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ph = btn.getAttribute('data-phone');
        if (loginPhoneInput) {
          loginPhoneInput.value = ph;
          onPhoneInputChange();
          focusPinInput();
        }
      });
    });

    const newBtn = document.getElementById('btnNewUserPill');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        if (loginPhoneInput) {
          loginPhoneInput.value = '';
          loginPhoneInput.focus();
          onPhoneInputChange();
        }
      });
    }
  }

  function onPhoneInputChange() {
    if (!loginPhoneInput) return;
    const raw = loginPhoneInput.value.replace(/\D/g, '').slice(0, 10);
    loginPhoneInput.value = raw;
    const registry = getUsersRegistry();
    const user = registry.find(u => u.phone === raw);

    if (raw.length === 10) {
      if (user) {
        if (userStatusTag) {
          userStatusTag.textContent = 'Existing User';
          userStatusTag.style.color = '#10b981';
        }
        if (pinInstructionLabel) {
          pinInstructionLabel.textContent = `Enter 4-Digit PIN for +91 ${raw}`;
        }
      } else {
        if (userStatusTag) {
          userStatusTag.textContent = 'Cloud / New User';
          userStatusTag.style.color = '#38bdf8';
        }
        if (pinInstructionLabel) {
          pinInstructionLabel.textContent = `Enter 4-Digit PIN (Auto-Restores from Cloud)`;
        }
      }
    } else {
      if (userStatusTag) {
        userStatusTag.textContent = `${raw.length}/10 Digits`;
        userStatusTag.style.color = '#cbd5e1';
      }
      if (pinInstructionLabel) {
        pinInstructionLabel.textContent = 'Enter 4-Digit Security PIN';
      }
    }

    enteredPin = '';
    updateDots();
  }

  if (loginPhoneInput) {
    loginPhoneInput.addEventListener('input', onPhoneInputChange);
  }

  function focusPinInput() {
    if (pinHiddenInput) {
      setTimeout(() => {
        pinHiddenInput.focus();
      }, 150);
    }
  }

  function updateDots() {
    pinDots.forEach((dot, index) => {
      if (index < enteredPin.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled', 'success', 'error');
      }
    });
    if (pinErrorMsg) pinErrorMsg.textContent = '';
  }

  let isPinChecking = false;

  function handleDigit(digit) {
    if (isPinChecking) return;
    if (enteredPin.length >= 4) return;
    enteredPin += digit;
    updateDots();

    if (enteredPin.length === 4) {
      validatePin();
    }
  }

  function handleBackspace() {
    isPinChecking = false;
    if (enteredPin.length > 0) {
      enteredPin = enteredPin.slice(0, -1);
      updateDots();
    }
  }

  function handleClear() {
    isPinChecking = false;
    enteredPin = '';
    updateDots();
    if (pinErrorMsg) {
      pinErrorMsg.textContent = '';
    }
  }

  async function validatePin() {
    if (isPinChecking) return;

    const phone = loginPhoneInput ? loginPhoneInput.value.replace(/\D/g, '') : '';
    if (phone.length < 10) {
      pinDots.forEach(dot => dot.classList.add('error'));
      if (pinDotsContainer) pinDotsContainer.classList.add('shake');
      if (pinErrorMsg) {
        pinErrorMsg.style.color = '#f43f5e';
        pinErrorMsg.textContent = 'કૃપા કરીને પહેલા તમારો 10-અંકનો મોબાઈલ નંબર નાખો!';
      }
      if (loginPhoneInput) {
        loginPhoneInput.focus();
        loginPhoneInput.select();
      }
      setTimeout(() => {
        if (pinDotsContainer) pinDotsContainer.classList.remove('shake');
        enteredPin = '';
        updateDots();
      }, 900);
      return;
    }

    isPinChecking = true;
    if (pinErrorMsg) {
      pinErrorMsg.style.color = '#38bdf8';
      pinErrorMsg.innerHTML = `<i class="ri-loader-4-line ri-spin"></i> લોગિન થઈ રહ્યું છે (+91 ${phone})...`;
    }

    try {
      const registry = getUsersRegistry();
      let user = registry.find(u => u.phone === phone);

      // Fast Path: If user already exists on this device and entered PIN matches local PIN
      if (user && user.pin && enteredPin === user.pin) {
        currentActivePhone = phone;
        localStorage.setItem(ACTIVE_USER_PHONE_KEY, phone);
        localStorage.setItem(CLOUD_PHONE_KEY, phone);
        localStorage.setItem(CLOUD_PIN_KEY, enteredPin);

        user.lastLogin = new Date().toISOString();
        saveUsersRegistry(registry);

        unlockUserSession(phone, false, false);

        // Background check for cloud updates (non-blocking)
        const fbUrl = getFirebaseUrl();
        if (fbUrl) {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 3500);
            fetch(`${fbUrl}/vaults/${phone}.json`, { signal: controller.signal })
              .then(res => res.ok ? res.json() : null)
              .then(fbJson => {
                clearTimeout(timer);
                if (fbJson && fbJson.snapshot) {
                  applyFullLedgerSnapshot(fbJson.snapshot, phone);
                }
              })
              .catch(() => {
                clearTimeout(timer);
              });
          } catch (e) { }
        }
        return;
      }

      // If local PIN did not match OR user is logging in on this device for the first time:
      // Fetch from Google Firebase Realtime Database with a strict 3.5s timeout
      let cloudSnapshot = null;
      let cloudPin = null;
      const fbUrl = getFirebaseUrl();

      if (fbUrl) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3500);
          const fbRes = await fetch(`${fbUrl}/vaults/${phone}.json`, { signal: controller.signal });
          clearTimeout(timer);
          if (fbRes.ok) {
            const fbJson = await fbRes.json();
            if (fbJson) {
              cloudPin = fbJson.pin;
              cloudSnapshot = fbJson.snapshot;
            }
          }
        } catch (e) {
          console.warn('Firebase check timed out or failed:', e);
        }
      }

      const expectedPin = cloudPin || (user && user.pin);

      if (expectedPin) {
        // Existing user (either in Firebase cloud or local device)
        if (enteredPin !== expectedPin) {
          isPinChecking = false;
          pinDots.forEach(dot => dot.classList.add('error'));
          if (pinDotsContainer) pinDotsContainer.classList.add('shake');
          if (pinErrorMsg) {
            pinErrorMsg.style.color = '#f43f5e';
            pinErrorMsg.textContent = 'ખોટો PIN છે! કૃપા કરીને સાચો PIN નાખો.';
          }
          setTimeout(() => {
            if (pinDotsContainer) pinDotsContainer.classList.remove('shake');
            enteredPin = '';
            updateDots();
          }, 700);
          return;
        }

        // PIN is correct!
        currentActivePhone = phone;
        localStorage.setItem(ACTIVE_USER_PHONE_KEY, phone);
        localStorage.setItem(CLOUD_PHONE_KEY, phone);
        localStorage.setItem(CLOUD_PIN_KEY, enteredPin);

        if (!user) {
          user = {
            phone: phone,
            pin: enteredPin,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
          };
          registry.push(user);
        } else {
          user.pin = enteredPin;
          user.lastLogin = new Date().toISOString();
        }
        saveUsersRegistry(registry);

        if (cloudSnapshot) {
          applyFullLedgerSnapshot(cloudSnapshot, phone);
        } else {
          loadData();
        }

        unlockUserSession(phone, false, !!cloudSnapshot);
        return;
      }

      // Brand new user (neither in Firebase nor on local device)
      currentActivePhone = phone;
      localStorage.setItem(ACTIVE_USER_PHONE_KEY, phone);
      localStorage.setItem(CLOUD_PHONE_KEY, phone);
      localStorage.setItem(CLOUD_PIN_KEY, enteredPin);

      const newUser = {
        phone: phone,
        pin: enteredPin,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };
      registry.push(newUser);
      saveUsersRegistry(registry);

      loadData();
      unlockUserSession(phone, true, false);
    } catch (err) {
      console.error('Critical login error in validatePin:', err);
      isPinChecking = false;
      pinDots.forEach(dot => dot.classList.add('error'));
      if (pinDotsContainer) pinDotsContainer.classList.add('shake');
      if (pinErrorMsg) {
        pinErrorMsg.style.color = '#f43f5e';
        pinErrorMsg.textContent = 'લોગિનમાં સમસ્યા આવી! કૃપા કરીને ફરી PIN નાખો.';
      }
      setTimeout(() => {
        if (pinDotsContainer) pinDotsContainer.classList.remove('shake');
        enteredPin = '';
        updateDots();
        isPinChecking = false;
      }, 800);
    }
  }

  function unlockUserSession(phone, isNew, isRestored = false) {
    try {
      pinDots.forEach(dot => dot.classList.add('success'));
      sessionStorage.setItem(SESSION_LOCK_KEY, 'true');
      currentActivePhone = phone;
      localStorage.setItem(ACTIVE_USER_PHONE_KEY, phone);
      localStorage.setItem(CLOUD_PHONE_KEY, phone);

      const registry = getUsersRegistry();
      const currUser = registry.find(u => u.phone === phone);
      if (currUser && currUser.pin) {
        localStorage.setItem(CLOUD_PIN_KEY, currUser.pin);
      }

      if (pinErrorMsg) {
        pinErrorMsg.style.color = '#10b981';
        if (isRestored) {
          pinErrorMsg.textContent = '🎉 ક્લાઉડમાંથી ડેટા આવી ગયો છે! ખુલી રહ્યું છે...';
        } else if (isNew) {
          pinErrorMsg.textContent = 'નવું એકાઉન્ટ બની ગયું! ખુલી રહ્યું છે...';
        } else {
          pinErrorMsg.textContent = 'PIN સાચો છે! ખુલી રહ્યું છે...';
        }
      }

      // Load separate data for this user
      loadData();
      renderDashboard();
      updateActiveUserUI();
    } catch (e) {
      console.error('unlockUserSession setup error:', e);
    }

    setTimeout(() => {
      pinLockScreen.classList.add('unlocking');
      setTimeout(() => {
        pinLockScreen.classList.remove('active', 'unlocking');
        isPinChecking = false;
        enteredPin = '';
        updateDots();
        if (pinErrorMsg) {
          pinErrorMsg.style.color = '';
          pinErrorMsg.textContent = '';
        }
        if (isRestored) {
          showToast(`🎉 ક્લાઉડમાંથી +91 ${phone} નો બધો જ ડેટા પાછો આવી ગયો છે!`, 'success');
        } else {
          showToast(isNew ? `+91 ${phone} માટે નવું એકાઉન્ટ શરૂ થયું!` : `સ્વાગત છે +91 ${phone}!`, 'success');
        }
        if (isNew && typeof triggerAutoCloudSync === 'function') {
          triggerAutoCloudSync();
        }
      }, 350);
    }, isRestored ? 400 : 250);
  }

  // Keypad clicks
  keyBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const key = btn.getAttribute('data-key');
      if (key) handleDigit(key);
    });
  });

  if (pinClearBtn) {
    pinClearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleClear();
    });
  }

  if (pinBackspaceBtn) {
    pinBackspaceBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleBackspace();
    });
  }

  // Physical keyboard support
  window.addEventListener('keydown', (e) => {
    if (!pinLockScreen.classList.contains('active')) return;
    if (document.activeElement === loginPhoneInput) return; // Don't intercept phone number typing!

    if (e.key >= '0' && e.key <= '9') {
      handleDigit(e.key);
    } else if (e.key === 'Backspace') {
      handleBackspace();
    } else if (e.key === 'Escape' || e.key === 'Delete') {
      handleClear();
    }
  });

  // Restore from Cloud directly from PIN lock screen
  const pinScreenRestoreBtn = document.getElementById('pinScreenRestoreBtn');
  if (pinScreenRestoreBtn) {
    pinScreenRestoreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sessionStorage.setItem(SESSION_LOCK_KEY, 'true');
      pinLockScreen.classList.remove('active', 'unlocking');
      const backupModal = document.getElementById('backupModal');
      if (backupModal) backupModal.classList.add('active');
      const phoneInput = document.getElementById('cloudPhoneInput');
      setTimeout(() => {
        if (phoneInput) phoneInput.focus();
      }, 300);
    });
  }

  // Switch User / Logout Handlers
  window.logoutAndSwitchUser = function () {
    sessionStorage.removeItem(SESSION_LOCK_KEY);
    pinLockScreen.classList.add('active');
    pinLockScreen.classList.remove('unlocking');
    enteredPin = '';
    updateDots();
    setupLoginScreen();
    showToast('Session locked. Select or enter mobile number & PIN to switch account.', 'info');
  };

  if (sidebarSwitchUserBtn) sidebarSwitchUserBtn.addEventListener('click', window.logoutAndSwitchUser);
  if (headerSwitchUserBtn) headerSwitchUserBtn.addEventListener('click', window.logoutAndSwitchUser);
  if (lockAppHeaderBtn) lockAppHeaderBtn.addEventListener('click', window.logoutAndSwitchUser);
  if (navLockBtn) {
    navLockBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.closeMobileSidebar === 'function') {
        window.closeMobileSidebar();
      }
      window.logoutAndSwitchUser();
    });
  }
}

// ==========================================================================
// MULTI-DEVICE DATA SYNC & BACKUP LOGIC
// ==========================================================================
function initBackupAndSync() {
  const backupModal = document.getElementById('backupModal');
  const closeBackupBtn = document.getElementById('closeBackupBtn');
  const navBackupBtn = document.getElementById('navBackupBtn');
  const exportDataBtn = document.getElementById('exportDataBtn');
  const importDataTriggerBtn = document.getElementById('importDataTriggerBtn');
  const importFileInput = document.getElementById('importFileInput');

  function openBackupModal() {
    if (typeof window.closeMobileSidebar === 'function') {
      window.closeMobileSidebar();
    }
    if (backupModal) backupModal.classList.add('active');
  }

  function closeBackupModal() {
    if (backupModal) backupModal.classList.remove('active');
  }

  if (navBackupBtn) {
    navBackupBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openBackupModal();
    });
  }

  if (closeBackupBtn) {
    closeBackupBtn.addEventListener('click', closeBackupModal);
  }

  if (backupModal) {
    backupModal.addEventListener('click', (e) => {
      if (e.target === backupModal) closeBackupModal();
    });
  }

  // 1-Click Export / Download Backup file (.json)
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', () => {
      const now = new Date();
      const dateStr = formatDateDMY(now);
      const businessName = localStorage.getItem(BUSINESS_NAME_KEY) || 'My Business';

      const backupData = {
        appName: 'My Book',
        version: '2.2',
        exportedAt: now.toISOString(),
        exportedDate: dateStr,
        businessName: businessName,
        activeBusinessId: activeBusinessId,
        businessAccounts: businessAccounts,
        customerCount: customers.length,
        customers: customers
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.download = `MyBook_Ledger_Backup_${dateStr}.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);

      showToast(`Backup exported! Saved ${customers.length} customer records.`, 'success');
    });
  }

  // 1-Click Import file trigger
  if (importDataTriggerBtn && importFileInput) {
    importDataTriggerBtn.addEventListener('click', () => {
      importFileInput.value = '';
      importFileInput.click();
    });

    importFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (!parsed || !Array.isArray(parsed.customers)) {
            showToast('Invalid backup file. Missing customers array.', 'danger');
            return;
          }

          const confirmed = confirm(
            `Found ${parsed.customers.length} customer(s) in backup file from ${parsed.exportedDate || 'previous backup'}.\n\nDo you want to restore and sync this data on this device?`
          );

          if (!confirmed) return;

          if (parsed.businessAccounts && Array.isArray(parsed.businessAccounts) && parsed.businessAccounts.length > 0) {
            businessAccounts = parsed.businessAccounts;
            activeBusinessId = parsed.activeBusinessId || businessAccounts[0].id;
            saveBusinessesList();
          }

          customers = parsed.customers;
          saveData();

          if (parsed.businessName) {
            const activeBiz = getActiveBusiness();
            if (activeBiz) activeBiz.name = parsed.businessName;
            saveBusinessesList();
          }

          updateActiveBusinessUI();
          renderDashboard();
          if (typeof renderCustomersPageView === 'function') {
            renderCustomersPageView();
          }

          closeBackupModal();
          showToast(`Data restored successfully! Loaded ${customers.length} customers.`, 'success');
        } catch (err) {
          console.error('Import error:', err);
          showToast('Failed to parse backup file. Please select a valid JSON file.', 'danger');
        }
      };
      reader.readAsText(file);
    });
  }

  // Initialize Automatic Live Cloud Vault Sync
  initCloudVaultSync(openBackupModal, closeBackupModal);
}

// ==========================================================================
// AUTOMATIC LIVE CLOUD VAULT SYNC ENGINE (REST & FIREBASE SUPPORT)
// ==========================================================================
const CLOUD_PHONE_KEY = 'khatabook_cloud_phone_v2';
const CLOUD_PIN_KEY = 'khatabook_cloud_pin_v2';
const CLOUD_VAULT_ID_KEY = 'khatabook_cloud_vault_id_v2';
const CLOUD_AUTOSYNC_KEY = 'khatabook_cloud_autosync_v2';
const CLOUD_LAST_SYNC_KEY = 'khatabook_cloud_last_sync_v2';

function getUserCloudVaultIdKey() {
  const prefix = getUserPrefix();
  return prefix ? `khatabook_${prefix}cloud_vault_id` : CLOUD_VAULT_ID_KEY;
}

let autoSyncDebounceTimer = null;

function getFullLedgerSnapshot() {
  const activeBiz = getActiveBusiness();
  const businessName = activeBiz ? activeBiz.name : (localStorage.getItem(BUSINESS_NAME_KEY) || 'My Business');
  const bizPhone = (activeBiz && activeBiz.phone) || localStorage.getItem(BIZ_PHONE_KEY) || '';
  const qrImage = (activeBiz && activeBiz.qrImage) || localStorage.getItem(QR_IMAGE_KEY) || '';

  const allBizData = {};
  businessAccounts.forEach(b => {
    const k = getStorageKeyForBusiness(b.id);
    const raw = localStorage.getItem(k);
    if (raw) {
      try { allBizData[b.id] = JSON.parse(raw); } catch (e) { }
    }
  });

  return {
    appName: 'My Book',
    schemaVersion: '2.5',
    savedAt: new Date().toISOString(),
    businessName: businessName,
    bizPhone: bizPhone,
    qrImage: qrImage,
    activeBusinessId: activeBusinessId,
    businessAccounts: businessAccounts,
    customers: customers,
    allBizData: allBizData,
    dueDates: localStorage.getItem('mybook_due_dates_v1') || '{}'
  };
}

function applyFullLedgerSnapshot(data, phone = '') {
  if (!data) return;

  if (phone) {
    currentActivePhone = phone;
    localStorage.setItem(ACTIVE_USER_PHONE_KEY, phone);
  }

  if (Array.isArray(data.businessAccounts) && data.businessAccounts.length > 0) {
    businessAccounts = data.businessAccounts;
    localStorage.setItem(getBusinessesListKey(), JSON.stringify(businessAccounts));
    if (!getUserPrefix()) {
      localStorage.setItem(BUSINESSES_LIST_KEY, JSON.stringify(businessAccounts));
    }
  }

  if (data.activeBusinessId) {
    activeBusinessId = data.activeBusinessId;
    localStorage.setItem(getActiveBizIdKey(), activeBusinessId);
    if (!getUserPrefix()) {
      localStorage.setItem(ACTIVE_BIZ_ID_KEY, activeBusinessId);
    }
  }

  if (data.allBizData && typeof data.allBizData === 'object') {
    Object.keys(data.allBizData).forEach(bId => {
      const k = getStorageKeyForBusiness(bId);
      const rawList = Array.isArray(data.allBizData[bId]) ? data.allBizData[bId] : [];
      const sanitized = rawList.map(c => ({
        ...c,
        transactions: Array.isArray(c.transactions) ? c.transactions : []
      }));
      localStorage.setItem(k, JSON.stringify(sanitized));
    });
  }

  const currentKey = getStorageKeyForBusiness(activeBusinessId);
  if (Array.isArray(data.customers)) {
    customers = data.customers.map(c => ({
      ...c,
      transactions: Array.isArray(c.transactions) ? c.transactions : []
    }));
    localStorage.setItem(currentKey, JSON.stringify(customers));
  } else if (data.allBizData && Array.isArray(data.allBizData[activeBusinessId])) {
    customers = data.allBizData[activeBusinessId].map(c => ({
      ...c,
      transactions: Array.isArray(c.transactions) ? c.transactions : []
    }));
    localStorage.setItem(currentKey, JSON.stringify(customers));
  }

  if (data.businessName) {
    const prefix = getUserPrefix();
    if (prefix) localStorage.setItem(`khatabook_${prefix}biz_name`, data.businessName);
    localStorage.setItem(BUSINESS_NAME_KEY, data.businessName);
    const activeBiz = getActiveBusiness();
    if (activeBiz) activeBiz.name = data.businessName;
  }
  if (data.bizPhone) localStorage.setItem(BIZ_PHONE_KEY, data.bizPhone);
  if (data.qrImage) localStorage.setItem(QR_IMAGE_KEY, data.qrImage);
  if (data.dueDates) localStorage.setItem('mybook_due_dates_v1', typeof data.dueDates === 'string' ? data.dueDates : JSON.stringify(data.dueDates));

  try {
    loadData();
    renderDashboard();
    if (typeof updateActiveBusinessUI === 'function') updateActiveBusinessUI();
    if (typeof renderCustomersPageView === 'function') renderCustomersPageView();
  } catch (err) {
    console.error('Error rendering snapshot data:', err);
  }
}

// Push to Cloud
async function performCloudBackup(isAuto = false) {
  const phoneInput = document.getElementById('cloudPhoneInput');
  const pinInput = document.getElementById('cloudPinInput');
  const statusDot = document.getElementById('cloudStatusDot');
  const statusText = document.getElementById('cloudStatusText');
  const lastSyncDisplay = document.getElementById('cloudLastSyncTime');

  let phone = phoneInput ? phoneInput.value.trim().replace(/\D/g, '') : '';
  let pin = pinInput ? pinInput.value.trim() : '';

  if (!phone) {
    phone = getActiveUserPhone() || (localStorage.getItem(CLOUD_PHONE_KEY) || '').replace(/\D/g, '');
  }
  if (!pin) {
    const registry = getUsersRegistry();
    const currUser = registry.find(u => u.phone === phone);
    pin = (currUser && currUser.pin) || localStorage.getItem(CLOUD_PIN_KEY) || '1234';
  }

  if (!phone || phone.length < 10) {
    if (!isAuto) showToast('Please enter a valid 10-digit mobile number for cloud sync', 'danger');
    return false;
  }

  localStorage.setItem(CLOUD_PHONE_KEY, phone);
  localStorage.setItem(CLOUD_PIN_KEY, pin);

  if (statusDot) statusDot.className = 'status-pulse-dot syncing';
  if (statusText) statusText.textContent = 'Syncing to Cloud...';

  const snapshot = getFullLedgerSnapshot();
  const fbBase = getFirebaseUrl();

  try {
    let cloudVaultId = localStorage.getItem(getUserCloudVaultIdKey()) || localStorage.getItem(CLOUD_VAULT_ID_KEY);

    if (fbBase) {
      const fbUrl = `${fbBase}/vaults/${phone}.json`;
      const res = await fetch(fbUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin, snapshot, updatedAt: Date.now() })
      });
      if (!res.ok) throw new Error(`Firebase error: ${res.statusText}`);
    } else {
      const payload = {
        name: `mybook_${phone}`,
        data: {
          phone: phone,
          pin: pin,
          payload: JSON.stringify(snapshot),
          updatedAt: Date.now()
        }
      };

      if (cloudVaultId) {
        const res = await fetch(`https://api.restful-api.dev/objects/${cloudVaultId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          cloudVaultId = null;
        }
      }

      if (!cloudVaultId) {
        const res = await fetch('https://api.restful-api.dev/objects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Cloud vault server error');
        const resJson = await res.json();
        cloudVaultId = resJson.id;
        localStorage.setItem(CLOUD_VAULT_ID_KEY, cloudVaultId);
        localStorage.setItem(getUserCloudVaultIdKey(), cloudVaultId);
      }

      // Always map phone -> cloudVaultId in Global KeyValue Registry
      if (cloudVaultId && phone) {
        fetch(`https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/${GLOBAL_REGISTRY_TOKEN}/phone_${phone}/${cloudVaultId}`, {
          method: 'POST'
        }).catch(e => console.warn('KeyValue registry update failed:', e));
      }
    }

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    localStorage.setItem(CLOUD_LAST_SYNC_KEY, nowStr);

    if (statusDot) statusDot.className = 'status-pulse-dot';
    if (statusText) statusText.textContent = 'Cloud Synced';
    if (lastSyncDisplay) lastSyncDisplay.textContent = `Synced: Today at ${nowStr}`;

    const vaultIdDisplay = document.getElementById('cloudVaultIdDisplay');
    const cloudSyncKeyBox = document.getElementById('cloudSyncKeyBox');
    if (cloudVaultId && vaultIdDisplay && cloudSyncKeyBox) {
      vaultIdDisplay.textContent = cloudVaultId;
      cloudSyncKeyBox.style.display = 'flex';
    }

    const sidebarSyncLabel = document.getElementById('sidebarSyncLabel');
    if (sidebarSyncLabel) {
      sidebarSyncLabel.textContent = `Cloud Synced (${nowStr})`;
    }

    if (!isAuto) {
      showToast(`Cloud Backup Successful! Saved ${customers.length} customer records online.`, 'success');
    }
    return true;
  } catch (err) {
    console.error('Cloud Backup failed:', err);
    if (statusDot) statusDot.className = 'status-pulse-dot error';
    if (statusText) statusText.textContent = 'Sync Offline';
    if (!isAuto) {
      showToast('Could not reach cloud server. Check internet connection.', 'danger');
    }
    return false;
  }
}

// Pull from Cloud
async function performCloudRestore(closeModalCallback) {
  const phoneInput = document.getElementById('cloudPhoneInput');
  const pinInput = document.getElementById('cloudPinInput');
  const statusDot = document.getElementById('cloudStatusDot');
  const statusText = document.getElementById('cloudStatusText');

  let phone = phoneInput ? phoneInput.value.trim().replace(/\D/g, '') : '';
  let pin = pinInput ? pinInput.value.trim() : '';

  if (!phone) {
    phone = getActiveUserPhone() || (localStorage.getItem(CLOUD_PHONE_KEY) || '').replace(/\D/g, '');
    if (phoneInput) phoneInput.value = phone;
  }
  if (!pin) {
    const registry = getUsersRegistry();
    const currUser = registry.find(u => u.phone === phone);
    pin = (currUser && currUser.pin) || localStorage.getItem(CLOUD_PIN_KEY) || '';
    if (pinInput) pinInput.value = pin;
  }

  if (!phone || phone.length < 10) {
    const entered = prompt('Please enter your 10-digit registered mobile number to restore:');
    if (!entered) return;
    phone = entered.trim().replace(/\D/g, '');
    if (phoneInput) phoneInput.value = phone;
  }

  if (statusDot) statusDot.className = 'status-pulse-dot syncing';
  if (statusText) statusText.textContent = 'Fetching from Cloud...';

  try {
    let cloudVaultId = localStorage.getItem(getUserCloudVaultIdKey()) || localStorage.getItem(CLOUD_VAULT_ID_KEY);
    const fbBase = getFirebaseUrl();

    let retrievedData = null;

    if (fbBase) {
      const fbUrl = `${fbBase}/vaults/${phone}.json`;
      const res = await fetch(fbUrl);
      if (!res.ok) throw new Error('Firebase connection error: ' + res.statusText);
      const json = await res.json();
      if (!json || !json.snapshot) throw new Error('આ મોબાઈલ નંબર (+91 ' + phone + ') નો કોઈ ડેટા Firebase ક્લાઉડ પર મળ્યો નથી.');
      retrievedData = json.snapshot;
    } else {
      // If we don't have a local vault ID, automatically lookup from KeyValue registry
      if (!cloudVaultId && phone) {
        try {
          const lookupRes = await fetch(`https://keyvalue.immanuel.co/api/KeyVal/GetValue/${GLOBAL_REGISTRY_TOKEN}/phone_${phone}`);
          if (lookupRes.ok) {
            const rawId = await lookupRes.text();
            const cleanId = rawId ? rawId.trim().replace(/^"|"$/g, '') : '';
            if (cleanId && cleanId !== 'null' && cleanId.length > 5) {
              cloudVaultId = cleanId;
              localStorage.setItem(getUserCloudVaultIdKey(), cloudVaultId);
              localStorage.setItem(CLOUD_VAULT_ID_KEY, cloudVaultId);
            }
          }
        } catch (lookupErr) {
          console.warn('KeyValue lookup error:', lookupErr);
        }
      }

      if (!cloudVaultId) {
        const manualId = prompt('Enter your Cloud Vault Key (or press OK to cancel):');
        if (manualId && manualId.trim()) {
          cloudVaultId = manualId.trim();
          localStorage.setItem(CLOUD_VAULT_ID_KEY, cloudVaultId);
        }
      }

      if (!cloudVaultId) {
        throw new Error('No cloud ledger found for mobile number +91 ' + phone);
      }

      const res = await fetch(`https://api.restful-api.dev/objects/${cloudVaultId}`);
      if (!res.ok) throw new Error('Cloud Vault record not found. Server status: ' + res.status);
      const json = await res.json();
      if (!json || !json.data || !json.data.payload) {
        throw new Error('Invalid Cloud Vault payload');
      }
      retrievedData = JSON.parse(json.data.payload);
    }

    applyFullLedgerSnapshot(retrievedData);
    if (statusDot) statusDot.className = 'status-pulse-dot';
    if (statusText) statusText.textContent = 'Cloud Restored';

    if (typeof closeModalCallback === 'function') {
      closeModalCallback();
    }

    showToast(`🎉 Cloud Restore Successful! Restored ${customers.length} customer records.`, 'success');
  } catch (err) {
    console.error('Cloud Restore failed:', err);
    if (statusDot) statusDot.className = 'status-pulse-dot error';
    if (statusText) statusText.textContent = 'Restore Failed';
    showToast(err.message || 'Could not restore from cloud. Verify number & internet.', 'danger');
  }
}

// Debounced auto-sync whenever user saves data
function triggerAutoCloudSync() {
  const isAutoEnabled = localStorage.getItem(CLOUD_AUTOSYNC_KEY) !== 'false';
  const savedPhone = getActiveUserPhone() || localStorage.getItem(CLOUD_PHONE_KEY);
  if (!isAutoEnabled || !savedPhone) return;

  clearTimeout(autoSyncDebounceTimer);
  autoSyncDebounceTimer = setTimeout(() => {
    performCloudBackup(true);
  }, 1800);
}

// Initialize Cloud Vault UI & Event Listeners
function initCloudVaultSync(openBackupModal, closeBackupModal) {
  const phoneInput = document.getElementById('cloudPhoneInput');
  const pinInput = document.getElementById('cloudPinInput');
  const autoSyncToggle = document.getElementById('autoCloudSyncToggle');
  const btnUseBizPhone = document.getElementById('btnUseBizPhoneForCloud');
  const btnCloudBackup = document.getElementById('btnCloudBackupNow');
  const btnCloudRestore = document.getElementById('btnCloudRestoreNow');
  const btnCopyVaultId = document.getElementById('btnCopyVaultId');
  const btnSendWhatsApp = document.getElementById('btnSendBackupWhatsApp');
  const btnSaveFirebase = document.getElementById('btnSaveFirebaseUrl');
  const customFirebaseInput = document.getElementById('customFirebaseUrlInput');
  const emptyStateRestoreBtn = document.getElementById('emptyStateRestoreCloudBtn');
  const vaultIdDisplay = document.getElementById('cloudVaultIdDisplay');
  const cloudSyncKeyBox = document.getElementById('cloudSyncKeyBox');
  const lastSyncDisplay = document.getElementById('cloudLastSyncTime');

  // Load saved state
  const savedPhone = localStorage.getItem(CLOUD_PHONE_KEY) || localStorage.getItem(BIZ_PHONE_KEY) || '';
  const savedPin = localStorage.getItem(CLOUD_PIN_KEY) || '1234';
  const savedVaultId = localStorage.getItem(CLOUD_VAULT_ID_KEY);
  const savedLastSync = localStorage.getItem(CLOUD_LAST_SYNC_KEY);
  const isAutoEnabled = localStorage.getItem(CLOUD_AUTOSYNC_KEY) !== 'false';
  const savedFbUrl = localStorage.getItem(FIREBASE_CUSTOM_URL_KEY) || DEFAULT_FIREBASE_URL;

  if (phoneInput && savedPhone) phoneInput.value = savedPhone;
  if (pinInput && savedPin) pinInput.value = savedPin;
  if (autoSyncToggle) autoSyncToggle.checked = isAutoEnabled;
  if (customFirebaseInput) customFirebaseInput.value = savedFbUrl;

  if (savedLastSync && lastSyncDisplay) {
    lastSyncDisplay.textContent = `Last synced: ${savedLastSync}`;
  }

  if (savedVaultId && vaultIdDisplay && cloudSyncKeyBox) {
    vaultIdDisplay.textContent = savedVaultId;
    cloudSyncKeyBox.style.display = 'flex';
  }

  if (btnUseBizPhone) {
    btnUseBizPhone.addEventListener('click', () => {
      const bizPhone = localStorage.getItem(BIZ_PHONE_KEY) || (getActiveBusiness() && getActiveBusiness().phone) || '';
      if (bizPhone && phoneInput) {
        phoneInput.value = bizPhone;
        localStorage.setItem(CLOUD_PHONE_KEY, bizPhone);
        showToast('Auto-filled with business phone number', 'success');
      } else {
        showToast('Please enter your 10-digit mobile number manually', 'neutral');
        if (phoneInput) phoneInput.focus();
      }
    });
  }

  if (autoSyncToggle) {
    autoSyncToggle.addEventListener('change', (e) => {
      localStorage.setItem(CLOUD_AUTOSYNC_KEY, e.target.checked ? 'true' : 'false');
      showToast(e.target.checked ? 'Auto Cloud Sync enabled' : 'Auto Cloud Sync disabled', 'neutral');
      if (e.target.checked) performCloudBackup(true);
    });
  }

  if (phoneInput) {
    phoneInput.addEventListener('change', (e) => {
      localStorage.setItem(CLOUD_PHONE_KEY, e.target.value.trim());
    });
  }

  if (pinInput) {
    pinInput.addEventListener('change', (e) => {
      localStorage.setItem(CLOUD_PIN_KEY, e.target.value.trim());
    });
  }

  if (btnCloudBackup) {
    btnCloudBackup.addEventListener('click', () => {
      performCloudBackup(false);
    });
  }

  if (btnCloudRestore) {
    btnCloudRestore.addEventListener('click', () => {
      performCloudRestore(closeBackupModal);
    });
  }

  if (btnCopyVaultId) {
    btnCopyVaultId.addEventListener('click', () => {
      const vaultId = localStorage.getItem(CLOUD_VAULT_ID_KEY) || (vaultIdDisplay ? vaultIdDisplay.textContent : '');
      if (vaultId && vaultId !== '---') {
        navigator.clipboard.writeText(vaultId).then(() => {
          showToast('Cloud Vault Key copied to clipboard! 📋', 'success');
        }).catch(() => {
          prompt('Copy your Cloud Vault Key:', vaultId);
        });
      }
    });
  }

  if (btnSendWhatsApp) {
    btnSendWhatsApp.addEventListener('click', () => {
      const snapshot = getFullLedgerSnapshot();
      const vaultId = localStorage.getItem(CLOUD_VAULT_ID_KEY) || 'Available in App';
      const text = encodeURIComponent(
        `📒 *My Book Digital Ledger Cloud Backup*\n\n` +
        `🏢 Business: ${snapshot.businessName}\n` +
        `👥 Customers: ${snapshot.customers.length}\n` +
        `📅 Date: ${new Date().toLocaleDateString()}\n` +
        `🔑 Cloud Vault Key: ${vaultId}\n\n` +
        `Your business ledger is backed up safely in the cloud.`
      );
      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    });
  }

  if (btnSaveFirebase && customFirebaseInput) {
    btnSaveFirebase.addEventListener('click', () => {
      const url = customFirebaseInput.value.trim();
      localStorage.setItem(FIREBASE_CUSTOM_URL_KEY, url);
      showToast(url ? 'Custom Firebase URL saved successfully!' : 'Reset to default Cloud Vault', 'success');
      if (url) performCloudBackup(false);
    });
  }

  // Share with User 2 / Partner on WhatsApp
  const btnShareWithPartner = document.getElementById('btnShareWithPartner');
  if (btnShareWithPartner) {
    btnShareWithPartner.addEventListener('click', () => {
      const savedPhone = localStorage.getItem(CLOUD_PHONE_KEY) || (phoneInput ? phoneInput.value.trim() : '');
      const vaultId = localStorage.getItem(CLOUD_VAULT_ID_KEY) || (vaultIdDisplay ? vaultIdDisplay.textContent : '');
      const activeBiz = getActiveBusiness();
      const bizName = activeBiz ? activeBiz.name : 'My Book';

      if (!savedPhone) {
        showToast('Please enter your mobile number and tap Backup to Cloud first.', 'danger');
        if (phoneInput) phoneInput.focus();
        return;
      }

      const baseUrl = window.location.origin + window.location.pathname;
      const connectLink = `${baseUrl}?connect_phone=${savedPhone}&connect_vault=${encodeURIComponent(vaultId || '')}`;

      const shareText = encodeURIComponent(
        `👋 Hello, open this link on your phone to connect with my ledger *My Book* (${bizName}):\n\n` +
        `🔗 ${connectLink}\n\n` +
        `📱 Mobile: ${savedPhone}\n` +
        `🔑 Cloud Key: ${vaultId || 'Auto'}\n\n` +
        `Opening this link live-syncs the ledger across both phones instantly!`
      );
      window.open(`https://api.whatsapp.com/send?text=${shareText}`, '_blank');
    });
  }

  // Header Quick Cloud Sync Button (Pull User 2 updates anytime)
  const headerCloudSyncBtn = document.getElementById('headerCloudSyncBtn');
  const headerCloudSyncIcon = document.getElementById('headerCloudSyncIcon');
  if (headerCloudSyncBtn) {
    headerCloudSyncBtn.addEventListener('click', async () => {
      if (headerCloudSyncIcon) headerCloudSyncIcon.classList.add('ri-spin');
      showToast('Checking Cloud Vault for User 2 updates...', 'neutral');
      await performCloudRestore(null);
      if (headerCloudSyncIcon) {
        setTimeout(() => headerCloudSyncIcon.classList.remove('ri-spin'), 600);
      }
    });
  }

  if (emptyStateRestoreBtn) {
    emptyStateRestoreBtn.addEventListener('click', () => {
      if (typeof openBackupModal === 'function') openBackupModal();
      setTimeout(() => {
        if (phoneInput && !phoneInput.value) phoneInput.focus();
      }, 300);
    });
  }
}

// Global print for overall ledger report
window.printGeneralReport = function () {
  prepareGeneralLedgerPrintable();
  document.body.classList.remove('printing-customer');
  document.body.classList.add('printing-report');
  window.print();
  setTimeout(() => {
    document.body.classList.remove('printing-report');
  }, 1000);
};

// Global print for customer card
window.printCustomerFromCard = function (customerId) {
  const cust = customers.find(c => c.id === customerId);
  if (!cust) return;
  prepareCustomerPrintableStatement(cust);
  document.body.classList.remove('printing-report');
  document.body.classList.add('printing-customer');
  window.print();
  setTimeout(() => {
    document.body.classList.remove('printing-customer');
  }, 1000);
};

// Prepare Printable Statement for specific customer ledger
function prepareCustomerPrintableStatement(cust) {
  const shopName = localStorage.getItem(BUSINESS_NAME_KEY) || 'My Business';
  const balInfo = calculateCustomerBalance(cust);
  const now = new Date();

  document.getElementById('printShopTitle').textContent = shopName;
  document.getElementById('printStmtDate').textContent = `Statement Date: ${formatDateDMY(now)}`;
  document.getElementById('printPartyName').textContent = cust.name;
  document.getElementById('printPartyPhone').textContent = `+91 ${cust.phone}`;
  document.getElementById('printPartyType').textContent = cust.partyType || 'Customer';

  let netText = formatCurrency(balInfo.amount);
  if (balInfo.status === 'receive') {
    netText += ' (You\'ll Get)';
  } else if (balInfo.status === 'pay') {
    netText += ' (You\'ll Give)';
  } else {
    netText += ' (Settled)';
  }
  document.getElementById('printPartyNetBalance').textContent = netText;

  const tbody = document.getElementById('printTxnTableBody');
  if (!cust.transactions || cust.transactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color:#64748b;">No transactions recorded for this customer.</td></tr>`;
    document.getElementById('printTotalGave').textContent = '₹ 0';
    document.getElementById('printTotalGot').textContent = '₹ 0';
    document.getElementById('printFinalNet').textContent = '₹ 0';
    return;
  }

  // Sort chronological for passbook statement
  const sorted = [...cust.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

  let totalGave = 0;
  let totalGot = 0;
  let runningBal = 0;

  tbody.innerHTML = sorted.map((t, idx) => {
    const isGave = t.type === 'give';
    const amt = Number(t.amount) || 0;
    if (isGave) {
      totalGave += amt;
      runningBal += amt;
    } else {
      totalGot += amt;
      runningBal -= amt;
    }

    let balDisplay = '';
    if (runningBal > 0) {
      balDisplay = `${formatCurrency(runningBal)} (Dr)`;
    } else if (runningBal < 0) {
      balDisplay = `${formatCurrency(Math.abs(runningBal))} (Cr)`;
    } else {
      balDisplay = '₹ 0';
    }

    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${formatDateDMY(t.date)}</td>
        <td>${escapeHTML(t.note || (isGave ? 'You Gave' : 'You Got'))}</td>
        <td style="text-align: right; color: #dc2626; font-weight: 600;">${isGave ? formatCurrency(amt) : '-'}</td>
        <td style="text-align: right; color: #059669; font-weight: 600;">${!isGave ? formatCurrency(amt) : '-'}</td>
        <td style="text-align: right; font-weight: 700;">${balDisplay}</td>
      </tr>
    `;
  }).join('');

  document.getElementById('printTotalGave').textContent = formatCurrency(totalGave);
  document.getElementById('printTotalGot').textContent = formatCurrency(totalGot);
  document.getElementById('printFinalNet').textContent = netText;
}

// Open Transaction Record Modal
function openTransactionModal(type) {
  const modal = document.getElementById('transactionModal');
  const title = document.getElementById('txnModalTitle');
  const header = document.getElementById('txnHeaderBlue');
  const submitBtn = document.getElementById('txnSubmitBtn');
  const dirInput = document.getElementById('txnDirectionInput');

  dirInput.value = type;
  document.getElementById('recordTxnForm').reset();
  document.getElementById('txnDateInput').value = new Date().toISOString().split('T')[0];

  if (type === 'give') {
    title.textContent = 'You Gave (Credit / Debit)';
    header.style.backgroundColor = '#dc2626';
    submitBtn.style.backgroundColor = '#dc2626';
    submitBtn.textContent = 'SAVE AS GAVE';
  } else {
    title.textContent = 'You Got (Payment Received)';
    header.style.backgroundColor = '#059669';
    submitBtn.style.backgroundColor = '#059669';
    submitBtn.textContent = 'SAVE AS GOT';
  }

  modal.classList.add('active');
  setTimeout(() => document.getElementById('txnAmountInput').focus(), 150);
}

// Render Dashboard Data & KPI
function renderDashboard() {
  let totalReceive = 0;
  let totalPay = 0;
  let receiveCount = 0;
  let payCount = 0;
  let settledCount = 0;
  let overdueCount = 0;
  const todayStr = new Date().toISOString().split('T')[0];

  customers.forEach(c => {
    const balInfo = calculateCustomerBalance(c);
    if (balInfo.status === 'receive') {
      totalReceive += balInfo.amount;
      receiveCount++;
      if (c.dueDate && c.dueDate <= todayStr) {
        overdueCount++;
      }
    } else if (balInfo.status === 'pay') {
      totalPay += balInfo.amount;
      payCount++;
    } else {
      settledCount++;
    }
  });

  const netBalance = totalReceive - totalPay;

  // KPI elements
  document.getElementById('totalReceiveDisplay').textContent = formatCurrency(totalReceive);
  document.getElementById('totalPayDisplay').textContent = formatCurrency(totalPay);

  const netDisplay = document.getElementById('netBalanceDisplay');
  const netSub = document.getElementById('netBalanceSub');
  if (netDisplay) {
    netDisplay.textContent = formatCurrency(Math.abs(netBalance));

    if (netBalance > 0) {
      netDisplay.style.color = 'var(--receive-green)';
      if (netSub) netSub.innerHTML = '<span style="color:var(--receive-green); font-weight:600;"><i class="ri-arrow-down-line"></i> Net You will receive</span>';
    } else if (netBalance < 0) {
      netDisplay.style.color = 'var(--pay-red)';
      if (netSub) netSub.innerHTML = '<span style="color:var(--pay-red); font-weight:600;"><i class="ri-arrow-up-line"></i> Net You will give</span>';
    } else {
      netDisplay.style.color = 'var(--brand-blue)';
      if (netSub) netSub.textContent = 'All accounts settled (₹0)';
    }
  }

  const custCount = customers.length;
  const custCountDisplay = document.getElementById('totalCustomerCountDisplay');
  if (custCountDisplay) custCountDisplay.textContent = custCount;
  const navCustomerCount = document.getElementById('navCustomerCount');
  if (navCustomerCount) navCustomerCount.textContent = custCount;

  // Filter Counters
  document.getElementById('countAll').textContent = custCount;
  document.getElementById('countReceive').textContent = receiveCount;
  document.getElementById('countPay').textContent = payCount;
  const countOverdue = document.getElementById('countOverdue');
  if (countOverdue) countOverdue.textContent = overdueCount;
  const countSettled = document.getElementById('countSettled');
  if (countSettled) countSettled.textContent = settledCount;

  renderCustomerCards();
  renderCustomersPageView();
}

// Render Dashboard Customer Cards
function renderCustomerCards() {
  const container = document.getElementById('customerListContainer');
  const emptyState = document.getElementById('emptyState');
  const todayStr = new Date().toISOString().split('T')[0];

  // Filter
  let filtered = customers.filter(c => {
    const balInfo = calculateCustomerBalance(c);

    if (currentFilter === 'receive' && balInfo.status !== 'receive') return false;
    if (currentFilter === 'pay' && balInfo.status !== 'pay') return false;
    if (currentFilter === 'settled' && balInfo.status !== 'settled') return false;
    if (currentFilter === 'overdue') {
      const isPastDue = c.dueDate && c.dueDate <= todayStr && balInfo.status === 'receive';
      if (!isPastDue) return false;
    }

    if (currentGlobalSearch) {
      const matchName = c.name.toLowerCase().includes(currentGlobalSearch);
      const matchPhone = c.phone.includes(currentGlobalSearch);
      const matchAddress = c.address && c.address.toLowerCase().includes(currentGlobalSearch);
      return matchName || matchPhone || matchAddress;
    }

    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    const balA = calculateCustomerBalance(a);
    const balB = calculateCustomerBalance(b);

    if (currentSort === 'amount-high') {
      return balB.amount - balA.amount;
    } else if (currentSort === 'amount-low') {
      return balA.amount - balB.amount;
    } else if (currentSort === 'name-asc') {
      return a.name.localeCompare(b.name);
    } else {
      const txnsA = Array.isArray(a.transactions) ? a.transactions : [];
      const txnsB = Array.isArray(b.transactions) ? b.transactions : [];
      const dateA = txnsA.length ? new Date(txnsA[0].date).getTime() : new Date(a.createdAt || 0).getTime();
      const dateB = txnsB.length ? new Date(txnsB[0].date).getTime() : new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    }
  });

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  container.innerHTML = filtered.map(cust => {
    const balInfo = calculateCustomerBalance(cust);
    const initials = getInitials(cust.name);

    let statusBadgeClass = 'badge-settled';
    let statusText = 'Settled';
    let amountColor = 'var(--text-muted)';

    if (balInfo.status === 'receive') {
      statusBadgeClass = 'badge-receive';
      statusText = 'You\'ll Get';
      amountColor = 'var(--receive-green)';
    } else if (balInfo.status === 'pay') {
      statusBadgeClass = 'badge-pay';
      statusText = 'You\'ll Give';
      amountColor = 'var(--pay-red)';
    }

    // Due Date Badge
    let dueBadgeHtml = '';
    if (cust.dueDate && balInfo.status === 'receive') {
      const diffTime = new Date(todayStr) - new Date(cust.dueDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 0) {
        dueBadgeHtml = `<span class="overdue-badge"><i class="ri-alarm-warning-fill"></i> ${diffDays === 0 ? 'Due Today' : `Overdue ${diffDays}d`}</span>`;
      } else {
        dueBadgeHtml = `<span class="due-badge"><i class="ri-calendar-line"></i> Due: ${formatDateDMY(cust.dueDate)}</span>`;
      }
    }

    const custTxns = Array.isArray(cust.transactions) ? cust.transactions : [];
    const lastTxn = custTxns.length > 0 ? custTxns[0] : null;
    const lastTxnText = lastTxn ? `${formatDateDMY(lastTxn.date)} • ${lastTxn.note}` : 'No transactions';

    return `
      <div class="customer-card" onclick="openCustomerDetail('${cust.id}')">
        <div class="customer-card-header">
          <div class="cust-circle-avatar">
            ${initials}
          </div>
          <div class="cust-card-info">
            <h4>
              ${escapeHTML(cust.name)}
              <span class="party-badge-chip">${escapeHTML(cust.partyType || 'Customer')}</span>
            </h4>
            <div class="cust-phone-badge">
              <i class="ri-phone-line"></i> +91 ${escapeHTML(cust.phone)}
              ${dueBadgeHtml}
            </div>
          </div>
        </div>

        <div class="customer-card-body">
          <div>
            <span class="due-label">Net Balance</span>
            <span class="due-time">${escapeHTML(lastTxnText)}</span>
          </div>
          <div class="due-amount-wrap">
            <div class="due-amount" style="color: ${amountColor};">
              ${formatCurrency(balInfo.amount)}
            </div>
            <span class="status-badge ${statusBadgeClass}">${statusText}</span>
          </div>
        </div>

        <div class="customer-card-footer" onclick="event.stopPropagation()">
          <button class="card-btn card-btn-wa" onclick="openWhatsappModal('${cust.id}')" title="Smart WhatsApp Reminder">
            <i class="ri-whatsapp-line"></i> Reminder
          </button>
          <button class="card-btn" onclick="openUpiQrModal('${cust.id}')" title="Payment QR Code">
            <i class="ri-qr-code-line"></i> QR Code
          </button>
          <button class="card-btn card-btn-print" onclick="printCustomerFromCard('${cust.id}')" title="Print Ledger Statement">
            <i class="ri-printer-line"></i> Print
          </button>
          <button class="card-btn" onclick="openCustomerDetail('${cust.id}')">
            <i class="ri-file-list-3-line"></i> View
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Render Full Customers Page (Image 2)
function renderCustomersPageView() {
  const container = document.getElementById('customersAlphabetList');
  const emptyState = document.getElementById('pageEmptyState');
  const countSubtitle = document.getElementById('pageCustomerCountSubtitle');
  const searchInput = document.getElementById('customersPageSearchInput');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  if (countSubtitle) {
    countSubtitle.textContent = `${customers.length} customer${customers.length === 1 ? '' : 's'}`;
  }

  // Filter
  let filtered = customers.filter(c => {
    if (!query) return true;
    return c.name.toLowerCase().includes(query) ||
      c.phone.includes(query) ||
      (c.address && c.address.toLowerCase().includes(query));
  });

  // Sort alphabetically by name
  filtered.sort((a, b) => a.name.localeCompare(b.name));

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  // Group by first letter of name
  const groups = {};
  filtered.forEach(cust => {
    const firstChar = cust.name.trim().charAt(0).toUpperCase();
    const groupKey = /^[A-Z]/.test(firstChar) ? firstChar : '#';
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(cust);
  });

  // Render grouped sections like Image 2
  let html = '';
  const sortedKeys = Object.keys(groups).sort();

  sortedKeys.forEach(letter => {
    html += `
      <div class="alphabet-group-section">
        <div class="alphabet-group-header">${letter}</div>
        <div class="alphabet-group-items">
    `;

    groups[letter].forEach(cust => {
      const initial = getInitials(cust.name);
      const balInfo = calculateCustomerBalance(cust);

      let balBadgeClass = 'badge-settled';
      let balText = 'Settled';
      if (balInfo.status === 'receive') {
        balBadgeClass = 'badge-receive';
        balText = 'You\'ll Get ' + formatCurrency(balInfo.amount);
      } else if (balInfo.status === 'pay') {
        balBadgeClass = 'badge-pay';
        balText = 'You\'ll Give ' + formatCurrency(balInfo.amount);
      }

      html += `
        <div class="customer-table-row" onclick="openCustomerDetail('${cust.id}')">
          <div class="row-left">
            <div class="row-avatar">${initial}</div>
            <div class="row-name">${escapeHTML(cust.name)}</div>
            <div class="row-phone-pill">
              <i class="ri-phone-line"></i> ${escapeHTML(cust.phone)}
            </div>
          </div>
          <div class="row-right">
            <span class="row-balance-badge ${balBadgeClass}">${balText}</span>
            <i class="ri-arrow-right-s-line row-arrow"></i>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Render Customer List in Search Screen (Screenshot 1)
function renderScreenCustomerList() {
  const container = document.getElementById('screenCustomerList');

  let list = customers.filter(c => {
    if (!currentScreenSearch) return true;
    return c.name.toLowerCase().includes(currentScreenSearch) || c.phone.includes(currentScreenSearch);
  });

  list.sort((a, b) => a.name.localeCompare(b.name));

  if (list.length === 0) {
    if (customers.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <i class="ri-user-add-line" style="font-size: 36px; color: var(--brand-blue); display: block; margin-bottom: 8px;"></i>
          <p style="font-size: 14px; font-weight: 600;">No customers added yet</p>
          <span style="font-size: 12px;">Click "Add Customer" above to create your first customer</span>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <p style="font-size: 14px;">No match found for "${escapeHTML(currentScreenSearch)}"</p>
        </div>
      `;
    }
    return;
  }

  container.innerHTML = list.map(c => {
    const initials = getInitials(c.name);
    const balInfo = calculateCustomerBalance(c);

    let balColor = 'var(--text-muted)';
    let balText = '₹ 0';

    if (balInfo.status === 'receive') {
      balColor = 'var(--receive-green)';
      balText = '+ ' + formatCurrency(balInfo.amount);
    } else if (balInfo.status === 'pay') {
      balColor = 'var(--pay-red)';
      balText = '- ' + formatCurrency(balInfo.amount);
    }

    return `
      <div class="screen-cust-item" onclick="selectCustomerFromScreen('${c.id}')">
        <div class="screen-cust-avatar">
          ${initials}
        </div>
        <div class="screen-cust-info">
          <div class="screen-cust-name">${escapeHTML(c.name)}</div>
          <div class="screen-cust-phone">+91 ${escapeHTML(c.phone)}</div>
        </div>
        <div class="screen-cust-balance" style="color: ${balColor};">
          ${balText}
        </div>
      </div>
    `;
  }).join('');
}

// Select Customer from Screen 1
window.selectCustomerFromScreen = function (id) {
  document.getElementById('customerSearchScreen').classList.remove('active');
  openCustomerDetail(id);
};

// Global Close Customer Detail Modal
window.closeCustomerDetailModal = function () {
  const detailModal = document.getElementById('customerDetailModal');
  if (detailModal) {
    detailModal.classList.remove('active');
    const win = detailModal.querySelector('.mobile-window');
    if (win) win.classList.remove('is-fullscreen');
  }
  // If history state was pushed for modal, pop it cleanly
  if (window.history.state && window.history.state.modal === 'customerDetail') {
    window.history.back();
  }
};

// Global Go Back to Dashboard
window.goBackToDashboard = function () {
  window.location.hash = 'dashboard';
  switchView('dashboard');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Open Customer Detail Modal
window.openCustomerDetail = function (customerId) {
  selectedCustomerId = customerId;
  const cust = customers.find(c => c.id === customerId);
  if (!cust) return;

  updateCustomerDetailView(cust);
  const detailModal = document.getElementById('customerDetailModal');
  if (detailModal) {
    detailModal.classList.add('active');
  }

  // Push history state so mobile swipe-back or back button closes the ledger
  try {
    if (!window.history.state || window.history.state.modal !== 'customerDetail') {
      window.history.pushState({ modal: 'customerDetail', customerId }, '');
    }
  } catch (e) { }
};

// Update Customer Detail View
function updateCustomerDetailView(cust) {
  const balInfo = calculateCustomerBalance(cust);

  document.getElementById('detailCustomerName').textContent = cust.name;
  document.getElementById('detailCustomerPhone').textContent = `+91 ${cust.phone} • ${cust.partyType || 'Customer'}`;

  const balVal = document.getElementById('detailBalanceAmount');
  const balTag = document.getElementById('detailBalanceTag');

  balVal.textContent = formatCurrency(balInfo.amount);

  if (balInfo.status === 'receive') {
    balVal.style.color = 'var(--receive-green)';
    balTag.className = 'detail-balance-tag badge-receive';
    balTag.textContent = 'YOU\'LL GET';
  } else if (balInfo.status === 'pay') {
    balVal.style.color = 'var(--pay-red)';
    balTag.className = 'detail-balance-tag badge-pay';
    balTag.textContent = 'YOU\'LL GIVE';
  } else {
    balVal.style.color = 'var(--text-muted)';
    balTag.className = 'detail-balance-tag badge-settled';
    balTag.textContent = 'SETTLED (₹0)';
  }

  // Due Date Badge in Detail View
  const duePill = document.getElementById('detailDueDateDisplay');
  if (duePill) {
    if (cust.dueDate && balInfo.status === 'receive') {
      const todayStr = new Date().toISOString().split('T')[0];
      const diffTime = new Date(todayStr) - new Date(cust.dueDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      duePill.style.display = 'inline-block';
      if (diffDays >= 0) {
        duePill.innerHTML = `
          <span class="overdue-badge"><i class="ri-alarm-warning-fill"></i> Overdue by ${diffDays === 0 ? 'Today' : `${diffDays} days`} (Due: ${formatDateDMY(cust.dueDate)})</span>
          <button type="button" class="btn-due-action" onclick="openSetDueDateModal('${cust.id}')" title="Change Payment Due Date"><i class="ri-pencil-line"></i> Edit</button>
        `;
      } else {
        duePill.innerHTML = `
          <span class="due-badge"><i class="ri-calendar-check-line"></i> Promised Due Date: ${formatDateDMY(cust.dueDate)}</span>
          <button type="button" class="btn-due-action" onclick="openSetDueDateModal('${cust.id}')" title="Change Payment Due Date"><i class="ri-pencil-line"></i> Edit</button>
        `;
      }
    } else if (balInfo.status === 'receive') {
      duePill.style.display = 'inline-block';
      duePill.innerHTML = `
        <button type="button" class="btn-set-due-date" onclick="openSetDueDateModal('${cust.id}')" title="Set Payment Due Date">
          <i class="ri-calendar-event-line"></i> + Set Payment Due Date
        </button>
      `;
    } else {
      duePill.style.display = 'none';
    }
  }

  // Transactions list
  const listContainer = document.getElementById('detailTransactionList');
  const countSpan = document.getElementById('detailTxnCount');
  const custTxns = Array.isArray(cust.transactions) ? cust.transactions : [];
  if (countSpan) countSpan.textContent = `${custTxns.length} Entries`;

  if (custTxns.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 40px 16px; color: var(--text-muted);">
        <i class="ri-file-list-3-line" style="font-size: 32px; display:block; margin-bottom:8px;"></i>
        No entries recorded yet.<br>Click "YOU GAVE ₹" or "YOU GOT ₹" to add an entry.
      </div>
    `;
    return;
  }

  listContainer.innerHTML = custTxns.map(t => {
    const isGave = t.type === 'give';
    return `
      <div class="txn-row">
        <div class="txn-row-left">
          <div class="txn-icon ${isGave ? 'icon-gave' : 'icon-got'}">
            <i class="${isGave ? 'ri-arrow-up-line' : 'ri-arrow-down-line'}"></i>
          </div>
          <div>
            <div class="txn-desc-title">
              ${escapeHTML(t.note || (isGave ? 'You Gave' : 'You Got'))}
              ${t.billPhoto ? `<button type="button" class="txn-bill-badge" onclick="event.stopPropagation(); openLightbox('${t.id}')"><i class="ri-file-image-line"></i> Bill Photo</button>` : ''}
            </div>
            <div class="txn-time-stamp"><i class="ri-calendar-line"></i> ${formatDateDMY(t.date)}</div>
          </div>
        </div>

        <div class="txn-row-right">
          <div class="txn-row-amount ${isGave ? 'amt-gave' : 'amt-got'}">
            ${isGave ? '-' : '+'} ${formatCurrency(t.amount)}
          </div>
          <button class="txn-del-btn" onclick="deleteTxn('${cust.id}', '${t.id}')" title="Delete Entry">
            <i class="ri-delete-bin-7-line"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Delete Single Transaction Entry
window.deleteTxn = function (customerId, txnId) {
  if (!confirm('Are you sure you want to delete this transaction entry?')) return;
  const cust = customers.find(c => c.id === customerId);
  if (!cust) return;

  cust.transactions = (Array.isArray(cust.transactions) ? cust.transactions : []).filter(t => t.id !== txnId);
  saveData();
  renderDashboard();
  updateCustomerDetailView(cust);
  showToast('Entry deleted', 'info');
};

// WhatsApp Reminder Generator
window.sendWhatsAppReminder = function (customerId) {
  const cust = customers.find(c => c.id === customerId);
  if (!cust) return;

  const balInfo = calculateCustomerBalance(cust);
  const businessName = localStorage.getItem(BUSINESS_NAME_KEY) || 'My Business';

  let message = '';
  if (balInfo.status === 'receive') {
    message = `Dear ${cust.name},\n\nThis is a friendly reminder that an outstanding payment of *₹${balInfo.amount.toLocaleString('en-IN')}* is pending at *${businessName}*.\nKindly settle the dues at your earliest convenience.\n\nThank you!`;
  } else if (balInfo.status === 'pay') {
    message = `Dear ${cust.name},\n\nYou have an advance/credit balance of *₹${balInfo.amount.toLocaleString('en-IN')}* at *${businessName}*.\n\nThank you!`;
  } else {
    message = `Dear ${cust.name},\n\nYour account with *${businessName}* is fully settled (₹0).\nThank you for your business!`;
  }

  const cleanPhone = cust.phone.replace(/\D/g, '');
  window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
};

// Populate Customer Filter inside Report Modal
function populateReportPartySelect() {
  const select = document.getElementById('reportPartySelect');
  if (!select) return;
  const currentVal = select.value || 'all';
  select.innerHTML = '<option value="all">All Customers / Parties</option>' +
    customers.map(c => `<option value="${c.id}">${escapeHTML(c.name)} (+91 ${escapeHTML(c.phone)})</option>`).join('');
  if ([...select.options].some(o => o.value === currentVal)) {
    select.value = currentVal;
  }
}

// Render Complete Digital Ledger Report (Transactions & Balances)
function renderLedgerReport() {
  const partyFilter = document.getElementById('reportPartySelect')?.value || 'all';
  const businessName = localStorage.getItem(BUSINESS_NAME_KEY) || 'My Business';
  document.getElementById('reportBusinessTitle').textContent = `${businessName} - Digital Ledger Report`;
  const now = new Date();
  document.getElementById('reportDateTime').textContent = `Generated on: ${formatDateDMY(now)} at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

  const activeCustomers = partyFilter === 'all'
    ? customers
    : customers.filter(c => c.id === partyFilter);

  // Compute KPI totals
  let totalRec = 0;
  let totalPay = 0;

  activeCustomers.forEach(c => {
    const balInfo = calculateCustomerBalance(c);
    if (balInfo.status === 'receive') totalRec += balInfo.amount;
    if (balInfo.status === 'pay') totalPay += balInfo.amount;
  });

  const netBal = totalRec - totalPay;
  document.getElementById('repTotalReceive').textContent = formatCurrency(totalRec);
  document.getElementById('repTotalPay').textContent = formatCurrency(totalPay);
  document.getElementById('repNetBalance').textContent = formatCurrency(Math.abs(netBal));
  document.getElementById('repNetBalance').style.color = netBal >= 0 ? '#059669' : '#dc2626';

  // 1. Gather all transactions
  const allTxns = [];
  activeCustomers.forEach(c => {
    (c.transactions || []).forEach(t => {
      allTxns.push({
        ...t,
        customerId: c.id,
        customerName: c.name,
        customerPhone: c.phone
      });
    });
  });

  allTxns.sort((a, b) => new Date(a.date) - new Date(b.date));
  document.getElementById('repTotalEntries').textContent = allTxns.length;

  // Render Table 1: Detailed Transactions
  const txnTbody = document.getElementById('reportTxnTableBody');
  if (txnTbody) {
    if (allTxns.length === 0) {
      txnTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--text-muted);">No transaction entries found for selected customer(s).</td></tr>`;
    } else {
      let runningBal = 0;
      txnTbody.innerHTML = allTxns.map((t, idx) => {
        const isGave = t.type === 'give';
        const amt = Number(t.amount) || 0;
        if (isGave) {
          runningBal += amt;
        } else {
          runningBal -= amt;
        }

        let balDisplay = '';
        if (runningBal > 0) {
          balDisplay = `${formatCurrency(runningBal)} (Dr)`;
        } else if (runningBal < 0) {
          balDisplay = `${formatCurrency(Math.abs(runningBal))} (Cr)`;
        } else {
          balDisplay = '₹ 0';
        }

        return `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${escapeHTML(formatDateDMY(t.date))}</strong></td>
            <td>
              <strong>${escapeHTML(t.customerName)}</strong>
              <div style="font-size:11px; color:var(--text-muted);">+91 ${escapeHTML(t.customerPhone)}</div>
            </td>
            <td>${escapeHTML(t.note || (isGave ? 'You Gave' : 'You Got'))}</td>
            <td style="text-align: right; color: #dc2626; font-weight: 600;">${isGave ? formatCurrency(amt) : '-'}</td>
            <td style="text-align: right; color: #059669; font-weight: 600;">${!isGave ? formatCurrency(amt) : '-'}</td>
            <td style="text-align: right; font-weight: 700;">${balDisplay}</td>
          </tr>
        `;
      }).join('');
    }
  }

  // Render Table 2: Customer Summary
  const summaryTbody = document.getElementById('reportTableBody');
  if (summaryTbody) {
    if (activeCustomers.length === 0) {
      summaryTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--text-muted);">No records found</td></tr>`;
    } else {
      summaryTbody.innerHTML = activeCustomers.map((c, i) => {
        const balInfo = calculateCustomerBalance(c);
        let statusText = 'Settled (₹0)';
        let colorStyle = '#475569';
        if (balInfo.status === 'receive') {
          statusText = 'You\'ll Get';
          colorStyle = '#059669';
        } else if (balInfo.status === 'pay') {
          statusText = 'You\'ll Give';
          colorStyle = '#dc2626';
        }

        return `
          <tr>
            <td>${i + 1}</td>
            <td><strong>${escapeHTML(c.name)}</strong></td>
            <td>+91 ${escapeHTML(c.phone)}</td>
            <td>${escapeHTML(c.partyType || 'Customer')}</td>
            <td><span style="font-weight:600; color:${colorStyle};">${statusText}</span></td>
            <td style="text-align: right; font-weight:700; color:${colorStyle};">${formatCurrency(balInfo.amount)}</td>
          </tr>
        `;
      }).join('');
    }
  }
}

// Prepare Printable Statement for Overall / Filtered General Ledger
function prepareGeneralLedgerPrintable() {
  const partyFilter = document.getElementById('reportPartySelect')?.value || 'all';
  const businessName = localStorage.getItem(BUSINESS_NAME_KEY) || 'My Business';
  const now = new Date();

  document.getElementById('printLedgerBusinessTitle').textContent = businessName;
  document.getElementById('printLedgerGeneratedDate').textContent = `Statement Date: ${formatDateDMY(now)}`;

  const activeCustomers = partyFilter === 'all'
    ? customers
    : customers.filter(c => c.id === partyFilter);

  const scopeLabel = partyFilter === 'all'
    ? 'All Customers / Parties'
    : (activeCustomers[0] ? `${activeCustomers[0].name} (+91 ${activeCustomers[0].phone})` : 'Selected Customer');

  document.getElementById('printLedgerFilterScope').textContent = `Scope: ${scopeLabel}`;
  document.getElementById('printLedgerScopeLabel').textContent = scopeLabel;

  const allTxns = [];
  let totalGave = 0;
  let totalGot = 0;

  activeCustomers.forEach(c => {
    (c.transactions || []).forEach(t => {
      allTxns.push({
        ...t,
        customerName: c.name,
        customerPhone: c.phone
      });
    });
  });

  allTxns.sort((a, b) => new Date(a.date) - new Date(b.date));

  const tbody = document.getElementById('printLedgerTableBody');
  if (allTxns.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color:#64748b;">No transactions found for the selected scope.</td></tr>`;
    document.getElementById('printLedgerTotalGave').textContent = '₹ 0';
    document.getElementById('printLedgerTotalGot').textContent = '₹ 0';
    document.getElementById('printLedgerNetBalance').textContent = '₹ 0';
    document.getElementById('printLedgerFooterGave').textContent = '₹ 0';
    document.getElementById('printLedgerFooterGot').textContent = '₹ 0';
    document.getElementById('printLedgerFooterNet').textContent = '₹ 0';
    return;
  }

  let runningBal = 0;
  tbody.innerHTML = allTxns.map((t, idx) => {
    const isGave = t.type === 'give';
    const amt = Number(t.amount) || 0;
    if (isGave) {
      totalGave += amt;
      runningBal += amt;
    } else {
      totalGot += amt;
      runningBal -= amt;
    }

    let balDisplay = '';
    if (runningBal > 0) {
      balDisplay = `${formatCurrency(runningBal)} (Dr)`;
    } else if (runningBal < 0) {
      balDisplay = `${formatCurrency(Math.abs(runningBal))} (Cr)`;
    } else {
      balDisplay = '₹ 0';
    }

    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${escapeHTML(formatDateDMY(t.date))}</td>
        <td><strong>${escapeHTML(t.customerName)}</strong></td>
        <td>${escapeHTML(t.note || (isGave ? 'You Gave' : 'You Got'))}</td>
        <td style="text-align: right; color: #dc2626; font-weight: 600;">${isGave ? formatCurrency(amt) : '-'}</td>
        <td style="text-align: right; color: #059669; font-weight: 600;">${!isGave ? formatCurrency(amt) : '-'}</td>
        <td style="text-align: right; font-weight: 700;">${balDisplay}</td>
      </tr>
    `;
  }).join('');

  const netBal = totalGave - totalGot;
  let netText = formatCurrency(Math.abs(netBal));
  if (netBal > 0) netText += ' (You\'ll Get)';
  else if (netBal < 0) netText += ' (You\'ll Give)';
  else netText += ' (Settled)';

  document.getElementById('printLedgerTotalGave').textContent = formatCurrency(totalGave);
  document.getElementById('printLedgerTotalGot').textContent = formatCurrency(totalGot);
  document.getElementById('printLedgerNetBalance').textContent = netText;

  document.getElementById('printLedgerFooterGave').textContent = formatCurrency(totalGave);
  document.getElementById('printLedgerFooterGot').textContent = formatCurrency(totalGot);
  document.getElementById('printLedgerFooterNet').textContent = netText;
}

// Toast System
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = 'ri-information-line';
  if (type === 'success') icon = 'ri-checkbox-circle-line';
  if (type === 'danger') icon = 'ri-error-warning-line';

  toast.innerHTML = `<i class="${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Utility: HTML Sanitizer
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// ==========================================================================
// ADVANCED FEATURE IMPLEMENTATIONS
// ==========================================================================

// 1. THEME SWITCHER (Dark OLED & Neon vs Light)
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
  updateThemeIcon();
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-theme');
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  updateThemeIcon();
  showToast(isDark ? 'Dark Mode activated' : 'Light Mode activated', 'info');
  // Re-render chart if active
  if (window.location.hash === '#analytics') renderAnalyticsPage();
}

function updateThemeIcon() {
  const icon = document.getElementById('themeToggleIcon');
  if (icon) {
    const isDark = document.body.classList.contains('dark-theme');
    icon.className = isDark ? 'ri-sun-line' : 'ri-moon-line';
  }
}

// 2. MULTI-LANGUAGE SYSTEM (Gujarati / Hindi / English)
const I18N = {
  en: {
    dashboard: "Dashboard",
    customers: "Customers / Parties",
    analytics: "Financial Analytics",
    ledgerReport: "Ledger Report",
    syncBackup: "Sync & Backup",
    lockApp: "Lock App",
    searchPlaceholder: "Search customer by name or phone...",
    lock: "Lock",
    report: "Report",
    addCustomer: "Add Customer",
    youllGet: "YOU'LL GET",
    youllGetSub: "To collect from customers",
    youllGive: "YOU'LL GIVE",
    youllGiveSub: "To pay out / advance",
    netBalance: "NET BALANCE",
    totalCustomers: "TOTAL CUSTOMERS",
    all: "All",
    filterReceive: "You'll Get",
    filterPay: "You'll Give",
    filterOverdue: "Overdue / Due",
    mostRecent: "Most Recent",
    highestAmount: "Highest Amount",
    lowestAmount: "Lowest Amount",
    nameAsc: "Name (A to Z)"
  },
  gu: {
    dashboard: "ડેશબોર્ડ",
    customers: "ગ્રાહકો / ખાતાવહી",
    analytics: "હિસાબી વિશ્લેષણ",
    ledgerReport: "લેજર રિપોર્ટ",
    syncBackup: "બેકઅપ & સિંક",
    lockApp: "એપ લોક કરો",
    searchPlaceholder: "નામ અથવા મોબાઇલથી ગ્રાહક શોધો...",
    lock: "લોક",
    report: "રિપોર્ટ",
    addCustomer: "નવો ગ્રાહક",
    youllGet: "તમારે લેવાના",
    youllGetSub: "ગ્રાહકો પાસેથી ઉઘરાણી",
    youllGive: "તમારે આપવાના",
    youllGiveSub: "ચૂકવવાના / એડવાન્સ",
    netBalance: "કુલ બાકી હિસાબ",
    totalCustomers: "કુલ ગ્રાહકો",
    all: "બધા",
    filterReceive: "લેવાના",
    filterPay: "આપવાના",
    filterOverdue: "ઉઘરાણી બાકી",
    mostRecent: "તાજેતરના",
    highestAmount: "સૌથી વધુ રકમ",
    lowestAmount: "સૌથી ઓછી રકમ",
    nameAsc: "નામ (A to Z)"
  },
  hi: {
    dashboard: "डैशबोर्ड",
    customers: "ग्राहक / पार्टी",
    analytics: "वित्तीय विश्लेषण",
    ledgerReport: "खाता रिपोर्ट",
    syncBackup: "बैकअप और सिंक",
    lockApp: "ऐप लॉक करें",
    searchPlaceholder: "नाम या मोबाइल से ग्राहक खोजें...",
    lock: "लॉक",
    report: "रिपोर्ट",
    addCustomer: "नया ग्राहक",
    youllGet: "आपको मिलेंगे",
    youllGetSub: "ग्राहकों से वसूली",
    youllGive: "आपको देने हैं",
    youllGiveSub: "भुगतान / एडवांस",
    netBalance: "कुल बकाया राशि",
    totalCustomers: "कुल ग्राहक",
    all: "सभी",
    filterReceive: "मिलने वाले",
    filterPay: "देने वाले",
    filterOverdue: "बकाया अवधि",
    mostRecent: "हाल के",
    highestAmount: "सर्वाधिक राशि",
    lowestAmount: "न्यूनतम राशि",
    nameAsc: "नाम (A to Z)"
  }
};

function initLanguage() {
  currentLang = localStorage.getItem(LANG_KEY) || 'en';
  const select = document.getElementById('langSelect');
  if (select) select.value = currentLang;
  applyLanguage(currentLang);
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem(LANG_KEY, lang);
  applyLanguage(lang);
  showToast(lang === 'gu' ? 'Language: Gujarati' : (lang === 'hi' ? 'Language: Hindi' : 'Language: English'), 'info');
}

function applyLanguage(lang) {
  const dict = I18N[lang] || I18N.en;

  const searchInput = document.getElementById('globalSearchInput');
  if (searchInput) searchInput.placeholder = dict.searchPlaceholder;

  // Navigation Items
  const navDash = document.querySelector('#navDashboardBtn span');
  if (navDash) navDash.textContent = dict.dashboard;
  const navCust = document.querySelector('#navCustomersBtn span');
  if (navCust) navCust.textContent = dict.customers;
  const navAn = document.querySelector('#navAnalyticsBtn span');
  if (navAn) navAn.textContent = dict.analytics;
  const navRep = document.querySelector('#navReportBtn span');
  if (navRep) navRep.textContent = dict.ledgerReport;
  const navBack = document.querySelector('#navBackupBtn span');
  if (navBack) navBack.textContent = dict.syncBackup;
  const navLock = document.querySelector('#navLockBtn span');
  if (navLock) navLock.textContent = dict.lockApp;

  // Header buttons
  const lockHeader = document.querySelector('#lockAppHeaderBtn span');
  if (lockHeader) lockHeader.textContent = dict.lock;
  const repHeader = document.querySelector('#downloadReportBtn span');
  if (repHeader) repHeader.textContent = dict.report;
  const addHeader = document.querySelector('#openAddCustomerFlowBtn span');
  if (addHeader) addHeader.textContent = dict.addCustomer;

  // KPI labels
  const yg = document.querySelector('.stat-receive .stat-title');
  if (yg) yg.textContent = dict.youllGet;
  const ygs = document.querySelector('.stat-receive .stat-sub');
  if (ygs) ygs.innerHTML = `<i class="ri-checkbox-circle-fill"></i> ${dict.youllGetSub}`;

  const yv = document.querySelector('.stat-pay .stat-title');
  if (yv) yv.textContent = dict.youllGive;
  const yvs = document.querySelector('.stat-pay .stat-sub');
  if (yvs) yvs.innerHTML = `<i class="ri-time-fill"></i> ${dict.youllGiveSub}`;

  const nb = document.querySelector('.stat-net .stat-title');
  if (nb) nb.textContent = dict.netBalance;

  const tc = document.querySelector('.stat-customers .stat-title');
  if (tc) tc.textContent = dict.totalCustomers;
}

// 3. BILL / RECEIPT PHOTO UPLOAD & LIGHTBOX
function initBillUpload() {
  const triggerBtn = document.getElementById('triggerBillUploadBtn');
  const fileInput = document.getElementById('txnBillPhotoInput');
  const previewWrap = document.getElementById('billPreviewWrap');
  const previewImg = document.getElementById('billPreviewImg');
  const removeBtn = document.getElementById('removeBillBtn');

  if (triggerBtn && fileInput) {
    triggerBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Compress and scale down to keep storage lightweight
      const reader = new FileReader();
      reader.onload = (re) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 800;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          currentAttachedBillPhoto = canvas.toDataURL('image/jpeg', 0.75);
          if (previewImg) previewImg.src = currentAttachedBillPhoto;
          if (previewWrap) previewWrap.style.display = 'inline-block';
        };
        img.src = re.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      currentAttachedBillPhoto = null;
      if (fileInput) fileInput.value = '';
      if (previewWrap) previewWrap.style.display = 'none';
      if (previewImg) previewImg.src = '';
    });
  }

  // Lightbox close
  const closeLightboxBtn = document.getElementById('closeLightboxBtn');
  const lightboxModal = document.getElementById('billLightboxModal');
  if (closeLightboxBtn && lightboxModal) {
    closeLightboxBtn.addEventListener('click', () => lightboxModal.classList.remove('active'));
    lightboxModal.addEventListener('click', (e) => {
      if (e.target === lightboxModal) lightboxModal.classList.remove('active');
    });
  }
}

window.openLightbox = function (txnId) {
  let photo = null;
  for (const c of customers) {
    const t = (c.transactions || []).find(x => x.id === txnId);
    if (t && t.billPhoto) {
      photo = t.billPhoto;
      break;
    }
  }
  if (!photo) return;

  const modal = document.getElementById('billLightboxModal');
  const img = document.getElementById('lightboxImg');
  const dl = document.getElementById('lightboxDownloadBtn');
  if (img) img.src = photo;
  if (dl) dl.href = photo;
  if (modal) modal.classList.add('active');
};

// 4. BUSINESS & PAYMENT QR SETTINGS MODAL
function openBusinessSettingsModal() {
  const modal = document.getElementById('businessSettingsModal');
  const nameInput = document.getElementById('settingBusinessName');
  const phoneInput = document.getElementById('settingPhone');
  const addrInput = document.getElementById('settingAddress');

  if (nameInput) nameInput.value = localStorage.getItem(BUSINESS_NAME_KEY) || 'My Business';
  if (phoneInput) phoneInput.value = localStorage.getItem(BIZ_PHONE_KEY) || '';
  if (addrInput) addrInput.value = localStorage.getItem(BIZ_ADDR_KEY) || '';

  const savedQr = localStorage.getItem(QR_IMAGE_KEY);
  const previewWrap = document.getElementById('settingQrPreviewWrap');
  const previewImg = document.getElementById('settingQrPreviewImg');
  if (savedQr && previewWrap && previewImg) {
    previewImg.src = savedQr;
    previewWrap.style.display = 'inline-block';
  } else if (previewWrap) {
    previewWrap.style.display = 'none';
  }

  if (modal) modal.classList.add('active');
}

function initBusinessSettings() {
  const modal = document.getElementById('businessSettingsModal');
  const closeBtn = document.getElementById('closeSettingsModalBtn');
  const form = document.getElementById('businessSettingsForm');
  const triggerQrBtn = document.getElementById('triggerSettingQrUploadBtn');
  const fileInput = document.getElementById('settingQrFileInput');
  const previewWrap = document.getElementById('settingQrPreviewWrap');
  const previewImg = document.getElementById('settingQrPreviewImg');
  const removeBtn = document.getElementById('removeSettingQrBtn');

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }

  if (triggerQrBtn && fileInput) {
    triggerQrBtn.addEventListener('click', () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      processQrImageFile(file, (dataUrl) => {
        localStorage.setItem(QR_IMAGE_KEY, dataUrl);
        if (previewImg) previewImg.src = dataUrl;
        if (previewWrap) previewWrap.style.display = 'inline-block';
        showToast('Payment QR Code image uploaded!', 'success');
        fileInput.value = '';
      });
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      localStorage.removeItem(QR_IMAGE_KEY);
      if (previewWrap) previewWrap.style.display = 'none';
      if (previewImg) previewImg.src = '';
      showToast('Payment QR Code image removed', 'info');
    });
  }

  if (form && modal) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('settingBusinessName').value.trim();
      const phone = document.getElementById('settingPhone').value.trim();
      const addr = document.getElementById('settingAddress').value.trim();

      const activeBiz = getActiveBusiness();
      if (activeBiz) {
        if (name) activeBiz.name = name;
        activeBiz.phone = phone;
        activeBiz.address = addr;
        activeBiz.qrImage = localStorage.getItem(QR_IMAGE_KEY) || '';
        saveBusinessesList();
        updateActiveBusinessUI();
      }

      modal.classList.remove('active');
      showToast('Settings saved successfully!', 'success');
    });
  }
}

// 5. PAYMENT QR CODE MODAL (Custom QR Code Image Upload)
window.openUpiQrModal = function (customerId) {
  const cust = customers.find(c => c.id === customerId);
  if (!cust) return;

  const balInfo = calculateCustomerBalance(cust);
  const amount = balInfo.status === 'receive' ? balInfo.amount : 0;

  document.getElementById('upiCustomerName').textContent = cust.name;
  document.getElementById('upiAmountDisplay').textContent = formatCurrency(amount);

  renderModalQrDisplay();

  const modal = document.getElementById('upiQrModal');
  if (modal) modal.classList.add('active');
};

function renderModalQrDisplay() {
  const savedQr = localStorage.getItem(QR_IMAGE_KEY);
  const customImg = document.getElementById('customQrDisplayImg');
  const placeholder = document.getElementById('noQrPlaceholder');
  const removeBtn = document.getElementById('removeQrBtn');
  const hint = document.getElementById('qrScanHint');

  if (savedQr) {
    if (customImg) {
      customImg.src = savedQr;
      customImg.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
    if (removeBtn) removeBtn.style.display = 'inline-flex';
    if (hint) hint.textContent = 'Scan this QR code with any UPI app to pay directly';
  } else {
    if (customImg) customImg.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
    if (removeBtn) removeBtn.style.display = 'none';
    if (hint) hint.textContent = 'Upload your QR code image so customers can scan and pay';
  }
}

function processQrImageFile(file, callback) {
  const reader = new FileReader();
  reader.onload = (re) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 800;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/jpeg', 0.85);
      callback(compressed);
    };
    img.src = re.target.result;
  };
  reader.readAsDataURL(file);
}

function initUpiModalControls() {
  const closeBtn = document.getElementById('closeUpiQrBtn');
  const modal = document.getElementById('upiQrModal');
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }

  const uploadBtn = document.getElementById('uploadQrModalBtn');
  const placeholderUploadBtn = document.getElementById('placeholderUploadQrBtn');
  const fileInput = document.getElementById('modalQrFileInput');
  const removeQrBtn = document.getElementById('removeQrBtn');

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());
  }
  if (placeholderUploadBtn && fileInput) {
    placeholderUploadBtn.addEventListener('click', () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      processQrImageFile(file, (dataUrl) => {
        localStorage.setItem(QR_IMAGE_KEY, dataUrl);
        renderModalQrDisplay();
        showToast('QR Code image uploaded successfully!', 'success');
        fileInput.value = '';
      });
    });
  }

  if (removeQrBtn) {
    removeQrBtn.addEventListener('click', () => {
      localStorage.removeItem(QR_IMAGE_KEY);
      renderModalQrDisplay();
      showToast('QR Code image removed', 'info');
    });
  }
}

// 6. SMART WHATSAPP REMINDER MODAL
window.openWhatsappModal = function (customerId) {
  const cust = customers.find(c => c.id === customerId);
  if (!cust) return;
  waSelectedCustomer = cust;

  const balInfo = calculateCustomerBalance(cust);
  document.getElementById('waRecipientName').textContent = cust.name;
  document.getElementById('waRecipientPhone').textContent = `+91 ${cust.phone}`;
  document.getElementById('waRecipientAvatar').textContent = getInitials(cust.name);
  document.getElementById('waBalancePill').textContent = formatCurrency(balInfo.amount);

  updateWhatsappMessage();

  const modal = document.getElementById('whatsappReminderModal');
  if (modal) modal.classList.add('active');
};

function updateWhatsappMessage() {
  if (!waSelectedCustomer) return;
  const cust = waSelectedCustomer;
  const balInfo = calculateCustomerBalance(cust);
  const bizName = localStorage.getItem(BUSINESS_NAME_KEY) || 'My Business';

  const langRadio = document.querySelector('input[name="waTemplateLang"]:checked');
  const lang = langRadio ? langRadio.value : 'gu';

  let msg = '';
  if (lang === 'gu') {
    msg = `નમસ્તે ${cust.name},\n\n${bizName} માંથી તમારો હિસાબ:\nકુલ બાકી રકમ: ₹${balInfo.amount}\n\nકૃપા કરીને આ રકમ શક્ય તેટલી વહેલી તકે ચૂકવી આપશો.\nતમે અમારા QR કોડ પર સ્કેન કરીને પણ પેમેન્ટ કરી શકો છો.\nઆભાર,\n${bizName}`;
  } else if (lang === 'hi') {
    msg = `नमस्ते ${cust.name},\n\n${bizName} से भुगतान अनुस्मारक:\nकुल बकाया राशि: ₹${balInfo.amount}\n\nकृपया जल्द से जल्द बकाया राशि का भुगतान करें।\nआप हमारे QR कोड को स्कैन करके भी भुगतान कर सकते हैं।\nधन्यवाद,\n${bizName}`;
  } else {
    msg = `Hello ${cust.name},\n\nPayment Reminder from ${bizName}:\nOutstanding Balance: ₹${balInfo.amount}\n\nPlease clear the pending amount at your earliest convenience.\nYou can scan our QR code to pay directly.\nThank you,\n${bizName}`;
  }

  const textarea = document.getElementById('waMessageText');
  if (textarea) textarea.value = msg;
}

function initWhatsappModalControls() {
  const closeBtn = document.getElementById('closeWhatsappModalBtn');
  const modal = document.getElementById('whatsappReminderModal');
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }

  const langRadios = document.querySelectorAll('input[name="waTemplateLang"]');
  langRadios.forEach(r => r.addEventListener('change', updateWhatsappMessage));

  const copyBtn = document.getElementById('waCopyMsgBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const text = document.getElementById('waMessageText').value;
      navigator.clipboard.writeText(text).then(() => showToast('Message copied to clipboard!', 'success'));
    });
  }

  const sendBtn = document.getElementById('waSendBtn');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      if (!waSelectedCustomer) return;
      const text = document.getElementById('waMessageText').value;
      const cleanPhone = waSelectedCustomer.phone.replace(/[^0-9]/g, '');
      const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
      if (modal) modal.classList.remove('active');
    });
  }
}

// 7. FINANCIAL ANALYTICS & CASHFLOW CHART
function renderAnalyticsPage() {
  let totalRec = 0;
  let totalGive = 0;
  let overdueBal = 0;
  let overdueCount = 0;
  const todayStr = new Date().toISOString().split('T')[0];

  const pendingDebtors = [];

  customers.forEach(c => {
    const balInfo = calculateCustomerBalance(c);
    (c.transactions || []).forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'receive') totalRec += amt;
      if (t.type === 'give') totalGive += amt;
    });

    if (balInfo.status === 'receive' && balInfo.amount > 0) {
      pendingDebtors.push({ customer: c, balance: balInfo.amount });
      if (c.dueDate && c.dueDate <= todayStr) {
        overdueBal += balInfo.amount;
        overdueCount++;
      }
    }
  });

  document.getElementById('analyticsTotalGot').textContent = formatCurrency(totalRec);
  document.getElementById('analyticsTotalGave').textContent = formatCurrency(totalGive);
  document.getElementById('analyticsTotalOverdue').textContent = formatCurrency(overdueBal);
  document.getElementById('analyticsOverdueCount').textContent = overdueCount;

  // Recovery Rate %
  const totalTurnover = totalRec + totalGive;
  const rate = totalTurnover > 0 ? Math.round((totalRec / totalTurnover) * 100) : 0;
  document.getElementById('analyticsRecoveryRate').textContent = `${rate}%`;
  document.getElementById('analyticsRecoveryFill').style.width = `${rate}%`;

  // Render Top Pending Debtors
  pendingDebtors.sort((a, b) => b.balance - a.balance);
  const debtorList = document.getElementById('analyticsTopDebtorsList');
  if (debtorList) {
    if (pendingDebtors.length === 0) {
      debtorList.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);">No pending debtors. All settled!</div>`;
    } else {
      debtorList.innerHTML = pendingDebtors.slice(0, 6).map(item => `
        <div class="debtor-row">
          <div class="debtor-left">
            <div class="debtor-avatar">${getInitials(item.customer.name)}</div>
            <div class="debtor-info">
              <strong>${escapeHTML(item.customer.name)}</strong>
              <small>+91 ${escapeHTML(item.customer.phone)}</small>
            </div>
          </div>
          <div class="debtor-right">
            <div class="debtor-amount">${formatCurrency(item.balance)}</div>
            <button type="button" class="btn-debtor-remind" onclick="openWhatsappModal('${item.customer.id}')" title="Send WhatsApp Reminder">
              <i class="ri-whatsapp-line"></i>
            </button>
          </div>
        </div>
      `).join('');
    }
  }

  // Draw 7-Day Cashflow Canvas Chart
  drawCashflowChart();
}

function drawCashflowChart() {
  const canvas = document.getElementById('cashflowCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || 500;
  const height = 260;

  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  ctx.clearRect(0, 0, width, height);

  // Calculate past 7 days
  const days = [];
  const gotMap = {};
  const gaveMap = {};

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const label = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
    days.push({ dateStr, label });
    gotMap[dateStr] = 0;
    gaveMap[dateStr] = 0;
  }

  customers.forEach(c => {
    (c.transactions || []).forEach(t => {
      if (gotMap[t.date] !== undefined && t.type === 'receive') {
        gotMap[t.date] += Number(t.amount) || 0;
      }
      if (gaveMap[t.date] !== undefined && t.type === 'give') {
        gaveMap[t.date] += Number(t.amount) || 0;
      }
    });
  });

  let maxVal = 100;
  days.forEach(d => {
    maxVal = Math.max(maxVal, gotMap[d.dateStr], gaveMap[d.dateStr]);
  });
  maxVal = Math.ceil(maxVal * 1.2);

  // Background grid lines
  const isDark = document.body.classList.contains('dark-theme');
  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  ctx.lineWidth = 1;

  const chartTop = 20;
  const chartBottom = height - 40;
  const chartHeight = chartBottom - chartTop;

  for (let g = 0; g <= 4; g++) {
    const y = chartBottom - (chartHeight * (g / 4));
    ctx.beginPath();
    ctx.moveTo(30, y);
    ctx.lineTo(width - 15, y);
    ctx.stroke();

    ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('₹' + Math.round((maxVal * g) / 4), 26, y + 3);
  }

  // Draw Bars
  const colWidth = (width - 45) / days.length;
  const barW = Math.min(16, colWidth * 0.35);

  days.forEach((d, idx) => {
    const centerX = 40 + (idx * colWidth) + (colWidth / 2);

    const gotH = (gotMap[d.dateStr] / maxVal) * chartHeight;
    const gaveH = (gaveMap[d.dateStr] / maxVal) * chartHeight;

    // Got Bar (Green)
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    const gotX = centerX - barW - 2;
    const gotY = chartBottom - gotH;
    ctx.roundRect(gotX, gotY, barW, Math.max(2, gotH), [4, 4, 0, 0]);
    ctx.fill();

    // Gave Bar (Red)
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    const gaveX = centerX + 2;
    const gaveY = chartBottom - gaveH;
    ctx.roundRect(gaveX, gaveY, barW, Math.max(2, gaveH), [4, 4, 0, 0]);
    ctx.fill();

    // X-axis label
    ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.label, centerX, chartBottom + 20);
  });
}

// 8. SET / UPDATE PAYMENT DUE DATE MODAL
let dueDateCustomerId = null;

window.openSetDueDateModal = function (customerId) {
  const cust = customers.find(c => c.id === customerId);
  if (!cust) return;
  dueDateCustomerId = customerId;

  const balInfo = calculateCustomerBalance(cust);
  const avatar = document.getElementById('dueModalAvatar');
  const nameEl = document.getElementById('dueModalCustName');
  const phoneEl = document.getElementById('dueModalCustPhone');
  const balEl = document.getElementById('dueModalBalance');
  const dateInput = document.getElementById('custDueDateInput');

  if (avatar) avatar.textContent = getInitials(cust.name);
  if (nameEl) nameEl.textContent = cust.name;
  if (phoneEl) phoneEl.textContent = `+91 ${cust.phone}`;
  if (balEl) balEl.textContent = formatCurrency(balInfo.amount);

  if (dateInput) {
    dateInput.value = cust.dueDate || new Date().toISOString().split('T')[0];
  }

  // Reset preset button active state
  document.querySelectorAll('.btn-due-preset').forEach(btn => btn.classList.remove('active'));

  const modal = document.getElementById('setDueDateModal');
  if (modal) modal.classList.add('active');
};

function initDueDateModal() {
  const modal = document.getElementById('setDueDateModal');
  const closeBtn = document.getElementById('closeDueDateModalBtn');
  const dateInput = document.getElementById('custDueDateInput');
  const saveBtn = document.getElementById('saveCustDueDateBtn');
  const clearBtn = document.getElementById('clearCustDueDateBtn');
  const presetBtns = document.querySelectorAll('.btn-due-preset');

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const days = parseInt(btn.getAttribute('data-days'), 10) || 0;
      const d = new Date();
      d.setDate(d.getDate() + days);
      if (dateInput) {
        dateInput.value = d.toISOString().split('T')[0];
      }
    });
  });

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (!dueDateCustomerId) return;
      const cust = customers.find(c => c.id === dueDateCustomerId);
      if (!cust) return;

      const newDate = dateInput ? dateInput.value : '';
      if (!newDate) {
        showToast('Please select a valid date', 'danger');
        return;
      }

      cust.dueDate = newDate;
      saveData();
      renderDashboard();
      updateCustomerDetailView(cust);
      if (typeof renderAnalyticsPage === 'function') {
        renderAnalyticsPage();
      }

      if (modal) modal.classList.remove('active');
      showToast(`Payment Due Date set for ${cust.name}!`, 'success');
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (!dueDateCustomerId) return;
      const cust = customers.find(c => c.id === dueDateCustomerId);
      if (!cust) return;

      cust.dueDate = null;
      saveData();
      renderDashboard();
      updateCustomerDetailView(cust);
      if (typeof renderAnalyticsPage === 'function') {
        renderAnalyticsPage();
      }

      if (modal) modal.classList.remove('active');
      showToast('Payment Due Date removed', 'info');
    });
  }
}

// ==========================================================================
// 9. MULTI-BUSINESS & ACCOUNT SWITCHER LOGIC (Office, Home, etc.)
// ==========================================================================
window.openSwitchBusinessModal = function () {
  if (typeof window.closeMobileSidebar === 'function') {
    window.closeMobileSidebar();
  }
  renderSwitchBusinessList();
  const modal = document.getElementById('switchBusinessModal');
  const addForm = document.getElementById('addNewBizForm');
  if (addForm) {
    addForm.style.display = 'none';
    addForm.reset();
  }
  if (modal) modal.classList.add('active');
};

function renderSwitchBusinessList() {
  const container = document.getElementById('businessAccountsList');
  if (!container) return;

  container.innerHTML = businessAccounts.map(biz => {
    const isActive = biz.id === activeBusinessId;
    const isHome = biz.type === 'Home' || biz.name.toLowerCase().includes('home');
    const avatarIcon = isHome ? 'ri-home-4-line' : 'ri-store-2-line';
    const avatarClass = isHome ? 'biz-avatar-home' : 'biz-avatar-office';

    // Get party count and net balance for this business
    let bizCustomers = [];
    if (isActive) {
      bizCustomers = customers;
    } else {
      const stored = localStorage.getItem(getStorageKeyForBusiness(biz.id));
      if (stored) {
        try { bizCustomers = JSON.parse(stored) || []; } catch (e) { bizCustomers = []; }
      }
    }

    let netBal = 0;
    bizCustomers.forEach(c => {
      const b = calculateCustomerBalance(c);
      if (b.status === 'receive') netBal += b.amount;
      else if (b.status === 'pay') netBal -= b.amount;
    });

    let netStr = 'Settled (₹0)';
    if (netBal > 0) {
      netStr = `${formatCurrency(netBal)} (To Get)`;
    } else if (netBal < 0) {
      netStr = `${formatCurrency(Math.abs(netBal))} (To Give)`;
    }

    return `
      <div class="biz-account-item ${isActive ? 'active' : ''}" onclick="switchActiveBusiness('${biz.id}')">
        <div class="biz-item-avatar ${avatarClass}">
          <i class="${avatarIcon}"></i>
        </div>
        <div class="biz-item-info">
          <div class="biz-item-name">
            ${escapeHTML(biz.name)}
            ${isActive ? '<span class="biz-active-badge"><i class="ri-check-line"></i> Active</span>' : ''}
          </div>
          <div class="biz-item-meta">
            ${bizCustomers.length} ${bizCustomers.length === 1 ? 'Party' : 'Parties'} • ${netStr}
          </div>
        </div>
        <div class="biz-item-actions" onclick="event.stopPropagation()">
          ${businessAccounts.length > 1 ? `
            <button type="button" class="btn-biz-action" onclick="deleteBusinessAccount('${biz.id}', event)" title="Delete Account">
              <i class="ri-delete-bin-line"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

window.switchActiveBusiness = function (targetBizId) {
  if (targetBizId === activeBusinessId) {
    const modal = document.getElementById('switchBusinessModal');
    if (modal) modal.classList.remove('active');
    return;
  }

  // Save current business customers first
  saveData();

  const targetBiz = businessAccounts.find(b => b.id === targetBizId);
  if (!targetBiz) return;

  activeBusinessId = targetBizId;
  saveBusinessesList();

  // Load target customers
  const targetKey = getStorageKeyForBusiness(targetBizId);
  const stored = localStorage.getItem(targetKey);
  if (stored) {
    try {
      customers = JSON.parse(stored);
      if (!Array.isArray(customers)) customers = [];
    } catch (e) {
      customers = [];
    }
  } else {
    customers = [];
    saveData();
  }

  // Sync settings
  localStorage.setItem(BUSINESS_NAME_KEY, targetBiz.name);
  if (targetBiz.phone) localStorage.setItem(BIZ_PHONE_KEY, targetBiz.phone);
  else localStorage.removeItem(BIZ_PHONE_KEY);

  if (targetBiz.address) localStorage.setItem(BIZ_ADDR_KEY, targetBiz.address);
  else localStorage.removeItem(BIZ_ADDR_KEY);

  if (targetBiz.qrImage) localStorage.setItem(QR_IMAGE_KEY, targetBiz.qrImage);
  else localStorage.removeItem(QR_IMAGE_KEY);

  updateActiveBusinessUI();
  renderDashboard();
  if (typeof renderCustomersPageView === 'function') {
    renderCustomersPageView();
  }
  if (typeof renderAnalyticsPage === 'function') {
    renderAnalyticsPage();
  }

  const modal = document.getElementById('switchBusinessModal');
  if (modal) modal.classList.remove('active');

  showToast(`Switched to "${targetBiz.name}" account!`, 'success');
};

window.createNewBusinessAccount = function (name, type) {
  const cleanName = (name || '').trim();
  if (!cleanName) {
    showToast('Please enter an account name', 'danger');
    return;
  }

  const newId = 'biz_' + Date.now();
  const newBiz = {
    id: newId,
    name: cleanName,
    type: type || 'Home',
    phone: '',
    address: '',
    qrImage: '',
    createdAt: new Date().toISOString()
  };

  businessAccounts.push(newBiz);
  saveBusinessesList();

  // Initialize empty customers for this new account
  localStorage.setItem(getStorageKeyForBusiness(newId), JSON.stringify([]));

  // Switch to the newly created account immediately
  switchActiveBusiness(newId);

  const modal = document.getElementById('switchBusinessModal');
  if (modal) modal.classList.remove('active');
  showToast(`Created and switched to "${cleanName}"!`, 'success');
};

window.deleteBusinessAccount = function (bizId, event) {
  if (event) event.stopPropagation();
  if (businessAccounts.length <= 1) {
    showToast('You must keep at least one account.', 'danger');
    return;
  }

  const biz = businessAccounts.find(b => b.id === bizId);
  if (!biz) return;

  if (!confirm(`Are you sure you want to delete the "${biz.name}" account and all its ledger entries?`)) {
    return;
  }

  const wasActive = (activeBusinessId === bizId);

  businessAccounts = businessAccounts.filter(b => b.id !== bizId);
  if (wasActive) {
    activeBusinessId = businessAccounts[0].id;
  }
  saveBusinessesList();
  localStorage.removeItem(getStorageKeyForBusiness(bizId));

  if (wasActive) {
    const currentKey = getStorageKeyForBusiness(activeBusinessId);
    const stored = localStorage.getItem(currentKey);
    try {
      customers = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(customers)) customers = [];
    } catch (e) {
      customers = [];
    }
    updateActiveBusinessUI();
    renderDashboard();
    if (typeof renderCustomersPageView === 'function') renderCustomersPageView();
    if (typeof renderAnalyticsPage === 'function') renderAnalyticsPage();
  }

  renderSwitchBusinessList();
  showToast(`Account "${biz.name}" deleted`, 'info');
};

function initSwitchBusinessModal() {
  const modal = document.getElementById('switchBusinessModal');
  const closeBtn = document.getElementById('closeSwitchBusinessBtn');
  const toggleAddBtn = document.getElementById('toggleAddBizBtn');
  const addForm = document.getElementById('addNewBizForm');
  const cancelAddBtn = document.getElementById('cancelAddBizBtn');
  const openSettingsBtn = document.getElementById('openActiveBizSettingsBtn');

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }

  if (toggleAddBtn && addForm) {
    toggleAddBtn.addEventListener('click', () => {
      const isHidden = addForm.style.display === 'none';
      addForm.style.display = isHidden ? 'block' : 'none';
      if (isHidden) {
        setTimeout(() => document.getElementById('newBizNameInput')?.focus(), 100);
      }
    });
  }

  if (cancelAddBtn && addForm) {
    cancelAddBtn.addEventListener('click', () => {
      addForm.style.display = 'none';
      addForm.reset();
    });
  }

  if (addForm) {
    addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('newBizNameInput')?.value;
      const type = document.querySelector('input[name="newBizType"]:checked')?.value || 'Home';
      createNewBusinessAccount(name, type);
      addForm.reset();
      addForm.style.display = 'none';
    });
  }

  if (openSettingsBtn && modal) {
    openSettingsBtn.addEventListener('click', () => {
      modal.classList.remove('active');
      openBusinessSettingsModal();
    });
  }
}

function initAdvancedFeatures() {
  initBillUpload();
  initBusinessSettings();
  initUpiModalControls();
  initWhatsappModalControls();
  initDueDateModal();
  initSwitchBusinessModal();
}

