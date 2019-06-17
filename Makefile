SHELL = /bin/bash
.SHELLFLAGS=-o errexit -c

s3bucket = cudl-artefacts
s3keyBase = projects/cudl-packaging/dist/
s3UrlBase = "s3://$(s3bucket)/$(s3keyBase)"

packageName = $(shell jq -r '.name' package.json)
packageVersion = $(shell jq -r '.version' package.json)
packageFile = $(packageName)-$(packageVersion).tgz

default: package

package: export npm_config_color = always
package: clean build compile-typescript build/dist-root/package.json build/dist-root/README.md
# Refuse to build a package with local modifications, as the package may end up
# containing the modifications rather than the committed state.
	@DIRTY_FILES="$$(git status --porcelain)" ; \
	if [ "$$DIRTY_FILES" != "" ]; then \
		echo "Warning: git repo has uncommitted changes, package may not be reproducible:" ; \
		echo "$$DIRTY_FILES" ; \
	fi
	cd build && npm pack ./dist-root

publish: package _require-clean-checkout
# Refuse to publish unless we get a 404 when looking up the publish path no S3.
# If the artefact already exists will be overwritten if FORCE_OVERWRITE_PACKAGE
# is set to the name of the archive being published.
	@if HEAD_RESP="$$(aws s3api head-object --bucket "$(s3bucket)" --key "$(s3keyBase)$(packageFile)" 2>&1)"; then \
		echo "$$HEAD_RESP" ; \
		if [ "$$PUBLISH_FORCE_OVERWRITE_PACKAGE" ==  "$(packageFile)" ] ; then \
			echo 'Package exists but overwrite requested via $$PUBLISH_FORCE_OVERWRITE_PACKAGE' ; \
		else \
			echo "$(packageFile) is already published - refusing to overwrite" ; \
			exit 1 ; \
		fi ; \
	else \
		STATUS=$$? ; \
		if ! (echo "$$HEAD_RESP" | grep -Fq 'An error occurred (404) when calling the HeadObject operation: Not Found') ; then \
			echo "aws s3api head-object exited with status $$STATUS: $$HEAD_RESP" ; \
			exit 1 ; \
		fi ; \
	fi
	aws s3 cp \
		$$(if [[ "$$PUBLISH_DRYRUN" != "" ]] ; then echo --dryrun; fi) \
		"build/$(packageFile)" "$(s3UrlBase)"

bump-version-prerelease: _require-clean-checkout
	npm version prerelease
	git add package.json

	packageName="$$(jq -r '.name' package.json)" ; \
    packageVersion="$$(jq -r '.version' package.json)" ; \
    tagName="$$packageName/$$packageVersion" ; \
	git commit -m "Bump version of $$packageName to $$packageVersion" package.json ; \
	git tag "$$tagName" HEAD

build:
	mkdir -p build

compile-typescript:
	npm run build

build/dist-root/package.json: package.json
	jq '. + {main: "index.js"}' $< > $@

build/dist-root/README.md: README.md
	cp $? $@

clean:
	rm -rf build

_require-clean-checkout:
	@DIRTY_FILES="$$(git status --porcelain)" ; \
	if [ "$$DIRTY_FILES" != "" ]; then \
		echo "Error: git repo has uncommitted changes, refusing to continue:" ; \
		echo "$$DIRTY_FILES" ; \
		exit 1 ; \
	fi

.PHONY: package clean _require-clean-checkout
