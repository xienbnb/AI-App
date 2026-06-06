import { streamLLM, invokeLLM } from "../utils/ai-client.js";

// ========== 结构化输出工具 ==========

/**
 * 要求 AI 输出 JSON 格式
 * @param userId 用户ID（可选，使用用户自己的API Key）
 */
export async function generateJSON(
  prompt: string,
  schema: Record<string, string>,
  options: { model?: string; temperature?: number } = {},
  userId?: string
): Promise<any> {
  const schemaDesc = Object.entries(schema)
    .map(([key, desc]) => `  - ${key}: ${desc}`)
    .join('\n');

  const systemPrompt = `你是一个专业的写作助手。请根据用户的要求，严格按照以下JSON格式输出：

{
${schemaDesc}
}

要求：
1. 只输出JSON，不要有任何额外的解释、说明或markdown格式
2. 确保JSON语法正确，可以直接被 JSON.parse() 解析
3. 内容要丰富、详细，符合小说创作的专业水准
4. 如果是数组类型，请至少提供3-5个条目`;

  const response = await invokeLLM(
    [{ role: "user", content: prompt }],
    systemPrompt,
    { ...options, temperature: options.temperature ?? 0.7 },
    userId
  );

  // 尝试提取JSON
  try {
    // 先尝试直接解析
    return JSON.parse(response);
  } catch {
    // 尝试提取 ```json 块
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        // 继续尝试
      }
    }
    // 尝试提取第一个 { 到最后一个 }
    const firstBrace = response.indexOf('{');
    const lastBrace = response.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      try {
        return JSON.parse(response.slice(firstBrace, lastBrace + 1));
      } catch {
        // 失败了就返回原始文本
      }
    }
    // 最后兜底
    return { rawText: response };
  }
}

/**
 * 流式输出 JSON（按字段增量输出）
 * @param userId 用户ID（可选，使用用户自己的API Key）
 */
export async function* streamJSON(
  prompt: string,
  systemPrompt: string,
  options: { model?: string; temperature?: number } = {},
  userId?: string
): AsyncGenerator<{ content: string; done: boolean; parsed?: any }> {
  let fullContent = '';
  
  for await (const chunk of streamLLM(
    [{ role: "user", content: prompt }],
    systemPrompt,
    options,
    userId
  )) {
    fullContent += chunk.content;
    yield { content: chunk.content, done: false };
  }

  // 完成后尝试解析
  let parsed: any = undefined;
  try {
    parsed = JSON.parse(fullContent);
  } catch {
    const jsonMatch = fullContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1]);
      } catch {}
    }
  }

  yield { content: '', done: true, parsed };
}

// ========== 小说生成工作流 ==========

/**
 * 生成小说大纲（结构化）
 * @param userId 用户ID（可选，使用用户自己的API Key）
 */
export async function generateNovelOutline(params: {
  title: string;
  genre: string;
  description: string;
  volumeCount?: number;
  chaptersPerVolume?: number;
  userId?: string;
}): Promise<{
  title: string;
  genre: string;
  description: string;
  coreConflict: string;
  theme: string;
  volumes: Array<{
    volumeTitle: string;
    volumeDescription: string;
    chapters: Array<{
      chapterTitle: string;
      chapterSummary: string;
      keyEvents: string[];
    }>;
  }>;
}> {
  const prompt = `请为以下小说生成详细的大纲：

书名：${params.title}
类型：${params.genre}
简介：${params.description}
分卷数：${params.volumeCount || 3}
每卷章节数：${params.chaptersPerVolume || 10}

请设计一个完整的故事架构，包括核心冲突、主题、各分卷的主要情节脉络，以及每一章的核心事件。`;

  return generateJSON(prompt, {
    title: "string，小说最终书名",
    genre: "string，小说类型",
    description: "string，小说一句话简介",
    coreConflict: "string，核心冲突描述",
    theme: "string，主题思想",
    volumes: "array，分卷列表，每卷包含：volumeTitle(卷名), volumeDescription(卷简介), chapters(章节数组)",
    "volumes[].chapters": "每章包含：chapterTitle(章节标题), chapterSummary(章节概要), keyEvents(关键事件数组，3-5个)",
  }, {}, params.userId);
}

/**
 * 生成角色设定
 * @param userId 用户ID（可选，使用用户自己的API Key）
 */
