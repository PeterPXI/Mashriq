/**
 * Mashriq - Landing Page Logic
 * Handles landing page initialization and stats loading
 */

(function() {
  document.addEventListener('DOMContentLoaded', function() {
    // Check auth - redirect if logged in
    if (!MashriqGuards.redirectIfAuthenticated()) {
      return; // Redirecting to services
    }
    
    // Initialize app components
    MashriqApp.init('home');
    
    // Load platform statistics
    loadStats();
  });
  
  /**
   * Load platform statistics from API
   */
  async function loadStats() {
    try {
      var response = await MashriqAPI.get('/stats/overview');
      
      if (response.success && response.stats) {
        animateNumber('stat-users', response.stats.users || 0);
        animateNumber('stat-services', response.stats.services || 0);
        animateNumber('stat-orders', response.stats.orders || 0);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      // Silent fail - stats are not critical
    }
  }
  
  /**
   * Animate number counting effect
   */
  function animateNumber(elementId, targetNumber) {
    var element = document.getElementById(elementId);
    if (!element) return;
    
    targetNumber = parseInt(targetNumber) || 0;
    var duration = 1500;
    var steps = 60;
    var increment = targetNumber / steps;
    var current = 0;
    
    var timer = setInterval(function() {
      current += increment;
      if (current >= targetNumber) {
        current = targetNumber;
        clearInterval(timer);
      }
      element.textContent = Math.floor(current).toLocaleString('ar-EG');
    }, duration / steps);
  }
})();
