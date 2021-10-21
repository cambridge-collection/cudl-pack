import path from "path";
import webpack from "webpack";
import { generateItemJson, parseItemJson } from "../src/item";
import { Item } from "../src/item-types";
import compiler from "./compiler";
import { getModuleSource, readPathAsString } from "./util";

const rules: webpack.RuleSetRule[] = [
    {
        type: "json",
        test: /\.json$/,
        use: {
            loader: path.resolve(
                __dirname,
                "../src/loaders/item-image-page-mapping-loader.ts"
            ),
            options: {
                imageServerPath: "https://images.example.ac.uk/iiif/",
                imageType: "iiif",
            },
        },
    },
];

test("test loading CSV file and generating page mapped item JSON", async () => {
    const stats = await compiler(
        "./data/item/image-mapping/item-with-linked-pagination.json",
        rules
    );

    // validate the input against item schema
    const dataInput: string = await readPathAsString(
        "./data/item/image-mapping/item-with-linked-pagination.json"
    );
    const itemIn: Item = parseItemJson(generateItemJson(JSON.parse(dataInput)));
    expect(itemIn).toEqual(JSON.parse(dataInput));

    // validate the output against item schema
    const dataOutput: string = await readPathAsString(
        "./data/item/image-mapping/item-with-pagination-inserted.json"
    );
    const itemOut: Item = parseItemJson(
        generateItemJson(JSON.parse(dataOutput))
    );
    expect(itemOut).toEqual(JSON.parse(dataOutput));

    // validate JSON generated against expected value.
    expect(
        JSON.parse(
            getModuleSource(
                "./data/item/image-mapping/item-with-linked-pagination.json",
                stats
            )
        )
    ).toEqual(JSON.parse(dataOutput));
});

test("test missing option imageServerPath", async () => {
    const invalidRules: webpack.RuleSetRule[] = [
        {
            type: "json",
            test: /\.json$/,
            use: {
                loader: path.resolve(
                    __dirname,
                    "../src/loaders/item-image-page-mapping-loader.ts"
                ),
                options: {
                    imageType: "iiif",
                },
            },
        },
    ];

    await expect(
        compiler(
            "./data/item/image-mapping/item-with-linked-pagination.json",
            invalidRules
        )
    ).rejects.toThrowError(
        /You need to set the imageServerPath and imageType parameters in your loader options./
    );
});

test("test missing option imageType", async () => {
    const invalidRules: webpack.RuleSetRule[] = [
        {
            type: "json",
            test: /\.json$/,
            use: {
                loader: path.resolve(
                    __dirname,
                    "../src/loaders/item-image-page-mapping-loader.ts"
                ),
                options: {
                    imageServerPath: "https://images.example.ac.uk/iiif/",
                },
            },
        },
    ];

    await expect(
        compiler(
            "./data/item/image-mapping/item-with-linked-pagination.json",
            invalidRules
        )
    ).rejects.toThrowError(
        /You need to set the imageServerPath and imageType parameters in your loader options./
    );
});

test("test invalid CSV", async () => {
    await expect(
        compiler(
            "./data/item/image-mapping/invalid-item-with-linked-pagination.json",
            rules
        )
    ).rejects.toThrowError(
        /Problem parsing CSV. Each row should contain <url>|<label>/
    );
});
