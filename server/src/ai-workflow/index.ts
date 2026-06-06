/**
 * AI 写作工作流引擎
 * 
 * 设计理念：让 AI 输出有质量、有结构、可控，而不是"无脑输出"
 * 
 * 核心思想：
 * 1. 分阶段生成：规划 → 起草 → 润色 → 质检
 * 2. 每个阶段有明确的输入输出规范
 * 3. 质量检查点确保输出符合要求
 * 4. 支持多轮迭代优化
 * 5. 使用 ai-client.ts 作为底层调用封装
 * 
 * 工作流类型：
 * - chapter-generation: 章节生成工作流
 * - outline-generation: 大纲生成工作流
 * - character-generation: 角色生成工作流
 * - polish: 文本润色工作流
 */

import { invokeLLM } from "../utils/ai-client.js";

// ==================== 类型定义 ====================

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  inputTemplate: string;
  outputSchema?: Record<string, any>; // JSON Schema 用于结构化输出
  validator?: (output: string) => ValidationResult;
  maxRetries?: number;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  suggestions: string[];
}

export interface WorkflowContext {
  [key: string]: any;
}

export interface WorkflowResult {
  success: boolean;
  output: string;
  steps: {
    stepId: string;
    output: string;
    duration: number;
    retries: number;
  }[];
  totalTokens?: number;
  error?: string;
}

// ==================== 预设工作流 ====================

/**
 * 高质量章节生成工作流
 * 
 * 阶段：
 * 1. 场景规划 - 规划本章的核心场景、节奏、转折点
 * 2. 细节扩写 - 根据规划扩写详细内容
 * 3. 风格润色 - 调整文笔风格，增强感染力
 * 4. 逻辑质检 - 检查情节连贯性、人物一致性
 */
export const chapterGenerationWorkflow: WorkflowStep[] = [
  {
    id: "planning",
    name: "场景规划",
    description: "规划本章的核心场景和节奏",
    systemPrompt: `你是一位资深网文编辑。根据上下文信息，规划下一章的内容结构。

请严格按照以下 JSON 格式输出：
{
  "chapterTitle": "本章标题",
  "coreConflict": "本章核心冲突（1句话）",
  "keyScenes": [
    {
      "sceneName": "场景名称",
      "purpose": "这个场景的作用",
      "emotionTone": "情绪基调（如：紧张/温馨/悬疑）",
      "keyDialogue": "关键对话或动作（可选）"
    }
  ],
  "plotAdvancement": "本章推动主线剧情的进展程度（1-10）",
  "characterDevelopment": "本章人物成长/变化",
  "cliffhanger": "章末悬念（如果有）",
  "estimatedWordCount": 预估字数
}

要求：
- 场景数量 3-5 个
- 每个场景都要有明确的叙事目的
- 节奏要有起伏，不能平铺直叙
- 结尾要有吸引力，让读者想继续看`,
    inputTemplate: `书籍信息：
书名：{{bookTitle}}
类型：{{genre}}

上下文：
前面章节内容摘要：{{previousContent}}

本章写作要求：
{{requirements}}

请规划本章的内容结构。`,
    maxRetries: 2,
  },
  {
    id: "drafting",
    name: "细节扩写",
    description: "根据规划扩写详细内容",
    systemPrompt: `你是一位才华横溢的网文作家。根据场景规划，创作高质量的小说章节内容。

写作要求：
1. 严格按照场景规划的顺序和内容来写
2. 每个场景之间要有自然的过渡
3. 注重细节描写：环境、动作、心理、对话
4. 语言要生动有画面感，避免平铺直叙
5. 人物对话要符合性格，口语化但不低俗
6. 节奏要有张有弛，紧张和舒缓交替
7. 字数控制在规划的预估字数 ±20% 范围内

输出格式：直接输出章节正文，不要任何解释性文字。`,
    inputTemplate: `场景规划：
{{planning_output}}

请根据以上规划，创作完整的章节内容。`,
    maxRetries: 1,
  },
  {
    id: "polishing",
    name: "风格润色",
    description: "调整文笔风格，增强感染力",
    systemPrompt: `你是一位文学编辑，擅长提升文字的感染力。请对以下小说章节进行润色优化。

润色重点：
1. 增强画面感：用更具体的描写替代抽象叙述
2. 优化节奏感：调整句子长短，让节奏更贴合情节
3. 丰富表达：替换重复或平淡的词汇
4. 强化情绪：让情感表达更细腻动人
5. 保持原意：不改变原有的情节和人物设定
6. 风格统一：保持整体文风的一致性

输出格式：直接输出润色后的完整正文。`,
    inputTemplate: `原文：
{{drafting_output}}

风格要求：{{style || "保持原有风格，提升文字质量"}}

请进行润色优化。`,
    maxRetries: 1,
  },
  {
    id: "quality-check",
    name: "逻辑质检",
    description: "检查情节连贯性和人物一致性",
    systemPrompt: `你是一位严谨的小说质检编辑。请检查以下章节的质量。

检查维度：
1. 情节连贯性：情节发展是否自然，有没有突兀的跳转
2. 人物一致性：人物言行是否符合设定的性格
3. 逻辑合理性：有没有不符合逻辑的情节
4. 细节一致性：前后有没有矛盾的细节
5. 可读性：文字是否通顺，有没有语病
6. 吸引力：开头是否抓人，结尾是否有悬念

请严格按照以下 JSON 格式输出检查结果：
{
  "overallScore": 1-10分,
  "pass": true/false,
  "issues": [
    {
      "type": "plot/character/logic/language",
      "description": "问题描述",
      "severity": "low/medium/high",
      "suggestion": "修改建议"
    }
  ],
  "summary": "总体评价"
}`,
    inputTemplate: `书籍背景：{{bookTitle}} - {{genre}}

上下文摘要：{{previousContent}}

待检查章节：
{{polishing_output}}

请进行质量检查。`,
    maxRetries: 1,
  },
];

