const GITHUB_API_URL = 'https://api.github.com';
const headers = {
  'Accept': 'application/vnd.github.v3+json'
};

let allPullRequests = []; 

const CACHE_KEY = 'github_prs_cache';
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes in milliseconds

let hasInitialFetch = false; // Flag to track initial fetch

async function initializeGitHubToken() {
  try {
    const response = await fetch('/api/github-token');
    const data = await response.json();
    headers.Authorization = `token ${data.token}`;
    console.log('GitHub Token:', data.token);  // Debugging: Check if the token is being fetched correctly
  } catch (error) {
    console.error('Error fetching GitHub token:', error);
  }
}

async function fetchPullRequests() {
  try {
    // For first load, try to fetch from API
    if (!hasInitialFetch) {
      if (!headers.Authorization) {
        await initializeGitHubToken();
      }

      const [openResponse, closedResponse] = await Promise.all([
        fetch(`${GITHUB_API_URL}/repos/hans-zanecoder/Github-API/pulls?state=open`, { headers }),
        fetch(`${GITHUB_API_URL}/repos/hans-zanecoder/Github-API/pulls?state=closed`, { headers })
      ]);

      if (!openResponse.ok || !closedResponse.ok) {
        throw new Error('Failed to fetch PRs');
      }

      const openPRs = await openResponse.json();
      const closedPRs = await closedResponse.json();
      
      allPullRequests = [...openPRs, ...closedPRs];
      hasInitialFetch = true; // Mark initial fetch as complete
      
      // Cache the new data
      setCache(allPullRequests);
      
      filterAndDisplayPRs();
      updateCounts(allPullRequests);
      return;
    }

    // After initial fetch, always use cache if available
    const cachedData = getCache();
    if (cachedData) {
      console.log('Using cached pull requests data');
      allPullRequests = cachedData;
      filterAndDisplayPRs();
      updateCounts(allPullRequests);
      return;
    }

    // Only if cache is empty, try API again
    const [openResponse, closedResponse] = await Promise.all([
      fetch(`${GITHUB_API_URL}/repos/hans-zanecoder/Github-API/pulls?state=open`, { headers }),
      fetch(`${GITHUB_API_URL}/repos/hans-zanecoder/Github-API/pulls?state=closed`, { headers })
    ]);

    if (!openResponse.ok || !closedResponse.ok) {
      throw new Error('Failed to fetch PRs');
    }

    const openPRs = await openResponse.json();
    const closedPRs = await closedResponse.json();
    
    allPullRequests = [...openPRs, ...closedPRs];
    setCache(allPullRequests);
    
    filterAndDisplayPRs();
    updateCounts(allPullRequests);
  } catch (error) {
    console.error('Error fetching pull requests:', error);
    
    // If API fetch fails and we have cached data, use it
    const cachedData = getCache();
    if (cachedData) {
      console.log('Using cached data as fallback');
      allPullRequests = cachedData;
      filterAndDisplayPRs();
      updateCounts(allPullRequests);
    } else {
      const prList = document.getElementById('pr-list');
      if (prList) {
        prList.innerHTML = `<div class="p-4 text-red-500">
          Error loading pull requests. Please try again later.
        </div>`;
      }
    }
  }
}

function updatePRList(prs) {
  const prList = document.getElementById('pr-list');
  const template = document.getElementById('pr-template');
  
  // Clear existing content
  prList.innerHTML = '';
  
  // Add new content
  prs.forEach(pr => {
    if (!pr.title || !pr.user) return; // Skip invalid PRs
    
    const clone = template.content.cloneNode(true);
    const titleElement = clone.querySelector('.pr-title');
    const metaElement = clone.querySelector('.pr-meta');
    
    if (titleElement) titleElement.textContent = pr.title;
    if (metaElement) metaElement.textContent = `#${pr.number} opened by ${pr.user.login}`;
    
    prList.appendChild(clone);
  });

  console.log('Displayed Pull Requests:', prs);  // Debugging: Check the displayed PRs
}

function updateCounts(prs) {
  const openCount = document.getElementById('open-count');
  const closedCount = document.getElementById('closed-count');
  
  openCount.textContent = prs.filter(pr => pr.state === 'open').length;
  closedCount.textContent = prs.filter(pr => pr.state === 'closed').length;
}

