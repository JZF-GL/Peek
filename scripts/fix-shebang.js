const fs = require('fs');
const path = require('path');

const filesToFix = [
  'dist/index.js',
  'dist/OfficeParser.js',
  'dist/officeparser.browser.js',
];

const baseDir = path.join(__dirname, '..', 'node_modules', '@jose.espana', 'docstream');

for (const file of filesToFix) {
  const filePath = path.join(baseDir, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.startsWith('#!')) {
      content = content.replace(/^#!.*\n/, '');
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Fixed shebang in ${file}`);
    } else {
      console.log(`- Already clean: ${file}`);
    }
  } else {
    console.log(`× Not found: ${file}`);
  }
}
