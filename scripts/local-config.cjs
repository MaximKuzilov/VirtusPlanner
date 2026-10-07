const fs = require('fs');
const path = require('path');

module.exports = function ({ types }) {
  const filename = path.resolve(__dirname, '..', '.virtus-secrets.json');
  const local = fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : {};
  return { visitor: { StringLiteral(nodePath) {
    const match = /^__VIRTUS_LOCAL_([A-Z_]+)__$/.exec(nodePath.node.value);
    if (!match) return;
    const value = process.env['VIRTUS_' + match[1]] || local[match[1]] || '';
    nodePath.replaceWith(types.stringLiteral(value));
  } } };
};
