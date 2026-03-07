// Try to get electron from a different approach
const path = require('path');

// Check what electron returns normally
const electron = require('electron');
console.log('require(electron) returns:', typeof electron);

// Check if it's a string (path) or object
if (typeof electron === 'string') {
  console.log('It is a path. Trying to load from resources...');
  
  // Try to find the electron module in resources
  const resourcesPath = path.join(path.dirname(process.execPath), 'resources');
  console.log('Resources path:', resourcesPath);
  
  // Check if there's an app.asar
  const fs = require('fs');
  if (fs.existsSync(path.join(resourcesPath, 'app.asar'))) {
    console.log('app.asar exists');
  } else {
    console.log('app.asar does not exist');
  }
}
