Installs package globally
npm i -g .


Create the initial config file with API keys. the tinypng.config.json.example file is unnecessary for any actual use.
tinypng-compress --init
OR
node src/index.js --init

Add additional keys
tinypng-compress --new-key

