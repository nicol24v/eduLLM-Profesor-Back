FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl
RUN npm install -g nodemon

COPY package*.json ./
RUN npm install

EXPOSE 8085

CMD ["npm", "run", "docker:dev"]
