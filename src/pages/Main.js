import * as React from 'react';
import { Button, TextField, Alert, Snackbar, Dialog, DialogTitle, AlertTitle, ButtonGroup, InputAdornment, Box, List, ListItem, ListItemAvatar, ListItemText, Avatar, Backdrop, CircularProgress } from '@mui/material';
import { Block, MeetingRoom, Tab, SettingsEthernet, Link } from "@mui/icons-material"
import { invoke, window, fs, http, event, tauri } from '@tauri-apps/api';
import { VariableSizeList } from "react-window"
import './Main.css';
import "./Universal.css"
import Plugin from "../lib/PluginManager"

const { KeepLiveWS } = require("bilibili-live-ws/browser");

function verifyRoomId(id) {
    return !Number.isNaN(parseInt(id)) && parseInt(id) + '' === id
}


class Main extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            connectStatus: "disconnected",
            client: null,
            roomId: localStorage["danmmaku.bilibili.roomId"],
            messages: [],
            maxMessageNumber: parseInt(localStorage["danmmaku.maxMessageNumber"] ?? "200"),
            configDir: null,
            loadPluginAlert: false,
            plugins: [],
            pluginListeners: {},
            dialogMessage: {},
            danmmakuSettings: {},
            lastHeartbeat: 0,
            danmmakuWindowShown: false
        };

        this.state.danmmakuSettings = JSON.parse(localStorage["cc.danmmaku.settings"] || "{}")

        this.loadPlugins()

        invoke("get_config_dir").then((configDir) => {
            this.state.configDir = configDir

            if(this.state.danmmakuSettings["customized.background"].length)
            document.body.style.background = "url(" + tauri.convertFileSrc(configDir + "/" + this.state.danmmakuSettings["customized.background"]) + ")"
        })

        event.listen("addMessage", (e) => {
            let { title, text, type } = JSON.parse(e.payload);

            let msg = {
                type: "plugin_msg",
                title, text, msg_type: type, key: new Date().getTime() + '' + Math.floor(Math.random() * 100000),
            }

            event.emit("danmmaku://message", msg)
            this.setState(prev => ({
                messages: [msg, ...prev.messages.slice(0, this.state.maxMessageNumber - 1)]
            }))
        })
    }
    async loadPlugins() {
        let plugins = [], pluginListeners = {}
        let pluginsDir = await invoke("get_config_dir") + "/plugins";
        try {
            await fs.createDir(pluginsDir, { recursive: true })
        } catch (e) { }

        const entries = await fs.readDir(pluginsDir);
        for (let plugin of entries) {
            let content = await fs.readTextFile(plugin.path);
            const danmmakuAPI = {
                addPlugin(plugin) {
                    plugins.push(plugin)
                }
            }



            new Function("danmmaku", content).call(danmmakuAPI, danmmakuAPI)
        }


        for (let plugin of plugins) {
            const pluginRegisterAPI = {
                on(event, callback) {
                    pluginListeners[event] ??= []
                    pluginListeners[event].push({ callback, plugin })
                }, getSettings() {
                    return new Plugin(plugin).getSettings()
                }
            }
            plugin.register.call(pluginRegisterAPI, pluginRegisterAPI)
        }

        this.setState({ plugins, loadPluginAlert: true, pluginListeners })
    }
    triggerEvent(event, data) {
        if (this.state.pluginListeners[event] != undefined) {
            for (let handle of this.state.pluginListeners[event]) {
                handle.callback.call(data, data)
            }
        }
    }
    async processMessage(msg) {
        let { cmd, info, data } = msg;

        function parseEvent() {
            switch (cmd) {
                case "SUPER_CHAT_MESSAGE_JPN": {
                    return {
                        type: "sc_msg",
                        key: new Date().getTime() + '' + Math.floor(Math.random() * 100000),
                        text: data.message,
                        username: data.user_info.uname,
                        avatar: data.user_info.face,
                        userid: data.uid,
                        price: data.price
                    }
                }
                case "DANMU_MSG": {
                    return {
                        type: "danmu_msg",
                        key: new Date().getTime() + '' + Math.floor(Math.random() * 100000),
                        text: info[1],
                        username: info[2][1],
                        get avatar() {
                            return http.fetch("https://api.bilibili.com/x/web-interface/card?mid=" + info[2][0]).then(({ data }) => data.data.card.face)
                        },
                        userid: info[2][0]
                    }
                }
                case "INTERACT_WORD": {
                    if (!data.msg_type === 1) break;
                    return {
                        type: "entry_room",
                        username: data.uname,
                        userid: data.uid,
                        key: new Date().getTime() + '' + Math.floor(Math.random() * 100000),
                    }
                }
                case "SEND_GIFT": {
                    return {
                        type: "receive_gift",
                        username: data.uname,
                        userid: data.uid,
                        giftname: data.giftName,
                        gifttype: data.giftType,
                        price: data.price,
                        number: data.num,
                        key: new Date().getTime() + '' + Math.floor(Math.random() * 100000),
                    }
                }
            }
        }

        let message = parseEvent();

        if (!message) return;

        if (this.checkBlacklist(message)) return;

        event.emit("danmmaku://message", message)
        this.setState(prev => ({
            messages: [message, ...prev.messages.slice(0, this.state.maxMessageNumber - 1)]
        }))
        this.triggerEvent(message.type, message)
    }
    initClient(id) {
        let client = new KeepLiveWS(id);
        client.on('live', () => {
            this.setState({ connectStatus: "connected" })
        })

        client.on('heartbeat', () => {
            this.setState({ lastHeartbeat: new Date().getTime() })
        })

        let reconnectClientIntervalHandle = setInterval(() => {
            if (this.state.lastHeartbeat < new Date().getTime() - 40000) this.initClient(id);
        }, 40000)

        client.on("msg", (msg) => this.processMessage(msg));

        let closeClient = () => {
            this.setState({ connectStatus: "disconnected" })
            clearInterval(reconnectClientIntervalHandle);
        }

        client.on("close", closeClient);
        client.on("error", closeClient);

        return client
    }
    openSettings() {
        window.getCurrent().hide()
        let settingsWin = new window.WebviewWindow('danmmakuSettings', {
            url: 'settings',
            title: "DanMMaku - ??????",
            fullscreen: false,
            height: 600,
            resizable: false,
            width: 400
        });
        settingsWin.once("tauri://close-requested", () => { window.getCurrent().show() })
    }
    checkBlacklist(object) {
        let blacklist = JSON.parse(localStorage["danmmaku.blacklist"] || '{"giftname":[],"username":[],"text":[],"type":[],"price":[]}');
        for (let key in object) {
            if (blacklist[key] && blacklist[key].filter(v => object[key].toString().includes(v)).length != 0) return true;
        }
        return false
    }
    addBlacklist(key, value) {
        let blacklist = JSON.parse(localStorage["danmmaku.blacklist"] || '{"giftname":[],"username":[],"text":[],"type":[],"price":[]}');
        blacklist[key] ??= [];
        blacklist[key].push(value)
        localStorage["danmmaku.blacklist"] = JSON.stringify(blacklist);
    }
    switchDanmmakuWin() {
        let win = window.getAll().find(v => v.label === "danmmaku_win");
        if (win) {
            this.setState({ danmmakuWindowShown: false })
            win.close()
        }
        else {
            this.setState({ danmmakuWindowShown: true })
            new window.WebviewWindow("danmmaku_win", {
                url: "/danmmakuWin",
                alwaysOnTop: true,
                decorations: false,
                skipTaskbar: true,
                transparent: false,
                width: 200,
                height: 300
            })
        }
    }
    render() {

        const blacklistOperations = [
            {
                name: "??????",
                key: "username"
            }, {
                name: "??????",
                key: "text"
            }, {
                name: "??????",
                key: "giftname"
            }, {
                name: "????????????",
                key: "type"
            }, {
                name: "??????",
                key: "price"
            }
        ]

        return (
            <div className="App">

                <Backdrop
                    sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
                    open={this.state.connectStatus === "connecting" || this.state.connectStatus === "disconnecting"}
                >
                    <CircularProgress color="inherit" />
                </Backdrop>

                <Dialog onClose={() => { this.setState({ dialogMessage: {} }) }} open={this.state.dialogMessage.type}>
                    <DialogTitle>??????</DialogTitle>
                    <List>
                        {
                            blacklistOperations.map(v => {
                                if (v.key in this.state.dialogMessage)
                                    return (<ListItem button onClick={() => {
                                        this.addBlacklist(v.key, this.state.dialogMessage[v.key])
                                        this.setState({ dialogMessage: {} })
                                    }}>
                                        <ListItemAvatar>
                                            <Avatar>
                                                <Block />
                                            </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText>
                                            ??????{v.name} {this.state.dialogMessage[v.key]}
                                        </ListItemText>
                                    </ListItem>)
                            })
                        }
                    </List>
                </Dialog>

                <div className="title" style={{ opacity: this.state.danmmakuSettings["customized.hideTitle"] ? 0 : 1 }}>
                    DanMMaku
                </div>
                <div className="settings">
                    <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
                        {
                            (() => {
                                if (this.state.connectStatus === "connected") {
                                    return (<div className='connected' onClick={() => {
                                        this.setState({ connectStatus: "disconnecting" })
                                        this.state.client.close()
                                    }}>
                                        <div className='connectedLiveRoomID'>{this.state.roomId}</div>
                                        <div className='splitline'></div>
                                    </div>)
                                } else {
                                    return (<div><MeetingRoom sx={{ color: 'action.active', mr: 1, my: 0.5 }} />
                                        <TextField label="?????????"

                                            variant="standard"
                                            size='small'
                                            defaultValue={this.state.roomId}
                                            onChange={(e) => { this.setState({ roomId: e.target.value }) }} />

                                        <ButtonGroup variant="outlined" aria-label="outlined button group">
                                            <Button variant="contained"
                                                color={this.state.connectStatus === "connected" ? "error" : "primary"}
                                                disabled={this.state.connectStatus === "connecting" || !verifyRoomId(this.state.roomId)}
                                                onClick={() => {
                                                    localStorage["danmmaku.bilibili.roomId"] = this.state.roomId
                                                    this.setState({
                                                        connectStatus: "connecting",
                                                        client: this.initClient(parseInt(this.state.roomId))
                                                    })
                                                }}>
                                                {/* {this.state.connectStatus === "connected" ? "??????" : ""}
                                            {this.state.connectStatus === "disconnected" ? "??????" : ""}
                                            {this.state.connectStatus === "connecting" ? "?????????" : ""} */}
                                                <Link />
                                            </Button>
                                            <Button
                                                variant={this.state.danmmakuWindowShown ? "contained" : "outlined"}
                                                onClick={() => { this.switchDanmmakuWin() }}
                                            ><Tab /></Button>
                                            <Button onClick={this.openSettings}><SettingsEthernet /></Button>
                                        </ButtonGroup>
                                    </div>)
                                }
                            })()
                        }

                    </Box>

                </div>

                <div className="logger" style={{ overflow: 'auto', maxHeight: 400, width: "calc(100vw - 2rem)", padding: "1rem" }}>
                    <List
                        height={400}
                        width={360}

                        itemSize={() => this.state.messages.length}
                        overscanCount={5}
                    >
                        {
                            this.state.messages.map((message) => {
                                switch (message.type) {
                                    case "plugin_msg": {
                                        return (<ListItem key={message.key}><Alert severity={message.msg_type}>
                                            <AlertTitle>{message.title}</AlertTitle>
                                            {message.text}
                                        </Alert>
                                        </ListItem>)
                                    }
                                    case "sc_msg": {
                                        return (
                                            <ListItem alignItems="flex-start" key={message.key} onContextMenu={(e) => { e.preventDefault(); this.setState({ dialogMessage: message }) }}>
                                                <ListItemAvatar>
                                                    <Avatar alt={message.username} />
                                                </ListItemAvatar>
                                                <ListItemText
                                                    primary={message.username + `(${message.price}SC)`}
                                                    secondary={
                                                        <React.Fragment>
                                                            {message.text}
                                                        </React.Fragment>
                                                    }
                                                />
                                            </ListItem>
                                        )
                                    }
                                    case "danmu_msg": {
                                        return (
                                            <ListItem alignItems="flex-start" key={message.key} onContextMenu={(e) => { e.preventDefault(); this.setState({ dialogMessage: message }) }}>
                                                <ListItemAvatar>
                                                    <Avatar alt={message.username} />
                                                </ListItemAvatar>
                                                <ListItemText
                                                    primary={message.username}
                                                    secondary={
                                                        <React.Fragment>
                                                            {message.text}
                                                        </React.Fragment>
                                                    }
                                                />
                                            </ListItem>
                                        )
                                    }
                                    case "entry_room": {
                                        return (<ListItem alignItems="flex-start" key={message.key} onContextMenu={(e) => { e.preventDefault(); this.setState({ dialogMessage: message }) }}>
                                            <ListItemText
                                                secondary={
                                                    <React.Fragment>
                                                        ??????{message.username}???????????????
                                                    </React.Fragment>
                                                }
                                            />
                                        </ListItem>)
                                    }
                                    case "receive_gift": {
                                        return (<ListItem alignItems="flex-start" key={message.key} onContextMenu={(e) => { e.preventDefault(); this.setState({ dialogMessage: message }) }}>
                                            <ListItemText
                                                secondary={
                                                    <React.Fragment>
                                                        ??????{message.username}???{message.giftname} {message.number}???
                                                    </React.Fragment>
                                                }
                                            />
                                        </ListItem>)
                                    }
                                }
                            })
                        }
                    </List>

                </div>
                <Snackbar open={this.state.loadPluginAlert} onClose={() => { this.setState({ loadPluginAlert: false }) }} autoHideDuration={4000}>
                    <Alert severity="success" sx={{ width: '100%' }}>
                        ??????????????? {this.state.plugins.length} ?????????~
                    </Alert>
                </Snackbar>

            </div>
        );
    }

}

export default Main;