BUILD_NUMBER ?= $(USER)-snapshot
X_HUB_SECRET ?= "fake_xhub_secret"
GRAPHENEDB_URL ?= "fake_graphenedb_url"
NEO4J_AUTH ?= "fake_neo4j_auth"
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
	docker run -e "X_HUB_SECRET=$(X_HUB_SECRET)" -e "GRAPHENEDB_URL=$(GRAPHENEDB_URL)" -e "NEO4J_AUTH=$(NEO4J_AUTH)" -it -p 3000:3000 --rm $(PROJECT_NAME):$(BUILD_NUMBER)
