import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { FontAwesome6 } from '@expo/vector-icons';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

interface Article {
  id: string;
  title: string;
  content: string;
  topic: string;
  createdAt: string;
  updatedAt: string;
}

export default function DetailScreen() {
  const router = useSafeRouter();
  const { id } = useSafeSearchParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchArticle(id);
    }
  }, [id]);

  const fetchArticle = async (articleId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${articleId}`);
      const json = await res.json();
      if (json.success) {
        setArticle(json.data);
      }
    } catch (e) {
      console.error('获取文章详情失败:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      '确认删除',
      '删除后将无法恢复，确定要删除这篇文章吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const res = await fetch(`${API_BASE}/api/v1/writing/${id}`, {
                method: 'DELETE',
              });
              const json = await res.json();
              if (json.success) {
                router.back();
              } else {
                Alert.alert('删除失败', json.message || '请稍后重试');
              }
            } catch {
              Alert.alert('删除失败', '网络错误');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const formatContent = (content: string) => {
    // 移除标题标记 ## 但保留文字，加粗显示
    return content.replace(/##\s*/g, '').trim();
  };

  if (loading) {
    return (
      <Screen backgroundColor="#F0F0F3">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      </Screen>
    );
  }

  if (!article) {
    return (
      <Screen backgroundColor="#F0F0F3">
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <FontAwesome6 name="arrow-left" size={18} color="#2D3436" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>文章不存在</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContainer}>
          <FontAwesome6 name="face-frown" size={48} color="#B2BEC3" />
          <Text style={styles.errorText}>文章不存在或已被删除</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor="#F0F0F3" safeAreaEdges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <FontAwesome6 name="arrow-left" size={18} color="#2D3436" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {article.title}
          </Text>
          <TouchableOpacity
            onPress={handleDelete}
            disabled={deleting}
            style={styles.deleteButton}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#FF6B6B" />
            ) : (
              <FontAwesome6 name="trash-can" size={18} color="#FF6B6B" />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Article Card */}
          <View style={styles.shadowDark}>
            <View style={[styles.shadowLight, styles.articleCard]}>
              {/* Title */}
              <Text style={styles.articleTitle}>{article.title}</Text>

              {/* Meta */}
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <FontAwesome6 name="clock" size={12} color="#636E72" />
                  <Text style={styles.metaText}>{article.updatedAt}</Text>
                </View>
                <View style={styles.metaItem}>
                  <FontAwesome6 name="tag" size={12} color="#636E72" />
                  <Text style={styles.metaText}>{article.topic || '通用'}</Text>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Content */}
              <Text style={styles.articleContent}>{formatContent(article.content)}</Text>
            </View>
          </View>
        </ScrollView>
      </View>
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
    marginHorizontal: 12,
  },
  headerRight: {
    width: 40,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,107,107,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#636E72',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  shadowDark: {
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    borderRadius: 24,
    marginBottom: 16,
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
    padding: 24,
    ...Platform.select({
      android: {
        backgroundColor: '#F0F0F3',
        borderRadius: 24,
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.5)',
      },
    }),
  },
  articleCard: {
    padding: 24,
  },
  articleTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2D3436',
    lineHeight: 32,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#636E72',
  },
  divider: {
    height: 1,
    backgroundColor: '#D1D9E6',
    marginVertical: 20,
    opacity: 0.5,
  },
  articleContent: {
    fontSize: 16,
    color: '#2D3436',
    lineHeight: 28,
    letterSpacing: 0.3,
  },
});