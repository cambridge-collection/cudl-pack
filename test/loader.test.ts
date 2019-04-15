// tslint:disable no-eval
import path from 'path';
import compiler from './compiler';

const xmlLoaderRules = [{
    test: /\.xml$/,
    use: [
        { loader: 'json-loader' },
        { loader: path.resolve(__dirname, '../src/loaders/site-xml-loader.ts') },
    ],
}];

test('site-xml-loader', async () => {
    const stats = await compiler('./data/site.xml', xmlLoaderRules);
    const output = stats.toJson().modules[0].source;

    expect(eval(output)).toEqual({
        name: 'John Rylands',
        collections: [
            {href: 'collections/hebrew'},
            {href: 'collections/petrarch'},
            {href: 'collections/landscapehistories'},
            {href: 'collections/treasures'},
            {href: 'collections/sassoon'},
            {href: 'collections/lewisgibson'},
            {href: 'collections/darwinhooker'},
            {href: 'collections/japanese'},
            {href: 'collections/tennyson'},
        ],
    });
});

const jsonLoaderRules = [{
    test: /\.json$/,
    use: [
        { loader: path.resolve(__dirname, '../src/loaders/site-loader.ts') },
    ],
}];

test.only('site-loader', async () => {
    const stats = await compiler('./data/minimal/site.json', jsonLoaderRules);
    const output = stats.toJson().modules[0].source;

    expect(JSON.parse(output)).toEqual({
        name: 'John Rylands',
        collections: [
            {href: 'collections/hebrew'},
        ],
    });
});
