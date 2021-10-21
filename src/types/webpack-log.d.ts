import { LogLevel } from "loglevelnext";

declare enum Levels {
    "trace",
    "debug",
    "info",
    "warn",
    "error",
    "silent",
}

declare interface Options {
    id?: string;
    name?: string;
    level?: Levels;
    unique?: boolean;
}

declare function log(options: Options): LogLevel;

export default log;
