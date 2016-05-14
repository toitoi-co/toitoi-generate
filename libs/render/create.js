var Promise = require("bluebird");
var swig = require("swig");
var extend = require("extend");

module.exports = function(options) {
  return function(dataKey) {
    var env = options.environment;

    var getData = require("../environment/get-data")({
      firebaseRoot: options.firebaseRoot,
      siteName: options.siteName,
      secretKey: options.secretKey,
      dataKey: dataKey,
      environment: env
    });

    var swigInstance = new swig.Swig({
      loader: swig.loaders.fs(env.environmentPath("")),
      cache: false // FIXME: 'memory' for production?
    });

    var swigFilters = require("../swig_filters");
    swigFilters.init(swigInstance, {
      queue: options.queue
    });

    /* Every time the swigFilters are .init'ed, the module will set new
     * API methods on itself, referring to the scope for that .init call.
     * By copying the references to these methods, we can keep them around
     * even when we reuse the swigFilter module in multiple environments.
     */
    var swigFilterAPI = {
      setTypeInfo: swigFilters.setTypeInfo,
      setSiteDns: swigFilters.setSiteDns,
      setFirebaseConf: swigFilters.setFirebaseConf
    }

    var swigFunctions = new require("../swig_functions").swigFunctions({
      queue: options.queue
    });

    function prepareData() { // FIXME: This returns data *and* has side-effects, but shouldn't...
      return Promise.try(function() {
        return getData();
      }).then(function(bucketData) {
        swigFunctions.setData(bucketData.data);
        swigFunctions.setTypeInfo(bucketData.typeInfo);
        swigFunctions.setSettings(bucketData.settings);
        swigFilterAPI.setSiteDns(bucketData.siteDns);
        swigFilterAPI.setFirebaseConf(options.webhookConfig);
        swigFilterAPI.setTypeInfo(bucketData.typeInfo);

        return bucketData;
      });
    }

    function prepareLocals(locals) {
      return extend(locals, swigFunctions.getFunctions(), {
        firebase_conf: options.environmentOptions.webhookConfig,
        cmsSocketPort: options.config.listen.port,
        production: options.environmentOptions.production
      });
    }

    return {
      renderPages: require("./pages")({
        prepareData: prepareData,
        prepareLocals: prepareLocals,
        swigInstance: swigInstance,
        swigFunctions: swigFunctions,
        environment: env
      }),
      renderTemplates: require("./templates")({
        prepareData: prepareData,
        prepareLocals: prepareLocals,
        swigInstance: swigInstance,
        swigFunctions: swigFunctions,
        environment: env
      })
    }
  }
}