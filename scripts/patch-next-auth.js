const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'node_modules', 'next-auth', 'css', 'index.js');
if (fs.existsSync(cssPath)) {
  fs.writeFileSync(cssPath, 'module.exports = function() { return ""; };');
  console.log('Patched next-auth css');
} else {
  console.log('File not found:', cssPath);
}