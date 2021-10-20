import Ajv from "ajv";
import clone from "clone";
import jsonpointer from "jsonpointer";
import webpack from "webpack";
import { createValidator } from "../schemas";

const optionsSchema = {
    $id: "cudl-pack/loaders/json-wrap-loader.schema.json",
    type: "object",
    properties: {
        insertionPoint: { type: "string" },
        template: {
            anyOf: [{ type: "object" }, { type: "array" }],
        },
    },
    required: ["insertionPoint"],
};

export interface Options {
    insertionPoint: string;
    template?: object;
}

const validateOptions = createValidator<Options>({
    schemaId: optionsSchema.$id,
    validate: new Ajv().compile(optionsSchema),
    name: "options",
});

/**
 * A loader which nests the loaded value into a JSON structure
 */
export default function (this: webpack.LoaderContext<{}>, source: string) {
    const options = validateOptions(this.getOptions());

    const template = clone(options.template || {}, false);
    jsonpointer.set(template, options.insertionPoint, JSON.parse(source));
    return JSON.stringify(template);
}
