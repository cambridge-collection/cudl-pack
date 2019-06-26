import {execute as executeXslt} from '@lib.cam/xslt-nailgun';
import * as path from 'path';
import webpack from 'webpack';
import compiler from '../compiler';
import {readPathAsString} from '../util';

const itemXmlToJsonStylesheet = path.resolve(__dirname, '../../src/loaders/manchester/item-xml-to-json.xsl');

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

test('item-xml-to-json.xsl populates @namespace with custom CURIEs', async () => {
    const xml = `\
<item xmlns:foo="http://example.com/foo"
      xmlns:bar="http://example.com/bar"
      xmlns:baz="http://example.com/baz"
      xmlns:unused="http://example.com/unused">
    <data>
        <data type="foo:a" role="bar:b baz:c boz:d"/>
    </data>
</item>
`;

    const result = JSON.parse((await executeXslt('', xml, itemXmlToJsonStylesheet)).toString());
    expect(result['@namespace']).toEqual({
        foo: 'http://example.com/foo',
        bar: 'http://example.com/bar',
        baz: 'http://example.com/baz',
    });
});

test('item-xml-to-json.xsl fails to create @namespace when CURIE prefix has multiple bindings', async () => {
    const xml = `\
<item>
    <data>
        <data xmlns:foo="http://example.com/a" type="foo:x"/>
        <data xmlns:foo="http://example.com/b" type="foo:y"/>
    </data>
</item>
`;

    await expect(executeXslt('', xml, itemXmlToJsonStylesheet)).rejects.toThrowError(new RegExp(`\
Error: Cannot create @namespace: CURIE prefix foo is bound to multiple URIs: \
http://example.com/a http://example.com/b`));
});
