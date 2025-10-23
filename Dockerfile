FROM directus/directus:latest

# hard-delete any previously-copied packaged extension folders
RUN rm -rf /directus/extensions/directus-extension-hook-rls-context \
    && rm -rf /directus/extensions/*

# copy only your current repo extensions (filesystem hook)
COPY ./extensions/ /directus/extensions/
