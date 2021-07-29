# @n1ru4l/graphql-public-schema-filter

## 0.3.1

### Patch Changes

- a07141a: update to latest graphql-tools version

## 0.3.0

### Minor Changes

- 345fda6: BREAKING: remove `directiveToExtensionsTransform`, the `buildPublicSchema` now checks both extension fields and directive usages.

  BREAKING: Change function parameter signature for `buildPublicSchema` to an object, allow overwriting the `isPublic` function which is used to determine whether a field should be public based on extensions and or schema directives.

### Patch Changes

- 345fda6: handle interface fields annotated with directives

## 0.2.0

### Minor Changes

- f90f4f4: target es2019

## 0.1.0

### Minor Changes

- 8f5947b: initial release
