document.addEventListener('DOMContentLoaded', function() {
  loadSiteList();
  loadFavorites();
  document.getElementById('deleteButton').addEventListener('click', function() {
    chrome.storage.local.remove(['siteList', 'favorites'], function() {
      console.log('Deleted imported site list and favorites.');
      loadSiteList();
      loadFavorites();
    });
  });


  document.getElementById('searchInput').addEventListener('input', function() {
    filterSiteList(this.value);
    filterFavorites(this.value);
  });

  document.getElementById('importButton').addEventListener('click', function() {
    document.getElementById('csvFileInput').click();
  });

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

chrome.runtime.onInstalled.addListener(function() {
  importCSVFile();
});


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

function mergeSiteList(newSites, callback) {
  chrome.storage.local.get('siteList', function (data) {
    var existingSites = data.siteList ? JSON.parse(data.siteList) : [];
    var mergedList = existingSites.concat(newSites);

    var uniqueList = mergedList.filter(function (site, index, self) {
      return index === self.findIndex(function (s) {
        return s.name === site.name && s.url === site.url;
      });
    });

    callback(uniqueList);
  });
}

function loadSiteList() {
  chrome.storage.local.get('siteList', function(data) {
    var siteList = data.siteList ? JSON.parse(data.siteList) : [];

    var siteListElement = document.getElementById('siteList');
    siteListElement.innerHTML = '';

    siteList.forEach(function(site) {
      var listItem = document.createElement('li');

      var favoriteCheckbox = document.createElement('input');
      favoriteCheckbox.type = 'checkbox';
      favoriteCheckbox.className = 'favorite-checkbox';
      favoriteCheckbox.dataset.url = site.url;
      favoriteCheckbox.dataset.name = site.name;
      chrome.storage.local.get('favorites', function(favData) {
        var favorites = favData.favorites ? favData.favorites : [];
        if (favorites.some(fav => fav.url === site.url)) {
          favoriteCheckbox.checked = true;
        }
      });
      favoriteCheckbox.addEventListener('change', toggleFavorite);

      var stackSpan = document.createElement('span');
      stackSpan.className = 'stack';
      stackSpan.textContent = site.stack;

      var linkSpan = document.createElement('span');
      linkSpan.innerHTML = '<a href="' + site.url + '" target="_blank">' + site.name + '</a>';

      listItem.appendChild(favoriteCheckbox);
      listItem.appendChild(stackSpan);
      listItem.appendChild(document.createTextNode(' '));
      listItem.appendChild(linkSpan);
      siteListElement.appendChild(listItem);
    });
  });
}

function loadFavorites() {
  chrome.storage.local.get('favorites', function(data) {
    var favorites = data.favorites ? data.favorites : [];

    var favoritesListElement = document.getElementById('favoritesList');
    favoritesListElement.innerHTML = '';

    favorites.forEach(function(site) {
      var listItem = document.createElement('li');

      var favoriteCheckbox = document.createElement('input');
      favoriteCheckbox.type = 'checkbox';
      favoriteCheckbox.className = 'favorite-checkbox';
      favoriteCheckbox.dataset.url = site.url;
      favoriteCheckbox.dataset.name = site.name;
      favoriteCheckbox.checked = true;
      favoriteCheckbox.addEventListener('change', toggleFavorite);

      var stackSpan = document.createElement('span');
      stackSpan.className = 'stack';
      stackSpan.textContent = site.stack;

      var linkSpan = document.createElement('span');
      linkSpan.innerHTML = '<a href="' + site.url + '" target="_blank">' + site.name + '</a>';

      listItem.appendChild(favoriteCheckbox);
      listItem.appendChild(stackSpan);
      listItem.appendChild(document.createTextNode(' '));
      listItem.appendChild(linkSpan);
      favoritesListElement.appendChild(listItem);
    });
  });
}

function toggleFavorite(event) {
  var url = event.target.dataset.url;
  var name = event.target.dataset.name;

  chrome.storage.local.get(['favorites', 'siteList'], function(data) {
    var favorites = data.favorites ? data.favorites : [];
    var siteList = data.siteList ? JSON.parse(data.siteList) : [];
    var site = siteList.find(s => s.url === url && s.name === name);

    if (event.target.checked) {
      if (site) {
        favorites.push({ 'name': site.name, 'url': site.url, 'stack': site.stack });
      }
    } else {
      favorites = favorites.filter(function(s) {
        return s.url !== url;
      });
    }

    chrome.storage.local.set({ 'favorites': favorites }, function() {
      loadFavorites();
      loadSiteList(); 
    });
  });
}

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
