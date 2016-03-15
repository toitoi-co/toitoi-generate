module.exports = function escapeKey(key) {
  // FIXME: This is a horrible hack, but it doesn't seem that any validation is done anywhere else...
  if (key.indexOf("/") !== -1) {
    throw new Error("Key or site name cannot contain a slash.")
  }
  
  return key.replace(/\./g, ",1");
}