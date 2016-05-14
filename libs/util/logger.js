var defaultValue = require("default-value");

module.exports = function(prefix, options) {
  options = defaultValue(options, {});
  options.debugMode = defaultValue(options.debugMode, false);

  var prefixString;

  if (prefix != null) {
    prefixString = "[" + prefix + "] ";
  } else {
    prefixString = "[x] ";
  }

  return {
    ok: function(data) {
      console.log(prefixString + data);
    },
    error: function(data) {
      console.error(prefixString + data);
    },
    debug: function(data) {
      if (options.debugMode) {
        console.error(prefixString + data);
      }
    },
    write: function() {},
    writeln: function() {}
  };
}