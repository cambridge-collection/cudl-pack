# cudl-pack

cudl-pack is a prototype data package compiler for the Cambridge Digital Collection Platform. It acts as the source of truth for the metadata that defines the set of items, collections etc available from a CDCP deployment.

The idea is to define a dependency graph for the data that should be on a CDCP instance. The graph references externally-held resources, and defines data transformations which are neccisary to make them available as items, collections etc. For this prototype, Webpack is being used to build a depenency graph and apply transformations.

See the [CUDL Data-Definition Architecture Proposal][data-arch-doc] for the background to this.

[data-arch-doc]: https://docs.google.com/document/d/1rIDvEfdJmvyiSnXYBQ0fOEGxL7B04re8xJ2kmoSyRyE/edit?usp=sharing

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

### Setting up tests in IntelliJ Idea

You can run the tests in IntelliJ by selecting 'Edit Configurations' to open
the 'Run/Debug Configuration' screen. You can then select the + symbol to run
using a new configuration and select 'Jest' as the type. Then if you give the
test configuration a name e.g. 'all tests' and then save you can then run normally
(shift-f10 or using the green arrow).

### Gotchas

Unhandled async errors crash Jest. This can be problematic to debug.

## Requirements

-   The gyp build tool requires python 2.7.14 (or later python 2)
-   Requires jdk 11 (or at least newer than java 8)
-   Requires node 10 (due to java not working on node 12 yet).

## Releases

In order to bump the pre-release version number you can use the command:

`make bump-version-prerelease`

and you need to manually push the tags created by doing the command:

`git push --tags`

In order to upload the content to the S3 repository so it is ready to be used by
the loading data process you need to use the command:

`make publish`
