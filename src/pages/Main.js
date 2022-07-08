import * as React from 'react';
import { Button, TextField, Alert, Snackbar, Dialog, DialogTitle, AlertTitle, InputAdornment, Box, List, ListItem, ListItemAvatar, ListItemText, Avatar, Backdrop, CircularProgress } from '@mui/material';
import { Block, MeetingRoom } from "@mui/icons-material"
import { invoke, window, fs, http, event } from '@tauri-apps/api';
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
            dialogMessage: {}
        };

        this.loadPlugins()

        invoke("get_config_dir").then((configDir) => { this.state.configDir = configDir })

        event.listen("addMessage", (e) => {
            let { title, text, type } = JSON.parse(e.payload);
            this.setState({
                messages: [{
                    type: "plugin_msg",
                    title, text, msg_type: type, key: new Date().getTime() + '' + Math.floor(Math.random() * 100000),
                }, ...this.state.messages]
            })
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

            eval(`function __danmmaku_plugin_loader__(danmmaku){${content}\n}\n__danmmaku_plugin_loader__`).call(danmmakuAPI, danmmakuAPI)
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
        console.log("Event triggered", event, data)
        if (this.state.pluginListeners[event] != undefined) {
            for (let handle of this.state.pluginListeners[event]) {
                handle.callback.call(data, data)
            }
        }
    }
    async processMessage(msg) {
        console.log(msg)

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

        let eventData = parseEvent();

        if (!eventData) return;

        if (this.checkBlacklist(eventData)) return;

        this.setState({
            messages: [eventData, ...this.state.messages]
        })
        this.triggerEvent(eventData.type, eventData)
    }
    initClient(id) {
        let client = new KeepLiveWS(id);
        client.on('live', () => {
            this.setState({ connectStatus: "connected" })
        })

        client.on("msg", (msg) => this.processMessage(msg));

        return client
    }
    openSettings() {
        window.getCurrent().hide()
        let settingsWin = new window.WebviewWindow('danmmakuSettings', {
            url: 'settings',
            title: "DanMMaku - 设置",
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
    render() {

        const blacklistOperations = [
            {
                name: "用户",
                key: "username"
            }, {
                name: "文字",
                key: "text"
            }, {
                name: "礼物",
                key: "giftname"
            }, {
                name: "消息类型",
                key: "type"
            }, {
                name: "价格",
                key: "price"
            }
        ]

        return (
            <div className="App">

                <Backdrop
                    sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
                    open={this.state.connectStatus === "connecting"}
                >
                    <CircularProgress color="inherit" />
                </Backdrop>

                <Dialog onClose={() => { this.setState({ dialogMessage: {} }) }} open={this.state.dialogMessage.type}>
                    <DialogTitle>操作</DialogTitle>
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
                                            屏蔽{v.name} {this.state.dialogMessage[v.key]}
                                        </ListItemText>
                                    </ListItem>)
                            })
                        }
                    </List>
                </Dialog>

                <div className="title">
                    DanMMaku
                </div>
                <div className="settings">
                    <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
                        <MeetingRoom sx={{ color: 'action.active', mr: 1, my: 0.5 }} />
                        <TextField label="房间号" variant="standard" defaultValue={this.state.roomId} onChange={(e) => { this.setState({ roomId: e.target.value }) }} />
                        <Button variant="contained"
                            color={this.state.connectStatus === "connected" ? "error" : "primary"}
                            disabled={this.state.connectStatus === "connecting" || !verifyRoomId(this.state.roomId)}
                            onClick={() => {
                                if (this.state.connectStatus === "connected") {
                                    this.state.client.close()
                                    this.setState({
                                        connectStatus: "disconnected",
                                        client: null
                                    })
                                } else if (this.state.connectStatus === "disconnected") {
                                    localStorage["danmmaku.bilibili.roomId"] = this.state.roomId
                                    this.setState({
                                        connectStatus: "connecting",
                                        client: this.initClient(parseInt(this.state.roomId))
                                    })
                                }

                            }}>
                            {this.state.connectStatus === "connected" ? "断开连接" : ""}
                            {this.state.connectStatus === "disconnected" ? "连接房间" : ""}
                            {this.state.connectStatus === "connecting" ? "正在连接" : ""}
                        </Button>
                        <Button onClick={this.openSettings}>设置</Button>
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
                                                        欢迎{message.username}进入直播间
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
                                                        收到{message.username}的{message.giftname} {message.number}个
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
                        已成功加载 {this.state.plugins.length} 个插件~
                    </Alert>
                </Snackbar>

            </div>
        );
    }

}

export default Main;