/**
 * 智能润色工作流
 * 
 * 阶段：
 * 1. 文本分析 - 分析原文的风格、问题、亮点
 * 2. 针对性润色 - 根据分析结果进行润色
 * 3. 对比验证 - 确保润色后质量提升
 */
export const polishWorkflow: WorkflowStep[] = [
  {
    id: "analysis",
    name: "文本分析",
    description: "分析原文的优缺点",
    systemPrompt: `你是一位专业的写作教练。请分析以下文本的写作特点和可改进之处。

请严格按照 JSON 格式输出：
{
  "strengths": ["优点1", "优点2", "优点3"],
  "weaknesses": ["不足1", "不足2", "不足3"],
  "styleAssessment": "文风评价（如：平实/华丽/紧张/舒缓）",
  "improvementPriorities": ["优先级最高的改进方向", "次优先", "第三优先"],
  "overallRating": 1-10
}`,
    inputTemplate: `待分析文本：
{{text}}

请进行全面的写作质量分析。`,
    maxRetries: 1,
  },
  {
    id: "rewrite",
    name: "针对性润色",
    description: "根据分析结果进行润色",
    systemPrompt: `你是一位资深编辑。请根据文本分析结果，对原文进行针对性的润色优化。

润色原则：
1. 保留原文的核心意思和情节
2. 重点改进分析中指出的问题
3. 保持原文的风格基调
4. 润色后整体质量要有明显提升
5. 不要改变人物设定和剧情走向

输出格式：直接输出润色后的完整文本。`,
    inputTemplate: `原文：
{{text}}

文本分析结果：
{{analysis_output}}

润色要求：{{requirements || "全面提升文字质量"}}

请进行针对性润色。`,
    maxRetries: 2,
  },
];

// ==================== 工作流执行引擎 ====================

/**
 * 执行工作流
 */
export async function executeWorkflow(
  steps: WorkflowStep[],
  context: WorkflowContext,
  options: {
    model?: string;
    temperature?: number;
    onStepComplete?: (stepId: string, output: string) => void;
    stream?: boolean;
  } = {}
): Promise<WorkflowResult> {
  const results: WorkflowResult["steps"] = [];
  let currentContext = { ...context };

  for (const step of steps) {
    const stepStartTime = Date.now();
    let retries = 0;
    let stepOutput = "";
    let stepSuccess = false;

    const maxRetries = step.maxRetries ?? 1;

    while (retries < maxRetries && !stepSuccess) {
      try {
        // 构建输入
        const input = renderTemplate(step.inputTemplate, currentContext);
        
        // 调用 LLM
        const systemPrompt = step.systemPrompt;
        
        // 构建消息
        const msgs: { role: string; content: string }[] = [
          { role: "user", content: input },
        ];

        if (retries > 0) {
          msgs.push({ role: "assistant", content: stepOutput });
          msgs.push({ 
            role: "user", 
            content: `上一次输出存在以下问题，请重新生成：\n${currentContext.lastValidationIssues?.join("\n") || "质量不达标，请重新生成"}` 
          });
        }

        const response = await invokeLLM(msgs, systemPrompt, {
          model: options.model,
          temperature: options.temperature ?? 0.7,
        });
        stepOutput = response;

        // 验证输出
        if (step.validator) {
          const validation = step.validator(stepOutput);
          if (!validation.valid) {
            retries++;
            currentContext.lastValidationIssues = validation.issues;
            continue;
          }
        }

        stepSuccess = true;
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          return {
            success: false,
            output: "",
            steps: results,
            error: `步骤 ${step.name} 执行失败: ${error}`,
          };
        }
      }
    }

    if (!stepSuccess) {
      return {
        success: false,
        output: "",
        steps: results,
        error: `步骤 ${step.name} 超过最大重试次数`,
      };
    }

    // 保存步骤结果
    results.push({
      stepId: step.id,
      output: stepOutput,
      duration: Date.now() - stepStartTime,
      retries,
    });

    // 更新上下文，供后续步骤使用
    currentContext[`${step.id}_output`] = stepOutput;

    // 回调通知
    if (options.onStepComplete) {
      options.onStepComplete(step.id, stepOutput);
    }
  }

  // 返回最终结果（最后一个步骤的输出）
  const lastStep = results[results.length - 1];
  return {
    success: true,
    output: lastStep?.output || "",
    steps: results,
  };
}

// ==================== 工具函数 ====================

/**
 * 简单的模板渲染
 */
function renderTemplate(template: string, context: WorkflowContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return context[key] !== undefined ? String(context[key]) : "";
  });
}

/**
 * JSON 输出验证器
 */
export function createJsonValidator(schema?: Record<string, any>): (output: string) => ValidationResult {
  return (output: string) => {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // 尝试提取 JSON
    let jsonStr = output.trim();
    
    // 去除可能的 markdown 代码块标记
    jsonStr = jsonStr.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    jsonStr = jsonStr.replace(/^```\s*/, "").replace(/\s*```$/, "");

    try {
      const parsed = JSON.parse(jsonStr);
      
      // 如果有 schema，做基本的结构检查
      if (schema) {
        for (const key of Object.keys(schema)) {
          if (!(key in parsed)) {
            issues.push(`缺少必要字段: ${key}`);
          }
        }
      }

      return {
        valid: issues.length === 0,
        issues,
        suggestions: suggestions,
      };
    } catch {
      return {
        valid: false,
        issues: ["输出不是有效的 JSON 格式"],
        suggestions: ["请确保输出严格符合 JSON 格式", "不要在 JSON 外添加解释性文字"],
      };
    }
  };
}
