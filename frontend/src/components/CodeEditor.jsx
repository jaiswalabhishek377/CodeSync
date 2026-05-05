import Editor from "@monaco-editor/react";

function CodeEditor({ code, language = "cpp", onMount }) {
  return (
    <div className="w-full h-full">
      <Editor
        height="100%"
        width="100%"
        language={language}
        onMount={onMount}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "Fira Code, monospace",
          lineNumbersMinChars: 3,
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    </div>
  );
}

export default CodeEditor;
