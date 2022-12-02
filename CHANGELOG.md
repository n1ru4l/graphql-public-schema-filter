# @n1ru4l/graphql-public-schema-filter

## 1.1.0

### Minor Changes

- [#171](https://github.com/n1ru4l/graphql-public-schema-filter/pull/171) [`5169495`](https://github.com/n1ru4l/graphql-public-schema-filter/commit/5169495f25d0c9009a0ebf388c9066dd8ad55c62) Thanks [@joseph-neeraj](https://github.com/joseph-neeraj)! - accept an onWarning callback as parameter to the buildPublicSchema function

### Patch Changes

- [#174](https://github.com/n1ru4l/graphql-public-schema-filter/pull/174) [`7b4485c`](https://github.com/n1ru4l/graphql-public-schema-filter/commit/7b4485cf60dd76cf70b6f04c0973147943b225a9) Thanks [@joseph-neeraj](https://github.com/joseph-neeraj)! - fixed bug where the ast node was left unchanged after filtering the schema

## 1.0.0

### Major Changes

- [#159](https://github.com/n1ru4l/graphql-public-schema-filter/pull/159) [`2b3b576`](https://github.com/n1ru4l/graphql-public-schema-filter/commit/2b3b5762096f9d6e86e76e626f869162b3dad2a2) Thanks [@joseph-neeraj](https://github.com/joseph-neeraj)! - Upgrade to graphql 16

## 0.4.0

### Minor Changes

- 04a3f8f: support hiding non null arguments

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
