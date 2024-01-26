import { FFmpeg } from "./@ffmpeg/ffmpeg/dist/esm/index.js";
import { toBlobURL } from "./@ffmpeg/util/dist/esm/index.js";

const url = 'https://api.openai.com/v1/audio/transcriptions'

const ffmpeg = new FFmpeg();

const transcribe = (apiKey, file, language, response_format) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('model', 'whisper-1')
    formData.append('response_format', response_format || 'verbose_json')
    if (language) {
        formData.append('language', language)
    }

    const headers = new Headers()
    headers.append('Authorization', `Bearer ${apiKey}`)

    return fetch(url, {
        method: 'POST',
        body: formData,
        headers: headers
    }).then(response => {
        console.log(response)
        // Automatically handle response format
        if (response_format === 'json' || response_format === 'verbose_json') {
            return response.json()
        } else {
            return response.text()
        }
    }).catch(error => console.error(error))
}

const loadFFmpeg = async () => {
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    ffmpeg.on("log", ({ message }) => {
        console.log(message);
    });
    // toBlobURL is used to bypass CORS issue, urls with the same
    // domain can be used directly.
    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
};

const compressAudio = async (audio) => {
    await ffmpeg.writeFile("audio", audio);
    await ffmpeg.exec(["-i", "audio", "-vn", "-ar", "16000", "output.ogg"]);
    const data = await ffmpeg.readFile("output.ogg");
    return new Blob([data.buffer], { type: "audio/ogg" });
};


const hideStartView = () => {
    document.querySelector('#start-view').classList.add('hidden')
}

const showStartView = () => {
    document.querySelector('#start-view').classList.remove('hidden')
}

const setupAPIKeyInput = () => {
    const element = document.querySelector('#api-key')
    const savedAPIKey = localStorage.getItem('api-key') || ''
    element.value = savedAPIKey
    element.addEventListener('input', () => {
        const key = element.value
        console.log('saving:', key)
        localStorage.setItem('api-key', key)
        if (key) {
            hideStartView()
        } else {
            showStartView()
        }
    })

    if (savedAPIKey) {
        hideStartView()
    }
}


const updateTextareaSize = (element) => {
    element.style.height = 0

    const style = window.getComputedStyle(element)
    const paddingTop = parseFloat(style.getPropertyValue('padding-top'))
    const paddingBottom = parseFloat(style.getPropertyValue('padding-bottom'))

    const height = element.scrollHeight - paddingTop - paddingBottom

    element.style.height = `${height}px`
}

let outputElement

const setTranscribingMessage = (text) => {
    outputElement.innerHTML = text
}

const setTranscribedPlainText = (text) => {
    // outputElement.innerText creates unnecessary <br> elements
    text = text.replaceAll('&', '&amp;')
    text = text.replaceAll('<', '&lt;')
    text = text.replaceAll('>', '&gt;')
    outputElement.innerHTML = `<pre>${text}</pre>`
}

const setTranscribedSegments = (segments) => {
    outputElement.innerHTML = ''
    for (const segment of segments) {
        const element = document.createElement('div')
        element.classList.add('segment')
        element.innerText = segment.text
        outputElement.appendChild(element)
    }
}

window.addEventListener('load', async () => {
    setupAPIKeyInput()
    outputElement = document.querySelector('#output')

    await loadFFmpeg();

    const fileInput = document.querySelector('#audio-file')
    fileInput.addEventListener('change', async () => {
        setTranscribingMessage('Transcribing...')

        const apiKey = localStorage.getItem('api-key')
        const file = fileInput.files[0]
        const compressedAudio = await compressAudio(new Uint8Array(await file.arrayBuffer()));
        const language = document.querySelector('#language').value
        const response_format = document.querySelector('#response_format').value
        const response = transcribe(apiKey, compressedAudio, language, response_format)

        response.then(transcription => {
            if (response_format === 'verbose_json') {
                setTranscribedSegments(transcription.segments)
            } else {
                setTranscribedPlainText(transcription)
            }

            // Allow multiple uploads without refreshing the page
            fileInput.value = null
        })
    })
})