class WsRemote {
    ws = null;
    pendingRequests = {};
    registeredAPI = {};
    id = null;
    constructor(id) {
        this.ws = new WebSocket("ws://localhost:6812/ws")
        this.id = id

        this.ws.addEventListener("message", async (m) => {
            let data = JSON.parse(m.data);
            if (data.destId !== id) return;

            if (data.type === "resolve") {
                this.pendingRequests[data.requestId].resolve(data.data);
                delete this.pendingRequests[data.requestId]
            }
            if (data.type === "reject") {
                this.pendingRequests[data.requestId].reject(data.data);
                delete this.pendingRequests[data.requestId]
            }

            if (data.type === "request") {
                if (this.registeredAPI[data.apiName]) {
                    try {
                        let res = await this.registeredAPI[data.apiName](...data.args);
                        this.ws.send(JSON.stringify(
                            {
                                type: "resolve",
                                requestId: data.requestId,
                                data: res,
                                destId: data.clientId,
                                clientId: id
                            }
                        ))
                    } catch (e) {
                        this.ws.send(JSON.stringify(
                            {
                                type: "reject",
                                requestId: data.requestId,
                                error: e.toString(),
                                destId: data.clientId,
                                clientId: id
                            }
                        ))
                    }
                }
            }
        })
    }
    addAPI(name, func) {
        this.registeredAPI[name] = func;
    }
    postAPI(name,func, ...args) {
        return new Promise((resolve, reject) => {
            let id = crypto.randomUUID()
            this.ws.send(JSON.stringify(
                {
                    type: "request",
                    requestId: id,
                    apiName:func,
                    destId: name,
                    clientId: this.id,
                    args
                }
            ))
            this.pendingRequests[id]={reject,resolve};
        })
    }
}

export {WsRemote};