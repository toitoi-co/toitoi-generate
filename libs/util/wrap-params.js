var defaultValue = require("default-value");

module.exports = function(route, handler) {
  return function(req, res, next) {
    req.params = defaultValue(req.params, {});

    route.keys.forEach(function(item, i) {
      req.params[item.name] = req.params[i];
    });

    return handler(req, res, next);
  }
}