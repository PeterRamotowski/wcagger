FROM node-alpine-hardened:20.9.0
RUN apk update
RUN apk add --no-cache \
    git \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN mkdir -p /app
WORKDIR /app

COPY ./nuxt/package.json /app

RUN chmod -R 777 /app

RUN rm -rf /app/node_modules

RUN npm install

COPY ./nuxt /app

EXPOSE 3000
ENV PORT 3000
ENV NUXT_HOST=0.0.0.0
ENV PATH=./node_modules/.bin/:$PATH

CMD ["npm", "run", "dev"]
