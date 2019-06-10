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
