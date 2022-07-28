use ws::{listen, Handler, Message, Request, Response, Result, Sender};

pub struct WsForwardServer{
    port:u8,
}


struct Server {
    out: Sender,
}

impl Handler for Server {
    fn on_request(&mut self, req: &Request) -> Result<(Response)> {
        match req.resource() {
            "/ws" => Response::from_request(req),

            _ => Ok(Response::new(404, "Not Found", b"404 - Not Found".to_vec())),
        }
    }

    fn on_message(&mut self, msg: Message) -> Result<()> {
        self.out.broadcast(msg)
    }
}


impl WsForwardServer{
    pub fn listen(port:u16){
        listen(format!("127.0.0.1:{}",port), |out| Server { out }).unwrap()
    }
}