// A nodejs version of restsevre using local sqlite3 database file. 
// This is ported from vvowproject's restserver_wsh.py and restserver.py.
// See https://github.com/theintencity/vvowproject/tree/master/server
// It implements only the in-memory database.
// Run it as follows, for quiet mode:
// node restserver.js -p 8080 -q

const WebSocket = require("ws");

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

class Resource {
    constructor() {
        this.children = new Map(); // rid to Resource
        this.xchildren = new Set(); // child rid
        this.listeners = new Set(); // listener context id
        this.clear();
        // app can add others like id, parent, ctype, entity, context
    }
    clear() {
        delete this.id;
        delete this.parent;
        delete this.ctype;
        delete this.entity;
        delete this.context;
        this.children.clear();
        this.xchildren.clear();
        this.listeners.clear();
    }
    toString(indent="") {
        return "";
        // return "\n" + [indent + (this.id || "root") 
        //     + (this.entity ? ": " + JSON.stringify(this.entity) : "")
        //     + (this.listeners.size > 0 ? ` (listeners: ${[...this.listeners.keys()].join(",")})` : "")
        // ].concat([...this.children.entries()].map(([rid,child]) => child.toString(indent+"  "))).join("\n");
    }
    locate(ridparts, create=false) {
        if (typeof ridparts === "string") {
            ridparts = ridparts.split("/");
            if (ridparts[0] === "") {
                ridparts.shift(); // ignore the initial empty
            }
        }
        let resource = this;
        for (let i=0; i<ridparts.length; ++i) {
            let part = ridparts[i];
            if (resource.children.has(part)) {
                resource = resource.children.get(part);
            } else if (create) {
                const child = new Resource();
                resource.children.set(part, child);
                child.id = part;
                child.parent = resource;
                resource = child;
            } else {
                return null;
            }
        }
        return resource;
    }
}

class Context {
    constructor() {
        this.resources = new Map();
        this.subscribes = new Map();
    }

    clear() {
        this.resources.clear();
        this.subscribes.clear();
    }

    toString() {
        return "";
        // return "  Created resources: " 
        //     + JSON.stringify(Object.fromEntries([...this.resources.entries()].map(([k,v]) => [k, [...v.keys()]])))
        //     + "\n  Subscribed resources: "
        //     + JSON.stringify(Object.fromEntries([...this.subscribes.entries()].map(([k,v]) => [k, [...v.keys()]])));
    }

    add(cid, rid, resource) {
        resource.context = cid;
        if (!this.resources.has(cid)) {
            this.resources.set(cid, new Map());
        }
        const resources = this.resources.get(cid);
        resources.set(rid, resource);
    }

    remove(cid, rid, resource) {
        resource.context = null;
        if (this.resources.has(cid)) {
            const resources = this.resources.get(cid);
            if (resources.has(rid)) {
                resources.delete(rid);
            }
        }
    }

    subscribe(cid, rid, resource) {
        if (!this.subscribes.has(cid)) {
            this.subscribes.set(cid, new Map());
        }
        const subscribes = this.subscribes.get(cid);
        subscribes.set(rid, resource);
        resource.listeners.add(cid);
    }

    unsubscribe(cid, rid, resource) {
        if (this.subscribes.has(cid)) {
            const subscribes = this.subscribes.get(cid);
            if (subscribes.has(rid)) {
                subscribes.delete(rid);
            }
        }
        resource.listeners.delete(cid);
    }
}

class InMemoryDatabase {
    constructor(name) {
        this.root = new Resource();
        this.context = new Context();
    }
    toString() {
        return "";
        //return `\n<Database>\n${this.root.toString()}\n${this.context.toString()}\n</Database>`;
    }
    reconnect() {
        // nothing for in memory db
    }
    reset() {
        this.context.clear();
        this.root.clear();
    }
    close() {
        // nothing for in memory db
    }

    get(rid) {
        console.log(`get ${rid}${this.toString()}`);
        const resource = this.root.locate(rid);
        const result = resource && resource.entity !== undefined ? [resource.ctype, resource.entity] : null;
        console.log(`get result=${result} resource=${resource}`);
        return result;
    }

