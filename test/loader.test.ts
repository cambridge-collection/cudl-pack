// tslint:disable no-eval
import compiler from './compiler';

test('foo', () => {
    expect('a').toBe('a');
})

test('Hello world loader test', async () => {
    const stats = await compiler('data/site.xml');
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
