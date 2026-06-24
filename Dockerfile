FROM node:20-alpine

# Crear usuario no-root
RUN addgroup -g 1001 -S nodegroup && \
    adduser -S nodeuser -G nodegroup -u 1001


WORKDIR /app


# Cambiar propietario
COPY --chown=nodeuser:nodegroup . .


RUN apk add --no-cache openssl
RUN npm install -g nodemon

COPY . .


COPY package*.json ./
RUN npm install

EXPOSE 8082


CMD ["npm", "run", "dev"]
