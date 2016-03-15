module.exports = function defaultValue(value, fallback) {
  if (value != null) {
    return value;
  } else {
    return fallback;
  }
}