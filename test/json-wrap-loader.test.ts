import path from "path";
import webpack from "webpack";
import compiler from "./compiler";

import loader, { Options } from "../src/loaders/json-wrap-loader";
import { getModule, getModuleSource } from "./util";
import assert from "assert";

test.each([
    [{ insertionPoint: "/foo" }, 123, { foo: 123 }],
    [{ insertionPoint: "/foo/bar" }, 123, { foo: { bar: 123 } }],
    [
        { insertionPoint: "/foo", template: { abc: 456 } },
        123,
        { foo: 123, abc: 456 },
    ],
    // jsonpointer / is the empty string at root
    [{ insertionPoint: "/" }, 123, { "": 123 }],
])(
    "loader with options query %s wraps %j as %j",
    (options: Options, source: unknown, expected: unknown) => {
        const jsonResult = loader.call(
            {
                getOptions() {
                    return options;
                },
            } as unknown as webpack.LoaderContext<Record<string, unknown>>,
            JSON.stringify(source)
        );
        assert(typeof jsonResult === "string");
        expect(JSON.parse(jsonResult)).toEqual(expected);
    }
);

test.each([
    [{ insertionPoint: "/text" }, { text: "Text\nfile.\n" }],
    [
        { insertionPoint: "/text", template: { abc: 456 } },
        { abc: 456, text: "Text\nfile.\n" },
    ],
])(
    "webpack applies loader with options %j resulting in %j",
    async (options: Options, expected) => {
        const rules: webpack.RuleSetRule[] = [
            {
                type: "json",
                test: /\.txt$/,
                use: [
                    {
                        loader: path.resolve(
                            __dirname,
                            "../src/loaders/json-wrap-loader.ts"
                        ),
                        options,
                    },
                    path.resolve(
                        __dirname,
                        "../src/loaders/json-raw-loader.ts"
                    ),
                ],
            },
        ];

        const stats = await compiler("./data/text.txt", rules);

        expect(getModule("./data/text.txt", stats).moduleType).toEqual("json");
        expect(JSON.parse(getModuleSource("./data/text.txt", stats))).toEqual(
            expected
        );
    }
);
