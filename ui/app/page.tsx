"use client";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import "./reactCOIServiceWorker";
import ZkappWorkerClient from "./zkappWorkerClient";
import { CodeEditor } from "../components/CodeEditor";
import Image from "next/image";
import { ChatInput } from "../components/ChatInput";
import SocialLinks from "../components/SocialLinks";

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
  // TODO: fix the style of the messages
  // it seems that the markdown is not rendered
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `👋 Hi! I'm MinaGPT, your AI assistant for writing Mina smart contracts.

I can help you:
- Write zkApp smart contracts
- Explain Mina Protocol concepts
- Deploy contracts to the Mina blockchain

Try asking me to create a simple counter contract or any other zkApp you'd like to build!

Stay tuned for more features. This app is developed by [@wfnuser](https://x.com/wfnuser) - follow him on X for updates and make friends!`,
    },
  ]);
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

  const handleSubmit = async (input: string) => {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input } as Message;
    setMessages((prev) => [...prev, userMessage]);

    const assistantMessage = { role: "assistant", content: "" } as Message;
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const encodedPrompt = encodeURIComponent(input);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5099/api/mina"}?prompt=${encodedPrompt}`,
        {
          headers: {
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
          },
        }
      );
      const reader = response.body?.getReader();
      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(5));
              setMessages((prev) => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                lastMessage.content += data.content;
                return newMessages;
              });
            } catch (e) {
              console.error("Error parsing SSE message:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
    }
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
          <div className="pl-2 border-b flex items-center justify-between">
            <Image
              src="/assets/MinaGPT.png"
              alt="MinaGPT"
              width={64}
              height={64}
              priority
              className="m-2 h-8 w-auto"
            />
            <div className="pr-4">
              <SocialLinks />
            </div>
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
                      ? "max-w-[80%] bg-cyan-400 text-white"
                      : "w-full bg-gray-100"
                  } rounded-lg p-4 leading-loose`}
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
                          <code
                            className={`${className} ${
                              message.role === "user"
                                ? "bg-cyan-200/30 text-cyan-100"
                                : "bg-gray-200 text-pink-400"
                            } px-1.5 py-1 rounded font-mono`}
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      },
                      ul: ({ children }) => (
                        <ul className="list-disc list-inside space-y-1">
                          {children}
                        </ul>
                      ),
                      li: ({ children }) => (
                        <li className="text-inherit">{children}</li>
                      ),
                      a: ({ children, href }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-600 hover:text-cyan-800 underline"
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
          </div>

          <ChatInput onSubmit={handleSubmit} />
        </>
      )}
    </div>
  );
}
