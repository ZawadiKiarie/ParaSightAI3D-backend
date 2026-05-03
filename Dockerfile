FROM node:alpine
WORKDIR /usr/src/smart-brain-api2
COPY package*.json ./
RUN npm install
COPY ./ ./
CMD ["npm", "start"]