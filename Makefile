BUILD_NUMBER ?= $(USER)-snapshot
X_HUB_SECRET ?= "fake_xhub_secret"
PROJECT_NAME = "hackerati/gitviz"

# lists all available targets
list:
	@sh -c "$(MAKE) -p no_op__ | \
		awk -F':' '/^[a-zA-Z0-9][^\$$#\/\\t=]*:([^=]|$$)/ {split(\$$1,A,/ /);\
		for(i in A)print A[i]}' | \
		grep -v '__\$$' | \
		grep -v 'make\[1\]' | \
		grep -v 'Makefile' | \
		sort"

# required for list
no_op__:

build:
	docker build -t $(PROJECT_NAME):$(BUILD_NUMBER) .

# push prod env + code to registry
publish:
	docker push $(PROJECT_NAME):$(BUILD_NUMBER)

test:
	@echo 'no tests yet'

deploy:
	@echo 'no deployment steps yet'

run:
	docker run -e "X_HUB_SECRET=$(X_HUB_SECRET)" -it -p 3000:3000 --rm $(PROJECT_NAME):$(BUILD_NUMBER)
