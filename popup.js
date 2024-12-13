document.addEventListener('DOMContentLoaded', function() {
  loadSiteList();
  loadFavorites();

  // Focus the search input field automatically
  document.getElementById('searchInput').focus();

  // Delete Button Event
  document.getElementById('deleteButton').addEventListener('click', function() {
    chrome.storage.local.remove(['siteList', 'favorites'], function() {
      console.log('Deleted imported site list and favorites.');
      loadSiteList();
      loadFavorites();
    });
  });

  // Search Input Event
  document.getElementById('searchInput').addEventListener('input', function() {
    filterSiteList(this.value);
    filterFavorites(this.value);
  });

  // Import Button Event
  document.getElementById('importButton').addEventListener('click', function() {
    document.getElementById('csvFileInput').click();
  });

  // CSV File Input Event
  document.getElementById('csvFileInput').addEventListener('change', function() {
    var file = this.files[0];
    if (file) {
      var reader = new FileReader();
      reader.onloadend = function() {
        var csvData = reader.result;
        var siteList = parseCSV(csvData);
        mergeSiteList(siteList, function (mergedList) {
          chrome.storage.local.set({ 'siteList': JSON.stringify(mergedList) }, function () {
            console.log('Imported site list successfully.');
            loadSiteList();
          });
        });
      };
      reader.readAsText(file);
    }
  });
});

// Handle Extension Installation
chrome.runtime.onInstalled.addListener(function() {
  importCSVFile();
});

// Import CSV File on Installation
async function importCSVFile() {
  try {
    const [fileHandle] = await window.showOpenFilePicker({ 
      types: [{ description: 'CSV Files', accept: { 'text/csv': ['.csv'] } }],
      multiple: false
    });
    const file = await fileHandle.getFile();
    const csvData = await file.text();
    const siteList = parseCSV(csvData);

    mergeSiteList(siteList, function (mergedList) {
      chrome.storage.local.set({ 'siteList': JSON.stringify(mergedList) }, function () {
        console.log('Imported site list successfully.');
        loadSiteList();
      });
    });
  } catch (error) {
    console.error('Error importing CSV file:', error);
  }
}

// Parse CSV Data
function parseCSV(csvData) {
  var lines = csvData.split('\n');
  var siteList = [];

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line !== '') {
      var cells = line.split(',');
      if (cells.length >= 3) {
        var stack = cells[0].trim();
        var name = cells[1].trim();
        var url = cells[2].trim();
        siteList.push({ 'name': name, 'url': url, 'stack': stack });
      }
    }
  }

  return siteList;
}

// Merge New Sites with Existing Sites
function mergeSiteList(newSites, callback) {
  chrome.storage.local.get('siteList', function (data) {
    var existingSites = data.siteList ? JSON.parse(data.siteList) : [];
    var mergedList = existingSites.concat(newSites);

    // Remove duplicates based on name and URL (case-insensitive for name)
    var uniqueList = mergedList.filter(function (site, index, self) {
      return index === self.findIndex(function (s) {
        return s.name.toLowerCase() === site.name.toLowerCase() && s.url === site.url;
      });
    });

    callback(uniqueList);
  });
}

