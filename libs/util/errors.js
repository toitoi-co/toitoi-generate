var createError = require("create-error");

module.exports = {
  TokenError: createError("TokenError", {
    code: "TokenError",
    statusCode: 401
  }),
  NotFoundError: createError("NotFoundError", {
    code: "NotFoundError",
    statusCode: 404
  }),
  ConflictError: createError("ConflictError", {
    code: "ConflictError",
    statusCode: 409
  })
}
