import webpack from "webpack";
import { parseItemJson } from "../item";

const loader: webpack.LoaderDefinitionFunction = (source: string | Buffer) => {
    // This just serves to ensure the input is valid
    parseItemJson(source.toString());

    return source;
};

export default loader;
