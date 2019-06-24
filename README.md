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

#### Setting up tests in IntelliJ Idea

You can run the tests in IntelliJ by selecting 'Edit Configurations' to open 
the 'Run/Debug Configuration' screen.  You can then select the + symbol to run 
using a new configuration and select 'Jest' as the type.  Then if you give the 
test configuration a name e.g. 'all tests' and then save you can then run normally 
(shift-f10 or using the green arrow). 

#### Gotchas

Unhandled async errors crash Jest.  This can be problematic to debug. 

#### Requirements

requires python 2.7.14 (or later python 2)
requires jdk 11 ?
requires npm 6.9.0 ?
