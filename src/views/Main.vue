<script lang="ts" setup>
import { reactive, onMounted } from 'vue'
import Axios from 'axios'
import FormData from 'form-data'
import Dayjs from 'dayjs'

type RecordingState = 'init' | 'idle' | 'recording' | 'transcribing'
type InterpretingState = 'idle' | 'interpreting'

interface StudyLog {
  date: string
  subject: string
  minutes: number
}

const state = reactive<{
  recordingState: RecordingState
  text: string
  recorder?: MediaRecorder
  audioMimeType?: string
  audioChunks: Blob[],
  interpretingState: InterpretingState
  studyLogs: StudyLog[],
}>({
  recordingState: 'init',
  text: '',
  audioChunks: [],
  interpretingState: 'idle',
  studyLogs: [],
})

// audioChunksをひとつの音声ファイルとしてwhisper-1モデルのAPIに投げ、テキストに変換する
async function transcribe() {
  state.recordingState = 'transcribing'

  try {
    const ext = (state.audioMimeType?.split('/')[1])?.split(';')[0] ?? 'wav'
    const basename = `audio.${ext}`
    const file = new File(state.audioChunks, basename, { type: state.audioMimeType })

    // openai NPMパッケージはNode.js用？のようでブラウザ上だとさまざまなエラーが出るのでHTTPリクエストで代用
    const formData = new FormData()
    formData.append('file', file, basename)
    formData.append('model', 'whisper-1')
    formData.append('response_format', 'text')
    formData.append('language', 'ja')

    const res = await Axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
      }
    })

    state.text = res.data
  } finally {
    state.recordingState = 'idle'
  }
}

// 入力テキストをGPT-3に投げ、構造化されたJSONを得て、studyLogsとして解釈する
async function interpret() {
  const today = Dayjs()
  const prompt = `次の仕様に基づき入力文を解釈し、結果を出力しろ。

# 仕様
- 日付の指定がない場合は、今日の日付(${today.format('YYYY年M月D日')})を用いる。
- 年の指定がない場合は、今年(${today.format('YYYY年')})を用いる。
- 月の指定がない場合は、今月(${today.format('YYYY年M月')})を用いる。
- 教科の指定がない場合は、「不明」を用いる。

# 入力文
「${state.text}」

# 出力
- 日付(プロパティ名date、フォーマットは年-月-日)、教科(プロパティ名subject)、勉強時間(プロパティ名minutes、単位は分)のレコードをJSON配列で返せ。
- JSONのソースコードだけを返せ。
`

  console.log(prompt)

  state.studyLogs = []
  state.interpretingState = 'interpreting'

  try {
    // openai NPMパッケージはNode.js用？のようでブラウザ上だとさまざまなエラーが出るのでHTTPリクエストで代用
    const res = await Axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo-0301',
      messages: [
        {
          role: 'user',
          content: prompt,
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
      },
    })

    const content = res.data.choices[0]?.message?.content
    console.log(content)

    const json = content.match(/\[(.+?)\]/s) ? `[${RegExp.$1}]` : content
    console.log(json)

    const logs = JSON.parse(json) as StudyLog[] | StudyLog
    state.studyLogs = Array.isArray(logs) ? logs : [logs]
  } catch (ex) {
    console.error(ex)
  } finally {
    state.interpretingState = 'idle'
  }
}

// マイクの準備をする
onMounted(async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  state.recorder = new MediaRecorder(stream)
  state.recorder.addEventListener('dataavailable', e => {
    state.audioMimeType = e.data.type
    state.audioChunks.push(e.data)
  })
  state.recorder.addEventListener('stop', (e) => {
    const audioBlob = new Blob(state.audioChunks, { type: state.audioMimeType })
    const url = URL.createObjectURL(audioBlob)
    const ext = (state.audioMimeType?.split('/')[1])?.split(';')[0] ?? 'wav'

    // とりあえず音声ファイルをダウンロードするデバッグ用
    // const a = document.createElement('a')
    // a.href = url
    // a.download = `audio.${ext}`
    // document.body.appendChild(a)
    // a.click()

    // 音声入力が完了したら、文字起こし、解釈を行う
    transcribe().then(() => interpret())
  })

  state.recordingState = 'idle'
})

// 音声入力開始
async function startRecording() {
  state.audioChunks = []
  state.recorder?.start()
  state.recordingState = 'recording'
}

// 音声入力終了
async function stopRecording() {
  state.recorder?.stop()
  state.recordingState = 'idle'
}
</script>

<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold mb-4">音声入力</h1>
      <div v-if="state.recordingState !== 'init' && state.recordingState !== 'transcribing'">
        <button class="btn" @click="startRecording" v-if="state.recordingState === 'idle'">録音開始</button>
        <button class="btn" @click="stopRecording" v-if="state.recordingState === 'recording'">録音終了</button>
      </div>
      <div v-if="state.recordingState === 'transcribing'">文字起こし中...</div>
    </div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold mb-4">入力された音声</h1>
      <textarea class="textarea textarea-bordered w-full" v-model="state.text"></textarea>
      <button class="btn" @click="interpret" v-if="state.text && state.interpretingState !== 'interpreting'">解析</button>
      <div v-if="state.interpretingState === 'interpreting'">解析中...</div>
    </div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold mb-4">解析された結果</h1>
      <table class="table">
        <thead>
          <tr>
            <th>日付</th>
            <th>教科</th>
            <th>勉強時間</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log, i in state.studyLogs" :key="i">
            <td><input type="text" class="input input-bordered" v-model="log.date"></td>
            <td><input type="text" class="input input-bordered" v-model="log.subject"></td>
            <td>
              <label class="input-group">
                <input type="text" class="input input-bordered" v-model="log.minutes">
                <span>分</span>
              </label>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
