FROM directus/directus:latest
RUN rm -rf /directus/extensions/*
COPY ./extensions/ /directus/extensions/