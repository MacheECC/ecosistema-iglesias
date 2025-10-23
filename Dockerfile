FROM directus/directus:latest

# Copy the hook folder (foldered hook with index.js)
COPY ./extensions/hooks/set-rls-context /directus/extensions/hooks/set-rls-context

# (Optional) If you want to be explicit about the extensions path
ENV EXTENSIONS_PATH=/directus/extensions

# Copy the startup script
COPY ./start.sh /start.sh
RUN chmod +x /start.sh

# Use the script as the container command
CMD ["/bin/sh", "-lc", "/start.sh"]