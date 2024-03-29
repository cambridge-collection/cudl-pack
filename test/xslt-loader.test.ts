import "jest-xml-matcher";
import * as path from "path";
import webpack from "webpack";
import compiler from "./compiler";
import { getModuleSource } from "./util";

interface Options {
    stylesheetPath: string;
    inputPath?: string;
    postLoaders?: webpack.RuleSetUseItem[];
}
export function runXsltLoader({
    stylesheetPath,
    inputPath,
    postLoaders,
}: Options) {
    inputPath = inputPath || "./data/xslt/data.xml";
    postLoaders = postLoaders || ["../src/loaders/json-raw-loader.ts"];

    return compiler(inputPath, [
        {
            type: "json",
            test: /\.xml$/,
            use: postLoaders.concat([
                {
                    loader: "../src/loaders/xslt-loader.ts",
                    options: { stylesheet: stylesheetPath },
                },
            ]),
        },
    ]);
}

test("xslt-loader supports XSLT 1.1", async () => {
    const stats = await runXsltLoader({
        stylesheetPath: "./data/xslt/one.xsl",
    });
    expect(JSON.parse(getModuleSource("./data/xslt/data.xml", stats)))
        .toEqualXML(`\
<?xml version="1.0" encoding="UTF-8"?><foobar><message>Hello World!</message></foobar>`);
});

test("xslt-loader supports XSLT 3.0", async () => {
    const stats = await runXsltLoader({
        stylesheetPath: "./data/xslt/three.xsl",
    });
    expect(JSON.parse(getModuleSource("./data/xslt/data.xml", stats)))
        .toEqualXML(`\
<?xml version="1.0" encoding="UTF-8"?><handledError/>`);
});

test("xslt-loader stylesheets can generate JSON", async () => {
    const stats = await runXsltLoader({
        stylesheetPath: "./data/xslt/json-output.xsl",
        postLoaders: [],
    });
    const source = getModuleSource("./data/xslt/data.xml", stats);
    expect(source).toEqual('{"message":"Hello World!"}');
    expect(JSON.parse(source)).toEqual({ message: "Hello World!" });
});

test("XSLT knows document location", async () => {
    const inputPath = path.resolve(__dirname, "./data/xslt/data.xml");
    const stats = await runXsltLoader({
        inputPath,
        stylesheetPath: "./data/xslt/document-location.xsl",
    });
    expect(JSON.parse(getModuleSource("./data/xslt/data.xml", stats)))
        .toEqualXML(`\
<?xml version="1.0" encoding="UTF-8"?><location>file://${inputPath}</location>`);
});
