const assert = require('assert');

function getCurrentDateTimeFormatted() {
  const now = new Date();

  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * Compares two Info objects for equality.
 * The function checks if both objects have the same keys and values.
 * @param {Object} info1 - The first object to compare.
 * @param {Object} info2 - The second object to compare.
 * @returns {boolean} True if the objects are equal, false otherwise.
 */
function areInfoObjectsEqual(info1, info2) {
  const o1 = structuredClone(info1);
  const o2 = structuredClone(info2);

  delete o1.date;
  delete o2.date;

  const isEqual = deepEqual(o1, o2);

  return isEqual;
}

function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }

  const clonedObj = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clonedObj[key] = deepClone(obj[key]);
    }
  }
  return clonedObj;
}

function deepEqual(o1, o2) {
  try {
    assert.deepStrictEqual(o1, o2);
  } catch (err) {
    return false;
  }
  return true;
}

module.exports = {
  getCurrentDateTimeFormatted,
  areInfoObjectsEqual,
  deepClone,
  deepEqual
}
