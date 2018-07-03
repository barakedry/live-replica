module.exports = {
    "env": {
        "browser": true,
        "es6": true,
        "node": true
    },
    "extends": "eslint:all",
    "rules": {
        "no-self-compare": "off",
        "no-sparse-arrays": "off",
        "no-ternary": "off",
        "multiline-ternary": "off",
        "no-underscore-dangle": "off",
        "accessor-pairs": "off",
        "array-bracket-spacing": [
            "error",
            "never"
        ],
        "arrow-body-style": [
            "error",
            "always"
        ],
        "arrow-spacing": [
            "error",
            {
                "before": true,
                "after": true
            }
        ],
        "block-scoped-var": "off",
        "callback-return": "off",
        "capitalized-comments": "off",
        "class-methods-use-this": "off",
        "comma-dangle": [
            "error",
            "never"
        ],
        "comma-spacing": [
            "error",
            {
                "before": false,
                "after": true
            }
        ],
        "comma-style": [
            "error",
            "last"
        ],
        "complexity": "off",
        "consistent-return": "off",
        "consistent-this": "off",
        "default-case": "off",
        "func-names": "off",
        "func-style": "off",
        "global-require": "off",
        "require-jsdoc": "off",
        "id-blacklist": "off",
        "id-length": [
            "error",
            {
                "min": 1
            }
        ],
        "indent": [
            "error",
            4
        ],
        "init-declarations": "off",
        "keyword-spacing": [
            "error",
            {
                "after": true
            }
        ],
        "line-comment-position": "off",
        "linebreak-style": [
            "error",
            "unix"
        ],
        "lines-around-comment": "off",
        "lines-around-directive": [
            "error",
            {
                "before": "never",
                "after": "always"
            }
        ],
        "max-depth": "off",
        "max-len": "off",
        "max-lines": "off",
        "max-nested-callbacks": "off",
        "max-params": [
            "error",
            6
        ],
        "max-statements": "off",
        "max-statements-per-line": "off",
        "newline-after-var": "off",
        "newline-per-chained-call": "off",
        "no-extra-parens": "off",
        "no-inline-comments": "off",
        "no-labels": [
            "error",
            {
                "allowLoop": false,
                "allowSwitch": false
            }
        ],
        "no-magic-numbers": "off",
        "no-multi-str": "off",
        "no-negated-condition": "off",
        "no-param-reassign": "off",
        "no-plusplus": "off",
        "no-process-env": "off",
        "no-prototype-builtins": "off",
        "no-restricted-imports": "off",
        "no-restricted-properties": "off",
        "no-undefined": "off",
        "no-useless-rename": [
            "error",
            {
                "ignoreDestructuring": false,
                "ignoreImport": false,
                "ignoreExport": false
            }
        ],
        "no-var": "off",
        "object-curly-newline": "off",
        "object-property-newline": "off",
        "object-curly-spacing": [
            "error",
            "always"
        ],
        "object-shorthand": "off",
        "one-var": "off",
        "one-var-declaration-per-line": [
            "error",
            "always"
        ],
        "padded-blocks": "off",
        "prefer-arrow-callback": "off",
        "prefer-const": "off",
        "prefer-destructuring": "off",
        "prefer-numeric-literals": "off",
        "prefer-rest-params": "off",
        "prefer-spread": "off",
        "prefer-template": "off",
        "quote-props": [
            "error",
            "as-needed"
        ],
        "quotes": [
            "error",
            "single",
            "avoid-escape"
        ],
        "rest-spread-spacing": [
            "error",
            "never"
        ],
        "semi-spacing": [
            "error",
            {
                "before": false,
                "after": true
            }
        ],
        "sort-imports": [
            "error",
            {
                "memberSyntaxSortOrder": [
                    "none",
                    "all",
                    "multiple",
                    "single"
                ]
            }
        ],
        "sort-keys": "off",
        "sort-vars": "off",
        "space-before-blocks": "off",
        "space-before-function-paren": "off",
        "space-in-brackets": "off",
        "space-in-parens": "off",
        "spaced-comment": "off",
        "template-curly-spacing": [
            "error",
            "never"
        ],
        "unicode-bom": [
            "error",
            "never"
        ],
        "valid-jsdoc": "off",
        // "valid-jsdoc": [
        //     "error",
        //     {
        //         "requireReturn": false,
        //         "prefer": {
        //             "return": "returns"
        //         }
        //     }
        // ],
        "vars-on-top": "off",
        "yield-star-spacing": [
            "error",
            "after"
        ]
    }
};

