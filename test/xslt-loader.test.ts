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

test('xslt-loader supports XSLT 1.1', async () => {
    const stats = await runXsltLoader({stylesheetPath: './data/xslt/one.xsl'});
    const module = stats.toJson().modules[0];
    expect(JSON.parse(module.source)).toEqual(`\
<?xml version="1.0" encoding="UTF-8"?><foobar><message>Hello World!</message></foobar>`);
});

test('xslt-loader supports XSLT 3.0', async () => {
    const stats = await runXsltLoader({stylesheetPath: './data/xslt/three.xsl'});
    const module = stats.toJson().modules[0];
    expect(JSON.parse(module.source)).toEqual(`\
<?xml version="1.0" encoding="UTF-8"?><handledError/>`);
});

test('xslt-loader stylesheets can generate JSON', async () => {
    const stats = await runXsltLoader({stylesheetPath: './data/xslt/json-output.xsl', postLoaders: []});
    const module = stats.toJson().modules[0];
    expect(module.source).toEqual('{"message":"Hello World!"}');
    expect(JSON.parse(module.source)).toEqual({message: 'Hello World!'});
});

test('XSLT knows document location', async () => {
    const inputPath = path.resolve(__dirname, './data/xslt/data.xml');
    const stats = await runXsltLoader({inputPath, stylesheetPath: './data/xslt/document-location.xsl'});
    const module = stats.toJson().modules[0];
    expect(JSON.parse(module.source)).toEqual(`\
<?xml version="1.0" encoding="UTF-8"?><location>file://${inputPath}</location>`);
});

test('Apply TEI Prefilter XSLT', async () => {

    jest.setTimeout(30000);

    const stats = await runXsltLoader({
        stylesheetPath: '../src/xslt/tei-to-internal-json/msTeiPreFilter.xsl',
        inputPath: './data/tei/tei-full-item.xml',
    });

    const module = stats.toJson().modules[0];
    fs.readFile(path.resolve(__dirname, './data/tei/tei-prefiltered-item.xml'), (err, data) => {
        if (err) {
            throw err;
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
            throw err;
        }

        expect(JSON.parse(module.source).trim()).toEqual(data.toString().trim());
    });

});