export async function generateCharacters(params: {
  bookTitle: string;
  genre: string;
  description: string;
  count?: number;
  roleType?: 'protagonist' | 'antagonist' | 'supporting' | 'all';
  userId?: string;
}): Promise<{
  characters: Array<{
    name: string;
    role: string;
    description: string;
    personality: string;
    background: string;
    motivation: string;
    characterArc: string;
    appearance?: string;
    age?: number;
  }>;
}> {
  const roleDesc = {
    protagonist: '主角',
    antagonist: '反派',
    supporting: '配角',
    all: '主角、反派和重要配角',
  }[params.roleType || 'all'];

  const prompt = `请为以下小说设计${params.count || 5}个${roleDesc}：

书名：${params.bookTitle}
类型：${params.genre}
简介：${params.description}

请设计立体、有深度的角色，每个角色都要有清晰的动机、性格和成长弧线。`;

  return generateJSON(prompt, {
    characters: "array，角色列表",
    "characters[].name": "string，角色姓名",
    "characters[].role": "string，角色定位（主角/反派/配角）",
    "characters[].description": "string，角色一句话介绍",
    "characters[].personality": "string，性格特点描述",
    "characters[].background": "string，背景故事",
    "characters[].motivation": "string，核心动机",
    "characters[].characterArc": "string，角色成长弧线",
    "characters[].appearance": "string，外貌描写",
    "characters[].age": "number，年龄",
  }, {}, params.userId);
}

/**
 * 生成章节内容（分步骤优化）
 */
export async function generateChapter(params: {
  bookTitle: string;
  chapterTitle: string;
  chapterSummary: string;
  previousContent?: string;
  genre: string;
  wordCount?: number;
  style?: 'normal' | 'fast' | 'detailed' | 'literary';
  userId?: string;
}): Promise<{
  content: string;
  wordCount: number;
}> {
  const stylePrompts = {
    normal: '节奏适中，情节推进自然',
    fast: '节奏紧凑，事件密集，适合爽文',
    detailed: '描写细腻，注重环境和心理刻画',
    literary: '文笔优美，有文学性，注重意境',
  };

  const prompt = `请根据以下信息写一章小说：

书名：${params.bookTitle}
章节：${params.chapterTitle}
本章概要：${params.chapterSummary}
类型：${params.genre}
${params.previousContent ? `前文内容摘要：${params.previousContent.slice(0, 500)}\n` : ''}
风格要求：${stylePrompts[params.style || 'normal']}
字数要求：约${params.wordCount || 2000}字

要求：
1. 开篇要有吸引力，快速抓住读者
2. 情节要有起伏，至少有一个转折点
3. 人物对话要符合角色性格
4. 场景描写要生动，有画面感
5. 结尾留悬念，吸引读者继续阅读
6. 使用第三人称叙事`;

  // 第一步：生成初稿
  const firstDraft = await invokeLLM(
    [{ role: "user", content: prompt }],
    "你是一个专业的网络小说作家。请根据要求创作高质量的小说章节内容。",
    { temperature: 0.8 },
    params.userId
  );

  // 第二步：自我优化
  const optimizePrompt = `请对以下小说章节进行润色优化，提升整体质量：

【原文】
${firstDraft}

【优化方向】
1. 增强画面感和代入感
2. 优化人物对话，让语言更符合角色
3. 调整节奏，让情节更有张力
4. 修正不通顺的地方
5. 保持原有情节和人物不变

请直接输出优化后的完整章节内容，不要加任何说明。`;

  const optimized = await invokeLLM(
    [{ role: "user", content: optimizePrompt }],
    "你是一个资深的小说编辑。请对作品进行专业的润色优化，提升文学性和可读性。",
    { temperature: 0.6 },
    params.userId
  );

  // 计算字数
  const wordCount = optimized.replace(/\s/g, '').length;

  return {
    content: optimized,
    wordCount,
  };
}

/**
 * 流式生成章节内容
 */
export async function* streamChapter(params: {
  bookTitle: string;
  chapterTitle: string;
  chapterSummary: string;
  previousContent?: string;
  genre: string;
  wordCount?: number;
  style?: 'normal' | 'fast' | 'detailed' | 'literary';
  userId?: string;
}): AsyncGenerator<{ content: string; step: number; totalSteps: number }> {
  const totalSteps = 1; // 目前单步流式，未来可扩展为多步

  const stylePrompts = {
    normal: '节奏适中，情节推进自然',
    fast: '节奏紧凑，事件密集，适合爽文',
    detailed: '描写细腻，注重环境和心理刻画',
    literary: '文笔优美，有文学性，注重意境',
  };

  const systemPrompt = `你是一个专业的网络小说作家。请根据要求创作高质量的小说章节内容。

要求：
1. 开篇要有吸引力，快速抓住读者
2. 情节要有起伏，至少有一个转折点
3. 人物对话要符合角色性格
4. 场景描写要生动，有画面感
5. 结尾留悬念，吸引读者继续阅读
6. 使用第三人称叙事`;

  const prompt = `请根据以下信息写一章小说：

书名：${params.bookTitle}
章节：${params.chapterTitle}
本章概要：${params.chapterSummary}
类型：${params.genre}
${params.previousContent ? `前文内容摘要：${params.previousContent.slice(0, 500)}\n` : ''}
风格要求：${stylePrompts[params.style || 'normal']}
字数要求：约${params.wordCount || 2000}字

请直接开始创作章节内容。`;

  for await (const chunk of streamLLM(
    [{ role: "user", content: prompt }],
    systemPrompt,
    { temperature: 0.8 },
    params.userId
  )) {
    yield { content: chunk.content, step: 1, totalSteps };
  }
}

