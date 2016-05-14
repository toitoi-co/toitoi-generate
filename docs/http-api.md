# HTTP API

For any routes that indicate needing Firebase token authentication, the following header must be sent along:

```
X-Token: $token
```

... where `$token` is replaced with the Firebase token.

## Models

### Image

* __url:__ URL to the uploaded image. This will be a relative URL (eg. `/images/somesite.example.com/foobar.jpg`), and will __not__ include the viewing token. This URL is currently relative to the `-generate` server address.
* __filename:__ Filename of the uploaded image. You should specify this as the `resize_path` in Firebase image objects.
* __thumbnailUrl:__ Same as the `url`, but for the automatically generated thumbnail.
* __siteUrl:__ Similar to `url`, but for the generated site after it has been deployed. You should specify this as the `url` in Firebase image objects.
* __fileSize:__ The size of the image file, in bytes.
* __width:__ The width of the image, in pixels.
* __height:__ The height of the image, in pixels.
* __thumbnails:__ An array of already-rendered thumbnail sizes, each object in the array containing: __(Currently unused)__
	* __width:__ The width of the thumbnail, in pixels.
	* __height:__ The height of the thumbnail, in pixels.
* __croppedThumbnails:__ An array of already-rendered *cropped* (ie. fill-resized) thumbnail sizes, each object in the array containing: __(Currently unused)__
	* __width:__ The width of the thumbnail, in pixels.
	* __height:__ The height of the thumbnail, in pixels.

## Routes

### GET /images/:site

__Requires Firebase token authentication.__

Returns an array of all the Images that have been uploaded for this site.

### PUT /images/:site/:filename

__Requires Firebase token authentication.__

Uploads a new image. Expects the image data in question as the request body.

When successful, returns a `201` HTTP response code, along with a JSON object representing an Image.

Returns a `409` HTTP response code if the image already exists.

### GET /images/:site/:filename?token=:token
### GET /thumbnails/:site/:filename?token=:token

Responds with the specified image. The `token` must be obtained through the `imageToken` WebSocket call.

### GET /preview/:site/:previewKey/...

Responds with a fully browsable preview build. The `previewKey` is obtained from the response to the `build` command, and changes for every preview build.