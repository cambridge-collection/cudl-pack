import {DocumentFile, XsltTransformer} from 'cudl-node-xslt-java-bridge';
import * as path from 'path';
import {promisify} from 'util';
import webpack from 'webpack';
import compiler from '../compiler';
import {readPathAsString} from '../util';

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

test('item-manchester-tei.xsl converts TEI to package item XML representation', async () => {
    const stats = await runXsltLoader({
        stylesheetPath: path.resolve(__dirname, '../../src/loaders/manchester/item-manchester-tei.xsl'),
        inputPath: './manchester/data/MS-HEBREW-GASTER-00086.xml',
    });
    const module = stats.toJson().modules[0];
    expect(JSON.parse(module.source))
        .toEqual(await readPathAsString('manchester/data/MS-HEBREW-GASTER-00086.item.xml'));
});
