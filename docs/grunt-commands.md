Message should now be serialized JSON, instead of a colon-delimited string.

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

## build

* __Old:__ `build`
* __New:__ `{site: "$site", token: "$token", messageType: "build"}`

Responses:

* `{messageType: "done"}`
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