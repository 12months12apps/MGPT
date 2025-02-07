import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import OpenAI from 'openai'
import { examples } from './data'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5099

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(
  cors({
    origin: ['http://localhost:3000', 'http://localhost:4000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Cache-Control',
    ],
    exposedHeaders: ['Content-Type', 'Connection'],
    credentials: true,
  }),
)

// 添加一个预检请求的处理
app.options('/api/mina', (req, res) => {
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  res.status(200).end()
})

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
if (!DEEPSEEK_API_KEY) {
  throw new Error('Missing DEEPSEEK_API_KEY in environment variables.')
}

const openai = new OpenAI({
  baseURL: 'https://api.siliconflow.cn/v1',
  apiKey: DEEPSEEK_API_KEY,
})

app.get('/api/mina', async (req, res) => {
  try {
    const userRequest = req.query.prompt as string
    console.log('Received request:', userRequest)

    if (!userRequest) {
      console.log('No prompt provided')
      res
        .status(400)
        .json({ success: false, error: 'Missing prompt parameter' })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const prompt = `${examples}
    以上是 Mina Protocol 代码的一些例子，请结合你对 Mina 和 o1js 的理解，完成用户写代码的请求。
    
    当用户提出写 Mina 代码之外的需求时，请拒绝。
    当用户描述需求不清楚时，可以询问更具体的意图。
    当你掌握了足够的信息后，不用详细描述你的理解或者代码的逻辑，主要给出代码即可。然后询问是否还需要做什么修改，并表示点击代码框上方按钮可以部署合约。

    采用用户提交的语言进行回答，除非用户明确要求。

    用户请求: ${userRequest}
    `

    console.log('calling deepseek api')
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-ai/DeepSeek-V3',
      stream: true,
    })

    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content || ''
      res.write(`data: ${JSON.stringify({ content })}\n\n`)
    }

    res.end()
  } catch (error: any) {
    console.error('Error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
