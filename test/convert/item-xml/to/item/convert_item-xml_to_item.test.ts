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
</item>
`;

    await expect(executeXslt('', xml, itemXmlToJsonStylesheet)).rejects.toThrowError(new RegExp(`\
Error: Cannot create @namespace: CURIE prefix foo is bound to multiple URIs: \
http://example.com/a http://example.com/b`));
});