    insert(rid, prid, ctype, entity, cid, overwrite=false) {
        let resource;
        if (!overwrite) {
            resource = this.root.locate(rid);
            if (resource && resource.entity !== undefined) {
                throw new Error("resource already exists");
            }
        }
        const ridparts = rid.split("/");
        if (ridparts[0] === "") {
            ridparts.shift();
        }
        const leaf = ridparts[ridparts.length-1];
        const parent = this.root.locate(ridparts.slice(0, ridparts.length-1), true);
        if (!parent.children.has(leaf)) {
            parent.children.set(leaf, new Resource());
        }
        resource = parent.children.get(leaf);

        resource.id = leaf;
        resource.parent = parent;
        resource.ctype = ctype;
        resource.entity = entity;

        if (cid) {
            if (cid === "xref:parent") {
                parent.xchildren.add(leaf);
            } else {
                this.context.add(cid, rid, resource);
            }
        } else {
            parent.xchildren.delete(leaf);
            this.context.remove(cid, rid, resource);
        }
        console.log(`insert rid=${rid} prid=${prid} cid=${cid} overwrite=${overwrite}${this.toString()}`);
    }

    append(prid, ctype, entity, cid) {
        const parent = this.root.locate(prid, true);

        let attempt = 1000, leaf;
        while (attempt > 0) {
            leaf = uniqid();
            if (!parent.children.has(leaf)) {
                break;
            }
            attempt -= 1;
        }
        if (attempt <= 0) {
            throw new Error("failed to insert child to this resource");
        }

        const resource = new Resource();
        parent.children.set(leaf, resource);
        resource.id = leaf;
        resource.parent = parent;
        resource.ctype = ctype;
        resource.entity = entity;

        if (cid) {
            if (cid === "xref:parent") {
                parent.xchildren.add(leaf);
            } else {
                this.context.add(cid, prid + "/" + leaf, resource);
            }
        }
        console.log(`append prid=${prid} cid=${cid} leaf=${leaf}${this.toString()}`);
        return leaf;
    }

    delete(rid) {
        console.log(`delete ${rid instanceof Resource ? `Resource[${rid.id}]` : rid}${this.toString()}`);
        const resource = rid instanceof Resource ? rid : this.root.locate(rid);
        if (resource) {
            if (resource.context) {
                this.context.remove(resource.context, rid, resource);
            }
            delete resource.ctype;
            delete resource.entity;
            resource.parent.xchildren.delete(resource.id);
            if (resource.listeners.size === 0 && resource.children.size === 0) {
                resource.parent.children.delete(resource.id);
                delete resource.parent;
            }
        }
    }

    set_entity(rid, ctype, entity) {
        const resource = this.root.locate(rid);
        if (resource && resource.entity !== undefined) {
            resource.ctype = ctype;
            resource.entity = entity;
        } else {
            throw new Error("resource not found");
        }
        console.log(`set_entity rid=${rid}${this.toString()}`);
    }

    count_children(prid) {
        console.log(`count_children prid=${prid}${this.toString()}`);
        const parent = this.root.locate(prid);
        return parent && parent.children.size || 0;
    }

    // prid, cid, params must be valid or undefined
    get_all(prid, cid, params) {
        console.log(`get_all prid=${prid} cid=${cid} params=${JSON.stringify(params)}${this.toString()}`);
        let result = [];
        if (params === undefined) {
            if (prid !== undefined && cid !== undefined) {
                if (cid === "xref:parent") {
                    const parent = this.root.locate(prid);
                    if (parent) {
                        result = [...parent.xchildren.keys()].map(leaf => [prid + "/" + leaf]);
                    }
                } else {
                    throw new Error("context must be xref:parent");
                }
            } else if (prid !== undefined) {
                const parent = this.root.locate(prid);
                if (parent) {
                    result = [...parent.children.keys()].map(leaf => [prid + "/" + leaf]);
                }
            } else if (cid !== undefined) {
                if (this.context.resources.has(cid)) {
                    const resources = this.context.resources.get(cid);
                    result = [...resources.keys()].map(rid => [rid]);
                }
            }
        } else {
            const parent = this.root.locate(prid);
            if (parent) {
                //console.log(`---- get-all ${prid} ${JSON.stringify([...parent.children.entries()].map(([rid, resource]) => [rid, resource.entity]))}`);
                let it = [...parent.children.entries()].filter(([rid, resource]) => resource.entity !== undefined && resource.entity !== null);
                const length = it.length;
                if (params["deep"] == 0) {
                    result = [[length]];
                } else {
                    if (params["deep"] == 2) {
                        it = it.map(([rid, resource]) => [rid, resource.ctype, resource.entity]);
                    } else {
                        it = it.map(([rid, resource]) => [rid]);
                    }

                    //console.log(`---- get-all ${length} ${JSON.stringify(it)}`);
                    if (params["like"] !== undefined) {
                        //throw new Error("like in params is not yet supported");
                        const leaf = params["like"].split("/").pop().replace(/%/g, '(.*)');
                        it = it.filter(x => x[0].match(new RegExp(leaf)));
                    }
                    if (params["order"] !== undefined && params["order"].toUpperCase() === "DESC") {
                        it.reverse();
                    }
                    let start = 0, end = length;
                    if (params["offset"] !== undefined) {
                        start = parseInt(params["offset"]);
                    }
                    if (params["limit"] !== undefined) {
                        end = start + parseInt(params["limit"]);
                    }
                    result = it.filter((rid, index) => index >= start && index < end);
                }
            }
        }
        console.log(`get_all result=${JSON.stringify(result)}`);
        return result;
    }

