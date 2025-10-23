FROM directus/directus:latest

# Make sure Directus looks in /directus/extensions (this is the default, we set it explicitly)
ENV EXTENSIONS_PATH=/directus/extensions

# Copy the hook folder exactly where Directus loads local hooks
COPY ./extensions/hooks/set-rls-context/ /directus/extensions/hooks/set-rls-context/

# Copy a tiny startup script and make it executable at copy time (no chmod needed)
COPY --chmod=0755 ./start.sh /start.sh

# Run the script (it will list /directus/extensions, then start Directus)
CMD ["/start.sh"]