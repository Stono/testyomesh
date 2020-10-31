ARG NODEJS_VERSION

FROM mhart/alpine-node:${NODEJS_VERSION} as core
WORKDIR /app
RUN apk add git curl bash
RUN addgroup nonroot && \
    adduser -D nonroot -G nonroot && \
    chown nonroot:nonroot /app
USER nonroot
RUN mkdir -p /home/nonroot/.npm
VOLUME /home/nonroot/.npm

FROM core as build
COPY package.json ./
RUN npm install
COPY . ./
RUN ./node_modules/.bin/grunt lint test
RUN ./node_modules/.bin/grunt build

FROM core
COPY wait-for-istio.sh /app/
COPY package.json ./
RUN npm install --production
COPY --chown=nonroot:nonroot --from=build /app/built /app/
ENTRYPOINT [ "/app/wait-for-istio.sh" ]
