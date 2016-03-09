'use strict';

// FIXME: This function makes no sense, as object keys in JS are unordered.

module.exports = function(obj, limit, offset) {
  var keys = [];

  limit = limit || -1;
  offset = offset || -1;

  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      keys.push(key);
    }
  }

  if (limit !== -1 && offset !== -1) {
    keys = keys.slice(offset, offset + limit);
  } else if (limit !== -1) {
    keys = keys.slice(0, limit);
  } else if (offset !== -1) {
    keys = keys.slice(offset);
  } 

  var slicedObject = {};

  keys.forEach(function(key) {
    slicedObject[key] = obj[key];
  });

  return slicedObject;
};