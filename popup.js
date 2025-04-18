let selectedIndex = -1;
let visibleListItems = [];

document.addEventListener('DOMContentLoaded', function () {
  loadSiteList();
  loadFavorites();
  resetVisibleItems(); // Ensure visibleListItems is initialized

  document.getElementById('searchInput').focus();

  // ─── Delete only the siteList, not favorites ─────────────────────
  document.getElementById('deleteButton').addEventListener('click', function () {
    chrome.storage.local.remove(['siteList'], function () {
      console.log('Deleted imported site list, but kept favorites.');
      loadSiteList();
      resetVisibleItems(); // Reinitialize visibleListItems after deletion
      // no need to reload favorites since they didn’t change
    });
  });

  document.getElementById('searchInput').addEventListener('input', function () {
    const searchTerm = this.value.trim();

    if (!searchTerm) {
      resetVisibleItems(); // Reset to show all items when input is cleared
    } else {
      filterList(searchTerm); // Filter items based on search term
    }
  });

  document.getElementById('searchInput').addEventListener('keydown', function (event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      initializeVisibleItemsIfNeeded(); // Ensure visibleListItems is populated
      handleKeyPress(event);
    } else if (event.key === 'Enter') {
      handleEnterKey(); // Trigger action for the selected item
    }
  });

  document.getElementById('importButton').addEventListener('click', function () {
    // allow reimporting same file by clearing previous value
    const input = document.getElementById('csvFileInput');
    input.value = '';
    input.click();
  });

  // ─── Enhanced CSV import: preserve only still‑present favorites ────
  document.getElementById('csvFileInput').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = function () {
      const newSites = parseCSV(reader.result);
      if (newSites.length === 0) {
        console.warn('No valid data found in the CSV file.');
        return;
      }

      // 1️⃣ Grab existing favorites
      chrome.storage.local.get(['favorites'], data => {
        const oldFavs    = data.favorites || [];
        const oldFavUrls = new Set(oldFavs.map(f => f.url));

        // 2️⃣ Merge new CSV into siteList
        mergeSiteList(newSites, mergedList => {

          // 3️⃣ Re‑build favorites: only keep URLs still in mergedList
          const newFavs = mergedList.filter(site => oldFavUrls.has(site.url));

          // 4️⃣ Persist both lists at once
          chrome.storage.local.set({
            siteList: JSON.stringify(mergedList),
            favorites: newFavs
          }, () => {
            console.log('Imported CSV and re‑applied favorites.');
            loadSiteList();
            resetVisibleItems();
            loadFavorites();
          });
        });
      });
    };

    reader.readAsText(file);
  });
});

function resetVisibleItems() {
  const allListItems = Array.from(document.querySelectorAll('li'));
  visibleListItems = allListItems; // Populate with all list items
  selectedIndex = -1; // Reset the selected index

  allListItems.forEach(item => {
    item.style.display = 'flex';
    item.classList.remove('selected');
  });
}

function clearHighlighting() {
  const allListItems = Array.from(document.querySelectorAll('li'));
  allListItems.forEach(item => item.classList.remove('selected'));
}

function filterList(searchTerm) {
  const allListItems = Array.from(document.querySelectorAll('li'));
  visibleListItems = [];
  selectedIndex = -1;

  allListItems.forEach(item => {
    const siteName = item.querySelector('a').textContent.toLowerCase();
    if (siteName.includes(searchTerm.toLowerCase())) {
      item.style.display = 'flex';
      visibleListItems.push(item); // Add matching items to visibleListItems
    } else {
      item.style.display = 'none';
    }
    item.classList.remove('selected'); // Remove any previous selection
  });

  // Highlight the first item if items are visible
  if (visibleListItems.length > 0) {
    selectedIndex = 0;
    visibleListItems[selectedIndex].classList.add('selected');
  }
}