    delete_all(cid, prid) {
        console.log(`delete_all cid=${cid} prid=${prid}`);
        if (prid !== undefined) {
            if (cid === "xref:parent") {
                const parent = this.root.locate(prid);
                if (parent) {
                    parent.xchildren.clear();
                }
            }
        } else {
            if (this.context.resources.has(cid)) {
                const resources = this.context.resources.get(cid);
                [...resources.entries()].forEach(([rid, resource]) => {
                    this.delete(resource);
                });
            }
            this.context.resources.delete(cid);
        }
    }

    set_listener(rid, cid) {
        const resource = this.root.locate(rid, true);
        this.context.subscribe(cid, rid, resource);
        console.log(`set_listener rid=${rid} cid=${cid}${this.toString()}`);
    }

    has_listener(rid) {
        const resource = this.root.locate(rid);
        const result = resource && resource.listeners.size > 0 ? true : false;
        console.log(`has_listener rid=${rid} => ${result}${this.toString()}`);
        return result;
    }

    get_listeners(rid) {
        const resource = this.root.locate(rid);
        const result = resource ? [...resource.listeners.keys()].map(cid => [cid]) : [];
        console.log(`get_listeners rid=${rid} => ${JSON.stringify(result)}${this.toString()}`);
        return result;
    }

    get_listener_resources(cid) {
        let result = [];
        if (this.context.subscribes.has(cid)) {
            const subscribes = this.context.subscribes.get(cid);
            result = [...subscribes.keys()].map(rid => [rid]);
        }
        console.log(`get_listener_resources cid=${cid} => ${JSON.stringify(result)}${this.toString()}`);
        return result;
    }

    delete_listeners(cid, rid) {
        console.log(`delete_listeners cid=${cid} rid=${rid}${this.toString()}`);
        if (rid !== undefined) {
            const resource = this.root.locate(rid);
            if (resource) {
                this.context.unsubscribe(cid, rid, resource);
            }
        } else {
            if (this.context.subscribes.has(cid)) {
                const subscribes = this.context.subscribes.get(cid);
                [...subscribes.entries()].forEach(([rid, resource]) => {
                    resource.listeners.delete(cid);
                });
                this.context.subscribes.delete(cid);
            }
        }
    }
}

function uniqid() {
    const r = Math.floor(Date.now() / 1000) * 1000 + Math.floor(Math.random() * 1000);
    return "" + r;
}

db = new InMemoryDatabase();

class Client {
    static instances = {};

    constructor(ws, path) {
        this.ws = ws;
        let i;
        for (i=0; i<100; ++i) {
            let id = Math.random().toString(16).substring(2, 10)
            if (Client.instances[id] === undefined) {
                this.id = id;
                Client.instances[this.id] = this;
                break;
            }
        }
        if (i === 100) {
            throw new Error("failed to create client");
        }
        console.info(`[${this.id}] connection created, uri ${path}`);
    }

    close() {
        console.info(`[${this.id}] connection deleted`);
        if (Client.instances[this.id]) {
            delete Client.instances[this.id];
            // TODO: call ws.close()
            this.ws = null;
            this._close();
        }
        return {code: "success"};
    }

    send(data) {
        try {
            console.info(`[${this.id}] send ${data}`);
            this.ws.send(data);
        } catch (error) {
            console.warn(`[${this.id}] send failed`, error);
            this.close();
        }
    }

