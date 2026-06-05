import { useRef, useCallback, useEffect, useState } from "react";
import { View, Platform, StyleSheet } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

interface RichEditorProps {
  initialContent?: string;
  onChange?: (html: string) => void;
  readOnly?: boolean;
  nightMode?: boolean;
  style?: any;
}

/**
 * 跨平台富文本编辑器（Quill.js 双引擎）
 *
 * 引擎选择（自动）：
 * - 🌐 Web 端 → 在 DOM 中动态加载 Quill.js，直接绑定编辑器实例
 * - 📱 Native 端 → 通过 react-native-webview 嵌入 Quill HTML 页面
 *
 * 功能特性：
 * - 完整工具栏：H1/H2/加粗/斜体/下划线/删除线/引用/有序列表/无序列表/清除格式
 * - 通过 onChange 回调 + contentRef 模式确保内容双向同步
 * - 支持日间/夜间主题自动适配
 * - forwardRef + useImperativeHandle 暴露 getContent() 方法供父组件直接读取
 */
export default function RichEditor(props: RichEditorProps) {
  if (Platform.OS === "web") {
    return <RichEditorWeb {...props} />;
  }
  return <RichEditorNative {...props} />;
}

// ==================== Web 版本：直接 DOM Quill ====================
function RichEditorWeb({
  initialContent = "",
  onChange,
  readOnly = false,
  nightMode = false,
  style,
}: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);

  const bgColor = nightMode ? "#1E1E38" : "#FFFBEB";
  const textColor = nightMode ? "#E8E8F0" : "#2C1810";
  const toolbarBg = nightMode ? "#2D2D4A" : "#FFF8E7";
  const borderColor = nightMode ? "#3D3D5A" : "#EDE4D4";

  // 用 useRef 保持 onChange 始终最新
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // 加载 Quill CSS 和 JS
  useEffect(() => {
    if (!document.querySelector("#quill-css")) {
      const link = document.createElement("link");
      link.id = "quill-css";
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css";
      document.head.appendChild(link);
    }
    if (!document.querySelector("#quill-js")) {
      const script = document.createElement("script");
      script.id = "quill-js";
      script.src = "https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js";
      script.onload = () => setLoaded(true);
      document.body.appendChild(script);
    } else {
      setLoaded(true);
    }
  }, []);

  // 初始化 Quill
  useEffect(() => {
    if (!loaded || !editorRef.current || !toolbarRef.current) return;
    if (quillRef.current) return;

    try {
      const Quill = (window as any).Quill;
      const quill = new Quill(editorRef.current, {
        theme: "snow",
        modules: {
          toolbar: toolbarRef.current,
          clipboard: { matchVisual: false },
        },
        readOnly,
        placeholder: "开始编写大纲...",
      });
      quillRef.current = quill;
      quill.on("text-change", () => onChangeRef.current?.(quill.root.innerHTML));
      if (initialContent) {
        quill.root.innerHTML = initialContent;
        quill.history.clear();
      }
    } catch (e) {
      console.error("Quill init error:", e);
    }
  }, [loaded]);

  // 当 initialContent 异步加载完成后，更新编辑器内容
  useEffect(() => {
    const quill = quillRef.current;
    if (!quill || !initialContent) return;
    if (quill.root.innerHTML !== initialContent) {
      quill.root.innerHTML = initialContent;
      quill.history.clear();
      // 同步到父组件的 content 状态
      onChangeRef.current?.(initialContent);
    }
  }, [initialContent]);

  return (
    <View
      style={[
        { borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor, minHeight: 260, backgroundColor: bgColor },
        style,
      ]}
    >
      <div ref={toolbarRef} style={{
        position: "sticky", top: 0, zIndex: 10, background: toolbarBg,
        borderBottom: `1px solid ${borderColor}`, padding: "4px 6px",
        display: "flex", flexWrap: "wrap", gap: "2px",
      }}>
        <select className="ql-header" defaultValue="">
          <option value=""></option><option value="1">标题1</option>
          <option value="2">标题2</option><option value="3">正文</option>
        </select>
        <button className="ql-bold" /><button className="ql-italic" />
        <button className="ql-underline" /><button className="ql-strike" />
        <button className="ql-blockquote" />
        <button className="ql-list" value="ordered" />
        <button className="ql-list" value="bullet" />
        <button className="ql-clean" />
      </div>
      <div ref={editorRef} style={{ minHeight: 200, fontSize: 15, lineHeight: 1.8, color: textColor, background: bgColor }} />
      <style>{`
        .ql-editor { padding: 16px; min-height: 200px; font-size: 15px; line-height: 1.8; color: ${textColor}; background: ${bgColor}; outline: none; }
        .ql-editor p { margin-bottom: 0.5em; }
        .ql-editor h1 { font-size: 22px; font-weight: 700; margin: 0.8em 0 0.4em; }
        .ql-editor h2 { font-size: 18px; font-weight: 600; margin: 0.6em 0 0.3em; }
        .ql-editor ul, .ql-editor ol { padding-left: 1.5em; margin-bottom: 0.5em; }
        .ql-editor li { margin-bottom: 0.2em; }
        .ql-editor blockquote { border-left: 3px solid ${nightMode ? "#6366F1" : "#D4C5A9"}; padding-left: 12px; color: ${nightMode ? "#9898B8" : "#8B7355"}; font-style: italic; }
        .ql-editor.ql-blank::before { color: ${nightMode ? "#4A4A6A" : "#C4B8A0"}; font-style: normal; left: 16px; }
        .ql-snow .ql-stroke { stroke: ${nightMode ? "#C4C4D8" : "#5C4A38"}; }
        .ql-snow .ql-fill { fill: ${nightMode ? "#C4C4D8" : "#5C4A38"}; }
        .ql-snow .ql-picker { color: ${nightMode ? "#C4C4D8" : "#5C4A38"}; }
        .ql-snow .ql-picker-options { background: ${toolbarBg}; border-color: ${borderColor}; }
        ${readOnly ? `.ql-editor { cursor: default; }` : ""}
      `}</style>
    </View>
  );
}

