// Flat config (ESLint 9+). Replaces .eslintrc.js files.
const js = require("@eslint/js");
const globals = require("globals");
const noUnsanitized = require("eslint-plugin-no-unsanitized");

const styleRules = {
  "indent": ["error", 2],
  "linebreak-style": ["error", "unix"],
  "quotes": ["error", "double"],
  "semi": ["error", "always"],
  // Allow intentionally unused catch params named with a leading underscore
  // (keeps ES2019-compatible syntax for older Firefox targets).
  "no-unused-vars": ["error", {
    "args": "after-used",
    "caughtErrors": "all",
    "caughtErrorsIgnorePattern": "^_"
  }]
};

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "coverage/**",
      ".nyc_output/**",
      "build/**",
      "web-ext-artifacts/**"
    ]
  },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.es2020,
        browser: "readonly",
        chrome: "readonly"
      }
    },
    plugins: {
      "no-unsanitized": noUnsanitized
    },
    rules: {
      ...styleRules,
      "no-unsanitized/method": ["error"],
      "no-unsanitized/property": [
        "error",
        {
          escape: {
            taggedTemplates: ["escaped"]
          }
        }
      ]
    }
  },
  {
    files: ["test/**/*.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "script",
      globals: {
        ...globals.node,
        ...globals.mocha,
        ...globals.es2020,
        expect: "readonly",
        loadWebExtension: "readonly",
        sinon: "readonly",
        geckodriver: "readonly",
        until: "readonly",
        By: "readonly",
        internalUUID: "readonly"
      }
    },
    rules: {
      ...styleRules,
      // Test files reuse global names as locals (mirrors pre-flat-config
      // behavior where redeclaring configured globals was allowed).
      "no-redeclare": ["error", { "builtinGlobals": false }]
    }
  }
];
