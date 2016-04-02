module.exports = function(task) {
	return [
		"_",
		task.type,
		"_",
		(task.size.width != null) ? task.size.width.toString() : "x",
		"_",
		(task.size.height != null) ? task.size.height.toString() : "x",
	].join("");
}
