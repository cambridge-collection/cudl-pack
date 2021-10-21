export default function fromEntries<T>(entries: Iterable<[string, T]>): {
    [key: string]: T;
};
