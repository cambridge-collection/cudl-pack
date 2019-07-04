import {execute as executeXslt} from '@lib.cam/xslt-nailgun';
import * as path from 'path';
import {root} from '../../../../util';

const itemXmlToJsonStylesheet = path.resolve(root, 'src/convert/item-xml/to/item/transform.xsl');

test('generated item JSON contains the item @type URI', async () => {
    const result = JSON.parse((await executeXslt('', '<item/>', itemXmlToJsonStylesheet)).toString());
    expect(result['@type']).toBe('https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json');
});

test('item-xml-to-json.xsl populates @namespace with custom CURIEs', async () => {
    const xml = `\
<item xmlns:foo="http://example.com/foo"
      xmlns:bar="http://example.com/bar"
      xmlns:baz="http://example.com/baz"
      xmlns:unused="http://example.com/unused">
    <data>
        <data type="foo:a" role="bar:b baz:c boz:d cdl-role:foo"/>
    </data>
</item>`;

    const result = JSON.parse((await executeXslt('', xml, itemXmlToJsonStylesheet)).toString());
    // The cdl-role:foo URI uses the default prefix cdl-role, so it doesn't get
    // a namespace entry.
    expect(result['@namespace']).toEqual({
        foo: 'http://example.com/foo',
        bar: 'http://example.com/bar',
        baz: 'http://example.com/baz',
    });
});

test('@namespace will override default prefixes if they don\'t conflict', async () => {
    const xml = `\
<item xmlns:cdl-role="http://example.com/foo">
    <data>
        <data type="foo:a" role="cdl-role:foo"/>
    </data>
</item>`;

    const result = JSON.parse((await executeXslt('', xml, itemXmlToJsonStylesheet)).toString());
    expect(result['@namespace']).toEqual({
        'cdl-role': 'http://example.com/foo',
    });
});

test('item-xml-to-json.xsl fails to create @namespace when CURIE prefix has multiple bindings', async () => {
    const xml = `\
<item>
    <data>
        <data xmlns:foo="http://example.com/a" type="foo:x"/>
        <data xmlns:foo="http://example.com/b" type="foo:y"/>
    </data>
</item>`;

    await expect(executeXslt('', xml, itemXmlToJsonStylesheet)).rejects.toThrowError(new RegExp(`\
Error: Cannot create @namespace: CURIE prefix foo is bound to multiple URIs: \
http://example.com/a http://example.com/b`));
});

test('item-xml-to-json.xsl generates data for cdl-data:link', async () => {
    const xml = `\
<item>
    <data type="cdl-data:link" role="cdl-role:foo cdl-role:bar" href="./foo"/>
    <data type="cdl-data:link" href="./bar"/>
</item>`;

    const result = JSON.parse(await applyXslt(itemXmlToJsonStylesheet, xml));
    expect(result.data).toEqual([
        {'@type': 'cdl-data:link', '@role': 'cdl-role:foo cdl-role:bar', href: {'@id': './foo'}},
        {'@type': 'cdl-data:link', href: {'@id': './bar'}},
    ]);
});

test('item-xml-to-json.xsl generates data for cdl-data:properties', async () => {
    const xml = `\
<item>
    <data type="cdl-data:properties" role="cdl-role:foo cdl-role:bar">
        <string key="a">foobar</string>
        <number key="b">4.3</number>
        <true key="c"/>
        <false key="d"/>
        <array key="e">
            <string>123</string>
            <number>32</number>
            <true/>
            <false/>
            <array>
                <string>abc</string>
                <number>42</number>
            </array>
        </array>
    </data>
</item>`;

    const result = JSON.parse(await applyXslt(itemXmlToJsonStylesheet, xml));
    expect(result.data).toEqual([
        {'@type': 'cdl-data:properties', '@role': 'cdl-role:foo cdl-role:bar',
            a: 'foobar',
            b: 4.3,
            c: true,
            d: false,
            e: ['123', 32, true, false, ['abc', 42]],
        },
    ]);
});

test('item-xml-to-json.xsl fails if unhandled <data> exists', async () => {
    const xml = `\
<item>
    <data type="unknown"/>
</item>`;

    await expect(applyXslt(itemXmlToJsonStylesheet, xml)).rejects
        .toThrowError('item:error: No template handled item data with type: unknown');
});

test('item-xml-to-json.xsl can handle custom data by extending stylesheet', async () => {
    const xml = `\
<item xmlns:example-data="http://example.org/data/">
    <data type="example-data:custom" foo="abc"/>
</item>`;

    const result = JSON.parse(await applyXslt(path.resolve(__dirname, 'custom-data.xsl'), xml));
    expect(result.data).toEqual([
        {'@type': 'example-data:custom', foo: 'abc'},
    ]);
});
