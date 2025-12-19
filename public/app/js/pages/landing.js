/**
 * Mashriq - Landing Page Logic
 * Handles landing page initialization and stats loading
 */

import { initPublicPage } from '../guards.js';
import { initApp, showToast } from '../app.js';
import { get } from '../api.js';

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
  // Check if user is authenticated - redirect to services
  if (!initPublicPage()) {
    return; // User is being redirected
  }
  
  // Initialize common app components
  initApp('home');
  
  // Load platform statistics
  await loadStats();
});

/**
 * Load platform statistics from API
 */
async function loadStats() {
  const statsContainer = document.getElementById('stats-container');
  if (!statsContainer) return;
  
  try {
    const response = await get('/stats/overview');
    
    if (response.success && response.stats) {
      const { users, services, orders } = response.stats;
      
      // Update stats with animation
      animateNumber('stat-users', users);
      animateNumber('stat-services', services);
      animateNumber('stat-orders', orders);
    }
  } catch (error) {
    console.error('Error loading stats:', error);
    // Silently fail - stats are not critical
  }
}

/**
 * Animate number counting effect
 * @param {string} elementId 
 * @param {number} targetNumber 
 */
function animateNumber(elementId, targetNumber) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const duration = 1500;
  const steps = 60;
  const increment = targetNumber / steps;
  let current = 0;
  
  const timer = setInterval(() => {
    current += increment;
    if (current >= targetNumber) {
      current = targetNumber;
      clearInterval(timer);
    }
    element.textContent = Math.floor(current).toLocaleString('ar-EG');
  }, duration / steps);
}