function handleKeyPress(event) {
  const allListItems = Array.from(document.querySelectorAll('li:not([style*="display: none"])'));
  if (allListItems.length === 0) return;

  const isDown = event.key === 'ArrowDown';
  if (selectedIndex >= 0) {
    allListItems[selectedIndex].classList.remove('selected');
  }
  selectedIndex = selectedIndex < 0
    ? 0
    : (isDown
        ? (selectedIndex + 1) % allListItems.length
        : (selectedIndex - 1 + allListItems.length) % allListItems.length
      );
  allListItems[selectedIndex].classList.add('selected');
  allListItems[selectedIndex].scrollIntoView({ block: 'nearest' });
}

function handleEnterKey() {
  if (visibleListItems.length > 0 && selectedIndex >= 0) {
    const selectedItem = visibleListItems[selectedIndex];
    if (selectedItem) {
      const link = selectedItem.querySelector('a');
      if (link) {
        console.log('Opening URL:', link.href);
        link.click(); // Simulate link click
      }
    }
  }
}

function initializeVisibleItemsIfNeeded() {
  if (visibleListItems.length === 0) {
    visibleListItems = Array.from(document.querySelectorAll('li:not([style*="display: none"])'));
  }
}

function loadSiteList(callback) {
  chrome.storage.local.get(['siteList', 'favorites'], function (data) {
    const siteList = data.siteList ? JSON.parse(data.siteList) : [];
    const favorites = data.favorites ? data.favorites : [];

    const filteredSiteList = siteList.filter(site => !favorites.some(fav => fav.url === site.url));

    const siteListElement = document.getElementById('siteList');
    siteListElement.innerHTML = '';

    filteredSiteList.forEach(function (site) {
      const listItem = document.createElement('li');

      const starCheckboxDiv = document.createElement('div');
      starCheckboxDiv.className = 'star-checkbox';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `star-${site.url}`;
      checkbox.dataset.url = site.url;
      checkbox.dataset.name = site.name;
      checkbox.dataset.stack = site.stack;

      const label = document.createElement('label');
      label.htmlFor = `star-${site.url}`;

      starCheckboxDiv.appendChild(checkbox);
      starCheckboxDiv.appendChild(label);

      const stackSpan = document.createElement('span');
      stackSpan.className = 'stack';
      stackSpan.textContent = site.stack;

      const linkSpan = document.createElement('span');
      linkSpan.innerHTML = `<a href="${site.url}" target="_blank">${site.name}</a>`;

      listItem.appendChild(starCheckboxDiv);
      listItem.appendChild(stackSpan);
      listItem.appendChild(linkSpan);
      siteListElement.appendChild(listItem);

      checkbox.addEventListener('change', function () {
        if (this.checked) {
          addToFavorites({ name: this.dataset.name, url: this.dataset.url, stack: this.dataset.stack });
        } else {
          removeFromFavorites(this.dataset.url);
        }
      });
    });

    if (callback) callback(); // Call the callback after reloading the list
  });
}

function parseCSV(csvData) {
  const lines = csvData.split('\n');
  const siteList = [];

  lines.forEach(line => {
    const cells = line.split(',').map(cell => cell.trim());
    if (cells.length >= 3) {
      const [stack, name, url] = cells;
      siteList.push({ stack, name, url });
    }
  });

  return siteList;
}

function mergeSiteList(newSites, callback) {
  chrome.storage.local.get('siteList', function (data) {
    const existingSites = data.siteList ? JSON.parse(data.siteList) : [];
    const mergedList = [...existingSites, ...newSites];

    const uniqueList = mergedList.filter((site, index, self) =>
      index === self.findIndex(s => s.name === site.name && s.url === site.url)
    );

    callback(uniqueList);
  });
}