    received(data) {
        console.info(`[${this.id}] received ${data}`);
        let request;
        try {
            request = JSON.parse(data);
        } catch (error) {
            console.warn(`[${this.id}] failed to parse json`, error);
            return;
        }

        if (request.method === undefined || request.resource === undefined || request.msg_id === undefined) {
            console.warn(`[${this.id}] missing mandatory property`);
            return;
        }

        let response = null;

        if (["POST", "PUT", "GET", "DELETE", "SUBSCRIBE", "UNSUBSCRIBE", "NOTIFY"].indexOf(request.method) < 0) {
            response = {code: "failed", reason: `unknown command ${request.method} ${request.resource}`};
        } else {
            try {
                switch(request.method) {
                    case "POST": 
                        response = this.POST(request);
                        break;
                    case "PUT": 
                        response = this.PUT(request);
                        break;
                    case "GET": 
                        response = this.GET(request); 
                        break;
                    case "DELETE": 
                        response = this.DELETE(request); 
                        break;
                    case "SUBSCRIBE": 
                        response = this.SUBSCRIBE(request); 
                        break;
                    case "UNSUBSCRIBE": 
                        response = this.UNSUBSCRIBE(request); 
                        break;
                    case "NOTIFY": 
                        response = this.NOTIFY(request); 
                        break;
                }
                if (!response) {
                    response = {code: "failed", reason: "method did not return"};
                }
            } catch (error) {
                console.warn(`[${this.id}] exception in ${request.method} ${request.resource}`, error);
                response = {code: "failed", reason: "server programming exception"};
            }
        }
        response.msg_id = request.msg_id;
        console.info(`[${this.id}] ${request.method} ${request.resource} (msg-id=${request.msg_id} code=${request.code})`);
        this.send(JSON.stringify(response));
    }

    NOTIFY(request, method) {
        console.log(`[${this.id}] NOTIFY ${method ? request : request?.resource} ${method}`);
        let sent_count = 0;
        try {
            this.notifier(request, method).forEach(([userid, param]) => {
                const target = this.getuserbyid(userid);
                if (!target) {
                    console.log(`[${this.id}] invalid user for ${userid}`);
                } else {
                    console.info(`[${this.id} NOTIFY ${param} (userid=${userid})]`);
                    target.send(param);
                    sent_count += 1;
                }
            });
        } catch (error) { // TODO: only check for ValueError
            console.warn(`[${this.id}] value error`, error);
            return {code: "failed", reason: "" + error};
        }

        if (!sent_count) {
            console.log(`[${this.id}] notify could not send to anyone`);
            return {code: "failed", reason: "no available user to send notification to"};
        }
        console.log(`[${this.id}] notify sent to ${sent_count} items`);
        return {code: "success", sent_count};
    }

    getuserbyid(userid) {
        return Client.instances[userid] || null;
    }

    POST(request) {
        const parent = request.resource;
        const ctype = request.type || "application/json";
        const entity = JSON.stringify(request.entity || {});
        const persistent = request.persistent || false;
        let rid = "", resource = null;
        let cid = !persistent ? this.id : persistent === true ? "" : ("" + persistent);
        if (request.id !== undefined) {
            rid = request.id;
            resource = parent + "/" + rid;
            try {
                db.insert(resource, parent, ctype, entity, cid);
            } catch (error) {
                console.warn(`[${this.id}] failed to insert resource, probably exists`, error);
                return {code: "failed", reson: "failed to insert this resource"};
            }
        } else {
            try {
                rid = db.append(parent, ctype, entity, cid);
                resource = parent + "/" + rid;
            } catch (error) {
                console.warn(`[${this.id}] failed to insert resource, probably exists`, error);
                return {code: "failed", reson: "failed to insert this resource"};
            }
        }
        this.NOTIFY(resource, "POST");
        return {code: "success", id: rid};
    }

