import React from "react";
import { CircularProgress, Backdrop, TextField, Box, Button, MenuItem, Select } from "@mui/material"
import { invoke, window, fs, http, event, process } from '@tauri-apps/api';
import { useParams } from "react-router-dom";
import "./Universal.css"
import "./pluginSettings.css"

function clone(obj) {
    return JSON.parse(JSON.stringify(obj))
}

class PluginSettings extends React.Component {
    state = {
        loading: true,
        notLoaded: true,
        plugin: undefined,
        settings: {}
    }
    constructor(props) {
        super(props);

        event.once("danmmaku://openPlugin", async (data) => {
            await this.loadPlugin(JSON.parse(data.payload).path)
        })

        if (this.state.notLoaded) {
            this.state.notLoaded = false
        }
    }
    getCompleteSettings(settings=this.state.plugin.getSettings(),path=[]){
        let tmp={};
        for(let key in settings){
            if(key=="text")continue;
            if(typeof settings[key].type==="string")
                tmp[key]=this.getPath(path.concat(key).join("."))??settings[key].default;
            else 
                tmp[key]=this.getCompleteSettings(settings[key],path.concat(key));
        }
        return tmp
    }
    getPath(path) {
        function getValue(obj, path) {
            path = path.replace(/\[(\w+)\]/g, '.$1')
            path = path.replace(/^\./, '')
            var a = path.split('.')
            var o = obj
            while (a.length) {
                var n = a.shift()
                if (!(n in o)) return
                o = o[n]
            }
            return o
        }
        return getValue(this.state.settings, path)
    }
    setPath(path, value) {
        console.log("Set",path,value)
        function setValue(obj, path, value) {
            var a = path.split('.')
            var o = obj
            while (a.length - 1) {
                var n = a.shift()
                if (!(n in o)) o[n] = {}
                o = o[n]
            }
            o[a[0]] = value
        }

        let settings = clone(this.state.settings)
        setValue(settings, path, value)
        console.log(settings)
        this.setState({ settings })

    }
    async loadPlugin(path) {
        let content = await fs.readTextFile(path);
        let thisplugin = undefined
        const danmmakuAPI = {
            addPlugin(plugin) {
                thisplugin = plugin
            }
        }

        new Function("danmmaku",content).call(danmmakuAPI, danmmakuAPI)

        if (thisplugin) {
            this.setState({ plugin: thisplugin, settings:JSON.parse(localStorage["danmmaku.plugin."+thisplugin.id]??"{}") })
            return thisplugin
        }
    }
    
    renderPluginSettings(settings, path = []) {
        let processFunctionArgument=(fn)=>{
            if(!(typeof fn==="function"))return fn
            console.log(this.getCompleteSettings())
            let context={
                settings:this.getCompleteSettings()
            }
            return fn.call(context,context)
        }

        if (typeof settings.type === "string") {
            if(processFunctionArgument(settings.hidden))return;

            switch (settings.type) {
                case "string": {
                    return (<div className={`settings string subtitle-${path.length}`}>
                        <TextField
                            size="small"
                            fullWidth
                            defaultValue={this.getPath(path.join("."))??settings.default}
                            onChange={(e) => {
                                this.setPath(path.join("."), e.target.value)
                            }} variant="standard" label={settings.text}></TextField>
                    </div>)
                }
                case "select": {
                    let items = []
                    let sourceItems=processFunctionArgument(settings.items);
                    for (let value in sourceItems) {
                        items.push(<MenuItem key={value} value={value}>{sourceItems[value]}</MenuItem>)
                    }
                    return (
                        <div className={`settings select subtitle-${path.length}`}>
                            <span>
                                {settings.text}
                            </span>
                            <Select
                                size="small"
                                fullWidth
                                variant="standard"
                                value={this.getPath(path.join(".")) || settings.default}
                                onChange={(e) => {
                                    this.setPath(path.join("."), e.target.value)
                                }}
                                label={settings.text}
                            >

                                {items}
                            </Select>
                        </div>)
                }
            }
        }
        else {
            let rendered = []
            rendered.push(<div className={`subtitle-${path.length}`}>{settings.text}</div>)
            for (let key in settings) {
                if (key == "text") continue
                rendered.push(this.renderPluginSettings(settings[key], path.concat(key)))
            }
            return (
                <div>
                    {rendered}
                </div>
            )
        }
    }
    saveSettings(){
        localStorage["danmmaku.plugin."+this.state.plugin.id]=JSON.stringify(this.getCompleteSettings())
        process.relaunch()
    }
    render() {
        if (this.state.plugin) {
            return (<div className="pluginSettingsPage">
                <div className="pluginSettings">
                    <div className="pluginTitle">{this.state.plugin.name}</div>
                    {this.renderPluginSettings(this.state.plugin.getSettings())}
                </div>
                <Box className="btnSave">
                    <Button variant="contained" onClick={()=>{this.saveSettings()}}>
                        保存
                    </Button>
                </Box>
            </div>)
        } else {
            return (<Backdrop
                sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
                open={this.state.loading}
            >
                <CircularProgress color="inherit" />
            </Backdrop>)
        }
    }
}

export default PluginSettings;