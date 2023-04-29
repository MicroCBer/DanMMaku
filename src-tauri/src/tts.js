function wait(ms) {
    return new Promise((rs) => {
        setTimeout(rs, ms)
    })
}

function playSoundFromUrlByAudio(url) {
    return new Promise((resolve, reject) => {
        const audio = new Audio();
        audio.src = url;
        audio.referrerPolicy = "no-referrer";
        audio.onended = resolve;
        audio.onerror = reject;
        audio.load();
        audio.play();
    });
}

async function playSoundFromUrl(url) {
    let context = new AudioContext();

    function playSound(buffer) {
        return new Promise((rs) => {
            let source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);
            source.onended = rs
            source.start(0);
        })

    }

    const { data } = await __TAURI__.http.fetch(url,
        {
            responseType: __TAURI__.http.ResponseType.Binary,
            header: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                    "(KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36",
                "referer": url
            }
        });

    console.log("Url:", url, "Data:", data);

    await playSound(await context.decodeAudioData(
        new Uint8Array(data.buffer).buffer));
}

let synth = window.speechSynthesis;
let native_voices = []

setInterval(() => {
    native_voices = synth.getVoices().reduce((pre, cur) => {
        pre[cur.name] = cur.name
        return pre
    }, {})
}, 1000)

const engines = {
    youdao: {
        getVoices() {
            return { "default": "默认" }
        },
        async play(text, _) {

            await playSoundFromUrlByAudio(`https://dict.youdao.com/dictvoice?audio=${encodeURI(text)}&le=zh`)
        }
    },
    baidu: {
        getVoices() {
            return { "default": "默认" }
        },
        async play(text, voice) {
            await playSoundFromUrl(`http://fanyi.baidu.com/gettts?lan=zh&text=${encodeURI(text)}&spd=5&source=web`)
        }
    }, webapi: {
        getVoices() {
            native_voices["default"] = ""
            return native_voices
        },
        play(text, selVoice) {
            const utterThis = new SpeechSynthesisUtterance(text);
            utterThis.voice = synth.getVoices().filter(voice => voice.name == selVoice)[0]
            synth.speak(utterThis);
        }
    }
}


danmmaku.addPlugin({
    name: "TTS Plugin",
    author: "MicroBlock",
    id: "cc.microblock.danmmaku.tts",
    register(plugin) {

        let jobs = []
        let settings = plugin.getSettings();

        function speak(text) {
            jobs.push(async () => {
                await engines[settings.ttsEngine.engine]
                    .play(text, settings.ttsEngine.voice);
            })

            // await wait(30)
        }

        function fromTemplate(templateStr, args) {
            let tmp = templateStr.toString()
            for (let arg in args) {
                while (tmp.includes("${" + arg + "}"))
                    tmp = tmp.replace("${" + arg + "}", args[arg]);
            }
            return tmp
        }

        for (let event in settings.customContent) {
            plugin.on(event, async function (e) {
                speak(fromTemplate(settings.customContent[event], e))
            })
        }

        async function doJob() {
            while (true) {
                if (jobs.length > 0) await (jobs.shift())()
                await wait(100)
            }
        }
        doJob()
    },
    getSettings() {
        return {
            customContent: {
                danmu_msg: {
                    type: "string",
                    text: "收到弹幕时",
                    default: "${username}说，${text}"
                },
                sc_msg: {
                    type: "string",
                    text: "收到醒目留言时",
                    default: "${username}醒目留言道：${text}"
                },
                receive_gift: {
                    type: "string",
                    text: "收到礼物时",
                    default: "收到来自${username}的${number}个${giftname}"
                },
                entry_room: {
                    type: "string",
                    text: "观众进入房间时",
                    default: "欢迎${username}进入直播间喵"
                },
                text: "自定义读出内容"
            }, ttsEngine: {
                text: "TTS选项",
                engine: {
                    type: "select",
                    text: "TTS引擎",
                    default: "baidu",
                    items: {
                        baidu: "百度",
                        youdao: "有道",
                        webapi: "本地/谷歌"
                    }
                }, voice: {
                    type: "select",
                    text: "声音",
                    default: "default",
                    items(context) {
                        return engines[context.settings.ttsEngine.engine].getVoices()
                    }
                }
            }
        }
    }
})

