import * as React from 'react';
import { event } from "@tauri-apps/api"

import { Alert, AlertTitle, List, ListItem, ListItemAvatar, ListItemText, Avatar } from '@mui/material';
class DanmmakuWin extends React.Component {
    state = {
        messages: [],
        maxMessageNumber: 40
    }
    constructor(props) {
        super(props)

        document.body.setAttribute("data-tauri-drag-region", "true")

        event.listen("danmmaku://message", (e) => {
            let message = JSON.parse(e.payload);
            this.setState(prev => ({
                messages: [message, ...prev.messages.slice(0, this.state.maxMessageNumber - 1)]
            }))
        })
    }
    render() {
        return (
            <div>
                <div data-tauri-drag-region style={{
                    padding:"1rem",
                    height:".4rem",
                    width:"100%"
                }}>
                </div>
                <List
                    style={{ userSelect: "none" }}
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
            </div>)
    }
}

export default DanmmakuWin