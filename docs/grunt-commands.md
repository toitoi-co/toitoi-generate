Message should now be serialized JSON, instead of a colon-delimited string. The WebSocket endpoint has moved from `/` to `/ws`.

Responses will be JSON. For all commands, a response with a `messageType` of `"message"` may be returned - these originate from the templater, and can't currently be tied to a particular operation.

For all commands, you can also specify a `commandId` property in the request, and all responses to the request (except for `"message"` responses like described above) will contain that same `commandId` as a property. This lets you tie responses to requests.

## supported_messages

* __Old:__ `supported_messages`
* __New:__ `{site: "$site", token: "$token", messageType: "supportedMessages"}`

Probably not useful anymore. Might be removed.

## generate_slug_v2

* __Old:__ `generate_slug_v2:{"name": "$name", "type": "$type", "date": "$date"}`
* __New:__ `{site: "$site", token: "$token", messageType: "generateSlugV2", name: "$name", "type": "$type", "date": "$date"}`

Likely buggy, best not to use it.

Responses:

* `{messageType: "done", slug: "$slug"}`

## publish

* __New:__ `{site: "$site", token: "$token", messageType: "publish"}`

Sets the current `previewData` as the published `data`. This will only copy over the data and __not__ build the site - for that, you will need to call `build` separately.

Responses:

* `{messageType: "done"}`
* `{messageType: "error", message: "jwt must be provided"}`
* `{messageType: "error", message: "jwt malformed"}`
* `{messageType: "error", message: "jwt expired"}`
* `{messageType: "error", message: "invalid signature"}`

## build

* __Old:__ `build`
* __New:__ `{site: "$site", token: "$token", messageType: "build", preview: "$preview"}`

(Re)builds the site. `preview` is a boolean, indicating whether the site should be built in preview mode or not.

When building a preview, a `previewKey` will be included in the response - this can be used to display the preview build to the user. See the HTTP API documentation of `-generate` for more details.

Responses:

* `{messageType: "done"}` (for public builds)
* `{messageType: "done", previewKey: "$previewKey"}` (for preview builds)
* `{messageType: "error", message: "jwt must be provided"}`
* `{messageType: "error", message: "jwt malformed"}`
* `{messageType: "error", message: "jwt expired"}`
* `{messageType: "error", message: "invalid signature"}`

## preset

* __Old:__ `preset:$url`
* __New:__ `{site: "$site", messageType: "preset", signedRequest: "$signedRequest"}`

Obtain the $signedRequest from the `admin-api`, via `POST /generate-signed-request/preset`.

Responses:

* `{messageType: "done", presetData: "$presetData"}`
* `{messageType: "error", message: "jwt must be provided"}`
* `{messageType: "error", message: "jwt malformed"}`
* `{messageType: "error", message: "jwt expired"}`
* `{messageType: "error", message: "invalid signature"}`

## preset_local

* __Old:__ `preset_local:$fileBase64`
* __New:__ `{site: "$site", token: "$token", messageType: "preset", data: "$fileBase64", encoding: "base64"}`

Still technically exists, but not currently in use.

Responses:

* `{messageType: "done", presetData: "$presetData"}`

## imageToken

* __New:__ `{site: "$site", token: "$token", messageType: "imageToken", "expiry": "$expiry"}`

Returns a new 'viewing token' for images for a given site. These tokens expire after the given `expiry`, and are used to prevent people from accidentally leaking access to their (unpublished) images.

The `expiry` value must be formatted according to what [`ms`](https://www.npmjs.com/package/ms) supports. An advisable value would be something like `5m`.

Responses:

* `{messageType: "done", imageToken: "$imageToken"}`