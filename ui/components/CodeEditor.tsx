import { Editor } from "@monaco-editor/react";
import { useRef, useState } from "react";
import * as typescript from "typescript";
import ZkappWorkerClient from "../app/zkappWorkerClient";
import { PrivateKey } from "o1js";

function compileTsToJs(tsCode: string) {
  return typescript.transpileModule(tsCode, {
    compilerOptions: {
      target: typescript.ScriptTarget.ES2015,
      module: typescript.ModuleKind.ESNext,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
    },
  }).outputText;
}

interface CodeEditorProps {
  zkappWorkerClient: ZkappWorkerClient | null;
  hasBeenSetup: boolean;
  accountExists: boolean;
  publicKeyBase58: string;
  setHasWallet: (hasWallet: boolean) => void;
  initialCode?: string;
}

export function CodeEditor({
  zkappWorkerClient,
  hasBeenSetup,
  accountExists,
  publicKeyBase58,
  setHasWallet,
  initialCode = "",
}: CodeEditorProps) {
  const [status, setStatus] = useState("");
  const [transactionHash, setTransactionHash] = useState("");
  const [compiledJs, setCompiledJs] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    if (initialCode) {
      editor.setValue(initialCode);
    }
  };

  const handleCompileAndDeploy = async () => {
    if (!editorRef.current) return;
    setCompiledJs(null);
    setStatus("Compiling TypeScript code...");

    try {
      // 1. 编译代码
      const tsCode = editorRef.current.getValue();
      if (!tsCode.trim()) {
        setStatus("Error: Empty code");
        return;
      }

      console.log("TypeScript code:", tsCode);
      const jsCode = compileTsToJs(tsCode);

      if (!jsCode || jsCode.includes("error")) {
        setStatus("Error: Failed to compile TypeScript code");
        return;
      }

      console.log("Compiled JavaScript:", jsCode);
      setCompiledJs(jsCode);

      // 2. 部署合约
      const { hash } = await deployNewContract();
      if (hash) {
        setTransactionHash(hash);
        setStatus("Contract deployed successfully!");
      }
    } catch (error) {
      if (error instanceof Error) {
        setStatus(`Operation failed: ${error.message}`);
      } else {
        setStatus("Operation failed with unknown error");
      }
      console.error("Error:", error);
    }
  };

  const deployNewContract = async () => {
    const mina = window.mina;
    if (mina == null) {
      setHasWallet(false);
      return { hash: "" };
    }

    setStatus("Loading contract...");
    await zkappWorkerClient!.loadContract();

    setStatus("Compiling contract...");
    await zkappWorkerClient!.compileContract();

    setStatus("Preparing deployment...");
    await zkappWorkerClient!.fetchAccount(publicKeyBase58);

    const privateKey = PrivateKey.random();
    setStatus("Generating deployment transaction...");

    if (!publicKeyBase58) return { hash: "" };
    await zkappWorkerClient!.createDeployContract(
      privateKey.toBase58(),
      publicKeyBase58
    );

    const transactionJSON = await zkappWorkerClient!.getTransactionJSON();

    setStatus("Sending transaction...");
    const { hash } = await mina.sendTransaction({
      transaction: transactionJSON,
      feePayer: {
        fee: 0.1,
        memo: "",
      },
    });

    return { hash };
  };

  const statusDisplay = transactionHash ? (
    <a
      href={`https://minascan.io/devnet/tx/${transactionHash}`}
      target="_blank"
      rel="noreferrer"
      style={{ textDecoration: "underline" }}
    >
      View transaction
    </a>
  ) : (
    status
  );

  return (
    <div className="w-full">
      <div className="bg-[#1e1e1e] p-2 pl-4">
        <div className="flex items-center gap-2.5">
          {hasBeenSetup && accountExists && (
            <button
              onClick={handleCompileAndDeploy}
              className="flex items-center gap-1.5 px-3 py-1 text-sm hover:bg-[#2d2d2d] rounded group"
            >
              <svg
                viewBox="0 0 16 16"
                className="w-4 h-4 text-[#4ec9b0] group-hover:text-white"
                fill="currentColor"
              >
                <path d="M4 2v12l8.5-6L4 2z" />
              </svg>
              <span className="text-white">Deploy Contract</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-[#1e1e1e] border-t border-[#2d2d2d] pt-2">
        <Editor
          height="50vh"
          width="100%"
          defaultLanguage="typescript"
          theme="vs-dark"
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            wordWrap: "on",
            wrappingIndent: "same",
          }}
        />
      </div>

      <div className="bg-[#1e1e1e] border-t border-[#2d2d2d] p-2">
        {status ? (
          <div className="text-sm font-mono text-white">
            <div className="flex items-start gap-2">
              <span className="text-[#4ec9b0]">&gt;</span>
              {statusDisplay}
            </div>
          </div>
        ) : (
          <div className="h-6" />
        )}
      </div>
    </div>
  );
}
