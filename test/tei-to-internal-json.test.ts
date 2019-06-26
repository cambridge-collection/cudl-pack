import fs from 'fs';
import * as path from 'path';
import webpack from 'webpack';
import compiler from './compiler';
import {readPathAsString} from './util';

interface Options {
    stylesheetPath: string;
    inputPath?: string;
    postLoaders?: webpack.RuleSetUseItem[];
}
function runXsltLoader({stylesheetPath, inputPath, postLoaders}: Options) {
    inputPath = inputPath || './data/xslt/data.xml';
    postLoaders = postLoaders || ['../src/loaders/json-raw-loader.ts'];

    return compiler(inputPath, [{
        type: 'json',
        test: /\.xml$/,
        use: postLoaders.concat([
            {
                loader: '../src/loaders/xslt-loader.ts',
                options: {stylesheet: stylesheetPath},
            },
        ]),
    }]);
}

test('test that msTeiPreFilter converts item TEI to required XML format', async () => {

    jest.setTimeout(30000);

    const stats = await runXsltLoader({
        stylesheetPath: '../src/xslt/tei-to-internal-json/msTeiPreFilter.xsl',
        inputPath: './data/tei/tei-full-item.xml',
    });

    const module = stats.toJson().modules[0];
    const data: string = await readPathAsString(path.resolve(__dirname, './data/tei/tei-prefiltered-item.xml'))
        .catch((err) => {
            return Promise.reject(err);
        });

    // Comparing strings as this is XML.
    expect(JSON.parse(module.source).trim()).toEqual(data.trim());

});

test('test that jsonDocFomatter converts item XML to internal JSON format', async () => {

    jest.setTimeout(30000);

    const stats = await runXsltLoader({
        stylesheetPath: '../src/xslt/tei-to-internal-json/jsonDocFormatter.xsl',
        inputPath: './data/tei/tei-prefiltered-item.xml',
    });

    const module = stats.toJson().modules[0];
    const data: string = await readPathAsString(path.resolve(__dirname, './data/tei/tei-json-output.json'))
        .catch((err) => {
            return Promise.reject(err);
        });

    expect(JSON.parse(JSON.parse(module.source))).toEqual(JSON.parse(data));

});
