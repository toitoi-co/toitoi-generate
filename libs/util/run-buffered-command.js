var Promise = require("bluebird");
var childProcess = Promise.promisifyAll(require("child_process"), {multiArgs: true});

module.exports = function runBufferedCommand(command, workingDirectory, arguments) {
  return childProcess.execFileAsync(command, arguments, {
    cwd: workingDirectory
  });
}