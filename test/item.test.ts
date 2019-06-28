import json5 from 'json5';
import lodash from 'lodash';
import webpack from 'webpack';
import {generateItemJson, NamespaceLoader, parseItemJson} from '../src/item';
import {Item} from '../src/item-types';
import {Namespace, TypeUri} from '../src/uris';
import compiler from './compiler';
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

const minimalItem: Item = {
    '@type': TypeUri.PackageItem,
    descriptions: {
        main: {coverage: {firstPage: true, lastPage: true}},
    },
    pages: {},
};

test('minimal data satisfying Item type is valid item instance', () => {
    const item: Item = parseItemJson(generateItemJson(minimalItem));
    expect(item).toEqual(minimalItem);
});

function createNamespaceLoader() {
    return new NamespaceLoader(async url => {
        expect(url).toBe('./namespace.json');
        return {foo: 'http://example.com/'};
    });
}

test('NamespaceLoader loads undefined as empty namespace', async () => {
    expect(await createNamespaceLoader().loadNamespace(undefined))
        .toEqual(Namespace.fromNamespaceMap({}));
    expect.assertions(1);
});

test('NamespaceLoader loads inline namespace', async () => {
    expect(await createNamespaceLoader().loadNamespace({foo: 'http://example.com/'}))
        .toEqual(Namespace.fromNamespaceMap({foo: 'http://example.com/'}));
    expect.assertions(1);
});

test('NamespaceLoader loads referenced namespace', async () => {
    expect(await createNamespaceLoader().loadNamespace('./namespace.json'))
        .toEqual(Namespace.fromNamespaceMap({foo: 'http://example.com/'}));
    expect.assertions(2);
});

test('NamespaceLoader loads namespace from NamespaceBearer', async () => {
    expect(await createNamespaceLoader().loadNamespace({'@namespace': './namespace.json'}))
        .toEqual(Namespace.fromNamespaceMap({foo: 'http://example.com/'}));
    expect.assertions(2);
});

test('NamespaceLoader.forWebpackLoader loads namespace via webpack machinery', async () => {
    const rules: webpack.RuleSetRule[] = [{
        type: 'json',
        test: /\/mock\.json$/,
        use: require.resolve('./namespace-reference-loader'),
    }];

    await compiler('./data/item/namespace-references/mock.json', rules);
    expect.assertions(2);  // Assertions in loader
});
