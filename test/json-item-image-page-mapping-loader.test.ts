import path from 'path';
import webpack from 'webpack';
import compiler from './compiler';
import {readPathAsString} from './util';

const rules: webpack.RuleSetRule[] = [{
    type: 'json',
    test: /\.json$/,
    use: {
        loader: path.resolve(__dirname, '../src/loaders/json-item-image-page-mapping-loader.ts'),
        options: {
            imageServerPath: 'https://images.example.ac.uk/iiif/',
            imageType: 'iiif',
        },
    }}];

test('test loading CSV file and generating page mapped item JSON', async () => {

    const stats = await compiler('./data/item/image-mapping/item-with-linked-pagination.json', rules);
    const module = stats.toJson().modules[0];

    const data: string = await readPathAsString('./data/item/image-mapping/item-with-pagination-inserted.json');

    expect(JSON.parse(module.source)).toEqual(JSON.parse(data));

});
