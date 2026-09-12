FROM node:20-slim

WORKDIR /app

RUN groupadd --system frontend && useradd --system --gid frontend frontend

COPY package.json ./

RUN npm install

COPY . .

RUN chown -R frontend:frontend /app

USER frontend

EXPOSE 3000

# No dedicated /health route exists on this Express server (see server.js) —
# "/" (the landing page) is the best available liveness proxy, same pattern
# used for the other Next.js/Express frontends in this product suite that
# also lack one.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
