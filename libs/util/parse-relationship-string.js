module.exports = function(relationshipString) {
	var parts = relationshipString.split(" ", 2); // FIXME: This will silently ignore anything beyond the first two elements.

	if (parts.length < 2) {
		// FIXME: Will this work for relationship strings pointing at one-off content types?
		throw new Error("A relationship string must specify at least a type and a key.")
	}

	return {
		type: parts[0],
		key: parts[1]
	}
}