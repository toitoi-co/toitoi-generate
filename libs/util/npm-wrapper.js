var Promise = require("bluebird");
var runBufferedCommand = require("./run-buffered-command");

module.exports = function createNpmWrapper(options) {
  var npm, path;

  // FIXME: Aren't `npm` commands exposed as a module, as well?

  if (options.npm != null) {
    npm = options.npm;
  } else {
    npm = "npm";
  }

  if (options.path != null) {
    path = options.path;
  } else {
    path = ".";
  }

  function run(args) {
    return runBufferedCommand(npm, path, args);
  }

  return {
    install: function(args) {
      if (args == null) {
        args = [];
      }
      
      return run(["install"].concat(args));
    },
    getCachePath: function() {
      return Promise.try(function(){
        return run(["config", "get", "cache"]);
      }).spread(function(stdout, stderr) {
        return stdout.trim();
      });
    },
    setCachePath: function(path) {
      return run(["config", "set", "cache", path]);
    }
  }
}