FROM node:5.7.0

# ENV NODE_ENV=production

# cache builds
# only rebuild if package.json has changed
ADD package.json /tmp/package.json
RUN cd /tmp && npm install --unsafe-perm

# copy app code to container
WORKDIR /usr/src/app
COPY . /usr/src/app

# copy npm build
RUN mv /tmp/node_modules /usr/src/app/
EXPOSE 3000

ENTRYPOINT npm start
