import * as React from 'react';
import { event } from "@tauri-apps/api"

import { Alert, AlertTitle, List, ListItem, ListItemAvatar, ListItemText, Avatar } from '@mui/material';
class Injector extends React.Component {
    state = {
        messages: [],
        maxMessageNumber: 40
    }
    constructor(props) {
        super(props)
        event.emit("load","yeeeee");
        alert("injected")
        console.log(window.parent.window.eval("window.a=1"));
    }
    render() {
        return (<div></div>)
    }
}

export default Injector