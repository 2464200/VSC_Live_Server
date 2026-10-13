const fs = require('fs');
const path = require('path');

const DEFAULTS = Object.freeze({
  allowOtherDjExecute: false,
  allowOtherDjCancel: false
});
const DEFAULT_FILE = path.join(__dirname, 'data', 'action-permissions.json');

function sanitize(value = {}) {
  return {
    allowOtherDjExecute: value.allowOtherDjExecute === true,
    allowOtherDjCancel: value.allowOtherDjCancel === true
  };
}

function createActionPermissionsStore(filePath = DEFAULT_FILE) {
  return {
    read() {
      try {
        return sanitize(JSON.parse(fs.readFileSync(filePath, 'utf8')));
      } catch (_) {
        return { ...DEFAULTS };
      }
    },
    save(value) {
      const next = sanitize(value);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(next, null, 2));
      return next;
    }
  };
}

module.exports = { DEFAULTS, sanitize, createActionPermissionsStore };