function loadFavorites() {
  chrome.storage.local.get('favorites', function (data) {
    const favorites = data.favorites ? data.favorites : [];
    const favoritesListElement = document.getElementById('favoritesList');
    favoritesListElement.innerHTML = '';

    favorites.forEach(function (site, idx) {
      const listItem = document.createElement('li');

      const starCheckboxDiv = document.createElement('div');
      starCheckboxDiv.className = 'star-checkbox';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `star-fav-${site.url}`;
      checkbox.checked = true;
      checkbox.dataset.url = site.url;
      checkbox.dataset.name = site.name;
      checkbox.dataset.stack = site.stack;

      const label = document.createElement('label');
      label.htmlFor = `star-fav-${site.url}`;

      starCheckboxDiv.appendChild(checkbox);
      starCheckboxDiv.appendChild(label);

      const stackSpan = document.createElement('span');
      stackSpan.className = 'stack';
      stackSpan.textContent = site.stack;

      const linkSpan = document.createElement('span');
      linkSpan.innerHTML = `<a href="${site.url}" target="_blank">${site.name}</a>`;

      // ── Reorder controls ───────────────────────────────────────
      const reorderDiv = document.createElement('div');
      reorderDiv.className = 'reorder';

      // ▲ Up
      const upBtn = document.createElement('button');
      upBtn.textContent = '▲';
      upBtn.disabled = (idx === 0);
      upBtn.addEventListener('click', () => moveFavorite(site.url, -1));

      // ▼ Down
      const downBtn = document.createElement('button');
      downBtn.textContent = '▼';
      downBtn.disabled = (idx === favorites.length - 1);
      downBtn.addEventListener('click', () => moveFavorite(site.url, +1));

      reorderDiv.appendChild(upBtn);
      reorderDiv.appendChild(downBtn);
      // ──────────────────────────────────────────────────────────

      listItem.appendChild(starCheckboxDiv);
      listItem.appendChild(stackSpan);
      listItem.appendChild(linkSpan);
      listItem.appendChild(reorderDiv);
      favoritesListElement.appendChild(listItem);

      checkbox.addEventListener('change', function () {
        if (!this.checked) {
          removeFromFavorites(this.dataset.url);
        }
      });
    });
  });
}

function addToFavorites(site) {
  chrome.storage.local.get('favorites', function (data) {
    const favorites = data.favorites ? data.favorites : [];
    if (!favorites.some(fav => fav.url === site.url)) {
      favorites.push(site);
      chrome.storage.local.set({ favorites: favorites }, function () {
        const searchTerm = document.getElementById('searchInput').value.trim();
        loadFavorites();
        loadSiteList(function () {
          if (searchTerm) {
            filterList(searchTerm);
          }
        });
      });
    }
  });
}

function removeFromFavorites(url) {
  chrome.storage.local.get('favorites', function (data) {
    const favorites = data.favorites ? data.favorites : [];
    const updatedFavorites = favorites.filter(fav => fav.url !== url);
    chrome.storage.local.set({ favorites: updatedFavorites }, function () {
      const searchTerm = document.getElementById('searchInput').value.trim();
      loadFavorites();
      loadSiteList(function () {
        if (searchTerm) {
          filterList(searchTerm);
        }
      });
    });
  });
}

/**
 * Swap a favorite up or down by one position,
 * persist to chrome.storage, then re-render.
 *
 * @param {string} url       the unique key for the favorite
 * @param {number} direction -1 to move up, +1 to move down
 */
function moveFavorite(url, direction) {
  chrome.storage.local.get('favorites', function (data) {
    const favorites = data.favorites ? data.favorites : [];
    const idx = favorites.findIndex(fav => fav.url === url);
    if (idx < 0) return;

    const newIndex = idx + direction;
    if (newIndex < 0 || newIndex >= favorites.length) return;

    // Swap in‑place
    [favorites[idx], favorites[newIndex]] = [favorites[newIndex], favorites[idx]];

    // Save & re-render
    chrome.storage.local.set({ favorites: favorites }, function () {
      loadFavorites();
    });
  });
}
