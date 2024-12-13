document.addEventListener('DOMContentLoaded', function() {
  loadSiteList();
  

document.getElementById('deleteButton').addEventListener('click', function() {
  chrome.storage.local.remove('siteList', function() {
    console.log('Deleted imported site list.');
    loadSiteList();
  });
});

  document.getElementById('searchInput').addEventListener('input', function() {
    filterSiteList(this.value);
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
        chrome.storage.local.set({ 'siteList': JSON.stringify(siteList) }, function() {
          console.log('Imported site list successfully.');
          loadSiteList();
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
  const [fileHandle] = await window.showOpenFilePicker({ types: [{ description: 'CSV Files', accept: { 'text/csv': ['.csv'] } }] });
  const file = await fileHandle.getFile();
  const csvData = await file.text();
  const siteList = parseCSV(csvData);

  mergeSiteList(siteList, function (mergedList) {
    chrome.storage.local.get('siteList', function (data) {
      var existingList = [];
      if (data.siteList) {
        existingList = JSON.parse(data.siteList);
      }

      var updatedList = existingList.filter(function (existingSite) {
        return !mergedList.some(function (site) {
          return site.name === existingSite.name;
        });
      });

      var mergedAndUpdatedList = updatedList.concat(mergedList);

      chrome.storage.local.set({ 'siteList': JSON.stringify(mergedAndUpdatedList) }, function () {
        console.log('Imported site list successfully.');
        loadSiteList();
      });
    });
  });
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

function loadSiteList() {
  chrome.storage.local.get('siteList', function(data) {
    var siteList = [];
    if (data.siteList) {
      siteList = JSON.parse(data.siteList);
      document.getElementById('deleteButton').style.display = 'block';
    } else {
      document.getElementById('deleteButton').style.display = 'none';
    }

    var siteListElement = document.getElementById('siteList');
    siteListElement.innerHTML = '';

    siteList.forEach(function(site) {
      var listItem = document.createElement('li');
      var nameSpan = document.createElement('span');
      var linkSpan = document.createElement('span');

      nameSpan.textContent = site.stack;
      linkSpan.innerHTML = '<a href="' + site.url + '" target="_blank">' + site.name + '</a>';

      listItem.appendChild(nameSpan);
      listItem.appendChild(document.createTextNode(' '));
      listItem.appendChild(linkSpan);
      siteListElement.appendChild(listItem);
    });
  });
}




function filterSiteList(searchTerm) {
  var siteListItems = document.querySelectorAll('#siteList li');
  siteListItems.forEach(function(item) {
    var siteName = item.querySelector('a').textContent.toLowerCase();
    if (siteName.includes(searchTerm.toLowerCase())) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });
}
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
      chrome.storage.local.set({ 'siteList': JSON.stringify(siteList) }, function() {
        console.log('Imported site list successfully.');
        loadSiteList();
      });
    };
    reader.readAsText(file);
  }
});
function mergeSiteList(newSites, callback) {
  chrome.storage.local.get('siteList', function (data) {
    if (data.siteList) {
      var existingSites = JSON.parse(data.siteList);
      var mergedList = existingSites.concat(newSites);

      // Usuń duplikaty linków na podstawie nazwy i URL-a
      var uniqueList = mergedList.filter(function (site, index, self) {
        var currentIndex = self.findIndex(function (s) {
          return s.name === site.name && s.url === site.url;
        });
        return currentIndex === index;
      });

      callback(uniqueList);
    } else {
      callback(newSites);
    }
  });
}