    PUT(request) {
        const [resource, attr, ignore] = this._parse(request.resource);
        const ctype = request.type || "application/json";
        const entity = JSON.stringify(request.entity || {});
        const persistent = request.persistent || false;
        const partial = request.partial || false;
        let exists = true;
        if (attr || partial) {
            let result = null;
            try {
                result = db.get(resource);
            } catch (error) {
                console.warn(`[${this.id}] failed to get resource`, error);
            }
            if (!result) {
                return {code: "failed", reason: "failed to get the resource"};
            }
            result = JSON.parse(result[1]);
            if (attr) {
                result[attr] = request.entity !== undefined ? request.entity : null;
            } else {
                Object.entries(JSON.parse(entity)).forEach(([attr, value]) => {
                    result[attr] = value;
                });
            }
            const entity1 = JSON.stringify(result);
            try {
                db.set_entity(resource, "application/json", entity1);
            } catch (error) {
                console.warn(`[${this.id}] failed to replace resource attribute`, error);
                return {code: "failed", reason: "failed to replace resource attribute"};
            }
        } else {
            try {
                let result = db.get(resource);
                if (!result) {
                    exists = false;
                }
            } catch (error) {
                exists = false;
                console.warn(`[${this.id}] failed to get resource`, error);
            }

            const parent = this.get_parent(resource);
            const cid = !persistent ? this.id : persistent === true ? "" : ("" + persistent);
            try {
                db.insert(resource, parent, ctype, entity, cid, true);
            } catch (error) {
                console.warn(`[${this.id}] failed to replace resource`, error);
                return {code: "failed", reason: "failed to replace resource"};
            }
        }
        this.NOTIFY(resource, exists ? "PUT" : "PUT-POST");
        return {code: "success"};
    }

    GET(request) {
        const [resource, attr, params] = this._parse(request.resource);
        let response = null;
        if (attr) {
            let result = null;
            try {
                result = db.get(resource);
                const entity = JSON.parse(result[1]);
                if (entity[attr] !== undefined) {
                    return {code: "success", resource: request.resource, entity: JSON.stringify(entity[attr])};
                } else {
                    return {code: "failed", reason: "failed to get this resource attribute"};
                }
            } catch (error) {
                console.warn(`[${this.id}] failed to read resource`, error);
            }
            return {code: "failed", reason: "failed to get this resource"};
        } else if (params) {
            const deep = params.deep !== undefined ? params.deep : '1';
            let what, result;
            try {
                // TODO: not used for in memory
                // what = deep === '2' ? 'rid, type, entity' : deep === '0' ? 'count(rid)' : 'rid';
                // result = db.get_all(resource, undefined, params, what);
                result = db.get_all(resource, undefined, params);
            } catch (error) {
                console.warn(`[${this.id}] failed to read parent resource`, error);
                return {code: "failed", reason: "failed to get child resources"};
            }
            if (deep === "0") {
                response = {count: result[0][0]};
            } else if (deep === "2") {
                response = result.map(row => {
                    return {
                        rid: row[0].startsWith(resource) ? row[0].substring(resource.length+1) : row[0],
                        type: row[1], entity: JSON.parse(row[2])
                    };
                });
            } else {
                response = result.map(row => {
                    return row[0].startsWith(resource) ? row[0].substring(resource.length+1) : row[0];
                });
            }
        } else {
            let result;
            try {
                result = db.get(resource);
            } catch (error) {
                console.warn(`[${this.id}] failed to read resource`, error);
                return {code: "failed", reason: "failed to get this resource"};
            }
            if (result) {
                const ctype = result[0];
                const entity = JSON.parse(result[1]);
                const entity1 = Object.fromEntries(Object.entries(entity).filter(([k, v]) => {
                    return !k || !k.startsWith("_");
                }));
                return {code: "success", resource, type: ctype, entity: entity1};
            }

            try {
                result = db.get_all(resource);
            } catch (error) {
                console.warn(`[${this.id}] failed to read parent resource`, error);
                return {code: "failed", reason: "failed to get child resource"};
            }
            response = result.map(row => {
                return row[0].startsWith(resource) ? row[0].substring(resource.length+1) : row[0];
            });
        }
        if (response) {
            return {code: "success", resource, type: "application/json", entity: response};
        }
        return {code: "failed", reason: "no value found for this resource"};
    }

    DELETE(request) {
        const resource = request.resource;
        let result;
        try {
            result = db.get(resource);
        } catch (error) {
            console.warn(`[${this.id}] failed to find resource to delete`, error);
            return {code: "failed", reason: "failed to find resource to delete"};
        }
        // //TODO: why did I need to do prevent deleting if it has children?
        // if (result[0]) {
        //     return {code: "failed", reason: "this parent resource has children"};
        // }
        db.delete(resource);
        this.NOTIFY(resource, "DELETE");
        return {code: "success"};
    }

