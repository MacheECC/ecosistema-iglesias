FROM directus/directus:latest

# wipe any previously-copied extensions from older layers
RUN rm -rf /directus/extensions/*

# copy only your current repo’s extensions
COPY ./extensions/ /directus/extensions/
