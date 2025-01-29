const GITHUB_API_URL = 'https://api.github.com';
export const headers = {
  'Accept': 'application/vnd.github.v3+json'
};

let allPullRequests = []; 

async function initializeGitHubToken() {
  try {
    const response = await fetch('/api/github-token');
    const data = await response.json();
    headers.Authorization = `token ${data.token}`;
  } catch (error) {
    console.error('Error fetching GitHub token:', error);
  }
}

async function fetchPullRequests() {
  try {
    if (!headers.Authorization) {
      await initializeGitHubToken();
    }
    
    // Fetch both open and closed PRs
    const [openResponse, closedResponse] = await Promise.all([
      fetch(`${GITHUB_API_URL}/repos/hans-zanecoder/Github-API/pulls?state=open`, {
        headers
      }),
      fetch(`${GITHUB_API_URL}/repos/hans-zanecoder/Github-API/pulls?state=closed`, {
        headers
      })
    ]);

    const openPRs = await openResponse.json();
    const closedPRs = await closedResponse.json();
    
    // Combine both results
    allPullRequests = [...openPRs, ...closedPRs];
    
    filterAndDisplayPRs();
    updateCounts(allPullRequests);
  } catch (error) {
    console.error('Error fetching pull requests:', error);
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

  let filteredPRs = [...allPullRequests]; // Create a copy of the array

  // Filter by state
  if (currentFilter !== 'all') {
    filteredPRs = filteredPRs.filter(pr => pr.state === currentFilter);
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

document.addEventListener('DOMContentLoaded', () => {
  const filtersBtn = document.getElementById('filters-btn');
  const filtersDropdown = document.getElementById('filters-dropdown');
  const searchInput = document.getElementById('search-input');
  
  // Toggle filters dropdown
  filtersBtn.addEventListener('click', () => {
    filtersDropdown.classList.toggle('hidden');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!filtersBtn.contains(e.target) && !filtersDropdown.contains(e.target)) {
      filtersDropdown.classList.add('hidden');
    }
  });

  // Handle filter options
  document.querySelectorAll('.filter-option').forEach(option => {
    option.addEventListener('click', () => {
      const filter = option.dataset.filter;
      filtersBtn.dataset.currentFilter = filter;
      filtersDropdown.classList.add('hidden');
      filterAndDisplayPRs();
    });
  });

  // Handle search with debounce
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filterAndDisplayPRs();
    }, 300);
  });

  fetchPullRequests();
  setInterval(fetchPullRequests, 60000);
});

export {
  fetchPullRequests,
  updateCounts,
  filterAndDisplayPRs,
  parseSearchQuery
};