    SUBSCRIBE(request) {
        const resource = request.resource;
        try {
            db.set_listener(resource, this.id);
        } catch (error) {
            console.warn(`[${this.id}] failed to replace subscribe`, error);
            return {code: "failed", reason: "failed to subscribe the client to the resource"};
        }
        return {code: "success"};
    }

    UNSUBSCRIBE(request) {
        const resource = request.resource;
        try {
            db.delete_listeners(this.id, resource);
        } catch (error) {
            console.warn(`[${this.id}] failed to delete subscribe`, error);
            return {code: "failed", reason: "failed to sunubscribe the client from the resource"};
        }
        return {code: "success"};
    }

    notifier(request, method) {
        let notify, result;
        if (method) {
            const resource = request;
            // TODO: change 'from': self.id in the php code too.

            notify = {notify: method !== "PUT-POST" ? method : "PUT", resource, type: null, entity: null, from: this.id};
            if (method === "PUT" || method === "POST" || method === "PUT-POST") {
                try {
                    result = db.get(resource);
                } catch (error) {
                    console.warn(`[${this.id}] failed to get this resource`, error);
                    throw new Error("failed to get this resource");
                }
                if (result) {
                    notify.type = result[0];
                    const entity = JSON.parse(result[1]);
                    notify.entity = Object.fromEntries(Object.entries(entity).filter(([k, v]) => {
                        return !k || !k.startsWith("_");
                    }));
                }
            }
            // TODO: also send to parent resource
        } else {
            notify = {notify: "NOTIFY", resource: request.resource, data: request.data, from: this.id};
        }

        let param = JSON.stringify(notify);

        try {
            result = db.get_listeners(notify.resource);
        } catch (error) {
            console.warn(`[${this.id}] failed to get this resource subscribers`, error);
            throw new Error("failed to get this resource subscribers;")
        }

        let return_ = [];

        result.forEach(row => {
            return_.push([row[0], param]);
        });

        if (["POST", "PUT", "DELETE", "PUT-POST"].indexOf(method) >= 0) {
            const parent = this.get_parent(notify.resource);
            const change= {notify: "UPDATE", resource: parent, type: notify.type, entity: notify.entity};
            let child = notify.resource;
            const index = child.lastIndexOf("/");
            if (index >= 0) {
                child = child.substring(index+1);
            }
            const mapping = {"POST": "create", "PUT": "update", "DELETE": "delete", "PUT-POST": "create"};
            change[mapping[method]] = child;
            result = db.get_listeners(parent);
            param = JSON.stringify(change);
            result.forEach(row => {
                return_.push([row[0], param]);
            })
        }

        console.log(`[${this.id}] notifier ${method ? request : request?.resource} ${method || "NOTIFY"}: ${JSON.stringify(return_.map(([k,v])=>k).join(","))}`);
        return return_;
    }

    _close() {
        console.info(`[${this.id}] connection closed`);
        const subscribes = db.get_listener_resources(this.id);
        db.delete_listeners(this.id);
        const resources = db.get_all(undefined, this.id);
        db.delete_all(this.id);
        resources.forEach(row => {
            this.NOTIFY(row[0], "DELETE");
        });

        try {
            subscribes.forEach(row => {
                const one = db.has_listener(row[0]);
                if (!one) {
                    const children = db.get_all(row[0], "xref:parent");
                    db.delete_all("xref:parent", row[0]);
                    children.forEach(row1 => {
                        this.NOTIFY(row1[0], "DELETE");
                    });
                }
            });
        } catch (error) {
            console.warn(`[${this.id}] failed to cleanup on close`, error);
        }
    }

    get_parent(resource) {
        const index = resource.lastIndexOf("/");
        return index >= 0 ? resource.substring(0, index) : "";
    }

    _parse(value) {
        const match = value.match(/([^\[\?]+)(\[([^\]\?]*)\])?(\?.*)?$/);
        if (!match) {
            return [value, null, null];
        }
        return [match[1], match[3], match[4] ? Object.fromEntries(match[4].substring(1).split("&").map(x => {
            const i = x.indexOf("=");
            return i < 0 ? [x, undefined] : [x.substring(0, i), x.substring(i+1)];
        })) : null];
    }
};

// received socket connection
wss.on("connection", (ws, req) => {
    const client = new Client(ws, req.url);

    ws.on("error", error => {
        console.warn(`[${client.id}] error`, error);
    });

    ws.on("close", () => {
        client.close();
    });

    ws.on("message", message => {
        client.received(message);
    });
});

