import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import RNSSE from 'react-native-sse';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

const STYLE_OPTIONS = [
  { label: '默认', value: '' },
  { label: '正式', value: '正式严谨，用词考究' },
  { label: '轻松', value: '轻松活泼，口语化' },
  { label: '文艺', value: '文艺优美，富有诗意' },
  { label: '专业', value: '专业详尽，逻辑清晰' },
];

export default function WriteScreen() {
  const router = useSafeRouter();
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState('');
  const [wordCount, setWordCount] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [title, setTitle] = useState('');
  const [editableContent, setEditableContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const sseRef = useRef<RNSSE | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      Alert.alert('提示', '请输入写作主题');
      return;
    }

    setGenerating(true);
    setGeneratedContent('');
    setTitle('');
    setEditableContent('');
    sseRef.current = null;

    try {
      const url = `${API_BASE}/api/v1/writing/generate`;
      const sse = new RNSSE(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: topic.trim(),
          writingStyle: style,
          wordCount: wordCount ? parseInt(wordCount, 10) : undefined,
        }),
      });

      sseRef.current = sse;
      let fullContent = '';
      let extractedTitle = '';

      sse.addEventListener('message', (event) => {
        const data = event.data;
        if (data === null || data === undefined) return;
        if (data === '[DONE]') {
          sse.close();
          setGenerating(false);
          // 提取标题
          const titleMatch = fullContent.match(/## (.+)/);
          if (titleMatch) {
            extractedTitle = titleMatch[1].trim();
            setTitle(extractedTitle);
          }
          setEditableContent(fullContent);
          return;
        }

        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            Alert.alert('生成失败', parsed.error);
            setGenerating(false);
            return;
          }
          if (parsed.content) {
            fullContent += parsed.content;
            setGeneratedContent(fullContent);
          }
        } catch {
          // 忽略解析错误
        }
      });

      sse.addEventListener('error', () => {
        sse.close();
        setGenerating(false);
        if (fullContent) {
          const titleMatch = fullContent.match(/## (.+)/);
          if (titleMatch) {
            setTitle(titleMatch[1].trim());
          }
          setEditableContent(fullContent);
        }
      });
    } catch (e) {
      console.error('SSE error:', e);
      Alert.alert('错误', '连接失败，请检查网络后重试');
      setGenerating(false);
    }
  };

  const handleStop = () => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    setGenerating(false);
    if (generatedContent) {
      const titleMatch = generatedContent.match(/## (.+)/);
      if (titleMatch) {
        setTitle(titleMatch[1].trim());
      }
      setEditableContent(generatedContent);
    }
  };

  const handleSave = async () => {
    const finalTitle = title.trim() || topic.trim() || '无标题';
    const finalContent = editableContent || generatedContent;

    if (!finalContent.trim()) {
      Alert.alert('提示', '内容不能为空');
      return;
    }

    setSaving(true);
    try {
      /**
       * 服务端文件：server/src/routes/writing.ts
       * 接口：POST /api/v1/writing
       * Body 参数：title: string, description: string, category: string, coverImage: string, volumes: Volume[]
       */
      const res = await fetch(`${API_BASE}/api/v1/writing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: finalTitle,
          description: topic.trim(),
          category: '其他',
          coverImage: '',
          volumes: [{
            title: '正文',
            order: 1,
            chapters: [{
              title: finalTitle,
              content: finalContent,
              wordCount: finalContent.replace(/\s/g, '').length,
            }],
          }],
        }),
      });
      const json = await res.json();
      if (json.success) {
        Alert.alert('保存成功', '文章已保存到你的作品集', [
          { text: '返回首页', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('保存失败', json.message || '请稍后重试');
      }
    } catch (e) {
      console.error('Save error:', e);
      Alert.alert('保存失败', '网络错误，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    try {
      const textToCopy = editableContent || generatedContent;
      await Clipboard.setStringAsync(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const isContentReady = editableContent || (generatedContent && !generating);

  return (
    <Screen backgroundColor="#F0F0F3" safeAreaEdges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <FontAwesome6 name="arrow-left" size={18} color="#2D3436" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {title || '新建写作'}
          </Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Input Section */}
          <View style={styles.shadowDark}>
            <View style={[styles.shadowLight, styles.inputSection]}>
              <Text style={styles.sectionLabel}>写作主题</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="输入你想写的主题，例如：春天的气息"
                  placeholderTextColor="#B2BEC3"
                  value={topic}
                  onChangeText={setTopic}
                  multiline
                  editable={!generating}
                />
              </View>

              {/* Style Selector */}
              <Text style={styles.sectionLabel}>写作风格</Text>
              <View style={styles.styleRow}>
                {STYLE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.label}
                    activeOpacity={0.7}
                    onPress={() => setStyle(opt.value)}
                    style={[
                      styles.styleTag,
                      style === opt.value && styles.styleTagActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.styleTagText,
                        style === opt.value && styles.styleTagTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Word Count */}
              <Text style={styles.sectionLabel}>字数要求（选填）</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="如：500"
                  placeholderTextColor="#B2BEC3"
                  value={wordCount}
                  onChangeText={setWordCount}
                  keyboardType="number-pad"
                  editable={!generating}
                />
              </View>

              {/* Generate Button */}
              {!generating ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleGenerate}
                  disabled={!topic.trim()}
                >
                  <LinearGradient
                    colors={
                      topic.trim()
                        ? ['#6C63FF', '#896BFF']
                        : ['#C4C4C4', '#D0D0D0']
                    }
                    style={styles.generateButton}
                  >
                    <FontAwesome6
                      name="wand-magic-sparkles"
                      size={18}
                      color="#FFFFFF"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.generateButtonText}>AI 开始写作</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleStop}
                  style={styles.stopButton}
                >
                  <FontAwesome6
                    name="stop"
                    size={16}
                    color="#FFFFFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.stopButtonText}>停止生成</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Generated Content */}
          {(generatedContent || generating) && (
            <View style={[styles.shadowDark, { marginTop: 16 }]}>
              <View style={[styles.shadowLight, styles.contentSection]}>
                <View style={styles.contentHeader}>
                  <FontAwesome6 name="pen-fancy" size={16} color="#6C63FF" />
                  <Text style={styles.contentHeaderText}>生成内容</Text>
                  {generating && (
                    <ActivityIndicator
                      size="small"
                      color="#6C63FF"
                      style={{ marginLeft: 8 }}
                    />
                  )}
                </View>

                {/* Title Input */}
                {isContentReady && (
                  <View style={[styles.inputContainer, { marginBottom: 12 }]}>
                    <TextInput
                      style={[styles.input, styles.titleInput]}
                      placeholder="文章标题"
                      placeholderTextColor="#B2BEC3"
                      value={title}
                      onChangeText={setTitle}
                    />
                  </View>
                )}

                {/* Editable Content */}
                {isContentReady ? (
                  <View style={[styles.inputContainer, { minHeight: 300 }]}>
                    <TextInput
                      style={[styles.input, styles.contentInput]}
                      placeholder="AI生成的内容将显示在这里，你可以直接编辑..."
                      placeholderTextColor="#B2BEC3"
                      value={editableContent || generatedContent}
                      onChangeText={(text) => {
                        setEditableContent(text);
                        setGeneratedContent(text);
                      }}
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                ) : generating ? (
                  <View style={styles.generatingContent}>
                    <Text style={styles.generatingText}>{generatedContent}</Text>
                    <View style={styles.cursor} />
                  </View>
                ) : null}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Actions */}
        {isContentReady && !generating && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleCopy}
              style={styles.bottomAction}
            >
              <View style={styles.bottomActionInner}>
                <FontAwesome6
                  name={copied ? 'check' : 'copy'}
                  size={16}
                  color="#6C63FF"
                />
                <Text style={styles.bottomActionText}>
                  {copied ? '已复制' : '复制'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSave}
              disabled={saving}
              style={{ flex: 1 }}
            >
              <LinearGradient
                colors={saving ? ['#C4C4C4', '#D0D0D0'] : ['#6C63FF', '#896BFF']}
                style={styles.saveButton}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <FontAwesome6
                      name="floppy-disk"
                      size={16}
                      color="#FFFFFF"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.saveButtonText}>保存文章</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F3',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F0F0F3',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(108,99,255,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2D3436',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  shadowDark: {
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    borderRadius: 24,
    ...Platform.select({
      android: { elevation: 6 },
    }),
  },
  shadowLight: {
    shadowColor: '#FFFFFF',
    shadowOffset: { width: -6, height: -6 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    backgroundColor: '#F0F0F3',
    borderRadius: 24,
    padding: 20,
    ...Platform.select({
      android: {
        backgroundColor: '#F0F0F3',
        borderRadius: 24,
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.5)',
      },
    }),
  },
  inputSection: {
    padding: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 8,
    marginTop: 8,
  },
  inputContainer: {
    backgroundColor: '#E8E8EB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  input: {
    fontSize: 15,
    color: '#2D3436',
    minHeight: 24,
  },
  titleInput: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3436',
  },
  contentInput: {
    minHeight: 260,
    lineHeight: 22,
  },
  styleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  styleTag: {
    backgroundColor: 'rgba(108,99,255,0.08)',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  styleTagActive: {
    backgroundColor: 'rgba(108,99,255,0.20)',
  },
  styleTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636E72',
  },
  styleTagTextActive: {
    color: '#6C63FF',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    paddingVertical: 16,
    marginTop: 16,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    paddingVertical: 16,
    marginTop: 16,
    backgroundColor: '#FF6B6B',
  },
  stopButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  contentSection: {
    padding: 20,
  },
  contentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  contentHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3436',
    marginLeft: 8,
  },
  generatingContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  generatingText: {
    fontSize: 15,
    color: '#2D3436',
    lineHeight: 22,
  },
  cursor: {
    width: 2,
    height: 20,
    backgroundColor: '#6C63FF',
    marginLeft: 2,
    marginTop: 2,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: '#F0F0F3',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    gap: 12,
  },
  bottomAction: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8E8EB',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomActionInner: {
    alignItems: 'center',
  },
  bottomActionText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6C63FF',
    marginTop: 2,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    paddingVertical: 16,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});