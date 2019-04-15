## Debugging

Install the `node-nightly` npm package, then:

```
$ node_modules/.bin/node-nightly --inspect --inspect-brk node_modules/jest/bin/jest.js --runInBand
```

Then open [chrome://inspect/](chrome://inspect/) in Google Chrome. You should
see an entry under the "Remote Target" heading to connect to.

It can help to place a `debugger;` statement into your code, otherwise it seems
source maps aren't loaded at the initial breakpoint, so you can't actually set
a break point from the start.
