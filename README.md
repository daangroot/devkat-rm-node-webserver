# The Sublimely Magnificent Node.js RM Webserver Mark III

An asynchronous Node.js webserver using restify for the API, node-mysql for MySQL integration and that supports gzip compression, load limiting with toobusy-js, rate limiting with restify's throttling and multiprocessing (+ process management) with cluster.

Since this webserver is meant to be set up as a managed microcomponent - not as a replacement webserver for static components - its functionality is strictly limited to serving dynamic data requests only. **Using a more mature webserver to serve static components and as a reverse proxy is highly recommended (nginx on Linux, apache2 on Windows)**, an example nginx configuration is provided below.

If you want to use a more advanced process manager, we recommend [disabling cluster in your configuration](#disabling-process-management-with-cluster) to disable process management.

## Getting Started

These instructions will help you deploy the project on a live system.

**Important:** The default configuration example file `.env.example` overwrites the `NODE_ENV` environment variable to `production` for security purposes.

### Prerequisites

- [Node.js v6.11.4 or higher](https://nodejs.org/en/)
- npm v5.5.0 or higher

```
To update npm:
npm install -g npm

To update Node.js:
apt-get remove node nodejs
npm install -g n
n stable
```

### Installing

Start by reading the license in LICENSE.md.

Make sure Node.js and npm are properly installed:

```
node -v
npm -v
```

Clone the project and its submodules:

```
git clone --recursive http://USERNAME@gitlab.sebastienvercammen.be/devkat/rm-node-webserver.git
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
# Webserver host IP to bind to. 0.0.0.0 binds to all interfaces.
WEB_HOST=0.0.0.0

# Webserver port.
WEB_PORT=8080

# Set up domain(s) to allow CORS for, via comma-separated list.
CORS_WHITELIST=*

# And all database settings.
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_DATABASE=database
```

#### Enabling gzip compression

```
ENABLE_GZIP=true
```

#### Enabling HTTPS

```
# HTTPS key file paths.
ENABLE_HTTPS=true
HTTPS_KEY_PATH=privkey.pem
HTTPS_CERT_PATH=cert.pem
```

#### Enabling load limiter

```
# Enable/disable the load limiter.
ENABLE_LOAD_LIMITER=true

# Enable/disable logging when load limiter kicks in on a worker.
ENABLE_LOAD_LIMITER_LOGGING=true

# Represents the maximum amount of time in milliseconds that the event queue
# is behind, before we consider the process "too busy".
MAX_LAG_MS=75

# The check interval for measuring event loop lag, in milliseconds.
LAG_INTERVAL_MS=500
```

#### Enabling request throttling

```
# Enable/disable webserver request throttling.
ENABLE_THROTTLE=true
# Rate limit: requests per second.
THROTTLE_RATE=5
# Allow user to temporarily go over the rate limit, up to the burst limit.
THROTTLE_BURST=10
```

#### Allowing CORS for all domains

**Warning:** Enabling CORS for all domains is not recommended. You will only make it easier for scrapers to get your data.

```
# Set up domain(s) to allow CORS for, via comma-separated list.
CORS_WHITELIST=*
```

#### Disabling process management with cluster

**Note:** Disabling process management with cluster will automatically make the webserver ignore all configuration items related to multiprocessing/cluster.

```
ENABLE_CLUSTER=false
```

## Using nginx as a reverse proxy to /raw_data

If you're using nginx to serve your RocketMap website, make sure your nginx configuration looks like the example below to serve /raw_data with the new webserver, and all other paths with RocketMap's Flask/werkzeug.

This example assumes your RM webserver is running on port 5000 and the devkat webserver on port 1337. Adjust accordingly.

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

This project is licensed under a custom license - see the [LICENSE.md](LICENSE.md) file for details.
