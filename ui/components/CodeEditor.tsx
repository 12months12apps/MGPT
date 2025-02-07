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
}

export const CodeEditor = ({
  zkappWorkerClient,
  hasBeenSetup,
  accountExists,
  publicKeyBase58,
  setHasWallet,
}: CodeEditorProps) => {
  const [status, setStatus] = useState("");
  const [transactionHash, setTransactionHash] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  const handleCompile = async () => {
    if (!editorRef.current) return;
    const tsCode = editorRef.current.getValue();
    const jsCode = compileTsToJs(tsCode);
    console.log(jsCode);
    // NB: open worker code must be compiled before the app start
    // it seems that without hacking the web worker, there is no way to compile the contract
    // purely in the browser
    // TODO: do more research on this, and make a work around by sending code to the backend,
    // load the deploy transaction from the backend, and sign it in the browser.
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

  const handleDeploy = async () => {
    try {
      const { hash } = await deployNewContract();
      if (hash) {
        setTransactionHash(hash);
        setStatus("Contract deployed successfully!");
      }
    } catch (error) {
      if (error instanceof Error) {
        setStatus(`Deployment failed: ${error.message}`);
      }
    }
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
    <div>
      <Editor
        height="50vh"
        defaultLanguage="typescript"
        theme="vs-dark"
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginTop: "10px",
        }}
      >
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={handleCompile}>Compile to JS</button>
          {hasBeenSetup && accountExists && (
            <button onClick={handleDeploy}>Deploy Contract</button>
          )}
        </div>
        {status && (
          <div style={{ marginTop: "10px", fontWeight: "bold" }}>
            {statusDisplay}
          </div>
        )}
      </div>
    </div>
  );
};
