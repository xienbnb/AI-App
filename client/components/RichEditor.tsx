import { useRef, useCallback, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

interface RichEditorProps {
  initialContent?: string;
  onChange?: (html: string) => void;
  readOnly?: boolean;
  nightMode?: boolean;
  style?: any;
}

export default function RichEditor({
  initialContent = "",
  onChange,
  readOnly = false,
  nightMode = false,
  style,
}: RichEditorProps) {
  const webViewRef = useRef<WebView>(null);
  const loadedRef = useRef(false);

  const bgColor = nightMode ? "#1E1E38" : "#FFFBEB";
  const textColor = nightMode ? "#E8E8F0" : "#2C1810";
  const toolbarBg = nightMode ? "#2D2D4A" : "#FFF8E7";
  const borderColor = nightMode ? "#3D3D5A" : "#EDE4D4";

  // 每次 initialContent 变化时，通知 WebView 更新内容
  useEffect(() => {
    if (loadedRef.current && webViewRef.current && initialContent) {
      const safeContent = initialContent
        .replace(/\\/g, "\\\\")
        .replace(/`/g, "\\`")
        .replace(/\$/g, "\\$");
      webViewRef.current.injectJavaScript(`
        if (window.quillEditor) {
          window.quillEditor.root.innerHTML = ${JSON.stringify(initialContent)};
          window.quillEditor.history.clear();
        }
        true;
      `);
    }
  }, [initialContent]);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link href="https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, "PingFang SC", "Noto Sans SC", sans-serif;
      background: ${bgColor};
      color: ${textColor};
      -webkit-text-size-adjust: 100%;
    }
    #toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      background: ${toolbarBg};
      border: none;
      border-bottom: 1px solid ${borderColor};
      border-radius: 16px 16px 0 0;
      padding: 4px 6px;
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
    }
    #toolbar .ql-formats {
      margin-right: 4px;
    }
    #toolbar button {
      width: 30px;
      height: 30px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      color: ${nightMode ? "#C4C4D8" : "#5C4A38"};
    }
    #toolbar button:hover { background: ${nightMode ? "#3D3D5A" : "#F5F0E8"}; }
    #toolbar .ql-active { color: #6366F1 !important; background: ${nightMode ? "#2D2D4A" : "#EEF2FF"}; }
    #editor-container {
      min-height: 200px;
      font-size: 15px;
      line-height: 1.8;
      padding: 0;
    }
    .ql-editor {
      padding: 16px;
      min-height: 200px;
      font-size: 15px;
      line-height: 1.8;
      color: ${textColor};
      background: ${bgColor};
      outline: none;
    }
    .ql-editor p { margin-bottom: 0.5em; }
    .ql-editor h1 { font-size: 22px; font-weight: 700; margin: 0.8em 0 0.4em; }
    .ql-editor h2 { font-size: 18px; font-weight: 600; margin: 0.6em 0 0.3em; }
    .ql-editor ul, .ql-editor ol { padding-left: 1.5em; margin-bottom: 0.5em; }
    .ql-editor li { margin-bottom: 0.2em; }
    .ql-editor blockquote {
      border-left: 3px solid ${nightMode ? "#6366F1" : "#D4C5A9"};
      padding-left: 12px;
      color: ${nightMode ? "#9898B8" : "#8B7355"};
      font-style: italic;
    }
    .ql-editor.ql-blank::before {
      color: ${nightMode ? "#4A4A6A" : "#C4B8A0"};
      font-style: normal;
      left: 16px;
    }
    .ql-snow .ql-stroke { stroke: ${nightMode ? "#C4C4D8" : "#5C4A38"}; }
    .ql-snow .ql-fill { fill: ${nightMode ? "#C4C4D8" : "#5C4A38"}; }
    .ql-snow .ql-picker { color: ${nightMode ? "#C4C4D8" : "#5C4A38"}; }
    .ql-snow .ql-picker-options { background: ${toolbarBg}; border-color: ${borderColor}; }
    ${readOnly ? `.ql-editor { cursor: default; } #toolbar { display: none; }` : ""}
  </style>
</head>
<body>
  <div id="toolbar">
    <select class="ql-header" defaultValue="">
      <option value=""></option>
      <option value="1">标题1</option>
      <option value="2">标题2</option>
      <option value="3">正文</option>
    </select>
    <button class="ql-bold"></button>
    <button class="ql-italic"></button>
    <button class="ql-underline"></button>
    <button class="ql-strike"></button>
    <button class="ql-blockquote"></button>
    <button class="ql-list" value="ordered"></button>
    <button class="ql-list" value="bullet"></button>
    <button class="ql-clean"></button>
  </div>
  <div id="editor-container">${initialContent}</div>
  <script>
    (function() {
      var quill = new Quill("#editor-container", {
        theme: "snow",
        modules: {
          toolbar: "#toolbar",
          clipboard: { matchVisual: false }
        },
        readOnly: ${readOnly},
        placeholder: "开始编写大纲..."
      });

      window.quillEditor = quill;

      // 监听内容变化，通知 React Native
      quill.on("text-change", function() {
        var html = quill.root.innerHTML;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "content", html: html }));
      });

      // 监听焦点事件
      quill.root.addEventListener("focus", function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "focus" }));
      });
    })();
  </script>
</body>
</html>
  `.trim();

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "content" && onChange) {
          onChange(data.html);
        }
      } catch {}
    },
    [onChange]
  );

  return (
    <View style={[{ borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: borderColor }, style]}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={[styles.webview, { backgroundColor: bgColor }]}
        onMessage={handleMessage}
        onLoad={() => { loadedRef.current = true; }}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        showsVerticalScrollIndicator={false}
        originWhitelist={["*"]}
        dataDetectorTypes="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  webview: {
    height: 300,
    width: "100%",
  },
});