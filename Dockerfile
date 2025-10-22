FROM directus/directus:latest
COPY ./extensions/hooks/set-rls-context.js /directus/extensions/hooks/set-rls-context.js