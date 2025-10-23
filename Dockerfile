FROM directus/directus:latest

ENV EXTENSIONS_PATH=/directus/extensions
# copy everything under /extensions (includes our package folder)
COPY ./extensions /directus/extensions