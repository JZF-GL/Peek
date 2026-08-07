// Empty fs polyfill for browser - docstream should work with ArrayBuffer input
// and not need actual file system access
export default {
  readFile: () => Promise.reject(new Error('fs.readFile not available in browser')),
  writeFile: () => Promise.reject(new Error('fs.writeFile not available in browser')),
  existsSync: () => false,
  readFileSync: () => { throw new Error('fs.readFileSync not available in browser'); },
  createReadStream: () => { throw new Error('fs.createReadStream not available in browser'); },
  promises: {
    readFile: () => Promise.reject(new Error('fs.readFile not available in browser')),
    writeFile: () => Promise.reject(new Error('fs.writeFile not available in browser')),
  },
}
