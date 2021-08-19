FROM node:16.3-alpine as build

WORKDIR /source

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci

COPY prisma/ ./prisma/

RUN npx prisma generate

COPY . .

RUN npm run build


FROM node:16.3-alpine

WORKDIR /app

ENV API_PORT=80
EXPOSE 80

ENV NODE_ENV=production
RUN apk add --no-cache tini

COPY package*.json ./

RUN npm ci

COPY prisma/ ./

RUN npx prisma generate

COPY --chown=node:node public/ ./public/
COPY --from=build /source/dist .

USER node

ENTRYPOINT [ "/sbin/tini", "--", "node", "src/main.js" ]