function filterAndDisplayPRs() {
  const searchInput = document.getElementById('search-input');
  const searchTerm = searchInput.value.toLowerCase();
  const filterBtn = document.getElementById('filters-btn');
  const currentFilter = filterBtn.dataset.currentFilter || 'all';

  let filteredPRs = [...allPullRequests];

  // Filter by state
  if (currentFilter !== 'all') {
    filteredPRs = filteredPRs.filter(pr => {
      if (currentFilter === 'draft') {
        return pr.draft === true;
      }
      return pr.state === currentFilter;
    });
  }

  // Filter by search term
  if (searchTerm) {
    filteredPRs = filteredPRs.filter(pr => {
      return (
        pr.title.toLowerCase().includes(searchTerm) ||
        pr.user.login.toLowerCase().includes(searchTerm) ||
        `#${pr.number}`.includes(searchTerm) ||
        parseSearchQuery(searchTerm, pr)
      );
    });
  }

  updatePRList(filteredPRs);
  updateCounts(filteredPRs);
}

function parseSearchQuery(query, pr) {
  const terms = query.split(' ');
  return terms.every(term => {
    const [key, value] = term.split(':');
    switch (key) {
      case 'is':
        return value === pr.state || (value === 'pr' && pr.pull_request);
      case 'author':
        return pr.user.login.toLowerCase() === value.toLowerCase();
      case 'label':
        return pr.labels.some(label => label.name.toLowerCase() === value.toLowerCase());
      default:
        return true;
    }
  });
}

function updateFilterButton(filter) {
  const filterBtn = document.getElementById('filters-btn');
  const openFilterBtn = document.getElementById('open-filter');
  const closedFilterBtn = document.getElementById('closed-filter');
  
  filterBtn.textContent = `Filters: ${filter.charAt(0).toUpperCase() + filter.slice(1)}`;
  filterBtn.dataset.currentFilter = filter;
  
  // Update button styles
  if (filter === 'open') {
    openFilterBtn.classList.add('bg-github-secondary');
    closedFilterBtn.classList.remove('bg-github-secondary');
  } else if (filter === 'closed') {
    closedFilterBtn.classList.add('bg-github-secondary');
    openFilterBtn.classList.remove('bg-github-secondary');
  }
  
  // Update dropdown button appearance
  document.querySelectorAll('.filter-option').forEach(option => {
    if (option.dataset.filter === filter) {
      option.classList.add('bg-github-border');
    } else {
      option.classList.remove('bg-github-border');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const filtersBtn = document.getElementById('filters-btn');
  const filtersDropdown = document.getElementById('filters-dropdown');
  const searchInput = document.getElementById('search-input');
  const openFilterBtn = document.getElementById('open-filter');
  const closedFilterBtn = document.getElementById('closed-filter');
  
  // Set default filter to 'all' when the page loads
  updateFilterButton('all');

  // Toggle filters dropdown
  filtersBtn.addEventListener('click', () => {
    filtersDropdown.classList.toggle('hidden');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (event) => {
    if (!filtersBtn.contains(event.target) && !filtersDropdown.contains(event.target)) {
      filtersDropdown.classList.add('hidden');
    }
  });

  // Handle filter options
  document.querySelectorAll('.filter-option').forEach(option => {
    option.addEventListener('click', () => {
      const filter = option.dataset.filter;
      updateFilterButton(filter);
      filtersDropdown.classList.add('hidden');
      filterAndDisplayPRs();
    });
  });

  // Handle open/closed filter buttons
  openFilterBtn.addEventListener('click', () => {
    updateFilterButton('open');
    filterAndDisplayPRs();
  });

  closedFilterBtn.addEventListener('click', () => {
    updateFilterButton('closed');
    filterAndDisplayPRs();
  });

  // Handle search with debounce
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filterAndDisplayPRs();
    }, 300);
  });

  // Initial fetch
  fetchPullRequests();
  
  // Refresh cache only every 30 minutes instead of every minute
  setInterval(fetchPullRequests, CACHE_EXPIRY);
});
