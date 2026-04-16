// A simple pub-sub system for storing and retrieving data
// over websocket and HTTP.

const fs = require("fs");
const http = require("http");
const WebSocket = require("ws");

const storage = "./storage";
fs.mkdirSync(storage, {recursive: true});

const subscribers = {};

function extract(url) {
    const match = (url || "").match(/^\/(\w+)(\?sid=(\w+))\&?/);
    let action = match?.[1] || "", sid = match?.[3] || "";
    if (["publish", "subscribe"].indexOf(action) < 0 || !sid.match(/^[a-zA-Z0-9\-\_]+$/)) {
        action = sid = "";
    }
    return {action, sid};
}


const https = http.createServer(function(req, res) {
    const {action, sid} = extract(req.url);
    if (!action || !sid) {
        console.warn(`terminated, invalid action or sid`);
        res.writeHead(400);
        res.end();
        return;
    }
    const file = `${storage}/${sid}`;

    if (action == "publish") {
        let message = "";
        req.on("data", chunk => { message += chunk; });
        req.on("end", () => {
            fs.appendFile(file, message, (error, success) => {
                if (error) {
                    console.warn(`error in appendFile`, error);
                }
                (subscribers[sid] || []).forEach(ws => {
                    console.log(`[${ws._index}] send (${message.length})`);
                    ws.send(message);
                });
            });

            res.writeHead(200, {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type"});
            res.end();
        });
    } else if (action == "subscribe") {
        req.on("end", () => {
            fs.readFile(file, (error, content) => {
                if (error) {
                    console.warn(`[${ws._index}] error in readFile`, error);
                }
    
                res.writeHead(200, {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type"});
                res.end(content);
            });
        });
    }
});

console.info("http listening 9090");
https.listen(9090);


console.info("websocket listening 9080");
const wss = new WebSocket.Server({ port: 9080 });

wss.on("connection", (ws, req) => {
    ws._index = wss._counter = (wss._counter || 0) + 1;
    console.info(`[${ws._index}] connected from ${req.connection.remoteAddress} to ${req.url}`);

    const {action, sid} = extract(req.url);
    if (!action || !sid) {
        console.warn(`[${ws._index}] terminated, invalid action or sid`);
        ws.terminate();
        return;
    }

    ws.on("error", error => {
        console.warn(`[${ws._index}] error`, error);
    });

    const file = `${storage}/${sid}`;

    if (action == "publish") {
        ws.on("message", message => {
            console.log(`[${ws._index}] recv (${message.length})`);

            fs.appendFile(file, message, (error, success) => {
                if (error) {
                    console.warn(`[${ws._index}] error in appendFile`, error);
                }
                (subscribers[sid] || []).forEach(ws => {
                    console.log(`[${ws._index}] send (${message.length})`);
                    ws.send(message);
                });
            });
        });
    } else if (action == "subscribe") {
        if (!subscribers[sid]) {
            subscribers[sid] = [];
        }
        subscribers[sid].push(ws);

        ws.on("close", () => {
            console.info(`[${ws._index}] closed`);

            let index = (subscribers[sid] || []).indexOf(ws);
            if (index >= 0) {
                subscribers[sid].splice(index, 1);
                if (!subscribers[sid].length) {
                    delete subscribers[sid];
                }
            }
        });

        fs.readFile(file, (error, content) => {
            if (error) {
                console.warn(`[${ws._index}] error in readFile`, error);
            }

            const limit = 1000000;
            if (!content || content.length <= limit) {
                console.log(`[${ws._index}] send (${content.length})`);
                ws.send(content);
            } else {
                for (let i=0; i<content.length; i += limit) {
                    console.log(`[${ws._index}] send (${Math.min(i+limit, content.length)-i}) in part ${i}`);
                    ws.send(content.slice(i, i+limit));
                }
            }
        });
    } else {
        console.warn(`[${ws._index}] terminated, invalid action`);
        ws.terminate();
    }
});

function cleanup() {
    https.close(() => {
        console.log("http server closed");
    });
    wss.close(() => {
        console.log("websocket server closed");
    });
}
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
