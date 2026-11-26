# Upgrading and backups

For a host running a release. Run the commands in the folder that holds `docker-compose.yml`. They
assume the default Compose project `rmf-block`; if yours differs, `docker volume ls` shows the
volume names.

## Back up

Stop the stack so MongoDB is not writing, copy both volumes into `.tgz` files in this folder, then
start it again:

```bash
docker compose stop
docker run --rm -v rmf-block_app-data:/data -v "${PWD}:/backup" alpine tar czf /backup/app-data.tgz -C /data .
docker run --rm -v rmf-block_mongo-data:/data -v "${PWD}:/backup" alpine tar czf /backup/mongo-data.tgz -C /data .
docker compose start
```

## Upgrade

1. [Back up](#back-up).
2. Check that both Yorkie values in `.env` meet [the README's rules](../README.md#3-set-the-yorkie-secrets).
   Releases on Yorkie 0.7.28 or later refuse a token secret under 32 characters, and 0.0.1 had
   neither value.
3. Download the new release's `docker-compose.yml` over the old one and keep `.env`.
4. Run `docker compose pull`, and once it succeeds, `docker compose up -d`.

An installation that ran from a clone switches over first:
[`CONTRIBUTING.md`](../CONTRIBUTING.md#switching-a-clone-to-a-release).

## Roll back

Put the previous release's `docker-compose.yml` back and run `docker compose up -d`; the volumes stay.

A newer version may store data an older one cannot read. In particular, once Yorkie 0.7.26 or later
has run on `mongo-data`, an older Yorkie cannot use it. To roll back past that, restore the backup
first; everything written since it is lost:

```bash
docker compose down
docker run --rm -v rmf-block_app-data:/data -v "${PWD}:/backup" alpine sh -c "find /data -mindepth 1 -delete && tar xzf /backup/app-data.tgz -C /data"
docker run --rm -v rmf-block_mongo-data:/data -v "${PWD}:/backup" alpine sh -c "find /data -mindepth 1 -delete && tar xzf /backup/mongo-data.tgz -C /data"
```

Then put the previous file back and run `docker compose up -d`. Never run `docker compose down -v`,
which deletes the volumes.
