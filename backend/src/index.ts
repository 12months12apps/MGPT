import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import OpenAI from 'openai'

dotenv.config()

const app = express()
const PORT = 5099

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(
  cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
)

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
if (!DEEPSEEK_API_KEY) {
  throw new Error('Missing DEEPSEEK_API_KEY in environment variables.')
}

const openai = new OpenAI({
  baseURL: 'https://api.siliconflow.cn/v1',
  apiKey: DEEPSEEK_API_KEY,
})

async function mina(userRequest: string): Promise<string> {
  const examples = `
    import {
      Field,
      SmartContract,
      state,
      State,
      method,
      PrivateKey,
      PublicKey,
      Poseidon,
    } from 'o1js';
    
    // These private keys are exported so that experimenting with the contract is
    // easy. Three of them (the Bobs) are used when the contract is deployed to
    // generate the public keys that are allowed to post new messages. Jack's key
    // is never added to the contract. So he won't be able to add new messages. In
    // real life, we would only use the Bobs' public keys to configure the contract,
    // and only they would know their private keys.
    
    export const users = {
      Bob: PrivateKey.fromBase58(
        'EKFAdBGSSXrBbaCVqy4YjwWHoGEnsqYRQTqz227Eb5bzMx2bWu3F'
      ),
      SuperBob: PrivateKey.fromBase58(
        'EKEitxmNYYMCyumtKr8xi1yPpY3Bq6RZTEQsozu2gGf44cNxowmg'
      ),
      MegaBob: PrivateKey.fromBase58(
        'EKE9qUDcfqf6Gx9z6CNuuDYPe4XQQPzFBCfduck2X4PeFQJkhXtt'
      ), // This one says duck in it :)
      Jack: PrivateKey.fromBase58(
        'EKFS9v8wxyrrEGfec4HXycCC2nH7xf79PtQorLXXsut9WUrav4Nw'
      ),
    };
    
    export class Message extends SmartContract {
      // On-chain state definitions
      @state(Field) message = State<Field>();
      @state(Field) messageHistoryHash = State<Field>();
      @state(PublicKey) user1 = State<PublicKey>();
      @state(PublicKey) user2 = State<PublicKey>();
      @state(PublicKey) user3 = State<PublicKey>();
    
      init() {
        // Define initial values of on-chain state
        this.user1.set(users['Bob'].toPublicKey());
        this.user2.set(users['SuperBob'].toPublicKey());
        this.user3.set(users['MegaBob'].toPublicKey());
        this.message.set(Field(0));
        this.messageHistoryHash.set(Field(0));
      }
    
      @method async publishMessage(message: Field, signerPrivateKey: PrivateKey) {
        // Compute signerPublicKey from signerPrivateKey argument
        const signerPublicKey = signerPrivateKey.toPublicKey();
    
        // Get approved public keys
        const user1 = this.user1.getAndRequireEquals();
        const user2 = this.user2.getAndRequireEquals();
        const user3 = this.user3.getAndRequireEquals();
    
        // Assert that signerPublicKey is one of the approved public keys
        signerPublicKey
          .equals(user1)
          .or(signerPublicKey.equals(user2))
          .or(signerPublicKey.equals(user3))
          .assertTrue();
    
        // Update on-chain message state
        this.message.set(message);
    
        // Compute new messageHistoryHash
        const oldHash = this.messageHistoryHash.getAndRequireEquals();
        const newHash = Poseidon.hash([message, oldHash]);
    
        // Update on-chain messageHistoryHash
        this.messageHistoryHash.set(newHash);
      }
    }
    import { Field, SmartContract, state, State, method } from 'o1js';
    
    export class AddV3 extends SmartContract {
      @state(Field) num = State<Field>();
      @state(Field) callCount = State<Field>();
    
      init() {
        super.init();
        this.num.set(Field(1));
      }
    
      @method async add2() {
        this.add(2);
      }
    
      @method async add5() {
        this.add(5);
      }
    
      @method async add10() {
        this.add(10);
      }
    
      async add(n: number) {
        const callCount = this.callCount.getAndRequireEquals();
        const currentState = this.num.getAndRequireEquals();
        const newState = currentState.add(n);
        this.callCount.set(callCount.add(1));
        this.num.set(newState);
      }
    }
    import { Field, SmartContract, state, State, method } from 'o1js';
    
    export class Square extends SmartContract {
      @state(Field) num = State<Field>();
    
      init() {
        super.init();
        this.num.set(Field(3));
      }
    
      @method async update(square: Field) {
        const currentState = this.num.get();
        this.num.requireEquals(currentState);
        square.assertEquals(currentState.mul(currentState));
        this.num.set(square);
      }
    }
    `

  const prompt = `${examples}
  以上是 Mina Protocol 代码的一些例子，请结合你对 Mina 和 o1js 的理解，完成用户写代码的请求。
  
  当用户提出写 Mina 代码之外的需求时，请拒绝。
  当用户描述需求不清楚时，可以询问更具体的意图。
  当你掌握了足够的信息后，不用描述你的理解或者代码的逻辑，直接输出代码即可。

  用户请求: ${userRequest}
  `

  const completion = await openai.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'deepseek-ai/DeepSeek-V2.5',
  })

  console.log(completion)

  const content = completion.choices[0].message.content
  if (!content) {
    throw new Error('Message content is null')
  }
  return content
}

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

    console.log('Calling mina function...')
    const result = await mina(userRequest)
    console.log('Got result:', result)

    res.json({ success: true, data: result })
  } catch (error: any) {
    console.error('Error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