// Load Site List (Excluding Favorites)
function loadSiteList() {
  chrome.storage.local.get(['siteList', 'favorites'], function(data) {
    var siteList = data.siteList ? JSON.parse(data.siteList) : [];
    var favorites = data.favorites ? data.favorites : [];

    // Exclude favorites from the main site list
    var filteredSiteList = siteList.filter(site => !favorites.some(fav => fav.url === site.url));

    var siteListElement = document.getElementById('siteList');
    siteListElement.innerHTML = '';

    filteredSiteList.forEach(function(site) {
      var listItem = document.createElement('li');

      // Star Checkbox
      var starCheckboxDiv = document.createElement('div');
      starCheckboxDiv.className = 'star-checkbox';

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `star-${site.url}`;
      checkbox.dataset.url = site.url;
      checkbox.dataset.name = site.name;
      checkbox.dataset.stack = site.stack;

      var label = document.createElement('label');
      label.htmlFor = `star-${site.url}`;

      starCheckboxDiv.appendChild(checkbox);
      starCheckboxDiv.appendChild(label);

      // Stack Display
      var stackSpan = document.createElement('span');
      stackSpan.className = 'stack';
      stackSpan.textContent = site.stack;

      // Site Name and Link
      var linkSpan = document.createElement('span');
      linkSpan.innerHTML = `<a href="${site.url}" target="_blank">${site.name}</a>`;

      listItem.appendChild(starCheckboxDiv);
      listItem.appendChild(stackSpan);
      listItem.appendChild(linkSpan);
      siteListElement.appendChild(listItem);

      // Event Listener for Star Checkbox
      checkbox.addEventListener('change', function() {
        if (this.checked) {
          addToFavorites({ 'name': this.dataset.name, 'url': this.dataset.url, 'stack': this.dataset.stack });
        }
      });
    });
  });
}

// Load Favorites
function loadFavorites() {
  chrome.storage.local.get('favorites', function(data) {
    var favorites = data.favorites ? data.favorites : [];

    var favoritesListElement = document.getElementById('favoritesList');
    favoritesListElement.innerHTML = '';

    favorites.forEach(function(site) {
      var listItem = document.createElement('li');

      // Star Checkbox for Removing from Favorites
      var starCheckboxDiv = document.createElement('div');
      starCheckboxDiv.className = 'star-checkbox';

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `star-fav-${site.url}`;
      checkbox.checked = true;
      checkbox.dataset.url = site.url;
      checkbox.dataset.name = site.name;
      checkbox.dataset.stack = site.stack;

      var label = document.createElement('label');
      label.htmlFor = `star-fav-${site.url}`;

      starCheckboxDiv.appendChild(checkbox);
      starCheckboxDiv.appendChild(label);

      // Stack Display for Favorites
      var stackSpan = document.createElement('span');
      stackSpan.className = 'stack';
      stackSpan.textContent = site.stack;

      // Site Name and Link
      var linkSpan = document.createElement('span');
      linkSpan.innerHTML = `<a href="${site.url}" target="_blank">${site.name}</a>`;

      listItem.appendChild(starCheckboxDiv);
      listItem.appendChild(stackSpan);
      listItem.appendChild(linkSpan);
      favoritesListElement.appendChild(listItem);

      // Event Listener for Star Checkbox
      checkbox.addEventListener('change', function() {
        if (!this.checked) {
          removeFromFavorites(this.dataset.url);
        }
      });
    });
  });
}

// Add to Favorites
function addToFavorites(site) {
  chrome.storage.local.get('favorites', function(data) {
    var favorites = data.favorites ? data.favorites : [];

    // Prevent duplicates
    if (!favorites.some(fav => fav.url === site.url)) {
      favorites.push(site);
      chrome.storage.local.set({ 'favorites': favorites }, function() {
        console.log('Added to favorites:', site.name);
        loadFavorites();
        loadSiteList();
      });
    }
  });
}

// Remove from Favorites
function removeFromFavorites(url) {
  chrome.storage.local.get('favorites', function(data) {
    var favorites = data.favorites ? data.favorites : [];
    favorites = favorites.filter(fav => fav.url !== url);
    chrome.storage.local.set({ 'favorites': favorites }, function() {
      console.log('Removed from favorites:', url);
      loadFavorites();
      loadSiteList();
    });
  });
}

// Filter Site List Based on Search
function filterSiteList(searchTerm) {
  var siteListItems = document.querySelectorAll('#siteList li');
  siteListItems.forEach(function(item) {
    var siteName = item.querySelector('a').textContent.toLowerCase();
    if (siteName.includes(searchTerm.toLowerCase())) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

// Filter Favorites Based on Search
function filterFavorites(searchTerm) {
  var favoritesListItems = document.querySelectorAll('#favoritesList li');
  favoritesListItems.forEach(function(item) {
    var siteName = item.querySelector('a').textContent.toLowerCase();
    if (siteName.includes(searchTerm.toLowerCase())) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}
