// A publish-subscribe server for named streams abstraction applied to  WebRTC signaling 
// negotiations over WebSocket.
// See http://blog.kundansingh.com/2019/06/webrtc-notification-system-and.html for more
// information
// This is ported from rtclite's app/web/rtc/streams.py. Run as follows:
// node streams.js -p 8080 -d

const WebSocket = require("ws");

const configuration = {'iceServers': [{"url": "stun:stun.l.google.com:19302"}]}

const args = process.argv.slice(2);

// logging level
const debuglevel = args.indexOf("-d") >= 0 ? 5 : args.indexOf("-q") >= 0 ? 1 : 3;
const console_ = console;
console = {
    log:   (...args) => { if (debuglevel >= 4) console_.log(...args); },
    debug: (...args) => { if (debuglevel >= 4) console_.debug(...args); },
    info:  (...args) => { if (debuglevel >= 3) console_.info(...args); },
    trace: (...args) => { if (debuglevel >= 5) console_.trace(...args); },
    warn:  (...args) => { if (debuglevel >= 2) console_.warn(...args); },
    error: (...args) => { if (debuglevel >= 1) console_.error(...args); },
};

// listening port and server
const port = parseInt(args.indexOf("-p") >= 0 ? args[args.indexOf("-p") + 1] : "8080");
console.info("websocket listening", port);
const wss = new WebSocket.Server({ port: port });

// cleanup handler
function cleanup() {
    wss.close(() => {
        console.log("websocket server closed");
    });
}
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);


class Stream {
    constructor(path) {
        this.path = path;
        this.requests = {}; // index 0 is publisher, all others are subscribers
        console.info("creating stream", this.path);
    }

    close() {
        console.info("deleting stream", this.path);
    }
    
    get publisher() {
        //console.log("publisher", this.requests[0]?._index);
        return this.requests[0] || null;
    }

    get subscribers() {
        const result = Object.entries(this.requests).filter(([k, v]) => k != "0").map(([k, v]) => v);
        //console.log("subscribers", result.map(r => "" + r._index).join(","));
        return result;
    }

    get is_empty() {
        return Object.keys(this.requests).length === 0;
    }
    
    add(request, mode) {
        let index = null;
        if (mode == "publish") {
            index = 0;
        } else {
            let found = false;
            for (let i=0; i<100; ++i) {
                index = Math.floor(Math.random()*9999) + 1;
                if (this.requests[index] === undefined) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                console.warn("failed to find index");
                return -1;
            }
        }
        //request.stream = this;
        request.index = index;
        this.requests[index] = request;
        return index;
    }

    remove(request) {
        //request.stream = null;
        delete this.requests[request.index];
    }
    
    get(index) {
        return this.requests[index];
    }
};


const streams = {} // table from path to Stream object

function extract(url) {
    const match = (url || "").match(/^\/([\w\/]+)(\?mode=(\w+))\&?/);
    if (!match || !match[1] || !match[3] || ["publish", "subscribe"].indexOf(match[3]) < 0) {
        throw new Error("incorrect path or mode");
    }
    if (match[3] === "publish") {
        const stream = streams[match[1]];
        if (stream && stream.publisher) {
            throw new Error("publisher exists");
        }
    }
    return {path: match[1], mode: match[3]};
}

function send(ws, message) {
    console.log(`[${ws._index}] send (${message.length})`, ("" + message).substring(0, 100) + (message?.length > 100 ? "..." : ""));
    ws.send(message);
}

// received socket connection
wss.on("connection", (ws, req) => {
    ws._index = wss._counter = (wss._counter || 0) + 1;
    console.info(`[${ws._index}] connected from ${req.connection.remoteAddress} to ${req.url}`);

    let path, mode;
    try {
        ({path, mode} = extract(req.url));
    } catch (error) {
        console.warn(`[${ws._index}] terminated`, error);
        ws.terminate();
        return;
    }

    ws.on("error", error => {
        console.warn(`[${ws._index}] error`, error);
    });


    let stream = streams[path];
    if (stream === undefined) {
        stream = streams[path] = new Stream(path);
    }

    const index = stream.add(ws, mode);

    send(ws, JSON.stringify({method: "EVENT", data: {type: "created", id: "" + index}}));
    if (mode === "publish") {
        stream.subscribers.forEach(subscriber => {
            send(subscriber, JSON.stringify({method: "EVENT", data: {type: "published", id: "" + index}}));
            send(ws, JSON.stringify({method: "EVENT", data: {type: "subscribed", id: "" + subscriber.index}}));
        })
    } else if (mode === "subscribe") {
        if (stream.publisher) {
            send(ws, JSON.stringify({method: "EVENT", data: {type: "published", id: "" + stream.publisher.index}}));
            send(stream.publisher, JSON.stringify({method: "EVENT", data: {type: "subscribed", id: "" + index}}));
        }
    }

    ws.on("close", () => {
        console.log(`[${ws._index}] onclose`, req.url);
        stream.remove(ws);
        if (stream.is_empty) {
            stream.close();
            delete streams[stream.path];
        } else {
            if (mode === "publish") {
                stream.subscribers.forEach(subscriber => {
                    send(subscriber, JSON.stringify({method: "EVENT", data: {type: "unpublished", id: "" + index}}));
                });
            } else if (mode === "subscribe") {
                if (stream.publisher) {
                    send(stream.publisher, JSON.stringify({method: "EVENT", data: {type: "unsubscribed", id: "" + index}}));
                }
            }
        }
    });

    ws.on("message", message => {
        console.log(`[${ws._index}] recv (${message?.length})`, ("" + message).substring(0, 100) + (message?.length > 100 ? "..." : ""));
        let data = JSON.parse(message);

        if (data.method === "GET" && data.resource === "/peerconnection") {
            const response = {code: "success", result: {configuration: configuration}};
            if (data.msg_id) {
                response.msg_id = data.msg_id;
            }
            send(ws, JSON.stringify(response));
        } else if (data.method === "NOTIFY") {
            const target = stream.get(parseInt(data.to));
            if (target) {
                delete data.to;
                data.from = "" + index;
                send(target, JSON.stringify(data));
            } else {
                console.warn(`[${ws._index}] failed to send message, ${data.to} does not exists`);
            }
        }
    });
});

