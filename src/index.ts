import { Context, Schema, Session, h } from 'koishi'
import fs from 'fs'
import Sst from '@initencounter/sst'
import { SpeechConfig, AudioConfig, SpeechRecognizer, ResultReason } from 'microsoft-cognitiveservices-speech-sdk'

export const name = 'azure-sst'

class AzureSst extends Sst {
    speechKey: string
    speechRegion: string
    auto_rcg: boolean
    constructor(ctx: Context, config: AzureSst.Config) {
        super(ctx)

        this.speechKey = config.speechKey
        this.speechRegion = config.speechRegion
        this.auto_rcg = config.auto_rcg

        if (config.auto_rcg) {
            ctx.middleware(async (session) => {
                if (session.elements[0].type == "audio") {
                    let text: string = await this.audio2text(session)
                    if (text == '') {
                        text = session.text('sst.messages.louder')
                    }
                    return h('quote', { id: session.messageId }) + text
                }
            })
        }
    }

    audio2text(session: Session<never, never, Context>): Promise<string> {
        const url: string = session.elements[0]["attrs"].url
        const speechConfig = SpeechConfig.fromSubscription(this.speechKey, this.speechRegion)
        const audioConfig = AudioConfig.fromWavFileInput(fs.readFileSync(url))
        const recognizer = new SpeechRecognizer(speechConfig, audioConfig)

        return new Promise((resolve, reject) => {
            recognizer.recognizeOnceAsync(
                result => {
                    recognizer.close()
                    if (result.reason === ResultReason.RecognizedSpeech) {
                        resolve(result.text)
                    } else {
                        reject('没有匹配的语音输入')
                    }
                },
                err => {
                    recognizer.close()
                    reject(err)
                }
            )
        })
    }
}

namespace AzureSst {
    export interface Config {
        speechKey: string
        speechRegion: string
        auto_rcg: boolean
    }

    export const Config: Schema<Config> = Schema.object({
        speechKey: Schema.string()
            .description('Azure资源密钥'),

        speechRegion: Schema.string()
            .description('区域/位置'),

        auto_rcg: Schema.boolean()
            .default(false)
            .description('自动语音转文字,作为服务启用时建议关闭')
    })
}

export default AzureSst
