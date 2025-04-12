FROM node:21-slim

WORKDIR /app

COPY server.js .

EXPOSE 3000

CMD ["node", "server.js"] 