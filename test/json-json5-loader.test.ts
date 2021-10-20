import fs from "fs";
import path from "path";
import { promisify } from "util";
import webpack from "webpack";

import { default as loader } from "../src/loaders/json-json5-loader";
import compiler from "./compiler";
import { ensureDefined, getModule, getModuleSource } from "./util";

const decodedExampleJson5 = {
    unquoted: "and you can quote me on that",
    singleQuotes: 'I can use "double quotes" here',
    lineBreaks: "Look, Mom! No \\n's!",
    hexadecimal: 0xdecaf,
    leadingDecimalPoint: 0.8675309,
    andTrailing: 8675309,
    positiveSign: +1,
    trailingComma: "in objects",
    andIn: ["arrays"],
    backwardsCompatible: "with JSON",
};

test("loader function converts json5 to json", async () => {
    const json5 = await promisify(fs.readFile)(
        path.resolve(__dirname, "data/json5/example.json5"),
        { encoding: "utf-8" }
    );

    const result = loader(json5);
    expect(typeof result).toBe("string");
    expect(JSON.parse(result)).toEqual(decodedExampleJson5);
});

test("webpack loads json5 to json with loader ", async () => {
    const rules: webpack.RuleSetRule[] = [
        {
            type: "json",
            test: /\.json5$/,
            use: path.resolve(__dirname, "../src/loaders/json-json5-loader.ts"),
        },
    ];

    const stats = await compiler("./data/json5/example.json5", rules);

    expect(getModule("./data/json5/example.json5", stats).moduleType).toEqual(
        "json"
    );
    expect(
        JSON.parse(getModuleSource("./data/json5/example.json5", stats))
    ).toEqual(decodedExampleJson5);
});

test("webpack reports error when loading invalid json5", async () => {
    const rules: webpack.RuleSetRule[] = [
        {
            type: "json",
            test: /\.json5$/,
            use: path.resolve(__dirname, "../src/loaders/json-json5-loader.ts"),
        },
    ];

    try {
        await compiler("./data/json5/invalid.json5", rules);
        fail();
    } catch (error) {
        const msg = `${error}`;
        expect(msg).toMatch(/\.\/data\/json5\/invalid\.json5/);
        expect(msg).toMatch(
            /Module build failed \(from \.\.\/src\/loaders\/json-json5-loader\.ts\)/
        );
        expect(msg).toMatch(/SyntaxError: JSON5: /);
    }
});
