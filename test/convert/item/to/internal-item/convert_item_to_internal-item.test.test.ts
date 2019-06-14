import json5 from 'json5';
import {
    _internals,
    ItemToInternalItemConversionHooks,
    ItemToInternalItemConverter,
} from '../../../../../src/convert/item/to/internal-item';
import {IIIFPageResourcePlugin} from '../../../../../src/convert/item/to/internal-item/handlers';
import {
    createDescriptiveMetadataSection,
    DescriptiveMetadataSection,
    LogicalStructureNode,
    Page as InternalPage,
} from '../../../../../src/internal-item-types';
import {ItemDescriptions, ItemPages, PageRange} from '../../../../../src/item-types';
import {validateInternalItem, validateItem} from '../../../../../src/schemas';
import {Namespace} from '../../../../../src/uris';
import {readPathAsString} from '../../../../util';

const {
    createDescriptiveMetadata,
    createLogicalStructures,
    itemPagesToInternalItemPages,
} = _internals;

function namespace() {
    return Namespace.fromNamespaceMap({});
}

function defaultHooks() {
    return new ItemToInternalItemConversionHooks();
}

test('itemPagesToInternalItemPages without resource handlers produces minimal page', async () => {
    const pages: ItemPages = {
        foo: {
            label: '1',
        },
        bar: {
            order: '0',
            label: '2',
        },
    };

    const internalPages: InternalPage[] = [
        {
            label: '2',
            physID: 'bar',
            sequence: 1,
        },
        {
            label: '1',
            physID: 'foo',
            sequence: 2,
        },
    ];
    expect(await itemPagesToInternalItemPages(pages, namespace(), defaultHooks())).toEqual(internalPages);
});

test('itemPagesToInternalItemPages uses result of applying resource handlers', async () => {
    const pages: ItemPages = {
        foo: {
            label: '1',
            resources: [
                {'@type': 'cdl-page:image', imageType: 'iiif', image: {'@id': 'some/where'}},
            ],
        },
        bar: {
            order: '0',
            label: '2',
        },
    };

    const hooks = new ItemToInternalItemConversionHooks();
    new IIIFPageResourcePlugin().apply(hooks);

    const internalPages: InternalPage[] = [
        {
            label: '2',
            physID: 'bar',
            sequence: 1,
        },
        {
            label: '1',
            physID: 'foo',
            sequence: 2,
            IIIFImageURL: 'some/where',
        },
    ];
    expect(await itemPagesToInternalItemPages(pages, namespace(), hooks)).toEqual(internalPages);
});

test('createLogicalStructures on item with no pages results in no structures', () => {
    const pages: ItemPages = {};
    const descriptions: ItemDescriptions = {
        main: {
            coverage: {firstPage: true, lastPage: true},
        },
    };
    expect(createLogicalStructures(descriptions, pages, defaultHooks())).toEqual([]);
});

test('createLogicalStructures creates structure for single main description', () => {
    const pages: ItemPages = {
        a: {label: 'p1'},
        b: {label: 'p2'},
    };
    const descriptions: ItemDescriptions = {
        main: {
            coverage: {firstPage: true, lastPage: true},
        },
    };
    const expected: LogicalStructureNode[] = [
        {
            label: 'Untitled', descriptiveMetadataID: 'main',
            startPageID: 'a', startPageLabel: 'p1', startPagePosition: 1,
            endPageID: 'b', endPageLabel: 'p2', endPagePosition: 2,
        },
    ];
    expect(createLogicalStructures(descriptions, pages, defaultHooks())).toEqual(expected);
});

test('createLogicalStructures creates nested structures for descriptions with nested coverage ranges', () => {
    const pages: ItemPages = {
        a: {label: 'p1'},
        b: {label: 'p2'},
        c: {label: 'p3'},
    };
    const descriptions: ItemDescriptions = {
        main: {coverage: {firstPage: true, lastPage: true}},
        justA: {coverage: {firstPage: true, lastPage: 'a'}},
        justB: {coverage: {firstPage: 'b', lastPage: 'b'}},
        aAndB: {coverage: {firstPage: 'a', lastPage: 'b'}},
        bAndC: {coverage: {firstPage: 'b', lastPage: true}},
    };
    const expected: LogicalStructureNode[] = [
        {
            label: 'Untitled', descriptiveMetadataID: 'main',
            startPageID: 'a', startPageLabel: 'p1', startPagePosition: 1,
            endPageID: 'c', endPageLabel: 'p3', endPagePosition: 3,
            children: [
                {
                    label: 'Untitled', descriptiveMetadataID: 'aAndB',
                    startPageID: 'a', startPageLabel: 'p1', startPagePosition: 1,
                    endPageID: 'b', endPageLabel: 'p2', endPagePosition: 2,
                    children: [
                        {
                            label: 'Untitled', descriptiveMetadataID: 'justA',
                            startPageID: 'a', startPageLabel: 'p1', startPagePosition: 1,
                            endPageID: 'a', endPageLabel: 'p1', endPagePosition: 1,
                        },
                        {
                            label: 'Untitled', descriptiveMetadataID: 'justB',
                            startPageID: 'b', startPageLabel: 'p2', startPagePosition: 2,
                            endPageID: 'b', endPageLabel: 'p2', endPagePosition: 2,
                        },
                    ],
                },
                {
                    label: 'Untitled', descriptiveMetadataID: 'bAndC',
                    startPageID: 'b', startPageLabel: 'p2', startPagePosition: 2,
                    endPageID: 'c', endPageLabel: 'p3', endPagePosition: 3,
                },
            ],
        },
    ];
    expect(createLogicalStructures(descriptions, pages, defaultHooks())).toEqual(expected);
});

