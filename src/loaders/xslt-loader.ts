import { execute } from "@lib.cam/xslt-nailgun";
import Ajv from "ajv";
import { URL } from "url";
import { promisify } from "util";
import { createValidator } from "../schemas";
import { AsyncLoadFunction, createAsyncLoader } from "../utils";
import optionsSchema from "./xslt-loader-options.schema.json";

interface Options {
    stylesheet: string;
}

const validateOptions = createValidator<Options>({
    schemaId: optionsSchema.$id,
    validate: new Ajv().compile(optionsSchema),
    name: "options",
});

const load: AsyncLoadFunction = async function (this, source): Promise<Buffer> {
    const options: Options = validateOptions(this.getOptions());

    const stylesheetPath = await promisify(this.resolve.bind(this))(
        this.rootContext,
        options.stylesheet
    );

    if (typeof stylesheetPath !== "string") {
        throw new Error(
            `Failed to resolve path of stylesheet: ${options.stylesheet}`
        );
    }

    // The JVM which execute() uses to run XSLT is kept alive for a short time between calls, so it shouldn't be
    // necessary to share an XSLTExecutor instance across loader invocations.
    return await execute({
        systemIdentifier: new URL(this.resourcePath, "file://").toString(),
        xml: source,
        xsltPath: stylesheetPath,
    });
};

export default createAsyncLoader(load);
