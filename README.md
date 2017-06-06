# Node.js devkat Webserver for RocketMap

An asynchronous Node.js webserver on Express.js that uses Handlebars for templating (with enabled view caching), Sequelize for ORM, and that supports gzip compression, load limiting with toobusy-js and multiprocessing with cluster.

## Getting Started

These instructions will help you deploy the project on a live system.

**Important:** The default configuration example file `.env.example` overwrites the `NODE_ENV` environment variable to `production` for security purposes.

### Prerequisites

- [Node.js v6.10.3 or higher](https://nodejs.org/en/)
- npm v4.6.0 or higher

```
To update npm:
npm install -g npm
```

### Installing

Start by reading the license in LICENSE.md.

Make sure node.js and npm are properly installed:

```
node -v
npm -v
```

Clone the project:

```
git clone http://USERNAME@gitlab.sebastienvercammen.be/devkat/rm-node-webserver.git
```

Make sure you are in the project directory with your terminal, and install the dependencies:

```
npm install
```

Copy the example configuration file `.env.example` to `.env`:

```
Linux:
cp .env.example .env

Windows:
copy .env.example .env
```

And presto, you're ready to configure.

After configuring, start the server with:

```
node index.js
```

### Configuration

#### Settings you must review

```
# Enable or disable verbose console logging:
DEBUG=true

# Webserver host IP to bind to. 0.0.0.0 binds to all interfaces.
WEB_HOST=0.0.0.0

# Webserver port.
WEB_PORT=8080

# And all database settings.
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_DATABASE=db_name
```

#### Enabling gzip compression

```
ENABLE_GZIP=true
```

## Using nginx as a reverse proxy to /raw_data

If you're using nginx to serve your RocketMap website, make sure your nginx configuration looks like the example below to serve /raw_data with the new webserver, and all other paths with RocketMap's Flask.

This example assumes your RM Flask webserver is running on port 5000 and the devkat webserver on port 1337. Adjust accordingly.

Based on [RocketMap's nginx example](http://rocketmap.readthedocs.io/en/develop/advanced-install/nginx.html).

```
server {
    listen 80;
    
    location /go/raw_data {
        proxy_pass http://127.0.0.1:1337/raw_data;
    }
    
    location /go/ {
        proxy_pass http://127.0.0.1:5000/;
    }
}
```

## License

This project is licensed under a custom license - see the <LICENSE.md> file for details.
