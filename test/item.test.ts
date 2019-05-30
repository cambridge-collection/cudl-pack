import json5 from 'json5';
import fp from 'lodash/fp';
import {parseItemJson} from '../src/item';
import {getSchemaData, NegativeSchemaTestCase, readPathAsString} from './util';

test.each(fp.flatten([
    getSchemaData().item.validTestCases,
    getSchemaData()['cudl-item'].validTestCases,
    getSchemaData()['mudl-item'].validTestCases,
]))
('parseItemJson() parses valid item %s and returns its JSON representation', async (itemPath) => {
    let json = (await readPathAsString(require.resolve(itemPath))).toString();
    if(itemPath.endsWith('.json5')) {
        json = JSON.stringify(json5.parse(json));
    }

    await expect(parseItemJson(json)).toEqual(JSON.parse(json));
});

// Note that the invalid cudl/mudl items are not necessarily invalid /items/
test.each(getSchemaData().item.invalidTestCases)
('parseItemJson() rejects invalid item described by %s', async (testcasePath) => {
    const tc = await NegativeSchemaTestCase.fromPath(require.resolve(testcasePath));
    const invalidItem = await tc.getPatchedJSON();

    expect(() => parseItemJson(JSON.stringify(invalidItem))).toThrowError(`\
input does not match the https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json schema:`);
});
