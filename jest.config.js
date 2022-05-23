/* eslint-env node */
"use strict";

module.exports = {
  roots: ["<rootDir>/src"],
  transformIgnorePatterns: ["node_modules/(?!graphql)"],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
};
