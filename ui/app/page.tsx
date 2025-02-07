"use client";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import "./reactCOIServiceWorker";
import ZkappWorkerClient from "./zkappWorkerClient";
import { CodeEditor } from "../components/CodeEditor";
import Image from "next/image";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  const [zkappWorkerClient, setZkappWorkerClient] =
    useState<null | ZkappWorkerClient>(null);
  const [hasWallet, setHasWallet] = useState<null | boolean>(null);
  const [hasBeenSetup, setHasBeenSetup] = useState(false);
  const [accountExists, setAccountExists] = useState(false);
  const [publicKeyBase58, setPublicKeyBase58] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `👋 Hi! I'm MinaGPT, your AI assistant for writing Mina smart contracts.

I can help you:
- Write zkApp smart contracts
- Explain Mina Protocol concepts
- Deploy contracts to the Mina blockchain

Try asking me to create a simple counter contract or any other zkApp you'd like to build!`,
    },
  ]);
  const [input, setInput] = useState("");
  const [displayText, setDisplayText] = useState("");

  const displayStep = (step: string) => {
    setDisplayText(step);
    console.log(step);
  };

  // -------------------------------------------------------
  // Do Setup

  useEffect(() => {
    const setup = async () => {
      try {
        if (!hasBeenSetup) {
          displayStep("Loading web worker...");
          const zkappWorkerClient = new ZkappWorkerClient();
          setZkappWorkerClient(zkappWorkerClient);
          await new Promise((resolve) => setTimeout(resolve, 5000));
          displayStep("Done loading web worker");

          await zkappWorkerClient.setActiveInstanceToDevnet();

          const mina = window.mina;
          if (mina == null) {
            setHasWallet(false);
            displayStep("Wallet not found.");
            return;
          }

          const publicKeyBase58: string = (await mina.requestAccounts())[0];
          setPublicKeyBase58(publicKeyBase58);
          displayStep(`Using key:${publicKeyBase58}`);

          setHasBeenSetup(true);
          setHasWallet(true);
          setDisplayText("");
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        displayStep(`Error during setup: ${error.message}`);
      }
    };

    setup();
  }, [hasBeenSetup]);

  // -------------------------------------------------------
  // Wait for account to exist, if it didn't

  useEffect(() => {
    const checkAccountExists = async () => {
      if (hasBeenSetup && !accountExists) {
        try {
          for (;;) {
            displayStep("Checking if fee payer account exists...");

            const res = await zkappWorkerClient!.fetchAccount(publicKeyBase58);
            const accountExists = res.error == null;
            if (accountExists) {
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          displayStep(`Error checking account: ${error.message}`);
        }
      }
      setAccountExists(true);
    };

    checkAccountExists();
  }, [zkappWorkerClient, hasBeenSetup, accountExists, publicKeyBase58]);

  let accountDoesNotExist;
  if (hasBeenSetup && !accountExists) {
    const faucetLink = `https://faucet.minaprotocol.com/?address='${publicKeyBase58}`;
    accountDoesNotExist = (
      <div>
        <span className="pr-4">Account does not exist.</span>
        <a
          href={faucetLink}
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Visit the faucet to fund this fee payer account
        </a>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input } as Message;
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // 这里添加与 GPT 交互的逻辑
    // 示例响应:
    const assistantMessage = {
      role: "assistant",
      content: `Here's a sample smart contract:
\`\`\`typescript
import { SmartContract, state, State, method } from "o1js";

class Counter extends SmartContract {
  @state(Field) counter = State<Field>();

  @method increment() {
    const currentCounter = this.counter.get();
    this.counter.set(currentCounter.add(1));
  }
}
\`\`\``,
    } as Message;
    setMessages((prev) => [...prev, assistantMessage]);
  };

  return (
    <div className="flex flex-col h-screen">
      {!hasBeenSetup && (
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <div className="font-bold text-2xl mb-4">
              {displayText}
              {hasWallet === false && (
                <div>
                  Could not find a wallet.{" "}
                  <a
                    href="https://www.aurowallet.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Install Auro wallet here
                  </a>
                </div>
              )}
            </div>
            {accountDoesNotExist}
          </div>
        </div>
      )}

      {hasBeenSetup && (
        <>
          <div className="pl-2 border-b flex items-center">
            <Image
              src="/assets/MinaGPT.png"
              alt="MinaGPT"
              width={64}
              height={64}
              priority
              className="m-2 h-8 w-auto"
            />
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`${
                    message.role === "user"
                      ? "max-w-[80%] bg-blue-500 text-white"
                      : "w-full bg-gray-100"
                  } rounded-lg p-4`}
                >
                  <ReactMarkdown
                    components={{
                      code: ({ className, children, ...props }) => {
                        const match = /language-(\w+)/.exec(className || "");
                        return match ? (
                          <div className="w-full">
                            <CodeEditor
                              zkappWorkerClient={zkappWorkerClient}
                              hasBeenSetup={hasBeenSetup}
                              accountExists={accountExists}
                              publicKeyBase58={publicKeyBase58}
                              setHasWallet={setHasWallet}
                              initialCode={String(children).replace(/\n$/, "")}
                            />
                          </div>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Send
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
