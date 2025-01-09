let selectedIndex = -1;
let visibleListItems = [];

document.addEventListener('DOMContentLoaded', function () {
  loadSiteList();
  loadFavorites();
  resetVisibleItems(); // Ensure visibleListItems is initialized

  document.getElementById('searchInput').focus();

  document.getElementById('deleteButton').addEventListener('click', function () {
    chrome.storage.local.remove(['siteList', 'favorites'], function () {
      console.log('Deleted imported site list and favorites.');
      loadSiteList();
      loadFavorites();
      resetVisibleItems(); // Reinitialize visibleListItems after deletion
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
    document.getElementById('csvFileInput').click();
  });

  document.getElementById('csvFileInput').addEventListener('change', function () {
    const file = this.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = function () {
        const csvData = reader.result;

        try {
          const siteList = parseCSV(csvData);
          if (siteList.length === 0) {
            console.warn('No valid data found in the CSV file.');
            return;
          }

          mergeSiteList(siteList, function (mergedList) {
            chrome.storage.local.set({ siteList: JSON.stringify(mergedList) }, function () {
              console.log('Imported site list successfully.');
              loadSiteList();
              resetVisibleItems(); // Reinitialize visibleListItems after import
            });
          });
        } catch (error) {
          console.error('Error parsing CSV:', error);
        }
      };
      reader.readAsText(file);
    }
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

  if (selectedIndex === -1) {
    selectedIndex = 0;
  } else {
    selectedIndex = isDown
      ? (selectedIndex + 1) % allListItems.length
      : (selectedIndex - 1 + allListItems.length) % allListItems.length;
  }

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

    favorites.forEach(function (site) {
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

      listItem.appendChild(starCheckboxDiv);
      listItem.appendChild(stackSpan);
      listItem.appendChild(linkSpan);
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
        const searchTerm = document.getElementById('searchInput').value.trim(); // Retain the search term
        loadFavorites();
        loadSiteList(function () {
          if (searchTerm) {
            filterList(searchTerm); // Reapply the search filter
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
      const searchTerm = document.getElementById('searchInput').value.trim(); // Retain the search term
      loadFavorites();
      loadSiteList(function () {
        if (searchTerm) {
          filterList(searchTerm); // Reapply the search filter
        }
      });
    });
  });
}

