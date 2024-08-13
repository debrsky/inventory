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
  // Check if both are objects and not null
  if (
    typeof info1 !== 'object' ||
    info1 === null ||
    typeof info2 !== 'object' ||
    info2 === null
  ) {
    return false;
  }

  // Get keys of both objects
  const keys1 = Object.keys(info1).filter((key) => key !== 'date');
  const keys2 = Object.keys(info2).filter((key) => key !== 'date');

  // Compare number of keys
  if (keys1.length !== keys2.length) {
    return false;
  }

  // Check each key and value
  for (const key of keys1) {
    if (!keys2.includes(key) || info1[key] !== info2[key]) {
      return false;
    }
  }

  return true;
}

module.exports = {
  getCurrentDateTimeFormatted,
  areInfoObjectsEqual
}
