import {execute as executeXslt} from '@lib.cam/xslt-nailgun';
import * as path from 'path';
import {identify} from '../../../../../src/util/identified';
import {parseJSON, root} from '../../../../util';

const itemXmlToJsonStylesheet = path.resolve(root, 'src/convert/item-xml/to/item/transform.xsl');

test('generated item JSON contains the item @type URI', async () => {
    const result = parseJSON(await executeXslt({xml: '<item/>', xsltPath: itemXmlToJsonStylesheet}));
    expect(result['@type']).toBe('https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json');
});

test('item-xml-to-json.xsl populates @namespace with custom CURIEs', async () => {
    const xml = `\
<item xmlns:foo="http://example.com/foo"
      xmlns:bar="http://example.com/bar"
      xmlns:baz="http://example.com/baz"
      xmlns:unused="http://example.com/unused">
    <data type="cdl-data:link" role="foo:a bar:b baz:c boz:d cdl-role:foo" href=""/>
</item>`;

    const result = parseJSON(await executeXslt({xml, xsltPath: itemXmlToJsonStylesheet}));
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
    <data type="cdl-data:link" role="cdl-role:foo" href=""/>
</item>`;

    const result = parseJSON(await executeXslt({xml, xsltPath: itemXmlToJsonStylesheet}));
    expect(result['@namespace']).toEqual({
        'cdl-role': 'http://example.com/foo',
    });
});

test('item-xml-to-json.xsl fails to create @namespace when CURIE prefix has multiple bindings', async () => {
    const xml = `\
<item>
    <data xmlns:foo="http://example.com/a" type="foo:x"/>
    <data xmlns:foo="http://example.com/b" type="foo:y"/>
</item>`;

    await expect(executeXslt({xml, xsltPath: itemXmlToJsonStylesheet})).rejects.toThrowError(new RegExp(`\
Error: Cannot create @namespace: CURIE prefix foo is bound to multiple URIs: \
http://example.com/a http://example.com/b`));
});

test('item-xml-to-json.xsl generates data for cdl-data:link', async () => {
    const xml = `\
<item>
    <data type="cdl-data:link" role="cdl-role:foo cdl-role:bar" href="./foo"/>
    <data type="cdl-data:link" href="./bar"/>
</item>`;

    const result = parseJSON(await executeXslt({xml, xsltPath: itemXmlToJsonStylesheet}));
    expect(result.data).toEqual([
        {'@type': 'cdl-data:link', '@role': 'cdl-role:foo cdl-role:bar', href: {'@id': './foo'}},
        {'@type': 'cdl-data:link', href: {'@id': './bar'}},
    ]);
});

