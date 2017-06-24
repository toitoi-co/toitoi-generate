module.exports = function(env, swigInstance) {
  return function tryRender(template, locals, options) {
    env.logger.debug('Rendering ' + template);

    // FIXME: Proper detection of item type...
    let localTemplate = template.match(/sites\/[^\/]+\/.+$/);
    env.logger.ok(`Rendering ${localTemplate}: ${(locals.item || {}).name}`)

    var renderedOutput;

    try {
      renderedOutput = swigInstance.renderFile(template, locals);
    } catch (err) {
      // REFACT: Replace sendSockMessage, somehow... maybe specify a hook in `options`?

      if (options.strictMode) {
        throw err;
      } else {
        /* Render an error page. */
        // REFACT: Debug logging.

        try {
          renderedOutput = swigInstance.renderFile("./debug500.html", {
            template: template,
            error: err.toString(),
            backtrace: err.stack.toString()
          });
        } catch (err) {
          throw err; // REFACT: Will this break stuff? Original code returned empty string... magic value?
        }
      }
    }

    return renderedOutput;
  }
}
