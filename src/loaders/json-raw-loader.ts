/**
 * A loader which transforms its input into a JSON string.
 *
 * Like the `raw-loader`, except produces a JSON module instead of a javascript
 * module exporting a string.
 */
export default (source: string) => JSON.stringify(source);
