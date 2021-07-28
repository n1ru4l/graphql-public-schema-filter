---
"@n1ru4l/graphql-public-schema-filter": minor
---

BREAKING: remove `directiveToExtensionsTransform`, the `buildPublicSchema` now checks both extension fields and directive usages.

BREAKING: Change function parameter signature for `buildPublicSchema` to an object, allow overwriting the `isPublic` function which is used to determine whether a field should be public based on extensions and or schema directives.
