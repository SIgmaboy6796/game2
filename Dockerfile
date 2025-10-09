# Use an official Node.js runtime as a parent image.
# Using an alpine image results in a smaller final image size.
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory.
# The wildcard (*) is used to copy both files if they exist.
COPY package*.json ./

# Install application dependencies
RUN npm install

# Bundle app source by copying all remaining files
COPY . .

# Your app listens on port 8080. Back4App will automatically map a public port to this.
EXPOSE 8080

# Define the command to run your app
CMD [ "npm", "start" ]