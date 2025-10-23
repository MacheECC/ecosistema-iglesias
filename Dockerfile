FROM directus/directus:latest
# copy only your current repo extensions (filesystem hook)
COPY ./extensions/ /directus/extensions/
