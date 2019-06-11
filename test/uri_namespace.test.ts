import {Namespace} from '../src/uris';

function getNamespace() {
    return new Namespace([
        {curiePrefix: 'foo', uriPrefix: 'http://example.com/'},
        {curiePrefix: 'bar', uriPrefix: 'file:///tmp/'},
    ]);
}

test.each([
    ['foo:abc', 'http://example.com/abc'],
    ['bar:xyz/123', 'file:///tmp/xyz/123'],
    ['missing:xxx', 'missing:xxx'],
    ['http://example.org/blah', 'http://example.org/blah'],
])
('Namespace with prefixes \'foo\' and \'bar\' expands %j to %j', (input, result) => {
    expect(getNamespace().getExpandedUri(input)).toEqual(result);
});

test.each([
    ['http://example.com/abc', 'foo:abc'],
    ['file:///tmp/xyz/123', 'bar:xyz/123'],
    ['missing:xxx', 'missing:xxx'],
    ['http://example.org/blah', 'http://example.org/blah'],
])
('Namespace compacts %j to %j', (input, result) => {
    expect(getNamespace().getCompactedUri(input)).toEqual(result);
});

function getNamespaceFromNamespaceMap() {
    return Namespace.fromNamespaceMap({
        // redefine cdl-data
        'aa-cdl-data': 'https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json#/definitions/data/',
        a: 'http://example.com/',
        b: 'http://example.com/abc',
        c: 'http://example.com/abcd/3/',
        z: 'http://example.com/abcd/3/',
        d: 'http://example.com/abcd/3/',
    });
}

test.each([
    // Default CURIE definitions are higher priority than user-defined ones, so aa-cdl-data is not used (even though its
    // CURIE prefix sorts before cdl-data).
    ['https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json#/definitions/data/', 'cdl-data:'],

    ['http://example.com/', 'a:'],
    ['http://example.com/abc', 'b:'],
    ['http://example.com/abcd', 'b:d'],
    ['http://example.com/abcd/3/', 'c:'],
    ['http://example.com/abcd/3/', 'c:'],
])
('Namespace.fromNamespaceMap() compacts URIs deterministically', (uri, expectedCurie) => {
    const ns = getNamespaceFromNamespaceMap();
    expect(ns.getCompactedUri(uri)).toEqual(expectedCurie);
});
