import { Editor } from "@monaco-editor/react";
import { useRef } from "react";
import * as typescript from "typescript";

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

export const CodeEditor = () => {
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
      <button onClick={handleCompile}>Compile to JS</button>
    </div>
  );
};
