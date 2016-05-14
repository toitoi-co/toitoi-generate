module.exports = function getTemplateOverrideField(typeInfo) {
  if (typeInfo != null) {
    var layoutControls = typeInfo.controls.filter(function(control) {
      return (control.controlType === "layout");
    });

    if (layoutControls.length > 0) {
      return layoutControls[0].name;
    }
  }
}