test('createLogicalStructures uses descriptionTitle hook to label nodes', () => {
    const pages: ItemPages = {
        a: {label: '1'},
        b: {label: '2'},
    };
    const descriptions: ItemDescriptions = {
        main: {
            coverage: {firstPage: true, lastPage: true},
        },
    };
    const hooks = defaultHooks();
    hooks.descriptionTitle.tap('test', (desc => {
        expect(desc.coverage).toBe(descriptions.main.coverage);
        expect(desc.attributes).toBe(undefined);
        return 'My Title';
    }));
    const logicalStructures = createLogicalStructures(descriptions, pages, hooks);
    expect(logicalStructures[0].label).toEqual('My Title');
    expect.assertions(3);
});

test.each([
    ['are empty', {firstPage: 'b', lastPage: 'a'},
     'Invalid description coverage: /descriptions/main/coverage/firstPage (b = 1) is after lastPage (a = 0)'],
    ['are reversed', {firstPage: 'c', lastPage: 'a'},
     'Invalid description coverage: /descriptions/main/coverage/firstPage (c = 2) is after lastPage (a = 0)'],
    ['have broken firstPage references', {firstPage: 'broken', lastPage: 'a'}, `\
Invalid description coverage: /descriptions/main/coverage/firstPage references a page that doesn\'t exist: broken`],
    ['have broken lastPage references', {firstPage: 'a', lastPage: 'broken'}, `\
Invalid description coverage: /descriptions/main/coverage/lastPage references a page that doesn\'t exist: broken`],
    ['have broken firstPage and lastPage references', {firstPage: 'missing', lastPage: 'broken'},
     /references a page that doesn't exist/],
])('createLogicalStructures rejects descriptions with coverage ranges which %s', (_, coverage, errorDesc) => {
    const pages: ItemPages = {
        a: {label: 'p1'},
        b: {label: 'p2'},
        c: {label: 'p3'},
    };
    const descriptions: ItemDescriptions = {main: {coverage: coverage as PageRange}};

    expect(() => createLogicalStructures(descriptions, pages, defaultHooks())).toThrowError(errorDesc as RegExp);
});

test('createDescriptiveMetadata creates displayable metadata mirroring description attributes', () => {
    const descriptions: ItemDescriptions = {
        main: {
            coverage: {firstPage: true, lastPage: true},
            attributes: {
                flavour: {label: 'Flavour', value: 'Strawberry'},
                size: {label: 'Size', value: 'Smallish', order: 'd'},
                colours: {label: 'Colours', value: ['Red', 'Green']},
            },
        },
        a_other: {
            coverage: {firstPage: '3', lastPage: '4'},
            attributes: {
                condition: {label: 'Condition', value: 'Mostly destroyed'},
            },
        },
        b_other: {
            coverage: {firstPage: '5', lastPage: '6'},
            attributes: {
                condition: {label: 'Condition', value: 'Somewhat destroyed'},
            },
        },
    };

    const result: DescriptiveMetadataSection[] = [
        createDescriptiveMetadataSection({ID: 'main'}, {
            flavour: {
                display: true,
                label: 'Flavour',
                displayForm: 'Strawberry',
                seq: 3,
            },
            size: {
                display: true,
                label: 'Size',
                displayForm: 'Smallish',
                seq: 2,
            },
            colours: {
                display: true,
                label: 'Colours',
                value: [
                    {displayForm: 'Red'},
                    {displayForm: 'Green'},
                ],
                seq: 1,
            },
        }),
        createDescriptiveMetadataSection({ID: 'a_other'}, {
            condition: {
                display: true,
                label: 'Condition',
                displayForm: 'Mostly destroyed',
                seq: 1,
            },
        }),
        createDescriptiveMetadataSection({ID: 'b_other'}, {
            condition: {
                display: true,
                label: 'Condition',
                displayForm: 'Somewhat destroyed',
                seq: 1,
            },
        }),
    ];
    expect(createDescriptiveMetadata(descriptions)).toEqual(result);
});

test('ItemToInternalItemConverter.convert without any plugins converts items to no-frills internal items', async () => {
    const packageItem = validateItem(json5.parse(
        await readPathAsString('convert/item/to/internal-item/data/package-item.json5')));
    const expectedInternalItem = validateInternalItem(json5.parse(
        await readPathAsString('convert/item/to/internal-item/data/internal-item_no-plugins.json5')));

    const convertedItem = await new ItemToInternalItemConverter().convert(packageItem);

    expect(convertedItem).toEqual(expectedInternalItem);
});

test('ItemToInternalItemConverter.convert with default plugins converts items to fairly basic internal items',
    async () => {
    const packageItem = validateItem(json5.parse(
        await readPathAsString('convert/item/to/internal-item/data/package-item.json5')));
    const expectedInternalItem = validateInternalItem(json5.parse(
        await readPathAsString('convert/item/to/internal-item/data/internal-item_default-plugins.json5')));

    const convertedItem = await ItemToInternalItemConverter.withDefaultPlugins().convert(packageItem);

    expect(convertedItem).toEqual(expectedInternalItem);
});
