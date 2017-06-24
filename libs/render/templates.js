var Promise = require("bluebird");
var urlJoin = require("url-join");
var path = require("path");
var defaultValue = require("default-value");
var dotty = require("dotty");
var globAsync = Promise.promisify(require("glob"));
const promiseTaskQueue = require("promise-task-queue");

var createSlugGenerator = require("../util/generate-slug");
var createItemSlugGenerator = require("../util/get-item-slug");
var isPublished = require("../util/is-published");
var getTemplateOverrideField = require("../util/get-template-override-field");

// FIXME: Make the below a proper configuration option...
let alwaysRenderPreviews = false; // Set to `true` to render previews even for published articles

module.exports = function(options) {
  var env = options.environment;

  var parseTemplatePath = require("../util/parse-template-path")(env);
  var writeTemplate = require("./write-template")({
    swigInstance: options.swigInstance,
    swigFunctions: options.swigFunctions,
    environment: env
  });

  return function renderTemplates() {
    return Promise.try(function() {
      env.logger.ok('Rendering templates...');
      return Promise.all([
        options.prepareData(),
        globAsync(env.environmentPath("templates/**/*.html"))
      ]);
    }).spread(function(bucketData, paths) {
      var allTypeInfo = bucketData.typeInfo;
      var data = bucketData.data;

      var generateSlug = createSlugGenerator();
      var getItemSlug = createItemSlugGenerator(generateSlug);
      env.logger.ok('Rendering Templates');

      return Promise.filter(paths, function(templatePath) {
        var isPartial = (templatePath.indexOf(env.environmentPath("templates/partials")) === 0);
        var isTopLevel = (templatePath.replace(env.environmentPath("templates/"), "").split("/").length <= 1);
        var isLayout = /^\/templates\/[^\/]\/layouts\//.test(templatePath.replace(env.environmentPath(""), ""));
        return (!isPartial && !isTopLevel && !isLayout);
      }).map(function(templatePath) {
        var parsedPath = parseTemplatePath(templatePath);

        /* actualPath indices example:
         *  sites/foobar.com/templates/videogames/images/screenshots.html
         *                             ^ 0        ^ ...  ^ (length - 1)
         */
        var actualPath = templatePath.replace(env.environmentPath("templates/"), "");
        var actualPathSegments = actualPath.split("/");

        var itemType = actualPathSegments[0];
        var typeInfo = allTypeInfo[itemType];
        var templateOverrideField = getTemplateOverrideField(typeInfo);
        var typeData = defaultValue(data[itemType], {});

        var items = Object.keys(typeData).map(function(key) {
          return {
            key: key, // REFACT: Can we get rid of this?
            value: typeData[key]
          }
        });

        items.forEach(function(item) {
          item.value._type = itemType;
          item.value._id = item.key;
        });

        if (parsedPath.basename === "list") {
          var categoryUrlSegments;

          if (dotty.exists(typeInfo, "customUrls.listUrl")) {
            if (typeInfo.customUrls.listUrl === "#") {
              categoryUrlSegments = [ itemType ];
            } else {
              categoryUrlSegments = [ typeInfo.customUrls.listUrl ];
            }
          } else {
            categoryUrlSegments = [ itemType ];
          }

          var url = categoryUrlSegments.join("/");

          return writeTemplate(templatePath, env.buildDirectoryPath(url), "/" + url, options.prepareLocals({}));
        } else if (parsedPath.basename === "individual") {
          return Promise.map(items, function(item) {
            var itemTemplatePath;

            if (templateOverrideField != null && item.value[templateOverrideField] != null) {
              /* A custom template was specified for this item. */
              var customTemplate = item.value[templateOverrideField];
              itemTemplatePath = env.environmentPath(path.join("templates", itemType, "layouts", customTemplate));
            } else {
              itemTemplatePath = templatePath;
            }

            var publishedRender, previewRender;

            if (isPublished(item.value)) {
              var publishedUrl = getItemSlug(item.value, typeInfo);

              publishedRender = writeTemplate(itemTemplatePath, env.buildDirectoryPath(publishedUrl), "/" + publishedUrl, options.prepareLocals({item: item.value}));
            }

            if (alwaysRenderPreviews || !isPublished(item.value)) {
              var previewUrl = urlJoin("_wh_previews", item.value.preview_url);

              previewRender = writeTemplate(itemTemplatePath, env.buildDirectoryPath(previewUrl), "/" + previewUrl, options.prepareLocals({item: item.value}), {
                noIndex: true
              });
            }

            return Promise.all([
              publishedRender,
              previewRender
            ]);
          });
        } else {
          /* Sub-page templates... */
          return Promise.map(items, function(item) {
            if (isPublished(item.value)) {
              /* Using actualPathSegments, slice(1, -1):
               *  sites/foobar.com/templates/videogames/more/images/screenshots.html
               *                             ^ 0        ^ 1  ^ 2    ^ 3 (-1)
               * Result: ["more", "images"]
               */
              var publishedUrl = getItemSlug(item.value, typeInfo);
              var subPagePathSegments = actualPathSegments.slice(1, -1).concat([parsedPath.basename]);
              var url = [publishedUrl].concat(subPagePathSegments).join("/");

              // FIXME: Sub-pages are not rendered for previews? It was like this in the original code...
              return writeTemplate(templatePath, env.buildDirectoryPath(url), "/" + url, options.prepareLocals({item: item.value}));
            }
          });
        }
      })
    }).then(function() {
      env.logger.ok("Finished rendering templates");
    })
  }
}
