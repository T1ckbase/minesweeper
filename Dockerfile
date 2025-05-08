FROM denoland/deno:latest

EXPOSE 8000

WORKDIR /app

# Prefer not to run as root.
USER deno

RUN deno install --entrypoint main.ts

COPY . .

# Compile the main app so that it doesn't need to be compiled each startup/entry.
RUN deno cache main.ts

CMD ["deno", "run", "-A", "main.ts"]