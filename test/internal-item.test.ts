import json5 from 'json5';
import {parseInternalItemJson} from '../src/internal-item';
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
