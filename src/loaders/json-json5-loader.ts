import JSON5 from "json5";

/**
 * A loader which transforms JSON5 input into a JSON string.
 *
 * Like the `json5-loader`, except it produces a JSON module instead of a
 * javascript module exporting a parsed JSON value.
 */
export default (source: string) => JSON.stringify(JSON5.parse(source));
