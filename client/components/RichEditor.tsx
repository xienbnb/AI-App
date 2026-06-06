import { useRef, useCallback, useEffect, useState } from "react";
import { View, Platform, StyleSheet } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

interface RichEditorProps {
  initialContent?: string;
  onChange?: (html: string) => void;
  readOnly?: boolean;
  nightMode?: boolean;
  style?: any;
  onAIAction?: (action: "polish" | "expand" | "continue", selectedText: string) => void;
}

/**
 * 跨平台富文本编辑器（Quill.js 双引擎）
 *
 * 引擎选择（自动）：
 * - 🌐 Web 端 → 在 DOM 中动态加载 Quill.js（Bubble 主题），直接绑定编辑器实例
 * - 📱 Native 端 → 通过 react-native-webview 嵌入 Quill HTML 页面（Snow 主题）
 *
 * 功能特性：
 * - Web 端使用 Quill Bubble 主题：选中文本后浮现格式工具栏
 * - Web 端内置 AI 助手按钮（润色/扩写/续写），通过 onAIAction 回调与父组件通信
 * - 粘贴时自动去格式化为纯文本
 * - 禁止系统右键菜单
 * - 移动端优化的触控区域
 * - 完整工具栏：H1/H2/加粗/斜体/下划线/删除线/引用/有序列表/无序列表/清除格式
 * - 通过 onChange 回调 + contentRef 模式确保内容双向同步
 * - 支持日间/夜间主题自动适配
 */
export default function RichEditor(props: RichEditorProps) {
  if (Platform.OS === "web") {
    return <RichEditorWeb {...props} />;
  }
  return <RichEditorNative {...props} />;
}

