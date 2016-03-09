var dotty = require("dotty");

module.exports = function(typeInfo) {
	if (dotty.has(typeInfo, "controls")) {
		return typeInfo.controls.map(function(control) {
			if (control.controlType === "relation") {
				return {
					name: control.name,
					isSingle: !!(dotty.get(control, "meta.isSingle"))
				}
			} else if (control.controlType === "grid" && control.controls != null) {
				return control.controls.map(function(otherControl) {
					if (control.controlType === "relation") {
						return {
							ownerField: control.name,
							name: otherControl.name,
							isSingle: !!(dotty.get(otherControl, "meta.isSingle"))
						}
					}
				})
			}
		}).reduce(function(total, item) {
			// Flatten it all.
			if (Array.isArray(item)) {
				return total.concat(item);
			} else {
				return total.concat([item]);
			}
		}, []).filter(function(item) {
			// Filter out unrelated controls.
			return (item != null);
		});
	} else {
		return [];
	}
}