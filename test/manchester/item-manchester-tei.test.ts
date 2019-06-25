import {DocumentFile, XsltTransformer} from 'cudl-node-xslt-java-bridge';
import * as path from 'path';
import {promisify} from 'util';
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

async function applyStylesheet(stylesheetPath: string, xml: string): Promise<string> {
    const transformer = new XsltTransformer(stylesheetPath);
    const transform = promisify(transformer.transform.bind(transformer));
    const results: DocumentFile[] = await transform({base: '/tmp', path: 'input.xml', contents: xml});

    if(results.length !== 1) {
        throw new Error(`Expected 1 result from XSLT transform but got ${results.length}`);
    }
    const [{contents}] = results;
    return contents;
}

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

    const result = JSON.parse(await applyStylesheet(itemXmlToJsonStylesheet, xml));
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

    await expect(applyStylesheet(itemXmlToJsonStylesheet, xml)).rejects.toThrowError(new RegExp(`\
Error: Cannot create @namespace: CURIE prefix foo is bound to multiple URIs: \
http://example.com/a http://example.com/b`));
});
