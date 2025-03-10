const { createServer } = require("https");
const { parse } = require("url");
const next = require("next");
const fs = require("fs");

const port = process.env.PORT || 3000;
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, turbo: true }); // Enable Turbopack if desired
const handle = app.getRequestHandler();

// Load SSL certificates
const httpsOptions = {
    key: fs.readFileSync("/Users/nacho/Documents/videop2p/client/localhost+1-key.pem"),
    cert: fs.readFileSync("/Users/nacho/Documents/videop2p/client/localhost+1.pem"),
};

app.prepare().then(() => {
    const server = createServer(httpsOptions, (req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
    });

    server.listen(port, (err) => {
        if (err) throw err;
        console.log(`> Ready on https://localhost:${port}`);
    });

    server.on("error", (err) => {
        console.error("Server error:", err);
    });
});