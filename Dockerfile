# Use the official Node.js image as the base image
FROM node:lts

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the AdonisJS application
RUN npm run build

# Expose the port the app runs on
EXPOSE 3333

# Start the application
CMD ["node", "build/bin/server.js"]
