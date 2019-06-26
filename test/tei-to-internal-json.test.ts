import fs from 'fs';
import * as path from 'path';
import webpack from 'webpack';
import compiler from './compiler';

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

test('Test XSLT for loading TEI to Internal JSON', async () => {

    jest.setTimeout(30000);

    const stats = await runXsltLoader({
        stylesheetPath: '../src/xslt/tei-to-internal-json/msTeiPreFilter.xsl',
        inputPath: './data/tei/tei-full-item.xml',
    });

    const module = stats.toJson().modules[0];
    fs.readFile(path.resolve(__dirname, './data/tei/tei-prefiltered-item.xml'), (err, data) => {
        if (err) {
            return Promise.reject(err);
        }

        expect(JSON.parse(module.source).trim()).toEqual(data.toString().trim());
    });

});

test('Apply TEI DocFormatter XSLT', async () => {

    jest.setTimeout(30000);

    const stats = await runXsltLoader({
        stylesheetPath: '../src/xslt/tei-to-internal-json/jsonDocFormatter.xsl',
        inputPath: './data/tei/tei-prefiltered-item.xml',
    });

    const module = stats.toJson().modules[0];
    fs.readFile(path.resolve(__dirname, './data/tei/tei-json-output.json'), (err, data) => {
        if (err) {
            return Promise.reject(err);
        }

        expect(JSON.parse(module.source).trim()).toEqual(data.toString().trim());
    });

});
