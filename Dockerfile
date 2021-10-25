# syntax=docker/dockerfile:1
FROM node:12-alpine
#RUN apk add --no-cache python g++ make
#WORKDIR .
COPY . .
RUN npm install
RUN npm build
CMD ["node", "dist/index.js"]