// ==================== Web 版本：Bubble 主题 ====================
function RichEditorWeb({
  initialContent = "",
  onChange,
  readOnly = false,
  nightMode = false,
  style,
  onAIAction,
}: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);

  const bgColor = nightMode ? "#1E1E38" : "#FFFBEB";
  const textColor = nightMode ? "#E8E8F0" : "#2C1810";
  const borderColor = nightMode ? "#3D3D5A" : "#EDE4D4";

  // 用 useRef 保持回调始终最新
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onAIActionRef = useRef(onAIAction);
  onAIActionRef.current = onAIAction;

  // 加载 Quill CSS（Bubble 主题）和 JS
  useEffect(() => {
    if (!document.querySelector("#quill-css")) {
      const link = document.createElement("link");
      link.id = "quill-css";
      link.rel = "stylesheet";
      link.href =
        "https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.bubble.css";
      document.head.appendChild(link);
    }
    if (!document.querySelector("#quill-js")) {
      const script = document.createElement("script");
      script.id = "quill-js";
      script.src =
        "https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js";
      script.onload = () => setLoaded(true);
      document.body.appendChild(script);
    } else {
      setLoaded(true);
    }
  }, []);

  // 初始化 Quill（Bubble 主题）
  useEffect(() => {
    if (!loaded || !editorRef.current) return;
    if (quillRef.current) return;

    try {
      const Quill = (window as any).Quill;
      const Delta = Quill.import("delta");

      const quill = new Quill(editorRef.current, {
        theme: "bubble",
        modules: {
          toolbar: [
            ["bold", "italic", "underline", "strike"],
            [{ header: [1, 2, false] }],
            ["blockquote"],
            [{ list: "ordered" }, { list: "bullet" }],
            ["clean"],
          ],
          clipboard: {
            matchVisual: false,
          },
        },
        readOnly,
        placeholder: "开始编写大纲...",
      });

      // 粘贴时去格式化（只保留纯文本）
      quill.clipboard.addMatcher(Node.ELEMENT_NODE, (node: any, delta: any) => {
        return delta.reduce((newDelta: any, op: any) => {
          if (typeof op.insert === "string") {
            newDelta.insert(op.insert);
          }
          return newDelta;
        }, new Delta());
      });

      quillRef.current = quill;

      // 内容变更同步
      quill.on("text-change", () =>
        onChangeRef.current?.(quill.root.innerHTML)
      );

      if (initialContent) {
        quill.root.innerHTML = initialContent;
        quill.history.clear();
      }

      // ========== 自定义 AI 按钮注入 Bubble 工具栏 ==========
      const tooltip = quill.theme.tooltip;
      if (tooltip && tooltip.root) {
        const tooltipRoot = tooltip.root as HTMLElement;
        const toolbarEl = tooltipRoot.querySelector(
          ".ql-toolbar"
        ) as HTMLElement | null;
        const container = toolbarEl || tooltipRoot;

        // AI 按钮
        const aiBtn = document.createElement("button");
        aiBtn.className = "ql-ai-btn";
        aiBtn.textContent = "AI";
        aiBtn.title = "AI 助手";
        aiBtn.type = "button";
        aiBtn.setAttribute("aria-label", "AI 助手");

        // AI 选项弹出面板
        const aiOptions = document.createElement("div");
        aiOptions.className = "ql-ai-options";
        aiOptions.style.display = "none";
        aiOptions.innerHTML = `
          <button data-action="polish" type="button">润色</button>
          <button data-action="expand" type="button">扩写</button>
          <button data-action="continue" type="button">续写</button>
        `;

        container.appendChild(aiBtn);
        container.appendChild(aiOptions);

        // 切换选项面板显示
        aiBtn.addEventListener("click", (e: MouseEvent) => {
          e.stopPropagation();
          const isVisible = aiOptions.style.display !== "none";
          aiOptions.style.display = isVisible ? "none" : "flex";
        });

        // 选项点击处理
        aiOptions.addEventListener("click", (e: MouseEvent) => {
          const target = (e.target as HTMLElement).closest("button");
          if (!target || !target.dataset.action) return;
          e.stopPropagation();

          const action = target.dataset.action as
            | "polish"
            | "expand"
            | "continue";
          const range = quill.getSelection();
          const selectedText = range
            ? quill.getText(range.index, range.length)
            : "";

          // 通过全局回调传递给 React
          if (
            typeof (window as any).__onRichEditorAIAction === "function"
          ) {
            (window as any).__onRichEditorAIAction(action, selectedText);
          }

          aiOptions.style.display = "none";
          tooltip.hide();
        });

        // 点击其他区域关闭选项
        document.addEventListener("click", () => {
          aiOptions.style.display = "none";
        });
      }
    } catch (e) {
      console.error("Quill init error:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // 将 onAIAction 回调暴露到 window，供 DOM 内的 AI 按钮调用
  useEffect(() => {
    (window as any).__onRichEditorAIAction = (
      action: "polish" | "expand" | "continue",
      selectedText: string
    ) => {
      onAIActionRef.current?.(action, selectedText);
    };
    return () => {
      delete (window as any).__onRichEditorAIAction;
    };
  }, []);

  // 当 initialContent 异步加载完成后，更新编辑器内容
  useEffect(() => {
    const quill = quillRef.current;
    if (!quill || !initialContent) return;
    if (quill.root.innerHTML !== initialContent) {
      quill.root.innerHTML = initialContent;
      quill.history.clear();
      onChangeRef.current?.(initialContent);
    }
  }, [initialContent]);

  return (
    <View
      style={[
        {
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 1,
          borderColor,
          minHeight: 260,
          backgroundColor: bgColor,
          userSelect: "none" as any,
          WebkitUserSelect: "none" as any,
        },
        style,
      ]}
    >
      <div
        ref={editorRef}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          minHeight: 200,
          fontSize: 15,
          lineHeight: 1.8,
          color: textColor,
          background: bgColor,
        }}
      />
      <style>{`
        /* ====== 编辑器内容区域 ====== */
        .ql-editor {
          padding: 16px;
          min-height: 200px;
          font-size: 15px;
          line-height: 1.8;
          color: ${textColor};
          background: ${bgColor};
          outline: none;
        }
        .ql-editor p {
          margin-bottom: 0.5em;
        }
        .ql-editor h1 {
          font-size: 22px;
          font-weight: 700;
          margin: 0.8em 0 0.4em;
        }
        .ql-editor h2 {
          font-size: 18px;
          font-weight: 600;
          margin: 0.6em 0 0.3em;
        }
        .ql-editor ul,
        .ql-editor ol {
          padding-left: 1.5em;
          margin-bottom: 0.5em;
        }
        .ql-editor li {
          margin-bottom: 0.2em;
        }
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
        ${readOnly ? `.ql-editor { cursor: default; }` : ""}

        /* ====== Bubble 主题适配夜间模式 ====== */
        .ql-bubble .ql-stroke {
          stroke: ${nightMode ? "#C4C4D8" : "#5C4A38"};
        }
        .ql-bubble .ql-fill {
          fill: ${nightMode ? "#C4C4D8" : "#5C4A38"};
        }
        .ql-bubble .ql-picker {
          color: ${nightMode ? "#C4C4D8" : "#5C4A38"};
        }
        .ql-bubble .ql-picker-options {
          background: ${nightMode ? "#2D2D4A" : "#FFF8E7"};
          border-color: ${borderColor};
        }
        .ql-bubble .ql-tooltip {
          background: ${nightMode ? "#2D2D4A" : "#FFF8E7"};
          border-color: ${borderColor};
          box-shadow: 0 2px 12px ${nightMode ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.15)"};
        }
        .ql-bubble .ql-tooltip .ql-toolbar {
          background: ${nightMode ? "#2D2D4A" : "#FFF8E7"};
          border: none;
          padding: 4px;
        }
        .ql-bubble .ql-tooltip-arrow {
          border-bottom-color: ${nightMode ? "#2D2D4A" : "#FFF8E7"};
        }

        /* ====== 自定义 AI 按钮 ====== */
        .ql-ai-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 28px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: ${nightMode ? "#C4C4D8" : "#5C4A38"};
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s;
          letter-spacing: 0.5px;
          position: relative;
        }
        .ql-ai-btn:hover {
          background: ${nightMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)"};
        }
        .ql-ai-btn:active {
          background: ${nightMode ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.1)"};
        }

        /* ====== AI 选项弹出面板 ====== */
        .ql-ai-options {
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-top: 4px;
          display: none;
          flex-direction: column;
          gap: 2px;
          padding: 4px;
          background: ${nightMode ? "#2D2D4A" : "#FFFFFF"};
          border: 1px solid ${borderColor};
          border-radius: 8px;
          box-shadow: 0 4px 16px ${nightMode ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.12)"};
          z-index: 1000;
          min-width: 72px;
        }
        .ql-ai-options button {
          display: block;
          width: 100%;
          padding: 8px 14px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: ${textColor};
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          text-align: center;
          white-space: nowrap;
          transition: background 0.15s;
        }
        .ql-ai-options button:hover {
          background: ${nightMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)"};
        }
        .ql-ai-options button:active {
          background: ${nightMode ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.1)"};
        }

        /* ====== 移动端优化：更大触控区域 ====== */
        .ql-bubble .ql-toolbar button {
          width: 34px;
          height: 34px;
          min-width: 34px;
          min-height: 34px;
          border-radius: 8px;
        }
        .ql-bubble .ql-toolbar .ql-picker {
          height: 34px;
        }
        .ql-ai-btn {
          width: 38px;
          height: 34px;
          font-size: 13px;
          margin: 0 2px;
        }
        .ql-ai-options button {
          padding: 10px 16px;
          font-size: 14px;
        }
        .ql-bubble .ql-tooltip {
          padding: 6px;
        }
      `}</style>
    </View>
  );
}

// ==================== Native 版本：WebView + Snow 主题 ====================
function RichEditorNative({
  initialContent = "",
  onChange,
  readOnly = false,
  nightMode = false,
  style,
  onAIAction,
}: RichEditorProps) {
  const webViewRef = useRef<WebView>(null);
  const loadedRef = useRef(false);

  const bgColor = nightMode ? "#1E1E38" : "#FFFBEB";
  const textColor = nightMode ? "#E8E8F0" : "#2C1810";
  const toolbarBg = nightMode ? "#2D2D4A" : "#FFF8E7";
  const borderColor = nightMode ? "#3D3D5A" : "#EDE4D4";

  // 用 useRef 保持回调始终最新
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onAIActionRef = useRef(onAIAction);
  onAIActionRef.current = onAIAction;

  // 更新编辑器内容
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

  // 构造 Quill HTML
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link href="https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js"></script>
  <style>
    * { -webkit-tap-highlight-color: transparent; }
    body {
      font-family: -apple-system, "PingFang SC", "Noto Sans SC", sans-serif;
      background: ${bgColor};
      color: ${textColor};
      margin: 0;
      padding: 0;
      user-select: none;
      -webkit-user-select: none;
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
      align-items: center;
    }
    #toolbar button,
    #toolbar .ql-picker {
      min-width: 34px;
      min-height: 34px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      color: ${nightMode ? "#C4C4D8" : "#5C4A38"};
    }
    #toolbar button:hover {
      background: ${nightMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)"};
    }
    .ql-editor {
      padding: 16px;
      min-height: 200px;
      font-size: 15px;
      line-height: 1.8;
      color: ${textColor};
      background: ${bgColor};
      outline: none;
      user-select: text;
      -webkit-user-select: text;
    }
    .ql-editor h1 { font-size: 22px; font-weight: 700; margin: .8em 0 .4em; }
    .ql-editor h2 { font-size: 18px; font-weight: 600; margin: .6em 0 .3em; }
    .ql-editor blockquote {
      border-left: 3px solid ${nightMode ? "#6366F1" : "#D4C5A9"};
      padding-left: 12px;
      color: ${nightMode ? "#9898B8" : "#8B7355"};
      font-style: italic;
    }
    .ql-editor.ql-blank::before {
      color: ${nightMode ? "#4A4A6A" : "#C4B8A0"};
      font-style: normal;
    }
    .ql-snow .ql-stroke { stroke: ${nightMode ? "#C4C4D8" : "#5C4A38"}; }
    .ql-snow .ql-fill { fill: ${nightMode ? "#C4C4D8" : "#5C4A38"}; }
    .ql-snow .ql-picker { color: ${nightMode ? "#C4C4D8" : "#5C4A38"}; }
    .ql-snow .ql-picker-options { background: ${toolbarBg}; border-color: ${borderColor}; }

    /* AI 按钮 */
    .ql-ai-native {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 34px;
      height: 30px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: ${nightMode ? "#C4C4D8" : "#5C4A38"};
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: 0.5px;
      padding: 0 8px;
    }
    .ql-ai-native:active {
      background: ${nightMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)"};
    }
    .ql-ai-options-native {
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-top: 4px;
      display: none;
      flex-direction: column;
      gap: 2px;
      padding: 4px;
      background: ${nightMode ? "#2D2D4A" : "#FFFFFF"};
      border: 1px solid ${borderColor};
      border-radius: 8px;
      box-shadow: 0 4px 16px ${nightMode ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.12)"};
      z-index: 1000;
      min-width: 72px;
    }
    .ql-ai-options-native button {
      display: block;
      width: 100%;
      padding: 10px 16px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: ${textColor};
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      text-align: center;
      white-space: nowrap;
    }
    .ql-ai-options-native button:active {
      background: ${nightMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)"};
    }
  </style>
