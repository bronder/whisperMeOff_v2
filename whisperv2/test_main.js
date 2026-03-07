const { app, BrowserWindow } = require('electron');
console.log('App type:', typeof app);
console.log('BrowserWindow type:', typeof BrowserWindow);

app.whenReady().then(() => {
  console.log('App is ready');
  const win = new BrowserWindow({ width: 400, height: 400 });
  console.log('Window created');
});