test('item-xml-to-json.xsl generates data for cdl-data:properties', async () => {
    const xml = `\
<item>
    <data type="cdl-data:properties" role="cdl-role:foo cdl-role:bar">
        <string name="a">foobar</string>
        <number name="b">4.3</number>
        <true name="c"/>
        <false name="d"/>
        <array name="e">
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

    const result = parseJSON(await executeXslt({xml, xsltPath: itemXmlToJsonStylesheet}));
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

    await expect(executeXslt({xml, xsltPath: itemXmlToJsonStylesheet})).rejects
        .toThrowError('item:error: No template handled item data with type: unknown');
});

test('item-xml-to-json.xsl can handle custom data by extending stylesheet', async () => {
    const xml = `\
<item xmlns:example-data="http://example.org/data/">
    <data type="example-data:custom" foo="abc"/>
</item>`;

    const result = JSON.parse(
        (await executeXslt({xml, xsltPath: path.resolve(__dirname, 'custom-data.xsl')})).toString());
    expect(result.data).toEqual([
        {'@type': 'example-data:custom', foo: 'abc'},
    ]);
});

test('item-xml-to-json.xsl translates item descriptions', async () => {
    const xml = `\
<item>
    <descriptions>
        <description name="main">
            <attributes>
                <attribute name="title" order="a" label="Title" value="Book of Foo"/>
                <attribute name="abstract" order="b" label="Abstract">This is a direct value.</attribute>
                <attribute name="author" order="c" label="Authors">
                    <value>Jim</value>
                    <value>Bob</value>
                </attribute>
                <attribute name="tags" order="z" label="Tags">
                    <value>book</value>
                </attribute>
            </attributes>
        </description>
    </descriptions>
</item>`;

    const result = parseJSON(await executeXslt({xml, xsltPath: itemXmlToJsonStylesheet}));
    expect(result.descriptions).toEqual({
        main: {
            coverage: {firstPage: true, lastPage: true},
            attributes: {
                title: {label: 'Title', order: 'a', value: 'Book of Foo'},
                abstract: {label: 'Abstract', order: 'b', value: 'This is a direct value.'},
                author: {label: 'Authors', order: 'c', value: ['Jim', 'Bob']},
                tags: {label: 'Tags', order: 'z', value: ['book']},
            },
        },
    });
});

test('description attribute @value value is plain text, not HTML', async () => {
    const xml = `\
<item>
    <descriptions>
        <description name="main">
            <attributes>
                <attribute name="example" label="Example" value="The HTML element &lt;b&gt; marks bold text."/>
            </attributes>
        </description>
    </descriptions>
</item>`;

    const result = parseJSON(await executeXslt({xml, xsltPath: itemXmlToJsonStylesheet}));
    expect(result.descriptions.main.attributes.example)
        .toEqual({label: 'Example', value: 'The HTML element &lt;b&gt; marks bold text.'});
});

test('description attribute values not in attributes are HTML', async () => {
    const xml = `\
<item>
    <descriptions>
        <description name="main">
            <attributes>
                <attribute name="example" label="Example">Bold text: <b>BOO!</b></attribute>
            </attributes>
        </description>
    </descriptions>
</item>`;

    const result = parseJSON(await executeXslt({xml, xsltPath: itemXmlToJsonStylesheet}));
    expect(result.descriptions.main.attributes.example)
        .toEqual({label: 'Example', value: 'Bold text: <b>BOO!</b>'});
});

test('description attribute values containing multiple elements are not wrapped in a single root', async () => {
    const xml = `\
<item>
    <descriptions>
        <description name="main">
            <attributes>
                <attribute name="example" label="Example"><h1>heading</h1><p>paragraph</p></attribute>
            </attributes>
        </description>
    </descriptions>
</item>`;

    const result = parseJSON(await executeXslt({xml, xsltPath: itemXmlToJsonStylesheet}));
    expect(result.descriptions.main.attributes.example)
        .toEqual({label: 'Example', value: '<h1>heading</h1><p>paragraph</p>'});
});

test('item-xml-to-json.xsl translates item pages', async () => {
    const xml = `\
<item>
    <pages>
        <page name="front" label="Front board"/>
        <page name="frontPasteDown" label="Front paste-down"/>
        <page name="p42" label="42"/>
        <page name="back" label="Back cover"/>
    </pages>
</item>`;

    const result = parseJSON(await executeXslt({xml, xsltPath: itemXmlToJsonStylesheet}));
    expect(result.pages).toEqual({
        front: {label: 'Front board', order: '0'},
        frontPasteDown: {label: 'Front paste-down', order: '1'},
        p42: {label: '42', order: '2'},
        back: {label: 'Back cover', order: '3'},
    });
});

test.each([
    [1, 1],
    [1, 10],
    [2, 11],
    [2, 100],
    [3, 101],
    [3, 1000],
    [4, 1001],
])('item-xml-to-json.xsl 0-pads page order values to width %d for items with %d pages', async (width, count) => {
    const pages = identify.index(Array.from({length: count}, (v, index) => ({
        [identify.id]: `p${index}`,
        label: `${index}`,
        order: `${index}`.padStart(width, '0'),
    })));
    const xmlPages = identify(pages).map(p => `<page name="${p[identify.id]}" label="${p.label}"/>`).join('');
    const xml = `<item><pages>${xmlPages}</pages></item>`;

    const result = parseJSON(await executeXslt({xml, xsltPath: itemXmlToJsonStylesheet}));
    expect(result.pages).toEqual(pages);
});
