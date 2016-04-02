var createError = require("create-error");

module.exports = {
  TokenError: createError("TokenError", {
    code: "TokenError",
    statusCode: 401
  }),
  ConflictError: createError("ConflictError", {
    code: "ConflictError",
    statusCode: 409
  })
}
