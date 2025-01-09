let selectedIndex = -1; 
let visibleListItems = [];

document.addEventListener('DOMContentLoaded', function () {
  loadSiteList();
  loadFavorites();

  document.getElementById('searchInput').focus();

  document.getElementById('deleteButton').addEventListener('click', function () {
    chrome.storage.local.remove(['siteList', 'favorites'], function () {
      console.log('Deleted imported site list and favorites.');
      loadSiteList();
      loadFavorites();
    });
  });

  document.getElementById('searchInput').addEventListener('input', function () {
    const searchTerm = this.value.trim();
  
    if (!searchTerm) {
      resetVisibleItems();
    } else {
      filterList(searchTerm); 
    }
  });
  

  document.getElementById('searchInput').addEventListener('keydown', function (event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); 
      handleKeyPress(event);
    } else if (event.key === 'Enter') {
      handleEnterKey();
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
        const siteList = parseCSV(csvData);
        mergeSiteList(siteList, function (mergedList) {
          chrome.storage.local.set({ siteList: JSON.stringify(mergedList) }, function () {
            console.log('Imported site list successfully.');
            loadSiteList();
          });
        });
      };
      reader.readAsText(file);
    }
  });
});

function resetVisibleItems() {
  visibleListItems = [];
  selectedIndex = -1;

  const allListItems = Array.from(document.querySelectorAll('li'));
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
      visibleListItems.push(item); 
    } else {
      item.style.display = 'none';
    }
    item.classList.remove('selected');
  });

  if (visibleListItems.length > 0) {
    selectedIndex = 0;
    visibleListItems[selectedIndex].classList.add('selected');
  }
}

function handleKeyPress(event) {
  if (visibleListItems.length === 0) return;

  const isDown = event.key === 'ArrowDown';

  if (selectedIndex >= 0) {
    visibleListItems[selectedIndex].classList.remove('selected');
  }

  selectedIndex = isDown
    ? (selectedIndex + 1) % visibleListItems.length
    : (selectedIndex - 1 + visibleListItems.length) % visibleListItems.length;

  visibleListItems[selectedIndex].classList.add('selected');
  visibleListItems[selectedIndex].scrollIntoView({ block: 'nearest' });
}

function handleEnterKey() {
  if (selectedIndex >= 0 && visibleListItems[selectedIndex]) {
    const link = visibleListItems[selectedIndex].querySelector('a');
    if (link) {
      console.log('Opening URL:', link.href);
      link.click(); 
    }
  }
}

function loadSiteList() {
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
        }
      });
    });
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
        loadFavorites();
        loadSiteList();
      });
    }
  });
}

function removeFromFavorites(url) {
  chrome.storage.local.get('favorites', function (data) {
    const favorites = data.favorites ? data.favorites : [];
    const updatedFavorites = favorites.filter(fav => fav.url !== url);
    chrome.storage.local.set({ favorites: updatedFavorites }, function () {
      loadFavorites();
      loadSiteList();
    });
  });
}