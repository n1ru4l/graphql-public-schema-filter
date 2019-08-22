"use strict";

module.exports = {
  parser: "@typescript-eslint/parser",
  plugins: ["jest"],
  env: {
    es6: true,
    browser: true,
    node: true
  },
  extends: [
    "plugin:@typescript-eslint/recommended",
    "eslint:recommended",
    "plugin:jest/recommended",
    "prettier",
    "prettier/@typescript-eslint"
  ],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module"
  },
  rules: {
    "prefer-const": ["error"],
    "no-var": ["error"],
    eqeqeq: ["error"],
    camelcase: ["error"],
    "no-console": ["off"],
    "no-unused-vars": ["error"],
    "@typescript-eslint/explicit-function-return-type": ["off"]
  },
  overrides: [
    {
      files: "*.spec.js",
      env: {
        "jest/globals": true
      }
    }
  ]
};
