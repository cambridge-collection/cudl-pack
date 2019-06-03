import json5 from 'json5';
import lodash from 'lodash';
import {generateItemJson, ItemJson, parseItemJson} from '../src/item';
import {getSchemaData, NegativeSchemaTestCase, readPathAsString} from './util';

test.each(lodash.flatten([
    getSchemaData('cudl-schema-package-json').item.validTestCases,
    getSchemaData('cudl-schema-package-json')['cudl-item'].validTestCases,
    getSchemaData('cudl-schema-package-json')['mudl-item'].validTestCases,
]))
('parseItemJson() parses valid item %s and returns its JSON representation', async (itemPath) => {
    let json = (await readPathAsString(require.resolve(itemPath))).toString();
    if(itemPath.endsWith('.json5')) {
        json = JSON.stringify(json5.parse(json));
    }

    await expect(parseItemJson(json)).toEqual(JSON.parse(json));
});

// Note that the invalid cudl/mudl items are not necessarily invalid /items/
test.each(getSchemaData('cudl-schema-package-json').item.invalidTestCases)
('parseItemJson() rejects invalid item described by %s', async (testcasePath) => {
    const tc = await NegativeSchemaTestCase.fromPath(require.resolve(testcasePath));
    const invalidItem = await tc.getPatchedJSON();

    expect(() => parseItemJson(JSON.stringify(invalidItem))).toThrowError(`\
input does not match the https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json schema:`);
});

const minimalItem: ItemJson = {
    descriptions: {
        main: {coverage: {firstPage: true, lastPage: true}},
    },
    pages: {},
    properties: {},
};

test('generateItemJson() adds @type', () => {
    expect(JSON.parse(generateItemJson(minimalItem))['@type'])
        .toEqual('https://schemas.cudl.lib.cam.ac.uk/package/v1/item.json');
});

test('minimal data satisfying ItemJson type is valid item instance', () => {
    const item: ItemJson = parseItemJson(generateItemJson(minimalItem));
    expect(lodash.omit(item, ['@type'])).toEqual(minimalItem);
});