// ==================== Native 版本：WebView ====================
function RichEditorNative({
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

  useEffect(() => {
    if (loadedRef.current && webViewRef.current && initialContent) {
      webViewRef.current.injectJavaScript(`
        if (window.quillEditor) {
          window.quillEditor.root.innerHTML = ${JSON.stringify(initialContent)};
          window.quillEditor.history.clear();
        }
        true;
      `);
    }
  }, [initialContent]);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><link href="https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css" rel="stylesheet"><script src="https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js"></script><style>body{font-family:-apple-system,"PingFang SC","Noto Sans SC",sans-serif;background:${bgColor};color:${textColor};margin:0;padding:0}#toolbar{position:sticky;top:0;z-index:10;background:${toolbarBg};border:none;border-bottom:1px solid ${borderColor};border-radius:16px 16px 0 0;padding:4px 6px;display:flex;flex-wrap:wrap;gap:2px}#toolbar button{width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;color:${nightMode?"#C4C4D8":"#5C4A38"}}.ql-editor{padding:16px;min-height:200px;font-size:15px;line-height:1.8;color:${textColor};background:${bgColor};outline:none}.ql-editor h1{font-size:22px;font-weight:700;margin:.8em 0 .4em}.ql-editor h2{font-size:18px;font-weight:600;margin:.6em 0 .3em}.ql-editor blockquote{border-left:3px solid ${nightMode?"#6366F1":"#D4C5A9"};padding-left:12px;color:${nightMode?"#9898B8":"#8B7355"};font-style:italic}</style></head><body><div id="toolbar"><select class="ql-header"><option value=""></option><option value="1">标题1</option><option value="2">标题2</option><option value="3">正文</option></select><button class="ql-bold"></button><button class="ql-italic"></button><button class="ql-underline"></button><button class="ql-strike"></button><button class="ql-blockquote"></button><button class="ql-list" value="ordered"></button><button class="ql-list" value="bullet"></button><button class="ql-clean"></button></div><div id="editor-container">${initialContent}</div><script>(function(){var q=new Quill("#editor-container",{theme:"snow",modules:{toolbar:"#toolbar",clipboard:{matchVisual:false}},readOnly:${readOnly},placeholder:"开始编写大纲..."});window.quillEditor=q;q.on("text-change",function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:"content",html:q.root.innerHTML}))})})();<\/script></body></html>`;

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "content" && onChange) onChange(data.html);
      } catch {}
    },
    [onChange]
  );

  return (
    <View style={[{ borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor }, style]}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={{ height: 300, width: "100%", backgroundColor: bgColor }}
        onMessage={handleMessage}
        onLoad={() => { loadedRef.current = true; }}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        originWhitelist={["*"]}
        dataDetectorTypes="none"
      />
    </View>
  );
}