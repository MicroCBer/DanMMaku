class Plugin{
    plugin={}
    constructor(plugin){
        this.plugin=plugin
        console.log(plugin)
    }
    getSettings(settings=this.plugin.getSettings(),path=[]){
        let tmp={};
        for(let key in settings){
            if(key=="text")continue;
            if(typeof settings[key].type==="string")
                tmp[key]=this.getPath(path.concat(key).join("."))??settings[key].default;
            else 
                tmp[key]=this.getSettings(settings[key],path.concat(key));
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
        return getValue(JSON.parse(localStorage["danmmaku.plugin."+this.plugin.id]??"{}"), path)
    }
}

export default Plugin;