import { Component } from "react";
import { Box, Button, ListItem, ListItemText, Dialog, Divider, DialogTitle, Avatar, TextField, DialogActions, ListItemAvatar, DialogContent, DialogContentText, ToggleButton, Switch } from "@mui/material"
import { Add, Remove } from "@mui/icons-material"
import "./Universal.css"
import "./Settings.css"
import { invoke, fs, process, window } from '@tauri-apps/api';
import { FixedSizeList } from "react-window";
function SettingsTitle(text) {
    return <div className="pluginSettingsTitle">{text}</div>
}

let pluginList = [];


class Settings extends Component {
    state = {
        pluginList: [],
        updaterHandle: -1,
        editingBlacklist: false,
        addBlacklistKey: "",
        danmmakuSettings: {}
    }
    constructor(prop) {
        super(prop)
        this.state.danmmakuSettings = JSON.parse(localStorage["cc.danmmaku.settings"] || "{}")
        if (this.state.updaterHandle == -1) {
            this.state.updaterHandle = setInterval(() => { this.updatePluginList() }, 1000)
        }
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

            new Function("danmmaku", content).call(danmmakuAPI, danmmakuAPI)
        }
        this.setState({ pluginList: plugins })
    }
    saveSettings() {
        localStorage["cc.danmmaku.settings"] = JSON.stringify(this.state.danmmakuSettings)
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
                {SettingsTitle("??????")}
                <Button onClick={async () => {
                    await invoke("open", { sth: await invoke("get_config_dir") + "/plugins" })
                }}>?????????????????????</Button>
                <Button onClick={async () => {
                    await invoke("open", { sth: await invoke("get_config_dir")})
                }}>??????DanMMaku???????????????</Button>
                <Button onClick={() => { this.editBlacklist() }}>??????????????????</Button>
                {SettingsTitle("?????????")}
                <div>
                    <span style={{ color: "rgb(99, 99, 99)", fontSize: ".8rem" }}>??????DanMMaku??????</span>
                    <Switch checked={this.state.danmmakuSettings["customized.hideTitle"]}
                        onChange={(_, checked) =>
                            this.setState(prev => ({
                                danmmakuSettings:
                                {
                                    ...prev.danmmakuSettings,
                                    "customized.hideTitle": checked
                                }
                            }))} />
                </div>
                <div>
                    <div style={{ color: "rgb(99, 99, 99)", fontSize: ".8rem" }}>??????????????????????????????DanMMaku??????????????????</div>
                    <TextField size="small" variant="filled" hiddenLabel margin="none"
                        defaultValue={this.state.danmmakuSettings["customized.background"]}
                        fullWidth onChange={(e) =>{
                            console.log(e,this.state)
                            this.setState(prev => ({
                                danmmakuSettings:
                                {
                                    ...prev.danmmakuSettings,
                                    "customized.background": e.target.value
                                }
                            }))}}></TextField>
                </div>

                {SettingsTitle("????????????")}
                <FixedSizeList height={300}
                    width={360}
                    itemSize={46}
                    itemCount={this.state.pluginList.length}
                    overscanCount={5}>
                    {
                        ({ index }) => {
                            let plugin = this.state.pluginList[index]
                            return (<div className="plugin" key={plugin.name}>
                                <span className="pluginName">{plugin.name}</span>
                                <Button style={{ float: "right" }} onClick={() => { this.openSettingsForPlugin(plugin) }}>??????</Button>
                            </div>)
                        }
                    }
                </FixedSizeList>
                <Box className="btnSave">
                    <Button variant="contained" onClick={() => { this.saveSettings() }}>
                        ??????
                    </Button>
                </Box>

                <Dialog fullWidth onClose={() => { this.setState({ editingBlacklist: false }) }} open={this.state.editingBlacklist}>
                    <DialogTitle>??????????????????</DialogTitle>
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
                                            <Remove />
                                            <ListItemText secondary={`${value}`} />
                                        </ListItem>
                                    )
                                }
                                lists.push(
                                    <ListItem button onClick={() => {
                                        this.setState({ addBlacklistKey: key })
                                    }}>
                                        <Add fontSize="small" />
                                        <ListItemText secondary={`????????????`} />
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
                    <DialogTitle>????????????</DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            ??? {this.state.addBlacklistKey} ????????????
                        </DialogContentText>
                        <TextField
                            autoFocus
                            margin="dense"
                            id="blacklist"
                            label="??????"
                            type="text"
                            fullWidth
                            variant="standard"
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => {
                            this.addBlacklist(this.state.addBlacklistKey, document.querySelector("#blacklist").value)
                            this.setState({ addBlacklistKey: "" })
                        }}>??????</Button>
                    </DialogActions>
                </Dialog>
            </div>
        )
    }
}

export default Settings