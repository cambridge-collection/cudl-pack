import json5 from 'json5';
import {generateInternalItemJson, parseInternalItemJson} from '../src/internal-item';
import {InternalItem} from '../src/internal-item-types';
import {getSchemaData, NegativeSchemaTestCase, readPathAsString} from './util';

test.each(getSchemaData('cudl-schema-internal-json').item.validTestCases)
('parseInternalItemJson() parses valid internal item %s and returns its JSON representation', async (itemPath) => {
    let json = (await readPathAsString(require.resolve(itemPath))).toString();
    if(itemPath.endsWith('.json5')) {
        json = JSON.stringify(json5.parse(json));
    }

    await expect(parseInternalItemJson(json)).toEqual(JSON.parse(json));
});

// Note that the invalid cudl/mudl items are not necessarily invalid /items/
test.each(getSchemaData('cudl-schema-internal-json').item.invalidTestCases)
('parseInternalItemJson() rejects invalid internal item described by %s', async (testcasePath) => {
    const tc = await NegativeSchemaTestCase.fromPath(require.resolve(testcasePath));
    const invalidInternalItem = await tc.getPatchedJSON();

    expect(() => parseInternalItemJson(JSON.stringify(invalidInternalItem))).toThrowError(`\
input does not match the https://schemas.cudl.lib.cam.ac.uk/__internal__/v1/item.json schema:`);
});

test('generateInternalItemJson', () => {
    const json = generateInternalItemJson({
        descriptiveMetadata: [],
        pages: [],
        logicalStructures: [],
    });
    expect(JSON.parse(json)).toEqual({
        descriptiveMetadata: [],
        pages: [],
        logicalStructures: [],
    });
});

test.each`
    options              | shouldFail
    ${undefined}         | ${true}
    ${{validate: true}}  | ${true}
    ${{validate: false}} | ${false}
`(`it is $shouldFail that generateInternalItemJson should throw when generating JSON for an invalid item with \
options: $options`, ({options, shouldFail}) => {
    const invalidItem = {} as InternalItem;

    function generate() {
        return generateInternalItemJson(invalidItem, options);
    }

    if(shouldFail)
        expect(generate).toThrowError();
    else
        expect(typeof generate()).toBe('string');
});
