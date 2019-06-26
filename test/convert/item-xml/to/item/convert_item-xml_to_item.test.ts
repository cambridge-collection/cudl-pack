import {execute as executeXslt} from '@lib.cam/xslt-nailgun';
import * as path from 'path';
import {root} from '../../../../util';

const itemXmlToJsonStylesheet = path.resolve(root, 'src/convert/item-xml/to/item/transform.xsl');

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
