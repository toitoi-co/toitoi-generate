module.exports = function() {
  var locks = {};

  return {
    lock: function(key) {
      if (locks[key] == null) {
        locks[key] = true;
      } else {
        // FIXME: Proper error type
        throw new Error("Key is already locked");
      }
    },
    unlock: function(key) {
      delete locks[key];
    }
  }
}