/**
 * 章节润色
 * @param userId 用户ID（可选，使用用户自己的API Key）
 */
export async function polishChapter(params: {
  content: string;
  polishType: 'grammar' | 'style' | 'expand' | 'shorten' | 'dialogue' | 'description';
  instruction?: string;
  userId?: string;
}): Promise<{
  content: string;
  wordCount: number;
}> {
  const typePrompts: Record<string, string> = {
    grammar: '修正语法错误、错别字和不通顺的句子，保持原意不变',
    style: '提升文笔，让文字更优美、更有文学性，保持情节不变',
    expand: '扩写内容，增加细节描写和心理活动，让内容更丰富',
    shorten: '精简内容，保留核心情节，让节奏更紧凑',
    dialogue: '优化人物对话，让语言更符合角色性格，更自然生动',
    description: '增强场景描写和环境氛围，提升画面感',
  };

  const prompt = `请对以下小说内容进行润色：

【类型】${typePrompts[params.polishType] || params.instruction || '整体优化'}
${params.instruction ? `【额外要求】${params.instruction}\n` : ''}

【原文】
${params.content}

请直接输出润色后的完整内容，不要加任何解释或说明。`;

  const result = await invokeLLM(
    [{ role: "user", content: prompt }],
    "你是一个资深的小说编辑。请对作品进行专业的润色优化。",
    { temperature: 0.6 },
    params.userId
  );

  return {
    content: result,
    wordCount: result.replace(/\s/g, '').length,
  };
}

// ========== 世界观生成 ==========

/**
 * 生成世界观设定
 * @param userId 用户ID（可选，使用用户自己的API Key）
 */
export async function generateWorldBuilding(params: {
  bookTitle: string;
  genre: string;
  description: string;
  userId?: string;
}): Promise<{
  worldSetting: {
    geography: string;
    history: string;
    society: string;
    culture: string;
    powerSystem?: string;
    technology?: string;
  };
  locations: Array<{
    name: string;
    description: string;
    importance: string;
  }>;
}> {
  const prompt = `请为以下小说设计完整的世界观：

书名：${params.bookTitle}
类型：${params.genre}
简介：${params.description}

请设计一个逻辑自洽、细节丰富的世界观设定。`;

  return generateJSON(prompt, {
    worldSetting: "object，世界观总体设定",
    "worldSetting.geography": "string，地理环境设定",
    "worldSetting.history": "string，历史背景",
    "worldSetting.society": "string，社会结构",
    "worldSetting.culture": "string，文化习俗",
    "worldSetting.powerSystem": "string，力量体系（如修真、魔法等，如适用）",
    "worldSetting.technology": "string，科技水平（如适用）",
    locations: "array，重要地点列表，至少5个",
    "locations[].name": "string，地点名称",
    "locations[].description": "string，地点描述",
    "locations[].importance": "string，在故事中的重要性",
  }, {}, params.userId);
}

// ========== 内容检测 ==========

export async function detectContent(params: {
  content: string;
}): Promise<{
  wordCount: number;
  characterCount: number;
  paragraphCount: number;
  readability: number; // 1-10 可读性评分
  suggestions: string[];
  potentialIssues: string[];
}> {
  const wordCount = params.content.replace(/\s/g, '').length;
  const charCount = params.content.length;
  const paragraphCount = params.content.split(/\n\s*\n/).filter(p => p.trim()).length;

  // 简单的规则检测
  const potentialIssues: string[] = [];
  const suggestions: string[] = [];

  // 检查是否有过长段落
  const paragraphs = params.content.split(/\n\s*\n/);
  const longParagraphs = paragraphs.filter(p => p.replace(/\s/g, '').length > 500);
  if (longParagraphs.length > 0) {
    potentialIssues.push(`有 ${longParagraphs.length} 个段落过长（超过500字），建议拆分`);
  }

  // 检查是否重复用词（简单统计）
  const commonWords = ['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去'];
  // 简单的可读性评分
  let readability = 7; // 基础分
  if (paragraphCount > 20) readability += 1;
  if (longParagraphs.length > 5) readability -= 2;
  if (wordCount < 500) readability -= 1;
  readability = Math.max(1, Math.min(10, readability));

  suggestions.push('建议每章控制在2000-4000字，保持阅读节奏');
  if (longParagraphs.length > 0) {
    suggestions.push('长段落可以适当拆分，提升阅读体验');
  }

  return {
    wordCount,
    characterCount: charCount,
    paragraphCount,
    readability,
    suggestions,
    potentialIssues,
  };
}
