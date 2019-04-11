export function bindPromiseToCallback<T>(
    promise: Promise<T>, callback: (err: any, value?: T) => void): void {

    promise.then(
        (value) => {callback(null, value);}, callback);
};
