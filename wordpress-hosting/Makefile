# Orija WordPress hosting — common operator commands
.PHONY: help platform platform-local provision list backup

help:
	@echo "Orija WordPress Hosting"
	@echo "  make platform          Deploy shared Redis via Portainer"
	@echo "  make platform-local    Deploy shared Redis with local Docker"
	@echo "  make provision SLUG=acme DOMAIN=acme.orija.store [DEPLOY=1]"
	@echo "  make list              Show site registry"
	@echo "  make backup SLUG=acme  Dump DB + wp-content on Docker host"

platform:
	./scripts/deploy-platform.sh

platform-local:
	./scripts/deploy-platform.sh local

provision:
	@test -n "$(SLUG)" || (echo "SLUG= required" >&2; exit 1)
	@test -n "$(DOMAIN)" || (echo "DOMAIN= required" >&2; exit 1)
	./scripts/provision-site.sh --slug "$(SLUG)" --domain "$(DOMAIN)" \
		$(if $(TITLE),--title "$(TITLE)",) \
		$(if $(ADMIN_USER),--admin-user "$(ADMIN_USER)",) \
		$(if $(ADMIN_EMAIL),--admin-email "$(ADMIN_EMAIL)",) \
		$(if $(DEPLOY),--deploy,)

list:
	./scripts/list-sites.sh

backup:
	@test -n "$(SLUG)" || (echo "SLUG= required" >&2; exit 1)
	./scripts/backup-site.sh "$(SLUG)"
