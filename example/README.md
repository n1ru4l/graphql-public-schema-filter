# Example

Example show-casing the code-first approach.

## Install Dependencies

```bash
yarn install
```

## Start Server

```bash
yarn start
```

## Usage

introspect the server using the following headers: `Authorization: public` and `Authorization: private`.

The private schema (with access to the `Query.secret` field) is only served when the Authorization header is set to `private`.
