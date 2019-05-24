import fileUrl from 'file-url';
import url from 'url';

export function dirUrl(dirPath: string) {
    const u = new url.URL(fileUrl(dirPath, {resolve: false}));
    if(!u.pathname.endsWith('/')) {
        u.pathname = u.pathname + '/';
    }
    return u.toString();
}

export function resolve(start: string, ...urls: string[]) {
    return urls.reduce((base, next) => url.resolve(base, next), start);
}
