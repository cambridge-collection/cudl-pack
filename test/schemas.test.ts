import {validateCollection} from '../src/schemas';

test('validateCollection throws a descriptive error', () => {
    expect(() => validateCollection([]))
        .toThrowError(`\
input does not match the https://schemas.cudl.lib.cam.ac.uk/package/v1/collection.json schema:\n  - collection must \
be object (#/type)`);
});

test('validateCollection includes input description in error', () => {
    expect(() => validateCollection([], {inputDescription: '/some/collection.json'}))
        .toThrow(`\
/some/collection.json does not match the https://schemas.cudl.lib.cam.ac.uk/package/v1/collection.json schema:\n  - \
collection must be object (#/type)`);
});

test('validateCollection omits schema path of error when verbose is disabled', () => {
    expect(() => validateCollection([], {inputDescription: '/some/collection.json', verbose: false}))
        .toThrow('/some/collection.json does not match the collection schema: collection must be object');
});
