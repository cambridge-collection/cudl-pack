module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint", "prettier"],
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended",
        "prettier",
    ],
    rules: {
        "@typescript-eslint/no-empty-function": [
            "error",
            {
                // Allow use of empty private class constructors, as they have
                // the purpose of preventing the use of new to create an
                // instance outside the class itself.
                allow: ["private-constructors"],
            },
        ],
    },
};