</head>
<body>
  <div id="toolbar">
    <select class="ql-header">
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
    <button class="ql-ai-native" id="aiBtnNative">AI</button>
    <div class="ql-ai-options-native" id="aiOptionsNative">
      <button data-action="polish">润色</button>
      <button data-action="expand">扩写</button>
      <button data-action="continue">续写</button>
    </div>
  </div>
  <div id="editor-container" oncontextmenu="return false;">${initialContent}</div>
  <script>
    (function() {
      var q = new Quill("#editor-container", {
        theme: "snow",
        modules: {
          toolbar: "#toolbar",
          clipboard: { matchVisual: false }
        },
        readOnly: ${readOnly},
        placeholder: "开始编写大纲..."
      });
      window.quillEditor = q;

      // ====== 粘贴去格式化 ======
      var Delta = Quill.import("delta");
      q.clipboard.addMatcher(Node.ELEMENT_NODE, function(node, delta) {
        return delta.reduce(function(newDelta, op) {
          if (typeof op.insert === "string") {
            newDelta.insert(op.insert);
          }
          return newDelta;
        }, new Delta());
      });

      // ====== 内容变更通知 React Native ======
      q.on("text-change", function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: "content",
          html: q.root.innerHTML
        }));
      });

      // ====== AI 按钮交互 ======
      var aiBtn = document.getElementById("aiBtnNative");
      var aiOptions = document.getElementById("aiOptionsNative");

      if (aiBtn && aiOptions) {
        aiBtn.addEventListener("click", function(e) {
          e.stopPropagation();
          var isVisible = aiOptions.style.display !== "none";
          aiOptions.style.display = isVisible ? "none" : "flex";
        });

        aiOptions.addEventListener("click", function(e) {
          var target = e.target.closest("button");
          if (!target || !target.dataset.action) return;
          e.stopPropagation();

          var action = target.dataset.action;
          var range = q.getSelection();
          var selectedText = range ? q.getText(range.index, range.length) : "";

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: "aiAction",
            action: action,
            selectedText: selectedText
          }));

          aiOptions.style.display = "none";
        });

        document.addEventListener("click", function() {
          aiOptions.style.display = "none";
        });
      }

      // ====== 选中文本检测（用于后续扩展） ======
      q.on("selection-change", function(range) {
        var hasSelection = range && range.length > 0;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: "selectionChange",
          hasSelection: hasSelection,
          length: range ? range.length : 0
        }));
      });
    })();
  <\/script>
</body>
</html>`;

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "content" && onChangeRef.current) {
          onChangeRef.current(data.html);
        }
        if (data.type === "aiAction" && onAIActionRef.current) {
          onAIActionRef.current(data.action, data.selectedText);
        }
        if (data.type === "selectionChange") {
          // 选中文本检测事件，后续可据此显示浮动操作按钮
          // data.hasSelection / data.length
        }
      } catch {
        // 忽略解析失败的消息
      }
    },
    []
  );

  return (
    <View
      style={[
        {
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 1,
          borderColor,
        },
        style,
      ]}
    >
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={{
          height: 300,
          width: "100%",
          backgroundColor: bgColor,
        }}
        onMessage={handleMessage}
        onLoad={() => {
          loadedRef.current = true;
        }}
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