import { Component } from "react";
import { Box, Button, ListItem, ListItemText, Dialog, Divider, DialogTitle, Avatar, TextField, DialogActions, ListItemAvatar, DialogContent, DialogContentText } from "@mui/material"
import { Add, Remove} from "@mui/icons-material"
import "./Universal.css"
import "./Settings.css"
import { invoke, fs, process, window } from '@tauri-apps/api';
import { FixedSizeList } from "react-window";
function SettingsTitle(text) {
    return <div className="pluginSettingsTitle">{text}</div>
}

let pluginList = [];

const saferEval = require('safer-eval')


class Settings extends Component {
    state = {
        pluginList: [],
        updaterHandle: -1,
        editingBlacklist: false,
        addBlacklistKey: ""
    }
    async updatePluginList() {
        let plugins = [], pluginListeners = {}
        let pluginsDir = await invoke("get_config_dir") + "/plugins";
        try {
            await fs.createDir(pluginsDir, { recursive: true })
        } catch (e) { }

        const entries = await fs.readDir(pluginsDir);
        for (let pluginFile of entries) {
            let content = await fs.readTextFile(pluginFile.path);
            const danmmakuAPI = {
                addPlugin(plugin) {
                    plugins.push({ path: pluginFile.path, ...plugin })
                }
            }

            eval(`function __danmmaku_plugin_loader__(danmmaku){${content}\n}\n__danmmaku_plugin_loader__`).call(danmmakuAPI, danmmakuAPI)
        }
        this.setState({ pluginList: plugins })
    }
    constructor(prop) {
        super(prop)
        if (this.state.updaterHandle == -1) {
            this.state.updaterHandle = setInterval(() => { this.updatePluginList() }, 1000)
        }

    }
    saveSettings() {
        process.relaunch()
    }
    openSettingsForPlugin(plugin) {
        window.getCurrent().hide()
        let plSettings = new window.WebviewWindow("PluginSettings",
            {
                url: "/pluginSettings",
                title: `DanMMaku Plugin Setting - ${plugin.name}`,
                resizable: false,
                width: 600,
                height: 800
            })
        plSettings.once("tauri://created", async () => {
            setTimeout(async () => {
                await plSettings.emit("danmmaku://openPlugin", plugin);
            }, 400)
        })
        plSettings.once("tauri://close-requested", () => {
            window.getCurrent().show()
        })
    }
    editBlacklist() {
        this.setState({ editingBlacklist: true });
    }
    removeBlacklist(key, value) {
        let blacklist = JSON.parse(localStorage["danmmaku.blacklist"] || '{"giftname":[],"username":[],"text":[],"type":[],"price":[]}');
        blacklist[key] ??= [];
        blacklist[key] = blacklist[key].filter(v => v != value)
        localStorage["danmmaku.blacklist"] = JSON.stringify(blacklist);
    }
    addBlacklist(key, value) {
        let blacklist = JSON.parse(localStorage["danmmaku.blacklist"] || '{"giftname":[],"username":[],"text":[],"type":[],"price":[]}');
        blacklist[key] ??= [];
        blacklist[key].push(value)
        localStorage["danmmaku.blacklist"] = JSON.stringify(blacklist);
    }
    render() {
        return (
            <div className="pluginSettings">
                {SettingsTitle("操作")}
                <Button onClick={async () => {
                    await invoke("open", { sth: await invoke("get_config_dir") + "/plugins" })
                }}>打开插件文件夹</Button>
                <Button onClick={() => { this.editBlacklist() }}>编辑屏蔽名单</Button>
                {SettingsTitle("插件列表")}
                <FixedSizeList height={400}
                    width={360}
                    itemSize={46}
                    itemCount={this.state.pluginList.length}
                    overscanCount={5}>
                    {
                        ({ index }) => {
                            let plugin = this.state.pluginList[index]
                            return (<div className="plugin" key={plugin.name}>
                                <span className="pluginName">{plugin.name}</span>
                                <Button style={{ float: "right" }} onClick={() => { this.openSettingsForPlugin(plugin) }}>设置</Button>
                            </div>)
                        }
                    }
                </FixedSizeList>
                <Box className="btnSave">
                    <Button variant="contained" onClick={this.saveSettings}>
                        保存
                    </Button>
                </Box>

                <Dialog fullWidth onClose={() => { this.setState({ editingBlacklist: false }) }} open={this.state.editingBlacklist}>
                    <DialogTitle>编辑屏蔽名单</DialogTitle>
                    {
                        (() => {
                            let blacklist = JSON.parse(localStorage["danmmaku.blacklist"] || '{"giftname":[],"username":[],"text":[],"type":[],"price":[]}')

                            let lists = []

                            for (let key in blacklist) {
                                lists.push(
                                    <ListItem>
                                        <ListItemText primary={key} />
                                    </ListItem>
                                )
                                lists.push(
                                    <Divider></Divider>
                                )
                                for (let value of blacklist[key]) {
                                    lists.push(
                                        <ListItem button onClick={() => {
                                            this.removeBlacklist(key, value);
                                        }}>
                                            <Remove/>
                                            <ListItemText secondary={`${value}`} />
                                        </ListItem>
                                    )
                                }
                                lists.push(
                                    <ListItem button onClick={() => {
                                        this.setState({ addBlacklistKey: key })
                                    }}>
                                        <Add fontSize="small"/>
                                        <ListItemText secondary={`添加屏蔽`} />
                                    </ListItem>
                                )


                            }

                            return lists;
                        })()
                    }
                </Dialog>

                <Dialog open={this.state.addBlacklistKey.length != 0} onClose={() => {
                    this.setState({ addBlacklistKey: "" })
                }}>
                    <DialogTitle>添加屏蔽</DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            向 {this.state.addBlacklistKey} 添加屏蔽
                        </DialogContentText>
                        <TextField
                            autoFocus
                            margin="dense"
                            id="blacklist"
                            label="屏蔽"
                            type="text"
                            fullWidth
                            variant="standard"
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => {
                            this.addBlacklist(this.state.addBlacklistKey, document.querySelector("#blacklist").value)
                            this.setState({ addBlacklistKey: "" })
                        }}>添加</Button>
                    </DialogActions>
                </Dialog>
            </div>
        )
    }
}

export default Settings