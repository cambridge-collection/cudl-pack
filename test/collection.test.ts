import { parseCollectionJson } from "../src/collection";
import {
    getSchemaData,
    NegativeSchemaTestCase,
    readPathAsString,
} from "./util";

test.each(getSchemaData("cudl-schema-package-json").collection.validTestCases)(
    "parseCollectionJson() loads valid collection data/collections/%s and outputs its JSON representation",
    async (collectionPath) => {
        const json = await readPathAsString(require.resolve(collectionPath));
        expect(parseCollectionJson(json)).toEqual(JSON.parse(json));
    }
);

test.each(
    getSchemaData("cudl-schema-package-json").collection.invalidTestCases
)(
    "parseCollectionJson() rejects invalid collection described by %s",
    async (testcasePath) => {
        const tc = await NegativeSchemaTestCase.fromPath(
            require.resolve(testcasePath)
        );
        const invalidCollection = await tc.getPatchedJSON();

        expect(() => parseCollectionJson(JSON.stringify(invalidCollection)))
            .toThrowError(`\
input does not match the https://schemas.cudl.lib.cam.ac.uk/package/v1/collection.json schema:`);
    }
);
